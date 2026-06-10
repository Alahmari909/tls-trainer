import { Link, useLocation } from "wouter";
import { ReactNode, useState, useEffect, useRef } from "react";

// Reusable back button — use at top of any inner page
export function BackButton({ to = "/v2/trainee", label = "← Back" }: { to?: string; label?: string }) {
  const [, setLocation] = useLocation();
  return (
    <button
      onClick={() => setLocation(to)}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.4rem",
        padding: "0.45rem 1rem", borderRadius: "8px", cursor: "pointer",
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
        color: "#94a3b8", fontSize: "0.85rem", fontWeight: 500,
        marginBottom: "1.25rem", transition: "all 0.15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,255,136,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#00ff88"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,255,136,0.3)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
    >
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
  const [pageVisible, setPageVisible] = useState(false);
  const prevLocation = useRef(location);

  useEffect(() => {
    // On location change, trigger re-entrance animation
    if (prevLocation.current !== location) {
      setPageVisible(false);
      prevLocation.current = location;
    }
    const t = setTimeout(() => setPageVisible(true), 30);
    return () => clearTimeout(t);
  }, [location]);

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
    <div className="v2-layout" style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 60% 20%, #050f1a 0%, #020810 60%, #000 100%)",
      fontFamily: "'Inter', sans-serif",
      position: "relative",
    }}>
      {/* ── Subtle background grid ── */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(0,174,239,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,174,239,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
        animation: "gridDrift 25s linear infinite",
      }} />

      {/* Top Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(2,8,16,0.92)",
        borderBottom: "1px solid rgba(0,174,239,0.15)",
        backdropFilter: "blur(20px)",
        padding: "0 1.5rem", display: "flex", alignItems: "center", height: "56px", gap: "1.5rem",
        boxShadow: "0 1px 20px rgba(0,0,0,0.5)",
      }}>
        {/* Logo */}
        <Link href="/v2">
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", textDecoration: "none" }}>
            <span style={{
              fontSize: "1.2rem", fontWeight: 800, color: "#00AEEF", letterSpacing: "0.04em",
              textShadow: "0 0 12px rgba(0,174,239,0.7)",
            }}>TLS</span>
            <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "#e2e8f0", letterSpacing: "0.04em" }}> TRAINER</span>
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
                  color: active ? "#00AEEF" : "#64748b",
                  background: active ? "rgba(0,174,239,0.12)" : "transparent",
                  border: active ? "1px solid rgba(0,174,239,0.35)" : "1px solid transparent",
                  boxShadow: active ? "0 0 12px rgba(0,174,239,0.2)" : "none",
                  transition: "all 0.2s",
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
            cursor: "pointer", fontSize: "0.75rem",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px rgba(239,68,68,0.4)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
          >Exit</button>
        </div>
      </nav>

      {/* Page content with entrance animation */}
      <main style={{
        maxWidth: "1200px", margin: "0 auto", padding: "1.5rem 1.25rem",
        position: "relative", zIndex: 1,
        opacity: pageVisible ? 1 : 0,
        transform: pageVisible ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.4s cubic-bezier(0.16,1,0.3,1), transform 0.4s cubic-bezier(0.16,1,0.3,1)",
      }}>
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
