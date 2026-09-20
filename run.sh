#!/bin/bash

# AI Study Helper Concurrency Runner
# Spins up both the FastAPI backend and Vite frontend.

# Exit on absolute failures
set -e

# Clear screen (removed to avoid TERM errors)
# clear

echo "============================================="
echo "        STARTING AI STUDY HELPER HUB"
echo "============================================="

# Workspace directory
WORKSPACE_DIR="$(pwd)"

# 1. Setup Backend Environment
echo "👉 [1/3] Checking Backend Setup..."
if [ -d ".venv" ]; then
  echo "✔ Virtual environment found."
  # Activate virtual environment
  source .venv/bin/activate
else
  echo "❌ Virtual environment (.venv) not found. Creating one..."
  python3 -m venv .venv
  source .venv/bin/activate
fi

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r backend/requirements.txt

# 2. Setup Frontend Environment
echo "👉 [2/3] Checking Frontend Setup..."
cd frontend
if [ ! -d "node_modules" ]; then
  echo "✔ node_modules not found. Installing package dependencies..."
  npm install
else
  echo "✔ node_modules already installed."
fi
cd "$WORKSPACE_DIR"

# 3. Concurrently Run Both Servers
echo "👉 [3/3] Launching Core Systems..."

# Trap CTRL+C (SIGINT) and SIGTERM to kill all child processes
trap 'kill 0' EXIT

# Launch Backend
# Bound to 127.0.0.1, not 0.0.0.0: the latter exposes the API (and its Gemini
# key) to every device on the local network.
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
echo "  Core is active! Press CTRL+C to terminate."
echo "============================================="

# Keep script running to capture logs
wait
