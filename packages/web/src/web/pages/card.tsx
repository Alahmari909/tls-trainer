import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { getSession } from "../hooks/useTelegramTrack";

type Report = {
  trainee: {
    id: string; name: string; rank: string | null; unit: string | null;
    xp: number; level: number; status: string;
    login_count: number; last_login_at: number; created_at: number;
  };
  stats: {
    totalAttempts: number; passedAttempts: number; failedAttempts: number;
    avgScore: number; completedModules: number; trainingHours: number;
  };
  quizAttempts: Array<{ module_id: number; module_name: string | null; pct: number; passed: number; ts: number }>;
  moduleProgress: Array<{ module_id: number; module_name: string | null; progress: number; completed: number; last_accessed_at: number }>;
  evaluation: { rating: string; recommendation: string; technical_observations: string; updated_at: number } | null;
  manualLogs: Array<{ manual_name: string; view_count: number }>;
};

const RATING_STYLE: Record<string, { color: string; label: string; emoji: string }> = {
  excellent:    { color: "#00FF88", label: "Excellent",    emoji: "⭐" },
  good:         { color: "#00AEEF", label: "Good",         emoji: "✅" },
  weak:         { color: "#FF4444", label: "Needs Work",   emoji: "⚠️" },
  needs_review: { color: "#FFD700", label: "Under Review", emoji: "🔍" },
  pending:      { color: "#888",    label: "Pending",      emoji: "⏳" },
};

function timeAgo(ms: number) {
  if (!ms) return "Never";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "Just now";
}

