import { useState } from "react";
import { useLocation } from "wouter";

export default function V2Home() {
  const [, setLocation] = useLocation();
  const [hovered, setHovered] = useState<string | null>(null);

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
      minHeight: "100vh", background: "#050a0e",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', sans-serif", padding: "2rem",
    }}>
      {/* Radar glow effect */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "600px", height: "600px",
        background: "radial-gradient(ellipse at center, rgba(0,255,136,0.04) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem", position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: "1rem" }}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="32" r="30" stroke="#00ff88" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
            <circle cx="32" cy="32" r="20" stroke="#00ff88" strokeWidth="1" opacity="0.3" />
            <circle cx="32" cy="32" r="10" stroke="#00ff88" strokeWidth="1" opacity="0.2" />
            <circle cx="32" cy="32" r="3" fill="#00ff88" />
            <line x1="32" y1="32" x2="50" y2="14" stroke="#00ff88" strokeWidth="1.5" opacity="0.6" />
            <circle cx="48" cy="16" r="3" fill="#00ff88" opacity="0.8" />
          </svg>
        </div>
        <h1 style={{ margin: 0, fontSize: "2.5rem", fontWeight: 900, letterSpacing: "0.04em" }}>
          <span style={{ color: "#00ff88" }}>TLS</span>
          <span style={{ color: "#e2e8f0" }}> TRAINER</span>
        </h1>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", letterSpacing: "0.2em", color: "#475569", textTransform: "uppercase" }}>
          Transponder Landing System
        </p>
        <p style={{ margin: "1rem 0 0", fontSize: "0.95rem", color: "#64748b" }}>
          Select your role to access the training platform
        </p>
      </div>

      {/* Role cards */}
      <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", justifyContent: "center", position: "relative", zIndex: 1 }}>
        {/* Trainee */}
        <button
          onClick={() => handleRole("trainee")}
          onMouseEnter={() => setHovered("trainee")}
          onMouseLeave={() => setHovered(null)}
          style={{
            width: "220px", padding: "2rem 1.5rem",
            background: hovered === "trainee" ? "rgba(0,255,136,0.08)" : "rgba(15,23,42,0.8)",
            border: hovered === "trainee" ? "1px solid rgba(0,255,136,0.4)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem",
            transition: "all 0.2s",
            boxShadow: hovered === "trainee" ? "0 0 30px rgba(0,255,136,0.1)" : "none",
          }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "14px",
            background: "rgba(0,255,136,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.5rem",
          }}>🎓</div>
          <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "1.05rem" }}>Trainee</span>
          <span style={{ color: "#64748b", fontSize: "0.8rem", textAlign: "center", lineHeight: 1.5 }}>
            Access training modules, simulator, and assessments
          </span>
        </button>

        {/* Instructor / Admin */}
        <button
          onClick={() => handleRole("admin")}
          onMouseEnter={() => setHovered("admin")}
          onMouseLeave={() => setHovered(null)}
          style={{
            width: "220px", padding: "2rem 1.5rem",
            background: hovered === "admin" ? "rgba(239,68,68,0.08)" : "rgba(15,23,42,0.8)",
            border: hovered === "admin" ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem",
            transition: "all 0.2s",
            boxShadow: hovered === "admin" ? "0 0 30px rgba(239,68,68,0.08)" : "none",
          }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "14px",
            background: "rgba(239,68,68,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.5rem",
          }}>🛡️</div>
          <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "1.05rem" }}>Instructor</span>
          <span style={{ color: "#64748b", fontSize: "0.8rem", textAlign: "center", lineHeight: 1.5 }}>
            Manage trainees, monitor progress, and control simulator
          </span>
        </button>
      </div>

      <p style={{ marginTop: "3rem", fontSize: "0.72rem", color: "#334155", position: "relative", zIndex: 1 }}>
        v2.0.0 • SYSTEM READY
      </p>
    </div>
  );
}
