import { useState, useEffect, useRef } from "react";
import BackButton from "../components/BackButton";

const C = {
  navy:   "#071426",
  cyan:   "#00AEEF",
  blue:   "#35D4FF",
  green:  "#00D26A",
  yellow: "#FFD166",
  red:    "#FF4D4D",
  gold:   "#C9A66B",
};

type StatusLevel = "online" | "degraded" | "offline" | "unknown";

interface Check {
  id: string;
  name: string;
  description: string;
  status: StatusLevel;
  latency?: number;        // ms
  detail?: string;         // extra info shown below
  lastChecked?: Date;
}

function statusColor(s: StatusLevel) {
  if (s === "online")   return C.green;
  if (s === "degraded") return C.yellow;
  if (s === "offline")  return C.red;
  return "rgba(255,255,255,0.3)";
}

function statusLabel(s: StatusLevel) {
  if (s === "online")   return "Operational";
  if (s === "degraded") return "Degraded";
  if (s === "offline")  return "Offline";
  return "Unknown";
}

// ── Radar canvas ────────────────────────────────────────────────────────────
function RadarCanvas({ overallStatus }: { overallStatus: StatusLevel }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const blipDefs = useRef([
    { angle: 0.4,  dist: 0.52, label: "DB"  },
    { angle: 1.1,  dist: 0.31, label: "SRV" },
    { angle: 2.2,  dist: 0.68, label: "TG"  },
    { angle: 3.5,  dist: 0.44, label: "USR" },
    { angle: 5.0,  dist: 0.60, label: "ACT" },
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const SIZE = canvas.width;
    const CX = SIZE / 2, CY = SIZE / 2, R = SIZE / 2 - 8;
    const sweepColor = statusColor(overallStatus);

    ctx.clearRect(0, 0, SIZE, SIZE);

    // Outer circle
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, 2 * Math.PI);
    ctx.strokeStyle = `${sweepColor}25`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Rings
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

    // Center dot
    ctx.beginPath();
    ctx.arc(CX, CY, 3, 0, 2 * Math.PI);
    ctx.fillStyle = sweepColor;
    ctx.fill();

    // Blips
    blipDefs.current.forEach(b => {
      const bx = CX + Math.cos(b.angle) * R * b.dist;
      const by = CY + Math.sin(b.angle) * R * b.dist;

      ctx.save();
      ctx.shadowBlur  = 10;
      ctx.shadowColor = sweepColor;
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, 2 * Math.PI);
      ctx.fillStyle = sweepColor;
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = `rgba(0,174,239,0.8)`;
      ctx.font = "bold 7px Inter, sans-serif";
      ctx.fillText(b.label, bx + 5, by - 5);
    });
  }, [overallStatus]);

  return <canvas ref={canvasRef} width={220} height={220} style={{ display: "block" }} />;
}

