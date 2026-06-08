#!/bin/bash
# Bolan Agent — Start both ADK backend + frontend
# Usage: ./start.sh
# Press Ctrl+C to stop both servers cleanly.

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

LOGDIR="$DIR/logs"
mkdir -p "$LOGDIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKEND_LOG="$LOGDIR/backend_${TIMESTAMP}.log"
FRONTEND_LOG="$LOGDIR/frontend_${TIMESTAMP}.log"

# Track all child PIDs
PIDS=()

cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  # Try graceful shutdown first (SIGTERM)
  for port in 8000 8080; do
    pids=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pids" ]; then
      echo "   Stopping processes on :$port"
      echo "$pids" | xargs kill -15 2>/dev/null
    fi
  done
  for pid in "${PIDS[@]}"; do
    kill -15 $pid 2>/dev/null
  done
  # Wait briefly for graceful shutdown
  sleep 2
  # Force-kill anything still running
  for port in 8000 8080; do
    pids=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pids" ]; then
      echo "   Force-killing processes on :$port"
      echo "$pids" | xargs kill -9 2>/dev/null
    fi
  done
  for pid in "${PIDS[@]}"; do
    kill -9 $pid 2>/dev/null
  done
  wait 2>/dev/null
  echo "✅ Stopped."
  exit 0
}
trap cleanup EXIT INT TERM

# Kill anything already on our ports
for port in 8000 8080; do
  pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "⚠️  Killing existing process on :$port (PID $pid)"
    kill -9 $pid 2>/dev/null
    sleep 0.5
  fi
done

echo "🚀 Starting ADK API server on :8000..."
.venv/bin/adk api_server --port 8000 -v --allow_origins "http://localhost:8080" app/ > "$BACKEND_LOG" 2>&1 &
PIDS+=($!)

sleep 2

echo "🌐 Starting frontend on :8080..."
python3 frontend/server.py > "$FRONTEND_LOG" 2>&1 &
PIDS+=($!)

echo ""
echo "═══════════════════════════════════════"
echo "  ✅ Open http://localhost:8080"
echo "  Backend API: http://localhost:8000"
echo "  Press Ctrl+C to stop both"
echo ""
echo "  📋 Logs:"
echo "    Backend:  $BACKEND_LOG"
echo "    Frontend: $FRONTEND_LOG"
echo "    Browser:  Open DevTools → Console"
echo "═══════════════════════════════════════"
echo ""

# Tail both logs so you can see output, and wait
tail -f "$BACKEND_LOG" "$FRONTEND_LOG" &
PIDS+=($!)
wait
