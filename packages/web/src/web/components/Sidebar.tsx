import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { getSession } from "../hooks/useTelegramTrack";

const navItems = [
  {
    path: "/",
    label: "HOME",
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )
  },
  {
    path: "/modules",
    label: "MODULES",
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="7" height="7"/><rect x="15" y="3" width="7" height="7"/>
        <rect x="15" y="14" width="7" height="7"/><rect x="2" y="14" width="7" height="7"/>
      </svg>
    )
  },
  {
    path: "/basics",
    label: "TLS BASIC",
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    )
  },
  {
    path: "/advanced",
    label: "TLS ADVANCED",
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    )
  },
  {
    path: "/quiz",
    label: "QUIZ",
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    )
  },
  {
    path: "/manuals",
    label: "MANUALS",
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    )
  },
  {
    path: "/achievements",
    label: "ACHIEVEMENTS",
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6"/>
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
      </svg>
    )
  },
  {
    path: "/status",
    label: "LIVE STATUS",
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    )
  },
  {
    path: "/leaderboard",
    label: "LEADERBOARD",
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    )
  },
  {
    path: "/chat",
    label: "AI INSTRUCTOR",
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M9 15l-3 6h12l-3-6"/>
        <line x1="12" y1="12" x2="12" y2="15"/>
      </svg>
    )
  },
  {
    path: "/private-chat",
    label: "COMMS",
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    )
  },
  {
    path: "/notifications",
    label: "NOTIFICATIONS",
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    )
  },
  {
    path: "/about",
    label: "ABOUT",
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    )
  },
  {
    path: "/settings",
    label: "SETTINGS",
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#00d4ff" : "#3d5a73"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    )
  },
];

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const session = getSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

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

  if (!session) return null;

  const isActive = (path: string) =>
    location === path ||
    (path === "/quiz" && location.startsWith("/quiz")) ||
    (path === "/modules" && location.startsWith("/module")) ||
    (path === "/basics" && location.startsWith("/basics")) ||
    (path === "/advanced" && location.startsWith("/advanced"));

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
          </button>
          <div className="topbar-brand-block" style={{ zIndex: 10, position: "relative" }}>
            <span className="topbar-logo-text">TLS TRAINER</span>
            <span className="topbar-logo-sub">TRANSPONDER LANDING SYSTEM</span>
          </div>

          {/* Dropdown */}
          {menuOpen && (
            <div className="topbar-dropdown">
              {navItems.map(item => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className="topbar-dropdown-item"
                    onClick={() => setMenuOpen(false)}
                    onMouseEnter={() => setHoveredItem(item.path)}
                    onMouseLeave={() => setHoveredItem(null)}
                    style={{
                      background: hoveredItem === item.path || active ? "rgba(0,174,239,0.12)" : "transparent",
                      color: hoveredItem === item.path || active ? "#00d4ff" : "rgba(255,255,255,0.6)",
                    }}
                  >
                    {item.icon(active || hoveredItem === item.path)}
                    <span>{item.label}</span>
                    {active && <div className="topbar-dropdown-active-dot" />}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: bell icon */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
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
        </div>

        {/* Animated shimmer glow overlay (decorative, behind everything) */}
        <div className="topbar-glow-overlay" aria-hidden="true" />
      </header>

      {/* ── Mobile bottom nav (hidden on desktop via CSS) ── */}
      <aside className="sidebar" style={{ display: "none" }} />
    </>
  );
}
