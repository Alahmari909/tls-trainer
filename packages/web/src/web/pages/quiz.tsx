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
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correctOption?: string;
  correct_option?: string;
  explanation: string;
};

type Module = {
  id: number;
  title: string;
  subtitle: string;
  color: string;
  icon: string;
};

function launchConfetti() {
  const colors = ['#00AEEF','#FFD166','#00D26A','#FF4D4D','#35D4FF','#C9A66B'];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.top = '-10px';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDelay = Math.random() * 1.5 + 's';
    el.style.width = (8 + Math.random() * 8) + 'px';
    el.style.height = (8 + Math.random() * 8) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}

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
    const correctAns = (q.correctOption ?? q.correct_option ?? '').toLowerCase();
    const correct = opt.toLowerCase() === correctAns;
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
        ? selected.toLowerCase() === (questions[current]!.correctOption ?? questions[current]!.correct_option ?? '').toLowerCase()
        : false;
      const finalResults = answered
        ? results
        : [...results, { correct: lastCorrect, selected: selected ?? "", question: questions[current]! }];
      const finalScore = finalResults.filter(r => r.correct).length;
      const finalTotal = questions.length;
      const pct = finalTotal > 0 ? Math.round((finalScore / finalTotal) * 100) : 0;
      const passed = pct >= 70;
      if (passed) launchConfetti();
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
          // Save per-question answers
          const attemptId = data.attemptId;
          if (attemptId) {
            fetch('/api/quiz/answers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                attemptId,
                traineeId,
                moduleId,
                answers: finalResults.map(r => ({
                  questionId: r.question.id,
                  questionText: r.question.question,
                  selectedOption: r.selected,
                  correctOption: (r.question.correctOption ?? r.question.correct_option ?? ''),
                  isCorrect: r.correct,
                })),
              }),
            }).catch(() => {});
          }
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
    const totalQ   = results.length;
    const correct  = results.filter(r => r.correct).length;
    const wrong    = totalQ - correct;
    const finalPct = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;
    const passed   = finalPct >= 70;
    const passColor = passed ? "#00D26A" : "#FF4D4D";

    return (
      <div className="page" style={{ background: "var(--bg-primary)", paddingBottom: 40 }}>

        {/* Top nav */}
        <div style={{ padding: "52px 20px 12px" }}>
          <BackButton to="/quiz" label="QUIZ LIST" />
        </div>

        {/* ── SCORE HERO ─────────────────────────────────────── */}
        <div style={{
          margin: "0 16px 16px",
          background: `linear-gradient(135deg, ${passColor}0a 0%, rgba(7,20,38,0.98) 100%)`,
          border: `1px solid ${passColor}30`,
          borderRadius: 20, padding: "28px 20px",
          textAlign: "center", position: "relative", overflow: "hidden",
        }}>
          {/* Module label */}
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>
            {mod.icon} {mod.title}
          </div>

          {/* Big percent */}
          <div style={{
            fontSize: 80, fontWeight: 900, fontFamily: "Inter",
            color: passColor, lineHeight: 1,
            textShadow: `0 0 40px ${passColor}60`,
            marginBottom: 6,
          }}>
            {finalPct}%
          </div>

          {/* Pass / Fail badge */}
          <div className="font-orbitron" style={{
            display: "inline-block", padding: "4px 18px",
            background: `${passColor}18`, border: `1px solid ${passColor}50`,
            borderRadius: 20, fontSize: 13, letterSpacing: "0.18em",
            color: passColor, marginBottom: 18,
          }}>
            {passed ? "✓ PASSED" : "✗ NOT PASSED"}
          </div>

          {/* Score bar */}
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, height: 8, overflow: "hidden", marginBottom: 18 }}>
            <div style={{
              width: `${finalPct}%`, height: "100%", borderRadius: 8,
              background: passed
                ? "linear-gradient(90deg,#00D26A,#35D4FF)"
                : "linear-gradient(90deg,#FF4D4D,#FFD166)",
            }} />
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "CORRECT", value: String(correct),   color: "#00D26A" },
              { label: "WRONG",   value: String(wrong),     color: "#FF4D4D" },
              { label: "PASS MARK", value: "70%",            color: "#FFD166" },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, padding: "10px 6px", textAlign: "center",
                background: `${s.color}10`, border: `1px solid ${s.color}25`, borderRadius: 10,
              }}>
                <div style={{ fontFamily: "Inter", fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 3, letterSpacing: "0.07em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── XP + BADGES ────────────────────────────────────── */}
        {(xpEarned > 0 || newBadges.length > 0) && (
          <div style={{ margin: "0 16px 16px", display: "flex", gap: 10 }}>
            {xpEarned > 0 && (
              <div style={{
                flex: 1, background: "rgba(0,174,239,0.08)",
                border: "1px solid rgba(0,174,239,0.25)",
                borderRadius: 12, padding: "14px", textAlign: "center",
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#35D4FF", fontFamily: "Inter" }}>+{xpEarned}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginTop: 2 }}>XP EARNED</div>
              </div>
            )}
            {newBadges.map(b => (
              <div key={b.name} style={{
                flex: 1, background: "rgba(255,209,102,0.08)",
                border: "1px solid rgba(255,209,102,0.3)",
                borderRadius: 12, padding: "14px", textAlign: "center",
              }}>
                <div style={{ fontSize: 24 }}>{b.icon}</div>
                <div style={{ fontSize: 9, color: "#FFD166", marginTop: 2, letterSpacing: "0.08em" }}>NEW BADGE</div>
              </div>
            ))}
          </div>
        )}

        {submitError && (
          <div style={{ margin: "0 16px 14px", padding: "12px 16px", background: "rgba(255,77,77,0.1)", border: "1px solid rgba(255,77,77,0.35)", borderRadius: 10, color: "#FF4D4D", fontSize: 12 }}>
            ⚠️ {submitError}
          </div>
        )}

        {/* ── QUESTION REVIEW ────────────────────────────────── */}
        <div style={{ padding: "0 16px" }}>
          <div className="sub-heading sub-heading-accent" style={{ color: "rgba(0,174,239,0.55)" }}>
            QUESTION REVIEW · {totalQ} QUESTIONS
          </div>

          {results.map((r, idx) => {
            const q2 = r.question;
            const correctKey  = (q2.correctOption ?? q2.correct_option ?? '').toUpperCase();
            const selectedKey = r.selected.toUpperCase();
            const getOpt = (key: string) =>
              (q2[`option${key}` as keyof Question] ?? q2[`option_${key.toLowerCase()}` as keyof Question]) as string | undefined;
            const correctText  = getOpt(correctKey)  ?? correctKey;
            const selectedText = r.selected ? getOpt(selectedKey) ?? selectedKey : null;

            return (
              <div key={idx} style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${r.correct ? "rgba(0,210,106,0.18)" : "rgba(255,77,77,0.18)"}`,
                borderLeft: `3px solid ${r.correct ? "#00D26A" : "#FF4D4D"}`,
                borderRadius: 14, padding: "16px", marginBottom: 12,
              }}>

                {/* Question header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                    background: r.correct ? "rgba(0,210,106,0.14)" : "rgba(255,77,77,0.14)",
                    border: `1px solid ${r.correct ? "#00D26A35" : "#FF4D4D35"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, color: r.correct ? "#00D26A" : "#FF4D4D",
                  }}>
                    {r.correct ? "✓" : "✗"}
                  </div>
                  <div className="font-orbitron" style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", letterSpacing: "0.1em" }}>
                    Q{idx + 1}
                  </div>
                </div>

                {/* Question text */}
                <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.55, marginBottom: 14, fontWeight: 500 }}>
                  {q2.question}
                </div>

                {/* Your answer */}
                <div style={{ fontSize: 11, marginBottom: r.correct ? 0 : 8, display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <span style={{ color: "rgba(255,255,255,0.28)", flexShrink: 0 }}>Your answer:</span>
                  <span style={{ color: r.correct ? "#00D26A" : "#FF6B6B", fontWeight: 600, lineHeight: 1.4 }}>
                    {selectedText ? `${selectedKey}. ${selectedText}` : "— No answer (time expired)"}
                  </span>
                </div>

                {/* Correct answer — only shown when wrong */}
                {!r.correct && (
                  <div style={{ fontSize: 11, marginBottom: q2.explanation ? 10 : 0, display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <span style={{ color: "rgba(255,255,255,0.28)", flexShrink: 0 }}>Correct answer:</span>
                    <span style={{ color: "#00D26A", fontWeight: 600, lineHeight: 1.4 }}>
                      {correctKey}. {correctText}
                    </span>
                  </div>
                )}

                {/* Explanation — only shown when wrong and explanation exists */}
                {!r.correct && q2.explanation && (
                  <div style={{
                    marginTop: 10, padding: "10px 12px",
                    background: "rgba(53,212,255,0.05)",
                    border: "1px solid rgba(53,212,255,0.15)",
                    borderRadius: 8,
                    fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.6,
                  }}>
                    <span style={{ color: "#35D4FF", marginRight: 6, fontWeight: 600 }}>💡</span>
                    {q2.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── ACTION BUTTONS ─────────────────────────────────── */}
        <div style={{ padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => navigate("/quiz")} style={{
            width: "100%", padding: "14px",
            background: `${color}15`, border: `1px solid ${color}50`,
            borderRadius: 12, color: color,
            fontFamily: "Inter", fontSize: 12, letterSpacing: "0.08em", cursor: "pointer",
          }}>
            ← ALL QUIZZES
          </button>
          {retakeStatus === 'none' && (
            <button
              onClick={handleRetakeRequest}
              disabled={retakeRequesting || retakeRequested}
              style={{
                width: "100%", padding: "12px",
                background: retakeRequested ? "rgba(0,210,106,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${retakeRequested ? "#00D26A40" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 12,
                color: retakeRequested ? "#00D26A" : "var(--text-muted)",
                fontFamily: "Inter", fontSize: 11, cursor: retakeRequesting ? "not-allowed" : "pointer",
              }}
            >
              {retakeRequested ? "✓ Retake Requested" : retakeRequesting ? "Sending..." : "Request Retake"}
            </button>
          )}
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
            <div
              className={timeLeft <= 10 && !answered ? "timer-danger" : undefined}
              style={{
                fontSize: 13, fontWeight: 700, fontFamily: "Inter",
                color: timeLeft <= 10 ? "#FF4D4D" : timeLeft <= 20 ? "#FFD166" : "#00D26A",
                background: timeLeft <= 10 ? "rgba(255,77,77,0.1)" : "rgba(0,210,106,0.08)",
                border: `1px solid ${timeLeft <= 10 ? "rgba(255,77,77,0.4)" : "rgba(0,210,106,0.25)"}`,
                borderRadius: 6, padding: "2px 8px", minWidth: 44, textAlign: "center",
                transition: "color 0.3s, background 0.3s",
              }}
            >
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
          <div className="sub-heading" style={{ color: color, marginBottom: 10 }}>
            QUESTION {current + 1}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6, fontWeight: 500 }}>
            {q.question}
          </div>
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {opts.map((opt) => {
            const val = (q[`option${opt}` as keyof Question] ?? q[`option_${opt.toLowerCase()}` as keyof Question]) as string;
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
