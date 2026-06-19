"""Firestore-backed persistence helpers for authenticated users."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import Any

from .firebase_auth import _require_firebase_admin, init_firebase

USER_PROFILES_COLLECTION = "user_profiles"


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _display_name_from_claims(
    claims: Mapping[str, Any],
    existing_profile: Mapping[str, Any] | None = None,
) -> str | None:
    display_name = _string_or_none(claims.get("name"))
    if display_name:
        return display_name

    if existing_profile is not None:
        existing_display_name = _string_or_none(existing_profile.get("display_name"))
        if existing_display_name:
            return existing_display_name

    email = _string_or_none(claims.get("email"))
    if email and "@" in email:
        return email.split("@", 1)[0]

    return None


def _provider_id_from_claims(
    claims: Mapping[str, Any],
    existing_profile: Mapping[str, Any] | None = None,
) -> str | None:
    firebase_claims = claims.get("firebase")
    if isinstance(firebase_claims, Mapping):
        provider_id = _string_or_none(firebase_claims.get("sign_in_provider"))
        if provider_id:
            return provider_id

    if existing_profile is not None:
        existing_provider_id = _string_or_none(existing_profile.get("provider_id"))
        if existing_provider_id:
            return existing_provider_id

    return None


def _build_user_profile(
    claims: Mapping[str, Any],
    existing_profile: Mapping[str, Any] | None = None,
) -> dict[str, str | None]:
    now = datetime.now(datetime.UTC).isoformat()
    created_at = (
        _string_or_none(existing_profile.get("created_at"))
        if existing_profile
        else None
    )
    email = _string_or_none(claims.get("email"))
    if email is None and existing_profile is not None:
        email = _string_or_none(existing_profile.get("email"))

    return {
        "uid": _string_or_none(claims.get("uid")) or "",
        "email": email,
        "display_name": _display_name_from_claims(claims, existing_profile),
        "photo_url": _string_or_none(claims.get("picture"))
        or (
            _string_or_none(existing_profile.get("photo_url"))
            if existing_profile is not None
            else None
        ),
        "provider_id": _provider_id_from_claims(claims, existing_profile),
        "created_at": created_at or now,
        "updated_at": now,
        "last_login_at": now,
    }


def get_firestore_client():
    """Return the Firestore client using Firebase Admin credentials."""
    init_firebase()
    _firebase_admin, _auth, _credentials = _require_firebase_admin()

    try:
        from firebase_admin import firestore
    except ImportError as exc:  # pragma: no cover - exercised only in missing-dep envs
        msg = (
            "firebase-admin firestore support is not installed. "
            "Install firebase-admin and google-cloud-firestore in the "
            "backend environment."
        )
        raise RuntimeError(msg) from exc

    return firestore.client()


def upsert_authenticated_user(claims: Mapping[str, Any]) -> Mapping[str, Any]:
    """Persist a Firebase-authenticated user profile into Firestore."""
    uid = _string_or_none(claims.get("uid"))
    if not uid:
        raise ValueError("Firebase token did not include a uid claim")

    client = get_firestore_client()
    document_ref = client.collection(USER_PROFILES_COLLECTION).document(uid)
    existing_snapshot = document_ref.get()
    existing_profile = existing_snapshot.to_dict() if existing_snapshot.exists else None

    profile = _build_user_profile(claims, existing_profile)
    document_ref.set(profile, merge=True)
    return profile


def get_authenticated_user(uid: str) -> Mapping[str, Any] | None:
    """Load a stored Firebase-authenticated user profile from Firestore."""
    normalized_uid = _string_or_none(uid)
    if not normalized_uid:
        return None

    client = get_firestore_client()
    snapshot = (
        client.collection(USER_PROFILES_COLLECTION)
        .document(normalized_uid)
        .get()
    )
    if not snapshot.exists:
        return None

    data = snapshot.to_dict() or {}
    if "uid" not in data:
        data["uid"] = normalized_uid
    return data
