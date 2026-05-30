import { useState, useEffect } from "react";
import BackButton from "../components/BackButton";
import { getSession } from "../hooks/useTelegramTrack";
import { useSettings } from "../hooks/useSettings";
import { playAlertTone } from "../lib/audio";

const C = {
  navy:  "#071426",
  cyan:  "#00AEEF",
  blue:  "#35D4FF",
  green: "#00D26A",
  red:   "#FF4D4D",
  gold:  "#C9A66B",
};

// ── Toggle ──────────────────────────────────────────────────────────────────
function Toggle({ on, onChange, disabled = false }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onChange}
      aria-checked={on}
      role="switch"
      style={{
        width: 46, height: 26, borderRadius: 13, border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "rgba(255,255,255,0.06)" : on ? C.cyan : "rgba(255,255,255,0.1)",
        position: "relative", transition: "background 0.25s", flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: on ? 23 : 3,
        width: 20, height: 20, borderRadius: "50%",
        background: disabled ? "rgba(255,255,255,0.3)" : on ? C.navy : "rgba(255,255,255,0.5)",
        transition: "left 0.25s, background 0.25s",
        display: "block",
      }} />
    </button>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{
        fontFamily: "Orbitron", fontSize: 11, letterSpacing: "0.14em",
        color: "rgba(255,255,255,0.35)", margin: "0 0 12px", textTransform: "uppercase",
      }}>{title}</h2>
      <div style={{
        background: "rgba(28,38,51,0.5)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, overflow: "hidden",
      }}>{children}</div>
    </div>
  );
}

