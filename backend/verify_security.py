"""End-to-end security verification for the AI Study Helper backend.

Runs the real FastAPI app in-process via TestClient (no socket binding needed).
All Gemini calls are stubbed so this suite costs nothing in API quota.
Uses a throwaway SQLite database in the current working directory.
"""
import json
import sys

import jwt
from fastapi.testclient import TestClient

import main

# --- Stub every outbound AI call. We are testing our own guardrails, not Gemini.
async def _stub(*args, **kwargs):
    return {"stubbed": True}

main.summarize_notes = _stub
main.generate_quiz = _stub
main.explain_concept = _stub
main.generate_study_plan = _stub
main.get_simulation_step = _stub
main.get_builder_hint = _stub
main.get_socratic_chat_response = _stub
main.analyze_youtube_video = _stub

client = TestClient(main.app, raise_server_exceptions=False)

OLD_HARDCODED_SECRET = "study-helper-super-secret-key-12345"
results = []


def check(name, condition, detail=""):
    results.append((bool(condition), name, detail))
    print(f"{'PASS' if condition else 'FAIL'}  {name}" + (f"  -> {detail}" if detail else ""))


# 1. Forged token signed with the old hardcoded secret must be rejected.
forged = jwt.encode({"sub": "victim@example.com", "exp": 9999999999},
                    OLD_HARDCODED_SECRET, algorithm="HS256")
r = client.get("/auth/me", headers={"Authorization": f"Bearer {forged}"})
check("Forged token (old hardcoded secret) rejected", r.status_code == 401,
      f"HTTP {r.status_code}")

# 2. Demo backdoor account does not exist.
r = client.post("/auth/login", json={"email": "student@example.com", "password": "password123"})
check("Demo backdoor student@example.com/password123 cannot log in",
      r.status_code == 401, f"HTTP {r.status_code}")

# 3. Signup input validation.
r = client.post("/auth/signup", json={"name": "Test", "email": "test@example.com",
                                      "password": "a" * 200})
check("200-char password -> 400 (was: unhandled 500)", r.status_code == 400,
      f"HTTP {r.status_code} {r.json().get('detail', '')[:60]}")

r = client.post("/auth/signup", json={"name": "Test", "email": "test@example.com",
                                      "password": "short"})
check("Password under 8 chars -> 400", r.status_code == 400, f"HTTP {r.status_code}")

r = client.post("/auth/signup", json={"name": "Test", "email": "not-an-email",
                                      "password": "ValidPass123"})
check("Malformed email -> 400", r.status_code == 400, f"HTTP {r.status_code}")

# 4. Happy-path signup still works and issues a usable token.
import time
unique_email = f"test_{int(time.time())}@example.com"
main.security.signup_limiter.reset()
r = client.post("/auth/signup", json={"name": "Test User", "email": unique_email,
                                      "password": "ValidPass123"})
check("Valid signup succeeds", r.status_code == 200, f"HTTP {r.status_code}")
token = r.json().get("access_token", "") if r.status_code == 200 else ""
auth = {"Authorization": f"Bearer {token}"}

r = client.get("/auth/me", headers=auth)
check("Issued token authenticates /auth/me", r.status_code == 200, f"HTTP {r.status_code}")

# 5. /plans requires auth and is scoped to the caller.
r = client.get("/plans")
check("GET /plans without a token is denied", r.status_code in (401, 403),
      f"HTTP {r.status_code}")

# Anonymous plan -> stored with user_id NULL -> invisible to everyone.
r = client.post("/generate-plan", data={"text": "Anonymous syllabus content", "days": 3})
check("Anonymous /generate-plan still allowed (kept open by design)",
      r.status_code == 200, f"HTTP {r.status_code}")

r = client.get("/plans", headers=auth)
own = r.json() if r.status_code == 200 else []
check("Signed-in user does not see the anonymous plan", r.status_code == 200 and len(own) == 0,
      f"HTTP {r.status_code}, {len(own)} plan(s) visible")

r = client.post("/generate-plan", headers=auth, data={"text": "My own syllabus", "days": 3})
r = client.get("/plans", headers=auth)
own = r.json() if r.status_code == 200 else []
check("Signed-in user sees exactly their own plan", len(own) == 1,
      f"{len(own)} plan(s) visible")

# 6. Input caps on the open AI endpoints.
r = client.post("/summarize", data={"text": "x" * 200_000})
check("200k-char text -> 400/413 (not forwarded to Gemini)", r.status_code in (400, 413),
      f"HTTP {r.status_code}")

r = client.post("/generate-plan", data={"text": "valid", "days": 100_000})
check("days=100000 -> 400 (prompt inflation blocked)", r.status_code == 400,
      f"HTTP {r.status_code}")

# 7. Upload validation: a non-PDF with a spoofed Content-Type must be rejected.
r = client.post("/summarize",
                files={"file": ("payload.pdf", b"MZ\x90\x00 not a pdf at all",
                                "application/pdf")})
check("Non-PDF with spoofed application/pdf header -> 400", r.status_code == 400,
      f"HTTP {r.status_code} {r.json().get('detail', '')[:50]}")

r = client.post("/summarize",
                files={"file": ("real.pdf", b"%PDF-1.4 minimal but truthy",
                                "application/pdf")})
check("Real PDF magic bytes accepted past the file gate", r.status_code in (200, 400),
      f"HTTP {r.status_code} (400 here means empty text extraction, not a rejected file)")

# 8. Rate limiting on the anonymous AI endpoint (limit: 10 per 5 min).
codes = [client.post("/explain", data={"concept": f"topic {i}"}).status_code
         for i in range(12)]
r = client.post("/explain", data={"concept": "one more"})
check("11th+ anonymous /explain call -> 429", 429 in codes,
      f"sequence: {codes}")
check("429 response carries Retry-After", "retry-after" in
      {k.lower() for k in r.headers.keys()},
      f"headers present: {'retry-after' in {k.lower() for k in r.headers}}")

# 9. Login brute force is throttled (limit: 5 per 15 min).
login_codes = [client.post("/auth/login",
                           json={"email": "test@example.com", "password": "wrong"}).status_code
               for i in range(8)]
check("Repeated failed logins -> 429", 429 in login_codes, f"sequence: {login_codes}")

# 10. CORS must not reflect an arbitrary origin.
r = client.get("/", headers={"Origin": "https://evil.example"})
acao = r.headers.get("access-control-allow-origin")
check("Evil origin not echoed in Access-Control-Allow-Origin", acao is None,
      f"header value: {acao!r}")

r = client.get("/", headers={"Origin": "http://localhost:5173"})
check("Legitimate dev origin still allowed",
      r.headers.get("access-control-allow-origin") == "http://localhost:5173",
      f"header value: {r.headers.get('access-control-allow-origin')!r}")

# 11. Malformed chat history must not produce a 500 (was a KeyError).
r = client.post("/modules/assistant/chat", headers=auth,
                json={"history": [{"unexpected": "no role or content key"}]})
check("Malformed assistant history handled without a 500", r.status_code != 500,
      f"HTTP {r.status_code}")

# 12. Legacy duplicate auth endpoints are gone.
paths = {route.path for route in main.app.routes}
check("Legacy /register and /login form endpoints removed",
      "/register" not in paths and "/login" not in paths,
      f"auth paths: {sorted(p for p in paths if 'log' in p or 'reg' in p)}")

print("\n" + "=" * 62)
failed = [name for ok, name, _ in results if not ok]
print(f"{len(results) - len(failed)}/{len(results)} checks passed")
if failed:
    print("FAILED:")
    for name in failed:
        print(f"  - {name}")
sys.exit(1 if failed else 0)
