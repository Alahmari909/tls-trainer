import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import V2Layout from "./layout";

interface Trainee {
  id: string;
  name: string;
  rank?: string;
  unit?: string;
  is_online?: number;
  last_active_at?: number;
  login_count?: number;
  status?: string;
}

interface QuizAttempt {
  id: number;
  trainee_id: string;
  module_name: string;
  pct: number;
  passed: number;
  ts: number;
}

export default function V2Admin() {
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"overview" | "trainees" | "reports">("overview");
  const [, setLocation] = useLocation();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tRes, aRes] = await Promise.all([
        fetch("/api/admin/trainees"),
        fetch("/api/admin/quiz-attempts"),
      ]);
      if (tRes.ok) setTrainees(await tRes.json() as Trainee[]);
      if (aRes.ok) setAttempts(await aRes.json() as QuizAttempt[]);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const onlineCount = trainees.filter(t => t.is_online).length;
  const avgScore = attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + a.pct, 0) / attempts.length) : 0;
  const passRate = attempts.length > 0 ? Math.round((attempts.filter(a => a.passed).length / attempts.length) * 100) : 0;

  return (
    <V2Layout role="admin">
      <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "0.72rem", letterSpacing: "0.15em", color: "#ef4444", marginBottom: "0.25rem" }}>INSTRUCTOR PANEL</div>
          <h2 style={{ fontSize: "1.9rem", fontWeight: 900, color: "#e2e8f0", margin: 0 }}>Admin Dashboard</h2>
        </div>
        <button onClick={loadData} style={{
          padding: "0.45rem 1rem", background: "transparent",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
          color: "#64748b", cursor: "pointer", fontSize: "0.8rem",
        }}>↺ Refresh</button>
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {(["overview", "trainees", "reports"] as const).map(s => (
          <button key={s} onClick={() => setActiveSection(s)} style={{
            padding: "0.4rem 1rem", borderRadius: "20px", cursor: "pointer",
            fontSize: "0.78rem", fontWeight: activeSection === s ? 600 : 400,
            background: activeSection === s ? "rgba(239,68,68,0.12)" : "rgba(15,23,42,0.6)",
            border: activeSection === s ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.06)",
            color: activeSection === s ? "#ef4444" : "#64748b",
            textTransform: "capitalize",
          }}>{s}</button>
        ))}
      </div>

      {loading && (
        <div style={{ color: "#475569", fontSize: "0.85rem", padding: "2rem 0" }}>Loading data...</div>
      )}

      {/* Overview */}
      {!loading && activeSection === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
            {[
              { label: "TOTAL TRAINEES", value: trainees.length, color: "#00ff88" },
              { label: "ONLINE NOW", value: onlineCount, color: "#00d4ff" },
              { label: "AVG QUIZ SCORE", value: `${avgScore}%`, color: "#fbbf24" },
              { label: "PASS RATE", value: `${passRate}%`, color: passRate >= 70 ? "#00ff88" : "#ef4444" },
            ].map(stat => (
              <div key={stat.label} style={{
                background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "10px", padding: "1.1rem", textAlign: "center",
              }}>
                <div style={{ fontSize: "1.9rem", fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "#475569", marginTop: "0.25rem" }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Recent attempts */}
          <div style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "1.25rem" }}>
            <div style={{ fontSize: "0.7rem", letterSpacing: "0.12em", color: "#64748b", marginBottom: "1rem" }}>RECENT QUIZ ATTEMPTS</div>
            {attempts.slice(0, 10).map(a => (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0.6rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                fontSize: "0.82rem",
              }}>
                <span style={{ color: "#94a3b8" }}>{a.trainee_id.slice(0, 8)}…</span>
                <span style={{ color: "#64748b" }}>{a.module_name}</span>
                <span style={{ color: a.pct >= 70 ? "#00ff88" : "#ef4444", fontWeight: 600 }}>{Math.round(a.pct)}%</span>
                <span style={{
                  padding: "0.15rem 0.5rem", borderRadius: "4px", fontSize: "0.68rem",
                  background: a.passed ? "rgba(0,255,136,0.1)" : "rgba(239,68,68,0.1)",
                  color: a.passed ? "#00ff88" : "#ef4444",
                }}>{a.passed ? "PASS" : "FAIL"}</span>
              </div>
            ))}
            {attempts.length === 0 && <div style={{ color: "#334155", fontSize: "0.82rem" }}>No quiz attempts yet.</div>}
          </div>
        </div>
      )}

      {/* Trainees list */}
      {!loading && activeSection === "trainees" && (
        <div>
          <div style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px 60px", gap: "1rem", fontSize: "0.68rem", letterSpacing: "0.1em", color: "#475569" }}>
              <span>NAME</span><span>RANK</span><span>UNIT</span><span>LOGINS</span><span>STATUS</span>
            </div>
            {trainees.map(t => (
              <div key={t.id} style={{
                padding: "0.85rem 1.25rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px 60px",
                gap: "1rem", borderBottom: "1px solid rgba(255,255,255,0.04)",
                alignItems: "center", fontSize: "0.82rem",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: t.is_online ? "#00ff88" : "#334155", flexShrink: 0 }} />
                  <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{t.name}</span>
                </div>
                <span style={{ color: "#64748b" }}>{t.rank || "—"}</span>
                <span style={{ color: "#64748b" }}>{t.unit || "—"}</span>
                <span style={{ color: "#64748b" }}>{t.login_count || 0}</span>
                <span style={{
                  fontSize: "0.65rem", padding: "0.15rem 0.5rem", borderRadius: "4px",
                  background: t.status === "blocked" ? "rgba(239,68,68,0.1)" : "rgba(0,255,136,0.08)",
                  color: t.status === "blocked" ? "#ef4444" : "#00ff88",
                }}>{(t.status || "active").toUpperCase()}</span>
              </div>
            ))}
            {trainees.length === 0 && (
              <div style={{ padding: "2rem", textAlign: "center", color: "#334155", fontSize: "0.85rem" }}>No trainees registered yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Reports */}
      {!loading && activeSection === "reports" && (
        <div>
          <div style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "1.25rem" }}>
            <div style={{ fontSize: "0.7rem", letterSpacing: "0.12em", color: "#64748b", marginBottom: "1rem" }}>QUIZ PERFORMANCE BY MODULE</div>
            {[1,2,3,4,5,6,7,8,9].map(modId => {
              const modAttempts = attempts.filter(a => {
                const mod = a.module_name?.toLowerCase() || "";
                return true; // show all for now
              });
              return null;
            })}
            <div style={{ color: "#334155", fontSize: "0.85rem" }}>
              All quiz attempts: {attempts.length} total | Avg: {avgScore}% | Pass rate: {passRate}%
            </div>
            {attempts.slice(0, 20).map(a => (
              <div key={a.id} style={{
                display: "flex", gap: "1rem", alignItems: "center",
                padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                fontSize: "0.78rem",
              }}>
                <span style={{ color: "#475569" }}>{new Date(a.ts).toLocaleDateString()}</span>
                <span style={{ color: "#94a3b8", flex: 1 }}>{a.module_name}</span>
                <div style={{ width: "120px", height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px" }}>
                  <div style={{ width: `${a.pct}%`, height: "100%", background: a.pct >= 70 ? "#00ff88" : "#ef4444", borderRadius: "2px" }} />
                </div>
                <span style={{ color: a.pct >= 70 ? "#00ff88" : "#ef4444", fontWeight: 600, width: "40px", textAlign: "right" }}>{Math.round(a.pct)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </V2Layout>
  );
}
