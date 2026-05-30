// ── Telegram event tracking ───────────────────────────────────────────────────
// Reads trainee identity from localStorage session. Falls back gracefully if not logged in.

export const SESSION_KEY = "tls_trainee_session";

export interface TraineeSession {
  id: string;
  name: string;
  rank?: string | null;
  unit?: string | null;
}

export function getSession(): TraineeSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TraineeSession;
  } catch {
    return null;
  }
}

export function setSession(s: TraineeSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getIds(): { userId: string; traineeName: string } {
  const s = getSession();
  return {
    userId: s?.id ?? "unknown",
    traineeName: s?.name ?? "Unknown Trainee",
  };
}

async function track(payload: Record<string, unknown>) {
  // Suppress all tracking when viewed inside the admin panel
  if (sessionStorage.getItem("tls_admin_mode")) return;
  try {
    const ids = getIds();
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ids, ...payload }),
    });
  } catch {
    // Fire-and-forget
  }
}

export const telegramTrack = {
  siteOpen:       ()                                     => track({ type: "site_open" }),
  login:          ()                                     => track({ type: "login" }),
  logout:         ()                                     => track({ type: "logout" }),
  inactive:       ()                                     => track({ type: "inactive" }),
  moduleOpen:     (moduleName: string)                   => track({ type: "module_open", moduleName }),
  quizStart:      (moduleName: string)                   => track({ type: "quiz_start", moduleName }),
  quizFinish:     (moduleName: string, score: number, total: number) =>
                                                           track({ type: "quiz_finish", moduleName, score, total }),
  moduleComplete: (moduleName: string)                   => track({ type: "module_complete", moduleName }),
  goOffline:      ()                                     => track({ type: "status_change_offline" }),
  warning:        (message: string)                      => track({ type: "system_warning", preview: message }),
};
