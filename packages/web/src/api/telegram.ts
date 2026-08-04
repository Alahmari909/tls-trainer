// ── Telegram Notification Service ─────────────────────────────────────────────
// All bot token / chat ID stored server-side only. Never exposed to frontend.

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

// In-memory config (persists for server lifetime, survives hot-reload via env)
let _config: TelegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  chatId:   process.env.TELEGRAM_CHAT_ID   ?? "",
  enabled:  process.env.TELEGRAM_ENABLED   === "true",
};

export function getTelegramConfig(): Omit<TelegramConfig, "botToken"> & { hasToken: boolean } {
  return {
    hasToken: _config.botToken.length > 0,
    chatId:   _config.chatId,
    enabled:  _config.enabled,
  };
}

export function setTelegramConfig(patch: Partial<TelegramConfig>) {
  _config = { ..._config, ...patch };
}

// ── Format helpers ─────────────────────────────────────────────────────────────
function saJeddahTime(): string {
  return new Date().toLocaleString("en-SA", {
    timeZone: "Asia/Riyadh",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

// Defensive: callers are typed as `string`, but at runtime values arrive from
// JSON request bodies and can be undefined / null / numbers. A raw
// `text.replace` on those throws and used to crash the whole server.
function esc(text: unknown): string {
  if (text === null || text === undefined) return "—";
  const s = typeof text === "string" ? text : String(text);
  return s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (m) => "\\" + m);
}

// Safe truncation for values of unknown runtime type.
function clip(text: unknown, max: number): string {
  if (text === null || text === undefined) return "—";
  const s = typeof text === "string" ? text : String(text);
  return s.length > max ? s.slice(0, max) : s;
}

// ── Event types ───────────────────────────────────────────────────────────────
export type TelegramEvent =
  | { type: "site_open";       traineeId?: string; traineeName?: string }
  | { type: "login";           traineeId: string;  traineeName: string }
  | { type: "logout";          traineeId: string;  traineeName: string }
  | { type: "inactive";        traineeId: string;  traineeName: string }
  | { type: "module_open";     traineeId: string;  traineeName: string; moduleName: string }
  | { type: "quiz_start";      traineeId: string;  traineeName: string; moduleName: string }
  | { type: "quiz_finish";     traineeId: string;  traineeName: string; moduleName: string; score: number; total: number }
  | { type: "chat_message";    traineeId: string;  traineeName: string; preview: string }
  | { type: "module_complete"; traineeId: string;  traineeName: string; moduleName: string }
  | { type: "status_change";   traineeId: string;  traineeName: string; status: "online" | "offline" }
  | { type: "system_warning";  message: string }
  | { type: "admin_alert";     message: string }
  | { type: "test" };

// ── Build message text ─────────────────────────────────────────────────────────
function buildMessage(event: TelegramEvent): string {
  const t = saJeddahTime();

  const header = (emoji: string, title: string) =>
    `${emoji} *${esc(title)}*\n`;
  const row = (label: string, val: unknown) =>
    `▸ *${esc(label)}:* ${esc(val)}\n`;
  const footer = `\n⏱ ${esc(t)} \\| RSAF TLS Trainer`;

  switch (event.type) {
    case "site_open":
      return header("👁", "TRAINEE SITE OPEN") +
        row("Trainee", event.traineeName ?? "Unknown") +
        row("ID", event.traineeId ?? "guest") +
        footer;

    case "login":
      return header("🔓", "TRAINEE LOGIN") +
        row("Name", event.traineeName) +
        row("ID", event.traineeId) +
        footer;

    case "logout":
      return header("🔒", "TRAINEE LOGOUT") +
        row("Name", event.traineeName) +
        row("ID", event.traineeId) +
        footer;

    case "inactive":
      return header("💤", "TRAINEE INACTIVE") +
        row("Name", event.traineeName) +
        row("ID", event.traineeId) +
        row("Status", "No activity detected") +
        footer;

    case "module_open":
      return header("📂", "MODULE OPENED") +
        row("Trainee", event.traineeName) +
        row("ID", event.traineeId) +
        row("Module", event.moduleName) +
        footer;

    case "quiz_start":
      return header("🎯", "QUIZ STARTED") +
        row("Trainee", event.traineeName) +
        row("ID", event.traineeId) +
        row("Module", event.moduleName) +
        footer;

    case "quiz_finish": {
      const score = Number(event.score) || 0;
      const total = Number(event.total) || 0;
      const pct = total > 0 ? Math.round((score / total) * 100) : 0;
      const grade = pct >= 90 ? "EXCELLENT 🏆" : pct >= 70 ? "PASS ✅" : "FAIL ❌";
      return header("📊", "QUIZ COMPLETED") +
        row("Trainee", event.traineeName) +
        row("ID", event.traineeId) +
        row("Module", event.moduleName) +
        row("Score", `${score}/${total} (${pct}%)`) +
        row("Grade", grade) +
        footer;
    }

    case "chat_message":
      return header("💬", "CHAT MESSAGE SENT") +
        row("Trainee", event.traineeName) +
        row("ID", event.traineeId) +
        row("Preview", clip(event.preview, 80)) +
        footer;

    case "module_complete":
      return header("✅", "MODULE COMPLETED") +
        row("Trainee", event.traineeName) +
        row("ID", event.traineeId) +
        row("Module", event.moduleName) +
        footer;

    case "status_change": {
      const online = event.status === "online";
      return header(online ? "🟢" : "🔴", `TRAINEE ${online ? "ONLINE" : "OFFLINE"}`) +
        row("Name", event.traineeName) +
        row("ID", event.traineeId) +
        row("Status", online ? "🟢 Online" : "🔴 Offline") +
        footer;
    }

    case "system_warning":
      return header("⚠️", "SYSTEM WARNING") +
        `${esc(event.message)}\n` +
        footer;

    case "admin_alert":
      return header("🚨", "ADMIN ALERT") +
        `${esc(event.message)}\n` +
        footer;

    case "test":
      return header("🔔", "TEST NOTIFICATION") +
        `TLS Trainer Telegram integration is working\\!\n` +
        footer;

    default:
      return `📡 TLS Trainer event at ${esc(t)}`;
  }
}

// ── Send to Telegram ───────────────────────────────────────────────────────────
export async function sendTelegram(event: TelegramEvent): Promise<{ ok: boolean; error?: string }> {
  if (!_config.enabled)       return { ok: false, error: "Telegram disabled" };
  if (!_config.botToken)      return { ok: false, error: "No bot token configured" };
  if (!_config.chatId)        return { ok: false, error: "No chat ID configured" };

  // Never let a malformed event reject this promise: almost every caller is
  // fire-and-forget (no await, no .catch), so a throw here becomes an
  // unhandled rejection and takes the entire server process down.
  let text: string;
  try {
    text = buildMessage(event);
  } catch (e: any) {
    console.error("[telegram] buildMessage failed:", e?.message, "event:", JSON.stringify(event));
    return { ok: false, error: `buildMessage failed: ${e?.message ?? "unknown"}` };
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${_config.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: _config.chatId,
          text,
          parse_mode: "MarkdownV2",
          disable_web_page_preview: true,
        }),
      }
    );
    const json = await res.json() as { ok: boolean; description?: string };
    if (!json.ok) return { ok: false, error: json.description ?? "Telegram API error" };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}
