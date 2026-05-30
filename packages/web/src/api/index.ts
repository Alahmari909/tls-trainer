import { Hono } from 'hono';
import { cors } from "hono/cors";
import { eq, and, desc } from "drizzle-orm";
import { generateText, createGateway } from "ai";
import { sendTelegram, getTelegramConfig, setTelegramConfig } from "./telegram";
import { db } from "./database";
import * as fflate from 'fflate';
import * as fs from 'fs';
import * as path from 'path';
import {
  modules, questions, achievements, userAchievements,
  moduleProgress, streaks, messages, users, sessions, quizAnswers,
} from "./database/schema";

// ── Raw SQL client (libsql) ───────────────────────────────────────────────────
const client = (db as any).$client as {
  execute(query: string | { sql: string; args: unknown[] }): Promise<{ rows: Record<string, unknown>[]; rowsAffected: number; lastInsertRowid?: unknown }>;
};

async function sql(query: string, args: unknown[] = []): Promise<Record<string, unknown>[]> {
  const r = await client.execute({ sql: query, args });
  return r.rows as Record<string, unknown>[];
}

async function sqlRun(query: string, args: unknown[] = []): Promise<void> {
  await client.execute({ sql: query, args });
}

// ── Ensure new tables exist ───────────────────────────────────────────────────
async function ensureTables() {
  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS trainees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rank TEXT,
      unit TEXT,
      pin TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      last_login_at INTEGER DEFAULT 0,
      login_count INTEGER NOT NULL DEFAULT 0,
      is_online INTEGER NOT NULL DEFAULT 0,
      last_page TEXT DEFAULT '/',
      last_active_at INTEGER DEFAULT 0
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      event TEXT NOT NULL,
      detail TEXT,
      page TEXT,
      ts INTEGER NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      module_id INTEGER NOT NULL,
      module_name TEXT,
      score INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      correct INTEGER NOT NULL DEFAULT 0,
      wrong INTEGER NOT NULL DEFAULT 0,
      pct REAL NOT NULL DEFAULT 0,
      passed INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS instructor_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      note TEXT NOT NULL,
      author_id TEXT NOT NULL DEFAULT 'admin',
      ts INTEGER NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS trainee_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      sender_role TEXT NOT NULL DEFAULT 'admin',
      text TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS trainee_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      message TEXT NOT NULL,
      alert_type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS trainee_module_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      module_id INTEGER NOT NULL,
      module_name TEXT,
      progress REAL NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      assigned_by_admin INTEGER NOT NULL DEFAULT 0,
      last_accessed_at INTEGER NOT NULL DEFAULT 0
    )`);
    // Moderation: add status column if not exists (live data — ALTER only)
    await client.execute(`ALTER TABLE trainees ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`).catch(() => {});

    // ── Evaluation table ──
    await client.execute(`CREATE TABLE IF NOT EXISTS trainee_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL UNIQUE,
      rating TEXT NOT NULL DEFAULT 'pending',
      recommendation TEXT,
      technical_observations TEXT,
      admin_id TEXT NOT NULL DEFAULT 'admin',
      updated_at INTEGER NOT NULL DEFAULT 0
    )`);

    // ── Module time log (time spent per module) ──
    await client.execute(`CREATE TABLE IF NOT EXISTS module_time_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      module_id INTEGER NOT NULL,
      module_name TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL
    )`);

    // ── Manual view log ──
    await client.execute(`CREATE TABLE IF NOT EXISTS manual_view_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      manual_name TEXT NOT NULL,
      file_name TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL
    )`);

    // Add xp/level columns to trainees if missing
    await client.execute(`ALTER TABLE trainees ADD COLUMN xp INTEGER NOT NULL DEFAULT 0`).catch(() => {});
    await client.execute(`ALTER TABLE trainees ADD COLUMN level INTEGER NOT NULL DEFAULT 1`).catch(() => {});
    await client.execute(`CREATE TABLE IF NOT EXISTS moderation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT,
      admin_id TEXT NOT NULL DEFAULT 'admin',
      ts INTEGER NOT NULL
    )`);
    // ── Group chat tables ──
    await client.execute(`CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room TEXT NOT NULL DEFAULT 'general',
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL DEFAULT 'trainee',
      text TEXT,
      attachment_id INTEGER,
      deleted INTEGER NOT NULL DEFAULT 0,
      deleted_by TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      pinned_by TEXT,
      pinned_at INTEGER,
      important INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS chat_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER,
      file_type TEXT NOT NULL DEFAULT 'file',
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL,
      ts INTEGER NOT NULL
    )`);
    // ── Backup table ──
    await client.execute(`CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      table_counts TEXT NOT NULL DEFAULT '{}',
      data TEXT NOT NULL
    )`);
    console.log('[ensureTables] All tables ready');
    // Reset all is_online flags on startup — in-memory heartbeats are the source of truth
    await sqlRun(`UPDATE trainees SET is_online=0`);
    console.log('[startup] Cleared stale is_online flags');
    // Run scheduled auto-backups
    scheduleAutoBackups();
    scheduleOnlineSweep();
  } catch (e) {
    console.error("[ensureTables] error:", e);
  }
}
ensureTables();

// ── Backup Engine ─────────────────────────────────────────────────────────────

// All tables to include in a full backup (excludes the backups table itself)
const BACKUP_TABLES = [
  'trainees', 'activity_log', 'quiz_attempts', 'instructor_notes',
  'trainee_messages', 'trainee_alerts', 'trainee_module_progress',
  'moderation_log', 'chat_messages', 'chat_attachments',
  'modules', 'questions', 'module_progress',
  'users', 'profiles', 'streaks', 'achievements', 'user_achievements',
  'sessions', 'messages',
];

async function dumpAllTables(): Promise<{ dump: Record<string, unknown[]>; counts: Record<string, number>; sizeBytes: number }> {
  const dump: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const table of BACKUP_TABLES) {
    try {
      const rows = await sql(`SELECT * FROM ${table}`);
      dump[table] = rows;
      counts[table] = rows.length;
    } catch {
      dump[table] = [];
      counts[table] = 0;
    }
  }
  const json = JSON.stringify(dump);
  return { dump, counts, sizeBytes: Buffer.byteLength(json, 'utf8') };
}

async function createBackup(label: string, note?: string): Promise<{ id: string; sizeBytes: number; counts: Record<string, number> }> {
  const { dump, counts, sizeBytes } = await dumpAllTables();
  const id = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  await sqlRun(
    `INSERT INTO backups (id, label, note, created_at, size_bytes, table_counts, data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, label, note ?? null, now, sizeBytes, JSON.stringify(counts), JSON.stringify(dump)]
  );
  console.log(`[backup] Created ${label} backup: ${id} (${(sizeBytes / 1024).toFixed(1)} KB)`);
  return { id, sizeBytes, counts };
}

async function pruneOldBackups() {
  // Keep last 7 daily, last 4 weekly, all manual + pre-restore
  for (const label of ['daily', 'weekly']) {
    const limit = label === 'daily' ? 7 : 4;
    const rows = await sql(`SELECT id FROM backups WHERE label=? ORDER BY created_at DESC`, [label]);
    const toDelete = rows.slice(limit);
    for (const r of toDelete) {
      await sqlRun(`DELETE FROM backups WHERE id=?`, [r.id]);
    }
  }
}

async function restoreFromBackup(backupId: string): Promise<{ ok: boolean; error?: string; tablesRestored: number }> {
  const [row] = await sql(`SELECT data, label FROM backups WHERE id=?`, [backupId]);
  if (!row) return { ok: false, error: 'Backup not found', tablesRestored: 0 };

  let dump: Record<string, unknown[]>;
  try { dump = JSON.parse(row.data as string); }
  catch { return { ok: false, error: 'Corrupt backup data', tablesRestored: 0 }; }

  // Create a pre-restore snapshot first
  await createBackup('pre-restore', `Auto-snapshot before restoring backup: ${backupId}`).catch(() => {});

  let tablesRestored = 0;
  for (const table of BACKUP_TABLES) {
    const rows = dump[table];
    if (!Array.isArray(rows)) continue;
    try {
      // Clear table (skip tables with FK constraints carefully)
      await sqlRun(`DELETE FROM ${table}`);
      // Re-insert all rows
      for (const r of rows) {
        const keys = Object.keys(r);
        if (!keys.length) continue;
        const cols = keys.join(', ');
        const placeholders = keys.map(() => '?').join(', ');
        const vals = keys.map(k => r[k]);
        await sqlRun(`INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`, vals);
      }
      tablesRestored++;
    } catch (e: any) {
      console.error(`[restore] Failed table ${table}:`, e?.message);
    }
  }
  // Reset online flags after restore
  await sqlRun(`UPDATE trainees SET is_online=0`).catch(() => {});
  return { ok: true, tablesRestored };
}

// ── Project Source ZIP Export ─────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(process.cwd(), '../..');

// Files/dirs to EXCLUDE from source export
const SOURCE_EXCLUDE = new Set([
  'node_modules', '.git', 'dist', '.turbo', 'dist-electron',
  '.DS_Store', 'bun.lock', '.env', // .env excluded — user must re-configure
]);

function shouldExclude(relativePath: string): boolean {
  const parts = relativePath.split('/');
  return parts.some(p => SOURCE_EXCLUDE.has(p));
}

async function buildProjectZip(): Promise<Uint8Array> {
  const files: fflate.AsyncZippable = {};

  function walkDir(dir: string, base: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (shouldExclude(rel)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(full, rel);
      } else if (entry.isFile()) {
        try {
          const data = fs.readFileSync(full);
          // Skip files > 50MB (e.g. huge PDFs) to keep ZIP sane
          if (data.length < 50 * 1024 * 1024) {
            files[`tls-trainer/${rel}`] = [data, { level: 1 }];
          }
        } catch { /* skip unreadable */ }
      }
    }
  }

  walkDir(PROJECT_ROOT, '');

  // Add .env.template as a reminder (not the actual .env)
  const envTemplate = `# TLS Trainer Environment — fill in your values
NODE_ENV=production
DATABASE_URL=
DATABASE_AUTH_TOKEN=
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
AI_GATEWAY_BASE_URL=
AI_GATEWAY_API_KEY=
BETTER_AUTH_SECRET=
ADMIN_PASSWORD=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_ENABLED=false
WEBSITE_URL=
`;
  files['tls-trainer/.env.example'] = [Buffer.from(envTemplate), { level: 1 }];

  return new Promise((resolve, reject) => {
    fflate.zip(files, { comment: `TLS-Trainer project export — ${new Date().toISOString()}` }, (err, data) => {
      if (err) reject(err); else resolve(data);
    });
  });
}

// ── Migration Package (DB + Source + Manifest) ────────────────────────────────

