import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import V2Layout, { BackButton } from "./layout";
import { MODULES_DATA } from "./_data";

interface Question {
  id: number;
  moduleId: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  explanation: string;
}

type Phase = "select" | "quiz" | "result";

export default function V2Quiz() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answers, setAnswers] = useState<{ question: Question; selected: string; correct: boolean }[]>([]);
  const [loading, setLoading] = useState(false);

  const loadQuestions = async (moduleId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/modules/${moduleId}/questions`);
      const data = await res.json() as Question[];
      // Shuffle and pick up to 10
      const shuffled = data.sort(() => Math.random() - 0.5).slice(0, 10);
      setQuestions(shuffled);
      setSelectedModuleId(moduleId);
      setCurrent(0);
      setSelected(null);
      setShowExplanation(false);
      setAnswers([]);
      setPhase("quiz");
    } catch {
      // fallback: no questions
    }
    setLoading(false);
  };

  const handleAnswer = (option: string) => {
    if (selected !== null) return; // already answered
    setSelected(option);
    setShowExplanation(true);
  };

  const handleNext = () => {
    if (!selected) return;
    const q = questions[current];
    const correct = selected === q.correctOption;
    setAnswers(prev => [...prev, { question: q, selected, correct }]);
    setShowExplanation(false);
    setSelected(null);
    if (current + 1 >= questions.length) {
      setPhase("result");
    } else {
      setCurrent(prev => prev + 1);
    }
  };

  const q = questions[current];
  const correctCount = answers.filter(a => a.correct).length;
  const pct = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;

  const optionLabels: Record<string, string> = { a: "A", b: "B", c: "C", d: "D" };
  const optionMap: Record<string, string> = q ? { a: q.optionA, b: q.optionB, c: q.optionC, d: q.optionD } : {};

  return (
    <V2Layout role="trainee">
      <BackButton to="/v2/trainee" label="← Back" />
      {/* Select phase */}
      {phase === "select" && (
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <div style={{ fontSize: "0.72rem", letterSpacing: "0.15em", color: "#00ff88", marginBottom: "0.5rem" }}>ASSESSMENT</div>
            <h2 style={{ fontSize: "2rem", fontWeight: 900, color: "#e2e8f0", margin: "0 0 0.75rem" }}>Choose a Module Quiz</h2>
            <p style={{ color: "#64748b", fontSize: "0.88rem" }}>Select a module to test your knowledge with 10 questions.</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {MODULES_DATA.map(mod => (
              <button
                key={mod.id}
                onClick={() => loadQuestions(mod.id)}
                disabled={loading}
                style={{
                  width: "100%", padding: "1rem 1.25rem",
                  background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "12px", cursor: "pointer", textAlign: "left",
                  display: "flex", alignItems: "center", gap: "1rem",
                  transition: "all 0.15s", color: "inherit",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(0,255,136,0.3)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
              >
                <div style={{
                  width: "40px", height: "40px", borderRadius: "8px",
                  background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.2rem", flexShrink: 0,
                }}>
                  {mod.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#e2e8f0", fontSize: "0.9rem" }}>Module {mod.order}: {mod.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>{mod.subtitle}</div>
                </div>
                <span style={{ color: "#00ff88", fontSize: "0.75rem" }}>10 Questions →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quiz phase */}
      {phase === "quiz" && q && (
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          {/* Progress */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Question {current + 1} of {questions.length}</span>
              <span style={{ fontSize: "0.78rem", color: "#00ff88" }}>
                Module: {MODULES_DATA.find(m => m.id === selectedModuleId)?.title}
              </span>
            </div>
            <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px" }}>
              <div style={{
                width: `${((current) / questions.length) * 100}%`,
                height: "100%", background: "#00ff88", borderRadius: "2px", transition: "width 0.3s",
              }} />
            </div>
          </div>

          {/* Question */}
          <div style={{
            background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "12px", padding: "1.75rem",
          }}>
            <p style={{ fontSize: "1.05rem", fontWeight: 600, color: "#e2e8f0", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              {q.question}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {(["a", "b", "c", "d"] as const).map(opt => {
                const isSelected = selected === opt;
                const isCorrect = opt === q.correctOption;
                let bg = "rgba(255,255,255,0.04)";
                let border = "rgba(255,255,255,0.08)";
                let color = "#94a3b8";
                if (selected !== null) {
                  if (isCorrect) { bg = "rgba(0,255,136,0.1)"; border = "rgba(0,255,136,0.4)"; color = "#00ff88"; }
                  else if (isSelected && !isCorrect) { bg = "rgba(239,68,68,0.1)"; border = "rgba(239,68,68,0.4)"; color = "#ef4444"; }
                }
                return (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    disabled={selected !== null}
                    style={{
                      width: "100%", padding: "0.85rem 1rem",
                      background: bg, border: `1px solid ${border}`,
                      borderRadius: "8px", cursor: selected !== null ? "default" : "pointer",
                      textAlign: "left", display: "flex", gap: "0.75rem", alignItems: "center",
                      transition: "all 0.15s",
                    }}>
                    <span style={{
                      width: "26px", height: "26px", borderRadius: "50%", flexShrink: 0,
                      background: isSelected ? (isCorrect ? "#00ff88" : "#ef4444") : (selected && isCorrect ? "#00ff88" : "rgba(255,255,255,0.08)"),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.72rem", fontWeight: 700,
                      color: (isSelected || (selected && isCorrect)) ? "#050a0e" : "#64748b",
                    }}>
                      {optionLabels[opt]}
                    </span>
                    <span style={{ color, fontSize: "0.88rem" }}>{optionMap[opt]}</span>
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            {showExplanation && q.explanation && (
              <div style={{
                marginTop: "1rem", padding: "0.85rem 1rem",
                background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.2)",
                borderRadius: "8px", fontSize: "0.83rem", color: "#94a3b8", lineHeight: 1.6,
              }}>
                <span style={{ color: "#00d4ff", fontWeight: 600 }}>Explanation: </span>
                {q.explanation}
              </div>
            )}

            {/* Next button */}
            {selected !== null && (
              <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={handleNext} style={{
                  padding: "0.6rem 1.5rem", background: "#00ff88", border: "none",
                  borderRadius: "8px", cursor: "pointer", fontWeight: 700,
                  color: "#050a0e", fontSize: "0.85rem",
                }}>
                  {current + 1 >= questions.length ? "See Results" : "Next Question →"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result phase */}
      {phase === "result" && (
        <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
          <div style={{
            background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "16px", padding: "2.5rem",
          }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>
              {pct >= 80 ? "🏆" : pct >= 60 ? "✅" : "📚"}
            </div>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 900, color: "#e2e8f0", margin: "0 0 0.5rem" }}>
              {pct >= 80 ? "Excellent!" : pct >= 60 ? "Good Job!" : "Keep Studying!"}
            </h2>
            <div style={{ fontSize: "3rem", fontWeight: 900, color: pct >= 80 ? "#00ff88" : pct >= 60 ? "#fbbf24" : "#ef4444", margin: "1rem 0" }}>
              {pct}%
            </div>
            <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
              {correctCount} correct out of {questions.length} questions
            </p>

            {/* Answer review */}
            <div style={{ marginTop: "1.5rem", textAlign: "left", maxHeight: "300px", overflowY: "auto" }}>
              {answers.map((a, i) => (
                <div key={i} style={{
                  padding: "0.6rem 0.75rem", marginBottom: "0.4rem",
                  background: a.correct ? "rgba(0,255,136,0.06)" : "rgba(239,68,68,0.06)",
                  border: `1px solid ${a.correct ? "rgba(0,255,136,0.2)" : "rgba(239,68,68,0.2)"}`,
                  borderRadius: "6px", fontSize: "0.78rem",
                }}>
                  <span style={{ color: a.correct ? "#00ff88" : "#ef4444", marginRight: "0.5rem" }}>
                    {a.correct ? "✓" : "✗"}
                  </span>
                  <span style={{ color: "#94a3b8" }}>{a.question.question.slice(0, 60)}...</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem" }}>
              <button onClick={() => { setCurrent(0); setPhase("select"); setAnswers([]); }} style={{
                padding: "0.6rem 1.25rem", background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px",
                color: "#94a3b8", cursor: "pointer", fontSize: "0.85rem",
              }}>Try Another Module</button>
              <button onClick={() => loadQuestions(selectedModuleId!)} style={{
                padding: "0.6rem 1.25rem", background: "#00ff88", border: "none",
                borderRadius: "8px", color: "#050a0e", cursor: "pointer",
                fontWeight: 700, fontSize: "0.85rem",
              }}>Retry Quiz</button>
            </div>
          </div>
        </div>
      )}
    </V2Layout>
  );
}
