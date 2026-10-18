#!/bin/bash

# AI Study Helper Concurrency Runner
# Spins up both the FastAPI backend and Vite frontend.

set -e

echo "============================================="
echo "        STARTING AI STUDY HELPER HUB"
echo "============================================="

# Workspace directory
WORKSPACE_DIR="$(pwd)"

# 1. Setup Backend Environment
echo "👉 [1/3] Checking Backend Setup..."
if [ -d ".venv" ]; then
  echo "✔ Virtual environment found."
  source .venv/bin/activate
else
  echo "❌ Virtual environment (.venv) not found. Creating one..."
  python3 -m venv .venv
  source .venv/bin/activate
  echo "Installing Python dependencies..."
  pip install -r backend/requirements.txt
fi

# Ensure backend/.env exists
if [ ! -f "backend/.env" ]; then
  echo "Generating backend/.env..."
  JWT_SEC=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  cat <<EOF > backend/.env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
JWT_SECRET=${JWT_SEC}
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174
ENABLE_DEMO_USER=true
DEMO_USER_EMAIL=student@example.com
DEMO_USER_PASSWORD=StudyHelperDemo123!
EOF
  echo "✔ backend/.env generated."
else
  echo "✔ backend/.env found."
fi

# 2. Setup Frontend Environment
echo "👉 [2/3] Checking Frontend Setup..."
cd frontend
if [ ! -d "node_modules" ]; then
  echo "✔ node_modules not found. Installing dependencies..."
  npm install
else
  echo "✔ node_modules already installed."
fi
cd "$WORKSPACE_DIR"

# 3. Concurrently Run Both Servers
echo "👉 [3/3] Launching Core Systems..."

# Clean up any leftover processes on port 8000 or 5173
for PORT in 8000 5173; do
  PORT_PID=$(lsof -ti :$PORT 2>/dev/null || true)
  if [ -n "$PORT_PID" ]; then
    echo "Notice: Freeing occupied port $PORT (PID: $PORT_PID)..."
    kill -9 $PORT_PID 2>/dev/null || true
  fi
done

# Trap CTRL+C (SIGINT) and SIGTERM to kill all child processes
trap 'kill 0' EXIT INT TERM

# Launch Backend
echo "🚀 Launching backend on http://localhost:8000..."
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!
cd "$WORKSPACE_DIR"

# Launch Frontend
echo "🚀 Launching frontend on http://localhost:5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd "$WORKSPACE_DIR"

echo "============================================="
echo "  AI Study Helper is ACTIVE!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  Docs API: http://localhost:8000/docs"
echo "  Demo User: student@example.com"
echo "  Demo Pass: StudyHelperDemo123!"
echo "  Press CTRL+C to terminate both servers."
echo "============================================="

# Keep script running to capture logs
wait
