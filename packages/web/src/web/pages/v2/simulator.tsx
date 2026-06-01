import { useState, useEffect, useRef } from "react";
import V2Layout from "./layout";

type SimState = "idle" | "active" | "alarm" | "suspended";

interface Track {
  lat: number; // deviation from centerline (-1 to +1)
  elev: number; // deviation from glidepath (-1 to +1)
  range: number; // NM from threshold
  squawk: string;
  callsign: string;
}

export default function V2Simulator() {
  const [simState, setSimState] = useState<SimState>("idle");
  const [track, setTrack] = useState<Track>({ lat: 0, elev: 0, range: 12, squawk: "7351", callsign: "HZ-ABC" });
  const [systemParams, setSystemParams] = useState({
    glideAngle: 3.00,
    frequency: "110.30",
    txPower: 100,
    course: "195°",
  });
  const [biteOk, setBiteOk] = useState(true);
  const [alarmMsg, setAlarmMsg] = useState("");
  const [log, setLog] = useState<{ ts: string; msg: string; type: "info" | "warn" | "ok" }[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string, type: "info" | "warn" | "ok" = "info") => {
    const ts = new Date().toTimeString().slice(0, 8);
    setLog(prev => [...prev.slice(-49), { ts, msg, type }]);
  };

  const startSim = () => {
    setSimState("active");
    setTrack({ lat: 0.05, elev: 0.08, range: 15, squawk: "7351", callsign: "HZ-ABC" });
    addLog("TLS system active — tracking HZ-ABC squawk 7351", "ok");
    addLog("Approach clearance issued: TLS RWY 18, cleared TLS approach", "info");

    intervalRef.current = setInterval(() => {
      setTrack(prev => {
        const newRange = Math.max(0, prev.range - 0.15);
        // Simulate aircraft flying the approach — gradually center up
        const newLat = prev.lat * 0.97 + (Math.random() - 0.5) * 0.02;
        const newElev = prev.elev * 0.96 + (Math.random() - 0.5) * 0.015;

        if (newRange < 0.5) {
          // Aircraft landed
          if (intervalRef.current) clearInterval(intervalRef.current);
          addLog("Aircraft HZ-ABC: approach complete, range <0.5 NM", "ok");
          setSimState("idle");
        }
        return { ...prev, lat: newLat, elev: newElev, range: newRange };
      });
    }, 1000);
  };

  const triggerAlarm = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSimState("alarm");
    setBiteOk(false);
    setAlarmMsg("FAULT CODE 047 — GTU Signal Processing Anomaly");
    addLog("⚠ BITE ALARM: GTU fault detected — suspending approach service", "warn");
    addLog("ACTION: Notify ATC immediately — issue go-around to all aircraft on approach", "warn");
  };

  const suspendService = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSimState("suspended");
    addLog("TLS service SUSPENDED — coordinator notified ATC", "warn");
    addLog("All aircraft on TLS approach instructed to execute missed approach", "warn");
  };

  const resetSim = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSimState("idle");
    setBiteOk(true);
    setAlarmMsg("");
    setTrack({ lat: 0, elev: 0, range: 12, squawk: "7351", callsign: "HZ-ABC" });
    addLog("System reset — BITE check passed — ready for service", "ok");
  };

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // DDM display values
  const latDDM = (track.lat * 0.155).toFixed(3);
  const elevDDM = (track.elev * 0.175).toFixed(3);
  const latPx = track.lat * 70; // pixels from center
  const elevPx = -track.elev * 70;

  const stateColors: Record<SimState, string> = {
    idle: "#64748b", active: "#00ff88", alarm: "#ef4444", suspended: "#fbbf24"
  };

  return (
    <V2Layout role="trainee">
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.72rem", letterSpacing: "0.15em", color: "#00ff88", marginBottom: "0.5rem" }}>LIVE SIMULATION</div>
        <h2 style={{ fontSize: "1.9rem", fontWeight: 900, color: "#e2e8f0", margin: "0 0 0.25rem" }}>TLS Operator Simulator</h2>
        <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Practice real TLS monitoring and fault response procedures.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* System status */}
          <div style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "1.25rem" }}>
            <div style={{ fontSize: "0.7rem", letterSpacing: "0.12em", color: "#64748b", marginBottom: "0.75rem" }}>SYSTEM STATUS</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{
                width: "12px", height: "12px", borderRadius: "50%",
                background: stateColors[simState],
                boxShadow: `0 0 8px ${stateColors[simState]}`,
              }} />
              <span style={{ fontWeight: 700, color: stateColors[simState], fontSize: "0.9rem" }}>
                {simState.toUpperCase()}
              </span>
              {alarmMsg && <span style={{ fontSize: "0.75rem", color: "#ef4444" }}>{alarmMsg}</span>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.78rem" }}>
              {Object.entries(systemParams).map(([k, v]) => (
                <div key={k} style={{ background: "rgba(255,255,255,0.04)", borderRadius: "6px", padding: "0.5rem 0.75rem" }}>
                  <div style={{ color: "#475569", marginBottom: "0.15rem", textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: "0.1em" }}>{k}</div>
                  <div style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{v}</div>
                </div>
              ))}
            </div>

            {/* BITE status */}
            <div style={{
              marginTop: "0.75rem", padding: "0.5rem 0.75rem",
              background: biteOk ? "rgba(0,255,136,0.06)" : "rgba(239,68,68,0.06)",
              border: `1px solid ${biteOk ? "rgba(0,255,136,0.2)" : "rgba(239,68,68,0.3)"}`,
              borderRadius: "6px", fontSize: "0.78rem",
              color: biteOk ? "#00ff88" : "#ef4444",
            }}>
              BITE: {biteOk ? "✓ ALL SYSTEMS NOMINAL" : `✗ ${alarmMsg}`}
            </div>
          </div>

          {/* Controls */}
          <div style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "1.25rem" }}>
            <div style={{ fontSize: "0.7rem", letterSpacing: "0.12em", color: "#64748b", marginBottom: "0.75rem" }}>OPERATOR CONTROLS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <button
                onClick={startSim}
                disabled={simState === "active"}
                style={{
                  padding: "0.65rem", background: simState === "active" ? "rgba(0,255,136,0.05)" : "rgba(0,255,136,0.12)",
                  border: "1px solid rgba(0,255,136,0.3)", borderRadius: "8px",
                  color: simState === "active" ? "#475569" : "#00ff88", cursor: simState === "active" ? "not-allowed" : "pointer",
                  fontSize: "0.82rem", fontWeight: 600,
                }}>
                {simState === "active" ? "▶ SIMULATION RUNNING..." : "▶ Start Approach Simulation"}
              </button>
              <button
                onClick={triggerAlarm}
                disabled={simState !== "active"}
                style={{
                  padding: "0.65rem",
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: "8px", color: simState !== "active" ? "#475569" : "#ef4444",
                  cursor: simState !== "active" ? "not-allowed" : "pointer",
                  fontSize: "0.82rem", fontWeight: 600,
                }}>
                ⚠ Trigger BITE Alarm
              </button>
              <button
                onClick={suspendService}
                disabled={simState === "idle" || simState === "suspended"}
                style={{
                  padding: "0.65rem",
                  background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)",
                  borderRadius: "8px", color: (simState === "idle" || simState === "suspended") ? "#475569" : "#fbbf24",
                  cursor: (simState === "idle" || simState === "suspended") ? "not-allowed" : "pointer",
                  fontSize: "0.82rem", fontWeight: 600,
                }}>
                ⏸ Suspend Service
              </button>
              <button
                onClick={resetSim}
                style={{
                  padding: "0.65rem", background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
                  color: "#94a3b8", cursor: "pointer", fontSize: "0.82rem",
                }}>
                ↺ Reset System
              </button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* CDI/GS display */}
          <div style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "1.25rem" }}>
            <div style={{ fontSize: "0.7rem", letterSpacing: "0.12em", color: "#64748b", marginBottom: "0.75rem" }}>
              CDI / GLIDE SLOPE DISPLAY
            </div>

            {/* ILS indicator simulation */}
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", alignItems: "center" }}>
              {/* CDI (Localizer) */}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.65rem", color: "#475569", marginBottom: "0.5rem" }}>LOCALIZER</div>
                <div style={{
                  width: "160px", height: "160px",
                  background: "#0a0f18", border: "2px solid rgba(255,255,255,0.12)",
                  borderRadius: "50%", position: "relative",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {/* Crosshairs */}
                  <div style={{ position: "absolute", width: "100%", height: "1px", background: "rgba(255,255,255,0.15)" }} />
                  <div style={{ position: "absolute", width: "1px", height: "100%", background: "rgba(255,255,255,0.15)" }} />
                  {/* Course dots */}
                  {[-70, -35, 0, 35, 70].map(x => (
                    <div key={x} style={{ position: "absolute", left: `${80 + x}px`, width: "4px", height: "4px", borderRadius: "50%", background: "rgba(255,255,255,0.2)", transform: "translate(-50%, 0)" }} />
                  ))}
                  {/* Needle */}
                  <div style={{
                    position: "absolute", left: `${80 + latPx}px`, width: "3px", height: "120px",
                    background: "#00ff88", borderRadius: "2px", transform: "translateX(-50%)",
                    transition: "left 0.5s ease",
                    boxShadow: "0 0 6px rgba(0,255,136,0.5)",
                  }} />
                  <div style={{ fontSize: "0.65rem", color: "#475569", marginTop: "70px" }}>DDM: {latDDM}</div>
                </div>
              </div>

              {/* Glide Slope */}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.65rem", color: "#475569", marginBottom: "0.5rem" }}>GLIDE PATH</div>
                <div style={{
                  width: "160px", height: "160px",
                  background: "#0a0f18", border: "2px solid rgba(255,255,255,0.12)",
                  borderRadius: "50%", position: "relative",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ position: "absolute", width: "100%", height: "1px", background: "rgba(255,255,255,0.15)" }} />
                  <div style={{ position: "absolute", width: "1px", height: "100%", background: "rgba(255,255,255,0.15)" }} />
                  {[-70, -35, 0, 35, 70].map(y => (
                    <div key={y} style={{ position: "absolute", top: `${80 + y}px`, width: "4px", height: "4px", borderRadius: "50%", background: "rgba(255,255,255,0.2)", transform: "translate(0, -50%)" }} />
                  ))}
                  <div style={{
                    position: "absolute", top: `${80 + elevPx}px`, width: "120px", height: "3px",
                    background: "#00ff88", borderRadius: "2px", transform: "translateY(-50%)",
                    transition: "top 0.5s ease",
                    boxShadow: "0 0 6px rgba(0,255,136,0.5)",
                  }} />
                </div>
                <div style={{ fontSize: "0.65rem", color: "#475569", marginTop: "0.25rem" }}>DDM: {elevDDM}</div>
              </div>
            </div>

            {/* Track info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "1rem", fontSize: "0.75rem" }}>
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "6px", padding: "0.4rem 0.75rem" }}>
                <div style={{ color: "#475569" }}>CALLSIGN</div>
                <div style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{track.callsign}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "6px", padding: "0.4rem 0.75rem" }}>
                <div style={{ color: "#475569" }}>SQUAWK</div>
                <div style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{track.squawk}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "6px", padding: "0.4rem 0.75rem" }}>
                <div style={{ color: "#475569" }}>RANGE</div>
                <div style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{track.range.toFixed(1)} NM</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "6px", padding: "0.4rem 0.75rem" }}>
                <div style={{ color: "#475569" }}>STATUS</div>
                <div style={{ color: stateColors[simState], fontFamily: "monospace" }}>{simState.toUpperCase()}</div>
              </div>
            </div>
          </div>

          {/* Event log */}
          <div style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "1.25rem", flex: 1 }}>
            <div style={{ fontSize: "0.7rem", letterSpacing: "0.12em", color: "#64748b", marginBottom: "0.75rem" }}>EVENT LOG</div>
            <div
              ref={logRef}
              style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.3rem", scrollbarWidth: "thin" }}
            >
              {log.length === 0 && (
                <div style={{ color: "#334155", fontSize: "0.78rem" }}>No events yet. Start a simulation.</div>
              )}
              {log.map((entry, i) => (
                <div key={i} style={{
                  fontSize: "0.75rem",
                  color: entry.type === "warn" ? "#fbbf24" : entry.type === "ok" ? "#00ff88" : "#94a3b8",
                  display: "flex", gap: "0.5rem",
                }}>
                  <span style={{ color: "#334155", flexShrink: 0 }}>{entry.ts}</span>
                  <span>{entry.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </V2Layout>
  );
}
