import { useState, useEffect, useRef } from "react";
import BackButton from "../components/BackButton";

const C = {
  navy: "#071426",
  cyan: "#00AEEF",
  blue: "#35D4FF",
  green: "#00D26A",
  yellow: "#FFD166",
  red: "#FF4D4D",
  gold: "#C9A66B",
};

type StatusLevel = "online" | "degraded" | "offline";

interface SystemStatus {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  status: StatusLevel;
  uptime: number;
  latency?: number;
  lastChecked: Date;
}

const initialSystems: SystemStatus[] = [
  { id: "ai",      name: "AI Instructor",      nameAr: "المدرب الذكي",       description: "GPT-powered training assistant", status: "online",   uptime: 99.8,  latency: 142, lastChecked: new Date() },
  { id: "db",      name: "Database",            nameAr: "قاعدة البيانات",     description: "Turso edge database",           status: "online",   uptime: 99.99, latency: 18,  lastChecked: new Date() },
  { id: "quiz",    name: "Quiz Engine",         nameAr: "محرك الاختبارات",    description: "Question & scoring system",     status: "online",   uptime: 100,   latency: 24,  lastChecked: new Date() },
  { id: "modules", name: "Training Modules",    nameAr: "وحدات التدريب",      description: "PDF & content delivery",        status: "online",   uptime: 99.5,  latency: 88,  lastChecked: new Date() },
  { id: "auth",    name: "Authentication",      nameAr: "نظام المصادقة",      description: "User session management",       status: "online",   uptime: 99.9,  latency: 31,  lastChecked: new Date() },
  { id: "notify",  name: "Notifications",       nameAr: "نظام الإشعارات",     description: "Push & in-app alerts",          status: "degraded", uptime: 97.2,  latency: 340, lastChecked: new Date() },
  { id: "sync",    name: "Data Sync",           nameAr: "مزامنة البيانات",    description: "Real-time progress sync",       status: "online",   uptime: 98.7,  latency: 56,  lastChecked: new Date() },
  { id: "cdn",     name: "Media CDN",           nameAr: "شبكة التوصيل",       description: "Images & static assets",        status: "online",   uptime: 100,   latency: 12,  lastChecked: new Date() },
];

const incidents = [
  { id: 1, date: "2025-01-14", title: "Notification delays",       titleAr: "تأخر في الإشعارات",       desc: "Push notifications experiencing 3-5 min delay. Investigation ongoing.", level: "degraded" as StatusLevel, resolved: false },
  { id: 2, date: "2025-01-12", title: "AI response latency spike", titleAr: "ارتفاع زمن الاستجابة",    desc: "AI Instructor experienced elevated response times. Resolved after model optimization.",  level: "degraded" as StatusLevel, resolved: true },
  { id: 3, date: "2025-01-08", title: "Scheduled maintenance",     titleAr: "صيانة مجدولة",            desc: "Database migration completed. 12-minute downtime window.",            level: "offline"  as StatusLevel, resolved: true },
];

function statusColor(s: StatusLevel) {
  return s === "online" ? C.green : s === "degraded" ? C.yellow : C.red;
}
function statusLabel(s: StatusLevel) {
  return s === "online" ? "Operational" : s === "degraded" ? "Degraded" : "Offline";
}

