import { Link, useLocation } from "wouter";
import { ReactNode, useState } from "react";

// Reusable back button — use at top of any inner page
export function BackButton({ to = "/v2/trainee", label = "Back" }: { to?: string; label?: string }) {
  const [, setLocation] = useLocation();
  return (
    <button
      onClick={() => setLocation(to)}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.5rem",
        padding: "0.5rem 1.1rem", borderRadius: "8px", cursor: "pointer",
        background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.2)",
        color: "#00ff88", fontSize: "0.82rem", fontWeight: 600,
        marginBottom: "1.25rem", transition: "all 0.15s",
        letterSpacing: "0.04em",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,255,136,0.14)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,255,136,0.45)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 10px rgba(0,255,136,0.12)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,255,136,0.06)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,255,136,0.2)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </button>
  );
}

interface LayoutProps {
  children: ReactNode;
  role?: "trainee" | "admin";
  traineeId?: string | null;
  traineeName?: string | null;
}

export default function V2Layout({ children, role = "trainee", traineeId, traineeName }: LayoutProps) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const traineeNav = [
    { href: "/v2/trainee", label: "Dashboard", icon: "⊞" },
    { href: "/v2/modules", label: "Modules", icon: "📖" },
    { href: "/v2/quiz", label: "Quiz", icon: "✦" },
    { href: "/v2/simulator", label: "Simulator", icon: "◎" },
    { href: "/v2/documents", label: "Documents", icon: "📄" },
    { href: "/v2/profile", label: "Profile", icon: "○" },
  ];

  const adminNav = [
    { href: "/v2/admin", label: "Dashboard", icon: "⊞" },
    { href: "/v2/admin/trainees", label: "Trainees", icon: "👥" },
    { href: "/v2/admin/reports", label: "Reports", icon: "📊" },
    { href: "/v2/admin/simulator", label: "Simulator", icon: "◎" },
  ];

  const nav = role === "admin" ? adminNav : traineeNav;

  const handleLogout = () => {
    sessionStorage.removeItem("v2_trainee_id");
    sessionStorage.removeItem("v2_trainee_name");
    sessionStorage.removeItem("v2_role");
    window.location.href = "/v2";
  };

  return (
    <div className="v2-layout" style={{ minHeight: "100vh", background: "#050a0e", fontFamily: "'Inter', sans-serif" }}>
      {/* Top Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(5,10,14,0.95)", borderBottom: "1px solid rgba(0,255,136,0.12)",
        backdropFilter: "blur(20px)",
        padding: "0 1.5rem", display: "flex", alignItems: "center", height: "56px", gap: "1.5rem"
      }}>
        {/* Logo */}
        <Link href="/v2">
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", textDecoration: "none" }}>
            <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#00ff88", letterSpacing: "0.02em" }}>TLS</span>
            <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#e2e8f0", letterSpacing: "0.02em" }}> TRAINER</span>
          </span>
        </Link>

        {/* Nav items — desktop */}
        <div style={{ display: "flex", gap: "0.25rem", flex: 1 }} className="v2-nav-desktop">
          {nav.map(item => {
            const active = location === item.href || (item.href !== "/v2" && item.href !== "/v2/admin" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "0.4rem",
                  padding: "0.35rem 0.85rem", borderRadius: "8px", cursor: "pointer",
                  fontSize: "0.82rem", fontWeight: active ? 600 : 400,
                  color: active ? "#00ff88" : "#94a3b8",
                  background: active ? "rgba(0,255,136,0.1)" : "transparent",
                  border: active ? "1px solid rgba(0,255,136,0.3)" : "1px solid transparent",
                  transition: "all 0.15s",
                  textDecoration: "none",
                }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginLeft: "auto" }}>
          {traineeName && (
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{traineeName}</span>
          )}
          {role === "trainee" && (
            <Link href="/v2/admin">
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                padding: "0.3rem 0.75rem", borderRadius: "8px", cursor: "pointer",
                fontSize: "0.78rem", fontWeight: 500, color: "#94a3b8",
                border: "1px solid rgba(148,163,184,0.2)", textDecoration: "none",
              }}>Admin</span>
            </Link>
          )}
          <button onClick={handleLogout} style={{
            background: "transparent", border: "1px solid rgba(239,68,68,0.3)",
            color: "#ef4444", padding: "0.3rem 0.6rem", borderRadius: "6px",
            cursor: "pointer", fontSize: "0.75rem"
          }}>Exit</button>
        </div>
      </nav>

      {/* Page content */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem 1.25rem" }}>
        {children}
      </main>

      <style>{`
        .v2-layout * { box-sizing: border-box; }
        @media (max-width: 768px) {
          .v2-nav-desktop { display: none !important; }
        }
        a { text-decoration: none; }
      `}</style>
    </div>
  );
}
