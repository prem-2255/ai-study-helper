# Project Report & Key Changes Summary — AI Study Helper & Simulation Platform

This document serves as an exhaustive report detailing all features, architectural components, security enhancements, and technical changes implemented in the **AI Study Helper & Simulation Platform** project. Use these details to update your academic or technical project report.

---

## 1. Executive Summary

**Project Title:** AI Study Helper & Interactive Learning Simulation Platform  
**Target Audience:** Students, Educators, and Lab Evaluators  
**Primary Goal:** To provide a comprehensive, secure, AI-powered study ecosystem that combines automated learning toolkits (summarization, quiz generation, concept simplification, study planning, YouTube video analysis) with interactive lab simulations and Socratic tutoring.

---

## 2. System Architecture & Technology Stack

### Frontend (User Interface)
- **Framework:** React 18 with Vite
- **Routing:** React Router v6 (Public & Protected routes)
- **Styling:** Tailwind CSS with custom glassmorphism design system & dark mode (`slate-950`)
- **State & Auth:** React Context API (`AuthContext.jsx`) with persistent localStorage Bearer Token handling
- **Icons & UI:** Heroicons / Lucide React

### Backend (API & Processing Engine)
- **Framework:** FastAPI (Python 3.10+)
- **Database ORM:** SQLAlchemy with SQLite (`study_helper.db`)
- **AI Engine:** Google Gemini SDK (`google-generativeai` using `gemini-2.5-flash`)
- **PDF Extraction:** PyMuPDF (`fitz`) for PDF parsing
- **YouTube Processing:** `youtube-transcript-api` (transcript fetching) & `httpx` (oEmbed metadata)
- **Security & Cryptography:** `bcrypt` (password hashing) & `PyJWT` (JSON Web Token auth)

### Infrastructure & Concurrency
- **Unified Startup Script:** `run.sh` — Bash script that concurrently launches backend (`uvicorn` on `127.0.0.1:8000`) and frontend (`vite` on `localhost:5173`) with automated virtual environment (`.venv`) checks.

---

## 3. Comprehensive Feature Modules Implemented

### Module 1: Core AI Study Suite (`/study-tools`)
1. **AI Notes Summarizer (`POST /summarize`)**
   - Extracts content from direct text input or uploaded PDF documents using PyMuPDF.
   - Generates concise executive summaries alongside structured key bullet points.
2. **Interactive Quiz Generator (`POST /generate-quiz`)**
   - Parses study notes/syllabi to generate 5 Multiple Choice Questions (MCQs).
   - Includes 4 distinct options (A, B, C, D), correct answer flags, detailed explanations, interactive UI selection, and instant score reporting.
3. **Concept Simplifier (`POST /explain`)**
   - Translates complex academic/technical topics into accessible explanations.
   - Supplies real-world analogies and key takeaways.
4. **Personalized Study Planner (`POST /generate-plan`)**
   - Accepts syllabus text or PDF and desired duration (1 to 90 days).
   - Generates a day-by-day study schedule with logical topic breakdown and dedicated revision slots.
   - Automatically saves generated plans to the database for signed-in users.

### Module 2: YouTube Video Analyzer (`/youtube-analyzer`)
- **URL Parsing:** Supports standard watch URLs, short links (`youtu.be`), embeds, and YouTube Shorts.
- **Keyless Metadata Retrieval:** Uses YouTube's public oEmbed API via `httpx` to retrieve title, author/channel, and thumbnail without requiring an API key.
- **Asynchronous Transcript Extraction:** Uses `youtube-transcript-api` executed inside a worker thread pool (`run_in_threadpool`) to prevent event-loop blocking.
- **AI Academic Evaluation (`POST /modules/youtube/analyze`):**
  - Evaluates video content for academic value and calculates a **Usefulness Score (0–100)**.
  - Assigns a verdict (`highly_useful`, `partially_useful`, or `not_useful`).
  - Provides a 3–5 sentence video summary, simple topic explanation, 3–6 key takeaways, recommended study actions, and relevant subject tags.

