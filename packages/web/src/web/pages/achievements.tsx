import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import BackButton from "../components/BackButton";
import { getSession } from "../hooks/useTelegramTrack";

type Achievement = {
  id: number;
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  xpReward: number;
  earned: boolean;
  earnedAt: number | null;
};

type Streak = { currentStreak: number; longestStreak: number; totalXp: number };

function XpRing({ xp, maxXp, level }: { xp: number; maxXp: number; level: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pct = Math.min(xp / maxXp, 1);
  const SIZE = 130;
  const STROKE = 9;
  const R = (SIZE - STROKE * 2) / 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cx = SIZE / 2, cy = SIZE / 2;
    const start = -Math.PI / 2;
    const end = start + pct * 2 * Math.PI;

    ctx.clearRect(0, 0, SIZE, SIZE);

    // Track ring
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255,209,102,0.12)";
    ctx.lineWidth = STROKE;
    ctx.stroke();

    // Tick marks
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * 2 * Math.PI - Math.PI / 2;
      const inner = R - STROKE - 3;
      const outer = R - STROKE - 8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.strokeStyle = "rgba(255,209,102,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Fill arc with glow
    if (pct > 0) {
      ctx.save();
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#FFD166";
      const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
      grad.addColorStop(0, "#FFD166");
      grad.addColorStop(1, "#C9A66B");
      ctx.beginPath();
      ctx.arc(cx, cy, R, start, end);
      ctx.strokeStyle = grad;
      ctx.lineWidth = STROKE;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    }

    // End dot
    if (pct > 0.02) {
      const dotX = cx + Math.cos(end) * R;
      const dotY = cy + Math.sin(end) * R;
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#FFD166";
      ctx.beginPath();
      ctx.arc(dotX, dotY, STROKE / 2 + 1, 0, 2 * Math.PI);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.restore();
    }
  }, [pct]);

  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE, margin: "0 auto" }}>
      <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ display: "block" }} />
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
      }}>
        <div className="font-orbitron" style={{ fontSize: 8, letterSpacing: "0.2em", color: "#C9A66B", marginBottom: 2 }}>LEVEL</div>
        <div className="font-orbitron" style={{ fontSize: 30, fontWeight: 700, color: "#FFD166", lineHeight: 1 }}>{level}</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          {xp.toLocaleString()}<span style={{ opacity: 0.5 }}>/{maxXp.toLocaleString()} XP</span>
        </div>
      </div>
    </div>
  );
}

function BadgeCard({ badge, earned, index }: { badge: Achievement; earned: boolean; index: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="fade-in"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        padding: "18px 12px 16px",
        textAlign: "center",
        borderRadius: 14,
        border: earned ? `1px solid ${badge.color}45` : "1px solid rgba(255,255,255,0.06)",
        background: earned
          ? `linear-gradient(160deg, rgba(5,12,22,0.95) 0%, ${badge.color}10 100%)`
          : "rgba(255,255,255,0.02)",
        opacity: earned ? 1 : 0.42,
        animationDelay: `${index * 0.04}s`,
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        transform: hovered && earned ? "translateY(-3px) scale(1.02)" : "none",
        boxShadow: hovered && earned ? `0 8px 24px ${badge.color}30` : "none",
        overflow: "hidden",
        cursor: earned ? "default" : "not-allowed",
      }}
    >
      {/* Top glow line */}
      {earned && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${badge.color}, transparent)`,
        }} />
      )}
      {/* Background radial */}
      {earned && (
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(circle at 50% 0%, ${badge.color}18, transparent 70%)`,
          pointerEvents: "none",
        }} />
      )}

      {/* Icon */}
      <div style={{
        fontSize: 34,
        marginBottom: 8,
        filter: earned ? `drop-shadow(0 0 10px ${badge.color})` : "grayscale(1) brightness(0.5)",
        transition: "filter 0.2s",
        position: "relative",
      }}>
        {badge.icon}
      </div>

      <div className="font-orbitron" style={{
        fontSize: 9, fontWeight: 700,
        color: earned ? badge.color : "var(--text-muted)",
        marginBottom: 5, letterSpacing: "0.05em",
        position: "relative",
      }}>
        {badge.name}
      </div>
      <div style={{
        fontSize: 10, color: "var(--text-muted)",
        lineHeight: 1.4, position: "relative",
      }}>
        {badge.description}
      </div>

      {/* Footer tag */}
      <div style={{ marginTop: 8, position: "relative" }}>
        {earned ? (
          <span className="font-orbitron" style={{
            fontSize: 8, color: badge.color,
            background: `${badge.color}18`,
            padding: "2px 8px", borderRadius: 4,
          }}>✓ EARNED</span>
        ) : (
          <span className="font-orbitron" style={{
            fontSize: 8, color: "rgba(255,255,255,0.25)",
          }}>+{badge.xpReward} XP</span>
        )}
      </div>
    </div>
  );
}

