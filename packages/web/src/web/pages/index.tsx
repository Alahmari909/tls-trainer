import { Link, useLocation } from "wouter";
import { useEffect, useState, useRef, useCallback } from "react";
import { getSession, setSession, clearSession } from "../hooks/useTelegramTrack";
import type { TraineeSession } from "../hooks/useTelegramTrack";
import { unlockAudio, playAlertTone, vibrate, showToast } from "../lib/audio";
import { useLanguage } from "../hooks/useLanguage";

type Module = { id: number; title: string; order: number };
type ProgressRow = { moduleId: number; progress: number; completed: number };
type Streak = { currentStreak: number; longestStreak: number; totalXp: number };
type TraineeListItem = { id: string; name: string; rank: string | null; unit: string | null; created_at: number };
type Notification = { id: number; message?: string; text?: string; alert_type?: string; sender_role?: string; read: number; ts: number };

const COLORS = ["#00AEEF","#35D4FF","#00D26A","#FFD166","#00AEEF","#35D4FF","#C9A66B","#00D26A","#FF4D4D"];

/* ── Radar rings decoration ── */
function RadarRings() {
  return (
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%,-50%)",
      width: 320, height: 320, pointerEvents: "none",
    }}>
      {[1,2,3].map(n => (
        <div key={n} style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: `1px solid rgba(0,174,239,${0.18 - n * 0.04})`,
          animation: `radar-ring ${2.5 + n * 0.6}s ease-in-out infinite`,
          animationDelay: `${n * 0.4}s`,
          transform: `scale(${0.3 + n * 0.22})`,
        }} />
      ))}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: "50%", height: 1, transformOrigin: "0 50%",
        background: "linear-gradient(90deg, rgba(0,174,239,0.7), transparent)",
        animation: "radar-sweep 3s linear infinite",
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        width: 8, height: 8, borderRadius: "50%",
        background: "#00AEEF", boxShadow: "0 0 10px #00AEEF, 0 0 20px rgba(0,174,239,0.5)",
        animation: "pulse-glow 1.5s ease infinite",
      }} />
    </div>
  );
}

