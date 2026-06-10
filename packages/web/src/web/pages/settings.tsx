import { useState, useEffect, useRef } from "react";
import BackButton from "../components/BackButton";
import { getSession } from "../hooks/useTelegramTrack";
import { useSettings } from "../hooks/useSettings";
import { useLanguage } from "../hooks/useLanguage";
import { playAlertTone } from "../lib/audio";

const C = {
  navy:  "#071426",
  cyan:  "#00AEEF",
  blue:  "#35D4FF",
  green: "#00D26A",
  red:   "#FF4D4D",
  gold:  "#C9A66B",
  dim:   "rgba(255,255,255,0.35)",
};

function Toggle({ on, onChange, disabled = false }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button onClick={disabled ? undefined : onChange} aria-checked={on} role="switch" style={{
      width: 46, height: 26, borderRadius: 13, border: "none",
      cursor: disabled ? "not-allowed" : "pointer",
      background: disabled ? "rgba(255,255,255,0.06)" : on ? C.cyan : "rgba(255,255,255,0.1)",
      position: "relative", transition: "background 0.25s", flexShrink: 0,
      opacity: disabled ? 0.4 : 1,
    }}>
      <span style={{
        position: "absolute", top: 3, left: on ? 23 : 3,
        width: 20, height: 20, borderRadius: "50%",
        background: disabled ? "rgba(255,255,255,0.3)" : on ? C.navy : "rgba(255,255,255,0.5)",
        transition: "left 0.25s, background 0.25s", display: "block",
      }} />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{
        fontFamily: "Orbitron", fontSize: 10, letterSpacing: "0.18em",
        color: "rgba(0,174,239,0.5)", margin: "0 0 10px", textTransform: "uppercase",
      }}>{title}</h2>
      <div style={{
        background: "rgba(7,20,38,0.8)", border: "1px solid rgba(0,174,239,0.12)",
        borderRadius: 14, overflow: "hidden",
      }}>{children}</div>
    </div>
  );
}

