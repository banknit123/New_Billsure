"""
backend/identity_verification.py
===================================
Identity verification adapter for `onboarding.identity_verification_status`.

Real provider: Didit (https://didit.me) — chosen for a free-forever tier
(500 verifications/month, well above this 25-customer pilot's volume)
and a self-serve sandbox with no sales process. See
docs/asic-ers-readiness/ for the provider comparison this was chosen
from.

THIS SESSION DID NOT HAVE A REAL DIDIT API KEY. Per the top-level task's
instruction #13 ("where an external dependency prevents completion,
implement the interface, configuration, validation and fail-closed
behaviour, then record the dependency as blocked"), this module:

- Implements the real HTTP integration against Didit's documented
  sandbox API shape, gated behind `DIDIT_API_KEY` / `DIDIT_BASE_URL`
  environment variables.
- FAILS CLOSED (raises, does not silently approve or fall back) if
  those aren't configured and mock mode isn't explicitly enabled.
- Provides a sandbox/local mock path for development and testing that
  must be explicitly opted into via `ALLOW_MOCK_IDENTITY_VERIFICATION=
  true` — off by default, mirroring the existing `ALLOW_MOCK_PAYMENTS`
  pattern in `server.py` — so this can never accidentally run in a
  production-like environment with no real provider configured.

This module has NOT been tested against Didit's real sandbox endpoint
(no credentials available in this environment) — only the mock path is
exercised by `test_identity_verification.py`. The real-endpoint code
path is implemented but unverified; treat it as "implemented but
awaiting external configuration" per the evidence pack's status
taxonomy, not "implemented and tested."
"""

import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

DIDIT_BASE_URL = os.environ.get("DIDIT_BASE_URL", "https://verification.didit.me")
DIDIT_API_KEY = os.environ.get("DIDIT_API_KEY", "")
ALLOW_MOCK_IDENTITY_VERIFICATION = os.environ.get("ALLOW_MOCK_IDENTITY_VERIFICATION", "false").lower() == "true"

VERIFICATION_STATUSES = ("pending", "verified", "failed")


class IdentityVerificationError(Exception):
    """Raised for configuration or provider failures. Never raised in a
    way that leaves a caller able to treat the applicant as verified —
    every raise path here means 'do not proceed', full stop."""


@dataclass
class IdentityVerificationResult:
    status: str                  # pending | verified | failed
    provider: str                 # 'didit' | 'mock'
    provider_reference: str
    checked_at: str
    raw_response: Optional[dict] = None


async def start_verification_session(applicant_reference: str) -> str:
    """Creates a verification session with the provider and returns a
    session/reference id the applicant completes the flow against
    (typically a hosted verification URL or SDK session token). Fails
    closed if no real provider is configured and mock mode isn't
    explicitly enabled."""
    if DIDIT_API_KEY:
        return await _start_didit_session(applicant_reference)
    if ALLOW_MOCK_IDENTITY_VERIFICATION:
        logger.warning("ALLOW_MOCK_IDENTITY_VERIFICATION is enabled — using a MOCK identity verification session, "
                        "not a real provider. This must never be enabled outside local development/testing.")
        return f"mock-session-{uuid.uuid4()}"
    raise IdentityVerificationError(
        "no identity verification provider is configured (DIDIT_API_KEY unset) and "
        "ALLOW_MOCK_IDENTITY_VERIFICATION is not enabled — refusing to proceed rather than silently skip verification"
    )


async def _start_didit_session(applicant_reference: str) -> str:
    """Real Didit integration. NOT tested against a live endpoint in this
    session (no API key available) — implemented against Didit's
    documented v3 session-creation contract; verify against the real
    sandbox before relying on this in an actual pilot."""
    import httpx

    async with httpx.AsyncClient(base_url=DIDIT_BASE_URL, timeout=15.0) as client:
        try:
            response = await client.post(
                "/v3/session/",
                headers={"Authorization": f"Bearer {DIDIT_API_KEY}"},
                json={"vendor_data": applicant_reference, "features": ["ID_VERIFICATION", "LIVENESS", "FACE_MATCH"]},
            )
            response.raise_for_status()
        except httpx.HTTPError as e:
            raise IdentityVerificationError(f"Didit session creation failed: {e}") from e
        data = response.json()
        session_id = data.get("session_id")
        if not session_id:
            raise IdentityVerificationError(f"Didit response missing session_id: {data}")
        return session_id


async def get_verification_result(session_id: str) -> IdentityVerificationResult:
    """Polls/reads the result of a previously-started verification
    session. Same fail-closed posture as start_verification_session()."""
    if session_id.startswith("mock-session-"):
        if not ALLOW_MOCK_IDENTITY_VERIFICATION:
            raise IdentityVerificationError(
                "received a mock session id but ALLOW_MOCK_IDENTITY_VERIFICATION is not enabled — refusing to trust it"
            )
        return _mock_result(session_id)

    if not DIDIT_API_KEY:
        raise IdentityVerificationError("DIDIT_API_KEY unset — cannot check a real Didit session result")
    return await _get_didit_result(session_id)


def _mock_result(session_id: str) -> IdentityVerificationResult:
    """Deterministic local mock for development/testing ONLY, gated
    behind ALLOW_MOCK_IDENTITY_VERIFICATION. Always returns 'verified' —
    this is intentionally simplistic (it exists to let onboarding.py's
    downstream logic be exercised without a real provider, not to
    simulate realistic KYC failure modes; test THAT logic against
    bill_verification.py-style deterministic unit tests instead, not
    against this mock)."""
    return IdentityVerificationResult(
        status="verified", provider="mock", provider_reference=session_id,
        checked_at=datetime.now(timezone.utc).isoformat(),
        raw_response={"note": "MOCK result — ALLOW_MOCK_IDENTITY_VERIFICATION is enabled, this is not a real check"},
    )


async def _get_didit_result(session_id: str) -> IdentityVerificationResult:
    import httpx

    async with httpx.AsyncClient(base_url=DIDIT_BASE_URL, timeout=15.0) as client:
        try:
            response = await client.get(f"/v3/session/{session_id}/decision/", headers={"Authorization": f"Bearer {DIDIT_API_KEY}"})
            response.raise_for_status()
        except httpx.HTTPError as e:
            raise IdentityVerificationError(f"Didit result lookup failed: {e}") from e
        data = response.json()

    didit_status = data.get("status", "").lower()
    status_map = {"approved": "verified", "declined": "failed", "in_review": "pending", "in_progress": "pending"}
    status = status_map.get(didit_status, "pending")

    return IdentityVerificationResult(
        status=status, provider="didit", provider_reference=session_id,
        checked_at=datetime.now(timezone.utc).isoformat(), raw_response=data,
    )
