#!/bin/bash
ROOT_DIR=$(pwd)

# Export the root .env (DATABASE_URL, DESKTOP_API_PORT, etc.) into this shell so every child
# process below - the Prisma CLI, `next dev`, and the desktop client - inherits it directly,
# rather than relying only on next.config.ts's own dotenv loading (which only reaches Next's
# own process, not the separate `npx prisma` invocation).
set -a
source "$ROOT_DIR/.env"
set +a

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
# Silent mode: npm install is very chatty, so we redirect output to /dev/null
cd "$ROOT_DIR/web-ui" && install_if_missing
cd "$ROOT_DIR/desktop-client" && install_if_missing

# --- Apply the latest Prisma schema to the local cache database ---
cd "$ROOT_DIR/web-ui" && npx prisma migrate deploy > /dev/null 2>&1

# --- Starting Services ---
cd "$ROOT_DIR/desktop-client"
# Redirect output to /dev/null to keep terminal clean
npx ts-node local-api.ts > /dev/null 2>&1 &
DESKTOP_PID=$!

cd "$ROOT_DIR/web-ui"
npm run dev

# Cleanup
kill $DESKTOP_PID 2>/dev/null