export default function Card() {
  const [, setLocation] = useLocation();
  const session = getSession();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session?.id) { setLocation("/"); return; }
    fetch(`/api/trainee/report/${session.id}`, {
      headers: { "x-trainee-id": session.id },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setReport(data as Report); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [session?.id]);

  if (!session) return null;

  const initials = session.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const xp = report?.trainee?.xp ?? 0;
  const xpProgress = xp % 500;
  const xpPct = Math.round((xpProgress / 500) * 100);
  const xpLevel = Math.floor(xp / 500) + 1;
  const evalStyle = RATING_STYLE[report?.evaluation?.rating ?? "pending"] ?? RATING_STYLE.pending;

  return (
    <div className="page" style={{ background: "var(--bg-primary)", paddingBottom: 40 }}>
      {/* Back */}
      <div style={{ padding: "52px 20px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, color: "var(--accent-cyan)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          <span className="font-orbitron" style={{ fontSize: 11, letterSpacing: "0.1em" }}>BACK</span>
        </Link>
      </div>

      {/* Header card */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{
          background: "linear-gradient(135deg, rgba(0,174,239,0.12), rgba(0,0,0,0))",
          border: "1px solid rgba(0,174,239,0.3)",
          borderRadius: 16, padding: "24px 20px",
          textAlign: "center", position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: "linear-gradient(90deg, transparent, #00AEEF, #35D4FF, transparent)",
          }} />
          <div className="font-orbitron" style={{ fontSize: 8, letterSpacing: "0.25em", color: "var(--accent-cyan)", marginBottom: 14, opacity: 0.7 }}>
            ROYAL SAUDI AIR FORCE · TLS TRAINING
          </div>
          <div style={{
            width: 80, height: 80, borderRadius: "50%", margin: "0 auto 12px",
            background: "linear-gradient(135deg, rgba(0,174,239,0.3), rgba(0,0,0,0))",
            border: "2px solid #00AEEF",
            boxShadow: "0 0 24px rgba(0,174,239,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Inter", fontSize: 26, fontWeight: 900, color: "#00AEEF",
          }}>{initials}</div>
          <div className="font-orbitron" style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{session.name}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter" }}>
            {[report?.trainee?.rank, report?.trainee?.unit].filter(Boolean).join(" · ") || "TLS Trainee"}
          </div>
          {/* Evaluation badge */}
          {report?.evaluation && report.evaluation.rating !== 'pending' && (
            <div style={{
              display: "inline-block", marginTop: 10,
              padding: "5px 14px", borderRadius: 20, fontFamily: "Inter", fontSize: 11,
              background: `${evalStyle.color}15`,
              border: `1px solid ${evalStyle.color}50`,
              color: evalStyle.color,
            }}>
              {evalStyle.emoji} {evalStyle.label}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ padding: "40px 20px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: "Inter", fontSize: 13 }}>
          Loading report…
        </div>
      )}

      {error && (
        <div style={{ padding: "40px 20px", textAlign: "center", color: "#FF4444", fontFamily: "Inter", fontSize: 13 }}>
          Failed to load report. Try again.
        </div>
      )}

      {report && !loading && (
        <div style={{ padding: "12px 16px 0" }}>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              { label: "XP", value: String(xp), color: "#FFD700" },
              { label: "MODULES", value: `${report.stats.completedModules}/${report.moduleProgress.length}`, color: "#00FF88" },
              { label: "QUIZZES", value: String(report.stats.totalAttempts), color: "#00AEEF" },
              { label: "AVG SCORE", value: `${report.stats.avgScore}%`, color: "#FFD700" },
              { label: "PASSED", value: String(report.stats.passedAttempts), color: "#00FF88" },
              { label: "HRS TRAINED", value: `${report.stats.trainingHours}h`, color: "#00AEEF" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10, padding: "12px 10px", textAlign: "center",
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: "Inter" }}>{value}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "Inter", letterSpacing: "0.06em", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* XP progress */}
          <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10, padding: "14px 16px", marginBottom: 12,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="font-orbitron" style={{ fontSize: 9, color: "#FFD700", letterSpacing: "0.15em" }}>LEVEL {xpLevel}</span>
              <span style={{ fontSize: 10, color: "#FFD700", fontFamily: "Inter" }}>{xpProgress}/500 XP</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,215,0,0.1)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${xpPct}%`, background: "linear-gradient(90deg, #FFD700, #FFA500)", borderRadius: 3, transition: "width 0.8s ease" }} />
            </div>
          </div>

          {/* Module progress */}
          {report.moduleProgress.length > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10, padding: "14px 16px", marginBottom: 12,
            }}>
              <div className="font-orbitron" style={{ fontSize: 9, color: "#00AEEF", letterSpacing: "0.15em", marginBottom: 12 }}>MODULE PROGRESS</div>
              {report.moduleProgress.map((m) => (
                <div key={m.module_id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: m.completed ? "#00FF88" : "#fff", fontFamily: "Inter", fontWeight: 600 }}>
                      {m.completed ? "✓ " : ""}{m.module_name ?? `Module ${m.module_id}`}
                    </span>
                    <span style={{ fontSize: 10, color: m.completed ? "#00FF88" : "#FFD700", fontFamily: "Inter" }}>{m.progress}%</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${m.progress}%`,
                      background: m.completed ? "linear-gradient(90deg, #00FF88, #00CC66)" : "linear-gradient(90deg, #00AEEF, #35D4FF)",
                      borderRadius: 2,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quiz history */}
          {report.quizAttempts.length > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10, padding: "14px 16px", marginBottom: 12,
            }}>
              <div className="font-orbitron" style={{ fontSize: 9, color: "#00AEEF", letterSpacing: "0.15em", marginBottom: 12 }}>QUIZ HISTORY</div>
              {report.quizAttempts.slice(0, 10).map((a, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: i < report.quizAttempts.slice(0, 10).length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <div style={{ fontSize: 11, color: "#fff", fontFamily: "Inter", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.module_name ?? `Module ${a.module_id}`}
                    </div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "Inter", marginTop: 1 }}>{timeAgo(a.ts)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: a.pct >= 70 ? "#00FF88" : "#FF4444", fontFamily: "Inter" }}>{a.pct}%</span>
                    <span style={{
                      fontSize: 8, padding: "2px 8px", borderRadius: 8, fontFamily: "Inter",
                      background: a.passed ? "rgba(0,255,136,0.12)" : "rgba(255,68,68,0.12)",
                      border: `1px solid ${a.passed ? "rgba(0,255,136,0.3)" : "rgba(255,68,68,0.3)"}`,
                      color: a.passed ? "#00FF88" : "#FF4444",
                    }}>
                      {a.passed ? "PASS" : "FAIL"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Instructor evaluation */}
          {report.evaluation && report.evaluation.rating !== 'pending' && (
            <div style={{
              background: `${evalStyle.color}08`,
              border: `1px solid ${evalStyle.color}30`,
              borderRadius: 10, padding: "14px 16px", marginBottom: 12,
            }}>
              <div className="font-orbitron" style={{ fontSize: 9, color: evalStyle.color, letterSpacing: "0.15em", marginBottom: 10 }}>
                INSTRUCTOR EVALUATION
              </div>
              <div style={{
                display: "inline-block", marginBottom: 10,
                padding: "4px 12px", borderRadius: 20,
                background: `${evalStyle.color}15`, border: `1px solid ${evalStyle.color}40`,
                fontSize: 11, color: evalStyle.color, fontFamily: "Inter", fontWeight: 600,
              }}>
                {evalStyle.emoji} {evalStyle.label}
              </div>
              {report.evaluation.recommendation && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "Inter", letterSpacing: "0.08em", marginBottom: 4 }}>RECOMMENDATION</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "Inter", lineHeight: 1.5 }}>
                    {report.evaluation.recommendation}
                  </div>
                </div>
              )}
              {report.evaluation.technical_observations && (
                <div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "Inter", letterSpacing: "0.08em", marginBottom: 4 }}>OBSERVATIONS</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "Inter", lineHeight: 1.5 }}>
                    {report.evaluation.technical_observations}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "Inter", marginTop: 10 }}>
                Updated: {timeAgo(report.evaluation.updated_at)}
              </div>
            </div>
          )}

          {/* Manuals read */}
          {report.manualLogs.length > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10, padding: "14px 16px", marginBottom: 12,
            }}>
              <div className="font-orbitron" style={{ fontSize: 9, color: "#C9A66B", letterSpacing: "0.15em", marginBottom: 10 }}>MANUALS READ</div>
              {report.manualLogs.map((m, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 0",
                  borderBottom: i < report.manualLogs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <span style={{ fontSize: 11, color: "#fff", fontFamily: "Inter" }}>📄 {m.manual_name}</span>
                  <span style={{ fontSize: 10, color: "#C9A66B", fontFamily: "Inter" }}>{m.view_count}x</span>
                </div>
              ))}
            </div>
          )}

          {/* Footer info */}
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 10, padding: "12px 16px",
          }}>
            {[
              { label: "Logins", value: String(report.trainee.login_count) },
              { label: "Last Login", value: timeAgo(report.trainee.last_login_at) },
              { label: "Member Since", value: new Date(report.trainee.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) },
            ].map(({ label, value }, i) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter" }}>{label}</span>
                <span style={{ fontSize: 11, color: "#fff", fontFamily: "Inter" }}>{value}</span>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