/* ── Live clock ── */
function useLiveClock() {
  const fmt = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const mon = months[now.getMonth()];
    const yr = now.getFullYear();
    let h = now.getHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${day} ${mon} ${yr} · ${String(h).padStart(2,"0")}:${min} ${ampm}`;
  };
  const [clock, setClock] = useState(fmt);
  useEffect(() => {
    const id = setInterval(() => setClock(fmt()), 1000);
    return () => clearInterval(id);
  }, []);
  return clock;
}

/* ── XP bar ── */
function XpBar({ xp }: { xp: number }) {
  const level = Math.floor(xp / 500) + 1;
  const pct = (xp % 500) / 5;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div className="font-orbitron" style={{ fontSize: 9, color: "#FFD166", letterSpacing: "0.1em", flexShrink: 0 }}>LVL {level}</div>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #FFD166, #C9A66B)", borderRadius: 2, transition: "width 0.8s ease" }} />
      </div>
      <div style={{ fontSize: 9, color: "var(--text-muted)", flexShrink: 0 }}>{xp} XP</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LOGIN / REGISTER SCREEN
───────────────────────────────────────────────────────────────────────────── */
function LoginScreen({ onLogin }: { onLogin: (s: TraineeSession) => void }) {
  const [mode, setMode] = useState<"pick" | "register" | "login">("pick");
  const [trainees, setTrainees] = useState<TraineeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Show force-logout reason if set (e.g. blocked while online)
  const [forceLogoutMsg] = useState(() => {
    const msg = sessionStorage.getItem('tls_force_logout_reason');
    if (msg) { sessionStorage.removeItem('tls_force_logout_reason'); return msg; }
    return null;
  });

  // Register form
  const [name, setName] = useState("");
  const [rank, setRank] = useState("");
  const [unit, setUnit] = useState("");
  const [pin, setPin] = useState("");

  // Login (existing trainee pick)
  const [selectedId, setSelectedId] = useState("");
  const [loginPin, setLoginPin] = useState("");

  useEffect(() => {
    if (mode === "login") {
      fetch("/api/trainee/list").then(r => r.json()).then((rows: TraineeListItem[]) => setTrainees(rows)).catch(() => {});
    }
  }, [mode]);

  const doRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockAudio(); // unlock audio on first user gesture
    if (!name.trim()) { setError("Name is required"); return; }
    if (!pin.trim() || !/^\d{4}$/.test(pin.trim())) { setError("PIN must be exactly 4 digits"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/trainee/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), rank: rank.trim() || undefined, unit: unit.trim() || undefined, pin: pin.trim() }),
      });
      const data = await res.json() as { ok: boolean; id?: string; name?: string; rank?: string | null; unit?: string | null; error?: string };
      if (!data.ok || !data.id) { setError(data.error ?? "Registration failed"); return; }
      const session: TraineeSession = { id: data.id, name: data.name!, rank: data.rank, unit: data.unit };
      setSession(session);
      // Track login event (fires Telegram)
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "login", userId: data.id, traineeName: data.name }),
      }).catch(() => {});
      onLogin(session);
    } catch { setError("Connection error"); } finally { setLoading(false); }
  };

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockAudio(); // unlock audio on first user gesture
    if (!selectedId) { setError("Select a trainee"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/trainee/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId, pin: loginPin.trim() || undefined }),
      });
      const data = await res.json() as { ok: boolean; id?: string; name?: string; rank?: string | null; unit?: string | null; error?: string; message?: string };
      if (res.status === 403 && data.error === 'blocked') { setError(data.message ?? 'Your account has been blocked. Contact your instructor.'); return; }
      if (!data.ok || !data.id) { setError(data.error ?? "Login failed"); return; }
      const session: TraineeSession = { id: data.id, name: data.name!, rank: data.rank, unit: data.unit };
      setSession(session);
      // Track login event (fires Telegram)
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "login", userId: data.id, traineeName: data.name }),
      }).catch(() => {});
      onLogin(session);
    } catch { setError("Connection error"); } finally { setLoading(false); }
  };

  return (
    <div className="page" style={{
      background: "var(--bg-primary)",
      minHeight: "100vh",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <style>{`
        @keyframes radar-ring { 0%,100%{opacity:0.4}50%{opacity:0.9} }
        @keyframes radar-sweep { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* Corner brackets */}
      {[{top:16,left:16},{top:16,right:16},{bottom:16,left:16},{bottom:16,right:16}].map((pos,i) => (
        <div key={i} style={{
          position:"fixed",...pos,width:16,height:16,
          borderTop: i<2?"2px solid rgba(0,174,239,0.5)":undefined,
          borderBottom: i>=2?"2px solid rgba(0,174,239,0.5)":undefined,
          borderLeft: (i===0||i===2)?"2px solid rgba(0,174,239,0.5)":undefined,
          borderRight: (i===1||i===3)?"2px solid rgba(0,174,239,0.5)":undefined,
        }} />
      ))}

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div className="font-orbitron" style={{ fontSize: 28, fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>
          TLS TRAINER
        </div>
        <div style={{ fontFamily: "Inter", fontSize: 9, letterSpacing: "0.2em", color: "#00AEEF", marginTop: 4 }}>
          TRANSPONDER LANDING SYSTEM
        </div>
        <div style={{ fontFamily: "Inter", fontSize: 7, letterSpacing: "0.15em", color: "rgba(0,174,239,0.5)", marginTop: 6 }}>
          ◈ GROUND RADAR UNIT · ANPC · JEDDAH ◈
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Force-logout banner (shown when admin blocked an online trainee) */}
        {forceLogoutMsg && (
          <div style={{
            padding: "12px 16px", marginBottom: 16, borderRadius: 10,
            background: "rgba(255,77,77,0.12)", border: "1px solid rgba(255,77,77,0.4)",
            color: "#FF4D4D", fontSize: 12, fontFamily: "Inter, sans-serif", textAlign: "center",
            lineHeight: 1.5,
          }}>
            🚫 {forceLogoutMsg}
          </div>
        )}

        {/* Pick mode */}
        {mode === "pick" && (
          <div className="glass-card" style={{ padding: 24, border: "1px solid rgba(0,174,239,0.25)" }}>
            <div className="font-orbitron" style={{ fontSize: 11, color: "#00AEEF", letterSpacing: "0.15em", textAlign: "center", marginBottom: 24 }}>
              IDENTIFY YOURSELF
            </div>
            <button
              onClick={() => setMode("register")}
              style={{
                width: "100%", padding: "14px 0", marginBottom: 12,
                background: "linear-gradient(135deg, #00AEEF20, #35D4FF15)",
                border: "1px solid #00AEEF60", borderRadius: 10, cursor: "pointer",
                color: "#00AEEF", fontFamily: "Inter", fontSize: 12, letterSpacing: "0.1em",
              }}
            >
              + NEW TRAINEE
            </button>
            <button
              onClick={() => setMode("login")}
              style={{
                width: "100%", padding: "14px 0",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, cursor: "pointer",
                color: "var(--text-secondary)", fontFamily: "Inter", fontSize: 12, letterSpacing: "0.1em",
              }}
            >
              RETURNING TRAINEE
            </button>
          </div>
        )}

        {/* Register */}
        {mode === "register" && (
          <form onSubmit={doRegister} className="glass-card" style={{ padding: 24, border: "1px solid rgba(0,174,239,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <button type="button" onClick={() => { setMode("pick"); setError(""); }}
                style={{ background: "none", border: "none", color: "#00AEEF", cursor: "pointer", padding: 4, fontSize: 18 }}>←</button>
              <div className="font-orbitron" style={{ fontSize: 11, color: "#00AEEF", letterSpacing: "0.15em" }}>NEW TRAINEE</div>
            </div>

            {[
              { label: "FULL NAME *", value: name, set: setName, placeholder: "e.g. Mohammed Al-Qahtani", type: "text" },
              { label: "RANK", value: rank, set: setRank, placeholder: "e.g. SSgt, TSgt, Capt", type: "text" },
              { label: "UNIT / SECTION", value: unit, set: setUnit, placeholder: "e.g. Ground Radar, ANPC", type: "text" },
              { label: "PIN * (4 digits)", value: pin, set: setPin, placeholder: "Enter a 4-digit PIN", type: "password" },
            ].map(field => (
              <div key={field.label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontFamily: "Inter", color: "#00AEEF", letterSpacing: "0.1em", marginBottom: 6 }}>{field.label}</div>
                <input
                  type={field.type}
                  value={field.value}
                  onChange={e => field.set(e.target.value)}
                  placeholder={field.placeholder}
                  style={{
                    width: "100%", padding: "10px 12px", boxSizing: "border-box",
                    background: "rgba(0,0,0,0.3)", border: "1px solid rgba(0,174,239,0.3)",
                    borderRadius: 8, color: "#fff", fontSize: 13,
                    outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>
            ))}

            {error && <div style={{ color: "#FF4D4D", fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</div>}

            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "14px 0", marginTop: 4,
              background: loading ? "rgba(0,174,239,0.2)" : "linear-gradient(135deg, #00AEEF, #35D4FF)",
              border: "none", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer",
              color: "#fff", fontFamily: "Inter", fontSize: 12, letterSpacing: "0.1em",
              fontWeight: 700,
            }}>
              {loading ? "REGISTERING..." : "BEGIN TRAINING"}
            </button>
          </form>
        )}

        {/* Login (pick existing) */}
        {mode === "login" && (
          <form onSubmit={doLogin} className="glass-card" style={{ padding: 24, border: "1px solid rgba(0,174,239,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <button type="button" onClick={() => { setMode("pick"); setError(""); }}
                style={{ background: "none", border: "none", color: "#00AEEF", cursor: "pointer", padding: 4, fontSize: 18 }}>←</button>
              <div className="font-orbitron" style={{ fontSize: 11, color: "#00AEEF", letterSpacing: "0.15em" }}>RETURNING TRAINEE</div>
            </div>

            <div style={{ fontSize: 9, fontFamily: "Inter", color: "#00AEEF", letterSpacing: "0.1em", marginBottom: 6 }}>SELECT TRAINEE</div>
            {trainees.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: "16px 0", marginBottom: 14 }}>
                No trainees registered yet
              </div>
            ) : (
              <div style={{ marginBottom: 14, maxHeight: 200, overflowY: "auto" }}>
                {trainees.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    style={{
                      padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                      border: selectedId === t.id ? "1px solid #00AEEF" : "1px solid rgba(255,255,255,0.08)",
                      background: selectedId === t.id ? "rgba(0,174,239,0.12)" : "rgba(255,255,255,0.03)",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg, #00AEEF, #35D4FF)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "Inter", fontSize: 11, fontWeight: 700, color: "#fff",
                    }}>
                      {(t.name || "?").split(" ").map((w: string) => w[0]).slice(0,2).join("")}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</div>
                      {(t.rank || t.unit) && (
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{[t.rank, t.unit].filter(Boolean).join(" · ")}</div>
                      )}
                    </div>
                    {selectedId === t.id && <div style={{ marginLeft: "auto", color: "#00AEEF", fontSize: 16 }}>✓</div>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontFamily: "Inter", color: "#00AEEF", letterSpacing: "0.1em", marginBottom: 6 }}>PIN (if set)</div>
              <input
                type="password"
                value={loginPin}
                onChange={e => setLoginPin(e.target.value)}
                placeholder="Leave empty if no PIN"
                style={{
                  width: "100%", padding: "10px 12px", boxSizing: "border-box",
                  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(0,174,239,0.3)",
                  borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit",
                }}
              />
            </div>

            {error && <div style={{ color: "#FF4D4D", fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</div>}

            <button type="submit" disabled={loading || !selectedId} style={{
              width: "100%", padding: "14px 0",
              background: !selectedId ? "rgba(0,174,239,0.1)" : loading ? "rgba(0,174,239,0.2)" : "linear-gradient(135deg, #00AEEF, #35D4FF)",
              border: "none", borderRadius: 10, cursor: (!selectedId || loading) ? "not-allowed" : "pointer",
              color: !selectedId ? "rgba(255,255,255,0.3)" : "#fff",
              fontFamily: "Inter", fontSize: 12, letterSpacing: "0.1em", fontWeight: 700,
            }}>
              {loading ? "LOGGING IN..." : "ENTER TRAINING"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   NOTIFICATION BELL (polls /api/trainee/notifications/:id)
───────────────────────────────────────────────────────────────────────────── */
function NotificationBell({ traineeId }: { traineeId: string }) {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [, navigate] = useLocation();
  const prevUnreadRef = useRef(0);
  const prevIdsRef = useRef<Set<number>>(new Set());

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/trainee/notifications/${traineeId}`);
      const data = await r.json() as { alerts: Notification[]; messages: Notification[] };
      const all = [...(data.alerts ?? []), ...(data.messages ?? [])].sort((a, b) => b.ts - a.ts);

      // Detect NEW unread items since last poll
      const newUnread = all.filter(x => !x.read && !prevIdsRef.current.has(x.id));
      if (newUnread.length > 0) {
        for (const item of newUnread) {
          const atype = (item.alert_type ?? "info") as "message" | "info" | "warning" | "danger" | "sound";
          const isMessage = !item.alert_type || item.sender_role === "admin";

          // Show toast popup
          showToast(item.message ?? item.text ?? "", isMessage ? "message" : atype);

          // Play sound
          playAlertTone(isMessage ? "message" : atype);

          // Vibrate based on severity
          if (atype === "danger" || atype === "sound") vibrate("heavy");
          else if (atype === "warning") vibrate("medium");
          else vibrate("light");
        }
        // Update seen IDs
        prevIdsRef.current = new Set(all.filter(x => !x.read).map(x => x.id));
      } else if (all.filter(x => !x.read).length > 0) {
        // First load - mark existing unread as "seen" so we don't spam on load
        prevIdsRef.current = new Set(all.filter(x => !x.read).map(x => x.id));
      }

      setItems(all);
      setUnread(all.filter(x => !x.read).length);
      prevUnreadRef.current = all.filter(x => !x.read).length;
    } catch { /* non-fatal */ }
  }, [traineeId]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 12_000); // poll every 12s for faster delivery
    return () => clearInterval(id);
  }, [poll]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await fetch("/api/trainee/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traineeId }),
      }).catch(() => {});
      setUnread(0);
      setItems(prev => prev.map(x => ({ ...x, read: 1 })));
      prevIdsRef.current = new Set();
    }
  };

  const handleItemClick = (item: Notification) => {
    setOpen(false);
    // Navigate based on type
    const atype = item.alert_type ?? "";
    const isMessage = !atype || item.sender_role === "admin";
    if (isMessage) {
      navigate("/private-chat");
    } else if (atype === "module") {
      navigate("/modules");
    } else {
      navigate("/notifications");
    }
  };

  const formatTs = (ts: number) => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 2) return "Just now";
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  };

  const alertColor: Record<string, string> = {
    danger: "#FF4D4D", warning: "#FFD166", sound: "#FF4D4D",
    info: "#00AEEF", module: "#35D4FF",
  };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={toggleOpen} style={{
        background: "none", border: "none", cursor: "pointer",
        color: unread > 0 ? "#FFD166" : "var(--text-muted)",
        fontSize: 20, padding: "4px 8px", position: "relative",
      }}>
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 0, right: 2,
            background: "#FF4D4D", color: "#fff",
            width: 16, height: 16, borderRadius: "50%",
            fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Inter",
            animation: "pulse-glow 1.5s ease infinite",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div onClick={() => setOpen(false)} style={{
            position: "fixed", inset: 0, zIndex: 999,
          }} />
          <div style={{
            position: "fixed", top: 56, right: 12, width: "min(300px, calc(100vw - 24px))", zIndex: 1000,
            background: "#0a1628", border: "1px solid rgba(0,174,239,0.3)",
            borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
            maxHeight: "min(420px, 70vh)", overflowY: "auto",
          }}>
            <div style={{
              padding: "12px 16px", borderBottom: "1px solid rgba(0,174,239,0.15)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              position: "sticky", top: 0, background: "#0a1628", zIndex: 1,
            }}>
              <div className="font-orbitron" style={{ fontSize: 10, color: "#00AEEF", letterSpacing: "0.1em" }}>
                NOTIFICATIONS {unread > 0 && <span style={{ color: "#FF4D4D" }}>({unread})</span>}
              </div>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            {items.length === 0 ? (
              <div style={{ padding: "20px 16px", color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>No notifications</div>
            ) : items.map((item, i) => {
              const atype = item.alert_type ?? "";
              const isMessage = !atype || item.sender_role === "admin";
              const color = isMessage ? "#00D26A" : alertColor[atype] ?? "#00AEEF";
              const label = isMessage ? "💬 Message" : atype === "danger" ? "🚨 Danger" : atype === "warning" ? "⚠️ Warning" : atype === "sound" ? "🔊 Sound Alert" : atype === "module" ? "📡 Module" : "📢 Info";
              return (
                <div key={i}
                  onClick={() => handleItemClick(item)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: item.read ? "transparent" : `${color}08`,
                    borderLeft: item.read ? "none" : `3px solid ${color}`,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color, fontFamily: "Inter", letterSpacing: "0.05em" }}>{label}</span>
                    {!item.read && (
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, marginLeft: "auto" }} />
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: item.read ? "var(--text-muted)" : "var(--text-primary)", marginBottom: 2 }}>
                    {item.message ?? item.text ?? ""}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {formatTs(item.ts)} · tap to open
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN HOME PAGE (logged-in view)
───────────────────────────────────────────────────────────────────────────── */

/* Full radar canvas with sweep + blips */
function RadarHero() {
  const SIZE = 340;
  const cx = SIZE / 2;
  const rings = [42, 80, 118, 156]; // px radii
  return (
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      width: SIZE, height: SIZE,
      pointerEvents: "none",
    }}>
      {/* SVG rings + crosshairs — crisp and properly centered */}
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: "absolute", inset: 0 }}>
        {/* Crosshairs */}
        <line x1={cx} y1={0} x2={cx} y2={SIZE} stroke="rgba(0,174,239,0.08)" strokeWidth="1"/>
        <line x1={0} y1={cx} x2={SIZE} y2={cx} stroke="rgba(0,174,239,0.08)" strokeWidth="1"/>
        {/* Diagonal guides */}
        <line x1={0} y1={0} x2={SIZE} y2={SIZE} stroke="rgba(0,174,239,0.04)" strokeWidth="1"/>
        <line x1={SIZE} y1={0} x2={0} y2={SIZE} stroke="rgba(0,174,239,0.04)" strokeWidth="1"/>
        {/* Concentric rings */}
        {rings.map((r, i) => (
          <circle key={i} cx={cx} cy={cx} r={r}
            fill="none"
            stroke={`rgba(0,174,239,${0.22 - i * 0.04})`}
            strokeWidth="1"
          />
        ))}
        {/* Outer ring bolder */}
        <circle cx={cx} cy={cx} r={cx - 2} fill="none" stroke="rgba(0,174,239,0.12)" strokeWidth="1.5"/>
        {/* Range tick marks */}
        {rings.map((r, i) => (
          <text key={i} x={cx + r + 3} y={cx - 3}
            fill="rgba(0,174,239,0.3)" fontSize="7" fontFamily="Inter, sans-serif">
            {(i + 1) * 25}
          </text>
        ))}
        {/* Center dot */}
        <circle cx={cx} cy={cx} r={4} fill="#00AEEF" opacity="0.9"/>
        <circle cx={cx} cy={cx} r={7} fill="none" stroke="rgba(0,174,239,0.4)" strokeWidth="1"/>
      </svg>

      {/* Sweep arm — 8s revolution, GPU-accelerated */}
      <div style={{
        position: "absolute",
        top: cx, left: cx,
        width: cx - 2, height: 2,
        transformOrigin: "0 50%",
        willChange: "transform",
        animation: "radar-sweep-slow 8s linear infinite",
      }}>
        {/* Sweep line */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg, rgba(0,174,239,0.95) 0%, rgba(53,212,255,0.5) 55%, transparent 100%)",
        }} />
        {/* Glow cone behind sweep */}
        <div style={{
          position: "absolute",
          top: -20, left: 0, right: 0, height: 42,
          background: "linear-gradient(90deg, rgba(0,174,239,0.12) 0%, transparent 80%)",
          transformOrigin: "left center",
        }} />
      </div>

      {/* Aircraft blips */}
      {[
        { top: "25%", left: "64%", delay: "0.8s",  size: 5 },
        { top: "60%", left: "28%", delay: "3.2s",  size: 4 },
        { top: "35%", left: "40%", delay: "5.1s",  size: 6 },
        { top: "72%", left: "66%", delay: "1.7s",  size: 3 },
        { top: "48%", left: "78%", delay: "4.4s",  size: 4 },
      ].map((b, i) => (
        <div key={i} style={{
          position: "absolute",
          top: b.top, left: b.left,
          width: b.size, height: b.size,
          borderRadius: "50%",
          background: "#35D4FF",
          boxShadow: `0 0 ${b.size * 3}px rgba(53,212,255,0.9), 0 0 ${b.size}px #fff`,
          animation: `radar-blip 4s ease-in-out ${b.delay} infinite`,
          willChange: "opacity",
        }} />
      ))}
    </div>
  );
}

function HomePage({ session, onLogout }: { session: TraineeSession; onLogout: () => void }) {
  const [modules, setModules]   = useState<Module[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [streak, setStreak]     = useState<Streak>({ currentStreak: 0, longestStreak: 0, totalXp: 0 });
  const [, navigate] = useLocation();
  const clock = useLiveClock();
  const { t } = useLanguage();

  const quickActions = [
    { labelKey: "nav_modules" as const,  icon: "📡", path: "/modules",  color: "#00AEEF" },
    { labelKey: "tls_basic" as const,    icon: "🛰️", path: "/basics",   color: "#35D4FF" },
    { labelKey: "nav_quiz" as const,     icon: "🎯", path: "/quiz",     color: "#00D26A" },
    { labelKey: "manuals" as const,      icon: "📋", path: "/manuals",  color: "#C9A66B" },
    { labelKey: "live_status" as const,  icon: "📶", path: "/status",   color: "#FFD166" },
    { labelKey: "chat" as const,         icon: "💬", path: "/chat",     color: "#35D4FF" },
  ];

  useEffect(() => {
    Promise.all([
      fetch(`/api/ensure-user/${session.id}`).catch(() => {}),
      fetch("/api/modules").then(r => r.json()),
      fetch(`/api/progress/${session.id}`).then(r => r.json()),
      fetch(`/api/streaks/${session.id}`).then(r => r.json()),
    ]).then(([, modsRaw, progRaw, streakRaw]) => {
      const mods: Module[] = (Array.isArray(modsRaw) ? modsRaw : modsRaw.modules ?? [])
        .map((m: any) => ({ id: m.id, title: m.title, order: m.order ?? m.orderIndex ?? m.id }))
        .sort((a: Module, b: Module) => a.order - b.order);
      setModules(mods);
      setProgress(Array.isArray(progRaw) ? progRaw : []);
      setStreak(streakRaw ?? { currentStreak: 0, longestStreak: 0, totalXp: 0 });
    }).catch(() => {});
  }, [session.id]);

  const totalMods = 9;
  const completedMods = progress.filter(p => p.completed === 1).length;
  const overallPct = progress.length === 0
    ? 0
    : Math.round(progress.reduce((sum, p) => sum + p.progress, 0) / totalMods);

  const getModProgress = (moduleId: number) => progress.find(p => p.moduleId === moduleId)?.progress ?? 0;
  const displayMods = modules.slice(0, 4);

  const statusCards = [
    { label: t("streak"),   value: `${streak.currentStreak}d`, color: "#FFD166", pulse: streak.currentStreak > 0 },
    { label: t("xp"),       value: streak.totalXp > 999 ? `${(streak.totalXp/1000).toFixed(1)}k` : String(streak.totalXp), color: "#35D4FF", pulse: false },
    { label: t("modules"),  value: `${completedMods}/${totalMods}`, color: "#00AEEF", pulse: false },
    { label: t("progress"), value: `${overallPct}%`, color: "#00AEEF", pulse: overallPct > 0 },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/trainee/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id }),
      });
    } catch { /* non-fatal */ }
    clearSession();
    onLogout();
  };



  return (
    <div className="page" style={{ background: "var(--bg-primary)" }}>

      {/* ── HERO: RADAR ── */}
      <div className="radar-grid" style={{
        minHeight: 360,
        background: "linear-gradient(180deg, #04101f 0%, #020810 100%)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div className="scan-line" />
        <RadarHero />

        {/* Corner brackets */}
        {[{top:12,left:14},{top:12,right:14},{bottom:12,left:14},{bottom:12,right:14}].map((pos,i) => (
          <div key={i} style={{
            position:"absolute",...pos,width:16,height:16,
            borderTop:    i<2  ? "1.5px solid rgba(0,174,239,0.55)" : undefined,
            borderBottom: i>=2 ? "1.5px solid rgba(0,174,239,0.55)" : undefined,
            borderLeft:  (i===0||i===2) ? "1.5px solid rgba(0,174,239,0.55)" : undefined,
            borderRight: (i===1||i===3) ? "1.5px solid rgba(0,174,239,0.55)" : undefined,
          }} />
        ))}

        {/* Center content — title only, radar is behind */}
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center",
          minHeight: 360, padding: "28px 20px",
          textAlign: "center",
        }}>
          {/* Main title */}
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "clamp(28px, 8vw, 42px)",
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "0.06em",
            lineHeight: 1.1,
            textShadow: "0 0 24px rgba(0,174,239,0.9), 0 0 60px rgba(0,174,239,0.4)",
            marginBottom: 8,
          }}>
            TLS TRAINER
          </div>
          <div style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "clamp(9px, 2.5vw, 12px)",
            fontWeight: 600,
            letterSpacing: "0.28em",
            color: "#00AEEF",
            textTransform: "uppercase",
            textShadow: "0 0 12px rgba(0,174,239,0.6)",
            marginBottom: 20,
          }}>
            TRANSPONDER LANDING SYSTEM
          </div>

          {/* Status pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "rgba(0,174,239,0.08)",
            border: "1px solid rgba(0,174,239,0.25)",
            borderRadius: 20, padding: "5px 16px",
            marginBottom: 20,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#00AEEF", boxShadow: "0 0 8px #00AEEF",
              animation: "pulse-glow 2s ease infinite",
            }} />
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 8, color: "#35D4FF", letterSpacing: "0.18em",
            }}>{t("system_active")}</div>
          </div>

          {/* XP bar */}
          <div style={{ width: "100%", maxWidth: 300 }}>
            <XpBar xp={streak.totalXp} />
          </div>
        </div>
      </div>

      {/* ── STATS CARDS ── */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {statusCards.map(s => (
            <div key={s.label} className="glass-card" style={{
              padding: "12px 8px",
              textAlign: "center",
              border: `1px solid ${s.color}28`,
              position: "relative", overflow: "hidden",
              height: 68,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            }}>
              {s.pulse && (
                <div style={{
                  position: "absolute", top: 6, right: 6,
                  width: 5, height: 5, borderRadius: "50%",
                  background: s.color, boxShadow: `0 0 6px ${s.color}`,
                  animation: "pulse-glow 1.5s ease infinite",
                }} />
              )}
              <div style={{
                position: "absolute", inset: 0,
                background: `radial-gradient(circle at 50% 0%, ${s.color}10, transparent 65%)`,
                pointerEvents: "none",
              }} />
              <div style={{
                fontFamily: "Inter", fontSize: 16, fontWeight: 700,
                color: s.color, lineHeight: 1, position: "relative",
              }}>{s.value}</div>
              <div style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 9, color: "var(--text-muted)",
                marginTop: 4, letterSpacing: "0.08em", position: "relative",
              }}>{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTINUE TRAINING CTA ── */}
      {(() => {
        const inProgress = progress.find(p => p.progress > 0 && p.completed !== 1);
        if (!inProgress) return null;
        const mod = modules.find(m => m.id === inProgress.moduleId);
        const color = COLORS[(inProgress.moduleId - 1) % COLORS.length];
        return (
          <div style={{ padding: "12px 16px 0" }}>
            <div onClick={() => navigate("/modules")} className="glass-card" style={{
              padding: "13px 16px", cursor: "pointer",
              border: `1px solid ${color}45`,
              background: `linear-gradient(90deg, ${color}10 0%, transparent 100%)`,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `${color}18`, border: `1px solid ${color}45`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0,
              }}>▶</div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "Inter", fontSize: 9, color,
                  letterSpacing: "0.14em", marginBottom: 4,
                }}>CONTINUE TRAINING</div>
                <div style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                }}>
                  {mod?.title ?? `Module ${inProgress.moduleId}`}
                </div>
                <div className="progress-bar" style={{ marginTop: 7 }}>
                  <div className="progress-fill" style={{
                    width: `${inProgress.progress}%`,
                    background: `linear-gradient(90deg, ${color}, #35D4FF)`,
                  }} />
                </div>
              </div>
              <div style={{ fontFamily: "Inter", fontSize: 13, color, flexShrink: 0 }}>
                {Math.round(inProgress.progress)}%
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── QUICK ACCESS ── */}
      <div style={{ padding: "18px 16px 0" }}>
        <div style={{
          fontFamily: "Inter", fontSize: 9, letterSpacing: "0.22em",
          color: "var(--text-muted)", marginBottom: 12,
        }}>{t("quick_access")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {quickActions.map(a => (
            <div
              key={a.labelKey}
              onClick={() => navigate(a.path)}
              className="glass-card"
              style={{
                padding: "15px 10px 13px",
                textAlign: "center", cursor: "pointer",
                border: `1px solid ${a.color}28`,
                background: `linear-gradient(160deg, ${a.color}0e 0%, transparent 100%)`,
                transition: "box-shadow 0.18s, border-color 0.18s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px ${a.color}35`;
                (e.currentTarget as HTMLElement).style.borderColor = `${a.color}55`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
                (e.currentTarget as HTMLElement).style.borderColor = `${a.color}28`;
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 7, lineHeight: 1 }}>{a.icon}</div>
              <div style={{
                fontFamily: "Inter", fontSize: 8,
                color: a.color, letterSpacing: "0.1em",
              }}>{t(a.labelKey)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TRAINING MODULES ── */}
      <div style={{ padding: "20px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontFamily: "Inter", fontSize: 9, letterSpacing: "0.22em", color: "var(--text-muted)" }}>
            {t("training_modules")}
          </div>
          {overallPct > 0 && (
            <div style={{ fontFamily: "Inter", fontSize: 9, color: "#00AEEF" }}>
              {overallPct}% COMPLETE
            </div>
          )}
        </div>

        {displayMods.length === 0 ? (
          [1,2,3,4].map(i => (
            <div key={i} className="glass-card" style={{
              padding: "14px 16px", marginBottom: 10, height: 66,
              border: "1px solid rgba(0,174,239,0.1)",
              opacity: 0.4, animation: "pulse-glow 1.5s ease infinite",
            }} />
          ))
        ) : (
          displayMods.map(mod => {
            const color = COLORS[(mod.order - 1) % COLORS.length];
            const pct = getModProgress(mod.id);
            return (
              <Link key={mod.id} href="/modules" style={{ textDecoration: "none" }}>
                <div className="glass-card" style={{
                  padding: "13px 16px", marginBottom: 10,
                  border: `1px solid ${color}25`,
                  display: "flex", alignItems: "center", gap: 14,
                  cursor: "pointer",
                  background: `linear-gradient(90deg, ${color}08 0%, transparent 100%)`,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: `${color}15`, border: `1px solid ${color}40`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <span style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 700, color }}>
                      {String(mod.order).padStart(2, "0")}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                      <div style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                      }}>{mod.title}</div>
                      {pct > 0 && (
                        <span style={{ fontFamily: "Inter", fontSize: 9, color, marginLeft: 8 }}>
                          {Math.round(pct)}%
                        </span>
                      )}
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${pct}%`,
                        background: pct >= 100
                          ? "linear-gradient(90deg, #00AEEF, #35D4FF)"
                          : `linear-gradient(90deg, ${color}, #35D4FF)`,
                        transition: "width 0.8s ease",
                      }} />
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
              </Link>
            );
          })
        )}

        <Link href="/modules" style={{ textDecoration: "none" }}>
          <div style={{
            textAlign: "center", padding: "13px",
            border: "1px solid rgba(0,174,239,0.3)", borderRadius: 10, marginTop: 6,
            color: "#00AEEF", fontFamily: "Inter", fontSize: 11,
            letterSpacing: "0.12em", cursor: "pointer",
            background: "rgba(0,174,239,0.04)",
          }}>
            {t("view_all_modules")}
          </div>
        </Link>
      </div>

      {/* ── RECENT ACTIVITY ── */}
      <div style={{ padding: "0 16px 40px" }}>
        <div style={{
          fontFamily: "Inter", fontSize: 9, letterSpacing: "0.22em",
          color: "var(--text-muted)", marginBottom: 12,
        }}>{t("recent_activity")}</div>
        <div className="glass-card" style={{ padding: "4px 0", border: "1px solid rgba(0,174,239,0.1)" }}>
          {progress.length > 0 ? (
            progress.sort((a,b) => b.progress - a.progress).slice(0, 3).map((p, i, arr) => {
              const mod = modules.find(m => m.id === p.moduleId);
              const color = COLORS[(p.moduleId - 1) % COLORS.length];
              return (
                <div key={p.moduleId} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px",
                  borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${color}14`, border: `1px solid ${color}28`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  }}>
                    {p.completed ? "✅" : "📖"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 13, color: "var(--text-secondary)",
                    }}>
                      {p.completed ? "Completed" : "In Progress"} — {mod?.title ?? `Module ${p.moduleId}`}
                    </div>
                    <div style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 11, color: "var(--text-muted)", marginTop: 2,
                    }}>{Math.round(p.progress)}% done</div>
                  </div>
                </div>
              );
            })
          ) : (
            [
              { icon: "🚀", text: "Start your first module to begin training", time: "Get started", color: "#00AEEF" },
              { icon: "🎯", text: "Complete quizzes to earn XP and streaks", time: "Tip", color: "#35D4FF" },
              { icon: "📋", text: "Browse TLS manuals in the library", time: "Explore", color: "#C9A66B" },
            ].map((item, i, arr) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px",
                borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: `${item.color}14`, border: `1px solid ${item.color}28`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                }}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "var(--text-secondary)" }}>{item.text}</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.time}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── LOGOUT (bottom) ── */}
      <div style={{ padding: "0 16px 32px", textAlign: "center" }}>
        <button onClick={handleLogout} style={{
          background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
          color: "var(--text-muted)", fontFamily: "Inter", fontSize: 9,
          letterSpacing: "0.1em", padding: "8px 20px", cursor: "pointer",
        }}>
          {t("logout")}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ROOT EXPORT — gates login vs home
───────────────────────────────────────────────────────────────────────────── */
export default function Index() {
  const [session, setSessionState] = useState<TraineeSession | null>(() => getSession());

  const handleLogin = (s: TraineeSession) => {
    setSession(s);
    setSessionState(s);
  };

  const handleLogout = () => {
    clearSession();
    setSessionState(null);
    // Clear all persistence keys on real logout
    localStorage.removeItem("tls_last_page");
    localStorage.removeItem("tls_last_page_token");
    localStorage.removeItem("tls_intended");
    localStorage.removeItem("tls_site_open_ts");
    sessionStorage.removeItem("tls_last_page");
    sessionStorage.removeItem("tls_session_token"); // next open is a fresh session
  };

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <HomePage session={session} onLogout={handleLogout} />;
}
