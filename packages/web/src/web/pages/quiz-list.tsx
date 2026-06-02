import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import BackButton from "../components/BackButton";


type Module = {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  lessonCount: number;
  progress?: number;
};

export default function QuizList({ adminMode = false }: { adminMode?: boolean }) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch("/api/modules")
      .then(r => r.json())
      .then(data => { setModules(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="page" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="radar-grid" style={{ padding: "16px 20px 14px", borderBottom: "1px solid rgba(30,144,255,0.15)" }}>
        <div style={{ marginBottom: 10 }}>
          <BackButton to="/" />
        </div>
        <div className="font-orbitron text-glow" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
          QUIZ
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          Select a module to start
        </div>
      </div>

      <div style={{ padding: "16px", paddingBottom: 16 }}>
        {loading ? (
          [...Array(9)].map((_, i) => (
            <div key={i} className="glass-card" style={{ height: 80, marginBottom: 10, opacity: 0.4, animation: "pulse-glow 1.5s ease infinite" }} />
          ))
        ) : (
          modules.map((mod, i) => (
            <div
              key={mod.id}
              className="glass-card fade-in"
              onClick={() => { if (!adminMode) navigate(`/quiz/${mod.id}`); }}
              style={{
                marginBottom: 10,
                border: `1px solid ${mod.color}30`,
                background: `linear-gradient(135deg, ${mod.color}0d 0%, transparent 100%)`,
                cursor: "pointer",
                animationDelay: `${i * 0.06}s`,
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px",
                transition: "border-color 0.2s"
              }}
            >
              {/* Icon */}
              <div style={{
                width: 46, height: 46, borderRadius: 10, flexShrink: 0,
                background: `${mod.color}20`, border: `1px solid ${mod.color}50`,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 1
              }}>
                <span style={{ fontSize: 18 }}>{mod.icon}</span>
                <span className="font-orbitron" style={{ fontSize: 8, color: mod.color }}>{String(mod.id).padStart(2, "0")}</span>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-orbitron" style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                  {mod.title}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {mod.subtitle}
                </div>
                {(mod.progress ?? 0) > 0 && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <div className="progress-bar" style={{ flex: 1, height: 3 }}>
                      <div className="progress-fill" style={{ width: `${mod.progress}%`, background: `linear-gradient(90deg, ${mod.color}, #00d4ff)` }} />
                    </div>
                    <span className="font-orbitron" style={{ fontSize: 9, color: mod.color }}>{mod.progress}%</span>
                  </div>
                )}
              </div>

              {/* Arrow */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={mod.color} strokeWidth="2" style={{ flexShrink: 0, opacity: 0.7 }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          ))
        )}
      </div>


    </div>
  );
}
