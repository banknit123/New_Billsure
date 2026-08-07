"""
backend/identity_verification.py
===================================
Identity verification adapter for `onboarding.identity_verification_status`.

Real provider: Didit (https://didit.me) — chosen for a free-forever tier
(500 verifications/month, well above this 25-customer pilot's volume)
and a self-serve sandbox with no sales process. See
docs/asic-ers-readiness/ for the provider comparison this was chosen
from.

THIS SESSION HAS A REAL DIDIT API KEY configured (`DIDIT_API_KEY`), but
this sandbox's network egress is restricted to a package-registry
allowlist (pypi, npm, GitHub, etc.) that does not include
verification.didit.me — so even with a real key, the live HTTP call
still cannot be exercised from this specific environment. What changed
this session: the request shape was verified against Didit's published
API reference (docs.didit.me/api-reference) rather than left as an
unverified guess — this caught two real mistakes in the first version
of this module (wrong auth header, missing required `workflow_id`), both
fixed below. The remaining gap is a live network call, not the
request/response contract.

To actually complete verification: run this module (with `DIDIT_API_KEY`
and `DIDIT_WORKFLOW_ID` set) from an environment with real network
access — a local machine, a CI runner, or the actual deployment target —
and confirm `start_verification_session()` / `get_verification_result()`
against Didit's real sandbox before trusting this in a pilot.
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
# A Didit workflow must exist before a session can be created against it
# -- either built in the Didit console (business.didit.me -> Workflows)
# or via POST /v3/workflows/. There is no sane default; refuse to guess
# one, same fail-closed posture as everything else in this module.
DIDIT_WORKFLOW_ID = os.environ.get("DIDIT_WORKFLOW_ID", "")
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
    """Real Didit integration, corrected against Didit's published API
    reference (docs.didit.me/api-reference) after this module's first
    version guessed the contract without live access to verify it:

    - Auth is the `x-api-key` header, NOT `Authorization: Bearer` (the
      first version of this module had this wrong).
    - Session creation requires a `workflow_id` for an existing workflow
      (built in the Didit console or via POST /v3/workflows/) — there is
      no bare "features list" parameter on /v3/session/ the way the
      first version of this module assumed.

    Still NOT tested against a live endpoint from this environment: this
    sandbox's network egress is restricted to package-registry domains
    and does not include verification.didit.me, so even with a real key
    configured, this exact code path cannot be exercised from here. Test
    it from an environment with real network access before relying on
    it — see the module docstring."""
    if not DIDIT_WORKFLOW_ID:
        raise IdentityVerificationError(
            "DIDIT_WORKFLOW_ID is not configured — a Didit workflow must exist first "
            "(create one in the Didit console or via POST /v3/workflows/) before a session can be created"
        )

    import httpx

    async with httpx.AsyncClient(base_url=DIDIT_BASE_URL, timeout=15.0) as client:
        try:
            response = await client.post(
                "/v3/session/",
                headers={"x-api-key": DIDIT_API_KEY, "Content-Type": "application/json"},
                json={"workflow_id": DIDIT_WORKFLOW_ID, "vendor_data": applicant_reference},
            )
            response.raise_for_status()
        except httpx.HTTPError as e:
            raise IdentityVerificationError(f"Didit session creation failed: {e}") from e
        data = response.json()
        # Didit's documented examples show the create-session response
        # varying between including session_id directly and only
        # showing session_url in shortened marketing snippets — handle
        # both rather than assuming one shape and failing on the other.
        session_id = data.get("session_id")
        if not session_id:
            session_url = data.get("session_url", "")
            session_id = session_url.rstrip("/").split("/")[-1] if session_url else None
        if not session_id:
            raise IdentityVerificationError(f"Didit response contained neither session_id nor a parseable session_url: {data}")
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
            response = await client.get(f"/v3/session/{session_id}/decision/", headers={"x-api-key": DIDIT_API_KEY})
            response.raise_for_status()
        except httpx.HTTPError as e:
            raise IdentityVerificationError(f"Didit result lookup failed: {e}") from e
        data = response.json()

    didit_status = data.get("status", "")
    status_map = {"Approved": "verified", "Declined": "failed", "In Review": "pending", "In Progress": "pending", "Not Started": "pending"}
    status = status_map.get(didit_status, "pending")

    return IdentityVerificationResult(
        status=status, provider="didit", provider_reference=session_id,
        checked_at=datetime.now(timezone.utc).isoformat(), raw_response=data,
    )
