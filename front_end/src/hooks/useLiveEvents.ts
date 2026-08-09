import { useEffect, useRef } from "react";
import { API_BASE_URL } from "../services/api";

export type LiveEvent = {
    type: string;
    project_id: string | null;
    payload: Record<string, unknown>;
    ts: number;
};

/** Subscribe to the backend's SSE stream; the browser auto-reconnects (retry: 3000). */
export function useLiveEvents(handler: (event: LiveEvent) => void, enabled = true) {
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    useEffect(() => {
        if (!enabled) return;
        const token = localStorage.getItem("codeatlas-token") ?? "";
        if (!token) return;
        const source = new EventSource(`${API_BASE_URL}/api/events?token=${encodeURIComponent(token)}`);
        source.onmessage = (message) => {
            try {
                const event = JSON.parse(message.data) as LiveEvent;
                handlerRef.current(event);
            } catch {
                // Ignore malformed frames (keep-alive comments are dropped by EventSource).
            }
        };
        return () => source.close();
    }, [enabled]);
}
