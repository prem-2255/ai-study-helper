# Security Architecture & Hardening — AI Study Helper

This document details the security posture and vulnerability remediation implemented in the AI Study Helper codebase.

---

## 1. Vulnerability Assessment & Status Matrix

| Threat Category | Status | Details |
|---|---|---|
| **1. SSTI (Server-Side Template Injection)** | **Not Applicable** | No server-side HTML/template engines or string-interpolated code evaluation used. |
| **2. ReDoS (Regular Expression DoS)** | **Not Applicable** | YouTube URL and email validation regexes are linear with non-overlapping quantifiers. |
| **3. NoSQL Injection** | **Not Applicable** | Uses SQLAlchemy ORM over SQLite with parameterized queries throughout. |
| **4. Hardcoded Secret Key (JWT)** | **Fixed** | Mandatory `JWT_SECRET` environment variable requirement enforced at app startup. |
| **5. Backdoor Demo Account** | **Fixed** | Hardcoded creation disabled. Demo account disabled by default (`ENABLE_DEMO_USER=false`). |
| **6. Secret Key Hygiene** | **Fixed / Action Required** | Root `.gitignore` added for `.env`, `*.db`, `.venv`. **Key rotation required at AI Studio**. |
| **7. Unauthenticated Data Exposure (`GET /plans`)** | **Fixed** | Endpoint now requires valid Bearer token authentication and scopes results by `user_id`. |
| **8. Event-Loop Blocking (Async DoS)** | **Fixed** | Heavy sync tasks (bcrypt, PyMuPDF, transcript API) wrapped in `run_in_threadpool`; Gemini calls converted to `generate_content_async`. |
| **9. Unbounded Input & bcrypt 500** | **Fixed** | Passwords capped at 72 bytes (bcrypt max) returning HTTP 400. Text input capped at 50,000 chars. |
| **10. File Upload Vulnerability & Spoofing** | **Fixed** | Chunked upload read with 10 MB ceiling (HTTP 413) and magic byte (`%PDF-`) verification. |
| **11. Wildcard CORS Configuration** | **Fixed** | Explicit `ALLOWED_ORIGINS` with `allow_credentials=False` configured in `CORSMiddleware`. |
| **12. Unthrottled Endpoints / Brute-Force** | **Fixed** | In-memory sliding-window `RateLimiter` applied to `/auth/login` (5/15 min), `/auth/signup` (3/1 hr), and open AI endpoints (10/5 min). |
| **13. Legacy Auth Surface** | **Fixed** | Unused form-based `/register` and `/login` endpoints removed. |
| **14. Exception Detail Leakage** | **Fixed** | Catch-all error handlers sanitize error responses while logging full stack traces server-side. |
| **15. Prompt Injection Containment** | **Fixed** | Untrusted user content wrapped in `<<<USER_CONTENT>>>` delimiter blocks with instructions to treat strictly as data. |
| **16. Insecure Network Binding** | **Fixed** | `run.sh` and `main.py` bind to loopback (`127.0.0.1`) instead of all network interfaces (`0.0.0.0`). |

---

## 2. Action Items for the User

1. **Rotate your Gemini API key**:
   Generate a new API key at [Google AI Studio](https://aistudio.google.com/apikey) and update `GEMINI_API_KEY` in `backend/.env`.
2. **Restrict File Permissions**:
   ```bash
   chmod 600 backend/.env
   ```
3. **Verify Security Suite**:
   Run the verification test suite at any time:
   ```bash
   ./.venv/bin/python backend/verify_security.py
   ```
