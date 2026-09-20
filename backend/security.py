"""Security primitives: rate limiting, input caps, and upload validation.

Deliberately dependency-free — everything here uses the standard library plus
what FastAPI/Starlette already pull in, so `pip install` stays untouched.
"""
import re
import threading
import time
from collections import deque
from typing import Deque, Dict, Optional

from fastapi import HTTPException, Request, UploadFile, status

# ---------------------------------------------------------------------------
# Input size limits
#
# Every one of these exists because an uncapped field is a denial-of-service
# primitive: it either exhausts CPU/RAM on this host or inflates the prompt we
# pay Gemini for.
# ---------------------------------------------------------------------------

# bcrypt refuses anything past 72 bytes (it raises ValueError, it does not
# truncate), so this is the algorithm's hard ceiling rather than a policy pick.
MAX_PASSWORD_BYTES = 72
MIN_PASSWORD_CHARS = 8
MAX_NAME_CHARS = 100
MAX_EMAIL_CHARS = 254  # RFC 5321 maximum forward-path length
MAX_TEXT_CHARS = 50_000
MAX_CONCEPT_CHARS = 500
MAX_URL_CHARS = 2048
MAX_HISTORY_MESSAGES = 100
MAX_FIELD_CHARS = 4_000
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
MIN_PLAN_DAYS = 1
MAX_PLAN_DAYS = 90

_UPLOAD_CHUNK = 64 * 1024
_PDF_MAGIC = b"%PDF-"

# Every quantifier here applies to a disjoint character class, so there is no
# ambiguity for the engine to backtrack through — this cannot be turned into a
# ReDoS payload the way a hand-rolled lookahead email regex can.
_EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[A-Za-z]{2,24}$")


def validate_email(email: Optional[str]) -> str:
    """Normalise and validate an email address, or raise HTTP 400."""
    cleaned = (email or "").strip()
    if len(cleaned) > MAX_EMAIL_CHARS or not _EMAIL_RE.match(cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid email address.",
        )
    return cleaned.lower()


def validate_password(password: Optional[str]) -> str:
    """Check a password against bcrypt's real limits, or raise HTTP 400.

    Without the upper bound, a long password reaches bcrypt and blows up with an
    unhandled ValueError (HTTP 500) instead of a usable error message.
    """
    candidate = password or ""
    if len(candidate) < MIN_PASSWORD_CHARS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {MIN_PASSWORD_CHARS} characters long.",
        )
    if len(candidate.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Password must be {MAX_PASSWORD_BYTES} bytes or fewer "
                "(roughly 72 characters). Please choose a shorter one."
            ),
        )
    return candidate


def validate_name(name: Optional[str]) -> str:
    cleaned = (name or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter your name.",
        )
    return cleaned[:MAX_NAME_CHARS]


def enforce_text_limit(content: str, limit: int = MAX_TEXT_CHARS) -> str:
    """Reject oversized study material instead of forwarding it to Gemini."""
    if len(content) > limit:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"That input is too long ({len(content):,} characters). "
                f"Please keep it under {limit:,} characters."
            ),
        )
    return content


async def read_capped_upload(file: UploadFile) -> bytes:
    """Read an upload in chunks with a hard ceiling, then verify it is a PDF.

    Two problems with the obvious `await file.read()`:
      1. It buffers the entire body in memory with no limit.
      2. `file.content_type` is a client-supplied header, so checking it proves
         nothing. Only the magic bytes do.
    """
    buffer = bytearray()
    while True:
        chunk = await file.read(_UPLOAD_CHUNK)
        if not chunk:
            break
        buffer.extend(chunk)
        if len(buffer) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    "That file is too large. The maximum upload size is "
                    f"{MAX_UPLOAD_BYTES // (1024 * 1024)} MB."
                ),
            )

    data = bytes(buffer)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )
    if not data.startswith(_PDF_MAGIC):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported. That file is not a valid PDF.",
        )
    return data


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------


class RateLimiter:
    """Per-client sliding-window limiter, usable as a FastAPI dependency.

    In-memory and per-process, which is the right trade-off for a single-process
    local app. A multi-worker or multi-host deployment needs shared state
    (Redis) instead — see SECURITY.md.
    """

    def __init__(self, max_requests: int, window_seconds: int, scope: str):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.scope = scope
        self._hits: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def _client_key(self, request: Request) -> str:
        # Deliberately ignores X-Forwarded-For: it is attacker-controlled unless
        # a trusted proxy sets it, and honouring it would make the limit
        # bypassable with a single header.
        host = request.client.host if request.client else "unknown"
        return f"{self.scope}:{host}"

    def _sweep(self, now: float) -> None:
        """Drop idle buckets so memory cannot grow without bound."""
        if now - self._last_sweep < self.window_seconds:
            return
        cutoff = now - self.window_seconds
        for key in [k for k, hits in self._hits.items() if not hits or hits[-1] <= cutoff]:
            del self._hits[key]
        self._last_sweep = now

    async def __call__(self, request: Request) -> None:
        key = self._client_key(request)
        now = time.monotonic()
        cutoff = now - self.window_seconds

        with self._lock:
            self._sweep(now)
            hits = self._hits.setdefault(key, deque())
            while hits and hits[0] <= cutoff:
                hits.popleft()

            if len(hits) >= self.max_requests:
                retry_after = max(1, int(hits[0] + self.window_seconds - now) + 1)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        "Too many requests. Please wait "
                        f"{retry_after} second(s) and try again."
                    ),
                    headers={"Retry-After": str(retry_after)},
                )

            hits.append(now)

    def reset(self) -> None:
        """Clear recorded requests (useful for automated test suites)."""
        with self._lock:
            self._hits.clear()



# Shared limiter instances. Failed logins are the tightest bucket because that
# endpoint is the brute-force target; the anonymous AI routes are next because
# they spend real money on every call.
login_limiter = RateLimiter(max_requests=5, window_seconds=15 * 60, scope="login")
signup_limiter = RateLimiter(max_requests=3, window_seconds=60 * 60, scope="signup")
forgot_password_limiter = RateLimiter(max_requests=5, window_seconds=15 * 60, scope="forgot-password")
google_login_limiter = RateLimiter(max_requests=10, window_seconds=15 * 60, scope="google-login")
public_ai_limiter = RateLimiter(max_requests=10, window_seconds=5 * 60, scope="public-ai")
authed_ai_limiter = RateLimiter(max_requests=30, window_seconds=5 * 60, scope="authed-ai")