export default function Achievements() {
  const [, setLocation] = useLocation();
  const session = getSession();
  const userId = session?.id;

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [streak, setStreak] = useState<Streak>({ currentStreak: 0, longestStreak: 0, totalXp: 0 });
  const [progressCount, setProgressCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"earned" | "locked">("earned");

  useEffect(() => {
    if (!userId) { setLocation("/"); return; }
    Promise.all([
      fetch(`/api/achievements/user/${userId}`).then(r => r.json()),
      fetch(`/api/streaks/${userId}`).then(r => r.json()),
      fetch(`/api/progress/${userId}`).then(r => r.json()),
    ]).then(([badges, streakData, progress]) => {
      setAchievements(Array.isArray(badges) ? badges : []);
      setStreak(streakData ?? { currentStreak: 0, longestStreak: 0, totalXp: 0 });
      setProgressCount(Array.isArray(progress) ? progress.filter((p: any) => p.completed === 1).length : 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  const earned = achievements.filter(a => a.earned);
  const locked = achievements.filter(a => !a.earned);
  const totalXp = streak.totalXp || 0;

  // XP level system: every 500 XP = 1 level
  const XP_PER_LEVEL = 500;
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpInLevel = totalXp % XP_PER_LEVEL;
  const rankLabel = level >= 10 ? "WING COMMANDER" : level >= 7 ? "SQUADRON LEADER" : level >= 5 ? "FLIGHT LIEUTENANT" : level >= 3 ? "FLYING OFFICER" : "CADET";

  const active = tab === "earned" ? earned : locked;

  return (
    <div className="page" style={{ background: "var(--bg-primary)" }}>
      <style>{`
        @keyframes ring-shimmer {
          0%,100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div className="radar-grid" style={{
        background: "linear-gradient(180deg, #071426 0%, #050a12 100%)",
        padding: "20px 20px 0",
        borderBottom: "1px solid rgba(255,209,102,0.12)",
        position: "relative", overflow: "hidden",
      }}>
        <div className="scan-line" />

        {/* Corner brackets */}
        {[
          { top: 10, left: 12 }, { top: 10, right: 12 },
          { bottom: 10, left: 12 }, { bottom: 10, right: 12 },
        ].map((pos, i) => (
          <div key={i} style={{
            position: "absolute", ...pos, width: 14, height: 14,
            borderTop:    i < 2 ? "2px solid rgba(255,209,102,0.35)" : undefined,
            borderBottom: i >= 2 ? "2px solid rgba(255,209,102,0.35)" : undefined,
            borderLeft:   (i === 0 || i === 2) ? "2px solid rgba(255,209,102,0.35)" : undefined,
            borderRight:  (i === 1 || i === 3) ? "2px solid rgba(255,209,102,0.35)" : undefined,
          }} />
        ))}

        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 20 }}>
          {/* Back */}
          <div style={{ alignSelf: "flex-start", marginBottom: 12 }}>
            <BackButton to="/" />
          </div>
          {/* Title */}
          <div className="font-orbitron" style={{ fontSize: 8, letterSpacing: "0.3em", color: "#C9A66B", marginBottom: 6 }}>
            MILITARY RECOGNITION
          </div>

          {/* XP Ring */}
          <XpRing xp={xpInLevel} maxXp={XP_PER_LEVEL} level={level} />

          {/* Rank */}
          <div className="font-orbitron" style={{
            fontSize: 11, letterSpacing: "0.2em", color: "#FFD166",
            marginTop: 10, marginBottom: 2,
          }}>
            {rankLabel}
          </div>
          <div className="font-orbitron" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
            ACHIEVEMENTS
          </div>

          {/* Streak row */}
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            {[
              { label: "🔥 STREAK", value: `${streak.currentStreak}d`, color: "#FF9F43" },
              { label: "⚡ LONGEST", value: `${streak.longestStreak}d`, color: "#FFD166" },
              { label: "🏅 MODULES", value: String(progressCount), color: "#00D26A" },
            ].map(s => (
              <div key={s.label} style={{
                padding: "5px 12px", borderRadius: 20,
                background: `${s.color}14`,
                border: `1px solid ${s.color}30`,
                textAlign: "center",
              }}>
                <div className="font-orbitron" style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{ padding: "12px 16px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        {[
          { label: "EARNED", value: String(earned.length), sub: `/${achievements.length}`, color: "#FFD166" },
          { label: "TOTAL XP", value: totalXp > 999 ? `${(totalXp/1000).toFixed(1)}k` : String(totalXp), color: "#C9A66B" },
          { label: "LEVEL", value: String(level), color: "#00AEEF" },
          { label: "LOCKED", value: String(locked.length), color: "#FF4D4D" },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{
            padding: "10px 6px", textAlign: "center",
            border: `1px solid ${s.color}25`,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: `radial-gradient(circle at 50% 0%, ${s.color}10, transparent 70%)`,
              pointerEvents: "none",
            }} />
            <div className="font-orbitron" style={{ fontSize: 15, fontWeight: 700, color: s.color, position: "relative" }}>
              {s.value}{s.sub && <span style={{ fontSize: 9, opacity: 0.5 }}>{s.sub}</span>}
            </div>
            <div style={{ fontSize: 8, color: "var(--text-muted)", marginTop: 2, letterSpacing: "0.05em", position: "relative" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar overall */}
      <div style={{ padding: "10px 16px 0" }}>
        <div className="progress-bar" style={{ height: 4 }}>
          <div className="progress-fill" style={{
            width: `${achievements.length ? (earned.length / achievements.length) * 100 : 0}%`,
            background: "linear-gradient(90deg, #FFD166, #C9A66B)",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>COMPLETION</span>
          <span className="font-orbitron" style={{ fontSize: 9, color: "#FFD166" }}>
            {achievements.length ? Math.round((earned.length / achievements.length) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "14px 16px 0", display: "flex", gap: 8 }}>
        {(["earned", "locked"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "9px 0", borderRadius: 8,
            border: tab === t
              ? `1px solid ${t === "earned" ? "#FFD166" : "#FF4D4D"}50`
              : "1px solid rgba(255,255,255,0.08)",
            background: tab === t
              ? t === "earned" ? "rgba(255,209,102,0.08)" : "rgba(255,77,77,0.08)"
              : "rgba(255,255,255,0.02)",
            cursor: "pointer", transition: "all 0.15s",
          }}>
            <span className="font-orbitron" style={{
              fontSize: 10, letterSpacing: "0.12em",
              color: tab === t
                ? t === "earned" ? "#FFD166" : "#FF4D4D"
                : "var(--text-muted)",
            }}>
              {t === "earned" ? `✓ EARNED (${earned.length})` : `🔒 LOCKED (${locked.length})`}
            </span>
          </button>
        ))}
      </div>

      {/* Badge Grid */}
      <div style={{ padding: "14px 16px 80px" }}>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass-card" style={{ height: 150, opacity: 0.25, animation: "pulse-glow 1.5s ease infinite" }} />
            ))}
          </div>
        ) : active.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {tab === "earned" ? "🏆" : "✅"}
            </div>
            <div className="font-orbitron" style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {tab === "earned" ? "No badges earned yet" : "All badges unlocked!"}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {active.map((badge, i) => (
              <BadgeCard key={badge.id} badge={badge} earned={tab === "earned"} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
