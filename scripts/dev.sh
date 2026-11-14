#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=========================================================="
echo " Starting CampusOS Monorepo Development Environment"
echo " Backend:  http://localhost:8000 (Docs: /docs, Health: /health)"
echo " Frontend: http://localhost:3000"
echo "=========================================================="

# Trap SIGINT and SIGTERM to clean up child processes on exit
cleanup() {
    echo ""
    echo "Shutting down dev servers..."
    kill 0
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start backend in background
if [ -f "./backend/venv/bin/python" ]; then
    PYTHON_BIN="./backend/venv/bin/python"
else
    PYTHON_BIN="python3"
fi

$PYTHON_BIN -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend in background
cd frontend
npm run dev &
FRONTEND_PID=$!

# Wait for all background jobs
wait
