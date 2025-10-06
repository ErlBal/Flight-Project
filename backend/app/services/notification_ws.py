from __future__ import annotations
from typing import Dict, Set
from fastapi import WebSocket
import json
import asyncio

class NotificationConnectionManager:
    """Manager of WebSocket connections per user email.
    We keep a set of active WebSockets for each user.
    """
    def __init__(self) -> None:
        self._user_sockets: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, email: str, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            if email not in self._user_sockets:
                self._user_sockets[email] = set()
            self._user_sockets[email].add(websocket)

    async def disconnect(self, email: str, websocket: WebSocket):
        async with self._lock:
            conns = self._user_sockets.get(email)
            if conns and websocket in conns:
                conns.remove(websocket)
                if not conns:
                    self._user_sockets.pop(email, None)

    async def send_to_user(self, email: str, payload: dict):
        # Send to every open tab/session of the user
        message = json.dumps(payload, ensure_ascii=False)
        async with self._lock:
            conns = list(self._user_sockets.get(email, []))
        for ws in conns:
            try:
                await ws.send_text(message)
            except Exception:
                # Silently remove the problematic connection
                await self.disconnect(email, ws)

    async def broadcast(self, payload: dict):
        message = json.dumps(payload, ensure_ascii=False)
        async with self._lock:
            all_conns = [ws for conns in self._user_sockets.values() for ws in conns]
        for ws in all_conns:
            try:
                await ws.send_text(message)
            except Exception:
                # Ignore — it will be cleaned up on the next cycle
                pass

manager = NotificationConnectionManager()