function PulseDot({ status }: { status: StatusLevel }) {
  const color = statusColor(status);
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 12, height: 12 }}>
      {status === "online" && (
        <span style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: color, opacity: 0.35,
          animation: "ping 1.8s cubic-bezier(0,0,0.2,1) infinite",
        }} />
      )}
      <span style={{
        width: 12, height: 12, borderRadius: "50%",
        background: color, display: "block", flexShrink: 0,
      }} />
    </span>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Status() {
  const [checks, setChecks]         = useState<Check[]>([]);
  const [loading, setLoading]       = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Admin pw stored in localStorage (same as admin panel uses)
  const adminPw = localStorage.getItem("tls_admin_pw") ?? "";

  async function runChecks() {
    setLoading(true);
    const now = new Date();

    // 1. Database
    let dbCheck: Check = { id: "db", name: "Database", description: "Turso edge database", status: "unknown" };
    try {
      const t0  = performance.now();
      const res = await fetch("/api/health/db");
      const ms  = Math.round(performance.now() - t0);
      if (res.ok) {
        dbCheck = { ...dbCheck, status: ms > 800 ? "degraded" : "online", latency: ms, lastChecked: now };
      } else {
        dbCheck = { ...dbCheck, status: "offline", lastChecked: now };
      }
    } catch {
      dbCheck = { ...dbCheck, status: "offline", lastChecked: now };
    }

    // 2. Server response time
    let srvCheck: Check = { id: "server", name: "Server", description: "API response time", status: "unknown" };
    try {
      const t0  = performance.now();
      const res = await fetch("/api/health");
      const ms  = Math.round(performance.now() - t0);
      if (res.ok) {
        srvCheck = { ...srvCheck, status: ms > 1500 ? "degraded" : "online", latency: ms, lastChecked: now };
      } else {
        srvCheck = { ...srvCheck, status: "offline", lastChecked: now };
      }
    } catch {
      srvCheck = { ...srvCheck, status: "offline", lastChecked: now };
    }

    // 3. Telegram Bot
    let tgCheck: Check = { id: "telegram", name: "Telegram Bot", description: "Notification delivery", status: "unknown" };
    try {
      const res  = await fetch("/api/admin/telegram", { headers: { "x-admin-password": adminPw } });
      if (res.ok) {
        const data = await res.json();
        const hasToken = data.hasToken === true;
        const enabled  = data.enabled  === true;
        tgCheck = {
          ...tgCheck,
          status: enabled && hasToken ? "online" : enabled && !hasToken ? "degraded" : "offline",
          detail: enabled ? (hasToken ? "Enabled · Token configured" : "Enabled · No token") : "Disabled",
          lastChecked: now,
        };
      } else if (res.status === 401) {
        tgCheck = { ...tgCheck, status: "unknown", detail: "Admin password required", lastChecked: now };
      } else {
        tgCheck = { ...tgCheck, status: "offline", lastChecked: now };
      }
    } catch {
      tgCheck = { ...tgCheck, status: "unknown", lastChecked: now };
    }

    // 4 & 5. Trainees (online count + last activity)
    let usrCheck: Check  = { id: "trainees", name: "Online Trainees", description: "Active sessions", status: "unknown" };
    let actCheck: Check  = { id: "activity", name: "Last Activity",   description: "Most recent trainee login", status: "unknown" };
    try {
      const res = await fetch("/api/admin/trainees", { headers: { "x-admin-password": adminPw } });
      if (res.ok) {
        const trainees: any[] = await res.json();
        const onlineCount = trainees.filter(t => t.isOnline).length;
        usrCheck = {
          ...usrCheck,
          status: "online",
          detail: `${onlineCount} online · ${trainees.length} total`,
          lastChecked: now,
        };

        // Last activity timestamp
        const lastTs = trainees
          .map(t => t.lastActiveAt ?? t.lastLoginAt ?? 0)
          .filter(Boolean)
          .sort((a, b) => b - a)[0];
        if (lastTs) {
          const d = new Date(typeof lastTs === "number" && lastTs < 1e12 ? lastTs * 1000 : lastTs);
          actCheck = {
            ...actCheck,
            status: "online",
            detail: d.toLocaleString(),
            lastChecked: now,
          };
        } else {
          actCheck = { ...actCheck, status: "unknown", detail: "No activity recorded", lastChecked: now };
        }
      } else if (res.status === 401) {
        usrCheck = { ...usrCheck, status: "unknown", detail: "Admin password required", lastChecked: now };
        actCheck = { ...actCheck, status: "unknown", detail: "Admin password required", lastChecked: now };
      } else {
        usrCheck = { ...usrCheck, status: "offline", lastChecked: now };
        actCheck = { ...actCheck, status: "unknown", lastChecked: now };
      }
    } catch {
      usrCheck = { ...usrCheck, status: "unknown", lastChecked: now };
      actCheck = { ...actCheck, status: "unknown", lastChecked: now };
    }

    setChecks([dbCheck, srvCheck, tgCheck, usrCheck, actCheck]);
    setLastRefresh(now);
    setLoading(false);
  }

  useEffect(() => {
    runChecks();
    const interval = setInterval(runChecks, 30000);
    return () => clearInterval(interval);
  }, []);

  const realChecks   = checks.filter(c => c.status !== "unknown");
  const anyOffline   = checks.some(c => c.status === "offline");
  const anyDegraded  = checks.some(c => c.status === "degraded");
  const allUnknown   = checks.length > 0 && checks.every(c => c.status === "unknown");

  const overallStatus: StatusLevel =
    loading || allUnknown  ? "unknown"
    : anyOffline           ? "offline"
    : anyDegraded          ? "degraded"
    : realChecks.length > 0 ? "online"
    : "unknown";

  const onlineCount  = checks.filter(c => c.status === "online").length;
  const issueCount   = checks.filter(c => c.status === "offline" || c.status === "degraded").length;

  const overallLabel =
    overallStatus === "online"   ? "ALL SYSTEMS OPERATIONAL"
    : overallStatus === "degraded" ? "PARTIAL DEGRADATION"
    : overallStatus === "offline"  ? "SYSTEM OUTAGE"
    : "CHECKING SYSTEMS…";

  return (
    <div className="page" style={{ background: "var(--bg-primary)", paddingBottom: 60 }}>
      <style>{`
        @keyframes ping {
          0%        { transform: scale(1); opacity: 0.35; }
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        background: "linear-gradient(180deg, #071426 0%, #050a12 100%)",
        padding: "20px 20px 16px",
        borderBottom: "1px solid rgba(0,174,239,0.15)",
      }}>
        <div style={{ marginBottom: 12 }}><BackButton to="/" /></div>
        <div className="font-orbitron" style={{ fontSize: 8, letterSpacing: "0.3em", color: C.cyan, marginBottom: 5 }}>
          SYSTEM MONITOR
        </div>
        <div className="font-orbitron" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
          RADAR STATUS
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
          {lastRefresh
            ? `Last refresh: ${lastRefresh.toLocaleTimeString()} · auto 30s`
            : "Checking…"}
        </div>
      </div>

      {/* Radar + Overall */}
      <div style={{ padding: "20px 16px 0", display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{
          position: "relative", flexShrink: 0,
          background: "rgba(0,10,20,0.7)",
          border: `1px solid ${statusColor(overallStatus)}25`,
          borderRadius: 16, padding: 8,
          boxShadow: `0 0 24px ${statusColor(overallStatus)}15`,
        }}>
          <RadarCanvas overallStatus={overallStatus} />
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

        <div style={{ flex: 1 }}>
          {/* Overall banner — only show degraded/outage if real */}
          <div style={{
            padding: "14px 16px", borderRadius: 14, marginBottom: 10,
            background: `${statusColor(overallStatus)}08`,
            border: `1px solid ${statusColor(overallStatus)}35`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <PulseDot status={overallStatus} />
              <div className="font-orbitron" style={{
                fontSize: 10, color: statusColor(overallStatus), letterSpacing: "0.06em",
              }}>
                {overallLabel}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
              {loading
                ? "Running checks…"
                : `${onlineCount} up · ${issueCount} issue${issueCount !== 1 ? "s" : ""}`}
            </div>
          </div>

          {/* Mini stats */}
          {[
            { label: "CHECKS",  value: loading ? "…" : String(checks.length),    color: C.cyan  },
            { label: "ONLINE",  value: loading ? "…" : String(onlineCount),       color: C.green },
            { label: "ISSUES",  value: loading ? "…" : String(issueCount),        color: issueCount > 0 ? C.yellow : C.green },
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

      {/* Checks list */}
      <div style={{ padding: "20px 16px 0" }}>
        <div className="font-orbitron" style={{
          fontSize: 9, letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.35)", marginBottom: 10,
        }}>
          LIVE CHECKS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {loading && checks.length === 0 ? (
            <div style={{
              textAlign: "center", color: "rgba(255,255,255,0.3)",
              fontSize: 13, padding: "24px 0",
            }}>Running checks…</div>
          ) : checks.map(c => (
            <div key={c.id} style={{
              background: "rgba(28,38,51,0.45)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderLeft: `3px solid ${statusColor(c.status)}`,
              borderRadius: "0 10px 10px 0",
              padding: "12px 14px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <PulseDot status={c.status} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                  {c.detail ?? c.description}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div className="font-orbitron" style={{
                  fontSize: 10, color: statusColor(c.status), letterSpacing: "0.06em",
                }}>
                  {statusLabel(c.status)}
                </div>
                {c.latency !== undefined && (
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                    {c.latency}ms
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Refresh button */}
      <div style={{ padding: "20px 16px 0" }}>
        <button
          onClick={runChecks}
          disabled={loading}
          style={{
            width: "100%", padding: "12px",
            background: "rgba(0,174,239,0.08)",
            border: "1px solid rgba(0,174,239,0.25)",
            borderRadius: 10, color: C.cyan,
            fontFamily: "Orbitron, sans-serif",
            fontSize: 11, letterSpacing: "0.12em",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? "CHECKING…" : "↻ REFRESH NOW"}
        </button>
      </div>

    </div>
  );
}