// Animated radar canvas
function RadarCanvas({ overallStatus }: { overallStatus: StatusLevel }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const blips = useRef([
    { angle: 0.4, dist: 0.52, label: "AI" },
    { angle: 1.1, dist: 0.31, label: "DB" },
    { angle: 2.2, dist: 0.68, label: "QUIZ" },
    { angle: 3.5, dist: 0.44, label: "SYNC" },
    { angle: 5.0, dist: 0.74, label: "CDN" },
    { angle: 4.2, dist: 0.28, label: "AUTH" },
    { angle: 1.8, dist: 0.6,  label: "MODS" },
    { angle: 5.8, dist: 0.5,  label: "NTFY", warn: true },
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const SIZE = canvas.width;
    const CX = SIZE / 2, CY = SIZE / 2, R = SIZE / 2 - 8;
    const sweepColor = overallStatus === "online" ? C.green : overallStatus === "degraded" ? C.yellow : C.red;

    let raf: number;
    const blipTrails: { angle: number; dist: number; warn?: boolean; opacity: number }[] = [];

    const draw = () => {
      angleRef.current = (angleRef.current + 0.012) % (2 * Math.PI);
      const sweep = angleRef.current;

      ctx.clearRect(0, 0, SIZE, SIZE);

      // Outer circle
      ctx.beginPath();
      ctx.arc(CX, CY, R, 0, 2 * Math.PI);
      ctx.strokeStyle = `${sweepColor}25`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Concentric rings
      for (const ratio of [0.25, 0.5, 0.75]) {
        ctx.beginPath();
        ctx.arc(CX, CY, R * ratio, 0, 2 * Math.PI);
        ctx.strokeStyle = `${sweepColor}12`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Crosshairs
      for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(CX + Math.cos(a) * R, CY + Math.sin(a) * R);
        ctx.strokeStyle = `${sweepColor}10`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Sweep gradient
      const grad = ctx.createConicalGradient
        ? null // not standard — use arc approach below
        : null;

      // Draw sweep sector (last ~60°)
      const SWEEP_ARC = Math.PI / 3;
      for (let s = 0; s < 24; s++) {
        const ratio = s / 24;
        const startA = sweep - SWEEP_ARC * (1 - ratio);
        const endA = sweep - SWEEP_ARC * (1 - (s + 1) / 24);
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.arc(CX, CY, R, startA, endA);
        ctx.closePath();
        ctx.fillStyle = `rgba(${sweepColor === C.green ? "0,210,106" : sweepColor === C.yellow ? "255,209,102" : "255,77,77"},${0.08 * ratio})`;
        ctx.fill();
      }

      // Sweep line
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = sweepColor;
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(CX + Math.cos(sweep) * R, CY + Math.sin(sweep) * R);
      ctx.strokeStyle = `${sweepColor}cc`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Center dot
      ctx.beginPath();
      ctx.arc(CX, CY, 3, 0, 2 * Math.PI);
      ctx.fillStyle = sweepColor;
      ctx.fill();

      // Blips
      blips.current.forEach(b => {
        const bx = CX + Math.cos(b.angle) * R * b.dist;
        const by = CY + Math.sin(b.angle) * R * b.dist;

        // Check if sweep is near this blip
        let diff = (sweep - b.angle + 2 * Math.PI) % (2 * Math.PI);
        const lit = diff < 0.12;

        const blipColor = b.warn ? C.yellow : sweepColor;

        // Fading trail: brightness fades after sweep passes
        const trailRatio = Math.max(0, 1 - diff / (Math.PI * 1.5));

        ctx.save();
        ctx.shadowBlur = lit ? 16 : 6 * trailRatio;
        ctx.shadowColor = blipColor;
        ctx.beginPath();
        ctx.arc(bx, by, lit ? 4 : 3, 0, 2 * Math.PI);
        ctx.fillStyle = lit ? "#fff" : `${blipColor}${Math.round(trailRatio * 200).toString(16).padStart(2, "0")}`;
        ctx.fill();
        ctx.restore();

        // Label
        ctx.fillStyle = `rgba(${b.warn ? "255,209,102" : "0,174,239"},${0.4 + trailRatio * 0.6})`;
        ctx.font = `bold 7px Inter, sans-serif`;
        ctx.fillText(b.label, bx + 5, by - 5);
      });

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [overallStatus]);

  return <canvas ref={canvasRef} width={220} height={220} style={{ display: "block" }} />;
}

function PulseDot({ status }: { status: StatusLevel }) {
  const color = statusColor(status);
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 12, height: 12 }}>
      {status !== "offline" && (
        <span style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: color, opacity: 0.35,
          animation: "ping 1.8s cubic-bezier(0,0,0.2,1) infinite",
        }} />
      )}
      <span style={{ width: 12, height: 12, borderRadius: "50%", background: color, display: "block", flexShrink: 0 }} />
    </span>
  );
}

