import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { getSession, clearSession } from "../hooks/useTelegramTrack";
import { telegramTrack } from "../hooks/useTelegramTrack";

// ── Mini Bell Icon for NavMenu ────────────────────────────────────────────────
function BellIcon({ traineeId }: { traineeId: string }) {
  const [unread, setUnread] = useState(0);
  const [, navigate] = useLocation();
  const prevIdsRef = useRef<Set<number>>(new Set());

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/trainee/notifications/${traineeId}`);
      const data = await r.json() as { alerts: { id: number; read: number }[]; messages: { id: number; read: number }[] };
      const all = [...(data.alerts ?? []), ...(data.messages ?? [])];
      const unreadItems = all.filter(x => !x.read);
      if (prevIdsRef.current.size === 0) {
        prevIdsRef.current = new Set(unreadItems.map(x => x.id));
      }
      setUnread(unreadItems.length);
    } catch { /* non-fatal */ }
  }, [traineeId]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, [poll]);

  return (
    <button
      onClick={() => navigate("/notifications")}
      style={{
        background: "none", border: "none", cursor: "pointer",
        color: unread > 0 ? "#FFD166" : "rgba(255,255,255,0.45)",
        fontSize: 18, padding: "2px 4px", position: "relative",
        flexShrink: 0, lineHeight: 1,
      }}
      aria-label="Notifications"
    >
      🔔
      {unread > 0 && (
        <span style={{
          position: "absolute", top: -2, right: 0,
          background: "#FF4D4D", color: "#fff",
          width: 14, height: 14, borderRadius: "50%",
          fontSize: 8, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{unread > 9 ? "9+" : unread}</span>
      )}
    </button>
  );
}

const navItems = [
  { path: "/",             label: "Home",          icon: "⌂",  tag: "DASHBOARD" },
  { path: "/basics",       label: "TLS Basic",     icon: "📡",  tag: "LEARN" },
  { path: "/advanced",     label: "TLS Advanced",  icon: "🛰️",  tag: "ADVANCED" },
  { path: "/modules",      label: "Modules",       icon: "⬡",   tag: "TRAINING" },
  { path: "/manuals",      label: "Manuals",       icon: "📋",  tag: "REFERENCE" },
  { path: "/quiz",         label: "Quiz",          icon: "🎯",  tag: "ASSESSMENT" },
  { path: "/achievements", label: "Achievements",  icon: "🏅",  tag: "PROFILE" },
  { path: "/chat",         label: "AI Instructor", icon: "💬",  tag: "AI" },
  { path: "/private-chat", label: "Comms",         icon: "🔒",  tag: "COMMS" },
  { path: "/status",       label: "System Status", icon: "📶",  tag: "STATUS" },
  { path: "/notifications",label: "Notifications", icon: "🔔",  tag: "ALERTS" },
  { path: "/settings",     label: "Settings",      icon: "⚙️",  tag: "CONFIG" },
  { path: "/about",        label: "About",         icon: "ℹ️",  tag: "INFO" },
  { path: "/admin",        label: "Admin Panel",   icon: "🖥️",  tag: "ADMIN" },
];

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatDateTime(d: Date): string {
  const day   = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  const year  = d.getFullYear();
  const hh    = String(d.getHours() % 12 || 12).padStart(2, "0");
  const mm    = String(d.getMinutes()).padStart(2, "0");
  const ampm  = d.getHours() < 12 ? "AM" : "PM";
  return `${day} ${month} ${year} · ${hh}:${mm} ${ampm}`;
}

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const [location, navigate] = useLocation();
  const [session, setSession] = useState(() => getSession());
  const now = useLiveClock();

  // Sync session state
  useEffect(() => {
    const check = () => setSession(getSession());
    window.addEventListener("storage", check);
    const id = setInterval(check, 2000);
    return () => { window.removeEventListener("storage", check); clearInterval(id); };
  }, []);

  const handleLogout = async () => {
    const s = getSession();
    if (s) {
      try {
        await fetch("/api/trainee/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: s.id }),
        });
        telegramTrack.logout();
      } catch { /* fire and forget */ }
    }
    clearSession();
    sessionStorage.removeItem("tls_last_page");
    sessionStorage.removeItem("tls_intended");
    setSession(null);
    navigate("/", { replace: true });
    window.location.reload();
  };

  const isAdmin = location === "/admin";

  return (
    <>
      {/* ── Top bar ── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        background: "rgba(3,8,15,0.97)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,174,239,0.2)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 12px", height: 52,
        gap: 8,
      }}>
        {/* Decorative top accent line */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(0,174,239,0.6) 30%, rgba(53,212,255,0.8) 50%, rgba(0,174,239,0.6) 70%, transparent)",
        }} />

        {/* Left: Logo + live clock */}
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9, flexShrink: 0, minWidth: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7, flexShrink: 0,
            background: "linear-gradient(135deg, rgba(0,174,239,0.2), rgba(0,174,239,0.05))",
            border: "1px solid rgba(0,174,239,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 12px rgba(0,174,239,0.3)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="2">
              <circle cx="12" cy="12" r="2"/>
              <path d="M12 2a10 10 0 0 1 0 20"/>
              <path d="M12 2a10 10 0 0 0 0 20"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="font-orbitron" style={{
              fontSize: 11, fontWeight: 700, color: "#00AEEF",
              letterSpacing: "0.12em", lineHeight: 1, whiteSpace: "nowrap",
            }}>
              TLS TRAINER
            </div>
            <div style={{
              fontSize: 8, color: "rgba(0,174,239,0.6)", letterSpacing: "0.06em",
              fontFamily: "Inter, sans-serif", marginTop: 2, whiteSpace: "nowrap",
            }}>
              {formatDateTime(now)}
            </div>
          </div>
        </Link>

        {/* Center: Trainee identity + Bell */}
        {session && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, minWidth: 0, padding: "0 8px" }}>
            <div style={{ minWidth: 0, textAlign: "center" }}>
              <div style={{
                fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 700,
                color: "#ffffff", letterSpacing: "0.04em",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                lineHeight: 1.2,
              }}>
                {session.name}
              </div>
              {(session.rank || session.unit) && (
                <div style={{
                  fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 500,
                  color: "#00AEEF", letterSpacing: "0.06em",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  lineHeight: 1.2,
                }}>
                  {[session.rank, session.unit].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
            <BellIcon traineeId={session.id} />
          </div>
        )}

        {/* Right: Hamburger */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {/* Hamburger */}
          <button
            onClick={() => setOpen(o => !o)}
            aria-label="Menu"
            style={{
              background: open ? "rgba(0,174,239,0.15)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${open ? "rgba(0,174,239,0.45)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 9, padding: "7px 9px", cursor: "pointer",
              display: "flex", flexDirection: "column", gap: 4.5,
              transition: "all 0.22s", flexShrink: 0,
            }}
          >
            {[0,1,2].map(i => (
              <span key={i} style={{
                display: "block", width: 20, height: 1.5,
                background: open ? "#00AEEF" : "rgba(255,255,255,0.55)",
                borderRadius: 2, transition: "all 0.22s",
                transform: open
                  ? (i === 0 ? "rotate(45deg) translate(4px,4px)" : i === 2 ? "rotate(-45deg) translate(4px,-4px)" : "none")
                  : "none",
                opacity: (open && i === 1) ? 0 : 1,
              }} />
            ))}
          </button>
        </div>
      </div>

      {/* ── Backdrop ── */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 198,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          transition: "opacity 0.25s",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* ── Side drawer ── */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 199,
        width: 270,
        background: "rgba(4,10,22,0.99)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderLeft: "1px solid rgba(0,174,239,0.2)",
        display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        overflowY: "auto",
      }}>
        {/* Drawer header */}
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid rgba(0,174,239,0.12)",
          background: "linear-gradient(180deg, rgba(0,174,239,0.08) 0%, transparent 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="font-orbitron" style={{ fontSize: 11, color: "#00AEEF", letterSpacing: "0.2em" }}>NAVIGATION</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, fontFamily: "Inter" }}>Select training module</div>
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: "rgba(0,174,239,0.08)", border: "1px solid rgba(0,174,239,0.2)",
              borderRadius: 6, width: 28, height: 28, cursor: "pointer",
              color: "#00AEEF", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: "8px 0" }}>
          {navItems.map((item, i) => {
            const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 20px",
                  textDecoration: "none",
                  color: isActive ? "#35D4FF" : "rgba(255,255,255,0.6)",
                  background: isActive ? "linear-gradient(90deg, rgba(0,174,239,0.12), rgba(0,174,239,0.03))" : "transparent",
                  borderLeft: `2px solid ${isActive ? "#00AEEF" : "transparent"}`,
                  transition: "all 0.15s",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 15, fontWeight: isActive ? 600 : 400,
                  letterSpacing: "0.03em",
                  animationDelay: `${i * 0.03}s`,
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(0,174,239,0.06)"; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: 16, flexShrink: 0, width: 22, textAlign: "center" }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {isActive && (
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "#00AEEF",
                    boxShadow: "0 0 8px #00AEEF",
                  }} />
                )}
              </Link>
            );
          })}
        </div>

        {/* Drawer footer */}
        <div style={{
          padding: "14px 20px",
          borderTop: "1px solid rgba(0,174,239,0.1)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="online-dot" />
            <span style={{ fontFamily: "Inter", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
              SYSTEM ONLINE
            </span>
          </div>
          {(session || isAdmin) && (
            <button
              onClick={() => { setOpen(false); handleLogout(); }}
              style={{
                background: "rgba(220,38,38,0.12)",
                border: "1px solid rgba(220,38,38,0.35)",
                borderRadius: 6,
                padding: "4px 10px",
                cursor: "pointer",
                color: "#ff6b6b",
                fontFamily: "Inter, sans-serif",
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: "0.1em",
              }}
            >
              LOGOUT
            </button>
          )}
        </div>
      </div>
    </>
  );
}
