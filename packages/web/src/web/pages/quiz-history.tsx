import { useState, useEffect } from "react";
import BackButton from "../components/BackButton";
import { getSession } from "../hooks/useTelegramTrack";

type Attempt = {
  id: number;
  module_id: number;
  module_name: string;
  score: number;
  total: number;
  pct: number;
  passed: number;
  ts: number;
};

function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default function QuizHistory() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const session = getSession();
    if (!session) { setLoading(false); return; }
    fetch(`/api/quiz-attempts/${session.id}`)
      .then(r => r.json())
      .then(data => { setAttempts(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const totalAttempts = attempts.length;
  const passedCount   = attempts.filter(a => a.passed === 1).length;
  const avgScore      = totalAttempts > 0
    ? Math.round(attempts.reduce((s, a) => s + a.pct, 0) / totalAttempts) : 0;
  const bestScore     = totalAttempts > 0 ? Math.max(...attempts.map(a => a.pct)) : 0;

  return (
    <div className="page" style={{ background: "var(--bg-primary)", paddingBottom: 40 }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="radar-grid" style={{
        padding: "52px 20px 16px",
        borderBottom: "1px solid rgba(0,174,239,0.15)",
      }}>
        <div style={{ marginBottom: 12 }}><BackButton to="/settings" label="SETTINGS" /></div>
        <div className="font-orbitron text-glow" style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
          QUIZ HISTORY
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          Your complete quiz attempt record
        </div>
      </div>

      {/* ── Summary Stats ──────────────────────────────────── */}
      {!loading && totalAttempts > 0 && (
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "ATTEMPTS",  value: String(totalAttempts), color: "#00AEEF" },
              { label: "PASSED",    value: String(passedCount),   color: "#00D26A" },
              { label: "AVG SCORE", value: `${avgScore}%`,        color: "#FFD166" },
              { label: "BEST",      value: `${bestScore}%`,       color: "#35D4FF" },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, textAlign: "center",
                background: `${s.color}10`,
                border: `1px solid ${s.color}25`,
                borderRadius: 12, padding: "12px 4px",
              }}>
                <div style={{ fontFamily: "Inter", fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 3, letterSpacing: "0.08em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Attempt List ───────────────────────────────────── */}
      <div style={{ padding: "16px" }}>
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} style={{
              height: 78, marginBottom: 10, borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              animation: "pulse-glow 1.5s ease infinite",
              animationDelay: `${i * 0.1}s`,
            }} />
          ))
        ) : attempts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
            <div className="font-orbitron" style={{ fontSize: 12, marginBottom: 8 }}>NO QUIZ ATTEMPTS YET</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
              Complete a quiz to see your results here.
            </div>
          </div>
        ) : (
          <>
            <div className="font-orbitron" style={{
              fontSize: 9, color: "rgba(0,174,239,0.55)",
              letterSpacing: "0.2em", marginBottom: 12,
            }}>
              {totalAttempts} ATTEMPT{totalAttempts !== 1 ? "S" : ""}
            </div>

            {attempts.map((a, idx) => {
              const passColor = a.passed === 1 ? "#00D26A" : "#FF4D4D";
              return (
                <div key={a.id} className="fade-in" style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${passColor}20`,
                  borderLeft: `3px solid ${passColor}`,
                  borderRadius: 14, padding: "14px 16px", marginBottom: 10,
                  animationDelay: `${idx * 0.04}s`,
                  display: "flex", alignItems: "center", gap: 12,
                }}>

                  {/* Score circle */}
                  <div style={{
                    width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                    background: `${passColor}10`,
                    border: `2px solid ${passColor}35`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{
                      fontFamily: "Inter", fontSize: 15, fontWeight: 800,
                      color: passColor, lineHeight: 1,
                    }}>
                      {Math.round(a.pct)}%
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-orbitron" style={{
                      fontSize: 11, color: "var(--text-primary)",
                      fontWeight: 700, marginBottom: 4,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {a.module_name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {a.score}/{a.total} correct
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
                      {fmtDate(a.ts)} · {fmtTime(a.ts)}
                    </div>
                  </div>

                  {/* Pass/Fail badge */}
                  <div style={{
                    padding: "5px 10px", borderRadius: 20, flexShrink: 0,
                    background: `${passColor}15`,
                    border: `1px solid ${passColor}40`,
                    fontSize: 9, fontFamily: "Inter",
                    letterSpacing: "0.1em", color: passColor, fontWeight: 700,
                  }}>
                    {a.passed === 1 ? "PASSED" : "FAILED"}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
