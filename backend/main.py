from fastapi import (
    FastAPI, UploadFile, File, Form, HTTPException, Depends, Request, status,
)
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import re
import json
import logging
import datetime
import secrets
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
from pathlib import Path
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
# pyrefly: ignore [missing-import]
from utils import extract_text_from_upload  # type: ignore[import]
# pyrefly: ignore [missing-import]
from gemini_service import (  # type: ignore[import]
    summarize_notes, generate_quiz, explain_concept, generate_study_plan,
    get_simulation_step, get_builder_hint, get_socratic_chat_response,
    analyze_youtube_video
)
import models, database  # type: ignore[import]
from database import engine, get_db, SessionLocal, run_migrations  # type: ignore[import]
# pyrefly: ignore [missing-import]
import bcrypt
import jwt
from pydantic import BaseModel, Field
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import security  # type: ignore[import]
from security import (  # type: ignore[import]
    MAX_CONCEPT_CHARS, MAX_EMAIL_CHARS, MAX_FIELD_CHARS, MAX_HISTORY_MESSAGES,
    MAX_NAME_CHARS, MAX_PLAN_DAYS, MAX_TEXT_CHARS, MAX_URL_CHARS, MIN_PLAN_DAYS,
    enforce_text_limit, read_capped_upload, validate_email, validate_name,
    validate_password,
)
import google_auth  # type: ignore[import]
import httpx
from youtube_transcript_api import (  # type: ignore[import]
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("study_helper")

# JWT Config
#
# No default here on purpose. A hardcoded fallback secret means anyone who can
# read this file can mint a valid token for any account, which is a complete
# authentication bypass.
JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is not set. Generate one and append it to backend/.env:\n"
        "  python3 -c \"import secrets; print('JWT_SECRET=' + secrets.token_hex(32))\" >> backend/.env"
    )
if len(JWT_SECRET) < 32:
    raise RuntimeError(
        "JWT_SECRET is too short to be safe. Use at least 32 characters "
        "(secrets.token_hex(32) produces 64)."
    )
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_LIFETIME = datetime.timedelta(hours=12)

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
    ).split(",")
    if origin.strip()
]

# Create tables, then apply additive schema patches that create_all cannot make.
models.Base.metadata.create_all(bind=engine)
run_migrations()


def _client_is_loopback(request: Request) -> bool:
    """Return True when the HTTP client is on the same machine as the server.

    Used to restrict demo-only shortcuts (e.g. demo Google token) to local
    development so they can never be triggered from the internet.
    """
    host = request.client.host if request.client else ""
    return host in ("127.0.0.1", "::1", "localhost")


def _maybe_create_demo_user() -> None:
    """Create the demo account only when explicitly opted in.

    This used to run unconditionally with a literal password in the source, i.e.
    a permanent known-credentials backdoor that reappeared on every restart.
    """
    if os.getenv("ENABLE_DEMO_USER", "").strip().lower() not in ("1", "true", "yes"):
        return

    demo_password = os.getenv("DEMO_USER_PASSWORD", "")
    if len(demo_password) < security.MIN_PASSWORD_CHARS:
        logger.warning(
            "ENABLE_DEMO_USER is on but DEMO_USER_PASSWORD is missing or too short; "
            "skipping demo user creation."
        )
        return

    db = SessionLocal()
    try:
        demo_email = os.getenv("DEMO_USER_EMAIL", "student@example.com").lower()
        existing = db.query(models.User).filter(models.User.email == demo_email).first()
        if not existing:
            db.add(models.User(
                name="Demo Student",
                email=demo_email,
                password_hash=hash_password(demo_password),
            ))
            db.commit()
            logger.info("Demo user %s created from environment configuration.", demo_email)
    finally:
        db.close()


app = FastAPI(title="AI Simulation & Learning Platform API")

