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

// Icon map — emoji fallback for nav items
const ICON_EMOJI: Record<string, string> = {
  Home: "⌂", BookOpen: "📡", Zap: "⭐", FileText: "📋",
  MessageSquare: "💬", MessageCircle: "🔒", Monitor: "🎮",
  ShieldAlert: "⚠️", Trophy: "🏅", BarChart: "📊",
  Bell: "🔔", Settings: "⚙️", Crosshair: "🎯", Users: "👥",
};

interface DynNavItem { id: number; label: string; href: string; icon: string; order: number; isVisible: boolean; }

const FALLBACK_NAV: DynNavItem[] = [
  { id:1,  label:"TLS Basic",     href:"/basics",       icon:"BookOpen",      order:1,  isVisible:true },
  { id:2,  label:"TLS Advanced",  href:"/advanced",     icon:"Zap",           order:2,  isVisible:true },
  { id:3,  label:"Quiz",          href:"/quiz",         icon:"Crosshair",     order:3,  isVisible:true },
  { id:4,  label:"Manuals",       href:"/manuals",      icon:"FileText",      order:4,  isVisible:true },
  { id:5,  label:"AI Instructor", href:"/chat",         icon:"MessageSquare", order:5,  isVisible:true },
  { id:6,  label:"Comms",         href:"/private-chat", icon:"MessageCircle", order:6,  isVisible:true },
  { id:7,  label:"RCU Simulator", href:"/simulator",    icon:"Monitor",       order:7,  isVisible:true },
  { id:8,  label:"Common Faults", href:"/faults",       icon:"ShieldAlert",   order:8,  isVisible:true },
  { id:9,  label:"Achievements",  href:"/achievements", icon:"Trophy",        order:9,  isVisible:true },
  { id:10, label:"Leaderboard",   href:"/leaderboard",  icon:"BarChart",      order:10, isVisible:true },
  { id:11, label:"Notifications", href:"/notifications",icon:"Bell",          order:11, isVisible:true },
  { id:12, label:"About",          href:"/about",        icon:"Info",          order:12, isVisible:true },
  { id:13, label:"Settings",      href:"/settings",     icon:"Settings",      order:13, isVisible:true },
];

function useDynamicNav() {
  const [items, setItems] = useState<DynNavItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch("/api/nav-items")
      .then(r => r.json())
      .then((d: DynNavItem[]) => {
        if (Array.isArray(d) && d.length > 0) {
          setItems(d.filter(i => i.isVisible));
        } else {
          setItems(FALLBACK_NAV);
        }
        setLoaded(true);
      })
      .catch(() => { setItems(FALLBACK_NAV); setLoaded(true); });
  }, []);
  return { items: items.sort((a, b) => a.order - b.order), loaded };
}

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

// ── Theme: toggle class on <html>, CSS vars live in styles.css ───────────────
function applyTheme(t: "dark" | "light") {
  if (t === "light") {
    document.documentElement.classList.add("light-mode");
  } else {
    document.documentElement.classList.remove("light-mode");
  }
  // Remove any stale inline overrides from old approach
  const root = document.documentElement;
  ["--bg-primary","--bg-secondary","--bg-card","--bg-elevated",
   "--text-primary","--text-secondary","--text-muted","--border-color","--card-bg"]
    .forEach(v => root.style.removeProperty(v));
}

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const [location, navigate] = useLocation();
  const [session, setSession] = useState(() => getSession());
  const now = useLiveClock();
  const { items: dynNavItems } = useDynamicNav();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("tls_theme") as "dark" | "light") ?? "dark";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("tls_theme", theme);
  }, [theme]);

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

  return (
    <div className="nav-menu-root">
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

        {/* Right: Theme toggle + Hamburger */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 9, padding: "5px 8px", cursor: "pointer",
              fontSize: 16, lineHeight: 1,
              transition: "all 0.2s", flexShrink: 0,
            }}
          >
            {theme === "dark" ? "🌞" : "🌙"}
          </button>
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
          {dynNavItems.map((item, i) => {
            const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
            const emoji = ICON_EMOJI[item.icon] ?? "•";
            return (
              <Link
                key={item.id}
                href={item.href}
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
                <span style={{ fontSize: 16, flexShrink: 0, width: 22, textAlign: "center" }}>{emoji}</span>
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
          {session && (
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
    </div>
  );
}
