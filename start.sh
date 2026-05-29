#!/bin/bash
set -e

echo "[start] Installing dependencies..."
bun install

echo "[start] Building web app..."
bun run build:web

echo "[start] Killing any process on port ${PORT:-4200}..."
fuser -k ${PORT:-4200}/tcp 2>/dev/null || true
sleep 1

echo "[start] Starting server on port ${PORT:-4200}..."
exec bun run packages/web/src/server.ts