export default function Status() {
  const [systems, setSystems] = useState<SystemStatus[]>(initialSystems);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date());
      setSystems(prev => prev.map(s => ({
        ...s,
        latency: s.latency ? Math.max(5, s.latency + Math.floor((Math.random() - 0.5) * 20)) : undefined,
        lastChecked: new Date(),
      })));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const allOnline  = systems.every(s => s.status === "online");
  const anyOffline = systems.some(s => s.status === "offline");
  const overallStatus: StatusLevel = anyOffline ? "offline" : allOnline ? "online" : "degraded";

  const onlineCount   = systems.filter(s => s.status === "online").length;
  const degradedCount = systems.filter(s => s.status === "degraded").length;
  const offlineCount  = systems.filter(s => s.status === "offline").length;

  return (
    <div className="page" style={{ background: "var(--bg-primary)", paddingBottom: 60 }}>
      <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.35; }
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      {/* Header */}
      <div className="radar-grid" style={{
        background: "linear-gradient(180deg, #071426 0%, #050a12 100%)",
        padding: "20px 20px 16px",
        borderBottom: "1px solid rgba(0,174,239,0.15)",
        position: "relative", overflow: "hidden",
      }}>
        <div className="scan-line" />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ marginBottom: 12 }}>
            <BackButton to="/" />
          </div>
          <div className="font-orbitron" style={{ fontSize: 8, letterSpacing: "0.3em", color: C.cyan, marginBottom: 5 }}>SYSTEM MONITOR</div>
          <div className="font-orbitron" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>RADAR STATUS</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
            Last refresh: {lastRefresh.toLocaleTimeString()} · auto 30s
          </div>
        </div>
      </div>

      {/* Radar + Overall banner side by side */}
      <div style={{ padding: "20px 16px 0", display: "flex", gap: 16, alignItems: "center" }}>
        {/* Radar */}
        <div style={{
          position: "relative", flexShrink: 0,
          background: "rgba(0,10,20,0.7)",
          border: `1px solid ${statusColor(overallStatus)}25`,
          borderRadius: 16,
          padding: 8,
          boxShadow: `0 0 24px ${statusColor(overallStatus)}15`,
        }}>
          <RadarCanvas overallStatus={overallStatus} />
          {/* Corner brackets */}
          {[
            { top: 4, left: 4 }, { top: 4, right: 4 },
            { bottom: 4, left: 4 }, { bottom: 4, right: 4 },
          ].map((pos, i) => (
            <div key={i} style={{
              position: "absolute", ...pos, width: 10, height: 10,
              borderTop:    i < 2 ? `1.5px solid ${statusColor(overallStatus)}60` : undefined,
              borderBottom: i >= 2 ? `1.5px solid ${statusColor(overallStatus)}60` : undefined,
              borderLeft:   (i === 0 || i === 2) ? `1.5px solid ${statusColor(overallStatus)}60` : undefined,
              borderRight:  (i === 1 || i === 3) ? `1.5px solid ${statusColor(overallStatus)}60` : undefined,
            }} />
          ))}
        </div>

        {/* Overall status */}
        <div style={{ flex: 1 }}>
          <div style={{
            padding: "14px 16px",
            borderRadius: 14,
            background: `${statusColor(overallStatus)}08`,
            border: `1px solid ${statusColor(overallStatus)}35`,
            marginBottom: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <PulseDot status={overallStatus} />
              <div className="font-orbitron" style={{ fontSize: 11, color: statusColor(overallStatus), letterSpacing: "0.06em" }}>
                {overallStatus === "online" ? "ALL OPERATIONAL" : overallStatus === "degraded" ? "PARTIAL DEGRADATION" : "SYSTEM OUTAGE"}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
              {onlineCount} up · {degradedCount} degraded · {offlineCount} down
            </div>
          </div>

          {/* Mini stats */}
          {[
            { label: "SYSTEMS", value: String(systems.length), color: C.cyan },
            { label: "ONLINE",  value: String(onlineCount),   color: C.green },
            { label: "ISSUES",  value: String(degradedCount + offlineCount), color: degradedCount + offlineCount > 0 ? C.yellow : C.green },
          ].map(s => (
            <div key={s.label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{s.label}</span>
              <span className="font-orbitron" style={{ fontSize: 11, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Systems list */}
      <div style={{ padding: "20px 16px 0" }}>
        <div className="font-orbitron" style={{ fontSize: 9, letterSpacing: "0.2em", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>
          COMPONENTS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {systems.map(sys => (
            <div key={sys.id} style={{
              background: "rgba(28,38,51,0.45)",
              border: `1px solid rgba(255,255,255,0.06)`,
              borderLeft: `3px solid ${statusColor(sys.status)}`,
              borderRadius: "0 10px 10px 0",
              padding: "12px 14px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <PulseDot status={sys.status} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{sys.name}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{sys.nameAr}</span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{sys.description}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div className="font-orbitron" style={{ fontSize: 10, color: statusColor(sys.status), letterSpacing: "0.06em" }}>
                  {statusLabel(sys.status)}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                  {sys.latency ? `${sys.latency}ms` : "—"} · {sys.uptime}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Uptime bars */}
      <div style={{ padding: "20px 16px 0" }}>
        <div className="glass-card" style={{ padding: "16px 18px" }}>
          <div className="font-orbitron" style={{ fontSize: 9, letterSpacing: "0.2em", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>
            UPTIME — 90 DAYS
          </div>
          {systems.slice(0, 5).map(sys => (
            <div key={sys.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{sys.name}</span>
                <span className="font-orbitron" style={{ fontSize: 10, color: sys.uptime >= 99.5 ? C.green : sys.uptime >= 97 ? C.yellow : C.red }}>
                  {sys.uptime}%
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  width: `${sys.uptime}%`,
                  background: sys.uptime >= 99.5
                    ? `linear-gradient(90deg, ${C.green}, #00ff88)`
                    : sys.uptime >= 97
                    ? `linear-gradient(90deg, ${C.yellow}, #ffaa00)`
                    : `linear-gradient(90deg, ${C.red}, #ff8888)`,
                  transition: "width 0.5s ease",
                  boxShadow: `0 0 8px ${sys.uptime >= 99.5 ? C.green : sys.uptime >= 97 ? C.yellow : C.red}60`,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Incidents */}
      <div style={{ padding: "20px 16px 0" }}>
        <div className="font-orbitron" style={{ fontSize: 9, letterSpacing: "0.2em", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>
          INCIDENT HISTORY
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {incidents.map(inc => (
            <div key={inc.id} style={{
              background: "rgba(28,38,51,0.4)",
              border: `1px solid ${statusColor(inc.level)}20`,
              borderLeft: `3px solid ${statusColor(inc.level)}`,
              borderRadius: "0 12px 12px 0",
              padding: "12px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 9, fontFamily: "Inter", letterSpacing: "0.08em",
                  color: statusColor(inc.level),
                  background: `${statusColor(inc.level)}18`,
                  padding: "2px 8px", borderRadius: 4, textTransform: "uppercase",
                }}>{inc.level}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{inc.date}</span>
                <span style={{
                  fontSize: 9, fontFamily: "Inter", letterSpacing: "0.06em",
                  color: inc.resolved ? C.green : C.yellow,
                  background: inc.resolved ? `${C.green}18` : `${C.yellow}18`,
                  padding: "2px 8px", borderRadius: 4,
                  marginLeft: "auto",
                }}>{inc.resolved ? "RESOLVED" : "ONGOING"}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>
                {inc.title} <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>· {inc.titleAr}</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{inc.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