async function buildMigrationPackage(): Promise<Uint8Array> {
  const files: fflate.AsyncZippable = {};
  const now = new Date().toISOString();

  // 1. Full DB dump as JSON
  const { dump, counts, sizeBytes } = await dumpAllTables();
  const dbDump = JSON.stringify({
    meta: { exported_at: Date.now(), version: 'TLS-Trainer-v1', table_counts: counts, db_size_bytes: sizeBytes },
    data: dump,
  }, null, 2);
  files['migration/database/tls-database.json'] = [Buffer.from(dbDump), { level: 6 }];

  // 2. SQL insert dump
  const sqlLines: string[] = [
    '-- TLS Trainer Database Migration SQL',
    `-- Exported: ${now}`,
    `-- Version: TLS-Trainer-v1`,
    `-- Run against a fresh SQLite/libSQL instance after applying schema migrations`,
    '',
  ];
  for (const [table, rows] of Object.entries(dump)) {
    sqlLines.push(`-- Table: ${table} (${(rows as unknown[]).length} rows)`);
    sqlLines.push(`DELETE FROM "${table}";`);
    for (const row of rows as Record<string, unknown>[]) {
      const keys = Object.keys(row);
      if (!keys.length) continue;
      const cols = keys.map(k => `"${k}"`).join(', ');
      const vals = keys.map(k => {
        const v = row[k];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
      }).join(', ');
      sqlLines.push(`INSERT OR REPLACE INTO "${table}" (${cols}) VALUES (${vals});`);
    }
    sqlLines.push('');
  }
  files['migration/database/tls-database.sql'] = [Buffer.from(sqlLines.join('\n')), { level: 6 }];

  // 3. Chat attachments manifest (base64 files embedded in DB; list them)
  const attachments = dump['chat_attachments'] ?? [];
  const attachManifest = (attachments as Record<string,unknown>[]).map(a => ({
    id: a.id, file_name: a.file_name, mime_type: a.mime_type,
    file_type: a.file_type, size: a.size, ts: a.ts,
    note: 'File data embedded in tls-database.json → chat_attachments.data (base64)',
  }));
  files['migration/files/attachments-manifest.json'] = [Buffer.from(JSON.stringify(attachManifest, null, 2)), { level: 6 }];

  // 4. Source code (same as project zip)
  function walkDir(dir: string, base: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (shouldExclude(rel)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(full, rel);
      } else if (entry.isFile()) {
        try {
          const data = fs.readFileSync(full);
          if (data.length < 50 * 1024 * 1024) {
            files[`migration/source/${rel}`] = [data, { level: 1 }];
          }
        } catch { /* skip */ }
      }
    }
  }
  walkDir(PROJECT_ROOT, '');

  // 5. Migration README
  const readme = `# TLS Trainer Migration Package
Generated: ${now}

## Contents
- \`database/tls-database.json\`  — Full DB dump (all tables, JSON format)
- \`database/tls-database.sql\`   — SQL INSERT statements for all tables
- \`files/attachments-manifest.json\` — List of uploaded files (data in DB)
- \`source/\`                     — Full project source code (no node_modules)

## How to Restore

### Database (Turso / libSQL)
1. Create a new Turso database
2. Apply schema: \`cd packages/web && bun run db:push\`
3. Import data via the Admin Panel → Backup → "Import from File"
   OR run the SQL file against your database

### Source Code
1. \`cd migration/source && bun install\`
2. Copy \`.env.example\` to \`.env\` and fill in your credentials
3. \`bun run dev\`

### Files (Chat Attachments)
All file data is embedded as base64 in \`tls-database.json\` under \`chat_attachments.data\`.
They will be automatically restored when you import the database.

## Version Info
- Project: TLS Trainer
- DB Version: TLS-Trainer-v1
- Tables: ${Object.keys(counts).join(', ')}
- Total rows: ${Object.values(counts).reduce((a, b) => a + b, 0)}
`;
  files['migration/README.md'] = [Buffer.from(readme), { level: 6 }];

  return new Promise((resolve, reject) => {
    fflate.zip(files, { comment: `TLS-Trainer migration package — ${now}` }, (err, data) => {
      if (err) reject(err); else resolve(data);
    });
  });
}

// ── Restore from uploaded file ─────────────────────────────────────────────────

async function restoreFromJSON(jsonData: string): Promise<{ ok: boolean; error?: string; tablesRestored: number }> {
  let bundle: { meta?: unknown; data: Record<string, unknown[]> };
  try {
    bundle = JSON.parse(jsonData);
  } catch {
    return { ok: false, error: 'Invalid JSON', tablesRestored: 0 };
  }

  const dump = bundle.data;
  if (!dump || typeof dump !== 'object') {
    return { ok: false, error: 'Missing data field in backup JSON', tablesRestored: 0 };
  }

  // Auto-snapshot before restore
  await createBackup('pre-restore', `Auto-snapshot before file import restore`).catch(() => {});

  let tablesRestored = 0;
  for (const table of BACKUP_TABLES) {
    const rows = dump[table];
    if (!Array.isArray(rows)) continue;
    try {
      await sqlRun(`DELETE FROM "${table}"`);
      for (const r of rows) {
        const keys = Object.keys(r);
        if (!keys.length) continue;
        const cols = keys.map(k => `"${k}"`).join(', ');
        const placeholders = keys.map(() => '?').join(', ');
        await sqlRun(`INSERT OR REPLACE INTO "${table}" (${cols}) VALUES (${placeholders})`, keys.map(k => r[k]));
      }
      tablesRestored++;
    } catch (e: any) {
      console.error(`[restore-file] Failed table ${table}:`, e?.message);
    }
  }
  await sqlRun(`UPDATE trainees SET is_online=0`).catch(() => {});
  return { ok: true, tablesRestored };
}

// ── Auto-backup scheduler ─────────────────────────────────────────────────────
function scheduleAutoBackups() {
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY  = 24 * ONE_HOUR;
  const ONE_WEEK = 7 * ONE_DAY;

  // Daily backup — run after 1 min delay on startup, then every 24h
  setTimeout(async () => {
    await createBackup('daily', 'Automatic daily backup').catch(e => console.error('[auto-backup] daily failed:', e));
    await pruneOldBackups().catch(() => {});
    setInterval(async () => {
      await createBackup('daily', 'Automatic daily backup').catch(e => console.error('[auto-backup] daily failed:', e));
      await pruneOldBackups().catch(() => {});
    }, ONE_DAY);
  }, 60_000);

  // Weekly backup — run after 2 min delay, then every 7 days
  setTimeout(async () => {
    await createBackup('weekly', 'Automatic weekly backup').catch(e => console.error('[auto-backup] weekly failed:', e));
    setInterval(async () => {
      await createBackup('weekly', 'Automatic weekly backup').catch(e => console.error('[auto-backup] weekly failed:', e));
    }, ONE_WEEK);
  }, 120_000);

  console.log('[backup] Auto-backup scheduler started');
}

