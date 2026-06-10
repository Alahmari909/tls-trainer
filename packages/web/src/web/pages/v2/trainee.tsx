import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import V2Layout from "./layout";
import { MODULES_DATA } from "./_data";

type TabKey = "basics" | "advanced" | "quiz" | "manuals" | "status" | "chat";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "basics", label: "TLS BASICS", icon: "📋" },
  { key: "advanced", label: "TLS ADVANCED", icon: "⚙️" },
  { key: "quiz", label: "QUIZ", icon: "✦" },
  { key: "manuals", label: "MANUALS", icon: "📚" },
  { key: "status", label: "LIVE STATUS", icon: "◎" },
  { key: "chat", label: "CHAT", icon: "💬" },
];

// Basic modules: 1–6; Advanced: 7–9
const BASIC_IDS = [1, 2, 3, 4, 5, 6];
const ADVANCED_IDS = [7, 8, 9];

export default function V2Trainee() {
  const [activeTab, setActiveTab] = useState<TabKey>("basics");
  const [, setLocation] = useLocation();
  const [quizScores, setQuizScores] = useState<Record<number, number>>({});

  // Load progress from localStorage
  const getProgress = (moduleId: number): number => {
    const p = localStorage.getItem(`v2_progress_${moduleId}`);
    return p ? parseFloat(p) : 0;
  };

  const displayModules = activeTab === "advanced"
    ? MODULES_DATA.filter(m => ADVANCED_IDS.includes(m.id))
    : MODULES_DATA.filter(m => BASIC_IDS.includes(m.id));

  // Stats
  const completedCount = MODULES_DATA.filter(m => getProgress(m.id) >= 100).length;

  const openModule = (moduleId: number) => {
    setLocation(`/v2/module/${moduleId}`);
  };

  return (
    <V2Layout role="trainee">
      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "STREAK", value: "0", suffix: "d", icon: "🔥" },
          { label: "MODULES", value: `${completedCount}`, suffix: "/9", icon: "📚" },
          { label: "AVERAGE", value: "0", suffix: "%", icon: "🏆" },
          { label: "TIME", value: "0", suffix: "h", icon: "⏱" },
        ].map(stat => (
          <div key={stat.label} style={{
            background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "12px", padding: "1.25rem 1rem",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
          }}>
            <span style={{ fontSize: "1.5rem" }}>{stat.icon}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.1rem" }}>
              <span style={{ fontSize: "1.75rem", fontWeight: 700, color: "#e2e8f0" }}>{stat.value}</span>
              <span style={{ fontSize: "0.9rem", color: "#64748b" }}>{stat.suffix}</span>
            </div>
            <span style={{ fontSize: "0.68rem", letterSpacing: "0.12em", color: "#475569" }}>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: "0.5rem", marginBottom: "2rem",
        overflowX: "auto", paddingBottom: "0.25rem",
        scrollbarWidth: "none",
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              if (tab.key === "quiz") { setLocation("/v2/quiz"); return; }
              if (tab.key === "manuals") { setLocation("/v2/documents"); return; }
              if (tab.key === "status") { setLocation("/v2/simulator"); return; }
              if (tab.key === "chat") { setLocation("/v2/profile"); return; }
              setActiveTab(tab.key);
            }}
            style={{
              whiteSpace: "nowrap", padding: "0.45rem 1rem",
              borderRadius: "20px", cursor: "pointer", fontSize: "0.75rem",
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? "#00ff88" : "#64748b",
              background: activeTab === tab.key ? "rgba(0,255,136,0.12)" : "rgba(15,23,42,0.6)",
              border: activeTab === tab.key ? "1px solid rgba(0,255,136,0.3)" : "1px solid rgba(255,255,255,0.06)",
              transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: "0.4rem",
            }}>
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Module list */}
      {(activeTab === "basics" || activeTab === "advanced") && (
        <div>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <p style={{ fontSize: "0.72rem", letterSpacing: "0.15em", color: "#00ff88", marginBottom: "0.5rem" }}>
              TRAINING MODULES
            </p>
            <h2 style={{ fontSize: "2.25rem", fontWeight: 900, color: "#e2e8f0", margin: "0 0 0.75rem" }}>
              Start Your Journey
            </h2>
            <p style={{ color: "#64748b", maxWidth: "520px", margin: "0 auto", lineHeight: 1.6, fontSize: "0.9rem" }}>
              Master the Transponder Landing System through structured, interactive modules designed for real-world application.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {displayModules.map((mod, idx) => {
              const progress = getProgress(mod.id);
              const isFirst = idx === 0 && activeTab === "basics";
              const isUnlocked = true; // all unlocked

              return (
                <div
                  key={mod.id}
                  onClick={() => openModule(mod.id)}
                  style={{
                    background: "rgba(15,23,42,0.8)",
                    border: isFirst ? "1px solid rgba(0,255,136,0.3)" : "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "12px", padding: "1.1rem 1.25rem",
                    display: "flex", alignItems: "center", gap: "1rem",
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(0,255,136,0.3)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = isFirst ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.06)")}
                >
                  {/* Number badge */}
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "8px",
                    background: isUnlocked ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.05)",
                    border: isUnlocked ? "1px solid rgba(0,255,136,0.3)" : "1px solid rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.78rem", fontWeight: 700,
                    color: isUnlocked ? "#00ff88" : "#475569", flexShrink: 0,
                  }}>
                    {isUnlocked ? String(mod.order).padStart(2, "0") : "🔒"}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: isUnlocked ? "#e2e8f0" : "#475569", fontSize: "0.92rem" }}>
                      {mod.title}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.15rem" }}>
                      {mod.subtitle}
                    </div>
                  </div>

                  {/* Right: lessons + progress */}
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0 }}>
                    <span style={{ fontSize: "0.75rem", color: "#475569" }}>
                      {mod.lessons.length} lessons
                    </span>
                    <div style={{ width: "80px", height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px" }}>
                      <div style={{
                        width: `${progress}%`, height: "100%",
                        background: "#00ff88", borderRadius: "2px",
                        transition: "width 0.3s",
                      }} />
                    </div>
                    <span style={{ color: "#475569", fontSize: "1rem" }}>›</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </V2Layout>
  );
}