### Module 3: Interactive System Simulation Lab (`/simulation`)
- **Real-Time Lab Scenarios:** Interactive simulations including *Cloud Outage Incident*, *Microservices Architecture Failure*, and *Database Migration Crash*.
- **Dynamic Telemetry Dashboard:** Tracks real-time system metrics:
  - **System Health (%)**
  - **System Load / CPU (%)**
  - **Active Users (% change)**
- **Socratic Decision Engine (`POST /modules/simulation/action`):**
  - Evaluates user choices dynamically using Gemini AI.
  - Updates telemetry metrics, records action history, provides Socratic feedback, and handles win/lose scenario states.

### Module 4: Socratic Logic Builder Module (`/builder`)
- **Visual Block Workspace:** Drag-and-drop / click-to-add logic building interface for problem-solving.
- **Socratic Hint System (`POST /modules/builder/hint`):**
  - Analyzes current block hierarchy against the problem statement.
  - Generates guided, Socratic questions to prompt critical thinking without giving away direct answers.

### Module 5: Socratic AI Tutor Chatbot (`/assistant`)
- **Conversational Learning Assistant (`POST /modules/assistant/chat`):**
  - Integrates strict Socratic prompt rules (prohibits giving direct answers; relies on analogies and guiding questions).
  - Sanitizes and processes multi-turn conversation history safely.

---

## 4. Security Architecture & Vulnerability Remediation

A comprehensive security audit was conducted, and 16 security vulnerabilities were resolved and hardened in `SECURITY.md`:

| Security Control / Vulnerability | Status | Remediation Details |
|---|---|---|
| **1. JWT Secret Key Enforcement** | **Fixed** | Mandatory `JWT_SECRET` environment variable check enforced at startup (minimum 32 characters requirement). Hardcoded fallback removed to prevent token forgery. |
| **2. Backdoor Account Elimination** | **Fixed** | Default creation of `student@example.com` disabled (`ENABLE_DEMO_USER=false`). Demo user creation requires explicit environment opt-in. |
| **3. Rate Limiting (DoS / Brute-Force)** | **Fixed** | Implemented sliding-window `RateLimiter` class: `/auth/login` (5/15 min), `/auth/signup` (3/1 hr), open AI routes (10/5 min), authed AI routes (30/5 min). Returns HTTP 429 with `Retry-After` header. |
| **4. Prompt Injection Containment** | **Fixed** | All untrusted user content (notes, PDFs, transcripts, chat history) is fenced inside `<<<USER_CONTENT>>>` and `<<<END_USER_CONTENT>>>` delimiters with AI system instructions to treat content strictly as data. |
| **5. Non-Blocking Async Architecture** | **Fixed** | Wrapped heavy synchronous CPU tasks (bcrypt password hashing, PyMuPDF parsing, YouTube transcript fetching) in `run_in_threadpool`; converted Gemini calls to `generate_content_async`. |
| **6. Input Bounding & Password Hardening** | **Fixed** | Enforced bcrypt 72-byte password ceiling (returning HTTP 400 instead of 500 crashes); capped study text input at 50,000 characters; capped plan days between 1 and 90. |
| **7. Safe File Upload & PDF Verification** | **Fixed** | Uploads read in 64 KB chunks up to a strict 10 MB ceiling (HTTP 413) and verified against magic header bytes (`%PDF-`). Client-supplied headers ignored. |
| **8. Authenticated & User-Scoped Data Access** | **Fixed** | `GET /plans` requires valid Bearer token authentication and scopes query results strictly to `user_id = current_user.id`. |
| **9. CORS Sanitization** | **Fixed** | Configured `ALLOWED_ORIGINS` whitelist with `allow_credentials=False` to prevent cross-origin credential stealing. |
| **10. Secure Network Binding** | **Fixed** | `run.sh` and `main.py` bind strictly to loopback (`127.0.0.1`) instead of public interface (`0.0.0.0`). |
| **11. Error Information Leakage** | **Fixed** | Global exception handlers catch unhandled errors, log full traces server-side, and return sanitized generic error messages to clients. |
| **12. ReDoS Protection** | **Fixed** | Replaced hand-rolled lookahead regexes with linear email validation patterns (`_EMAIL_RE`). |