// ── Ghost-user sweep ──────────────────────────────────────────────────────────
// Every 2 minutes, remove stale heartbeats and clear is_online in DB.
// Prevents ghost "online" users after crash/disconnect/reload without logout.
function scheduleOnlineSweep() {
  setInterval(async () => {
    const now = Date.now();
    const staleIds: string[] = [];
    for (const [id, ts] of onlineHeartbeats.entries()) {
      if (now - ts > ONLINE_THRESHOLD_MS) {
        onlineHeartbeats.delete(id);
        staleIds.push(id);
      }
    }
    if (staleIds.length) {
      for (const id of staleIds) {
        await sqlRun(`UPDATE trainees SET is_online=0 WHERE id=?`, [id]).catch(() => {});
      }
      console.log(`[online-sweep] Cleared ${staleIds.length} stale user(s): ${staleIds.join(', ')}`);
    }
  }, 2 * 60 * 1000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

async function logActivity(traineeId: string, event: string, detail?: object, page?: string) {
  try {
    await sqlRun(
      `INSERT INTO activity_log (trainee_id, event, detail, page, ts) VALUES (?, ?, ?, ?, ?)`,
      [traineeId, event, detail ? JSON.stringify(detail) : null, page ?? null, Date.now()]
    );
    await sqlRun(`UPDATE trainees SET last_active_at=?, last_page=? WHERE id=?`,
      [Date.now(), page ?? null, traineeId]);
  } catch { /* non-fatal */ }
}

// ── In-memory online tracker ──────────────────────────────────────────────────
// Source of truth for "is this user currently active in this server process"
const onlineHeartbeats = new Map<string, number>();

// How long without a heartbeat before we consider someone offline
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;  // 5 minutes

// ── Telegram cooldown ─────────────────────────────────────────────────────────
// Prevents re-sending login/online alerts within the cooldown window.
// This is the PRIMARY guard against spam — covers app-switch, refresh, reconnect.
const telegramCooldowns = new Map<string, number>();
const TELEGRAM_LOGIN_COOLDOWN_MS  = 15 * 60 * 1000; // 15 min — real login
const TELEGRAM_ONLINE_COOLDOWN_MS = 10 * 60 * 1000; // 10 min — came back online

function canSendTelegram(userId: string, eventType: string): boolean {
  if (userId === "unknown") return true;
  const key = `${userId}:${eventType}`;
  const last = telegramCooldowns.get(key);
  const threshold = eventType === "status_change_online"
    ? TELEGRAM_ONLINE_COOLDOWN_MS
    : TELEGRAM_LOGIN_COOLDOWN_MS;
  return last === undefined || Date.now() - last > threshold;
}

function markTelegramSent(userId: string, ...eventTypes: string[]) {
  const now = Date.now();
  for (const t of eventTypes) {
    telegramCooldowns.set(`${userId}:${t}`, now);
  }
}

function isOnline(id: string): boolean {
  const last = onlineHeartbeats.get(id);
  return last !== undefined && Date.now() - last < ONLINE_THRESHOLD_MS;
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "TLS@Admin2025";

// ── App ───────────────────────────────────────────────────────────────────────
const app = new Hono()
  .basePath('api')
  .use(cors({ origin: (origin) => origin ?? "*", credentials: true, exposeHeaders: ["set-auth-token"] }))
  .get('/ping', (c) => c.json({ message: `Pong! ${Date.now()}` }, 200))
  .get('/health', (c) => c.json({ status: 'ok' }, 200))

  // ══════════════════════════════════════════════════════════════════════════
  // TRAINEE AUTH
  // ══════════════════════════════════════════════════════════════════════════

  // POST /trainee/register
  .post('/trainee/register', async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      name?: string; rank?: string; unit?: string; pin?: string;
    };
    if (!body.name?.trim()) return c.json({ error: 'Name required' }, 400);

    const id = uuid();
    const now = Date.now();
    await sqlRun(
      `INSERT INTO trainees (id, name, rank, unit, pin, created_at, last_login_at, login_count, is_online, last_page, last_active_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, '/', ?)`,
      [id, body.name.trim(), body.rank ?? null, body.unit ?? null, body.pin ?? null, now, now, now]
    );
    onlineHeartbeats.set(id, now);
    await logActivity(id, 'register', { name: body.name });
    // Register always fires Telegram (first-time only by definition)
    markTelegramSent(id, "login");
    sendTelegram({ type: "login", traineeId: id, traineeName: body.name.trim() });

    // Also ensure legacy user exists so progress/streaks FKs work
    await db.insert(users).values({
      id, name: body.name.trim(),
      email: `${id}@tls-trainer.local`,
      role: "student", createdAt: now,
    }).catch(() => {});

    return c.json({ ok: true, id, name: body.name.trim(), rank: body.rank ?? null, unit: body.unit ?? null }, 200);
  })

  // POST /trainee/login
  .post('/trainee/login', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { id?: string; pin?: string };
    if (!body.id) return c.json({ error: 'id required' }, 400);

    const rows = await sql(
      `SELECT id, name, rank, unit, pin, login_count, status FROM trainees WHERE id=?`, [body.id]
    );
    if (!rows.length) return c.json({ error: 'Trainee not found' }, 404);
    const t = rows[0] as { id: string; name: string; rank: string | null; unit: string | null; pin: string | null; login_count: number; status: string | null };

    // Block gate — blocked trainees cannot log in
    if (t.status === 'blocked') return c.json({ error: 'blocked', message: 'Your account has been blocked. Contact your instructor.' }, 403);

    // PIN check only if PIN was set
    if (t.pin && body.pin !== t.pin) return c.json({ error: 'Wrong PIN' }, 401);

    const now = Date.now();
    await sqlRun(
      `UPDATE trainees SET last_login_at=?, login_count=login_count+1, is_online=1, last_active_at=? WHERE id=?`,
      [now, now, body.id]
    );
    onlineHeartbeats.set(body.id, now);
    await logActivity(body.id, 'login');
    if (canSendTelegram(body.id, "login")) {
      markTelegramSent(body.id, "login");
      markTelegramSent(body.id, "site_open"); // reset site_open cooldown too on real login
      markTelegramSent(body.id, "status_change_online");
      sendTelegram({ type: "login", traineeId: body.id, traineeName: t.name });
    }

    return c.json({ ok: true, id: t.id, name: t.name, rank: t.rank, unit: t.unit }, 200);
  })

  // POST /trainee/update — trainee updates their own display name/rank/unit
  .post('/trainee/update', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { id?: string; name?: string; rank?: string; unit?: string };
    if (!body.id) return c.json({ error: 'id required' }, 400);
    const rows = await sql(`SELECT id FROM trainees WHERE id=?`, [body.id]);
    if (!rows.length) return c.json({ error: 'Not found' }, 404);
    const name = body.name?.trim() || undefined;
    const rank = body.rank?.trim() ?? null;
    const unit = body.unit?.trim() ?? null;
    if (name) {
      await sqlRun(`UPDATE trainees SET name=?, rank=?, unit=? WHERE id=?`, [name, rank, unit, body.id]);
    } else {
      await sqlRun(`UPDATE trainees SET rank=?, unit=? WHERE id=?`, [rank, unit, body.id]);
    }
    return c.json({ ok: true }, 200);
  })

  // POST /trainee/logout
  .post('/trainee/logout', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { id?: string };
    if (!body.id) return c.json({ error: 'id required' }, 400);

    await sqlRun(`UPDATE trainees SET is_online=0 WHERE id=?`, [body.id]);
    onlineHeartbeats.delete(body.id);
    await logActivity(body.id, 'logout');

    const rows = await sql(`SELECT name FROM trainees WHERE id=?`, [body.id]);
    const name = (rows[0]?.name as string) ?? body.id;
    sendTelegram({ type: "logout", traineeId: body.id, traineeName: name });

    return c.json({ ok: true }, 200);
  })

  // GET /trainee/me/:id
  .get('/trainee/me/:id', async (c) => {
    const id = c.req.param('id');
    const rows = await sql(
      `SELECT id, name, rank, unit, login_count, last_login_at, is_online, last_page, last_active_at, created_at, status FROM trainees WHERE id=?`, [id]
    );
    if (!rows.length) return c.json({ error: 'Not found' }, 404);
    return c.json(rows[0], 200);
  })

  // GET /trainee/list
  .get('/trainee/list', async (c) => {
    const rows = await sql(
      `SELECT id, name, rank, unit, created_at FROM trainees ORDER BY created_at DESC`
    );
    return c.json(rows, 200);
  })

  // ══════════════════════════════════════════════════════════════════════════
  // ACTIVITY & TRACKING
  // ══════════════════════════════════════════════════════════════════════════

  // POST /activity
  .post('/activity', async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      traineeId?: string; event?: string; detail?: object; page?: string;
    };
    if (!body.traineeId || !body.event) return c.json({ error: 'traineeId + event required' }, 400);
    await logActivity(body.traineeId, body.event, body.detail, body.page);
    return c.json({ ok: true }, 200);
  })

  // POST /heartbeat
  // Only updates last_active_at. Never triggers new login/online notifications
  // unless the trainee was truly absent for longer than ONLINE_THRESHOLD_MS.
  // Uses DB last_active_at as fallback when server restarted (in-memory map lost).
  .post('/heartbeat', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const userId = body.userId as string | undefined;
    const page = body.page as string | undefined;
    if (!userId) return c.json({ error: 'userId required' }, 400);

    const now = Date.now();
    const memOnline = isOnline(userId); // in-memory check

    // If not in memory, check DB last_active_at — covers server restarts
    let dbLastActive = 0;
    if (!memOnline) {
      const rows = await sql(`SELECT last_active_at FROM trainees WHERE id=?`, [userId]).catch(() => []);
      dbLastActive = (rows[0]?.last_active_at as number) ?? 0;
    }

    // Consider "was online" if either memory or DB shows activity within threshold
    const wasOnline = memOnline || (dbLastActive > 0 && now - dbLastActive < ONLINE_THRESHOLD_MS);

    // Always update the heartbeat map and DB
    onlineHeartbeats.set(userId, now);
    await sqlRun(
      `UPDATE trainees SET is_online=1, last_active_at=?, last_page=? WHERE id=?`,
      [now, page ?? null, userId]
    ).catch(() => {});

    // Fetch current status for force-logout enforcement
    const statusRow = await sql(`SELECT name, status FROM trainees WHERE id=?`, [userId]).catch(() => []);
    const currentStatus = (statusRow[0]?.status as string) ?? 'active';
    const traineeName = (statusRow[0]?.name as string) ?? userId;

    // Force-logout if blocked
    if (currentStatus === 'blocked') {
      // Mark offline immediately
      await sqlRun(`UPDATE trainees SET is_online=0 WHERE id=?`, [userId]).catch(() => {});
      onlineHeartbeats.delete(userId);
      return c.json({ ok: false, forceLogout: true, reason: 'blocked', message: 'Your account has been blocked. Contact your instructor.' }, 200);
    }

    // Only send "came back online" Telegram if:
    // 1. Was truly offline (no activity for >ONLINE_THRESHOLD_MS)
    // 2. Cooldown has passed (prevents spam)
    if (!wasOnline && canSendTelegram(userId, "status_change_online")) {
      markTelegramSent(userId, "status_change_online", "site_open");
      sendTelegram({ type: "status_change", traineeId: userId, traineeName, status: "online" });
    }
    return c.json({ ok: true, status: currentStatus }, 200);
  })

  // POST /track
  .post('/track', async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      type: string; userId?: string; traineeName?: string;
      moduleName?: string; score?: number; total?: number; preview?: string; page?: string;
    };
    const { type, userId = "unknown", traineeName = "Unknown",
      moduleName = "", score = 0, total = 0, preview = "", page = "" } = body;

    if (userId !== "unknown") {
      await logActivity(userId, type, { moduleName, score, total, preview }, page).catch(() => {});
    }

    switch (type) {
      case "site_open":
        if (canSendTelegram(userId, "site_open")) {
          markTelegramSent(userId, "site_open");
          sendTelegram({ type: "site_open", traineeId: userId, traineeName });
        }
        break;
      case "login":
        if (canSendTelegram(userId, "login")) {
          markTelegramSent(userId, "login");
          markTelegramSent(userId, "site_open");
          markTelegramSent(userId, "status_change_online");
          sendTelegram({ type: "login", traineeId: userId, traineeName });
        }
        break;
      case "logout":           sendTelegram({ type: "logout", traineeId: userId, traineeName }); break;
      case "inactive":         sendTelegram({ type: "inactive", traineeId: userId, traineeName }); break;
      case "module_open":      sendTelegram({ type: "module_open", traineeId: userId, traineeName, moduleName }); break;
      case "quiz_start":       sendTelegram({ type: "quiz_start", traineeId: userId, traineeName, moduleName }); break;
      case "quiz_finish":      sendTelegram({ type: "quiz_finish", traineeId: userId, traineeName, moduleName, score, total }); break;
      case "module_complete":  sendTelegram({ type: "module_complete", traineeId: userId, traineeName, moduleName }); break;
      case "chat_message":     sendTelegram({ type: "chat_message", traineeId: userId, traineeName, preview }); break;
      case "status_change_offline":
        await sqlRun(`UPDATE trainees SET is_online=0 WHERE id=?`, [userId]).catch(() => {});
        onlineHeartbeats.delete(userId);
        sendTelegram({ type: "status_change", traineeId: userId, traineeName, status: "offline" }); break;
      case "manual_view":      sendTelegram({ type: "module_open", traineeId: userId, traineeName, moduleName: `[MANUAL] ${moduleName}` }); break;
      case "system_warning":   sendTelegram({ type: "system_warning", message: preview }); break;
    }
    return c.json({ ok: true }, 200);
  })

  // ══════════════════════════════════════════════════════════════════════════
  // QUIZ ATTEMPTS
  // ══════════════════════════════════════════════════════════════════════════

  .post('/quiz/attempt', async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      traineeId?: string; moduleId?: number; moduleName?: string;
      score?: number; total?: number;
    };
    if (!body.traineeId || body.moduleId == null) return c.json({ error: 'traineeId+moduleId required' }, 400);
    const { traineeId, moduleId, moduleName = "", score = 0, total = 0 } = body;
    // Suspension gate
    const [statusRow] = await sql(`SELECT status FROM trainees WHERE id=?`, [traineeId]).catch(() => []);
    if (statusRow?.status === 'suspended') return c.json({ error: 'suspended', message: 'Your account is suspended. Quiz submissions are disabled.' }, 403);
    const correct = score;
    const wrong = total - score;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = pct >= 70 ? 1 : 0;
    const now = Date.now();

    await sqlRun(
      `INSERT INTO quiz_attempts (trainee_id, module_id, module_name, score, total, correct, wrong, pct, passed, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [traineeId, moduleId, moduleName, score, total, correct, wrong, pct, passed, now]
    );

    // Get the inserted attempt ID
    const [lastAttempt] = await sql(`SELECT id FROM quiz_attempts WHERE trainee_id=? AND module_id=? AND ts=?`, [traineeId, moduleId, now]);
    const attemptId = (lastAttempt as any)?.id ?? null;

    const existing = await sql(
      `SELECT id, progress, completed FROM trainee_module_progress WHERE trainee_id=? AND module_id=?`,
      [traineeId, moduleId]
    );
    if (existing.length > 0) {
      const row = existing[0] as { id: number; progress: number; completed: number };
      const newPct = Math.max(row.progress, pct);
      const newCompleted = row.completed === 1 || passed === 1 ? 1 : 0;
      await sqlRun(
        `UPDATE trainee_module_progress SET progress=?, completed=?, last_accessed_at=? WHERE id=?`,
        [newPct, newCompleted, now, row.id]
      );
    } else {
      await sqlRun(
        `INSERT INTO trainee_module_progress (trainee_id, module_id, module_name, progress, completed, last_accessed_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [traineeId, moduleId, moduleName, pct, passed, now]
      );
    }

    await logActivity(traineeId, 'quiz_finish', { moduleId, moduleName, score, total, pct, passed });
    return c.json({ ok: true, pct, passed: passed === 1, attemptId }, 200);
  })

  // ══════════════════════════════════════════════════════════════════════════
  // TRAINEE NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════════════════

  .get('/trainee/notifications/:id', async (c) => {
    const id = c.req.param('id');
    const alerts = await sql(
      `SELECT id, message, alert_type, read, ts FROM trainee_alerts WHERE trainee_id=? ORDER BY ts DESC LIMIT 20`, [id]
    );
    const msgs = await sql(
      `SELECT id, sender_role, text, read, ts FROM trainee_messages WHERE trainee_id=? AND sender_role='admin' ORDER BY ts DESC LIMIT 20`, [id]
    );
    return c.json({ alerts, messages: msgs }, 200);
  })

  .post('/trainee/notifications/read', async (c) => {
    const { traineeId } = await c.req.json().catch(() => ({})) as { traineeId?: string };
    if (!traineeId) return c.json({ error: 'traineeId required' }, 400);
    await sqlRun(`UPDATE trainee_alerts SET read=1 WHERE trainee_id=?`, [traineeId]);
    await sqlRun(`UPDATE trainee_messages SET read=1 WHERE trainee_id=? AND sender_role='admin'`, [traineeId]);
    return c.json({ ok: true }, 200);
  })

  // GET /trainee/messages/:id — full conversation thread for the trainee
  .get('/trainee/messages/:id', async (c) => {
    const id = c.req.param('id');
    const rows = await sql(
      `SELECT id, sender_role, text, read, ts FROM trainee_messages WHERE trainee_id=? ORDER BY ts ASC LIMIT 100`, [id]
    );
    return c.json(rows, 200);
  })

  // POST /trainee/message — trainee sends a message to admin
  .post('/trainee/message', async (c) => {
    const { traineeId, text } = await c.req.json().catch(() => ({})) as { traineeId?: string; text?: string };
    if (!traineeId || !text?.trim()) return c.json({ error: 'traineeId + text required' }, 400);
    await sqlRun(
      `INSERT INTO trainee_messages (trainee_id, sender_role, text, read, ts) VALUES (?, 'trainee', ?, 0, ?)`,
      [traineeId, text.trim(), Date.now()]
    );
    const [tr] = await sql(`SELECT name FROM trainees WHERE id=?`, [traineeId]);
    const tName = (tr?.name as string) ?? traineeId;
    sendTelegram({ type: 'chat_message', traineeId, traineeName: tName, preview: text.trim().slice(0, 80) });
    return c.json({ ok: true }, 200);
  })

  // ══════════════════════════════════════════════════════════════════════════
  // LEGACY ENDPOINTS
  // ══════════════════════════════════════════════════════════════════════════

  .get('/modules', async (c) => {
    const rows = await db.select().from(modules).orderBy(modules.order);
    return c.json(rows, 200);
  })
  .get('/modules/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const [mod] = await db.select().from(modules).where(eq(modules.id, id));
    if (!mod) return c.json({ error: 'Not found' }, 404);
    return c.json(mod, 200);
  })
  .get('/modules/:id/questions', async (c) => {
    const moduleId = Number(c.req.param('id'));
    const rows = await db.select().from(questions)
      .where(eq(questions.moduleId, moduleId))
      .orderBy(questions.order);
    return c.json(rows, 200);
  })
  .get('/achievements', async (c) => {
    const rows = await db.select().from(achievements);
    return c.json(rows, 200);
  })
  .get('/achievements/user/:userId', async (c) => {
    const userId = c.req.param('userId');
    const allBadges = await db.select().from(achievements);
    const earned = await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
    const earnedIds = new Set(earned.map(e => e.achievementId));
    const result = allBadges.map(b => ({
      ...b, earned: earnedIds.has(b.id),
      earnedAt: earned.find(e => e.achievementId === b.id)?.earnedAt ?? null,
    }));
    return c.json(result, 200);
  })
  .get('/progress/:userId', async (c) => {
    const userId = c.req.param('userId');
    const rows = await db.select().from(moduleProgress).where(eq(moduleProgress.userId, userId));
    return c.json(rows, 200);
  })
  .post('/progress', async (c) => {
    const body = await c.req.json();
    const { userId, moduleId, progress, completed } = body;
    const now = Date.now();
    const existing = await db.select().from(moduleProgress)
      .where(and(eq(moduleProgress.userId, userId), eq(moduleProgress.moduleId, moduleId)));
    if (existing.length > 0) {
      await db.update(moduleProgress)
        .set({ progress, completed: completed ? 1 : 0, lastAccessedAt: now })
        .where(and(eq(moduleProgress.userId, userId), eq(moduleProgress.moduleId, moduleId)));
    } else {
      await db.insert(moduleProgress).values({ userId, moduleId, progress, completed: completed ? 1 : 0, lastAccessedAt: now });
    }
    return c.json({ ok: true }, 200);
  })
  .get('/ensure-user/:userId', async (c) => {
    const userId = c.req.param('userId');
    const existing = await db.select().from(users).where(eq(users.id, userId));
    if (existing.length === 0) {
      await db.insert(users).values({
        id: userId, name: "Trainee",
        email: `${userId}@tls-trainer.local`,
        role: "student", createdAt: Date.now(),
      });
    }
    return c.json({ ok: true }, 200);
  })
  .post('/quiz/submit', async (c) => {
    const body = await c.req.json();
    const { userId, moduleId, score, total, answers } = body as {
      userId: string; moduleId: number; score: number; total: number;
      answers?: { questionId: number; questionText: string; selectedOption: string; correctOption: string; isCorrect: boolean }[];
    };
    const [statusRow] = await sql(`SELECT status FROM trainees WHERE id=?`, [userId]).catch(() => [null]);
    if (statusRow?.status === 'suspended') return c.json({ error: 'suspended', message: 'Your account is suspended. Quiz submissions are disabled.' }, 403);
    if (statusRow?.status === 'blocked') return c.json({ error: 'blocked', message: 'Your account has been blocked.' }, 403);
    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = pct >= 70;
    const xpEarned = score * 10;

    const existing = await db.select().from(moduleProgress)
      .where(and(eq(moduleProgress.userId, userId), eq(moduleProgress.moduleId, moduleId)));
    if (existing.length > 0) {
      const prev = existing[0];
      await db.update(moduleProgress)
        .set({ progress: Math.max(prev.progress, pct), completed: prev.completed === 1 || passed ? 1 : 0, lastAccessedAt: now })
        .where(and(eq(moduleProgress.userId, userId), eq(moduleProgress.moduleId, moduleId)));
    } else {
      await db.insert(moduleProgress).values({ userId, moduleId, progress: pct, completed: passed ? 1 : 0, lastAccessedAt: now });
    }

    const [streakRow] = await db.select().from(streaks).where(eq(streaks.userId, userId));
    let newStreak = 1, longestStreak = 1;
    if (streakRow) {
      const last = streakRow.lastActivityDate;
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      newStreak = last === todayStr ? streakRow.currentStreak : last === yesterday ? streakRow.currentStreak + 1 : 1;
      longestStreak = Math.max(streakRow.longestStreak, newStreak);
      await db.update(streaks).set({ currentStreak: newStreak, longestStreak, lastActivityDate: todayStr, totalXp: streakRow.totalXp + xpEarned })
        .where(eq(streaks.userId, userId));
    } else {
      await db.insert(streaks).values({ userId, currentStreak: 1, longestStreak: 1, lastActivityDate: todayStr, totalXp: xpEarned });
    }

    const allBadges = await db.select().from(achievements);
    const alreadyEarned = await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
    const earnedIds = new Set(alreadyEarned.map(e => e.achievementId));
    const newlyUnlocked: { key: string; name: string; icon: string; xpReward: number }[] = [];
    const unlock = async (key: string) => {
      const badge = allBadges.find(b => b.key === key);
      if (!badge || earnedIds.has(badge.id)) return;
      await db.insert(userAchievements).values({ userId, achievementId: badge.id, earnedAt: now });
      newlyUnlocked.push({ key: badge.key, name: badge.name, icon: badge.icon ?? '🏅', xpReward: badge.xpReward });
    };
    await unlock('first_lesson');
    if (passed) {
      await unlock(`module_${moduleId}_complete`);
      const progress = await db.select().from(moduleProgress).where(eq(moduleProgress.userId, userId));
      if (progress.filter(p => p.completed === 1).length >= 9) await unlock('all_modules');
    }
    if (pct === 100) await unlock('quiz_perfect');
    const finalStreak = streakRow ? Math.max(streakRow.currentStreak, newStreak) : 1;
    if (finalStreak >= 7) await unlock('streak_7');
    if (finalStreak >= 30) await unlock('streak_30');

    return c.json({ ok: true, xpEarned, pct, newlyUnlocked }, 200);
  })
  // Save individual question answers
  .post('/quiz/answers', async (c) => {
    const body = await c.req.json();
    const { attemptId, traineeId, moduleId, answers } = body as {
      attemptId: number;
      traineeId: string;
      moduleId: number;
      answers: { questionId: number; questionText: string; selectedOption: string; correctOption: string; isCorrect: boolean }[];
    };
    if (!answers?.length) return c.json({ ok: true }, 200);
    const now = Date.now();
    // Create quiz_answers table if not exists
    await sql(`CREATE TABLE IF NOT EXISTS quiz_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      trainee_id TEXT NOT NULL,
      module_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      selected_option TEXT NOT NULL,
      correct_option TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL
    )`, []);
    for (const a of answers) {
      await sql(`INSERT INTO quiz_answers (attempt_id, trainee_id, module_id, question_id, question_text, selected_option, correct_option, is_correct, ts) VALUES (?,?,?,?,?,?,?,?,?)`,
        [attemptId, traineeId, moduleId, a.questionId, a.questionText, a.selectedOption, a.correctOption, a.isCorrect ? 1 : 0, now]);
    }
    return c.json({ ok: true }, 200);
  })
  .get('/streaks/:userId', async (c) => {
    const userId = c.req.param('userId');
    const [row] = await db.select().from(streaks).where(eq(streaks.userId, userId));
    return c.json(row ?? { currentStreak: 0, longestStreak: 0, totalXp: 0 }, 200);
  })
  .get('/leaderboard', async (c) => {
    // Join trainees with streaks and quiz stats
    const rows = await sql(`
      SELECT 
        t.id,
        t.name,
        t.rank,
        t.unit,
        t.training_level,
        COALESCE(s.total_xp, 0) as total_xp,
        COALESCE(s.current_streak, 0) as current_streak,
        COALESCE(s.longest_streak, 0) as longest_streak,
        COUNT(DISTINCT qa.id) as quiz_count,
        COALESCE(AVG(CASE WHEN qa.passed = 1 THEN qa.pct ELSE NULL END), 0) as avg_passed_pct,
        SUM(CASE WHEN qa.passed = 1 THEN 1 ELSE 0 END) as quizzes_passed
      FROM trainees t
      LEFT JOIN streaks s ON s.user_id = t.id
      LEFT JOIN quiz_attempts qa ON qa.trainee_id = t.id
      GROUP BY t.id
      ORDER BY total_xp DESC
      LIMIT 50
    `, []);
    return c.json(rows, 200);
  })
  .get('/quiz-attempts/:userId', async (c) => {
    const userId = c.req.param('userId');
    const rows = await sql(`SELECT id, module_id, module_name, score, total, pct, passed, ts FROM quiz_attempts WHERE trainee_id=? ORDER BY ts DESC`, [userId]);
    return c.json(rows, 200);
  })
  .post('/chat/ai', async (c) => {
    const body = await c.req.json();
    const { message, history = [] } = body as { message: string; history: { role: 'user' | 'assistant'; content: string }[] };
    const systemPrompt = `You are a TLS (Transponder Landing System) expert instructor for the Royal Saudi Air Force (RSAF) Ground Radar unit in Jeddah, Saudi Arabia. Answer any question about TLS, ILS, aviation navigation, radar systems, and related technical topics — including system components, operation, calibration, maintenance, alarm analysis, signal theory, DDM, VSWR, transponder encoding, glide slope, localizer, integrity monitoring, and startup procedures. Be precise, technical, and educational. Reply in Arabic first, then English. Keep responses focused and useful for a field technician.`;
    try {
      const gateway = createGateway({ baseURL: process.env.AI_GATEWAY_BASE_URL, apiKey: process.env.AI_GATEWAY_API_KEY });
      const { text } = await generateText({
        model: gateway("openai/gpt-5.4-mini"),
        system: systemPrompt,
        messages: [...history.slice(-10).map((m: any) => ({ role: m.role, content: m.content })), { role: 'user' as const, content: message }],
        maxTokens: 500, temperature: 0.7,
      });
      return c.json({ reply: text ?? 'لا توجد إجابة.\nNo reply received.' }, 200);
    } catch (e) {
      return c.json({ reply: 'عذراً، تعذر الاتصال.\nSorry, connection failed.' }, 200);
    }
  })
  .get('/messages', async (c) => {
    const rows = await db.select().from(messages).orderBy(messages.createdAt);
    return c.json(rows, 200);
  })
  .post('/messages', async (c) => {
    const body = await c.req.json();
    const { userId, text, senderRole } = body;
    // Moderation gates (skip for admin messages)
    if (senderRole !== 'admin' && userId) {
      const [statusRow] = await sql(`SELECT status FROM trainees WHERE id=?`, [userId]).catch(() => []);
      if (statusRow?.status === 'suspended') return c.json({ error: 'suspended', message: 'Your account is suspended. Chat is disabled.' }, 403);
      if (statusRow?.status === 'muted') return c.json({ error: 'muted', message: 'You have been muted. You cannot send messages.' }, 403);
    }
    await db.insert(messages).values({ userId, text, senderRole: senderRole ?? 'student', createdAt: Date.now() });
    if (senderRole !== 'admin') {
      const [u] = await db.select().from(users).where(eq(users.id, userId)).catch(() => [undefined]);
      sendTelegram({ type: "chat_message", traineeId: userId, traineeName: u?.name ?? userId, preview: text ?? "" });
    }
    return c.json({ ok: true }, 200);
  })

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP CHAT (real-time, moderated)
  // ══════════════════════════════════════════════════════════════════════════

  // GET /chat/messages?room=general&since=0&limit=50
  .get('/chat/messages', async (c) => {
    const room  = c.req.query('room')  ?? 'general';
    const since = Number(c.req.query('since') ?? 0);
    const limit = Math.min(Number(c.req.query('limit') ?? 80), 200);
    const rows = await sql(
      `SELECT cm.id, cm.room, cm.sender_id, cm.sender_name, cm.sender_role,
              cm.text, cm.deleted, cm.deleted_by, cm.pinned, cm.pinned_by, cm.pinned_at,
              cm.important, cm.ts, cm.attachment_id,
              ca.file_type, ca.file_name, ca.mime_type, ca.size, ca.data as attachment_data
       FROM chat_messages cm
       LEFT JOIN chat_attachments ca ON ca.id = cm.attachment_id
       WHERE cm.room=? AND cm.ts > ?
       ORDER BY cm.ts ASC LIMIT ?`,
      [room, since, limit]
    );
    // Get pinned messages (not deleted)
    const pinned = await sql(
      `SELECT cm.id, cm.room, cm.sender_id, cm.sender_name, cm.sender_role,
              cm.text, cm.deleted, cm.pinned, cm.pinned_by, cm.pinned_at, cm.important, cm.ts,
              ca.file_type, ca.file_name, ca.mime_type, ca.size
       FROM chat_messages cm
       LEFT JOIN chat_attachments ca ON ca.id = cm.attachment_id
       WHERE cm.room=? AND cm.pinned=1 AND cm.deleted=0
       ORDER BY cm.pinned_at DESC LIMIT 3`,
      [room]
    );
    return c.json({ messages: rows, pinned }, 200);
  })

  // POST /chat/send
  .post('/chat/send', async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      senderId?: string; senderName?: string; senderRole?: string;
      text?: string; room?: string; attachmentId?: number;
    };
    const { senderId, senderName, senderRole = 'trainee', text, room = 'general', attachmentId } = body;
    if (!senderId || !senderName) return c.json({ error: 'senderId + senderName required' }, 400);
    if (!text?.trim() && !attachmentId) return c.json({ error: 'text or attachment required' }, 400);

    // Moderation gates
    if (senderRole !== 'admin') {
      const [sr] = await sql(`SELECT status FROM trainees WHERE id=?`, [senderId]).catch(() => []);
      if (sr?.status === 'suspended') return c.json({ error: 'suspended', message: 'Your account is suspended. Chat is disabled.' }, 403);
      if (sr?.status === 'muted') return c.json({ error: 'muted', message: 'You have been muted. You cannot send messages.' }, 403);
    }

    const now = Date.now();
    await sqlRun(
      `INSERT INTO chat_messages (room, sender_id, sender_name, sender_role, text, attachment_id, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [room, senderId, senderName, senderRole, text?.trim() ?? null, attachmentId ?? null, now]
    );
    const [row] = await sql(`SELECT id FROM chat_messages WHERE rowid=last_insert_rowid()`);
    const msgId = row?.id as number;

    // Telegram for trainee messages
    if (senderRole !== 'admin') {
      sendTelegram({ type: "chat_message", traineeId: senderId, traineeName: senderName, preview: text?.slice(0, 80) ?? '[attachment]' });
    }
    return c.json({ ok: true, id: msgId }, 200);
  })

  // POST /chat/delete — admin only
  .post('/chat/delete', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { messageId, room = 'general' } = await c.req.json().catch(() => ({})) as { messageId?: number; room?: string };
    if (!messageId) return c.json({ error: 'messageId required' }, 400);
    await sqlRun(`UPDATE chat_messages SET deleted=1, deleted_by='admin' WHERE id=? AND room=?`, [messageId, room]);
    sendTelegram({ type: "admin_alert", message: `🗑️ Admin deleted message #${messageId} in room: ${room}` });
    return c.json({ ok: true }, 200);
  })

  // POST /chat/pin — admin only
  .post('/chat/pin', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { messageId, room = 'general', pin = true } = await c.req.json().catch(() => ({})) as { messageId?: number; room?: string; pin?: boolean };
    if (!messageId) return c.json({ error: 'messageId required' }, 400);
    if (pin) {
      await sqlRun(`UPDATE chat_messages SET pinned=1, pinned_by='admin', pinned_at=? WHERE id=?`, [Date.now(), messageId]);
      sendTelegram({ type: "admin_alert", message: `📌 Admin pinned message #${messageId}` });
    } else {
      await sqlRun(`UPDATE chat_messages SET pinned=0, pinned_by=NULL, pinned_at=NULL WHERE id=?`, [messageId]);
    }
    return c.json({ ok: true }, 200);
  })

  // POST /chat/important — admin only
  .post('/chat/important', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { messageId, important = true } = await c.req.json().catch(() => ({})) as { messageId?: number; important?: boolean };
    if (!messageId) return c.json({ error: 'messageId required' }, 400);
    await sqlRun(`UPDATE chat_messages SET important=? WHERE id=?`, [important ? 1 : 0, messageId]);
    if (important) sendTelegram({ type: "admin_alert", message: `⚠️ Admin marked message #${messageId} as important` });
    return c.json({ ok: true }, 200);
  })

  // POST /chat/warn — admin warns a trainee via chat (inserts a system message + alert)
  .post('/chat/warn', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, traineeName, reason, room = 'general' } = await c.req.json().catch(() => ({})) as {
      traineeId?: string; traineeName?: string; reason?: string; room?: string;
    };
    if (!traineeId) return c.json({ error: 'traineeId required' }, 400);
    const warnText = `⚠️ WARNING to ${traineeName ?? traineeId}: ${reason ?? 'Please follow chat rules.'}`;
    const now = Date.now();
    await sqlRun(
      `INSERT INTO chat_messages (room, sender_id, sender_name, sender_role, text, important, ts) VALUES (?, 'admin', 'Admin', 'admin', ?, 1, ?)`,
      [room, warnText, now]
    );
    // Also send private alert
    await sqlRun(`INSERT INTO trainee_alerts (trainee_id, message, alert_type, read, ts) VALUES (?, ?, 'warning', 0, ?)`,
      [traineeId, warnText, now]);
    sendTelegram({ type: "admin_alert", message: `⚠️ Admin warned ${traineeName ?? traineeId}: ${reason ?? ''}` });
    return c.json({ ok: true }, 200);
  })

  // POST /chat/upload — multipart file upload
  .post('/chat/upload', async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return c.json({ error: 'No file provided' }, 400);
      if (file.size > 10 * 1024 * 1024) return c.json({ error: 'File too large (max 10MB)' }, 400);

      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
        'video/webm', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ];
      if (!allowedTypes.includes(file.type)) return c.json({ error: 'File type not allowed' }, 400);

      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      const fileType = file.type.startsWith('image/') ? 'image'
        : file.type.startsWith('audio/') ? 'audio'
        : file.type === 'application/pdf' ? 'pdf'
        : 'file';

      const now = Date.now();
      await sqlRun(
        `INSERT INTO chat_attachments (file_type, file_name, mime_type, size, data, ts) VALUES (?, ?, ?, ?, ?, ?)`,
        [fileType, file.name, file.type, file.size, base64, now]
      );
      const [row] = await sql(`SELECT id FROM chat_attachments WHERE rowid=last_insert_rowid()`);
      return c.json({ ok: true, id: row?.id, fileType, fileName: file.name, mimeType: file.type, size: file.size }, 200);
    } catch (e) {
      return c.json({ error: 'Upload failed' }, 500);
    }
  })

  // GET /chat/attachment/:id — serve attachment
  .get('/chat/attachment/:id', async (c) => {
    const id = c.req.param('id');
    const [row] = await sql(`SELECT file_name, mime_type, data FROM chat_attachments WHERE id=?`, [id]);
    if (!row) return c.json({ error: 'Not found' }, 404);
    const buf = Buffer.from(row.data as string, 'base64');
    return new Response(buf, {
      headers: {
        'Content-Type': row.mime_type as string,
        'Content-Disposition': `inline; filename="${row.file_name}"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  })

  // GET /chat/stream — SSE for real-time updates
  .get('/chat/stream', (c) => {
    const room = c.req.query('room') ?? 'general';
    let lastTs = Number(c.req.query('since') ?? Date.now() - 60000);

    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        const send = (data: unknown) => {
          try { controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
        };

        // Send initial heartbeat
        send({ type: 'connected', room, ts: Date.now() });

        const poll = async () => {
          try {
            const rows = await sql(
              `SELECT cm.id, cm.sender_id, cm.sender_name, cm.sender_role, cm.text,
                      cm.deleted, cm.deleted_by, cm.pinned, cm.pinned_by, cm.pinned_at,
                      cm.important, cm.ts, cm.attachment_id,
                      ca.file_type, ca.file_name, ca.mime_type, ca.size
               FROM chat_messages cm
               LEFT JOIN chat_attachments ca ON ca.id = cm.attachment_id
               WHERE cm.room=? AND cm.ts > ?
               ORDER BY cm.ts ASC LIMIT 50`,
              [room, lastTs]
            );
            if (rows.length > 0) {
              lastTs = rows[rows.length - 1].ts as number;
              send({ type: 'messages', messages: rows });
            }
            // Also send any updated (deleted/pinned/important) messages
            const updated = await sql(
              `SELECT id, deleted, pinned, pinned_at, important FROM chat_messages WHERE room=? AND ts > ? - 5000`,
              [room, lastTs]
            );
            if (updated.length > 0) send({ type: 'updates', updates: updated });
          } catch {}
        };

        const interval = setInterval(poll, 2000);

        // Cleanup on disconnect
        c.req.raw.signal.addEventListener('abort', () => {
          clearInterval(interval);
          try { controller.close(); } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  })

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN ENDPOINTS
  // ══════════════════════════════════════════════════════════════════════════

  .post('/admin/verify', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { password } = body as { password?: string };
    return c.json(password === ADMIN_PASSWORD ? { ok: true } : { ok: false, error: 'Invalid password' },
      password === ADMIN_PASSWORD ? 200 : 401);
  })

  // GET /admin/trainees — summary list
  .get('/admin/trainees', async (c) => {
    const pw = c.req.header('x-admin-password') ?? c.req.query('pw');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);

    const allTrainees = await sql(
      `SELECT id, name, rank, unit, created_at, last_login_at, login_count, is_online, last_page, last_active_at, status FROM trainees ORDER BY last_active_at DESC`
    );

    const allProgress = await sql(`SELECT trainee_id, completed FROM trainee_module_progress`);
    const allAttempts = await sql(`SELECT trainee_id, pct FROM quiz_attempts`);
    const allModules = await db.select().from(modules);
    const totalMods = allModules.length;

    const result = allTrainees.map(t => {
      const id = t.id as string;
      const progress = allProgress.filter(p => p.trainee_id === id);
      const completedModules = progress.filter(p => p.completed === 1).length;
      const attempts = allAttempts.filter(a => a.trainee_id === id);
      const avgScore = attempts.length > 0
        ? Math.round(attempts.reduce((s, a) => s + (a.pct as number), 0) / attempts.length)
        : 0;

      return {
        id,
        name: t.name,
        rank: t.rank,
        unit: t.unit,
        createdAt: t.created_at,
        lastLoginAt: t.last_login_at,
        loginCount: t.login_count,
        online: isOnline(id),
        lastPage: t.last_page,
        lastActiveAt: t.last_active_at,
        completedModules,
        totalModules: totalMods,
        quizAttempts: attempts.length,
        avgScore,
        status: (t.status as string) ?? 'active',
      };
    });

    return c.json(result, 200);
  })

  // GET /admin/trainee/:id — full detail
  .get('/admin/trainee/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');

    const traineesRows = await sql(
      `SELECT id, name, rank, unit, created_at, last_login_at, login_count, is_online, last_page, last_active_at, status, xp, level FROM trainees WHERE id=?`, [id]
    );
    if (!traineesRows.length) return c.json({ error: 'Not found' }, 404);
    const t = traineesRows[0];

    const actLogs = await sql(
      `SELECT id, event, detail, page, ts FROM activity_log WHERE trainee_id=? ORDER BY ts DESC LIMIT 200`, [id]
    );
    const attempts = await sql(
      `SELECT id, module_id, module_name, score, total, correct, wrong, pct, passed, ts FROM quiz_attempts WHERE trainee_id=? ORDER BY ts DESC`, [id]
    );
    const progress = await sql(
      `SELECT id, module_id, module_name, progress, completed, assigned_by_admin, last_accessed_at FROM trainee_module_progress WHERE trainee_id=? ORDER BY module_id`, [id]
    );
    const notes = await sql(
      `SELECT id, note, author_id, ts FROM instructor_notes WHERE trainee_id=? ORDER BY ts DESC`, [id]
    );
    const msgs = await sql(
      `SELECT id, sender_role, text, read, ts FROM trainee_messages WHERE trainee_id=? ORDER BY ts DESC LIMIT 50`, [id]
    );
    const alerts = await sql(
      `SELECT id, message, alert_type, read, ts FROM trainee_alerts WHERE trainee_id=? ORDER BY ts DESC LIMIT 50`, [id]
    );
    const evaluation = await sql(
      `SELECT rating, recommendation, technical_observations, updated_at FROM trainee_evaluations WHERE trainee_id=?`, [id]
    );
    const timeLogs = await sql(
      `SELECT module_id, module_name, SUM(duration_ms) as total_ms FROM module_time_log WHERE trainee_id=? GROUP BY module_id`, [id]
    );
    const manualLogs = await sql(
      `SELECT manual_name, file_name, COUNT(*) as view_count, SUM(duration_ms) as total_ms FROM manual_view_log WHERE trainee_id=? GROUP BY file_name`, [id]
    );

    const totalAttempts = attempts.length;
    const passedAttempts = attempts.filter(a => a.passed === 1).length;
    const failedAttempts = totalAttempts - passedAttempts;
    const totalCorrect = attempts.reduce((s, a) => s + (a.correct as number), 0);
    const totalWrong = attempts.reduce((s, a) => s + (a.wrong as number), 0);
    const bestScore = attempts.length > 0 ? Math.max(...attempts.map(a => a.pct as number)) : 0;
    const avgScore = attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + (a.pct as number), 0) / attempts.length) : 0;
    const completedModules = progress.filter(p => p.completed === 1).length;
    const assignedModules = progress.filter(p => p.assigned_by_admin === 1).length;
    const manualViews = manualLogs.reduce((s, m) => s + (m.view_count as number), 0);
    const totalTrainingMs = timeLogs.reduce((s, t) => s + (t.total_ms as number), 0);
    const trainingHours = Math.round((totalTrainingMs / 3600000) * 10) / 10;

    return c.json({
      trainee: { ...t, online: isOnline(id) },
      stats: {
        totalAttempts, passedAttempts, failedAttempts,
        totalCorrect, totalWrong, bestScore, avgScore,
        completedModules, assignedModules, manualViews, trainingHours,
      },
      activityLog: actLogs,
      quizAttempts: attempts,
      moduleProgress: progress,
      instructorNotes: notes,
      messages: msgs,
      alerts,
      evaluation: evaluation[0] ?? null,
      timeLogs,
      manualLogs,
    }, 200);
  })

  // GET /admin/quiz-answers/:traineeId — per-question answers for a trainee
  .get('/admin/quiz-answers/:traineeId', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const traineeId = c.req.param('traineeId');
    const rows = await sql(`
      SELECT qa.*, qat.module_name, qat.pct, qat.passed
      FROM quiz_answers qa
      LEFT JOIN quiz_attempts qat ON qat.id = qa.attempt_id
      WHERE qa.trainee_id = ?
      ORDER BY qa.ts DESC
    `, [traineeId]).catch(() => []);
    return c.json(rows, 200);
  })
  // GET /admin/missed-questions — most missed questions across all trainees
  .get('/admin/missed-questions', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const rows = await sql(`
      SELECT 
        question_id,
        question_text,
        module_id,
        COUNT(*) as total_attempts,
        SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) as wrong_count,
        ROUND(SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as wrong_pct
      FROM quiz_answers
      GROUP BY question_id
      HAVING total_attempts >= 1
      ORDER BY wrong_pct DESC
      LIMIT 20
    `, []).catch(() => []);
    return c.json(rows, 200);
  })


  // POST /admin/message
  .post('/admin/message', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, text } = await c.req.json().catch(() => ({})) as { traineeId?: string; text?: string };
    if (!traineeId || !text?.trim()) return c.json({ error: 'traineeId + text required' }, 400);
    await sqlRun(`INSERT INTO trainee_messages (trainee_id, sender_role, text, read, ts) VALUES (?, 'admin', ?, 0, ?)`,
      [traineeId, text.trim(), Date.now()]);
    // Notify Telegram that admin sent a message
    const [tr] = await sql(`SELECT name FROM trainees WHERE id=?`, [traineeId]);
    const tName = (tr?.name as string) ?? traineeId;
    sendTelegram({ type: "admin_alert", message: `💬 Message sent to ${tName}: "${text.trim().slice(0, 80)}"` });
    return c.json({ ok: true }, 200);
  })

  // POST /admin/alert
  .post('/admin/alert', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, message, alertType = 'info' } = await c.req.json().catch(() => ({})) as {
      traineeId?: string; message?: string; alertType?: string;
    };
    if (!traineeId || !message?.trim()) return c.json({ error: 'traineeId + message required' }, 400);
    await sqlRun(`INSERT INTO trainee_alerts (trainee_id, message, alert_type, read, ts) VALUES (?, ?, ?, 0, ?)`,
      [traineeId, message.trim(), alertType, Date.now()]);
    // Notify Telegram that admin sent an alert
    const [tr2] = await sql(`SELECT name FROM trainees WHERE id=?`, [traineeId]);
    const tName2 = (tr2?.name as string) ?? traineeId;
    sendTelegram({ type: "admin_alert", message: `[${alertType.toUpperCase()}] Alert sent to ${tName2}: "${message.trim().slice(0, 80)}"` });
    return c.json({ ok: true }, 200);
  })

  // POST /admin/note
  .post('/admin/note', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, note } = await c.req.json().catch(() => ({})) as { traineeId?: string; note?: string };
    if (!traineeId || !note?.trim()) return c.json({ error: 'traineeId + note required' }, 400);
    await sqlRun(`INSERT INTO instructor_notes (trainee_id, note, author_id, ts) VALUES (?, ?, 'admin', ?)`,
      [traineeId, note.trim(), Date.now()]);
    return c.json({ ok: true }, 200);
  })

  // POST /admin/assign-module
  .post('/admin/assign-module', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, moduleId, moduleName = "" } = await c.req.json().catch(() => ({})) as {
      traineeId?: string; moduleId?: number; moduleName?: string;
    };
    if (!traineeId || moduleId == null) return c.json({ error: 'traineeId + moduleId required' }, 400);
    const existing = await sql(`SELECT id FROM trainee_module_progress WHERE trainee_id=? AND module_id=?`, [traineeId, moduleId]);
    if (existing.length > 0) {
      await sqlRun(`UPDATE trainee_module_progress SET assigned_by_admin=1 WHERE trainee_id=? AND module_id=?`, [traineeId, moduleId]);
    } else {
      await sqlRun(
        `INSERT INTO trainee_module_progress (trainee_id, module_id, module_name, progress, completed, assigned_by_admin, last_accessed_at) VALUES (?, ?, ?, 0, 0, 1, ?)`,
        [traineeId, moduleId, moduleName, Date.now()]
      );
    }
    await logActivity(traineeId, 'module_assigned', { moduleId, moduleName, by: 'admin' });
    return c.json({ ok: true }, 200);
  })

  // POST /admin/reset-quiz
  .post('/admin/reset-quiz', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, moduleId } = await c.req.json().catch(() => ({})) as { traineeId?: string; moduleId?: number };
    if (!traineeId || moduleId == null) return c.json({ error: 'traineeId + moduleId required' }, 400);
    await sqlRun(`DELETE FROM quiz_attempts WHERE trainee_id=? AND module_id=?`, [traineeId, moduleId]);
    await sqlRun(`UPDATE trainee_module_progress SET progress=0, completed=0 WHERE trainee_id=? AND module_id=?`, [traineeId, moduleId]);
    await logActivity(traineeId, 'quiz_reset', { moduleId, by: 'admin' });
    return c.json({ ok: true }, 200);
  })

  // POST /admin/complete-module
  .post('/admin/complete-module', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, moduleId, moduleName = "" } = await c.req.json().catch(() => ({})) as {
      traineeId?: string; moduleId?: number; moduleName?: string;
    };
    if (!traineeId || moduleId == null) return c.json({ error: 'traineeId + moduleId required' }, 400);
    const existing = await sql(`SELECT id FROM trainee_module_progress WHERE trainee_id=? AND module_id=?`, [traineeId, moduleId]);
    if (existing.length > 0) {
      await sqlRun(`UPDATE trainee_module_progress SET completed=1, progress=100 WHERE trainee_id=? AND module_id=?`, [traineeId, moduleId]);
    } else {
      await sqlRun(
        `INSERT INTO trainee_module_progress (trainee_id, module_id, module_name, progress, completed, last_accessed_at) VALUES (?, ?, ?, 100, 1, ?)`,
        [traineeId, moduleId, moduleName, Date.now()]
      );
    }
    await logActivity(traineeId, 'module_completed_by_admin', { moduleId, moduleName, by: 'admin' });
    return c.json({ ok: true }, 200);
  })

  // POST /admin/moderate — block/unblock/suspend/restore/mute/unmute
  .post('/admin/moderate', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, action, reason } = await c.req.json().catch(() => ({})) as {
      traineeId?: string; action?: string; reason?: string;
    };
    if (!traineeId || !action) return c.json({ error: 'traineeId + action required' }, 400);

    const validActions = ['block', 'unblock', 'suspend', 'restore', 'mute', 'unmute'];
    if (!validActions.includes(action)) return c.json({ error: 'Invalid action' }, 400);

    const actionToStatus: Record<string, string> = {
      block: 'blocked', unblock: 'active', suspend: 'suspended', restore: 'active', mute: 'muted', unmute: 'active',
    };
    const newStatus = actionToStatus[action];

    const [tr] = await sql(`SELECT name, status FROM trainees WHERE id=?`, [traineeId]);
    if (!tr) return c.json({ error: 'Trainee not found' }, 404);
    const traineeName = (tr.name as string) ?? traineeId;
    const prevStatus = (tr.status as string) ?? 'active';

    await sqlRun(`UPDATE trainees SET status=? WHERE id=?`, [newStatus, traineeId]);
    await sqlRun(`INSERT INTO moderation_log (trainee_id, action, reason, admin_id, ts) VALUES (?, ?, ?, 'admin', ?)`,
      [traineeId, action, reason ?? null, Date.now()]);
    await logActivity(traineeId, `admin_${action}`, { reason, by: 'admin', prevStatus, newStatus });

    // Telegram notifications for significant actions
    const telegramMessages: Record<string, string> = {
      block:   `🚫 BLOCKED: ${traineeName} — ${reason ?? 'No reason given'}`,
      unblock: `✅ UNBLOCKED: ${traineeName}`,
      suspend: `⏸️ SUSPENDED: ${traineeName} — ${reason ?? 'No reason given'}`,
      restore: `▶️ RESTORED: ${traineeName}`,
      mute:    `🔇 MUTED: ${traineeName} — ${reason ?? 'No reason given'}`,
      unmute:  `🔊 UNMUTED: ${traineeName}`,
    };
    sendTelegram({ type: "admin_alert", message: telegramMessages[action] });

    return c.json({ ok: true, newStatus }, 200);
  })

  // DELETE /admin/trainee/:id — permanently remove a trainee and all their data
  .delete('/admin/trainee/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const rows = await sql(`SELECT name FROM trainees WHERE id=?`, [id]);
    if (!rows.length) return c.json({ error: 'Not found' }, 404);
    const name = rows[0].name as string;

    // Remove all associated data
    await sqlRun(`DELETE FROM activity_log WHERE trainee_id=?`, [id]).catch(() => {});
    await sqlRun(`DELETE FROM quiz_attempts WHERE trainee_id=?`, [id]).catch(() => {});
    await sqlRun(`DELETE FROM trainee_module_progress WHERE trainee_id=?`, [id]).catch(() => {});
    await sqlRun(`DELETE FROM moderation_log WHERE trainee_id=?`, [id]).catch(() => {});
    await sqlRun(`DELETE FROM chat_messages WHERE sender_id=?`, [id]).catch(() => {});
    await sqlRun(`DELETE FROM trainees WHERE id=?`, [id]);
    onlineHeartbeats.delete(id);

    sendTelegram({ type: "admin_alert", message: `🗑️ Admin deleted trainee account: ${name} (${id})` });
    return c.json({ ok: true, deleted: name }, 200);
  })

  // GET /admin/moderation-log/:id
  .get('/admin/moderation-log/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const rows = await sql(`SELECT id, action, reason, admin_id, ts FROM moderation_log WHERE trainee_id=? ORDER BY ts DESC LIMIT 50`, [id]);
    return c.json(rows, 200);
  })

  // ── Backup endpoints ──────────────────────────────────────────────────────

  // POST /admin/backup/create
  .post('/admin/backup/create', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json().catch(() => ({})) as { note?: string };
    try {
      const result = await createBackup('manual', body.note ?? 'Manual backup');
      return c.json({ ok: true, ...result }, 200);
    } catch (e: any) {
      return c.json({ ok: false, error: e?.message ?? 'Backup failed' }, 500);
    }
  })

  // GET /admin/backup/list
  .get('/admin/backup/list', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const rows = await sql(`SELECT id, label, note, created_at, size_bytes, table_counts FROM backups ORDER BY created_at DESC`);
    return c.json(rows, 200);
  })

  // GET /admin/backup/:id/download — returns zip as base64 JSON (browser downloads it)
  .get('/admin/backup/:id/download', async (c) => {
    const pw = c.req.header('x-admin-password') ?? c.req.query('pw');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const [row] = await sql(`SELECT id, label, note, created_at, size_bytes, data FROM backups WHERE id=?`, [id]);
    if (!row) return c.json({ error: 'Not found' }, 404);

    // Build a zip-like bundle: JSON with metadata + data
    const bundle = {
      meta: {
        id: row.id, label: row.label, note: row.note,
        created_at: row.created_at,
        exported_at: Date.now(),
        version: 'TLS-Trainer-v1',
        size_bytes: row.size_bytes,
      },
      data: JSON.parse(row.data as string),
    };
    const json = JSON.stringify(bundle, null, 2);
    const buf = Buffer.from(json, 'utf8');
    const filename = `TLS-backup-${row.label}-${new Date(row.created_at as number).toISOString().slice(0,10)}-${(row.id as string).slice(-5)}.json`;
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'x-admin-only': 'true',
      },
    });
  })

  // POST /admin/backup/:id/restore
  .post('/admin/backup/:id/restore', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const result = await restoreFromBackup(id);
    if (!result.ok) return c.json(result, 400);
    sendTelegram({ type: 'admin_alert', message: `♻️ Admin restored database from backup: ${id}` });
    return c.json(result, 200);
  })

  // DELETE /admin/backup/:id
  .delete('/admin/backup/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const [row] = await sql(`SELECT id FROM backups WHERE id=?`, [id]);
    if (!row) return c.json({ error: 'Not found' }, 404);
    await sqlRun(`DELETE FROM backups WHERE id=?`, [id]);
    return c.json({ ok: true }, 200);
  })

  // GET /admin/backup/export/json — full data export as JSON (no backup stored)
  .get('/admin/backup/export/json', async (c) => {
    const pw = c.req.header('x-admin-password') ?? c.req.query('pw');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { dump, counts } = await dumpAllTables();
    const bundle = {
      meta: { exported_at: Date.now(), version: 'TLS-Trainer-v1', table_counts: counts },
      data: dump,
    };
    const json = JSON.stringify(bundle, null, 2);
    const filename = `TLS-export-${new Date().toISOString().slice(0,10)}.json`;
    return new Response(Buffer.from(json, 'utf8'), {
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${filename}"` },
    });
  })

  // GET /admin/backup/export/sql — SQL INSERT dump
  .get('/admin/backup/export/sql', async (c) => {
    const pw = c.req.header('x-admin-password') ?? c.req.query('pw');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { dump } = await dumpAllTables();
    const lines: string[] = [
      '-- TLS Trainer Database Export',
      `-- Exported: ${new Date().toISOString()}`,
      `-- Version: TLS-Trainer-v1`,
      '',
    ];
    for (const [table, rows] of Object.entries(dump)) {
      lines.push(`-- Table: ${table} (${(rows as unknown[]).length} rows)`);
      lines.push(`DELETE FROM ${table};`);
      for (const row of rows as Record<string, unknown>[]) {
        const keys = Object.keys(row);
        if (!keys.length) continue;
        const cols = keys.map(k => `"${k}"`).join(', ');
        const vals = keys.map(k => {
          const v = row[k];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return String(v);
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');
        lines.push(`INSERT OR REPLACE INTO "${table}" (${cols}) VALUES (${vals});`);
      }
      lines.push('');
    }
    const sql_text = lines.join('\n');
    const filename = `TLS-export-${new Date().toISOString().slice(0,10)}.sql`;
    return new Response(Buffer.from(sql_text, 'utf8'), {
      headers: { 'Content-Type': 'text/plain', 'Content-Disposition': `attachment; filename="${filename}"` },
    });
  })

  // GET /admin/backup/export/project — download full project source as ZIP
  .get('/admin/backup/export/project', async (c) => {
    const pw = c.req.header('x-admin-password') ?? c.req.query('pw');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    try {
      const zipData = await buildProjectZip();
      const filename = `TLS-Trainer-source-${new Date().toISOString().slice(0,10)}.zip`;
      return new Response(zipData, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (e: any) {
      return c.json({ error: e?.message ?? 'Export failed' }, 500);
    }
  })

  // GET /admin/backup/export/migration — full migration package (source + DB + files)
  .get('/admin/backup/export/migration', async (c) => {
    const pw = c.req.header('x-admin-password') ?? c.req.query('pw');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    try {
      const zipData = await buildMigrationPackage();
      const filename = `TLS-Trainer-migration-${new Date().toISOString().slice(0,10)}.zip`;
      return new Response(zipData, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (e: any) {
      return c.json({ error: e?.message ?? 'Migration export failed' }, 500);
    }
  })

  // POST /admin/backup/import — restore from uploaded JSON backup file
  .post('/admin/backup/import', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return c.json({ error: 'No file provided' }, 400);
      if (file.size > 200 * 1024 * 1024) return c.json({ error: 'File too large (max 200MB)' }, 400);
      const text = await file.text();
      const result = await restoreFromJSON(text);
      if (!result.ok) return c.json(result, 400);
      sendTelegram({ type: 'admin_alert', message: `♻️ Admin restored database from uploaded file (${file.name})` });
      return c.json({ ok: true, tablesRestored: result.tablesRestored }, 200);
    } catch (e: any) {
      return c.json({ error: e?.message ?? 'Import failed' }, 500);
    }
  })

  // GET /admin/backup/stats — storage usage + last backup info
  .get('/admin/backup/stats', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const rows = await sql(`SELECT label, created_at, size_bytes FROM backups ORDER BY created_at DESC`);
    const totalBytes = (rows as { size_bytes: number }[]).reduce((s, r) => s + (r.size_bytes || 0), 0);
    const lastBackup = rows[0] ?? null;
    const counts = { manual: 0, daily: 0, weekly: 0, 'pre-restore': 0 } as Record<string, number>;
    for (const r of rows) counts[(r.label as string)] = (counts[(r.label as string)] ?? 0) + 1;
    return c.json({ totalBytes, totalBackups: rows.length, lastBackup, counts }, 200);
  })

  // GET/POST /admin/telegram
  .get('/admin/telegram', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    return c.json(getTelegramConfig(), 200);
  })
  .post('/admin/telegram', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json().catch(() => ({})) as { botToken?: string; chatId?: string; enabled?: boolean };
    const patch: Record<string, unknown> = {};
    if (body.chatId !== undefined) patch.chatId = body.chatId;
    if (body.enabled !== undefined) patch.enabled = body.enabled;
    if (body.botToken && body.botToken.trim() !== "" && !body.botToken.includes("•")) patch.botToken = body.botToken.trim();
    setTelegramConfig(patch as any);
    return c.json({ ok: true }, 200);
  })
  .post('/admin/telegram/test', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const result = await sendTelegram({ type: "test" });
    return c.json(result, result.ok ? 200 : 400);
  })

  // ── Evaluation endpoints ───────────────────────────────────────────────────
  // GET /admin/evaluation/:id — get trainee evaluation
  .get('/admin/evaluation/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const rows = await sql(`SELECT rating, recommendation, technical_observations, updated_at FROM trainee_evaluations WHERE trainee_id=?`, [id]);
    return c.json(rows[0] ?? null, 200);
  })

  // POST /admin/evaluation — upsert trainee evaluation
  .post('/admin/evaluation', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json().catch(() => ({})) as {
      traineeId?: string; rating?: string; recommendation?: string; technical_observations?: string;
    };
    if (!body.traineeId) return c.json({ error: 'traineeId required' }, 400);
    const { traineeId, rating = 'pending', recommendation = '', technical_observations = '' } = body;
    const validRatings = ['pending', 'excellent', 'good', 'weak', 'needs_review'];
    if (!validRatings.includes(rating)) return c.json({ error: 'Invalid rating' }, 400);
    const now = Date.now();
    const existing = await sql(`SELECT id FROM trainee_evaluations WHERE trainee_id=?`, [traineeId]);
    if (existing.length > 0) {
      await sqlRun(`UPDATE trainee_evaluations SET rating=?, recommendation=?, technical_observations=?, updated_at=? WHERE trainee_id=?`,
        [rating, recommendation, technical_observations, now, traineeId]);
    } else {
      await sqlRun(`INSERT INTO trainee_evaluations (trainee_id, rating, recommendation, technical_observations, admin_id, updated_at) VALUES (?, ?, ?, ?, 'admin', ?)`,
        [traineeId, rating, recommendation, technical_observations, now]);
    }
    const [tr] = await sql(`SELECT name FROM trainees WHERE id=?`, [traineeId]);
    const tName = (tr?.name as string) ?? traineeId;
    const ratingLabel = rating === 'excellent' ? '⭐⭐⭐ Excellent' : rating === 'good' ? '⭐⭐ Good' : rating === 'weak' ? '⚠️ Weak' : rating === 'needs_review' ? '🔍 Needs Review' : 'Pending';
    sendTelegram({ type: 'admin_alert', message: `📋 Evaluation updated for ${tName}: ${ratingLabel}` });
    return c.json({ ok: true }, 200);
  })

  // ── Trainee self-report endpoint ───────────────────────────────────────────
  // GET /trainee/report/:id — trainee views their own report (session-gated)
  .get('/trainee/report/:id', async (c) => {
    const id = c.req.param('id');
    // Verify session matches requested ID
    const sessionHeader = c.req.header('x-trainee-id');
    if (sessionHeader !== id) return c.json({ error: 'Unauthorized' }, 401);

    const traineesRows = await sql(
      `SELECT id, name, rank, unit, created_at, last_login_at, login_count, last_active_at, status, xp, level FROM trainees WHERE id=?`, [id]
    );
    if (!traineesRows.length) return c.json({ error: 'Not found' }, 404);
    const t = traineesRows[0];

    const attempts = await sql(`SELECT module_id, module_name, pct, passed, ts FROM quiz_attempts WHERE trainee_id=? ORDER BY ts DESC`, [id]);
    const progress = await sql(`SELECT module_id, module_name, progress, completed, last_accessed_at FROM trainee_module_progress WHERE trainee_id=? ORDER BY module_id`, [id]);
    const evaluation = await sql(`SELECT rating, recommendation, technical_observations, updated_at FROM trainee_evaluations WHERE trainee_id=?`, [id]);
    const timeLogs = await sql(`SELECT module_id, module_name, SUM(duration_ms) as total_ms FROM module_time_log WHERE trainee_id=? GROUP BY module_id`, [id]);
    const manualLogs = await sql(`SELECT manual_name, COUNT(*) as view_count FROM manual_view_log WHERE trainee_id=? GROUP BY manual_name`, [id]);

    const totalAttempts = attempts.length;
    const passedAttempts = attempts.filter((a: Record<string, unknown>) => a.passed === 1).length;
    const avgScore = attempts.length > 0 ? Math.round(attempts.reduce((s: number, a: Record<string, unknown>) => s + (a.pct as number), 0) / attempts.length) : 0;
    const completedModules = progress.filter((p: Record<string, unknown>) => p.completed === 1).length;
    const totalTrainingMs = timeLogs.reduce((s: number, t: Record<string, unknown>) => s + (t.total_ms as number), 0);
    const trainingHours = Math.round((totalTrainingMs / 3600000) * 10) / 10;

    return c.json({
      trainee: t,
      stats: { totalAttempts, passedAttempts, failedAttempts: totalAttempts - passedAttempts, avgScore, completedModules, trainingHours },
      quizAttempts: attempts,
      moduleProgress: progress,
      evaluation: evaluation[0] ?? null,
      manualLogs,
    }, 200);
  })

  // ── Time tracking endpoints ────────────────────────────────────────────────
  // POST /trainee/time — log time spent in a module
  .post('/trainee/time', async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      traineeId?: string; moduleId?: number; moduleName?: string; durationMs?: number;
    };
    if (!body.traineeId || body.moduleId == null || !body.durationMs) return c.json({ ok: false }, 200);
    if (body.durationMs < 3000) return c.json({ ok: false }, 200); // ignore < 3s
    await sqlRun(
      `INSERT INTO module_time_log (trainee_id, module_id, module_name, duration_ms, ts) VALUES (?, ?, ?, ?, ?)`,
      [body.traineeId, body.moduleId, body.moduleName ?? '', body.durationMs, Date.now()]
    );
    // Check total time milestone → Telegram
    const totalRows = await sql(`SELECT SUM(duration_ms) as total FROM module_time_log WHERE trainee_id=?`, [body.traineeId]);
    const totalMs = (totalRows[0]?.total as number) ?? 0;
    const totalHours = totalMs / 3600000;
    const [tr] = await sql(`SELECT name FROM trainees WHERE id=?`, [body.traineeId]);
    const tName = (tr?.name as string) ?? body.traineeId;
    // Send milestone alerts at 1h, 5h, 10h
    for (const milestone of [1, 5, 10]) {
      const prevMs = totalMs - body.durationMs;
      if (prevMs / 3600000 < milestone && totalHours >= milestone) {
        sendTelegram({ type: 'admin_alert', message: `⏱️ Training milestone: ${tName} reached ${milestone} hour${milestone > 1 ? 's' : ''} of training` });
      }
    }
    return c.json({ ok: true }, 200);
  })

  // POST /trainee/manual-view — log manual/PDF view
  .post('/trainee/manual-view', async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      traineeId?: string; manualName?: string; fileName?: string; durationMs?: number;
    };
    if (!body.traineeId || !body.manualName) return c.json({ ok: false }, 200);
    await sqlRun(
      `INSERT INTO manual_view_log (trainee_id, manual_name, file_name, duration_ms, ts) VALUES (?, ?, ?, ?, ?)`,
      [body.traineeId, body.manualName, body.fileName ?? '', body.durationMs ?? 0, Date.now()]
    );
    // Also log as activity_log event
    await logActivity(body.traineeId, 'manual_view', { manualName: body.manualName, fileName: body.fileName });
    const [tr] = await sql(`SELECT name FROM trainees WHERE id=?`, [body.traineeId]);
    const tName = (tr?.name as string) ?? body.traineeId;
    sendTelegram({ type: 'admin_alert', message: `📖 ${tName} viewed manual: ${body.manualName}` });
    return c.json({ ok: true }, 200);
  })

  // ── Admin full report data endpoint ────────────────────────────────────────
  // GET /admin/report/:id — full report JSON for PDF generation
  .get('/admin/report/:id', async (c) => {
    const pw = c.req.header('x-admin-password') ?? c.req.query('pw');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');

    const traineesRows = await sql(
      `SELECT id, name, rank, unit, created_at, last_login_at, login_count, last_active_at, status, xp, level FROM trainees WHERE id=?`, [id]
    );
    if (!traineesRows.length) return c.json({ error: 'Not found' }, 404);
    const t = traineesRows[0];

    const attempts = await sql(`SELECT module_id, module_name, score, total, pct, passed, ts FROM quiz_attempts WHERE trainee_id=? ORDER BY ts DESC`, [id]);
    const progress = await sql(`SELECT module_id, module_name, progress, completed, last_accessed_at FROM trainee_module_progress WHERE trainee_id=? ORDER BY module_id`, [id]);
    const notes = await sql(`SELECT note, ts FROM instructor_notes WHERE trainee_id=? ORDER BY ts DESC LIMIT 10`, [id]);
    const evaluation = await sql(`SELECT rating, recommendation, technical_observations, updated_at FROM trainee_evaluations WHERE trainee_id=?`, [id]);
    const timeLogs = await sql(`SELECT module_id, module_name, SUM(duration_ms) as total_ms FROM module_time_log WHERE trainee_id=? GROUP BY module_id`, [id]);
    const manualLogs = await sql(`SELECT manual_name, COUNT(*) as view_count, SUM(duration_ms) as total_ms FROM manual_view_log WHERE trainee_id=? GROUP BY manual_name`, [id]);
    const totalMods = await sql(`SELECT COUNT(*) as cnt FROM modules WHERE is_published=1`);

    const totalAttempts = attempts.length;
    const passedAttempts = attempts.filter((a: Record<string, unknown>) => a.passed === 1).length;
    const failedAttempts = totalAttempts - passedAttempts;
    const avgScore = attempts.length > 0 ? Math.round(attempts.reduce((s: number, a: Record<string, unknown>) => s + (a.pct as number), 0) / attempts.length) : 0;
    const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a: Record<string, unknown>) => a.pct as number)) : 0;
    const completedModules = progress.filter((p: Record<string, unknown>) => p.completed === 1).length;
    const totalModuleCount = (totalMods[0]?.cnt as number) ?? 0;
    const totalTrainingMs = timeLogs.reduce((s: number, tl: Record<string, unknown>) => s + (tl.total_ms as number), 0);
    const trainingHours = Math.round((totalTrainingMs / 3600000) * 10) / 10;

    return c.json({
      trainee: { ...t, online: isOnline(id) },
      stats: {
        totalAttempts, passedAttempts, failedAttempts, avgScore, bestScore,
        completedModules, totalModuleCount, trainingHours,
      },
      quizAttempts: attempts,
      moduleProgress: progress,
      notes,
      evaluation: evaluation[0] ?? null,
      timeLogs,
      manualLogs,
      generatedAt: Date.now(),
    }, 200);
  });

export type AppType = typeof app;
export default app;