function SettingRow({ label, desc, children, last = false }: {
  label: string; desc?: string; children: React.ReactNode; last?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16, padding: "14px 18px",
      borderBottom: last ? "none" : "1px solid rgba(0,174,239,0.07)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: "Rajdhani, sans-serif" }}>{label}</span>
        {desc && <div style={{ fontSize: 11, color: C.dim, marginTop: 2, fontFamily: "Rajdhani" }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function StatCard({ value, label, color = C.cyan }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={{
      flex: 1, textAlign: "center", padding: "14px 6px",
      background: "rgba(0,174,239,0.05)", borderRadius: 10,
      border: `1px solid ${color}22`,
    }}>
      <div style={{ fontFamily: "Orbitron", fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 9, color: C.dim, marginTop: 4, letterSpacing: "0.08em", fontFamily: "Orbitron" }}>{label}</div>
    </div>
  );
}

// ── Compress image to target size ─────────────────────────────────────────────
function compressImage(file: File, maxSize = 180): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Settings() {
  const session = getSession();
  const [settings, updateSettings] = useSettings();
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Profile
  const [profile, setProfile] = useState({
    name: session?.name ?? "",
    rank: session?.rank ?? "",
    unit: session?.unit ?? "",
    years_of_service: "",
    air_base: "",
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const { t } = useLanguage();
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarPending, setAvatarPending] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Notification prefs
  const [notifyQuiz, setNotifyQuiz]     = useState(() => localStorage.getItem("tls_notify_quiz")   !== "false");
  const [notifyMsg,  setNotifyMsg2]     = useState(() => localStorage.getItem("tls_notify_msg")    !== "false");
  const [notifyAchiev, setNotifyAchiev] = useState(() => localStorage.getItem("tls_notify_achiev") !== "false");

  // Stats
  const [stats, setStats] = useState<{
    totalXp: number; streak: number; quizzesPassed: number; avgScore: number;
    level: number; loaded: boolean;
  }>({ totalXp: 0, streak: 0, quizzesPassed: 0, avgScore: 0, level: 1, loaded: false });

  // PIN
  const [pin, setPin] = useState({ current: "", next: "", confirm: "" });
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);
  const [pinSaving, setPinSaving] = useState(false);

  // Theme always dark

  // Load profile data (avatar + extra fields)
  useEffect(() => {
    if (!session) return;
    fetch(`/api/trainee/me/${session.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setAvatar(data.avatar ?? null);
        setAvatarPending(data.avatar_pending ?? null);
        setProfile(p => ({
          ...p,
          name: data.name ?? p.name,
          rank: data.rank ?? p.rank,
          unit: data.unit ?? p.unit,
          years_of_service: data.years_of_service != null ? String(data.years_of_service) : "",
          air_base: data.air_base ?? "",
        }));
      })
      .catch(() => {});
  }, [session?.id]);

  // Load stats
  useEffect(() => {
    if (!session) return;
    Promise.all([
      fetch(`/api/streaks/${session.id}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/quiz-attempts/${session.id}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([streakData, attemptsData]) => {
      const totalXp = streakData?.totalXp ?? 0;
      const streak  = streakData?.currentStreak ?? 0;
      const level   = Math.floor(totalXp / 500) + 1;
      const attempts = Array.isArray(attemptsData) ? attemptsData : [];
      const passed   = attempts.filter((a: any) => a.passed).length;
      const scores   = attempts.map((a: any) => typeof a.pct === "number" ? a.pct : 0);
      const avg      = scores.length ? Math.round(scores.reduce((s: number, v: number) => s + v, 0) / scores.length) : 0;
      setStats({ totalXp, streak, quizzesPassed: passed, avgScore: avg, level, loaded: true });
    });
  }, [session?.id]);

  function showSaved() { setSaved(true); setTimeout(() => setSaved(false), 2200); }

  function toggle(key: keyof typeof settings) {
    updateSettings({ [key]: !settings[key] });
    showSaved();
    if (key === "notificationSound" && !settings.notificationSound) setTimeout(() => playAlertTone("info"), 100);
  }

  function setNotify(key: "quiz" | "msg" | "achiev", val: boolean) {
    if (key === "quiz")   { setNotifyQuiz(val);    localStorage.setItem("tls_notify_quiz",   String(val)); }
    if (key === "msg")    { setNotifyMsg2(val);     localStorage.setItem("tls_notify_msg",    String(val)); }
    if (key === "achiev") { setNotifyAchiev(val);   localStorage.setItem("tls_notify_achiev", String(val)); }
    showSaved();
  }

  async function saveProfile() {
    if (!session) return;
    setProfileSaving(true);
    try {
      await fetch("/api/trainee/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: session.id,
          name: profile.name,
          rank: profile.rank,
          unit: profile.unit,
          years_of_service: profile.years_of_service ? parseInt(profile.years_of_service) : null,
          air_base: profile.air_base,
        }),
      });
      const s = { ...session, name: profile.name, rank: profile.rank, unit: profile.unit };
      localStorage.setItem("tls_trainee_session", JSON.stringify(s));
      window.dispatchEvent(new Event("storage"));
    } catch { /* best effort */ }
    setProfileSaving(false);
    setEditingProfile(false);
    showSaved();
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    e.target.value = "";
    setAvatarUploading(true);
    setAvatarMsg(null);
    try {
      const compressed = await compressImage(file, 180);
      const res = await fetch("/api/trainee/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, image: compressed }),
      });
      if (res.ok) {
        setAvatarPending(compressed);
        setAvatarMsg({ ok: true, text: "Uploaded — pending trainer approval" });
      } else {
        const err = await res.json().catch(() => ({})) as any;
        setAvatarMsg({ ok: false, text: err.error ?? "Upload failed" });
      }
    } catch {
      setAvatarMsg({ ok: false, text: "Network error" });
    }
    setAvatarUploading(false);
  }

  async function changePin() {
    if (!session) return;
    setPinError(""); setPinSuccess(false);
    if (!pin.current || !pin.next || !pin.confirm) { setPinError("All fields are required"); return; }
    if (pin.next !== pin.confirm) { setPinError("New PIN does not match confirmation"); return; }
    if (pin.next.length < 4) { setPinError("PIN must be at least 4 digits"); return; }
    setPinSaving(true);
    try {
      const verifyRes = await fetch("/api/trainee/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, pin: pin.current }),
      });
      if (!verifyRes.ok) { setPinError("Current PIN is incorrect"); setPinSaving(false); return; }
      const updateRes = await fetch("/api/trainee/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, pin: pin.next }),
      });
      if (!updateRes.ok) { setPinError("Update failed, please try again"); setPinSaving(false); return; }
      setPin({ current: "", next: "", confirm: "" });
      setPinSuccess(true);
      setTimeout(() => setPinSuccess(false), 3000);
    } catch { setPinError("Network error, please try again"); }
    setPinSaving(false);
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${C.navy} 0%, #050d1a 60%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: C.dim }}>
          <div style={{ fontFamily: "Orbitron", fontSize: 13, color: C.cyan, marginBottom: 8 }}>LOGIN REQUIRED</div>
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(0,174,239,0.05)", border: "1px solid rgba(0,174,239,0.25)",
    borderRadius: 8, padding: "10px 14px", color: "#fff",
    fontSize: 14, fontFamily: "Rajdhani", outline: "none",
  };

  const initials = session.name.trim().split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const xpNext = stats.level * 500;
  const xpProgress = Math.min(100, Math.round((stats.totalXp % 500) / 500 * 100));

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${C.navy} 0%, #050d1a 60%, #071426 100%)`,
      paddingTop: 68, paddingBottom: 80,
      fontFamily: "Rajdhani, sans-serif",
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        .pin-input::placeholder { color: rgba(255,255,255,0.2); }
        .field-input:focus { border-color: rgba(0,174,239,0.5) !important; background: rgba(0,174,239,0.08) !important; }
      `}</style>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px" }}>

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ marginBottom: 12 }}><BackButton to="/" /></div>
          <div style={{ fontSize: 9, fontFamily: "Orbitron", letterSpacing: "0.25em", color: "rgba(0,174,239,0.4)", marginBottom: 4 }}>TRAINEE PORTAL</div>
          <h1 style={{ fontFamily: "Orbitron", fontSize: 20, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "0.06em" }}>
            {t("settings_title")}
          </h1>
        </div>

        {/* Save banner */}
        {saved && (
          <div style={{
            background: "rgba(0,210,106,0.1)", border: "1px solid rgba(0,210,106,0.35)",
            borderRadius: 10, padding: "11px 16px", marginBottom: 18,
            display: "flex", alignItems: "center", gap: 10,
            color: C.green, fontSize: 13, fontWeight: 600, fontFamily: "Rajdhani",
            animation: "fadeIn 0.2s ease",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Saved
          </div>
        )}


        {/* ── PROFILE CARD ─────────────────────────────────────────── */}
        <div style={{
          marginBottom: 24,
          background: "linear-gradient(135deg, rgba(0,174,239,0.08) 0%, rgba(7,20,38,0.95) 60%)",
          border: "1px solid rgba(0,174,239,0.2)",
          borderRadius: 16, overflow: "hidden",
        }}>
          {/* Top stripe */}
          <div style={{ height: 3, background: `linear-gradient(90deg, ${C.cyan}, transparent)` }} />

          <div style={{ padding: "20px 18px" }}>
            <div style={{ fontSize: 9, fontFamily: "Orbitron", letterSpacing: "0.2em", color: "rgba(0,174,239,0.45)", marginBottom: 14 }}>
              IDENTIFICATION · PROFILE
            </div>

            {/* Avatar + name row */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
              {/* Avatar */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%",
                  border: `2px solid ${avatar ? C.cyan : "rgba(0,174,239,0.3)"}`,
                  overflow: "hidden", background: "rgba(0,174,239,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {(avatarPending || avatar) ? (
                    <img
                      src={avatarPending ?? avatar ?? ""}
                      alt="avatar"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span style={{ fontFamily: "Orbitron", fontSize: 22, fontWeight: 700, color: C.cyan }}>
                      {initials}
                    </span>
                  )}
                </div>
                {/* Upload button */}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarUploading}
                  style={{
                    position: "absolute", bottom: -2, right: -2,
                    width: 24, height: 24, borderRadius: "50%",
                    background: C.cyan, border: "2px solid #071426",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: avatarUploading ? "not-allowed" : "pointer",
                    opacity: avatarUploading ? 0.6 : 1,
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#071426" strokeWidth="3">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
              </div>

              {/* Name + rank */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 3 }}>{session.name}</div>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>
                  {[session.rank, session.unit].filter(Boolean).join(" · ") || "—"}
                </div>
                {/* Level badge */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,174,239,0.1)", border: "1px solid rgba(0,174,239,0.25)", borderRadius: 20, padding: "3px 10px" }}>
                  <span style={{ fontFamily: "Orbitron", fontSize: 10, color: C.cyan, fontWeight: 700 }}>LVL {stats.level}</span>
                  <span style={{ fontSize: 10, color: C.dim }}>· {stats.totalXp} XP</span>
                </div>
              </div>
            </div>

            {/* XP Progress bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: C.dim, fontFamily: "Orbitron" }}>XP TO LEVEL {stats.level + 1}</span>
                <span style={{ fontSize: 10, color: C.cyan, fontFamily: "Orbitron" }}>{stats.totalXp % 500}/{xpNext % 500 || 500}</span>
              </div>
              <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${xpProgress}%`,
                  background: `linear-gradient(90deg, ${C.cyan}, ${C.blue})`,
                  borderRadius: 3, transition: "width 0.6s ease",
                }} />
              </div>
            </div>

            {/* Avatar status */}
            {avatarPending && !avatar && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
                background: "rgba(201,166,107,0.08)", border: "1px solid rgba(201,166,107,0.3)",
                borderRadius: 8, padding: "8px 12px",
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold, animation: "pulse 1.4s infinite" }} />
                <span style={{ fontSize: 12, color: C.gold }}>Profile picture pending trainer approval</span>
              </div>
            )}
            {avatarMsg && (
              <div style={{
                marginBottom: 14, padding: "8px 12px", borderRadius: 8, fontSize: 12,
                background: avatarMsg.ok ? "rgba(0,210,106,0.08)" : "rgba(255,77,77,0.08)",
                border: `1px solid ${avatarMsg.ok ? "rgba(0,210,106,0.3)" : "rgba(255,77,77,0.3)"}`,
                color: avatarMsg.ok ? C.green : C.red,
                animation: "fadeIn 0.2s ease",
              }}>{avatarMsg.text}</div>
            )}

            {/* Edit / View mode */}
            {!editingProfile ? (
              <div>
                {/* Info grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[
                    { label: "Rank", value: profile.rank || "—" },
                    { label: "Air Base", value: profile.air_base || "—" },
                    { label: "Unit", value: profile.unit || "—" },
                    { label: "Years of Service", value: profile.years_of_service ? `${profile.years_of_service} yr` : "—" },
                  ].map(item => (
                    <div key={item.label} style={{ background: "rgba(0,174,239,0.04)", border: "1px solid rgba(0,174,239,0.1)", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 9, color: "rgba(0,174,239,0.5)", fontFamily: "Orbitron", letterSpacing: "0.12em", marginBottom: 4 }}>{item.label.toUpperCase()}</div>
                      <div style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setEditingProfile(true)} style={{
                  width: "100%", padding: "10px",
                  background: "rgba(0,174,239,0.08)", border: "1px solid rgba(0,174,239,0.3)",
                  borderRadius: 9, color: C.cyan, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "Rajdhani", letterSpacing: "0.05em",
                }}>Edit Profile</button>
              </div>
            ) : (
              <div>
                {([
                  { label: "Full Name", key: "name" as const, type: "text" },
                  { label: "Rank", key: "rank" as const, type: "text" },
                  { label: "Unit", key: "unit" as const, type: "text" },
                  { label: "Air Base", key: "air_base" as const, type: "text" },
                  { label: "Years of Service", key: "years_of_service" as const, type: "number" },
                ] as const).map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: "rgba(0,174,239,0.5)", marginBottom: 5, letterSpacing: "0.12em", fontFamily: "Orbitron" }}>
                      {f.label.toUpperCase()}
                    </div>
                    <input
                      type={f.type}
                      className="field-input"
                      value={profile[f.key]}
                      onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ ...inputStyle, transition: "border-color 0.2s, background 0.2s" }}
                    />
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  <button onClick={saveProfile} disabled={profileSaving} style={{
                    flex: 1, padding: "10px",
                    background: "rgba(0,210,106,0.12)", border: "1px solid rgba(0,210,106,0.35)",
                    borderRadius: 9, color: C.green, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "Rajdhani", opacity: profileSaving ? 0.6 : 1,
                  }}>{profileSaving ? "Saving..." : "Save Profile"}</button>
                  <button onClick={() => setEditingProfile(false)} style={{
                    padding: "10px 16px",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 9, color: C.dim, fontSize: 13,
                    cursor: "pointer", fontFamily: "Rajdhani",
                  }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── MY STATISTICS ────────────────────────────────────────── */}
        <Section title={t("profile_section")}>
          <div style={{ padding: "16px 14px" }}>
            {!stats.loaded ? (
              <div style={{ textAlign: "center", color: C.dim, fontSize: 13, padding: "8px 0" }}>Loading...</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <StatCard value={stats.totalXp >= 1000 ? `${(stats.totalXp/1000).toFixed(1)}k` : stats.totalXp} label="TOTAL XP" color={C.gold} />
                  <StatCard value={stats.streak} label="STREAK" color={C.cyan} />
                  <StatCard value={stats.quizzesPassed} label="PASSED" color={C.green} />
                  <StatCard value={`${stats.avgScore}%`} label="AVG" color={C.blue} />
                </div>
                <button
                  onClick={() => window.location.href = '/quiz-history'}
                  style={{
                    width: "100%", marginTop: 12, padding: "10px 16px",
                    background: "rgba(0,174,239,0.07)",
                    border: "1px solid rgba(0,174,239,0.25)", borderRadius: 10,
                    color: "#00AEEF", fontFamily: "Inter", fontSize: 11,
                    letterSpacing: "0.08em", cursor: "pointer", textAlign: "left" as const,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  <span>📋 View Full Quiz History</span>
                  <span style={{ opacity: 0.6 }}>→</span>
                </button>
              </>
            )}
          </div>
        </Section>

        {/* ── NOTIFICATIONS ────────────────────────────────────────── */}
        <Section title={t("notification_sound")}>
          <SettingRow label="Quiz Results" desc="Notify when quiz is graded">
            <Toggle on={notifyQuiz} onChange={() => setNotify("quiz", !notifyQuiz)} />
          </SettingRow>
          <SettingRow label="Messages" desc="Notify when trainer sends a message">
            <Toggle on={notifyMsg} onChange={() => setNotify("msg", !notifyMsg)} />
          </SettingRow>
          <SettingRow label="Achievements" desc="Notify when a badge is earned or level up" last>
            <Toggle on={notifyAchiev} onChange={() => setNotify("achiev", !notifyAchiev)} />
          </SettingRow>
        </Section>

        {/* ── SOUND ────────────────────────────────────────────────── */}
        <Section title={t("sound_section")}>
          <SettingRow label="App Sounds" desc="Sound effects for quiz answers and achievements">
            <Toggle on={settings.soundEffects} onChange={() => toggle("soundEffects")} />
          </SettingRow>
          <SettingRow label="Notification Sound" desc="Alert sound when trainer sends a notification" last>
            <Toggle on={settings.notificationSound} onChange={() => toggle("notificationSound")} />
          </SettingRow>
        </Section>

        {/* ── CHANGE PIN ───────────────────────────────────────────── */}
        <Section title="Change PIN">
          <div style={{ padding: "16px 18px" }}>
            {pinError && (
              <div style={{ background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: C.red, fontSize: 13 }}>
                {pinError}
              </div>
            )}
            {pinSuccess && (
              <div style={{ background: "rgba(0,210,106,0.08)", border: "1px solid rgba(0,210,106,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: C.green, fontSize: 13 }}>
                PIN updated successfully
              </div>
            )}
            {([
              { label: "Current PIN", key: "current" as const, placeholder: "Enter current PIN" },
              { label: "New PIN", key: "next" as const, placeholder: "Enter new PIN" },
              { label: "Confirm New PIN", key: "confirm" as const, placeholder: "Re-enter new PIN" },
            ] as const).map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: "rgba(0,174,239,0.5)", marginBottom: 5, letterSpacing: "0.12em", fontFamily: "Orbitron" }}>
                  {f.label.toUpperCase()}
                </div>
                <input
                  type="password" className="pin-input field-input" inputMode="numeric"
                  placeholder={f.placeholder} value={pin[f.key]}
                  onChange={e => setPin(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ ...inputStyle, transition: "border-color 0.2s, background 0.2s" }}
                />
              </div>
            ))}
            <button onClick={changePin} disabled={pinSaving} style={{
              width: "100%", padding: "11px",
              background: "rgba(0,174,239,0.1)", border: "1px solid rgba(0,174,239,0.3)",
              borderRadius: 9, color: C.cyan, fontSize: 14, fontWeight: 600,
              cursor: pinSaving ? "not-allowed" : "pointer", fontFamily: "Rajdhani",
              opacity: pinSaving ? 0.6 : 1, marginTop: 4,
            }}>{pinSaving ? "Updating..." : "Update PIN"}</button>
          </div>
        </Section>



        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.1)", fontSize: 10, fontFamily: "Orbitron", letterSpacing: "0.12em", marginTop: 8 }}>
          TLS TRAINER · v2.1.0
        </div>
      </div>
    </div>
  );
}
