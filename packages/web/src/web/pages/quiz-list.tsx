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

type Question = {
  id: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  explanation?: string;
  order: number;
};

function AdminQuizView({ mod, onBack }: { mod: Module; onBack: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/modules/${mod.id}/questions`)
      .then(r => r.json())
      .then(data => { setQuestions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [mod.id]);

  const optionLabel = (key: string) => {
    const map: Record<string, string> = { A: "A", B: "B", C: "C", D: "D" };
    return map[key] ?? key;
  };

  const optionText = (q: Question, key: string): string => {
    const map: Record<string, string> = {
      A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD,
    };
    return map[key] ?? "";
  };

  return (
    <div className="page" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="radar-grid" style={{ padding: "16px 20px 14px", borderBottom: `1px solid ${mod.color}30` }}>
        <div style={{ marginBottom: 10 }}>
          <button
            onClick={onBack}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--text-muted)", fontSize: 13, display: "flex",
              alignItems: "center", gap: 6, padding: 0,
            }}
          >
            ← Back to Modules
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${mod.color}20`, border: `1px solid ${mod.color}50`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}>{mod.icon}</div>
          <div>
            <div className="font-orbitron" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
              {mod.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {loading ? "Loading..." : `${questions.length} questions — Answer key shown`}
            </div>
          </div>
        </div>
        {/* Admin badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          marginTop: 10, background: "rgba(0,210,107,0.1)",
          border: "1px solid rgba(0,210,107,0.3)", borderRadius: 6,
          padding: "4px 10px", width: "fit-content",
        }}>
          <span style={{ color: "#00D26A", fontSize: 10 }}>🔑 ADMIN VIEW — Correct answers highlighted</span>
        </div>
      </div>

      <div style={{ padding: "16px", paddingBottom: 40 }}>
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="glass-card" style={{ height: 120, marginBottom: 12, opacity: 0.4 }} />
          ))
        ) : questions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 13 }}>
            No questions found for this module.
          </div>
        ) : (
          questions.map((q, idx) => (
            <div key={q.id} className="glass-card fade-in" style={{
              marginBottom: 14,
              border: `1px solid ${mod.color}25`,
              animationDelay: `${idx * 0.04}s`,
              padding: "16px",
            }}>
              {/* Question */}
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <div style={{
                  minWidth: 26, height: 26, borderRadius: 6,
                  background: `${mod.color}20`, border: `1px solid ${mod.color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: mod.color,
                  fontFamily: "var(--font-orbitron)",
                }}>
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, flex: 1 }}>
                  {q.question}
                </div>
              </div>

              {/* Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(["A", "B", "C", "D"] as const).map(key => {
                  const isCorrect = q.correctOption === key;
                  return (
                    <div key={key} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 8,
                      background: isCorrect ? "rgba(0,210,107,0.12)" : "rgba(255,255,255,0.03)",
                      border: isCorrect
                        ? "2px solid #00D26A"
                        : "1px solid rgba(255,255,255,0.07)",
                      transition: "all 0.2s",
                    }}>
                      {/* Option letter */}
                      <div style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                        background: isCorrect ? "#00D26A" : "rgba(255,255,255,0.07)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700,
                        color: isCorrect ? "#000" : "rgba(255,255,255,0.5)",
                        fontFamily: "var(--font-orbitron)",
                      }}>
                        {optionLabel(key)}
                      </div>
                      {/* Option text */}
                      <div style={{
                        fontSize: 12, lineHeight: 1.4,
                        color: isCorrect ? "#00D26A" : "rgba(255,255,255,0.7)",
                        fontWeight: isCorrect ? 600 : 400,
                        flex: 1,
                      }}>
                        {optionText(q, key)}
                      </div>
                      {/* Checkmark */}
                      {isCorrect && (
                        <span style={{ fontSize: 16, flexShrink: 0 }}>✅</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              {q.explanation && (
                <div style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  background: "rgba(0,174,239,0.06)",
                  border: "1px solid rgba(0,174,239,0.2)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "rgba(0,174,239,0.9)",
                  lineHeight: 1.5,
                }}>
                  💡 {q.explanation}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function QuizList({ adminMode = false }: { adminMode?: boolean }) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMod, setSelectedMod] = useState<Module | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch("/api/modules")
      .then(r => r.json())
      .then(data => { setModules(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Admin: show selected module questions
  if (adminMode && selectedMod) {
    return <AdminQuizView mod={selectedMod} onBack={() => setSelectedMod(null)} />;
  }

  return (
    <div className="page" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="radar-grid" style={{ padding: "16px 20px 14px", borderBottom: "1px solid rgba(30,144,255,0.15)" }}>
        {!adminMode && (
          <div style={{ marginBottom: 10 }}>
            <BackButton to="/" />
          </div>
        )}
        <div className="font-orbitron text-glow" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
          QUIZ
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          {adminMode ? "Select a module to view all questions & answers" : "Select a module to start"}
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
              onClick={() => adminMode ? setSelectedMod(mod) : navigate(`/quiz/${mod.id}`)}
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
                {!adminMode && (mod.progress ?? 0) > 0 && (
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
