# TLS Trainer
**Version:** TLS Trainer Stable Build v1  
**Last Updated:** 2026-05-29

A military training platform for TLS (Transportable Landing System) radar technicians. Trainees register with name + PIN, study modules with embedded PDFs, take quizzes, and track progress. Instructors manage everything from a protected admin panel.

---

## Table of Contents
1. [Quick Start](#quick-start)
2. [Requirements](#requirements)
3. [Project Structure](#project-structure)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Build & Run](#build--run)
7. [Static Assets Setup](#static-assets-setup)
8. [API Routes](#api-routes)
9. [Auth Flow](#auth-flow)
10. [Database Backup & Restore](#database-backup--restore)
11. [Deployment](#deployment)
12. [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# 1. Clone / extract source
cd tls-trainer

# 2. Install dependencies
bun install

# 3. Configure environment
cp .env.example .env
nano .env   # fill in DATABASE_URL, DATABASE_AUTH_TOKEN, ADMIN_PASSWORD

# 4. Extract static assets (PDFs + component images)
unzip tls-trainer-static-v1.zip -d packages/web/
# Creates: packages/web/static/pdfs/  and  packages/web/static/components/

# 5. Build frontend
bun run build:web

# 6. Start server
bash start.sh
# Server runs at http://localhost:3000
```

---

## Requirements

| Tool | Version |
|------|---------|
| Bun  | ≥ 1.1.0 |
| Node | ≥ 20 (Bun handles this) |
| Turso account | https://turso.tech (free tier works) |

---

## Project Structure

```
tls-trainer/
├── packages/
│   └── web/
│       ├── src/
│       │   ├── api/
│       │   │   ├── index.ts          ← All Hono API routes + backup logic
│       │   │   ├── database/
│       │   │   │   ├── schema.ts     ← Drizzle schema (all tables)
│       │   │   │   └── index.ts      ← DB client (Turso or fallback.db)
│       │   │   └── seed.ts           ← Quiz/module seed data
│       │   ├── web/
│       │   │   ├── components/
│       │   │   │   └── NavMenu.tsx   ← Global fixed header (all pages)
│       │   │   └── pages/            ← React page components
│       │   └── server.ts             ← Bun HTTP server (Hono + static files)
│       ├── static/                   ← Large assets (NOT in git, NOT in dist)
│       │   ├── pdfs/                 ← 9 training PDFs (~60MB)
│       │   └── components/           ← Component images (~20MB)
│       ├── public/                   ← Small public assets (Vite copies to dist)
│       ├── dist/                     ← Vite build output (gitignored)
│       └── fallback.db               ← Local SQLite (used only if no .env DB)
├── .env.example                      ← Safe template — copy to .env
├── start.sh                          ← Production start script
├── package.json
└── turbo.json
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values. See `.env.example` for all variables with descriptions.

**Required:**
- `DATABASE_URL` — Turso libsql URL (`libsql://your-db.turso.io`)
- `DATABASE_AUTH_TOKEN` — Turso auth token
- `ADMIN_PASSWORD` — Password for accessing `/admin`

**Optional:**
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` + `TELEGRAM_ENABLED=true` — Push notifications on trainee events
- `S3_*` — File upload storage (Cloudflare R2 or AWS S3)
- `PORT` — Default: `3000`

---

## Database Setup

### Option A — Turso (recommended, production)

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create tls-trainer

# Get connection URL
turso db show tls-trainer --url

# Create auth token
turso db tokens create tls-trainer

# Paste both into .env
DATABASE_URL=libsql://tls-trainer-<org>.turso.io
DATABASE_AUTH_TOKEN=<token>
```

Tables are auto-created on first server start via `ensureTables()` — no migrations needed.

### Option B — Local SQLite (dev/testing only)

Leave `DATABASE_URL` and `DATABASE_AUTH_TOKEN` unset. The server falls back to `packages/web/fallback.db`.

### Restore existing data after setup

See [Database Backup & Restore](#database-backup--restore).

---

## Build & Run

### Development
```bash
# Run server with hot reload
PORT=4200 bun run packages/web/src/server.ts
```

### Production build
```bash
bun run build:web
# Output: packages/web/dist/  (~13MB)
```

### Start production server
```bash
bash start.sh
# Runs: bun install → bun run build:web → bun run packages/web/src/server.ts
```

### With PM2
```bash
pm2 start "bash start.sh" --name tls-trainer
pm2 save
pm2 startup
```

---

## Static Assets Setup

Large files (PDFs, images) live in `packages/web/static/` — **not inside the Vite build**.

The server serves them via a second lookup:
1. First checks `packages/web/dist/` (Vite output)
2. Then checks `packages/web/static/` (large assets)

```bash
# Extract static assets from handoff package
unzip tls-trainer-static-v1.zip -d packages/web/
# Creates:
#   packages/web/static/pdfs/        ← 9 PDFs
#   packages/web/static/components/  ← Component images
#   packages/web/public/             ← Small public assets
```

PDFs are accessed at: `/pdfs/ATC_quick_guide_TLS.pdf` etc.

---

## API Routes

All routes under `/api/`. Admin routes require header: `x-admin-password: <ADMIN_PASSWORD>`

### Public / Trainee
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ping` | Health check |
| GET | `/api/health` | Status check |
| POST | `/api/trainee/register` | Register new trainee (name, rank, unit, pin) |
| POST | `/api/trainee/login` | Login with name + PIN |
| POST | `/api/trainee/logout` | Mark trainee offline |
| GET | `/api/trainee/me/:id` | Get trainee profile |
| GET | `/api/trainee/list` | List all trainees (public names) |
| POST | `/api/activity` | Log activity event |
| POST | `/api/heartbeat` | Update online status + last page |
| POST | `/api/track` | Track page view / module time |
| POST | `/api/quiz/attempt` | Submit quiz attempt |
| GET | `/api/trainee/notifications/:id` | Get alerts for trainee |
| POST | `/api/trainee/notifications/read` | Mark alerts as read |

### Admin (require `x-admin-password` header)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/trainees` | List all trainees with stats |
| GET | `/api/admin/trainee/:id` | Full trainee profile + activity |
| POST | `/api/admin/trainee/:id/status` | Set trainee status (active/muted/blocked) |
| POST | `/api/admin/trainee/:id/note` | Add instructor note |
| POST | `/api/admin/trainee/:id/alert` | Send alert to trainee |
| POST | `/api/admin/trainee/:id/message` | Send private message |
| GET | `/api/admin/trainee/:id/messages` | Get message thread |
| GET | `/api/admin/activity` | Full activity log |
| GET | `/api/admin/online` | Currently online trainees |
| GET | `/api/admin/stats` | Dashboard stats |
| GET | `/api/admin/backup/list` | List saved backups |
| POST | `/api/admin/backup/create` | Create manual backup |
| POST | `/api/admin/backup/restore/:id` | Restore from backup |
| GET | `/api/admin/backup/export/json` | Download full DB as JSON |
| GET | `/api/admin/backup/export/sql` | Download full DB as SQL |
| POST | `/api/admin/backup/import` | Import JSON backup |

---

## Auth Flow

### Trainees
- Register at `/` with: Name, Rank, Unit, PIN (4 digits, optional)
- Login at `/` with: Name + PIN
- Session stored in `localStorage` as `tls_trainee_session` (JSON: `{id, name, rank, unit}`)
- No JWT — server validates identity on each protected call by checking trainee exists in DB
- Blocked/muted trainees are rejected at login

### Admin
- Access `/admin` — prompted for password
- Password checked against `ADMIN_PASSWORD` env var
- Admin session stored in `localStorage` as `tls_admin_auth`
- All admin API calls send `x-admin-password` header

---

## Database Backup & Restore

### Create a manual backup
Admin Panel → Backup tab → "Create Backup"

Or via API:
```bash
curl -X POST http://localhost:3000/api/admin/backup/create \
  -H "x-admin-password: YOUR_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"label":"manual","note":"Pre-deployment snapshot"}'
```

### Export live data (download files)
```bash
# JSON export
curl http://localhost:3000/api/admin/backup/export/json \
  -H "x-admin-password: YOUR_PASSWORD" \
  -o backup.json

# SQL export
curl http://localhost:3000/api/admin/backup/export/sql \
  -H "x-admin-password: YOUR_PASSWORD" \
  -o backup.sql
```

### Restore from JSON file (new server setup)
```bash
curl -X POST http://localhost:3000/api/admin/backup/import \
  -H "x-admin-password: YOUR_PASSWORD" \
  -H "Content-Type: application/json" \
  --data-binary @backup.json
```

Or via Admin Panel → Backup tab → "Import from File" → select `.json`

### Restore from SQL file (SQLite / fallback.db only)
```bash
sqlite3 packages/web/fallback.db < tls-database.sql
```

### Auto-backups
Server automatically creates:
- **Daily backup** — 1 minute after startup, then every 24h
- **Weekly backup** — 2 minutes after startup, then every 7 days
- Old backups are pruned (keeps last 7 daily, 4 weekly)

---

## Deployment

### Required server
- Any Linux server with Bun installed
- Port 3000 open (or set `PORT` env var)
- At least 512MB RAM

### Nginx reverse proxy (recommended)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Large PDF serving — increase timeout
    location /pdfs/ {
        proxy_pass http://localhost:3000;
        proxy_read_timeout 60s;
    }
}
```

Then enable HTTPS with Certbot:
```bash
certbot --nginx -d your-domain.com
```

### Deploy checklist
- [ ] `DATABASE_URL` and `DATABASE_AUTH_TOKEN` set in `.env`
- [ ] `ADMIN_PASSWORD` set to a strong password
- [ ] Static assets extracted to `packages/web/static/`
- [ ] `bun run build:web` completed successfully
- [ ] `bash start.sh` runs without errors
- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] `/pdfs/ATC_quick_guide_TLS.pdf` accessible
- [ ] `/admin` login works

---

## Troubleshooting

**Server won't start — DB connection error**  
→ Check `DATABASE_URL` format: must be `libsql://...` (not `https://`)  
→ Verify `DATABASE_AUTH_TOKEN` is valid (re-create via `turso db tokens create`)

**PDFs return 404**  
→ Static assets not extracted. Run: `unzip tls-trainer-static-v1.zip -d packages/web/`  
→ Confirm `packages/web/static/pdfs/` exists and contains `.pdf` files

**Admin panel shows no trainees**  
→ Data not restored. Use Admin Panel → Backup → Import, upload `tls-database.json`

**Build fails**  
→ Run `bun install` first  
→ Check Bun version: `bun --version` (need ≥ 1.1.0)

**Fonts not loading in production**  
→ Check `WEBSITE_URL` in `.env` matches actual domain (used for CORS)
