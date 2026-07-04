import { useState, useEffect } from "react";
import { getSession } from "../hooks/useTelegramTrack";
import BackButton from "../components/BackButton";
import { Trophy, Zap, Flame, Target, Users } from "lucide-react";

type LeaderboardEntry = {
  id: string;
  name: string;
  rank: string;
  unit: string;
  training_level: string;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  quiz_count: number;
  avg_passed_pct: number;
  quizzes_passed: number;
};

const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const LEVEL_COLOR: Record<string, string> = {
  advanced: "#FFD166",
  beginner: "#00AEEF",
};

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"xp" | "streak" | "quiz">("xp");
  const session = getSession();

  useEffect(() => {
    fetch("/api/leaderboard")
      .then(r => r.json())
      .then(data => { setEntries(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...entries].sort((a, b) => {
    if (tab === "xp") return b.total_xp - a.total_xp;
    if (tab === "streak") return b.current_streak - a.current_streak;
    return b.quizzes_passed - a.quizzes_passed;
  });

  const myRank = sorted.findIndex(e => e.id === session?.id) + 1;

  return (
    <div className="page" style={{ maxWidth: 600, margin: "0 auto" }}>
      <BackButton />

      {/* Header */}
      <div style={{ textAlign: "center", padding: "24px 0 20px" }}>
        <div style={{ marginBottom: 8, display:"flex", justifyContent:"center" }}><Trophy size={40} strokeWidth={1.4} color="#FFD166" /></div>
        <div style={{
          fontFamily: "Inter", fontSize: 22, fontWeight: 800,
          letterSpacing: "0.12em", color: "#fff", marginBottom: 4,
        }}>LEADERBOARD</div>
        <div style={{ fontSize: 11, color: "rgba(0,174,239,0.6)", letterSpacing: "0.1em" }}>
          TOP TRAINEES · TLS TRAINER
        </div>
      </div>

      {/* My rank banner */}
      {myRank > 0 && (
        <div style={{
          margin: "0 0 20px",
          padding: "12px 16px",
          background: "rgba(0,174,239,0.08)",
          border: "1px solid rgba(0,174,239,0.25)",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ fontSize: 11, color: "#00AEEF", letterSpacing: "0.1em", fontFamily: "Inter" }}>
            YOUR RANK
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "Inter" }}>
            #{myRank}
          </div>
        </div>
      )}

      {/* Tab selector */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 20,
        background: "rgba(255,255,255,0.04)",
        padding: 4, borderRadius: 10,
      }}>
        {[
          { key: "xp", label: "XP" },
          { key: "streak", label: "STREAK" },
          { key: "quiz", label: "QUIZZES" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            style={{
              flex: 1, padding: "8px 0",
              background: tab === t.key ? "rgba(0,174,239,0.15)" : "transparent",
              border: tab === t.key ? "1px solid rgba(0,174,239,0.3)" : "1px solid transparent",
              borderRadius: 8, color: tab === t.key ? "#00AEEF" : "#3d5a73",
              fontFamily: "Inter", fontSize: 10, fontWeight: 600,
              letterSpacing: "0.08em", cursor: "pointer", transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "#3d5a73", fontFamily: "Inter", fontSize: 13 }}>
          Loading...
        </div>
      )}

      {/* Empty */}
      {!loading && sorted.length === 0 && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ marginBottom: 12, display:"flex", justifyContent:"center" }}><Users size={40} strokeWidth={1.4} color="#3d5a73" /></div>
          <div style={{ color: "#3d5a73", fontFamily: "Inter", fontSize: 13 }}>
            No trainees yet. Be the first!
          </div>
        </div>
      )}

      {/* List */}
      {!loading && sorted.map((entry, i) => {
        const isMe = entry.id === session?.id;
        const medal = MEDAL[i] ?? null;
        const levelColor = LEVEL_COLOR[entry.training_level] ?? "#3d5a73";
        const statValue = tab === "xp"
          ? `${entry.total_xp.toLocaleString()} XP`
          : tab === "streak"
          ? `${entry.current_streak}d`
          : `${entry.quizzes_passed} passed`;

        return (
          <div
            key={entry.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              marginBottom: 8,
              background: isMe
                ? "rgba(0,174,239,0.1)"
                : i < 3 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
              border: isMe
                ? "1px solid rgba(0,174,239,0.35)"
                : i < 3 ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(255,255,255,0.03)",
              borderRadius: 12,
              transition: "all 0.2s",
            }}
          >
            {/* Rank */}
            <div style={{
              width: 32, textAlign: "center", flexShrink: 0,
              fontSize: 13,
              fontWeight: 700, fontFamily: "Inter",
              color: i < 3 ? MEDAL_COLORS[i] : "#3d5a73",
            }}>
              {i < 3 ? (
                <Trophy size={20} strokeWidth={1.8} color={MEDAL_COLORS[i]} />
              ) : `#${i + 1}`}
            </div>

            {/* Avatar */}
            <div style={{
              width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
              background: isMe
                ? "linear-gradient(135deg, #00AEEF, #0066cc)"
                : `linear-gradient(135deg, ${levelColor}44, ${levelColor}22)`,
              border: `2px solid ${isMe ? "#00AEEF" : levelColor}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "Inter",
            }}>
              {entry.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: isMe ? "#00AEEF" : "#fff",
                fontFamily: "Inter", whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {entry.name} {isMe && <span style={{ fontSize: 10, color: "#00AEEF" }}>(You)</span>}
              </div>
              <div style={{
                fontSize: 10, color: "#3d5a73", fontFamily: "Inter",
                marginTop: 2, display: "flex", gap: 6, alignItems: "center",
              }}>
                <span>{[entry.rank, entry.unit].filter(Boolean).join(" · ")}</span>
                <span style={{
                  padding: "1px 6px", borderRadius: 4, fontSize: 9,
                  background: `${levelColor}22`, color: levelColor,
                  letterSpacing: "0.08em", fontWeight: 600,
                }}>
                  {entry.training_level?.toUpperCase() ?? "BEGINNER"}
                </span>
              </div>
            </div>

            {/* Stat */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{
                fontSize: 15, fontWeight: 800, fontFamily: "Inter",
                color: i === 0 ? "#FFD166" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#fff",
              }}>
                {statValue}
              </div>
              {tab === "xp" && (
                <div style={{ fontSize: 9, color: "#3d5a73", fontFamily: "Inter", display:"flex", alignItems:"center", gap:3 }}>
                  <Flame size={9} strokeWidth={2} /> {entry.current_streak}d streak
                </div>
              )}
              {tab === "streak" && (
                <div style={{ fontSize: 9, color: "#3d5a73", fontFamily: "Inter" }}>
                  Best: {entry.longest_streak}d
                </div>
              )}
              {tab === "quiz" && (
                <div style={{ fontSize: 9, color: "#3d5a73", fontFamily: "Inter" }}>
                  {Math.round(entry.avg_passed_pct)}% avg
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ height: 80 }} />
    </div>
  );
}
