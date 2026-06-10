import { useState, useEffect } from "react";
import { useLocation } from "wouter";

export default function V2Home() {
  const [, setLocation] = useLocation();
  const [hovered, setHovered] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation after mount
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleRole = (role: string) => {
    sessionStorage.setItem("v2_role", role);
    if (role === "admin") {
      setLocation("/v2/admin");
    } else {
      setLocation("/v2/trainee");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 60% 40%, #050f1a 0%, #020810 50%, #000 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', sans-serif", padding: "2rem",
      position: "relative", overflow: "hidden",
    }}>

      {/* ── Animated Radar Background ── */}
      <div className="radar-bg">
        {/* Grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,174,239,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,174,239,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          animation: "gridDrift 20s linear infinite",
        }} />

        {/* Radar rings */}
        {[250, 500, 750, 1000].map((size, i) => (
          <div key={i} style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: size, height: size,
            borderRadius: "50%",
            border: `1px solid rgba(0,174,239,${0.1 - i * 0.02})`,
            pointerEvents: "none",
          }} />
        ))}

        {/* Crosshair */}
        <div style={{
          position: "absolute", top: "50%", left: 0, right: 0,
          height: "1px",
          background: "linear-gradient(to right, transparent, rgba(0,174,239,0.12) 50%, transparent)",
        }} />
        <div style={{
          position: "absolute", left: "50%", top: 0, bottom: 0,
          width: "1px",
          background: "linear-gradient(to bottom, transparent, rgba(0,174,239,0.12) 50%, transparent)",
        }} />

        {/* Sweep beam */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 700, height: 700,
          borderRadius: "50%", overflow: "hidden",
          animation: "radarSpin 6s linear infinite",
          pointerEvents: "none",
        }}>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            width: "50%", height: "50%",
            transformOrigin: "0% 100%",
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(0,174,239,0.15) 30deg, rgba(0,174,239,0.06) 55deg, transparent 65deg)",
          }} />
        </div>

        {/* Center dot */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 8, height: 8, borderRadius: "50%",
          background: "#00AEEF",
          boxShadow: "0 0 16px rgba(0,174,239,0.9), 0 0 32px rgba(0,174,239,0.4)",
        }} />

        {/* Radar blips */}
        {[
          { top: "38%", left: "58%", delay: "0s", color: "#00AEEF" },
          { top: "55%", left: "42%", delay: "1.5s", color: "#35D4FF" },
          { top: "33%", left: "44%", delay: "3s", color: "#FFD700" },
          { top: "62%", left: "60%", delay: "2s", color: "#00AEEF" },
        ].map((b, i) => (
          <div key={i} style={{
            position: "absolute", top: b.top, left: b.left,
            width: 5, height: 5, borderRadius: "50%",
            background: b.color,
            boxShadow: `0 0 10px ${b.color}`,
            animation: `blipAppear 3s ease-in-out ${b.delay} infinite`,
          }} />
        ))}

        {/* Ambient glow */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 600, height: 600,
          background: "radial-gradient(ellipse at center, rgba(0,174,239,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
      </div>

      {/* ── HUD corner brackets ── */}
      {[
        { top: 20, left: 20, border: "2px 0 0 2px" },
        { top: 20, right: 20, border: "2px 2px 0 0" },
        { bottom: 20, left: 20, border: "0 0 2px 2px" },
        { bottom: 20, right: 20, border: "0 2px 2px 0" },
      ].map((corner, i) => (
        <div key={i} style={{
          position: "fixed",
          top: corner.top, left: corner.left,
          bottom: corner.bottom, right: corner.right,
          width: 24, height: 24,
          borderColor: "rgba(0,174,239,0.4)",
          borderStyle: "solid",
          borderWidth: corner.border,
          pointerEvents: "none",
          zIndex: 1,
        }} />
      ))}

      {/* ── Main content (animated entrance) ── */}
      <div style={{
        position: "relative", zIndex: 2,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          {/* Animated radar icon */}
          <div style={{ marginBottom: "1.25rem", position: "relative", display: "inline-block" }}>
            <svg width="72" height="72" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
              style={{ animation: "rotate-slow 12s linear infinite", filter: "drop-shadow(0 0 8px rgba(0,174,239,0.6))" }}>
              <circle cx="32" cy="32" r="30" stroke="#00AEEF" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
              <circle cx="32" cy="32" r="20" stroke="#00AEEF" strokeWidth="1" opacity="0.35" />
              <circle cx="32" cy="32" r="10" stroke="#00AEEF" strokeWidth="1" opacity="0.2" />
              <circle cx="32" cy="32" r="3" fill="#00AEEF" />
              <line x1="32" y1="32" x2="50" y2="14" stroke="#00AEEF" strokeWidth="1.5" opacity="0.7" />
              <circle cx="48" cy="16" r="3" fill="#00AEEF" opacity="0.9" style={{ animation: "blip 1.8s ease-in-out infinite" }} />
            </svg>
          </div>

          <h1 style={{ margin: 0, fontSize: "2.8rem", fontWeight: 900, letterSpacing: "0.06em" }}>
            <span style={{
              color: "#00AEEF",
              textShadow: "0 0 20px rgba(0,174,239,0.8), 0 0 40px rgba(0,174,239,0.4)",
            }}>TLS</span>
            <span style={{ color: "#e2e8f0", marginLeft: "0.3em" }}>TRAINER</span>
          </h1>

          <div style={{
            margin: "0.5rem 0 0",
            fontSize: "0.72rem", letterSpacing: "0.3em", color: "#3d5a73",
            textTransform: "uppercase",
            display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center",
          }}>
            <span style={{ width: 20, height: 1, background: "rgba(0,174,239,0.3)", display: "inline-block" }} />
            Transponder Landing System
            <span style={{ width: 20, height: 1, background: "rgba(0,174,239,0.3)", display: "inline-block" }} />
          </div>

          <p style={{ margin: "1.25rem 0 0", fontSize: "0.9rem", color: "#64748b" }}>
            Select your role to access the training platform
          </p>
        </div>

        {/* ── Role cards ── */}
        <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", justifyContent: "center" }}>

          {/* Trainee */}
          <button
            onClick={() => handleRole("trainee")}
            onMouseEnter={() => setHovered("trainee")}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: "220px", padding: "2rem 1.5rem",
              background: hovered === "trainee"
                ? "rgba(0,174,239,0.1)"
                : "rgba(8,15,28,0.85)",
              border: hovered === "trainee"
                ? "1px solid rgba(0,174,239,0.5)"
                : "1px solid rgba(0,174,239,0.12)",
              borderRadius: "16px", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: hovered === "trainee"
                ? "0 0 30px rgba(0,174,239,0.25), 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,174,239,0.15)"
                : "0 4px 20px rgba(0,0,0,0.4)",
              transform: hovered === "trainee" ? "translateY(-4px) scale(1.02)" : "translateY(0) scale(1)",
              backdropFilter: "blur(12px)",
              animationDelay: "0.15s",
            }}>
            <div style={{
              width: "60px", height: "60px", borderRadius: "14px",
              background: hovered === "trainee" ? "rgba(0,174,239,0.2)" : "rgba(0,174,239,0.08)",
              border: "1px solid rgba(0,174,239,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.6rem",
              transition: "all 0.25s",
              boxShadow: hovered === "trainee" ? "0 0 20px rgba(0,174,239,0.3)" : "none",
            }}>🎓</div>
            <span style={{
              color: hovered === "trainee" ? "#00AEEF" : "#e2e8f0",
              fontWeight: 700, fontSize: "1.05rem",
              transition: "color 0.2s",
              textShadow: hovered === "trainee" ? "0 0 10px rgba(0,174,239,0.6)" : "none",
            }}>Trainee</span>
            <span style={{ color: "#64748b", fontSize: "0.8rem", textAlign: "center", lineHeight: 1.6 }}>
              Access training modules, simulator, and assessments
            </span>
          </button>

          {/* Instructor */}
          <button
            onClick={() => handleRole("admin")}
            onMouseEnter={() => setHovered("admin")}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: "220px", padding: "2rem 1.5rem",
              background: hovered === "admin"
                ? "rgba(239,68,68,0.08)"
                : "rgba(8,15,28,0.85)",
              border: hovered === "admin"
                ? "1px solid rgba(239,68,68,0.5)"
                : "1px solid rgba(239,68,68,0.1)",
              borderRadius: "16px", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: hovered === "admin"
                ? "0 0 30px rgba(239,68,68,0.2), 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(239,68,68,0.1)"
                : "0 4px 20px rgba(0,0,0,0.4)",
              transform: hovered === "admin" ? "translateY(-4px) scale(1.02)" : "translateY(0) scale(1)",
              backdropFilter: "blur(12px)",
              animationDelay: "0.25s",
            }}>
            <div style={{
              width: "60px", height: "60px", borderRadius: "14px",
              background: hovered === "admin" ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.6rem",
              transition: "all 0.25s",
              boxShadow: hovered === "admin" ? "0 0 20px rgba(239,68,68,0.25)" : "none",
            }}>🛡️</div>
            <span style={{
              color: hovered === "admin" ? "#ef4444" : "#e2e8f0",
              fontWeight: 700, fontSize: "1.05rem",
              transition: "color 0.2s",
              textShadow: hovered === "admin" ? "0 0 10px rgba(239,68,68,0.5)" : "none",
            }}>Instructor</span>
            <span style={{ color: "#64748b", fontSize: "0.8rem", textAlign: "center", lineHeight: 1.6 }}>
              Manage trainees, monitor progress, and control simulator
            </span>
          </button>
        </div>

        {/* Status bar */}
        <div style={{
          marginTop: "3rem",
          display: "flex", alignItems: "center", gap: "0.75rem",
          fontSize: "0.72rem", color: "#1e3a5f",
          letterSpacing: "0.15em",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: "#00D26A",
            boxShadow: "0 0 8px rgba(0,210,106,0.8)",
            display: "inline-block",
            animation: "blip 2s ease-in-out infinite",
          }} />
          v2.0.0 · SYSTEM READY · {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
        </div>
      </div>
    </div>
  );
}
