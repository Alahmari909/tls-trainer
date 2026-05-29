# TLS Trainer — Stable Build v1

**Transponder Landing System (TLS) Training Platform**
Royal Saudi Air Force — Ground Radar Unit, Jeddah

> Full-stack web application for TLS technician training. Includes interactive modules, quizzes, reference manuals, AI assistant, group chat, and a full admin dashboard.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Folder Structure](#folder-structure)
3. [Environment Variables](#environment-variables)
4. [Database](#database)
5. [Build & Run](#build--run)
6. [API Reference](#api-reference)
7. [Auth Flows](#auth-flows)
8. [Static Assets](#static-assets)
9. [Admin Panel](#admin-panel)
10. [Backup & Restore](#backup--restore)
11. [Telegram Notifications](#telegram-notifications)
12. [Deployment](#deployment)

---

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL, ADMIN_PASSWORD, etc.

# 3. Push database schema (first time only)
cd packages/web && bun run db:push && cd ../..

# 4. Build & start
bash start.sh
```

Server starts on `http://localhost:3000` (or `PORT` env var).

---

## Folder Structure

```
tls-trainer/
├── packages/
│   └── web/
│       ├── src/
│       │   ├── api/
│       │   │   ├── index.ts          # All Hono API routes
│       │   │   ├── telegram.ts       # Telegram notification sender
│       │   │   └── database/
│       │   │       ├── index.ts      # DB connection (Turso/libSQL)
│       │   │       └── schema.ts     # Drizzle ORM schema
│       │   ├── web/
│       │   │   ├── components/
│       │   │   │   ├── NavMenu.tsx   # Global fixed header (zIndex 200)
│       │   │   │   └── ...
│       │   │   └── pages/            # React page components
│       │   └── server.ts             # Bun HTTP server (serves API + static)
│       ├── static/
│       │   ├── pdfs/                 # Reference manuals (PDFs, ~60MB)
│       │   └── components/           # Large component images (~20MB)
│       ├── public/                   # Vite public dir (favicon, small assets)
│       ├── dist/                     # Vite build output (git-ignored)
│       ├── fallback.db               # Local SQLite (used when DATABASE_URL not set)
│       ├── drizzle.config.ts
│       └── vite.config.ts
├── start.sh                          # Production start script
├── .env                              # Local secrets (git-ignored)
├── .env.example                      # Template — copy to .env
└── README.md
```

---

## Environment Variables

See `.env.example` for all variables with descriptions.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes* | Turso libSQL URL (`libsql://...`) |
| `DATABASE_AUTH_TOKEN` | Yes* | Turso auth token |
| `ADMIN_PASSWORD` | **Yes** | Admin panel password |
| `PORT` | No | Server port (default: 3000) |
| `AI_GATEWAY_BASE_URL` | No | AI assistant gateway URL |
| `AI_GATEWAY_API_KEY` | No | AI gateway API key |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot for notifications |
| `TELEGRAM_CHAT_ID` | No | Telegram chat/channel ID |
| `TELEGRAM_ENABLED` | No | Set `true` to activate Telegram |
| `WEBSITE_URL` | No | Public URL (used in links/emails) |

*If `DATABASE_URL` is not set, the server falls back to `packages/web/fallback.db` (local SQLite). **This file is not persisted across Runable deploys** — always configure a Turso DB for production.

---

## Database

### Provider: Turso (libSQL)

1. Create an account at [turso.tech](https://turso.tech)
2. Create a new database
3. Copy the `Database URL` and `Auth Token` to `.env`
4. Run schema migration: `cd packages/web && bun run db:push`

### Schema Overview

Tables managed by Drizzle ORM (`packages/web/src/api/database/schema.ts`):
- `modules` — Training module definitions
- `questions` — Quiz questions per module
- `achievements` — Badge/achievement definitions
- `user_achievements` — Earned badges per user
- `module_progress` — Progress per user per module
- `streaks` — Daily activity streaks + XP
- `users` — Legacy user records (for FK compatibility)
- `sessions` — Auth sessions
- `messages` — Legacy chat messages

Tables managed by raw SQL (`ensureTables()` in `api/index.ts` — auto-created on startup):
- `trainees` — Trainee profiles (name, rank, unit, PIN, status, XP, level)
- `activity_log` — All trainee events
- `quiz_attempts` — Quiz submission records
- `instructor_notes` — Admin notes per trainee
- `trainee_messages` — Direct admin→trainee messages
- `trainee_alerts` — System alerts per trainee
- `trainee_module_progress` — Module completion per trainee
- `trainee_evaluations` — Instructor ratings per trainee
- `module_time_log` — Time spent per module
- `manual_view_log` — PDF manual view history
- `moderation_log` — Ban/suspend/mute actions
- `chat_messages` — Group chat messages
- `chat_attachments` — File uploads (base64 in DB)
- `backups` — In-DB backup snapshots

### Fallback DB

If `DATABASE_URL` is not configured, the server uses `packages/web/fallback.db` (SQLite file). Tables are auto-created via `ensureTables()` on startup. Drizzle ORM tables must be pushed separately.

---

## Build & Run

### Development

```bash
bun run dev
```

Starts Vite dev server + Bun API server with HMR.

### Production Build

```bash
bun run build:web
```

Builds React frontend to `packages/web/dist/`. The Bun server then serves:
1. `/api/*` → Hono API handlers
2. Static files from `packages/web/dist/` (Vite build)
3. Static files from `packages/web/static/` (PDFs, large images — NOT bundled by Vite)

### Start Production Server

```bash
bash start.sh
# or manually:
PORT=3000 bun run packages/web/src/server.ts
```

### Why `static/` is separate from `public/`

Vite copies `public/` into `dist/` at build time. The `static/` folder contains ~80MB of PDFs and large component images — including them in the Vite bundle would make deploys impractical. Instead, `server.ts` serves `static/` directly via a second file lookup after `dist/`.

---

## API Reference

Base path: `/api`

### Trainee Auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/trainee/register` | Register new trainee (`name`, `rank?`, `unit?`, `pin?`) |
| POST | `/api/trainee/login` | Login with `id` + optional `pin` |
| POST | `/api/trainee/logout` | Mark trainee offline |
| POST | `/api/trainee/update` | Update trainee name/rank/unit |
| GET | `/api/trainee/me/:id` | Get own profile |
| GET | `/api/trainee/list` | List all trainees (basic info) |

### Activity & Tracking

| Method | Path | Description |
|---|---|---|
| POST | `/api/activity` | Log a trainee activity event |
| POST | `/api/heartbeat` | Heartbeat (keeps trainee "online", detects blocked status) |
| POST | `/api/track` | General event tracker (site_open, module_open, quiz events, etc.) |

### Quiz

| Method | Path | Description |
|---|---|---|
| POST | `/api/quiz/attempt` | Submit quiz result (new system) |
| POST | `/api/quiz/submit` | Submit quiz + update streaks/achievements (legacy) |
| GET | `/api/quiz-attempts/:userId` | Get all quiz attempts for a trainee |

### Modules & Progress

| Method | Path | Description |
|---|---|---|
| GET | `/api/modules` | List all modules |
| GET | `/api/modules/:id` | Get single module |
| GET | `/api/modules/:id/questions` | Get questions for a module |
| GET | `/api/progress/:userId` | Get module progress for a user |
| POST | `/api/progress` | Update module progress |

### Streaks & Achievements

| Method | Path | Description |
|---|---|---|
| GET | `/api/streaks/:userId` | Get streak + XP data |
| GET | `/api/achievements` | List all achievements |
| GET | `/api/achievements/user/:userId` | Get achievements for a user (earned + unearned) |

### Notifications

| Method | Path | Description |
|---|---|---|
| GET | `/api/trainee/notifications/:id` | Get alerts + admin messages for trainee |
| POST | `/api/trainee/notifications/read` | Mark all notifications read |

### Group Chat

| Method | Path | Description |
|---|---|---|
| GET | `/api/chat/messages?room=&since=&limit=` | Fetch chat messages (with attachments) |
| POST | `/api/chat/send` | Send a chat message (text or with attachment) |
| POST | `/api/chat/delete` | Admin: delete a message |
| POST | `/api/chat/pin` | Admin: pin/unpin a message |
| POST | `/api/chat/important` | Admin: mark message as important |

### AI Assistant

| Method | Path | Description |
|---|---|---|
| POST | `/api/chat/ai` | Send message to TLS AI assistant |

### Admin Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/admin/login` | Admin login (returns token) |
| GET | `/api/admin/trainees` | Full trainee list with stats |
| GET | `/api/admin/trainee/:id` | Full trainee profile + activity |
| POST | `/api/admin/trainee/:id/note` | Add instructor note |
| POST | `/api/admin/trainee/:id/message` | Send direct message to trainee |
| POST | `/api/admin/trainee/:id/alert` | Send alert to trainee |
| POST | `/api/admin/trainee/:id/evaluate` | Set trainee evaluation/rating |
| POST | `/api/admin/trainee/:id/delete` | Delete trainee |
| POST | `/api/admin/trainee/:id/moderate` | Ban / suspend / mute / unban |
| GET | `/api/admin/activity` | All activity logs (recent) |
| GET | `/api/admin/quiz-attempts` | All quiz attempts |
| GET | `/api/admin/stats` | Global stats (online count, attempts, etc.) |
| GET | `/api/admin/online` | Currently online trainees |
| POST | `/api/admin/module-progress` | Assign/update module progress |
| GET | `/api/admin/telegram/config` | Get Telegram config |
| POST | `/api/admin/telegram/config` | Update Telegram config |
| POST | `/api/admin/backup/create` | Create manual backup |
| GET | `/api/admin/backup/list` | List all backups |
| GET | `/api/admin/backup/:id/download` | Download backup as JSON |
| POST | `/api/admin/backup/:id/restore` | Restore from a backup |
| DELETE | `/api/admin/backup/:id` | Delete a backup |
| POST | `/api/admin/backup/import` | Restore from uploaded JSON file |
| GET | `/api/admin/export/source` | Download full project source ZIP |
| GET | `/api/admin/export/migration` | Download full migration package ZIP |

### Utility

| Method | Path | Description |
|---|---|---|
| GET | `/api/ping` | Health check (returns timestamp) |
| GET | `/api/health` | Health check (returns `{status: ok}`) |
| GET | `/api/ensure-user/:userId` | Ensure legacy user record exists |
| GET | `/api/messages` | Get legacy chat messages |
| POST | `/api/messages` | Post legacy chat message |

---

## Auth Flows

### Trainee Auth (No Password System)

1. **First visit**: Trainee enters name, optional rank/unit, optional PIN → `POST /api/trainee/register`
2. Returns `{ id, name, rank, unit }` — client stores in `localStorage` as `tls_trainee_session`
3. **Returning**: Trainee enters their ID + PIN → `POST /api/trainee/login`
4. **Session check**: On app load, reads `tls_trainee_session` from `localStorage`; if present, skips login
5. **Heartbeat**: Client sends `POST /api/heartbeat` every 2 minutes to maintain "online" status
6. **Blocked**: If trainee is blocked, heartbeat returns `{ forceLogout: true }` → client clears session and redirects to login

### Admin Auth

1. Admin navigates to `/admin`
2. Enters `ADMIN_PASSWORD` (from env var) → `POST /api/admin/login`
3. Server returns a session token stored in `localStorage` as `admin_token`
4. All admin endpoints check `Authorization: Bearer <token>` header
5. Default fallback password: `TLS@Admin2025` — **change in production**

---

## Static Assets

Large files are served from `packages/web/static/` (not bundled by Vite):

```
packages/web/static/
├── pdfs/                      # TLS reference manuals (PDFs)
│   ├── ATC_quick_guide_TLS.pdf
│   ├── TLS_SWM.pdf
│   └── ... (9 PDFs total, ~60MB)
└── components/                # Component diagrams / images (~20MB)
    └── *.png / *.jpg
```

**Access**: `/pdfs/filename.pdf`, `/components/image.png`

These files are **not** included in the Vite build. They must be present in the `static/` folder on the server. When deploying, upload them separately or include them in the server's file system before starting.

---

## Admin Panel

Access at `/admin`. Features:

- **Dashboard**: Live trainee count, online users, quiz stats
- **Trainees**: Full list, search, per-trainee detail view
- **Per-trainee**: Activity log, quiz history, module progress, notes, direct messaging, evaluation
- **Moderation**: Ban / suspend / mute / unblock trainees
- **Group Chat**: Monitor + moderate live chat
- **Backup**: Create / restore / download / import database backups
- **Export**: Download full source ZIP or migration package
- **Telegram**: Configure bot notifications live
- **Module Progress**: Assign modules, override progress

---

## Backup & Restore

### In-App Backup (Recommended)

1. Go to `/admin` → Backup tab
2. Click **Create Backup** (manual) — saves snapshot to `backups` table in DB
3. Auto backups run automatically: daily (keeps last 7) + weekly (keeps last 4)
4. **Download**: Click any backup → download as JSON
5. **Restore**: Click restore on any backup (auto-snapshots current state first)
6. **Import**: Upload a previously downloaded JSON file to restore

### From Fallback DB (SQLite)

```bash
# SQL dump
sqlite3 packages/web/fallback.db .dump > backup.sql

# Restore to new SQLite
sqlite3 new.db < backup.sql
```

### Migration to New Server

Use **Admin → Export → Migration Package** — downloads a ZIP containing:
- Full DB dump (JSON + SQL)
- Complete source code
- Instructions

---

## Telegram Notifications

The app can send real-time alerts to a Telegram chat for:
- Trainee login / logout
- Site opens
- Quiz completions
- Chat messages
- Moderation actions
- System warnings

**Setup:**
1. Create a Telegram bot via [@BotFather](https://t.me/botfather), get the token
2. Add bot to your channel/group, get the chat ID
3. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_ENABLED=true` in `.env`
4. Or configure live via Admin Panel → Telegram tab

**Cooldowns** prevent spam:
- Login notifications: 15 min cooldown per trainee
- "Back online" notifications: 10 min cooldown per trainee

---

## Deployment

### Runable Platform (Current)

The app is deployed via the Runable platform. The server runs on port `4200` in production (`PORT=4200`).

Static large files (`static/pdfs/`, `static/components/`) are served directly by the Bun server and are excluded from the Vite build bundle (keeps deploy size ~13MB vs 91MB).

### Manual / VPS Deployment

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install deps
bun install

# Configure
cp .env.example .env
# Fill in DATABASE_URL, DATABASE_AUTH_TOKEN, ADMIN_PASSWORD

# Build
bun run build:web

# Start
PORT=3000 bun run packages/web/src/server.ts
```

For process management with `pm2`:
```bash
npm i -g pm2
pm2 start "bun run packages/web/src/server.ts" --name tls-trainer
pm2 save
```

### Important Notes

- The `static/` folder (~80MB) must be present on the server before starting
- Run `bun run db:push` once after first deploy to create Drizzle-managed tables
- `ensureTables()` in `api/index.ts` auto-creates all other tables on startup
- Never commit `.env` to git — it's in `.gitignore`

---

## Version

**TLS Trainer Stable Build v1**
Tagged: 2026-05-29
Platform: Bun + Hono + React + Drizzle + Turso (libSQL)