---

## 5. Database Schema & Data Models

### Database Schema (`SQLite` / `SQLAlchemy`)

#### `users` Table
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | Primary Key, Indexed | Auto-incremented User ID |
| `name` | String | Non-null | User full name |
| `email` | String | Unique, Indexed | User email address |
| `password_hash` | String | Non-null | Bcrypt-hashed password |
| `created_at` | DateTime | Default `utcnow` | Timestamp of registration |

#### `study_plans` Table
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | Primary Key, Indexed | Auto-incremented Plan ID |
| `user_id` | Integer | Indexed, Nullable | Foreign key referencing `users.id` (NULL for anonymous plans) |
| `syllabus` | Text | Non-null | Truncated input syllabus preview |
| `days` | Integer | Non-null | Duration of plan in days |
| `plan_json` | Text | Non-null | JSON string of complete generated study plan |
| `created_at` | DateTime | Default `utcnow` | Timestamp of creation |

---

## 6. Complete API Endpoint Summary

| HTTP Method | Path | Auth Required | Description |
|---|---|---|---|
| `POST` | `/auth/signup` | No (Rate Limited) | Register a new user account |
| `POST` | `/auth/login` | No (Rate Limited) | Authenticate user and issue JWT Bearer token |
| `GET` | `/auth/me` | Yes (Bearer Token) | Fetch details of currently logged-in user |
| `POST` | `/summarize` | No (Rate Limited) | Summarize text or uploaded PDF notes |
| `POST` | `/generate-quiz` | No (Rate Limited) | Generate 5 MCQs with explanations |
| `POST` | `/explain` | No (Rate Limited) | Simplify complex concept with analogy |
| `POST` | `/generate-plan` | Optional Auth | Generate multi-day study schedule |
| `GET` | `/plans` | Yes (Bearer Token) | Retrieve saved plans for logged-in user |
| `POST` | `/modules/youtube/analyze` | Yes (Bearer Token) | Fetch transcript & evaluate video academic value |
| `POST` | `/modules/simulation/action` | Yes (Bearer Token) | Process user action in lab simulation |
| `POST` | `/modules/builder/hint` | Yes (Bearer Token) | Generate Socratic hint for logic builder |
| `POST` | `/modules/assistant/chat` | Yes (Bearer Token) | Socratic AI chat assistant interaction |

---

## 7. Verification & Automated Test Suite

An automated, zero-cost security verification test suite was created in `backend/verify_security.py`.

- **Execution Command:**
  ```bash
  ./.venv/bin/python backend/verify_security.py
  ```
- **Assertions Verified:**
  1. Forged JWT tokens signed with old secret keys are rejected.
  2. Legacy backdoor account login attempts fail.
  3. Oversized passwords (>72 bytes) return HTTP 400 bad request.
  4. Valid user signup succeeds and issues valid Bearer token.
  5. `GET /plans` blocks unauthenticated callers and scopes data by user ID.
  6. Oversized prompt payloads (>50k chars) are rejected with HTTP 413.
  7. Non-PDF files with spoofed `application/pdf` headers are rejected by magic bytes.
  8. Excessive requests trigger HTTP 429 Rate Limit with `Retry-After` headers.
  9. CORS headers do not echo untrusted origin headers.
  10. Malformed chat history payload is handled gracefully without HTTP 500.

---

## 8. Summary of Project Achievements

1. **Full-Stack Integration:** Built a seamless React + FastAPI web application providing high performance and responsive UX.
2. **Pedagogical AI Design:** Implemented Socratic teaching models across simulation labs, logic builders, and chat assistants to encourage active student reasoning.
3. **Multi-Modal Learning Support:** Combined document parsing (PDFs), video analysis (YouTube transcripts), interactive labs, and quizzes into a unified hub.
4. **Enterprise-Grade Security:** Hardened authentication, rate-limiting, file magic-byte validation, prompt injection defense, and non-blocking asynchronous event loops.
