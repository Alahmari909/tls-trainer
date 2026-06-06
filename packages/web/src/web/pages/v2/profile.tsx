import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import V2Layout, { BackButton } from "./layout";
import { MODULES_DATA } from "./_data";

export default function V2Profile() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState(sessionStorage.getItem("v2_trainee_name") || "Trainee");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);

  const getProgress = (moduleId: number) => {
    const p = localStorage.getItem(`v2_progress_${moduleId}`);
    return p ? parseFloat(p) : 0;
  };

  const completedModules = MODULES_DATA.filter(m => getProgress(m.id) >= 100);
  const totalProgress = Math.round(MODULES_DATA.reduce((sum, m) => sum + getProgress(m.id), 0) / MODULES_DATA.length);

  const saveProfile = () => {
    sessionStorage.setItem("v2_trainee_name", editName);
    setName(editName);
    setEditing(false);
  };

  return (
    <V2Layout role="trainee" traineeName={name}>
      <BackButton to="/v2/trainee" label="← Back" />
      <div style={{ maxWidth: "700px", margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ fontSize: "0.72rem", letterSpacing: "0.15em", color: "#00ff88", marginBottom: "0.5rem" }}>ACCOUNT</div>
          <h2 style={{ fontSize: "1.9rem", fontWeight: 900, color: "#e2e8f0", margin: 0 }}>Profile</h2>
        </div>

        {/* Profile card */}
        <div style={{
          background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "12px", padding: "1.5rem", marginBottom: "1.25rem",
          display: "flex", gap: "1.5rem", alignItems: "center",
        }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "50%",
            background: "rgba(0,255,136,0.15)", border: "2px solid rgba(0,255,136,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.75rem", flexShrink: 0,
          }}>🎓</div>
          <div style={{ flex: 1 }}>
            {editing ? (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(0,255,136,0.3)",
                    borderRadius: "6px", padding: "0.4rem 0.75rem", color: "#e2e8f0",
                    fontSize: "1rem", fontWeight: 700, outline: "none",
                  }}
                  onKeyDown={e => e.key === "Enter" && saveProfile()}
                  autoFocus
                />
                <button onClick={saveProfile} style={{ padding: "0.4rem 0.75rem", background: "#00ff88", border: "none", borderRadius: "6px", cursor: "pointer", color: "#050a0e", fontWeight: 700 }}>Save</button>
                <button onClick={() => setEditing(false)} style={{ padding: "0.4rem 0.75rem", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", cursor: "pointer", color: "#64748b" }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "1.1rem" }}>{name}</span>
                <button onClick={() => setEditing(true)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "0.2rem 0.6rem", cursor: "pointer", color: "#64748b", fontSize: "0.72rem" }}>Edit</button>
              </div>
            )}
            <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: "0.25rem" }}>TLS Trainee</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
          {[
            { label: "Modules Completed", value: completedModules.length, total: 9 },
            { label: "Overall Progress", value: `${totalProgress}%`, total: null },
            { label: "Lessons Read", value: MODULES_DATA.reduce((sum, m) => sum + (getProgress(m.id) > 0 ? m.lessons.length : 0), 0), total: null },
          ].map(stat => (
            <div key={stat.label} style={{
              background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "10px", padding: "1rem", textAlign: "center",
            }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#00ff88" }}>
                {stat.value}{stat.total !== null ? <span style={{ fontSize: "1rem", color: "#475569" }}>/{stat.total}</span> : ""}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#475569", marginTop: "0.25rem" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Module progress */}
        <div style={{
          background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "12px", padding: "1.25rem",
        }}>
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.12em", color: "#64748b", marginBottom: "1rem" }}>MODULE PROGRESS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {MODULES_DATA.map(mod => {
              const progress = getProgress(mod.id);
              return (
                <div key={mod.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ width: "28px", fontSize: "0.75rem", color: "#475569", textAlign: "right" }}>{String(mod.order).padStart(2, "0")}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.8rem", color: progress > 0 ? "#94a3b8" : "#475569" }}>{mod.title}</span>
                      <span style={{ fontSize: "0.72rem", color: progress >= 100 ? "#00ff88" : "#475569" }}>{progress}%</span>
                    </div>
                    <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px" }}>
                      <div style={{ width: `${progress}%`, height: "100%", background: progress >= 100 ? "#00ff88" : "#1e90ff", borderRadius: "2px", transition: "width 0.3s" }} />
                    </div>
                  </div>
                  <div style={{ width: "20px", fontSize: "0.75rem" }}>{progress >= 100 ? "✓" : ""}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </V2Layout>
  );
}