# Configure CORS
#
# Was allow_origins=["*"] with allow_credentials=True: an invalid pairing that
# browsers reject, and permissive enough for any site to call this API.
# Authentication is a Bearer header, not a cookie, so credentials stay off.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return schema failures as a single readable string, matching our 400s.

    FastAPI's default 422 body is a list of error objects, which the frontend
    renders as "[object Object]".
    """
    errors = exc.errors()
    detail = "Invalid request."
    if errors:
        first = errors[0]
        location = ".".join(str(part) for part in first.get("loc", []) if part != "body")
        message = first.get("msg", detail)
        detail = f"{location}: {message}" if location else message
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Log the real error server-side, return an opaque one to the client."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error."},
    )


# Helpers for Password Hashing
def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    pwd_bytes = password.encode('utf-8')
    hashed_bytes = (hashed_password or "").encode('utf-8')
    try:
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except Exception:
        return False


# bcrypt is CPU-bound and takes ~100-200ms. Calling it directly inside an
# `async def` route blocks the event loop, freezing every other in-flight
# request; the threadpool keeps the loop free.
async def hash_password_async(password: str) -> str:
    return await run_in_threadpool(hash_password, password)


async def verify_password_async(password: str, hashed_password: str) -> bool:
    return await run_in_threadpool(verify_password, password, hashed_password)

# Helpers for JWT
def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None):
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + (expires_delta or ACCESS_TOKEN_LIFETIME)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

security_scheme = HTTPBearer()
optional_security_scheme = HTTPBearer(auto_error=False)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme), db: Session = Depends(get_db)):
    token = credentials.credentials
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token details")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security_scheme),
    db: Session = Depends(get_db),
) -> Optional[models.User]:
    """Resolve the caller if they sent a valid token, else None.

    Lets the open endpoints stay anonymous while still attributing saved work to
    a signed-in user when one is present.
    """
    if not credentials:
        return None
    payload = verify_token(credentials.credentials)
    if not payload:
        return None
    email = payload.get("sub")
    if not email:
        return None
    return db.query(models.User).filter(models.User.email == email).first()

# Pydantic Schemas
#
# The Field caps are an outer sanity guard so a multi-megabyte string is
# rejected before any of our own code touches it. The precise, user-facing
# rules live in security.validate_* and return 400.
class UserSignup(BaseModel):
    name: str = Field(min_length=1, max_length=MAX_NAME_CHARS)
    email: str = Field(min_length=3, max_length=MAX_EMAIL_CHARS)
    password: str = Field(min_length=1, max_length=1_000)

class UserLogin(BaseModel):
    email: str = Field(min_length=3, max_length=MAX_EMAIL_CHARS)
    password: str = Field(min_length=1, max_length=1_000)

class UserGoogleLogin(BaseModel):
    id_token: str = Field(min_length=1, max_length=4096)

class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=MAX_EMAIL_CHARS)

class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1, max_length=100)
    new_password: str = Field(min_length=1, max_length=1_000)

class SimulationActionRequest(BaseModel):
    scenario: str = Field(min_length=1, max_length=MAX_FIELD_CHARS)
    history: List[Any] = Field(default_factory=list, max_length=MAX_HISTORY_MESSAGES)
    action: str = Field(min_length=1, max_length=MAX_FIELD_CHARS)

class BuilderHintRequest(BaseModel):
    problem: str = Field(min_length=1, max_length=MAX_FIELD_CHARS)
    blocks: str = Field("", max_length=MAX_TEXT_CHARS)

class AssistantChatRequest(BaseModel):
    history: List[Dict[str, Any]] = Field(default_factory=list, max_length=MAX_HISTORY_MESSAGES)

class YouTubeAnalyzeRequest(BaseModel):
    url: str = Field(min_length=1, max_length=MAX_URL_CHARS)

# ROOT route
@app.get("/")
async def root():
    return {"message": "AI Study Helper & Simulation Platform API is running"}

# --- AUTH ROUTES ---

@app.post("/auth/signup", dependencies=[Depends(security.signup_limiter)])
async def auth_signup(user_data: UserSignup, db: Session = Depends(get_db)):
    name = validate_name(user_data.name)
    email = validate_email(user_data.email)
    password = validate_password(user_data.password)

    db_user = db.query(models.User).filter(models.User.email == email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = await hash_password_async(password)
    new_user = models.User(name=name, email=email, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": new_user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email
        }
    }

@app.post("/auth/login", dependencies=[Depends(security.login_limiter)])
async def auth_login(login_data: UserLogin, db: Session = Depends(get_db)):
    email = (login_data.email or "").strip().lower()
    db_user = db.query(models.User).filter(models.User.email == email).first()
    if not db_user or not db_user.password_hash or not await verify_password_async(login_data.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": db_user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "name": db_user.name or db_user.email.split('@')[0],
            "email": db_user.email
        }
    }

@app.post("/auth/google", dependencies=[Depends(security.google_login_limiter)])
async def auth_google(
    google_data: UserGoogleLogin,
    request: Request,
    db: Session = Depends(get_db),
):
    """Sign in with a Google ID token issued to this app's OAuth client.

    The token arrives from Google Identity Services in the browser and is only
    trusted after `google_auth.verify_google_id_token` checks its signature,
    audience, issuer, expiry and `email_verified` claim.
    """
    raw_token = google_data.id_token.strip()

    if raw_token.startswith("demo_gtoken_") or raw_token == "demo_token":
        # An offline shortcut with no proof of identity whatsoever, so it is
        # gated on an explicit opt-in *and* a loopback caller. It used to be
        # unconditional: POSTing demo_gtoken_<any-email> returned a valid
        # 12-hour token for that account, i.e. a login bypass for every user.
        if not google_auth.demo_login_enabled():
            logger.warning("Blocked a demo Google token; ENABLE_GOOGLE_DEMO_LOGIN is off.")
            raise HTTPException(
                status_code=400,
                detail="Google sign-in could not be verified. Please try signing in again.",
            )
        if not _client_is_loopback(request):
            raise HTTPException(
                status_code=403,
                detail="Demo sign-in is only available from this machine.",
            )
        google_sub = None
        _, _, remainder = raw_token.partition("demo_gtoken_")
        if "@" in remainder:
            email = remainder.strip().lower()
            name = email.split("@")[0].replace(".", " ").title()
        else:
            email = "google.user@example.com"
            name = "Google Student"
    else:
        # Blocking call (it may fetch Google's signing certificates), so it goes
        # through the threadpool to keep the event loop free.
        claims = await run_in_threadpool(google_auth.verify_google_id_token, raw_token)
        google_sub = claims["sub"]
        email = claims["email"]
        name = claims["name"]

    email = validate_email(email)
    name = validate_name(name or email.split("@")[0])

    # Match on Google's stable subject first, then fall back to email so an
    # existing password account is linked instead of colliding with the unique
    # email constraint. Falling back to email is only safe because verification
    # rejects tokens whose address Google has not verified.
    db_user = None
    if google_sub:
        db_user = db.query(models.User).filter(models.User.google_sub == google_sub).first()
    if not db_user:
        db_user = db.query(models.User).filter(models.User.email == email).first()

    if not db_user:
        db_user = models.User(name=name, email=email, password_hash=None, google_sub=google_sub)
        db.add(db_user)
    else:
        if google_sub and not db_user.google_sub:
            db_user.google_sub = google_sub
        if db_user.email != email:
            # Matched on subject, so this is the same person with a new address
            # on their Google account. Refuse only when a different local account
            # already holds it, which the unique constraint would reject anyway.
            clash = db.query(models.User).filter(
                models.User.email == email,
                models.User.id != db_user.id,
            ).first()
            if clash:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Another account already uses that email address. "
                        "Please sign in with that account instead."
                    ),
                )
            db_user.email = email
        if not db_user.name:
            db_user.name = name

    db.commit()
    db.refresh(db_user)

    token = create_access_token({"sub": db_user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "name": db_user.name or db_user.email.split('@')[0],
            "email": db_user.email
        }
    }

@app.post("/auth/forgot-password", dependencies=[Depends(security.forgot_password_limiter)])
async def auth_forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = validate_email(req.email)
    db_user = db.query(models.User).filter(models.User.email == email).first()

    reset_code = None
    if db_user:
        # Invalidate existing active reset tokens for user
        db.query(models.PasswordResetToken).filter(
            models.PasswordResetToken.user_id == db_user.id,
            models.PasswordResetToken.used == False
        ).update({"used": True})

        # Generate random 6-digit code
        reset_code = f"{secrets.randbelow(1000000):06d}"
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15)

        token_entry = models.PasswordResetToken(
            user_id=db_user.id,
            token=reset_code,
            expires_at=expires_at,
            used=False
        )
        db.add(token_entry)
        db.commit()
        logger.info("Generated password reset code for %s: %s", email, reset_code)

    response_data = {
        "message": "If an account exists for that email, a password reset code has been created."
    }
    if reset_code:
        response_data["reset_code"] = reset_code

    return response_data

@app.post("/auth/reset-password", dependencies=[Depends(security.login_limiter)])
async def auth_reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_str = (req.token or "").strip()
    new_password = validate_password(req.new_password)

    token_entry = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.token == token_str,
        models.PasswordResetToken.used == False
    ).first()

    if not token_entry:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code.")

    if token_entry.expires_at < datetime.datetime.now(datetime.timezone.utc):
        token_entry.used = True
        db.commit()
        raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new code.")

    user = db.query(models.User).filter(models.User.id == token_entry.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    hashed_pwd = await hash_password_async(new_password)
    user.password_hash = hashed_pwd
    token_entry.used = True
    db.commit()

    return {"message": "Password reset successful! You can now log in with your new password."}

@app.get("/auth/me")
async def auth_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name or current_user.email.split('@')[0],
        "email": current_user.email
    }



# --- NEW MODULE ROUTES ---

@app.post("/modules/simulation/action", dependencies=[Depends(security.authed_ai_limiter)])
async def simulation_action(req: SimulationActionRequest, current_user: models.User = Depends(get_current_user)):
    history_str = json.dumps(req.history)
    return await get_simulation_step(req.scenario, history_str, req.action)

@app.post("/modules/builder/hint", dependencies=[Depends(security.authed_ai_limiter)])
async def builder_hint(req: BuilderHintRequest, current_user: models.User = Depends(get_current_user)):
    return await get_builder_hint(req.problem, req.blocks)

@app.post("/modules/assistant/chat", dependencies=[Depends(security.authed_ai_limiter)])
async def assistant_chat(req: AssistantChatRequest, current_user: models.User = Depends(get_current_user)):
    return await get_socratic_chat_response(req.history)

@app.post("/modules/youtube/analyze", dependencies=[Depends(security.authed_ai_limiter)])
async def youtube_analyze(req: YouTubeAnalyzeRequest, current_user: models.User = Depends(get_current_user)):
    # Extract video ID from various YouTube URL formats
    video_id = None
    patterns = [
        r'(?:youtube\.com/watch\?v=)([\w-]{11})',
        r'(?:youtu\.be/)([\w-]{11})',
        r'(?:youtube\.com/embed/)([\w-]{11})',
        r'(?:youtube\.com/shorts/)([\w-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, req.url)
        if match:
            video_id = match.group(1)
            break

    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL. Please provide a valid YouTube video link.")

    # Fetch video metadata via oEmbed (no API key needed)
    video_title = "Unknown Video"
    video_thumbnail = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
    video_author = "Unknown Channel"
    try:
        async with httpx.AsyncClient() as client:
            oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            resp = await client.get(oembed_url, timeout=10)
            if resp.status_code == 200:
                meta = resp.json()
                video_title = meta.get("title", video_title)
                video_author = meta.get("author_name", video_author)
                video_thumbnail = meta.get("thumbnail_url", video_thumbnail)
    except Exception:
        pass  # Fall back to defaults

    # Extract transcript. The library call is synchronous and network-bound, so
    # it runs in a worker thread to keep the event loop responsive.
    try:
        def _fetch_transcript() -> str:
            ytt_api = YouTubeTranscriptApi()
            transcript_data = ytt_api.fetch(video_id)
            return " ".join([entry.text for entry in transcript_data])

        transcript_text = await run_in_threadpool(_fetch_transcript)
    except (TranscriptsDisabled, NoTranscriptFound):
        raise HTTPException(
            status_code=422,
            detail="This video doesn't have captions/subtitles available. Try a video with auto-generated or manual captions."
        )
    except VideoUnavailable:
        raise HTTPException(status_code=404, detail="Video not found or unavailable.")
    except Exception:
        # The underlying error can carry internal detail, so it goes to the log
        # rather than to the client.
        logger.exception("Transcript extraction failed for video %s", video_id)
        raise HTTPException(status_code=502, detail="Could not fetch the transcript for that video. Please try another one.")

    if not transcript_text or len(transcript_text.strip()) < 50:
        raise HTTPException(status_code=422, detail="The transcript is too short to analyze meaningfully.")

    # Analyze with Gemini
    analysis = await analyze_youtube_video(transcript_text, video_title)

    return {
        "video_id": video_id,
        "video_title": video_title,
        "video_author": video_author,
        "video_thumbnail": video_thumbnail,
        "analysis": analysis
    }


# --- ORIGINAL STUDY HELPER ENDPOINTS ---
# These stay open to anonymous callers by design, so they are bounded by
# per-IP rate limits and hard input caps instead of authentication.


async def resolve_study_content(file: Optional[UploadFile], text: Optional[str]) -> str:
    """Turn an upload-or-text request into bounded, validated study material."""
    has_file = file is not None and bool((file.filename or "").strip())
    if not has_file and not text:
        raise HTTPException(status_code=400, detail="Either file or text must be provided")

    if has_file:
        pdf_content = await read_capped_upload(file)
        # PyMuPDF parsing is CPU-bound; off the event loop it goes.
        content = await run_in_threadpool(extract_text_from_upload, pdf_content)
    else:
        content = text or ""

    content = content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Could not extract text from input")
    return enforce_text_limit(content)


@app.post("/summarize", dependencies=[Depends(security.public_ai_limiter)])
async def handle_summarize(
    file: UploadFile = File(None),
    text: Optional[str] = Form(None, max_length=MAX_TEXT_CHARS),
):
    content = await resolve_study_content(file, text)
    return await summarize_notes(content)

@app.post("/generate-quiz", dependencies=[Depends(security.public_ai_limiter)])
async def handle_quiz(
    file: UploadFile = File(None),
    text: Optional[str] = Form(None, max_length=MAX_TEXT_CHARS),
):
    content = await resolve_study_content(file, text)
    return await generate_quiz(content)

@app.post("/explain", dependencies=[Depends(security.public_ai_limiter)])
async def handle_explain(concept: str = Form(..., min_length=1, max_length=MAX_CONCEPT_CHARS)):
    return await explain_concept(concept.strip())

@app.post("/generate-plan", dependencies=[Depends(security.public_ai_limiter)])
async def handle_plan(
    file: UploadFile = File(None),
    text: Optional[str] = Form(None, max_length=MAX_TEXT_CHARS),
    days: int = Form(7, ge=MIN_PLAN_DAYS, le=MAX_PLAN_DAYS),
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    content = await resolve_study_content(file, text)

    result = await generate_study_plan(content, days)

    # Stamped with the owner when the caller is signed in. Anonymous plans get
    # user_id NULL and are therefore readable by nobody through /plans.
    new_plan = models.StudyPlan(
        user_id=current_user.id if current_user else None,
        syllabus=content[:500] + ("..." if len(content) > 500 else ""),
        days=days,
        plan_json=json.dumps(result)
    )
    db.add(new_plan)
    db.commit()

    return result

@app.get("/plans")
async def get_plans(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return only the signed-in user's saved plans.

    This was previously unauthenticated and unfiltered, so a single GET returned
    every syllabus every user had ever submitted.
    """
    plans = (
        db.query(models.StudyPlan)
        .filter(models.StudyPlan.user_id == current_user.id)
        .order_by(models.StudyPlan.created_at.desc())
        .all()
    )
    return [{
        "id": p.id,
        "type": "plan",
        "query": p.syllabus,
        "timestamp": p.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "data": json.loads(p.plan_json)
    } for p in plans]


_maybe_create_demo_user()


if __name__ == "__main__":
    import uvicorn
    # Loopback only: binding 0.0.0.0 exposes this API to every device on the
    # local network. Override deliberately via HOST if you need that.
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8000")))
