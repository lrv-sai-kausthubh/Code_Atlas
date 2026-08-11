"""Aura 1.0 agent API.

POST /api/aura/chat — Aura 1.0 (CodeAtlas' own AI agent) answers a message
about a repository using ONLY the authorized view of that repository (same
filtering as /api/projects/{id}/graph). The agent runs entirely in-house:
NLU + a locally-trained intent model + reasoning tools over the authorized
graph. No external AI service is ever contacted and source content never
leaves the server.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services import authorization as authz
from app.services.aura import brain
from app.services.ml import AURA_MODEL_ID

logger = logging.getLogger("codeatlas.aura")

router = APIRouter()


class AuraChatRequest(BaseModel):
    message: str
    project_id: str = ""


def _require_authenticated(token: str) -> dict:
    from app.api.auth import _current_user

    user = _current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    return user


def _build_context(project_id: str, user: dict) -> dict[str, Any]:
    """Build the authorized, metadata-safe context Aura is allowed to see."""
    if not project_id:
        return {"project": None, "files": 0, "folders": 0, "languages": {}, "analysis": {}}

    from app.api.routes import (
        _enforce_org_membership,
        _load_project_result,
        _policy_for,
        _user_role,
        _user_teams,
    )

    email = user["email"]
    role = _user_role(email)
    _enforce_org_membership(project_id, email, role)
    result = _load_project_result(project_id)
    policy = _policy_for(project_id, email)
    authorized = authz.authorized_graph(result, email, role, policy, _user_teams(email))

    analysis = authorized.get("analysis") or {}
    visible_files = [
        node.get("path", "")
        for node in authorized.get("nodes", [])
        if node.get("type") == "file" and node.get("path")
    ]
    has_source = any(
        (node.get("access") or {}).get("source")
        for node in authorized.get("nodes", [])
        if node.get("type") == "file"
    )
    function_calls = authorized.get("function_calls") or []
    return {
        "project": authorized.get("project"),
        "files": authorized.get("files", 0),
        "folders": authorized.get("folders", 0),
        "languages": authorized.get("languages", {}),
        "analysis": analysis,
        "ml_insights": authorized.get("ml_insights"),
        "function_calls": function_calls,
        "visible_files": visible_files,
        "source_access": has_source,
        "file_details": authorized.get("file_details") or {},
        "nodes": authorized.get("nodes") or [],
    }


@router.post("/api/aura/chat")
def aura_chat(request: AuraChatRequest, token: str = Query("")):
    """Answer a user message with the in-house Aura 1.0 agent."""
    user = _require_authenticated(token)
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="message is required.")

    context = _build_context(request.project_id.strip(), user)
    try:
        emotion, reply, thinking, actions = brain.answer(context, message)
    except Exception as error:  # pragma: no cover - defensive
        logger.exception("Aura agent failed: %s", error)
        emotion, reply, thinking = "sad", (
            "Something tripped my reasoning mid-step — I logged it and I'm back up. Try again?"
        ), ["Encountered an internal error"]
        actions = []

    authz.audit(
        user["email"],
        "aura.chat",
        request.project_id.strip() or "global",
        {"engine": "aura", "message_len": len(message)},
    )
    return {
        "emotion": emotion,
        "message": reply,
        "model": AURA_MODEL_ID,
        "engine": "aura",
        "thinking": thinking,
        "actions": actions,
    }


@router.get("/api/aura/status")
def aura_status(token: str = Query("")):
    """Report the Aura model identity and whether the ML stack is live."""
    _require_authenticated(token)
    from app.services.ml import get_ml_service

    service = get_ml_service()
    return {
        "model": AURA_MODEL_ID,
        "ml_trained": service is not None,
        "engine": "native",
    }
