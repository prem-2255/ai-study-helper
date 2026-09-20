"""Google Sign-In ID token verification.

The previous implementation called Google's `oauth2/v3/tokeninfo` endpoint.
Google documents that endpoint as a debugging aid rather than a production
verifier: it is rate limited on Google's side and costs a network round-trip on
every single login. `google.oauth2.id_token.verify_oauth2_token` instead checks
the RS256 signature locally against Google's published certificates, so
verification is both stronger and cheaper.

Everything in here raises HTTPException rather than returning a falsy value, so
a caller cannot accidentally treat an unverified token as verified.
"""
import logging
import os
import threading
from typing import Any, Dict

from fastapi import HTTPException, status
# pyrefly: ignore [missing-import]
from google.auth.transport import requests as google_requests
# pyrefly: ignore [missing-import]
from google.oauth2 import id_token as google_id_token

logger = logging.getLogger("study_helper")

# Google mints ID tokens with one of these two issuer strings. Anything else is
# not from Google, however well-formed it looks.
_ALLOWED_ISSUERS = ("accounts.google.com", "https://accounts.google.com")

# A few seconds of tolerance for a local clock that runs slightly fast. Without
# it, a freshly minted token can be rejected as "used before issued" on a
# machine whose clock drifted, which looks like a broken login rather than a
# clock problem.
_CLOCK_SKEW_SECONDS = 10

# Deliberately vague: distinguishing "expired" from "wrong audience" from
# "forged" tells an attacker which knob to turn. The real reason is logged.
_GENERIC_REJECTION = "Google sign-in could not be verified. Please try signing in again."

_thread_local = threading.local()


def _transport() -> google_requests.Request:
    """Return this thread's HTTP transport for fetching Google's certificates.

    One transport per worker thread rather than one global: verification runs in
    FastAPI's threadpool and this wraps a `requests.Session`, which is not
    thread-safe. Thread-local keeps connection reuse without the interleaving
    risk of a single shared session.
    """
    transport = getattr(_thread_local, "transport", None)
    if transport is None:
        transport = google_requests.Request()
        _thread_local.transport = transport
    return transport


def get_client_id() -> str:
    """The OAuth 2.0 Web client ID this server accepts tokens for.

    Not a secret: it is embedded in every page that renders a Google button.
    Its job is to pin the token's audience, not to authenticate anyone.
    """
    return os.getenv("GOOGLE_CLIENT_ID", "").strip()


def is_configured() -> bool:
    return bool(get_client_id())


def demo_login_enabled() -> bool:
    """Whether the offline `demo_gtoken_...` shortcut is active.

    Off unless explicitly opted in, and never a silent default: the shortcut
    mints a session for any email address with no proof that the caller owns it.
    Mirrors how ENABLE_DEMO_USER is gated in main.py, and for the same reason.
    """
    return os.getenv("ENABLE_GOOGLE_DEMO_LOGIN", "").strip().lower() in ("1", "true", "yes")


def verify_google_id_token(raw_token: str) -> Dict[str, Any]:
    """Verify a Google ID token and return the claims we are willing to trust.

    Blocking (it may fetch Google's certificates), so call it through
    `run_in_threadpool` rather than directly inside an async route.
    """
    client_id = get_client_id()
    if not client_id:
        # Verifying with no client ID means skipping the `aud` check, which would
        # accept an ID token minted for *any other* Google application. Refusing
        # to run is the only safe option.
        logger.error("Rejected a Google sign-in: GOOGLE_CLIENT_ID is not set on this server.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured on this server yet.",
        )

    try:
        claims = google_id_token.verify_oauth2_token(
            raw_token,
            _transport(),
            client_id,
            clock_skew_in_seconds=_CLOCK_SKEW_SECONDS,
        )
    except ValueError as exc:
        # google-auth reports every verification failure as ValueError: bad
        # signature, wrong audience, expired, malformed.
        logger.warning("Rejected Google ID token: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_GENERIC_REJECTION)
    except HTTPException:
        raise
    except Exception:
        # Transport-level failure, i.e. we could not reach Google. This is our
        # problem, not the caller's, so it must not read as "bad credentials".
        logger.exception("Google ID token verification failed unexpectedly")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not reach Google to verify your sign-in. Please try again shortly.",
        )

    # Re-checked here rather than relied upon: google-auth does validate the
    # issuer, but asserting it locally keeps this correct across library versions.
    if claims.get("iss") not in _ALLOWED_ISSUERS:
        logger.warning("Rejected Google ID token with unexpected issuer %r", claims.get("iss"))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_GENERIC_REJECTION)

    subject = str(claims.get("sub") or "").strip()
    if not subject:
        logger.warning("Rejected Google ID token with no subject claim")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_GENERIC_REJECTION)

    email = str(claims.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Your Google account did not share an email address. "
                "Please allow email access and try again."
            ),
        )

    # `email_verified` is load-bearing, not cosmetic. The sign-in flow links a
    # Google identity to an existing local account by email address, so an
    # unverified (self-asserted) address would let anyone who can add someone
    # else's address to a Google account take over that account here.
    if claims.get("email_verified") not in (True, "true"):
        logger.warning("Rejected Google sign-in for %s: email not verified by Google.", email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Google has not verified the email address on that account, "
                "so it cannot be used to sign in."
            ),
        )

    return {
        "sub": subject,
        "email": email,
        "name": str(claims.get("name") or "").strip(),
    }
