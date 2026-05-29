import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import BackButton from "../components/BackButton";
import { telegramTrack, getSession } from "../hooks/useTelegramTrack";
import { loadSettings } from "../hooks/useSettings";
import { playAlertTone } from "../lib/audio";

type Question = {
  id: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  explanation: string;
};

type Module = {
  id: number;
  title: string;
  subtitle: string;
  color: string;
  icon: string;
};

export default function Quiz() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = parseInt(params.moduleId ?? "1");
  const [, navigate] = useLocation();

  const [mod, setMod] = useState<Module | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<{ correct: boolean; selected: string; question: Question }[]>([]);
  const [loading, setLoading] = useState(true);
  const [xpEarned, setXpEarned] = useState(0);
  const [newBadges, setNewBadges] = useState<{ name: string; icon: string }[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const quizStartFired = useRef(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/modules").then(r => r.json()),
      fetch(`/api/modules/${moduleId}/questions`).then(r => r.json()),
    ]).then(([mods, qs]) => {
      const m = mods.find((m: Module) => m.id === moduleId);
      setMod(m ?? null);
      setQuestions(qs);
      setLoading(false);
      // Fire quiz_start once module title is known
      if (!quizStartFired.current && m?.title) {
        quizStartFired.current = true;
        telegramTrack.quizStart(m.title);
      }
    }).catch(() => setLoading(false));
  }, [moduleId]);

  const q = questions[current];
  const color = mod?.color ?? "#1e90ff";
  const opts = ["A", "B", "C", "D"] as const;

  const handleSelect = (opt: string) => {
    if (answered || !q) return;
    setSelected(opt);
    setAnswered(true);
    const correct = opt.toLowerCase() === q.correctOption.toLowerCase();
    if (correct) setScore(s => s + 1);
    setResults(prev => [...prev, { correct, selected: opt, question: q! }]);
    // Sound feedback — only if enabled in settings
    if (loadSettings().soundEffects) {
      playAlertTone(correct ? "message" : "warning");
    }
  };

  const handleNext = () => {
    if (current + 1 >= questions.length) {
      setFinished(true);
      const lastCorrect = selected != null && questions[current] != null
        ? selected.toLowerCase() === questions[current]!.correctOption.toLowerCase()
        : false;
      const finalResults = answered
        ? results
        : [...results, { correct: lastCorrect, selected: selected ?? "", question: questions[current]! }];
      const finalScore = finalResults.filter(r => r.correct).length;
      const finalTotal = questions.length;
      const pct = finalTotal > 0 ? Math.round((finalScore / finalTotal) * 100) : 0;
      const passed = pct >= 70;
      const traineeId = getSession()?.id ?? 'user-1';

      // Submit to correct endpoint
      fetch('/api/quiz/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traineeId,
          moduleId,
          moduleName: mod?.title ?? '',
          score: finalScore,
          total: finalTotal,
        }),
      })
        .then(r => r.json().then(data => ({ status: r.status, data })))
        .then(({ status, data }) => {
          if (status === 403) { setSubmitError(data.message ?? 'Submission blocked.'); return; }
          setXpEarned(data.xpEarned ?? 0);
          setNewBadges(data.newlyUnlocked ?? []);
        })
        .catch(() => {});

      // Telegram: pass or fail
      if (mod?.title) {
        telegramTrack.quizFinish(mod.title, finalScore, finalTotal);
        // Post activity for pass/fail tracking
        fetch('/api/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            traineeId,
            event: passed ? 'quiz_pass' : 'quiz_fail',
            detail: JSON.stringify({ moduleId, moduleName: mod.title, score: finalScore, total: finalTotal, pct }),
          }),
        }).catch(() => {});
      }
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
      setAnswered(false);
    }
  };

  const handleRestart = () => {
    setCurrent(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setFinished(false);
    setResults([]);
  };

  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  if (loading) {
    return (
      <div className="page" style={{ background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="font-orbitron text-glow" style={{ color: "#1e90ff", fontSize: 14 }}>LOADING...</div>
      </div>
    );
  }

  if (!mod || questions.length === 0) {
    return (
      <div className="page" style={{ background: "var(--bg-primary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div className="font-orbitron" style={{ color: "var(--text-muted)", fontSize: 13 }}>NO QUESTIONS FOUND</div>
        <button onClick={() => navigate("/quiz")} style={{ padding: "10px 20px", background: "#1e90ff20", border: "1px solid #1e90ff50", borderRadius: 8, color: "#1e90ff", fontFamily: "Orbitron", fontSize: 11, cursor: "pointer" }}>
          ← BACK
        </button>
      </div>
    );
  }

  // ─── RESULTS SCREEN ───────────────────────────────────────────
  if (finished) {
    const grade = pct >= 90 ? "EXCELLENT" : pct >= 70 ? "GOOD" : pct >= 50 ? "PASS" : "FAIL";
    const gradeColor = pct >= 90 ? "#00ff88" : pct >= 70 ? color : pct >= 50 ? "#ffaa00" : "#ff4444";

    return (
      <div className="page" style={{ background: "var(--bg-primary)", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ padding: "48px 20px 20px", borderBottom: `1px solid ${color}25` }}>
          <div style={{ marginBottom: 16 }}>
            <BackButton to="/quiz" label="QUIZ LIST" />
          </div>
          <div className="font-orbitron text-glow" style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>RESULTS</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{mod.icon} {mod.title}</div>
        </div>

        <div style={{ padding: "20px 16px" }}>
          {/* Score card */}
          <div className="glass-card" style={{ padding: 24, textAlign: "center", marginBottom: 20, border: `1px solid ${gradeColor}40`, background: `${gradeColor}08` }}>
            <div className="font-orbitron" style={{ fontSize: 48, fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{pct}%</div>
            <div className="font-orbitron" style={{ fontSize: 16, color: gradeColor, marginTop: 8, letterSpacing: "0.15em" }}>{grade}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
              {score} / {questions.length} correct
            </div>

            {/* Progress bar */}
            <div className="progress-bar" style={{ marginTop: 16, height: 8 }}>
              <div className="progress-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${gradeColor}, ${color})`, transition: "width 1s ease" }} />
            </div>
          </div>

          {/* Suspended/blocked submit error */}
          {submitError && (
            <div style={{
              padding: "12px 16px", marginBottom: 12,
              background: "rgba(255,77,77,0.1)", border: "1px solid rgba(255,77,77,0.35)",
              borderRadius: 10, color: "#FF4D4D", fontSize: 12, fontFamily: "Rajdhani",
              textAlign: "center",
            }}>⚠️ {submitError}</div>
          )}

          {/* XP earned banner */}
          {xpEarned > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '12px 20px', marginBottom: 12,
              background: 'rgba(201,166,107,0.1)', border: '1px solid rgba(201,166,107,0.4)',
              borderRadius: 10,
            }}>
              <span style={{ fontSize: 20 }}>⚡</span>
              <div>
                <div className="font-orbitron" style={{ fontSize: 14, color: '#C9A66B', fontWeight: 700 }}>+{xpEarned} XP EARNED</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Added to your profile</div>
              </div>
            </div>
          )}

          {/* New badges */}
          {newBadges.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="font-orbitron" style={{ fontSize: 9, color: '#FFD166', letterSpacing: '0.15em', marginBottom: 8 }}>
                🏅 NEW BADGE{newBadges.length > 1 ? 'S' : ''} UNLOCKED
              </div>
              {newBadges.map((b, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.3)',
                  borderRadius: 8, marginBottom: 6,
                }}>
                  <span style={{ fontSize: 22 }}>{b.icon}</span>
                  <div className="font-orbitron" style={{ fontSize: 11, color: '#FFD166' }}>{b.name}</div>
                </div>
              ))}
            </div>
          )}

          {/* Answer review */}
          <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 12, fontFamily: "Orbitron" }}>
            ANSWER REVIEW
          </div>
          {results.map((r, i) => (
            <div key={i} className="glass-card" style={{ marginBottom: 10, border: `1px solid ${r.correct ? "#00ff8830" : "#ff444430"}`, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                  background: r.correct ? "#00ff8820" : "#ff444420",
                  border: `1px solid ${r.correct ? "#00ff8860" : "#ff444460"}`,
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {r.correct
                    ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00ff88" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--text-primary)", marginBottom: 6, lineHeight: 1.5 }}>
                    Q{i + 1}. {r.question.question}
                  </div>
                  {!r.correct && (
                    <div style={{ fontSize: 10, color: "#ff4444", marginBottom: 4 }}>
                      Your answer: {r.selected}. {r.question[`option${r.selected}` as keyof Question] as string}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "#00ff88" }}>
                    ✓ {r.question[`option${r.question.correctOption.toUpperCase()}` as keyof Question] as string}
                  </div>
                  {r.question.explanation && (
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5, fontStyle: "italic" }}>
                      {r.question.explanation}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 16, paddingBottom: 16 }}>
            <button onClick={handleRestart} style={{
              flex: 1, padding: "14px", background: `${color}15`, border: `1px solid ${color}50`,
              borderRadius: 10, color: color, fontFamily: "Orbitron", fontSize: 11,
              letterSpacing: "0.1em", cursor: "pointer"
            }}>
              RETRY QUIZ
            </button>
            <button onClick={() => navigate("/quiz")} style={{
              flex: 1, padding: "14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, color: "var(--text-secondary)", fontFamily: "Orbitron", fontSize: 11,
              letterSpacing: "0.1em", cursor: "pointer"
            }}>
              ALL QUIZZES
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── QUIZ SCREEN ──────────────────────────────────────────────
  if (!q) return null;
  const progress = ((current) / questions.length) * 100;

  return (
    <div className="page" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div style={{ padding: "48px 20px 16px", borderBottom: `1px solid ${color}25` }}>
        <div style={{ marginBottom: 12 }}>
          <BackButton to="/quiz" label="QUIZ LIST" />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div className="font-orbitron" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              {mod.icon} {mod.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{mod.subtitle}</div>
          </div>
          <div className="font-orbitron" style={{ fontSize: 12, color: color }}>
            {current + 1}/{questions.length}
          </div>
        </div>

        {/* Progress bar */}
        <div className="progress-bar" style={{ height: 4 }}>
          <div className="progress-fill" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${color}, #00d4ff)`, transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* Question */}
      <div style={{ padding: "20px 16px", flex: 1 }}>
        <div className="glass-card" style={{ padding: "20px 18px", marginBottom: 16, border: `1px solid ${color}30`, background: `${color}08` }}>
          <div className="font-orbitron" style={{ fontSize: 9, color: color, letterSpacing: "0.15em", marginBottom: 10 }}>
            QUESTION {current + 1}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6, fontWeight: 500 }}>
            {q.question}
          </div>
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {opts.map((opt) => {
            const val = q[`option${opt}` as keyof Question] as string;
            const isSelected = selected === opt;
            const isCorrect = opt.toLowerCase() === q.correctOption.toLowerCase();
            const showResult = answered;

            let bg = "rgba(255,255,255,0.03)";
            let border = "rgba(255,255,255,0.08)";
            let textColor = "var(--text-secondary)";

            if (showResult && isCorrect) {
              bg = "#00ff8818"; border = "#00ff8860"; textColor = "#00ff88";
            } else if (showResult && isSelected && !isCorrect) {
              bg = "#ff444418"; border = "#ff444460"; textColor = "#ff4444";
            } else if (!showResult && isSelected) {
              bg = `${color}20`; border = `${color}70`; textColor = color;
            }

            return (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                disabled={answered}
                style={{
                  width: "100%", padding: "14px 16px",
                  background: bg, border: `1px solid ${border}`,
                  borderRadius: 10, cursor: answered ? "default" : "pointer",
                  display: "flex", alignItems: "center", gap: 12,
                  transition: "all 0.2s", textAlign: "left"
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: showResult && isCorrect ? "#00ff8825" : showResult && isSelected && !isCorrect ? "#ff444425" : `${color}15`,
                  border: `1px solid ${showResult && isCorrect ? "#00ff8870" : showResult && isSelected && !isCorrect ? "#ff444470" : color + "50"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Orbitron", fontSize: 10, color: textColor, fontWeight: 700
                }}>
                  {showResult && isCorrect
                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00ff88" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    : showResult && isSelected && !isCorrect
                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    : opt
                  }
                </div>
                <span style={{ fontSize: 13, color: textColor, lineHeight: 1.4 }}>{val}</span>
              </button>
            );
          })}
        </div>

        {/* Explanation + Next */}
        {answered && (
          <div style={{ marginTop: 16 }}>
            {q.explanation && (
              <div className="glass-card" style={{ padding: "12px 16px", marginBottom: 12, border: `1px solid ${color}25`, background: `${color}08` }}>
                <div className="font-orbitron" style={{ fontSize: 9, color: color, letterSpacing: "0.12em", marginBottom: 6 }}>EXPLANATION</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>{q.explanation}</div>
              </div>
            )}
            <button
              onClick={handleNext}
              style={{
                width: "100%", padding: "14px",
                background: `${color}20`, border: `1px solid ${color}60`,
                borderRadius: 10, color: color,
                fontFamily: "Orbitron", fontSize: 12, letterSpacing: "0.1em",
                cursor: "pointer"
              }}
            >
              {current + 1 >= questions.length ? "SEE RESULTS →" : "NEXT QUESTION →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
