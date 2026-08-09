"""In-memory pub/sub event bus used to push real-time change events to clients.

The bus is thread-safe: synchronous FastAPI endpoints (and worker threads such
as the upload analyzer) call ``publish``; the event is handed to the event
loop captured during application startup and fanned out to every subscribed
SSE client queue.
"""
from __future__ import annotations

import asyncio
import logging
import threading
import time
from typing import Any

logger = logging.getLogger("codeatlas.events")

MAX_SUBSCRIBERS = 256
QUEUE_SIZE = 128


class EventBus:
    def __init__(self) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._lock = threading.Lock()

    def attach_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=QUEUE_SIZE)
        with self._lock:
            if len(self._subscribers) >= MAX_SUBSCRIBERS:
                # Drop the oldest subscriber to avoid unbounded growth.
                oldest = next(iter(self._subscribers))
                self._subscribers.discard(oldest)
                try:
                    oldest.put_nowait(
                        {
                            "type": "bus.overflow",
                            "project_id": None,
                            "payload": {"message": "Reconnected: too many open streams."},
                            "ts": time.time(),
                        }
                    )
                except asyncio.QueueFull:
                    pass
            self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        with self._lock:
            self._subscribers.discard(queue)

    def shutdown(self) -> None:
        """Close every subscriber stream so uvicorn can shut down cleanly.
        Runs on the event loop during application teardown."""
        with self._lock:
            queues = list(self._subscribers)
            self._subscribers.clear()
        for queue in queues:
            try:
                queue.put_nowait(
                    {
                        "type": "bus.shutdown",
                        "project_id": None,
                        "payload": {},
                        "ts": time.time(),
                    }
                )
            except asyncio.QueueFull:
                pass

    def publish(
        self,
        type_: str,
        project_id: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        """Thread-safe publish; callable from sync endpoints and worker threads."""
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        event = {
            "type": type_,
            "project_id": project_id,
            "payload": payload or {},
            "ts": time.time(),
        }
        try:
            asyncio.run_coroutine_threadsafe(self._fan_out(event), loop)
        except (RuntimeError, ValueError):
            pass

    async def _fan_out(self, event: dict[str, Any]) -> None:
        with self._lock:
            subscribers = list(self._subscribers)
        for queue in subscribers:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                # Drop the oldest buffered event so the newest always lands.
                try:
                    queue.get_nowait()
                    queue.put_nowait(event)
                except (asyncio.QueueEmpty, asyncio.QueueFull):
                    pass


bus = EventBus()
