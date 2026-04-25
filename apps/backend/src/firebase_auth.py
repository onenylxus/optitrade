"""Firebase Admin authentication helpers for FastAPI routes."""

from __future__ import annotations

import os
import threading
from collections.abc import Mapping
from pathlib import Path
from typing import Any

_init_lock = threading.Lock()
_initialized = False


def _load_backend_dotenv() -> None:
    """Load GOOGLE_APPLICATION_CREDENTIALS from apps/backend/.env if present."""
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        return

    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key == "GOOGLE_APPLICATION_CREDENTIALS" and value:
            os.environ.setdefault(key, value)
            return


def _require_firebase_admin() -> tuple[Any, Any]:
    """Import Firebase Admin lazily so app startup does not hard-fail in dev."""
    try:
        import firebase_admin
        from firebase_admin import auth, credentials
    except ImportError as exc:  # pragma: no cover - exercised only in missing-dep envs
        msg = (
            "firebase-admin is not installed. "
            "Install it in apps/backend dependencies to enable Firebase auth."
        )
        raise RuntimeError(msg) from exc
    return firebase_admin, auth, credentials


def init_firebase() -> None:
    """Initialize Firebase Admin SDK once using Application Default Credentials."""
    global _initialized
    if _initialized:
        return

    _load_backend_dotenv()

    firebase_admin, _auth, credentials = _require_firebase_admin()

    with _init_lock:
        if _initialized:
            return
        firebase_admin.initialize_app(credentials.ApplicationDefault())
        _initialized = True


def verify_firebase_id_token(id_token: str) -> Mapping[str, Any]:
    """Verify a Firebase ID token and return its decoded claims."""
    init_firebase()
    _firebase_admin, auth, _credentials = _require_firebase_admin()
    decoded: Mapping[str, Any] = auth.verify_id_token(id_token)
    return decoded
