"""In-memory coordination API for Jamloom practice sessions.

This module coordinates session metadata and playback state only. It does not
stream audio, record microphones, or provide authentication suitable for a
public deployment. Session data is intentionally ephemeral in this prototype.
"""
from __future__ import annotations

import asyncio
import copy
import secrets
import string
import time
import uuid
from typing import Any

from fastapi import APIRouter, Header, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

# In-memory store is suitable only for a single-process development prototype.
_sessions: dict[str, dict[str, Any]] = {}
_connections: dict[str, set[WebSocket]] = {}
_lock = asyncio.Lock()
_INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class CreateSessionRequest(BaseModel):
    title: str = Field(default="Jam session", min_length=1, max_length=100)
    display_name: str = Field(default="Host", min_length=1, max_length=40)
    track_job_id: str | None = None


class JoinSessionRequest(BaseModel):
    invite_code: str = Field(min_length=6, max_length=6)
    display_name: str = Field(default="Guest", min_length=1, max_length=40)


class StatePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    track_job_id: str | None = None
    playing: bool | None = None
    position_seconds: float | None = Field(default=None, ge=0)
    loop_start_seconds: float | None = Field(default=None, ge=0)
    loop_end_seconds: float | None = Field(default=None, ge=0)
    bpm: float | None = Field(default=None, gt=0, le=400)
    excluded_stems: list[str] | None = None


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def _participant(participant_id: str, display_name: str, role: str) -> dict[str, Any]:
    return {
        "id": participant_id,
        "display_name": display_name.strip(),
        "role": role,
        "token": _new_token(),
        "connected": False,
        "joined_at": time.time(),
    }


