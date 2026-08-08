import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { getSession, clearSession } from "../hooks/useTelegramTrack";
import { resetWelcome } from "./WelcomeScreen";

// ── Same nav config as NavMenu so both orientations are always in sync ────────
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
  { id:14, label:"Media",          href:"/media",        icon:"Film",          order:14, isVisible:true },
];

// SVG icons keyed by icon-name (matches NavMenu's ICON_EMOJI keys)
function NavIcon({ name, active }: { name: string; active: boolean }) {
  const c = active ? "#00AEEF" : "rgba(255,255,255,0.5)";
  const s = { width: 16, height: 16 };
  switch (name) {
    case "BookOpen": return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
    case "Zap":      return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
    case "Crosshair":return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case "FileText": return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
    case "MessageSquare": return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case "MessageCircle": return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>;
    case "Monitor":  return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="8" cy="12" r="2"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="18" y1="12" x2="18" y2="12.01"/><line x1="16" y1="14" x2="16" y2="14.01"/><line x1="14" y1="12" x2="14" y2="12.01"/></svg>;
    case "ShieldAlert": return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={active ? "#FFB347" : "rgba(255,179,71,0.4)"} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case "Trophy":   return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>;
    case "BarChart": return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
    case "Bell":     return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
    case "Info":     return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
    case "Film":     return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="2" y1="17" x2="7" y2="17"/></svg>;
    case "Settings": return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    default: return <span style={{ width: 16, textAlign: "center", color: c }}>•</span>;
  }
}

function useDynamicNav() {
  const [items, setItems] = useState<DynNavItem[]>([]);
  useEffect(() => {
    fetch("/api/nav-items")
      .then(r => r.json())
      .then((d: DynNavItem[]) => {
        setItems(Array.isArray(d) && d.length > 0 ? d.filter(i => i.isVisible) : FALLBACK_NAV);
      })
      .catch(() => setItems(FALLBACK_NAV));
  }, []);
  return items.sort((a, b) => a.order - b.order);
}

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  // Session must be REACTIVE. Sidebar mounts outside <AuthGate>, so on a fresh
  // browser it mounts before login, when getSession() is still null. Reading it
  // once meant the desktop topbar returned null and never came back for the
  // whole browser session — no navigation at all on laptops until a manual
  // refresh. Mirror the same poll + storage listener AuthGate/NavMenu use.
  const [session, setSession] = useState(() => getSession());
  const [guest, setGuest] = useState(
    () => typeof sessionStorage !== "undefined" && sessionStorage.getItem("tls_guest_mode") === "1"
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const dynNavItems = useDynamicNav();

  // Keep session/guest state in sync (login, logout, other tabs)
  useEffect(() => {
    const check = () => {
      setSession(getSession());
      setGuest(sessionStorage.getItem("tls_guest_mode") === "1");
    };
    window.addEventListener("storage", check);
    const id = setInterval(check, 2000);
    return () => {
      window.removeEventListener("storage", check);
      clearInterval(id);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch unread notification count
  useEffect(() => {
    if (!session?.id) return;
    const fetchUnread = () => {
      fetch(`/api/trainee/notifications/${session.id}`)
        .then(r => r.json())
        .then(data => {
          const unread = [
            ...(data.alerts || []),
            ...(data.messages || [])
          ].filter((n: any) => !n.read).length;
          setUnreadCount(unread);
        })
        .catch(() => {});
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);
    return () => clearInterval(id);
  }, [session?.id]);

  // Hide only when there is neither a session nor guest mode (i.e. login screen).
  if (!session && !guest) return null;

  const isActive = (href: string) =>
    location === href ||
    (href !== "/" && location.startsWith(href));

  return (
    <>
      {/* ── Desktop topbar (768px+) ── */}
      <header className="desktop-topbar">
        {/* Left: hamburger + TLS TRAINER label */}
        <div ref={menuRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, zIndex: 10 }}>
          <button
            className="topbar-menu-btn"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Open navigation"
            style={{ zIndex: 10, position: "relative" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            <span>MENU</span>
          </button>
          <div className="topbar-brand-block" style={{ zIndex: 10, position: "relative" }}>
            <span className="topbar-logo-text">TLS TRAINER</span>
            <span className="topbar-logo-sub">TRANSPONDER LANDING SYSTEM</span>
          </div>

          {/* Dropdown */}
          {menuOpen && (
            <div className="topbar-dropdown" style={{ maxHeight: "80vh", overflowY: "auto" }}>
              {dynNavItems.map(item => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="topbar-dropdown-item"
                    onClick={() => setMenuOpen(false)}
                    onMouseEnter={() => setHoveredItem(item.href)}
                    onMouseLeave={() => setHoveredItem(null)}
                    style={{
                      background: hoveredItem === item.href || active ? "rgba(0,174,239,0.12)" : "transparent",
                      color: hoveredItem === item.href || active ? "#00d4ff" : "rgba(255,255,255,0.6)",
                    }}
                  >
                    <NavIcon name={item.icon} active={active || hoveredItem === item.href} />
                    <span>{item.label}</span>
                    {active && <div className="topbar-dropdown-active-dot" />}
                  </Link>
                );
              })}
              {/* Logout — only for a real session, not guest mode */}
              {session && (
              <div style={{ padding: "4px 4px 4px", borderTop: "1px solid rgba(255,77,77,0.1)", marginTop: 4 }}>
                <button
                  onClick={() => {
                    clearSession();
                    resetWelcome(); // next visit shows the pre-login entry screen again
                    sessionStorage.removeItem("tls_last_page");
                    sessionStorage.removeItem("tls_intended");
                    setMenuOpen(false);
                    setLocation("/");
                    window.location.reload();
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "10px 16px",
                    background: "transparent",
                    border: "1px solid rgba(255,77,77,0.2)",
                    borderRadius: 8, cursor: "pointer",
                    color: "rgba(255,77,77,0.6)",
                    fontFamily: "Inter", fontSize: 10,
                    letterSpacing: "0.1em", fontWeight: 600,
                    transition: "all 0.2s", marginTop: 4,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(255,77,77,0.1)";
                    e.currentTarget.style.color = "#FF4D4D";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "rgba(255,77,77,0.6)";
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  LOGOUT
                </button>
              </div>
              )}
            </div>
          )}
        </div>

        {/* Right: bell icon — only for a real session */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          {session && (
          <button
            onClick={() => setLocation("/notifications")}
            style={{
              position: "relative", background: "transparent", border: "none",
              cursor: "pointer", padding: "6px", color: "rgba(255,255,255,0.3)",
              transition: "color 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
            aria-label="Notifications"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: 2, right: 2,
                background: "#FF4D4D", color: "#fff",
                borderRadius: "50%", width: 16, height: 16,
                fontSize: 9, fontWeight: 700, fontFamily: "Inter",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          )}
        </div>

        {/* Animated shimmer glow overlay (decorative, behind everything) */}
        <div className="topbar-glow-overlay" aria-hidden="true" />
      </header>

      {/* ── Mobile bottom nav (hidden on desktop via CSS) ── */}
      <aside className="sidebar" style={{ display: "none" }} />
    </>
  );
}