// ── SettingRow ────────────────────────────────────────────────────────────────
function SettingRow({ label, desc, children, last = false }: {
  label: string; desc?: string; children: React.ReactNode; last?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16, padding: "15px 18px",
      borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.05)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{label}</span>
        {desc && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

// ── SaveBanner ────────────────────────────────────────────────────────────────
function SaveBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={{
      background: "rgba(0,210,106,0.12)", border: "1px solid rgba(0,210,106,0.4)",
      borderRadius: 10, padding: "12px 16px", marginBottom: 20,
      display: "flex", alignItems: "center", gap: 10,
      color: C.green, fontSize: 14, fontWeight: 600, fontFamily: "Rajdhani",
      animation: "fadeIn 0.2s ease",
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Settings saved
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{
      flex: 1, textAlign: "center", padding: "16px 8px",
      background: "rgba(0,174,239,0.06)", borderRadius: 10,
      border: "1px solid rgba(0,174,239,0.12)",
    }}>
      <div style={{ fontFamily: "Orbitron", fontSize: 22, fontWeight: 700, color: C.cyan }}>{value}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4, letterSpacing: "0.08em" }}>{label}</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Settings() {
  const session = getSession();
  const [settings, updateSettings] = useSettings();
  const [saved, setSaved] = useState(false);

  // Profile
  const [profile, setProfile] = useState({
    name: session?.name ?? "",
    rank: session?.rank ?? "",
    unit: session?.unit ?? "",
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  // Notification prefs (localStorage)
  const [notifyQuiz, setNotifyQuiz] = useState(() => localStorage.getItem("tls_notify_quiz") !== "false");
  const [notifyMsg, setNotifyMsg] = useState(() => localStorage.getItem("tls_notify_msg") !== "false");
  const [notifyAchiev, setNotifyAchiev] = useState(() => localStorage.getItem("tls_notify_achiev") !== "false");

  // Daily goal
  const GOALS = [1, 2, 3, 5] as const;
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    const v = parseInt(localStorage.getItem("tls_daily_goal") ?? "3");
    return isNaN(v) ? 3 : v;
  });

  // Stats
  const [stats, setStats] = useState<{
    totalXp: number; streak: number; quizzesPassed: number; avgScore: number; loaded: boolean;
  }>({ totalXp: 0, streak: 0, quizzesPassed: 0, avgScore: 0, loaded: false });

  // Change PIN
  const [pin, setPin] = useState({ current: "", next: "", confirm: "" });
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);
  const [pinSaving, setPinSaving] = useState(false);

  // Theme
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("tls_theme");
    return stored !== "light";
  });

  // Apply theme on mount + on change
  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.remove("light-mode");
    } else {
      html.classList.add("light-mode");
    }
    localStorage.setItem("tls_theme", isDark ? "dark" : "light");
  }, [isDark]);

  // Load stats
  useEffect(() => {
    if (!session) return;
    Promise.all([
      fetch(`/api/streaks/${session.id}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/quiz-attempts/${session.id}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([streakData, attemptsData]) => {
      const totalXp = streakData?.totalXp ?? 0;
      const streak = streakData?.currentStreak ?? 0;
      const attempts = Array.isArray(attemptsData) ? attemptsData : [];
      const passed = attempts.filter((a: any) => a.passed).length;
      const scores = attempts.map((a: any) => typeof a.pct === "number" ? a.pct : 0);
      const avg = scores.length ? Math.round(scores.reduce((s: number, v: number) => s + v, 0) / scores.length) : 0;
      setStats({ totalXp, streak, quizzesPassed: passed, avgScore: avg, loaded: true });
    });
  }, [session?.id]);

  function showSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggle(key: keyof typeof settings) {
    updateSettings({ [key]: !settings[key] });
    showSaved();
    if (key === "notificationSound" && !settings.notificationSound) {
      setTimeout(() => playAlertTone("info"), 100);
    }
  }

  function setNotify(key: "quiz" | "msg" | "achiev", val: boolean) {
    if (key === "quiz") { setNotifyQuiz(val); localStorage.setItem("tls_notify_quiz", String(val)); }
    if (key === "msg")  { setNotifyMsg(val);  localStorage.setItem("tls_notify_msg",  String(val)); }
    if (key === "achiev") { setNotifyAchiev(val); localStorage.setItem("tls_notify_achiev", String(val)); }
    showSaved();
  }

  function setGoal(g: number) {
    setDailyGoal(g);
    localStorage.setItem("tls_daily_goal", String(g));
    showSaved();
  }

  async function saveProfile() {
    if (!session) return;
    setProfileSaving(true);
    try {
      await fetch("/api/trainee/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, name: profile.name, rank: profile.rank, unit: profile.unit }),
      });
      const s = { ...session, name: profile.name, rank: profile.rank, unit: profile.unit };
      localStorage.setItem("tls_trainee_session", JSON.stringify(s));
      window.dispatchEvent(new Event("storage"));
    } catch { /* best effort */ }
    setProfileSaving(false);
    setEditingProfile(false);
    showSaved();
  }

  async function changePin() {
    if (!session) return;
    setPinError("");
    setPinSuccess(false);
    if (!pin.current || !pin.next || !pin.confirm) { setPinError("All fields are required."); return; }
    if (pin.next !== pin.confirm) { setPinError("New PIN and confirmation do not match."); return; }
    if (pin.next.length < 4) { setPinError("PIN must be at least 4 digits."); return; }

    setPinSaving(true);
    try {
      // Verify current PIN
      const verifyRes = await fetch("/api/trainee/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, pin: pin.current }),
      });
      if (!verifyRes.ok) { setPinError("Current PIN is incorrect."); setPinSaving(false); return; }

      // Update PIN
      const updateRes = await fetch("/api/trainee/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, pin: pin.next }),
      });
      if (!updateRes.ok) { setPinError("Failed to update PIN. Try again."); setPinSaving(false); return; }

      setPin({ current: "", next: "", confirm: "" });
      setPinSuccess(true);
      setTimeout(() => setPinSuccess(false), 3000);
    } catch { setPinError("Network error. Try again."); }
    setPinSaving(false);
  }

  if (!session) {
    return (
      <div style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${C.navy} 0%, #050d1a 60%, #0a1628 100%)`,
        paddingTop: 80, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Rajdhani, sans-serif",
      }}>
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "0 32px" }}>
          <div style={{ fontFamily: "Orbitron", fontSize: 14, marginBottom: 8, color: C.cyan }}>LOGIN REQUIRED</div>
          <div style={{ fontSize: 14 }}>Please log in to access settings.</div>
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(0,174,239,0.3)",
    borderRadius: 8, padding: "10px 14px",
    color: "#fff", fontSize: 14, fontFamily: "Rajdhani",
    outline: "none",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${C.navy} 0%, #050d1a 60%, #0a1628 100%)`,
      paddingTop: 68, paddingBottom: 60,
      fontFamily: "Rajdhani, sans-serif",
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        .pin-input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 14 }}><BackButton to="/" /></div>
          <h1 style={{ fontFamily: "Orbitron", fontSize: 20, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "0.06em" }}>
            SETTINGS
          </h1>
        </div>

        <SaveBanner visible={saved} />

        {/* ── Profile ───────────────────────────────────────────────── */}
        <Section title="Profile">
          {!editingProfile ? (
            <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                background: `linear-gradient(135deg, ${C.cyan}, ${C.blue})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Orbitron", fontSize: 16, fontWeight: 700, color: C.navy,
              }}>
                {session.name.trim().split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{session.name}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                  {[session.rank, session.unit].filter(Boolean).join(" · ") || "No rank/unit set"}
                </div>
              </div>
              <button
                onClick={() => setEditingProfile(true)}
                style={{
                  background: "rgba(0,174,239,0.1)", border: "1px solid rgba(0,174,239,0.3)",
                  borderRadius: 8, padding: "7px 14px",
                  color: C.cyan, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "Rajdhani",
                }}
              >Edit</button>
            </div>
          ) : (
            <div style={{ padding: "16px 18px" }}>
              {([
                { label: "Name", key: "name" as const },
                { label: "Rank", key: "rank" as const },
                { label: "Unit", key: "unit" as const },
              ] as const).map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 4, letterSpacing: "0.1em", fontFamily: "Orbitron" }}>
                    {f.label.toUpperCase()}
                  </div>
                  <input
                    value={profile[f.key]}
                    onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={saveProfile} disabled={profileSaving} style={{
                  flex: 1, padding: "10px",
                  background: "rgba(0,210,106,0.15)", border: "1px solid rgba(0,210,106,0.4)",
                  borderRadius: 8, color: C.green, fontSize: 14, fontWeight: 600,
                  cursor: "pointer", fontFamily: "Rajdhani", opacity: profileSaving ? 0.6 : 1,
                }}>{profileSaving ? "Saving…" : "Save Profile"}</button>
                <button
                  onClick={() => { setEditingProfile(false); setProfile({ name: session.name, rank: session.rank ?? "", unit: session.unit ?? "" }); }}
                  style={{
                    padding: "10px 16px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: 600,
                    cursor: "pointer", fontFamily: "Rajdhani",
                  }}
                >Cancel</button>
              </div>
            </div>
          )}
        </Section>

        {/* ── Notification Preferences ──────────────────────────────── */}
        <Section title="Notification Preferences">
          <SettingRow label="Quiz Results" desc="Notify when a quiz is graded">
            <Toggle on={notifyQuiz} onChange={() => setNotify("quiz", !notifyQuiz)} />
          </SettingRow>
          <SettingRow label="Messages" desc="Notify on new instructor messages">
            <Toggle on={notifyMsg} onChange={() => setNotify("msg", !notifyMsg)} />
          </SettingRow>
          <SettingRow label="Achievements" desc="Notify when you earn a badge or level up" last>
            <Toggle on={notifyAchiev} onChange={() => setNotify("achiev", !notifyAchiev)} />
          </SettingRow>
        </Section>

        {/* ── Daily Training Goal ───────────────────────────────────── */}
        <Section title="Daily Training Goal">
          <div style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>
              Modules to complete per day
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {GOALS.map(g => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  style={{
                    flex: 1, padding: "10px 0",
                    borderRadius: 10,
                    border: `1px solid ${dailyGoal === g ? C.cyan : "rgba(255,255,255,0.1)"}`,
                    background: dailyGoal === g ? `${C.cyan}22` : "rgba(255,255,255,0.03)",
                    color: dailyGoal === g ? C.cyan : "rgba(255,255,255,0.45)",
                    fontFamily: "Orbitron", fontSize: 14, fontWeight: 700,
                    cursor: "pointer", transition: "all 0.18s",
                  }}
                >{g}</button>
              ))}
            </div>
          </div>
        </Section>

        {/* ── My Statistics ─────────────────────────────────────────── */}
        <Section title="My Statistics">
          <div style={{ padding: "16px 18px" }}>
            {!stats.loaded ? (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "8px 0" }}>Loading…</div>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <StatCard value={stats.totalXp.toLocaleString()} label="TOTAL XP" />
                <StatCard value={stats.streak} label="DAY STREAK" />
                <StatCard value={stats.quizzesPassed} label="QUIZZES PASSED" />
                <StatCard value={`${stats.avgScore}%`} label="AVG SCORE" />
              </div>
            )}
          </div>
        </Section>

        {/* ── Sound & Alerts ────────────────────────────────────────── */}
        <Section title="Sound & Alerts">
          <SettingRow label="Sound Effects" desc="Play sounds on quiz answers and achievements">
            <Toggle on={settings.soundEffects} onChange={() => toggle("soundEffects")} />
          </SettingRow>
          <SettingRow label="Notification Sound" desc="Play a tone when the instructor sends an alert">
            <Toggle on={settings.notificationSound} onChange={() => toggle("notificationSound")} />
          </SettingRow>
          <SettingRow label="Vibration" desc="Vibrate device on incoming alerts (mobile only)" last>
            <Toggle on={settings.notificationVibrate} onChange={() => toggle("notificationVibrate")} />
          </SettingRow>
        </Section>

        {/* ── Change PIN ────────────────────────────────────────────── */}
        <Section title="Change PIN">
          <div style={{ padding: "16px 18px" }}>
            {pinError && (
              <div style={{
                background: "rgba(255,77,77,0.1)", border: "1px solid rgba(255,77,77,0.3)",
                borderRadius: 8, padding: "10px 14px", marginBottom: 12,
                color: C.red, fontSize: 13, fontWeight: 600,
              }}>{pinError}</div>
            )}
            {pinSuccess && (
              <div style={{
                background: "rgba(0,210,106,0.1)", border: "1px solid rgba(0,210,106,0.35)",
                borderRadius: 8, padding: "10px 14px", marginBottom: 12,
                color: C.green, fontSize: 13, fontWeight: 600,
              }}>PIN updated successfully.</div>
            )}
            {[
              { label: "CURRENT PIN", key: "current" as const, placeholder: "Enter current PIN" },
              { label: "NEW PIN",     key: "next"    as const, placeholder: "Enter new PIN" },
              { label: "CONFIRM PIN", key: "confirm" as const, placeholder: "Repeat new PIN" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 4, letterSpacing: "0.1em", fontFamily: "Orbitron" }}>
                  {f.label}
                </div>
                <input
                  type="password"
                  className="pin-input"
                  inputMode="numeric"
                  placeholder={f.placeholder}
                  value={pin[f.key]}
                  onChange={e => setPin(p => ({ ...p, [f.key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
            <button
              onClick={changePin}
              disabled={pinSaving}
              style={{
                width: "100%", padding: "11px",
                background: "rgba(0,174,239,0.12)", border: "1px solid rgba(0,174,239,0.35)",
                borderRadius: 8, color: C.cyan, fontSize: 14, fontWeight: 600,
                cursor: pinSaving ? "not-allowed" : "pointer", fontFamily: "Rajdhani",
                opacity: pinSaving ? 0.6 : 1, marginTop: 4,
              }}
            >{pinSaving ? "Updating…" : "Update PIN"}</button>
          </div>
        </Section>

        {/* ── Theme ─────────────────────────────────────────────────── */}
        <Section title="Theme">
          <SettingRow label={isDark ? "Dark Mode" : "Light Mode"} desc="Switch between dark and light appearance" last>
            <Toggle on={isDark} onChange={() => setIsDark(d => !d)} />
          </SettingRow>
        </Section>

        {/* Footer */}
        <div style={{
          textAlign: "center", color: "rgba(255,255,255,0.15)",
          fontSize: 11, fontFamily: "Orbitron", letterSpacing: "0.1em", marginTop: 8,
        }}>
          TLS TRAINER · v2.1.0
        </div>

      </div>
    </div>
  );
}
