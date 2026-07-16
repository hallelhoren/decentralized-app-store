#!/bin/bash
ROOT_DIR=$(pwd)

# Export the root .env (DATABASE_URL, DESKTOP_API_PORT, etc.) into this shell
set -a
source "$ROOT_DIR/.env"
set +a

# Usage: ./run.sh         -> dev mode (hot reload)
#        ./run.sh prod    -> production mode (build + start, much faster)
MODE="dev"
if [ "$1" = "prod" ] || [ "$1" = "production" ]; then
    MODE="prod"
fi

# --- Function to install only if node_modules is missing ---
install_if_missing() {
    if [ ! -d "node_modules" ]; then
        npm install --silent --legacy-peer-deps
    fi
}

# --- Make sure Postgres is up before anything tries to talk to it ---
if command -v pg_isready > /dev/null 2>&1 && ! pg_isready -q; then
    echo "Starting PostgreSQL..."
    sudo service postgresql start > /dev/null 2>&1
fi

# --- Install process ---
cd "$ROOT_DIR/web-ui" && install_if_missing
cd "$ROOT_DIR/desktop-client" && install_if_missing

# --- Apply the latest Prisma schema to the local cache database ---
cd "$ROOT_DIR/web-ui" && npx prisma migrate deploy > /dev/null 2>&1

# --- Starting Services ---

# 1. Desktop Client: Reuse an already-running desktop client to avoid port collisions
desktop_client_is_up() {
    curl -s -m 2 "http://localhost:${DESKTOP_API_PORT:-3001}/api/status?appId=__healthcheck__" > /dev/null 2>&1
}

DESKTOP_PID=""
if desktop_client_is_up; then
    echo "Desktop client already running on port ${DESKTOP_API_PORT:-3001} - reusing it."
else
    cd "$ROOT_DIR/desktop-client"
    npx ts-node local-api.ts > /dev/null 2>&1 &
    DESKTOP_PID=$!
fi

# 2. Web UI: Start Next.js with smart caching for production builds
cd "$ROOT_DIR/web-ui"
if [ "$MODE" = "prod" ]; then
    NEEDS_BUILD=1
    if [ -f ".next/BUILD_ID" ]; then
        # Check if core source files have changed since the last build
        CHANGED=$(find src app pages prisma package.json package-lock.json next.config.ts tsconfig.json \
            -newer .next/BUILD_ID 2>/dev/null | head -1)
        if [ -z "$CHANGED" ]; then
            NEEDS_BUILD=0
        fi
    fi

    if [ "$NEEDS_BUILD" -eq 1 ]; then
        echo "Source changed (or no previous build found) - rebuilding..."
        npm run build
    else
        echo "No source changes since the last build - skipping rebuild."
    fi

    echo "Starting in production mode..."
    npm run start
else
    echo "Starting in development mode..."
    npm run dev
fi

# --- Cleanup ---
# Only kill the desktop client if THIS script actually started it.
if [ -n "$DESKTOP_PID" ]; then
    kill "$DESKTOP_PID" 2>/dev/null
fi