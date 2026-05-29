import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import BackButton from "../components/BackButton";
import { telegramTrack, getSession } from "../hooks/useTelegramTrack";
import { loadSettings } from "../hooks/useSettings";
import { playAlertTone } from "../lib/audio";
import { useLanguage } from "../hooks/useLanguage";

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
  const { t } = useLanguage();

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
  const [timeLeft, setTimeLeft] = useState(45);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const quizStartFired = useRef(false);

  // Retake control
  const [hasAttempt, setHasAttempt] = useState(false);
  const [retakeStatus, setRetakeStatus] = useState<'none' | 'pending' | 'approved' | 'denied'>('none');
  const [retakeRequesting, setRetakeRequesting] = useState(false);
  const [retakeRequested, setRetakeRequested] = useState(false);

  // Shuffle helper
  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }

  useEffect(() => {
    const session = getSession();
    Promise.all([
      fetch("/api/modules").then(r => r.json()),
      fetch(`/api/modules/${moduleId}/questions?traineeId=${session?.id ?? ''}`).then(r => r.json()),
      session
        ? fetch(`/api/trainee/quiz-status/${moduleId}?traineeId=${session.id}`).then(r => r.json()).catch(() => ({ hasAttempt: false, retakeStatus: 'none' }))
        : Promise.resolve({ hasAttempt: false, retakeStatus: 'none' }),
    ]).then(([mods, qs, status]) => {
      const m = mods.find((m: Module) => m.id === moduleId);
      setMod(m ?? null);
      setQuestions(shuffle(qs));
      setHasAttempt((status as any).hasAttempt ?? false);
      setRetakeStatus((status as any).retakeStatus ?? 'none');
      setLoading(false);
      if (!quizStartFired.current && m?.title) {
        quizStartFired.current = true;
        telegramTrack.quizStart(m.title);
      }
    }).catch(() => setLoading(false));
  }, [moduleId]);

  // Timer — resets on each new question
  useEffect(() => {
    if (loading || finished || answered) return;
    setTimeLeft(45);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Time's up — mark as wrong and advance
          if (!answered) {
            setAnswered(true);
            setSelected(null);
            setResults(r => [...r, { correct: false, selected: "", question: questions[current]! }]);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, loading, finished]);

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

  const handleRetakeRequest = async () => {
    const session = getSession();
    if (!session || !mod) return;
    setRetakeRequesting(true);
    try {
      await fetch('/api/trainee/retake-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traineeId: session.id, traineeName: session.name, moduleId, moduleName: mod.title }),
      });
      setRetakeRequested(true);
      setRetakeStatus('pending');
    } catch { /* ignore */ }
    setRetakeRequesting(false);
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
        <button onClick={() => navigate("/quiz")} style={{ padding: "10px 20px", background: "#1e90ff20", border: "1px solid #1e90ff50", borderRadius: 8, color: "#1e90ff", fontFamily: "Inter", fontSize: 11, cursor: "pointer" }}>
          ← BACK
        </button>
      </div>
    );
  }

  // ─── BLOCKED SCREEN — already attempted, retake not approved ──
  if (hasAttempt && retakeStatus !== 'approved') {
    const statusMsg = retakeStatus === 'pending'
      ? { icon: "⏳", title: "RETAKE REQUESTED", text: "Your retake request is pending instructor approval. You will be notified when it is approved.", color: "#FFD166" }
      : retakeStatus === 'denied'
      ? { icon: "🚫", title: "RETAKE DENIED", text: "Your retake request was denied by your instructor. Contact them for more information.", color: "#FF4D4D" }
      : { icon: "🔒", title: "QUIZ COMPLETED", text: "You have already completed this quiz. Request a retake from your instructor to attempt it again.", color: "#00AEEF" };

    return (
      <div className="page" style={{ background: "var(--bg-primary)" }}>
        <div style={{ padding: "52px 20px 16px" }}>
          <BackButton to="/quiz" label="QUIZ LIST" />
        </div>
        <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
          <div style={{ fontSize: 56 }}>{statusMsg.icon}</div>
          <div className="font-orbitron" style={{ fontSize: 14, fontWeight: 700, color: statusMsg.color, letterSpacing: "0.1em" }}>
            {statusMsg.title}
          </div>
          <div className="glass-card" style={{ padding: "16px 20px", border: `1px solid ${statusMsg.color}30`, maxWidth: 320 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              {mod.icon} <strong style={{ color: "var(--text-primary)" }}>{mod.title}</strong>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.6 }}>
              {statusMsg.text}
            </div>
          </div>
          {retakeStatus === 'none' && (
            <button
              onClick={handleRetakeRequest}
              disabled={retakeRequesting || retakeRequested}
              style={{
                padding: "14px 28px", borderRadius: 10, cursor: retakeRequesting ? "not-allowed" : "pointer",
                background: retakeRequested ? "rgba(0,210,106,0.1)" : "rgba(0,174,239,0.12)",
                border: `1px solid ${retakeRequested ? "#00D26A60" : "#00AEEF60"}`,
                color: retakeRequested ? "#00D26A" : "#00AEEF",
                fontFamily: "Inter", fontSize: 12, letterSpacing: "0.08em",
              }}
            >
              {retakeRequested ? t("retake_sent") : retakeRequesting ? t("retake_requesting") : t("request_retake")}
            </button>
          )}
          <button onClick={() => navigate("/quiz")} style={{
            padding: "10px 20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, color: "var(--text-muted)", fontFamily: "Inter", fontSize: 11, cursor: "pointer",
          }}>
            ← ALL QUIZZES
          </button>
        </div>
      </div>
    );
  }

  // ─── RESULTS SCREEN ───────────────────────────────────────────
  if (finished) {

    return (
      <div className="page" style={{ background: "var(--bg-primary)" }}>
        <div style={{ padding: "52px 20px 16px" }}>
          <BackButton to="/quiz" label="QUIZ LIST" />
        </div>
        <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
          <div style={{ fontSize: 64 }}>📋</div>
          <div className="font-orbitron" style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.1em" }}>
            {t("quiz_submitted")}
          </div>
          <div className="glass-card" style={{ padding: "20px", border: `1px solid ${color}30`, maxWidth: 320 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              {mod.icon} <strong style={{ color: "var(--text-primary)" }}>{mod.title}</strong>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.7 }}>
              Your answers have been recorded.{"\n"}
              Your instructor will review your results and share them with you.
            </div>
          </div>
          {submitError && (
            <div style={{ padding: "12px 16px", background: "rgba(255,77,77,0.1)", border: "1px solid rgba(255,77,77,0.35)", borderRadius: 10, color: "#FF4D4D", fontSize: 12, maxWidth: 300 }}>
              ⚠️ {submitError}
            </div>
          )}
          <button onClick={() => navigate("/quiz")} style={{
            padding: "14px 28px", background: `${color}15`, border: `1px solid ${color}50`,
            borderRadius: 10, color: color, fontFamily: "Inter", fontSize: 12,
            letterSpacing: "0.08em", cursor: "pointer",
          }}>
            ← ALL QUIZZES
          </button>
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div className="font-orbitron" style={{ fontSize: 12, color: color }}>
              {current + 1}/{questions.length}
            </div>
            <div style={{
              fontSize: 13, fontWeight: 700, fontFamily: "Inter",
              color: timeLeft <= 10 ? "#FF4D4D" : timeLeft <= 20 ? "#FFD166" : "#00D26A",
              background: timeLeft <= 10 ? "rgba(255,77,77,0.1)" : "rgba(0,210,106,0.08)",
              border: `1px solid ${timeLeft <= 10 ? "rgba(255,77,77,0.4)" : "rgba(0,210,106,0.25)"}`,
              borderRadius: 6, padding: "2px 8px", minWidth: 44, textAlign: "center",
              transition: "color 0.3s, background 0.3s",
            }}>
              {answered ? "✓" : `${timeLeft}s`}
            </div>
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
            const showResult = answered;

            let bg = "rgba(255,255,255,0.03)";
            let border = "rgba(255,255,255,0.08)";
            let textColor = "var(--text-secondary)";

            if (showResult && isSelected) {
              // Selected answer — show module color only, no correct/wrong indication
              bg = `${color}18`; border = `${color}60`; textColor = color;
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
                  background: `${color}15`,
                  border: `1px solid ${isSelected ? color + "70" : color + "30"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Inter", fontSize: 10, color: textColor, fontWeight: 700
                }}>
                  {opt}
                </div>
                <span style={{ fontSize: 13, color: textColor, lineHeight: 1.4 }}>{val}</span>
              </button>
            );
          })}
        </div>

        {/* Next button — shown after answering */}
        {answered && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={handleNext}
              style={{
                width: "100%", padding: "14px",
                background: `${color}20`, border: `1px solid ${color}60`,
                borderRadius: 10, color: color,
                fontFamily: "Inter", fontSize: 12, letterSpacing: "0.1em",
                cursor: "pointer"
              }}
            >
              {current + 1 >= questions.length ? t("submit_quiz") : t("next_question")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