def _public_session(session: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(session)
    result.pop("invite_code", None)
    result["participants"] = [
        {key: value for key, value in participant.items() if key != "token"}
        for participant in session["participants"].values()
    ]
    return result


def _find_participant(session: dict[str, Any], token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    # Tokens are random high-entropy secrets; constant-time comparison is used
    # even though this is a local prototype.
    for participant in session["participants"].values():
        if secrets.compare_digest(participant["token"], token):
            return participant
    return None


def _require_participant(session: dict[str, Any] | None, token: str | None) -> dict[str, Any]:
    participant = _find_participant(session, token) if session else None
    if not participant:
        raise HTTPException(status_code=401, detail="A valid session participant token is required.")
    return participant


async def _broadcast(session_id: str, message: dict[str, Any]) -> None:
    async with _lock:
        sockets = list(_connections.get(session_id, set()))
    if not sockets:
        return
    results = await asyncio.gather(
        *(socket.send_json(message) for socket in sockets), return_exceptions=True
    )
    failed = {socket for socket, result in zip(sockets, results) if isinstance(result, Exception)}
    if failed:
        async with _lock:
            current = _connections.get(session_id, set())
            current.difference_update(failed)


async def _apply_state(session_id: str, patch: StatePatch) -> dict[str, Any]:
    values = patch.model_dump(exclude_unset=True)
    async with _lock:
        session = _sessions.get(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found.")
        state = session["state"]
        candidate = {**state, **values}
        start = candidate.get("loop_start_seconds")
        end = candidate.get("loop_end_seconds")
        if start is not None and end is not None and end <= start:
            raise HTTPException(status_code=422, detail="Loop end must be after loop start.")
        if values.get("excluded_stems") is not None:
            valid_stems = {"vocals", "drums", "bass", "guitar", "piano", "other"}
            invalid = set(values["excluded_stems"]) - valid_stems
            if invalid:
                raise HTTPException(status_code=422, detail=f"Unknown stem(s): {', '.join(sorted(invalid))}")
        state.update(values)
        state["updated_at"] = time.time()
        snapshot = _public_session(session)
    await _broadcast(session_id, {"type": "state_changed", "session": snapshot})
    return snapshot


@router.post("")
async def create_session(request: CreateSessionRequest):
    async with _lock:
        session_id = uuid.uuid4().hex[:16]
        invite_code = "".join(secrets.choice(_INVITE_ALPHABET) for _ in range(6))
        while any(s["invite_code"] == invite_code for s in _sessions.values()):
            invite_code = "".join(secrets.choice(_INVITE_ALPHABET) for _ in range(6))
        host_id = uuid.uuid4().hex[:12]
        host = _participant(host_id, request.display_name, "host")
        now = time.time()
        session = {
            "id": session_id,
            "title": request.title.strip(),
            "invite_code": invite_code,
            "host_participant_id": host_id,
            "created_at": now,
            "state": {
                "track_job_id": request.track_job_id,
                "playing": False,
                "position_seconds": 0.0,
                "loop_start_seconds": None,
                "loop_end_seconds": None,
                "bpm": None,
                "excluded_stems": [],
                "updated_at": now,
            },
            "participants": {host_id: host},
        }
        _sessions[session_id] = session
        _connections[session_id] = set()
        response = _public_session(session)
        response["invite_code"] = invite_code
        response["participant_token"] = host["token"]
    return response


@router.post("/join")
async def join_session(request: JoinSessionRequest):
    code = request.invite_code.strip().upper()
    async with _lock:
        session = next((s for s in _sessions.values() if s["invite_code"] == code), None)
        if session is None:
            raise HTTPException(status_code=404, detail="No active session has that invite code.")
        participant_id = uuid.uuid4().hex[:12]
        participant = _participant(participant_id, request.display_name, "listener")
        session["participants"][participant_id] = participant
        response = _public_session(session)
        response["participant_token"] = participant["token"]
        session_id = session["id"]
    await _broadcast(session_id, {"type": "participants_changed", "session": _public_session(_sessions[session_id])})
    return response


@router.get("/{session_id}")
async def get_session(session_id: str, x_participant_token: str | None = Header(default=None)):
    async with _lock:
        session = _sessions.get(session_id)
        _require_participant(session, x_participant_token)
        return _public_session(session)


@router.post("/{session_id}/state")
async def update_session_state(
    session_id: str,
    patch: StatePatch,
    x_participant_token: str | None = Header(default=None),
):
    async with _lock:
        session = _sessions.get(session_id)
        _require_participant(session, x_participant_token)
    return await _apply_state(session_id, patch)


@router.delete("/{session_id}/participants/me")
async def leave_session(session_id: str, x_participant_token: str | None = Header(default=None)):
    async with _lock:
        session = _sessions.get(session_id)
        participant = _require_participant(session, x_participant_token)
        participant_id = participant["id"]
        del session["participants"][participant_id]
        if not session["participants"]:
            _sessions.pop(session_id, None)
            _connections.pop(session_id, None)
            return {"status": "session_closed"}
        if session["host_participant_id"] == participant_id:
            # Transfer host role to the earliest remaining participant.
            next_host = min(session["participants"].values(), key=lambda p: p["joined_at"])
            next_host["role"] = "host"
            session["host_participant_id"] = next_host["id"]
        snapshot = _public_session(session)
    await _broadcast(session_id, {"type": "participants_changed", "session": snapshot})
    return {"status": "left", "session": snapshot}


@router.websocket("/{session_id}/ws")
async def session_websocket(websocket: WebSocket, session_id: str, token: str):
    async with _lock:
        session = _sessions.get(session_id)
        participant = _find_participant(session, token) if session else None
        if not participant:
            await websocket.close(code=4401, reason="Invalid session token")
            return
        participant_id = participant["id"]
        participant["connected"] = True
        _connections.setdefault(session_id, set()).add(websocket)
        snapshot = _public_session(session)
    await websocket.accept()
    await websocket.send_json({"type": "snapshot", "session": snapshot})
    await _broadcast(session_id, {"type": "participants_changed", "session": snapshot})
    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type") if isinstance(message, dict) else None
            if message_type == "ping":
                await websocket.send_json({"type": "pong", "server_time": time.time()})
            elif message_type == "state_update":
                raw_state = message.get("state", {})
                if not isinstance(raw_state, dict):
                    await websocket.send_json({"type": "error", "detail": "State must be an object."})
                    continue
                try:
                    patch = StatePatch(**raw_state)
                    await _apply_state(session_id, patch)
                except (ValueError, HTTPException) as exc:
                    detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
                    await websocket.send_json({"type": "error", "detail": detail})
            else:
                await websocket.send_json({"type": "error", "detail": "Unknown message type."})
    except WebSocketDisconnect:
        pass
    finally:
        async with _lock:
            _connections.get(session_id, set()).discard(websocket)
            current_session = _sessions.get(session_id)
            if current_session and participant_id in current_session["participants"]:
                current_session["participants"][participant_id]["connected"] = False
                snapshot = _public_session(current_session)
            else:
                snapshot = None
        if snapshot is not None:
            await _broadcast(session_id, {"type": "participants_changed", "session": snapshot})
