#!/bin/bash

set -u

echo "🚀 ORTHOFLOW FULL SYSTEM STARTER (AUTO-SETUP MODE)"
echo "=================================================="
echo ""

# -------------------------
# Base directory
# -------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -d "$SCRIPT_DIR/Backend" ]; then
    BACKEND_DIR="$SCRIPT_DIR/Backend"
    FRONTEND_DIR="$SCRIPT_DIR/Frontend"
elif [ -d "$SCRIPT_DIR/codes/Backend" ]; then
    BACKEND_DIR="$SCRIPT_DIR/codes/Backend"
    FRONTEND_DIR="$SCRIPT_DIR/codes/Frontend"
else
    echo "❌ Backend folder missing"
    exit 1
fi

# -------------------------
# System checks
# -------------------------
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js not installed"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm not installed"
    exit 1
fi

MYSQL_AVAILABLE=1
if ! command -v mysql >/dev/null 2>&1; then
    echo "⚠️ MySQL CLI not found (using Node database bootstrap instead)"
    MYSQL_AVAILABLE=0
fi

echo "✅ Node: $(node -v)"
echo "✅ npm: $(npm -v)"
echo ""

# -------------------------
# LOAD ENV (SAFE SIMPLE PARSER)
# -------------------------
ENV_FILE="$BACKEND_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Backend .env not found"
    exit 1
fi

read_env_value() {
    local key="$1"
    awk -F= -v key="$key" '
        $0 !~ /^[[:space:]]*#/ && $1 == key {
            sub(/^[^=]*=/, "")
            print
            exit
        }
    ' "$ENV_FILE"
}

DB_NAME="$(read_env_value DB_NAME)"
DB_USER="$(read_env_value DB_USER)"
DB_PASSWORD="$(read_env_value DB_PASSWORD)"
DB_HOST="$(read_env_value DB_HOST)"
DB_PORT="$(read_env_value DB_PORT)"
GOOGLE_CLIENT_ID="$(read_env_value GOOGLE_CLIENT_ID)"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"

if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
    echo "❌ DB_NAME and DB_USER must be set in Backend/.env"
    exit 1
fi

# -------------------------
# Globals
# -------------------------
BACKEND_PID=""
FRONTEND_PID=""
CLEANED_UP=0
INTERRUPTED=0

# -------------------------
# Helpers
# -------------------------
is_port_in_use() {
    lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

wait_for_http() {
    local url="$1"
    local attempts="$2"

    for _ in $(seq 1 "$attempts"); do
        if curl -fsS "$url" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done
    return 1
}

install_if_needed() {
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies..."
        npm install || { echo "❌ npm install failed"; exit 1; }
    else
        echo "✅ Dependencies OK"
    fi
}

mysql_cmd() {
    local args=(-h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER")
    if [ -n "$DB_PASSWORD" ]; then
        args+=("-p$DB_PASSWORD")
    fi
    mysql "${args[@]}" "$@"
}

mysql_value() {
    mysql_cmd -N -B "$@"
}

ensure_frontend_env() {
    local frontend_env="$FRONTEND_DIR/.env"

    if [ ! -f "$frontend_env" ]; then
        echo "⚠️ Frontend .env not found. Creating one..."
        touch "$frontend_env"
    fi

    if ! grep -q '^VITE_GOOGLE_CLIENT_ID=' "$frontend_env"; then
        if [ -n "$GOOGLE_CLIENT_ID" ]; then
            echo "VITE_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" >> "$frontend_env"
            echo "✅ Added VITE_GOOGLE_CLIENT_ID to Frontend/.env"
        else
            echo "⚠️ VITE_GOOGLE_CLIENT_ID missing in Frontend/.env and GOOGLE_CLIENT_ID missing in Backend/.env"
        fi
    fi
}

ensure_admin_account() {
    echo "👤 Checking admin account..."
    (cd "$BACKEND_DIR" && npm run ensure-admin) || {
        if [ "$INTERRUPTED" -eq 1 ]; then
            exit 130
        fi
        echo "❌ Admin account setup failed"
        exit 1
    }
}

bootstrap_database() {
    echo "🗄️ Checking database..."
    (cd "$BACKEND_DIR" && npm run bootstrap-db) || {
        if [ "$INTERRUPTED" -eq 1 ]; then
            exit 130
        fi
        echo "❌ Database setup failed"
        exit 1
    }
}

# -------------------------
# CLEANUP (FIXED)
# -------------------------
cleanup() {
    if [ "$CLEANED_UP" -eq 1 ]; then
        return
    fi
    CLEANED_UP=1
    INTERRUPTED=1

    echo ""
    echo "🛑 Shutting down..."
    echo "Stopping services..."

    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
        pkill -P "$BACKEND_PID" 2>/dev/null || true
    fi

    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
        pkill -P "$FRONTEND_PID" 2>/dev/null || true
    fi

    sleep 1
    echo "✅ Shutdown complete"
}

trap 'cleanup; exit 130' INT TERM
trap cleanup EXIT

# -------------------------
# FRONTEND ENV INIT
# -------------------------
ensure_frontend_env

# -------------------------
# BACKEND SETUP
# -------------------------
echo ""
echo "📍 Backend Setup"

cd "$BACKEND_DIR"

install_if_needed

# -------------------------
# DATABASE INIT
# -------------------------
bootstrap_database
ensure_admin_account

if is_port_in_use 3000; then
    echo "⚠️ Backend already running"
else
    echo "🚀 Starting backend..."
    npm run dev &
    BACKEND_PID=$!
fi

echo ""
echo "⏳ Waiting for backend..."

if ! wait_for_http "http://localhost:3000/health" 25; then
    echo "❌ Backend failed to start"
    exit 1
fi

echo "✅ Backend ready"

# -------------------------
# FRONTEND START
# -------------------------
echo ""
echo "📍 Frontend Setup"

cd "$FRONTEND_DIR"

install_if_needed

if is_port_in_use 5173; then
    echo "⚠️ Frontend already running"
else
    echo "🚀 Starting frontend..."
    npm run dev &
    FRONTEND_PID=$!
fi

echo ""
echo "⏳ Waiting for frontend..."

if ! wait_for_http "http://localhost:5173" 30; then
    echo "❌ Frontend failed"
    exit 1
fi

echo "✅ Frontend ready"

# -------------------------
# OPEN APP
# -------------------------
echo ""
echo "🌐 Opening app..."

if command -v open >/dev/null 2>&1; then
    open "http://localhost:5173"
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:5173"
else
    start "http://localhost:5173"
fi

echo ""
echo "🎉 ORTHOFLOW RUNNING"
echo "--------------------"
echo "📍 Backend:  http://localhost:3000"
echo "📍 Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop everything"
echo ""

# -------------------------
# KEEP ALIVE
# -------------------------
while true; do
    sleep 3600
done
