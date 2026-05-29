import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import BackButton from "../components/BackButton";
import { getSession } from "../hooks/useTelegramTrack";
import { playAlertTone, vibrate } from "../lib/audio";

const C = {
  navy: "#071426",
  steel: "#1C2633",
  cyan: "#00AEEF",
  blue: "#35D4FF",
  green: "#00D26A",
  yellow: "#FFD166",
  red: "#FF4D4D",
  gold: "#C9A66B",
};

interface RealNotif {
  id: number;
  message?: string;
  text?: string;
  alert_type?: string;
  sender_role?: string;
  read: number;
  ts: number;
  _kind: "alert" | "message";
}

type FilterKey = "all" | "message" | "warning" | "danger" | "info" | "sound" | "module";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all",     label: "All" },
  { key: "message", label: "Messages" },
  { key: "warning", label: "Warnings" },
  { key: "danger",  label: "Danger" },
  { key: "info",    label: "Info" },
  { key: "sound",   label: "Sound" },
];

function alertColor(atype: string, isMsg: boolean): string {
  if (isMsg) return C.green;
  const m: Record<string, string> = {
    danger: C.red, warning: C.yellow, sound: C.red,
    info: C.cyan, module: C.blue,
  };
  return m[atype] ?? C.cyan;
}

function alertLabel(atype: string, isMsg: boolean): string {
  if (isMsg) return "💬 Message";
  const m: Record<string, string> = {
    danger: "🚨 Danger Alert",
    warning: "⚠️ Warning",
    sound: "🔊 Sound Alert",
    info: "📢 Info",
    module: "📡 Module",
  };
  return m[atype] ?? "📢 Alert";
}

function formatTs(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 2) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Notifications() {
  const [notifs, setNotifs] = useState<RealNotif[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  const session = getSession();

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const r = await fetch(`/api/trainee/notifications/${session.id}`);
      const data = await r.json() as { alerts: RealNotif[]; messages: RealNotif[] };
      const alerts = (data.alerts ?? []).map(a => ({ ...a, _kind: "alert" as const }));
      const msgs = (data.messages ?? []).map(m => ({ ...m, _kind: "message" as const }));
      const all = [...alerts, ...msgs].sort((a, b) => b.ts - a.ts);
      setNotifs(all);
    } catch { /* non-fatal */ }
    setLoading(false);
  }, [session?.id]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const markAllRead = async () => {
    if (!session) return;
    await fetch("/api/trainee/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traineeId: session.id }),
    }).catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, read: 1 })));
  };

  const handleClick = (notif: RealNotif) => {
    const isMsg = notif._kind === "message";
    const atype = notif.alert_type ?? "";
    // Play sound on tap
    playAlertTone(isMsg ? "message" : (atype as any) || "info");
    vibrate("light");
    // Navigate
    if (isMsg) navigate("/private-chat");
    else if (atype === "module") navigate("/modules");
    else navigate("/notifications"); // stay, already here
  };

  const filtered = filter === "all" ? notifs : notifs.filter(n => {
    if (filter === "message") return n._kind === "message";
    return n.alert_type === filter;
  });

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <div className="page" style={{ background: "var(--bg-primary)" }}>
      <div style={{ paddingBottom: 40 }}>

        {/* Header */}
        <div className="radar-grid" style={{
          background: "linear-gradient(180deg, #071426 0%, #050a12 100%)",
          padding: "20px 20px 16px",
          borderBottom: `1px solid ${C.red}18`,
          position: "relative", overflow: "hidden",
        }}>
          <div className="scan-line" />
          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ marginBottom: 10 }}>
              <BackButton to="/" />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="font-orbitron" style={{ fontSize: 8, letterSpacing: "0.3em", color: C.red, marginBottom: 5 }}>ALERTS & MESSAGES</div>
                <div className="font-orbitron" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>NOTIFICATIONS</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                  {unreadCount > 0 ? `${unreadCount} unread` : loading ? "Loading..." : "All acknowledged"}
                </div>
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{
                  background: `${C.cyan}10`,
                  border: `1px solid ${C.cyan}30`,
                  borderRadius: 8, padding: "8px 14px",
                  color: C.cyan, fontSize: 11, cursor: "pointer",
                  fontFamily: "Orbitron", letterSpacing: "0.06em",
                }}>MARK ALL READ</button>
              )}
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{
          display: "flex", gap: 6, padding: "12px 16px 0",
          overflowX: "auto", paddingBottom: 4,
        }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                background: filter === f.key ? C.cyan : "rgba(28,38,51,0.6)",
                border: `1px solid ${filter === f.key ? C.cyan : "rgba(255,255,255,0.08)"}`,
                borderRadius: 20, padding: "6px 14px",
                color: filter === f.key ? C.navy : "rgba(255,255,255,0.5)",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                fontFamily: "Rajdhani", whiteSpace: "nowrap",
              }}
            >{f.label}</button>
          ))}
        </div>

        {/* List */}
        <div style={{ padding: "12px 16px 0" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontFamily: "Orbitron", fontSize: 11 }}>
              LOADING...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.25)" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔔</div>
              <p style={{ fontFamily: "Orbitron", fontSize: 13, letterSpacing: "0.1em" }}>
                {filter === "all" ? "NO NOTIFICATIONS" : `NO ${filter.toUpperCase()} ALERTS`}
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>
                Instructor alerts will appear here
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map(notif => {
                const isMsg = notif._kind === "message";
                const atype = notif.alert_type ?? (isMsg ? "message" : "info");
                const color = alertColor(atype, isMsg);
                const label = alertLabel(atype, isMsg);
                const body = notif.message ?? notif.text ?? "";

                return (
                  <div
                    key={`${notif._kind}-${notif.id}`}
                    onClick={() => handleClick(notif)}
                    style={{
                      background: notif.read ? "rgba(28,38,51,0.35)" : "rgba(28,38,51,0.65)",
                      border: `1px solid ${notif.read ? "rgba(255,255,255,0.05)" : `${color}30`}`,
                      borderLeft: `3px solid ${notif.read ? "rgba(255,255,255,0.1)" : color}`,
                      borderRadius: "0 12px 12px 0",
                      padding: "14px 16px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      {/* Colored dot */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: `${color}18`,
                        border: `1px solid ${color}30`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16,
                      }}>
                        {isMsg ? "💬" : atype === "danger" ? "🚨" : atype === "warning" ? "⚠️" : atype === "sound" ? "🔊" : "📢"}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 10, fontFamily: "Orbitron", letterSpacing: "0.06em",
                            color, background: `${color}15`,
                            padding: "1px 7px", borderRadius: 4,
                          }}>{label}</span>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
                            {formatTs(notif.ts)}
                          </span>
                          {!notif.read && (
                            <span style={{
                              width: 7, height: 7, borderRadius: "50%",
                              background: color, flexShrink: 0,
                              animation: "pulse-glow 1.5s ease infinite",
                            }} />
                          )}
                        </div>
                        <div style={{
                          fontSize: 13, color: notif.read ? "rgba(255,255,255,0.55)" : "#fff",
                          lineHeight: 1.5,
                        }}>{body}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>
                          {isMsg ? "Tap to open chat →" : atype === "module" ? "Tap to open modules →" : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
