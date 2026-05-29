import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { getSession } from "../hooks/useTelegramTrack";

type TraineeStats = {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  modulesCompleted: number;
  quizzesTaken: number;
  rank: string;
  unit: string;
};

export default function Card() {
  const [, setLocation] = useLocation();
  const session = getSession();

  const [stats, setStats] = useState<TraineeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.id) { setLocation("/"); return; }
    Promise.all([
      fetch(`/api/streaks/${session.id}`).then(r => r.json()).catch(() => null),
      fetch(`/api/progress/${session.id}`).then(r => r.json()).catch(() => null),
      fetch(`/api/quiz-attempts/${session.id}`).then(r => r.json()).catch(() => null),
    ]).then(([streak, progress, quizzes]) => {
      setStats({
        totalXp: streak?.totalXp ?? 0,
        currentStreak: streak?.currentStreak ?? 0,
        longestStreak: streak?.longestStreak ?? 0,
        modulesCompleted: Array.isArray(progress) ? progress.filter((p: any) => p.completed === 1).length : 0,
        quizzesTaken: Array.isArray(quizzes) ? quizzes.length : 0,
        rank: session.rank ?? "Technician",
        unit: session.unit ?? "Ground Radar",
      });
      setLoading(false);
    });
  }, [session?.id]);

  if (!session) return null;

  const initials = session.name
    .split(" ")
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const xpLevel = Math.floor((stats?.totalXp ?? 0) / 500) + 1;
  const xpProgress = ((stats?.totalXp ?? 0) % 500);
  const xpPct = Math.round((xpProgress / 500) * 100);

  return (
    <div className="page radar-grid" style={{ background: "var(--bg-primary)" }}>
      {/* Back button */}
      <div style={{ padding: "48px 20px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, color: "var(--accent-cyan)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          <span className="font-orbitron" style={{ fontSize: 11, letterSpacing: "0.1em" }}>BACK</span>
        </Link>
      </div>

      {/* ID Card */}
      <div style={{ padding: "20px 16px" }}>
        <div className="glass-card glow-blue fade-in" style={{
          overflow: "hidden",
          border: "1px solid rgba(0,174,239,0.4)",
          position: "relative"
        }}>
          {/* Top accent line */}
          <div style={{
            height: 3,
            background: "linear-gradient(90deg, transparent, #00AEEF, #35D4FF, transparent)"
          }} />

          {/* Header */}
          <div style={{
            background: "linear-gradient(180deg, rgba(0,174,239,0.15) 0%, transparent 100%)",
            padding: "32px 24px 24px",
            textAlign: "center",
            position: "relative"
          }}>
            <div className="font-orbitron" style={{
              fontSize: 9, letterSpacing: "0.25em", color: "var(--accent-cyan)",
              marginBottom: 16, opacity: 0.8
            }}>
              ROYAL SAUDI AIR FORCE · GROUND RADAR
            </div>

            {/* Avatar */}
            <div style={{
              width: 96, height: 96, borderRadius: "50%",
              background: "linear-gradient(135deg, #00AEEF, #35D4FF)",
              border: "3px solid var(--accent-cyan)",
              boxShadow: "0 0 30px rgba(53,212,255,0.6), 0 0 60px rgba(0,174,239,0.3)",
              margin: "0 auto 16px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontFamily: "Inter", fontSize: 30, fontWeight: 900, color: "white" }}>
                {initials}
              </span>
            </div>

            <div className="font-orbitron text-glow" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
              {session.name}
            </div>
            <div style={{
              display: "inline-block",
              padding: "4px 14px",
              background: "rgba(0,174,239,0.2)",
              border: "1px solid rgba(0,174,239,0.5)",
              borderRadius: 20,
              fontSize: 11, color: "var(--accent-cyan)"
            }}>
              {stats?.rank ?? session.rank ?? "Technician"}
            </div>
          </div>

          {/* Info rows */}
          <div style={{ padding: "0 20px 20px" }}>
            <div style={{ borderTop: "1px solid rgba(0,174,239,0.15)", paddingTop: 20, marginBottom: 16 }}>
              {[
                {
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8L6 7h12z"/></svg>,
                  label: "UNIT",
                  value: stats?.unit ?? session.unit ?? "Ground Radar Systems",
                },
                {
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>,
                  label: "RANK",
                  value: stats?.rank ?? session.rank ?? "Technician",
                },
                {
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
                  label: "STREAK",
                  value: loading ? "—" : `${stats?.currentStreak ?? 0} day${stats?.currentStreak !== 1 ? "s" : ""}`,
                },
                {
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
                  label: "MODULES DONE",
                  value: loading ? "—" : `${stats?.modulesCompleted ?? 0}`,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "12px 0",
                    borderBottom: "1px solid rgba(0,174,239,0.08)",
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: "rgba(0,174,239,0.12)",
                    border: "1px solid rgba(0,174,239,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "Inter", letterSpacing: "0.1em" }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 1 }}>
                      {item.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* XP Progress */}
            <div className="glass-card" style={{ padding: "16px", border: "1px solid rgba(0,174,239,0.15)", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div className="font-orbitron" style={{ fontSize: 9, color: "var(--accent-cyan)", letterSpacing: "0.15em" }}>
                  EXPERIENCE POINTS
                </div>
                <div className="font-orbitron" style={{ fontSize: 10, color: "var(--accent-cyan)" }}>
                  LVL {xpLevel}
                </div>
              </div>
              <div style={{ background: "rgba(0,174,239,0.1)", borderRadius: 6, height: 8, overflow: "hidden", marginBottom: 8 }}>
                <div style={{
                  height: "100%", borderRadius: 6,
                  background: "linear-gradient(90deg, #00AEEF, #35D4FF)",
                  width: `${xpPct}%`,
                  transition: "width 0.8s ease",
                  boxShadow: "0 0 8px rgba(53,212,255,0.6)"
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "Inter" }}>
                  {loading ? "—" : `${stats?.totalXp ?? 0} XP total`}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "Inter" }}>
                  {xpProgress}/500 to next level
                </span>
              </div>
            </div>

            {/* Status badges */}
            <div className="font-orbitron" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.15em", marginBottom: 12 }}>
              STATUS
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { label: "TLS Training", color: "#00AEEF", active: true },
                { label: `${stats?.modulesCompleted ?? 0} Modules`, color: "#35D4FF", active: true },
                { label: `${stats?.currentStreak ?? 0}d Streak`, color: "#ffaa00", active: (stats?.currentStreak ?? 0) > 0 },
                { label: `${stats?.totalXp ?? 0} XP`, color: "#00ff88", active: true },
              ].map((badge) => (
                <div key={badge.label} style={{
                  padding: "6px 14px",
                  background: badge.active ? `${badge.color}18` : "rgba(255,255,255,0.05)",
                  border: `1px solid ${badge.active ? badge.color + "50" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 20,
                  fontSize: 11, color: badge.active ? badge.color : "var(--text-muted)",
                  fontFamily: "Inter", fontWeight: 600
                }}>
                  {badge.active ? "✓" : "○"} {badge.label}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom accent line */}
          <div style={{
            height: 3,
            background: "linear-gradient(90deg, transparent, #071426, #00AEEF, transparent)"
          }} />
        </div>
      </div>
    </div>
  );
}
