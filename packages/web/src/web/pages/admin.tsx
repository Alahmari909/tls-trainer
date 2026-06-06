import React, { useState, useEffect, useCallback, useRef } from "react";
import BackButton from "../components/BackButton";

import Basics from "./basics";
import Advanced from "./advanced";
import QuizList from "./quiz-list";
import Chat from "./chat";
import PrivateChat from "./private-chat";
import Status from "./status";
import Notifications from "./notifications";
import About from "./about";

// Admin military-green theme — completely separate from trainee cyan theme
const C = {
  // Primary admin colors
  primary: "#00FF88",      // neon military green (was cyan)
  accent:  "#FFD700",      // gold accent (was yellow/gold)
  green:   "#00CC66",      // darker green for success states
  lime:    "#39FF14",      // ultra-bright lime for highlights
  // Alert colors
  red:     "#FF4444",      // admin red (login + danger)
  orange:  "#FF8C00",      // warning orange
  yellow:  "#FFD700",      // gold/yellow
  // Legacy aliases so all existing code keeps working
  cyan:    "#00FF88",      // remapped: cyan → primary green
  blue:    "#00CC88",      // remapped: blue → muted green
  gold:    "#FFD700",      // remapped: gold → accent gold
};

const SESSION_KEY = "tls_admin_verified";

// ─── Types ────────────────────────────────────────────────────────────────────
type Trainee = {
  id: string; name: string; email: string; role: string;
  xp: number; currentStreak: number; longestStreak: number;
  completedModules: number; totalModules: number; earnedBadges: number;
  lastActive: number; lastActiveAt?: number; lastPage?: string | null;
  online: boolean; createdAt: number;
  status?: string; trainingLevel?: string;
};

type ModerationEntry = { id: number; action: string; reason: string | null; admin_id: string; ts: number };

type TraineeDetail = {
  trainee: {
    id: string; name: string; rank: string | null; unit: string | null;
    created_at: number; last_login_at: number; login_count: number;
    is_online: number; last_page: string | null; last_active_at: number; online: boolean;
    status: string;
  };
  stats: {
    totalAttempts: number; totalCorrect: number; totalWrong: number;
    bestScore: number; avgScore: number; completedModules: number; manualViews: number;
    passedAttempts?: number; failedAttempts?: number; trainingHours?: number;
    totalModules?: number; assignedModules?: number;
  };
  activityLog: Array<{ id: number; event: string; detail: string | null; page: string | null; ts: number }>;
  quizAttempts: Array<{ id: number; module_id: number; module_name: string | null; score: number; total: number; correct: number; wrong: number; pct: number; passed: number; ts: number }>;
  moduleProgress: Array<{ id: number; module_id: number; module_name: string | null; progress: number; completed: number; assigned_by_admin: number; last_accessed_at: number }>;
  instructorNotes: Array<{ id: number; note: string; author_id: string; ts: number }>;
  messages: Array<{ id: number; sender_role: string; text: string; read: number; ts: number }>;
  alerts: Array<{ id: number; message: string; alert_type: string; read: number; ts: number }>;
  evaluation?: { rating: string; recommendation: string; technical_observations: string; updated_at: number } | null;
  timeLogs?: Array<{ module_id: number; module_name: string; total_ms: number }>;
  manualLogs?: Array<{ manual_name: string; view_count: number; total_ms: number }>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(ms: number): string {
  if (!ms) return "Never";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 2) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDate(ms: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Quiz Answer Breakdown Component ──────────────────────────────────────────
function QuizAnswerBreakdown({ attemptId, traineeId, adminPw }: { attemptId: number; traineeId: string; adminPw: string }) {
  const [expanded, setExpanded] = useState(false);
  const [answers, setAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (answers.length > 0) { setExpanded(e => !e); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/quiz-answers/${traineeId}`, {
        headers: { 'x-admin-password': adminPw }
      });
      const all = await res.json();
      const filtered = all.filter((a: any) => a.attempt_id === attemptId);
      setAnswers(filtered);
      setExpanded(true);
    } catch {}
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={load} style={{
        background: "transparent", border: "1px solid rgba(0,255,136,0.2)",
        color: "#00FF88", borderRadius: 6, padding: "4px 10px",
        fontSize: 10, fontFamily: "Inter", cursor: "pointer", letterSpacing: "0.06em",
      }}>
        {loading ? "..." : expanded ? "▲ HIDE ANSWERS" : "▼ SHOW ANSWERS"}
      </button>
      {expanded && answers.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {answers.map((a: any, i: number) => (
            <div key={i} style={{
              padding: "8px 10px", borderRadius: 8,
              background: a.is_correct ? "rgba(0,210,106,0.05)" : "rgba(255,77,77,0.05)",
              border: `1px solid ${a.is_correct ? "#00D26A" : "#FF4D4D"}20`,
              fontSize: 11, fontFamily: "Inter",
            }}>
              <div style={{ color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>{a.question_text}</div>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ color: a.is_correct ? "#00D26A" : "#FF4D4D" }}>
                  {a.is_correct ? "✅" : "❌"} Answered: <b>{a.selected_option?.toUpperCase()}</b>
                </span>
                {!a.is_correct && (
                  <span style={{ color: "#00D26A" }}>
                    ✓ Correct: <b>{a.correct_option?.toUpperCase()}</b>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {expanded && answers.length === 0 && (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter", marginTop: 6 }}>
          No detailed answers recorded for this attempt.
        </div>
      )}
    </div>
  );
}

// ─── Admin Login ──────────────────────────────────────────────────────────────
function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [blink, setBlink] = useState(true);

  // Cursor blink effect for the "RESTRICTED" banner
  useEffect(() => {
    const id = setInterval(() => setBlink(b => !b), 600);
    return () => clearInterval(id);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) { sessionStorage.setItem(SESSION_KEY, pw); onSuccess(); }
      else { setError("⛔ ACCESS DENIED — Invalid credentials"); setPw(""); }
    } catch { setError("CONNECTION ERROR"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0a0a0a 0%, #0d1a0d 40%, #0a0a0a 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "0 24px", position: "relative", overflow: "hidden",
    }}>
      {/* Background grid pattern */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: "linear-gradient(#FF4444 1px, transparent 1px), linear-gradient(90deg, #FF4444 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Top warning stripe */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: 4, background: `repeating-linear-gradient(90deg, #FF4444 0px, #FF4444 20px, #1a0000 20px, #1a0000 40px)`,
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 4, background: `repeating-linear-gradient(90deg, #FF4444 0px, #FF4444 20px, #1a0000 20px, #1a0000 40px)`,
      }} />

      <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1 }}>
        {/* Shield icon */}
        <div style={{
          width: 80, height: 80, margin: "0 auto 20px",
          background: "linear-gradient(135deg, rgba(255,68,68,0.15), rgba(255,68,68,0.05))",
          border: "2px solid rgba(255,68,68,0.5)",
          borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, boxShadow: "0 0 30px rgba(255,68,68,0.2), inset 0 0 20px rgba(255,68,68,0.05)",
        }}>🛡️</div>

        {/* Warning header */}
        <div style={{
          background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.4)",
          borderRadius: 8, padding: "10px 16px", marginBottom: 24, textAlign: "center",
          boxShadow: "0 0 20px rgba(255,68,68,0.1)",
        }}>
          <div style={{
            fontFamily: "Orbitron, monospace", fontSize: 7, letterSpacing: "0.4em",
            color: "rgba(255,68,68,0.7)", marginBottom: 4,
          }}>⚠ WARNING ⚠</div>
          <div style={{
            fontFamily: "Orbitron, monospace", fontSize: 16, fontWeight: 900,
            color: "#FF4444", letterSpacing: "0.15em",
            textShadow: "0 0 20px rgba(255,68,68,0.6)",
          }}>RESTRICTED ACCESS</div>
          <div style={{
            fontFamily: "Orbitron, monospace", fontSize: 7, letterSpacing: "0.25em",
            color: "rgba(255,68,68,0.5)", marginTop: 4,
          }}>AUTHORIZED PERSONNEL ONLY{blink ? "_" : " "}</div>
        </div>

        <div className="font-orbitron" style={{
          textAlign: "center", fontSize: 22, fontWeight: 700, color: "#ffffff",
          marginBottom: 6, letterSpacing: "0.08em",
        }}>COMMAND CENTER</div>
        <div style={{
          textAlign: "center", fontSize: 10, fontFamily: "Inter", letterSpacing: "0.3em",
          color: "rgba(255,255,255,0.3)", marginBottom: 32,
        }}>TLS ADMIN SYSTEM</div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <div style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              fontSize: 14, opacity: 0.4,
            }}>🔑</div>
            <input
              type="password" value={pw} onChange={e => setPw(e.target.value)}
              placeholder="Enter admin passphrase" autoFocus
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "16px 16px 16px 42px",
                background: "rgba(255,68,68,0.04)",
                border: pw.trim() ? "1px solid rgba(255,68,68,0.5)" : "1px solid rgba(255,68,68,0.15)",
                borderRadius: 10, color: "#ffffff", fontSize: 14, outline: "none",
                fontFamily: "Inter", letterSpacing: "0.05em",
                transition: "border-color 0.2s, box-shadow 0.2s",
                boxShadow: pw.trim() ? "0 0 12px rgba(255,68,68,0.15)" : "none",
              }}
            />
          </div>

          {error && (
            <div style={{
              color: "#FF4444", fontSize: 11, textAlign: "center",
              fontFamily: "Inter", letterSpacing: "0.1em",
              padding: "8px 12px", background: "rgba(255,68,68,0.08)",
              border: "1px solid rgba(255,68,68,0.25)", borderRadius: 8,
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading || !pw.trim()} style={{
            padding: "16px",
            background: pw.trim() && !loading
              ? "linear-gradient(135deg, #cc0000, #FF4444)"
              : "rgba(255,68,68,0.06)",
            border: pw.trim() && !loading ? "none" : "1px solid rgba(255,68,68,0.2)",
            borderRadius: 10,
            cursor: pw.trim() && !loading ? "pointer" : "not-allowed",
            color: pw.trim() && !loading ? "#ffffff" : "rgba(255,255,255,0.2)",
            fontFamily: "Orbitron, monospace", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.2em",
            boxShadow: pw.trim() && !loading ? "0 4px 20px rgba(255,68,68,0.4)" : "none",
            transition: "all 0.2s",
          }}>
            {loading ? "AUTHENTICATING..." : "AUTHENTICATE"}
          </button>
        </form>

        <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
          <BackButton to="/" label="← BACK TO TRAINEE APP" />
        </div>

        <div style={{
          marginTop: 32, fontSize: 9, fontFamily: "Inter", letterSpacing: "0.15em",
          color: "rgba(255,255,255,0.12)", textAlign: "center",
        }}>
          UNAUTHORIZED ACCESS IS A VIOLATION OF SYSTEM POLICY
        </div>
      </div>
    </div>
  );
}

// ─── Trainee Detail Modal ─────────────────────────────────────────────────────
function TraineeDetailModal({
  traineeId, adminPw, onClose,
}: {
  traineeId: string; adminPw: string; onClose: () => void;
}) {
  const [detail, setDetail] = useState<TraineeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // Restore tab + msgText from sessionStorage so they survive iOS app-switch / reload
  const [tab, setTab] = useState<"overview" | "activity" | "quiz" | "notes" | "messages" | "moderation" | "evaluation">(
    () => (sessionStorage.getItem(`tls_admin_tab_${traineeId}`) as "overview" | "activity" | "quiz" | "notes" | "messages" | "moderation" | "evaluation") || "overview"
  );
  const [actionResult, setActionResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [modLog, setModLog] = useState<ModerationEntry[]>([]);
  const [moderating, setModerating] = useState(false);
  const [modReason, setModReason] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Action form state — msgText persisted so typed text survives iOS app switch
  const [msgText, setMsgText] = useState(() => sessionStorage.getItem(`tls_admin_msg_${traineeId}`) ?? "");
  const [alertText, setAlertText] = useState("");
  const [alertType, setAlertType] = useState("info");
  const [noteText, setNoteText] = useState(() => sessionStorage.getItem(`tls_admin_note_${traineeId}`) ?? "");
  const [assignModuleId, setAssignModuleId] = useState("");
  const [assignModuleName, setAssignModuleName] = useState("");
  const [resetModuleId, setResetModuleId] = useState("");
  const [completeModuleId, setCompleteModuleId] = useState("");
  const [completeModuleName, setCompleteModuleName] = useState("");
  const [acting, setActing] = useState(false);

  const headers = { "Content-Type": "application/json", "x-admin-password": adminPw };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/admin/trainee/${traineeId}`, { headers: { "x-admin-password": adminPw } });
      const data = await res.json() as TraineeDetail;
      setDetail(data);
    } catch { /* non-fatal */ }
    if (!silent) setLoading(false);
  }, [traineeId, adminPw]);

  useEffect(() => { load(); }, [load]);

  // Lock body scroll when modal open (prevents Safari bounce behind modal)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Poll every 5s when messages tab is open — silent so typed text is never cleared
  useEffect(() => {
    if (tab !== "messages") return;
    const id = setInterval(() => { load(true); }, 5000);
    return () => clearInterval(id);
  }, [tab, load]);

  // act — sends a POST without clearing inputs or triggering navigation
  // inputClear is called ONLY after a confirmed success
  const act = async (endpoint: string, body: Record<string, unknown>, onSuccess?: () => void) => {
    setActing(true); setActionResult(null);
    try {
      const res = await fetch(`/api/admin/${endpoint}`, { method: "POST", headers, body: JSON.stringify({ traineeId, ...body }) });
      const data = await res.json() as { ok: boolean; error?: string };
      if (data.ok) {
        setActionResult({ ok: true, text: "Sent successfully" });
        onSuccess?.();          // clear input only on success
        // silent background refresh — do NOT await so UI stays responsive
        load(true).catch(() => {});
      } else {
        setActionResult({ ok: false, text: data.error ?? "Failed" });
      }
    } catch { setActionResult({ ok: false, text: "Network error" }); }
    setActing(false);
    // auto-clear banner after 3s
    setTimeout(() => setActionResult(null), 3000);
  };

  const t = detail?.trainee;
  const s = detail?.stats;
  const initials = t ? t.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() : "?";

  const TABS = ["overview", "activity", "quiz", "notes", "messages", "moderation", "evaluation"] as const;

  // Evaluation state
  const [evalRating, setEvalRating] = useState<string>("pending");
  const [evalRecommendation, setEvalRecommendation] = useState<string>("");
  const [evalObservations, setEvalObservations] = useState<string>("");
  const [evalSaving, setEvalSaving] = useState(false);
  const [evalSaved, setEvalSaved] = useState(false);

  // Load evaluation when tab is active
  useEffect(() => {
    if (tab !== "evaluation") return;
    fetch(`/api/admin/evaluation/${traineeId}`, { headers: { "x-admin-password": adminPw } })
      .then(r => r.json())
      .then(d => {
        if (d) {
          setEvalRating(d.rating ?? "pending");
          setEvalRecommendation(d.recommendation ?? "");
          setEvalObservations(d.technical_observations ?? "");
        }
      }).catch(() => {});
  }, [tab, traineeId, adminPw]);

  // Load moderation log when moderation tab is active
  useEffect(() => {
    if (tab !== "moderation") return;
    fetch(`/api/admin/moderation-log/${traineeId}`, { headers: { "x-admin-password": adminPw } })
      .then(r => r.json()).then(d => setModLog(d as ModerationEntry[])).catch(() => {});
  }, [tab, traineeId, adminPw]);

  const moderate = async (action: string) => {
    setModerating(true); setActionResult(null);
    try {
      const res = await fetch(`/api/admin/moderate`, {
        method: "POST", headers,
        body: JSON.stringify({ traineeId, action, reason: modReason.trim() || undefined }),
      });
      const data = await res.json() as { ok: boolean; newStatus?: string; error?: string };
      if (data.ok) {
        setActionResult({ ok: true, text: `${action.toUpperCase()} applied` });
        setModReason("");
        load(true).catch(() => {});
        // Refresh moderation log
        fetch(`/api/admin/moderation-log/${traineeId}`, { headers: { "x-admin-password": adminPw } })
          .then(r => r.json()).then(d => setModLog(d as ModerationEntry[])).catch(() => {});
      } else {
        setActionResult({ ok: false, text: data.error ?? "Failed" });
      }
    } catch { setActionResult({ ok: false, text: "Network error" }); }
    setModerating(false);
    setTimeout(() => setActionResult(null), 3000);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      /* prevent body scroll-bounce on iOS */
      WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
    } as React.CSSProperties} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: "100%", maxWidth: 520,
        /* Use dvh so Safari bottom bar is respected */
        height: "min(92dvh, 92vh)",
        background: "#071426", border: `1px solid ${C.cyan}30`,
        borderRadius: "16px 16px 0 0", overflow: "hidden",
        display: "flex", flexDirection: "column",
        /* safe area for iPhone home bar */
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${C.cyan}20`,
          background: "linear-gradient(180deg, #0a1e38, #071426)",
          display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
        }}>
          {loading ? (
            <div style={{ flex: 1, height: 40, background: "rgba(0,174,239,0.08)", borderRadius: 8 }} />
          ) : t ? (
            <>
              <div style={{
                width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                background: `linear-gradient(135deg, ${t.online ? C.green : C.cyan}30, #071426)`,
                border: `2px solid ${t.online ? C.green : C.cyan}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Inter", fontSize: 16, fontWeight: 700, color: t.online ? C.green : C.cyan,
                boxShadow: t.online ? `0 0 12px ${C.green}40` : `0 0 8px ${C.cyan}20`,
              }}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div className="font-orbitron" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{t.name}</div>
                  {t.status && t.status !== 'active' && (
                    <span style={{
                      fontSize: 8, padding: "2px 6px", borderRadius: 10, fontFamily: "Inter", flexShrink: 0,
                      background: t.status === 'blocked' ? `${C.red}18` : t.status === 'suspended' ? `${C.yellow}18` : `${C.gold}18`,
                      border: `1px solid ${t.status === 'blocked' ? C.red : t.status === 'suspended' ? C.yellow : C.gold}40`,
                      color: t.status === 'blocked' ? C.red : t.status === 'suspended' ? C.yellow : C.gold,
                    }}>
                      {t.status.toUpperCase()}
                    </span>
                  )}
                  <span style={{
                    fontSize: 8, padding: "2px 6px", borderRadius: 10, fontFamily: "Inter", flexShrink: 0,
                    background: t.trainingLevel === 'advanced' ? `${C.gold}18` : "rgba(0,174,239,0.1)",
                    border: `1px solid ${t.trainingLevel === 'advanced' ? C.gold + "50" : C.cyan + "30"}`,
                    color: t.trainingLevel === 'advanced' ? C.gold : C.cyan,
                  }}>
                    {t.trainingLevel === 'advanced' ? '⭐ ADVANCED' : '🔵 BEGINNER'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.cyan, marginTop: 2 }}>
                  {[t.rank, t.unit].filter(Boolean).join(" · ") || "TLS Trainee"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                  <div style={{ fontSize: 10, color: t.online ? C.green : "var(--text-muted)" }}>
                    {t.online ? "● Online now" : `Last active: ${timeAgo(t.last_active_at)}`}
                  </div>
                  {detail?.evaluation?.rating && detail.evaluation.rating !== 'pending' && (
                    <span style={{
                      fontSize: 8, padding: "1px 6px", borderRadius: 8, fontFamily: "Inter",
                      background: detail.evaluation.rating === 'excellent' ? `${C.green}18` :
                                  detail.evaluation.rating === 'good' ? `${C.cyan}18` :
                                  detail.evaluation.rating === 'weak' ? `${C.red}18` : `${C.yellow}18`,
                      border: `1px solid ${detail.evaluation.rating === 'excellent' ? C.green :
                               detail.evaluation.rating === 'good' ? C.cyan :
                               detail.evaluation.rating === 'weak' ? C.red : C.yellow}40`,
                      color: detail.evaluation.rating === 'excellent' ? C.green :
                             detail.evaluation.rating === 'good' ? C.cyan :
                             detail.evaluation.rating === 'weak' ? C.red : C.yellow,
                    }}>
                      {detail.evaluation.rating.toUpperCase().replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={onClose} style={{
                background: "none", border: "none", color: "var(--text-muted)",
                cursor: "pointer", fontSize: 22, padding: "4px 8px", flexShrink: 0,
              }}>✕</button>
            </>
          ) : (
            <div style={{ flex: 1, color: C.red, fontFamily: "Inter", fontSize: 12 }}>Failed to load trainee</div>
          )}
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 0, borderBottom: `1px solid ${C.cyan}15`,
          overflowX: "auto", flexShrink: 0, background: "rgba(0,0,0,0.2)",
        }}>
          {TABS.map(tb => (
            <button key={tb} onClick={() => { setTab(tb); sessionStorage.setItem(`tls_admin_tab_${traineeId}`, tb); }} style={{
              padding: "10px 12px", background: "none", cursor: "pointer",
              border: "none", borderBottom: tab === tb ? `2px solid ${C.cyan}` : "2px solid transparent",
              color: tab === tb ? C.cyan : "var(--text-muted)",
              fontFamily: "Inter", fontSize: 9, letterSpacing: "0.08em",
              whiteSpace: "nowrap", flexShrink: 0, textTransform: "uppercase",
              transition: "color 0.15s",
            }}>{tb}</button>
          ))}
        </div>

        {/* Action result banner */}
        {actionResult && (
          <div style={{
            margin: "8px 16px 0", padding: "8px 12px", borderRadius: 8, flexShrink: 0,
            background: actionResult.ok ? "rgba(0,210,106,0.1)" : "rgba(255,77,77,0.1)",
            border: `1px solid ${actionResult.ok ? "rgba(0,210,106,0.35)" : "rgba(255,77,77,0.35)"}`,
            color: actionResult.ok ? C.green : C.red, fontSize: 12, fontFamily: "Inter",
          }}>
            {actionResult.ok ? "✅ " : "❌ "}{actionResult.text}
          </div>
        )}

        {/* Content — flex column so messages tab can pin compose at bottom */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Scrollable area */}
          <div style={{ flex: 1, overflowY: "auto", padding: tab === "messages" ? "16px 16px 8px" : "16px", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] } as React.CSSProperties}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ height: 60, borderRadius: 10, background: "rgba(0,174,239,0.05)", animation: "pulse-glow 1.5s ease infinite" }} />
              ))}
            </div>
          ) : !detail ? null : (

            // ── OVERVIEW TAB ──
            tab === "overview" ? (
              <div>
                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[
                    { label: "LOGINS", value: String(t!.login_count), color: C.cyan },
                    { label: "QUIZ TRIES", value: String(s!.totalAttempts), color: C.yellow },
                    { label: "BEST SCORE", value: `${Math.round(s!.bestScore)}%`, color: C.green },
                    { label: "AVG SCORE", value: `${s!.avgScore}%`, color: C.blue },
                    { label: "MODULES", value: String(s!.completedModules), color: C.gold },
                    { label: "TRAINING H", value: `${s!.trainingHours ?? 0}h`, color: C.cyan },
                    { label: "PASSED", value: String(s!.passedAttempts ?? 0), color: C.green },
                    { label: "FAILED", value: String(s!.failedAttempts ?? 0), color: C.red },
                    { label: "VIEWS", value: String(s!.manualViews), color: "#35D4FF" },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: `${item.color}08`, border: `1px solid ${item.color}25`,
                      borderRadius: 8, padding: "10px 8px", textAlign: "center",
                    }}>
                      <div className="font-orbitron" style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: 8, color: "var(--text-muted)", fontFamily: "Inter", marginTop: 2, letterSpacing: "0.06em" }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Timeline info */}
                <div className="glass-card" style={{ padding: "12px 14px", marginBottom: 16, border: `1px solid ${C.cyan}15` }}>
                  {[
                    { label: "Registered", value: fmtDate(t!.created_at) },
                    { label: "Last Login", value: fmtDate(t!.last_login_at) },
                    { label: "Last Active", value: fmtDate(t!.last_active_at) },
                    { label: "Last Page", value: t!.last_page ?? "—" },
                  ].map(row => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "Inter" }}>{row.label}</span>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "Inter" }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* ACTIONS */}
                <div className="font-orbitron" style={{ fontSize: 9, color: C.cyan, letterSpacing: "0.15em", marginBottom: 10 }}>ADMIN ACTIONS</div>

                {/* Send Message */}
                <div className="glass-card" style={{ padding: "12px 14px", marginBottom: 10, border: `1px solid ${C.blue}20` }}>
                  <div className="font-orbitron" style={{ fontSize: 9, color: C.blue, letterSpacing: "0.1em", marginBottom: 8 }}>💬 SEND MESSAGE</div>
                  <textarea
                    value={msgText} onChange={e => { setMsgText(e.target.value); sessionStorage.setItem(`tls_admin_msg_${traineeId}`, e.target.value); }}
                    placeholder="Write a message to this trainee..."
                    rows={2}
                    style={{
                      width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.3)",
                      border: `1px solid ${C.blue}30`, borderRadius: 8,
                      color: "#fff", fontSize: 12, padding: "8px 10px", resize: "none", outline: "none",
                    }}
                  />
                  <button
                    disabled={acting || !msgText.trim()}
                    onClick={() => { const txt = msgText; act("message", { text: txt }, () => { setMsgText(""); sessionStorage.removeItem(`tls_admin_msg_${traineeId}`); }); }}
                    style={{
                      marginTop: 8, padding: "8px 16px",
                      background: msgText.trim() ? `${C.blue}20` : "transparent",
                      border: `1px solid ${C.blue}35`, borderRadius: 8, cursor: msgText.trim() ? "pointer" : "default",
                      color: msgText.trim() ? C.blue : "var(--text-muted)",
                      fontFamily: "Inter", fontSize: 10, letterSpacing: "0.08em",
                    }}
                  >{acting ? "SENDING..." : "SEND"}</button>
                </div>

                {/* Send Alert */}
                <div className="glass-card" style={{ padding: "12px 14px", marginBottom: 10, border: `1px solid ${C.yellow}20` }}>
                  <div className="font-orbitron" style={{ fontSize: 9, color: C.yellow, letterSpacing: "0.1em", marginBottom: 8 }}>⚠️ SEND ALERT</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    {(["info", "warning", "danger", "sound"] as const).map(at => (
                      <button key={at} onClick={() => setAlertType(at)} style={{
                        padding: "4px 10px", borderRadius: 12, fontSize: 9, fontFamily: "Inter", cursor: "pointer",
                        background: alertType === at ? `${C.yellow}20` : "transparent",
                        border: `1px solid ${alertType === at ? C.yellow : "rgba(255,255,255,0.1)"}`,
                        color: alertType === at ? C.yellow : "var(--text-muted)",
                      }}>{at.toUpperCase()}</button>
                    ))}
                  </div>
                  <textarea
                    value={alertText} onChange={e => setAlertText(e.target.value)}
                    placeholder="Alert message..."
                    rows={2}
                    style={{
                      width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.3)",
                      border: `1px solid ${C.yellow}30`, borderRadius: 8,
                      color: "#fff", fontSize: 12, padding: "8px 10px", resize: "none", outline: "none",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      disabled={acting || !alertText.trim()}
                      onClick={() => { const txt = alertText; act("alert", { message: txt, alertType }, () => setAlertText("")); }}
                      style={{
                        padding: "8px 16px",
                        background: alertText.trim() ? `${C.yellow}15` : "transparent",
                        border: `1px solid ${C.yellow}35`, borderRadius: 8, cursor: alertText.trim() ? "pointer" : "default",
                        color: alertText.trim() ? C.yellow : "var(--text-muted)",
                        fontFamily: "Inter", fontSize: 10, letterSpacing: "0.08em",
                      }}
                    >{acting ? "SENDING..." : "SEND ALERT"}</button>
                    <button
                      disabled={acting}
                      onClick={() => act("alert", { message: "🔔 Attention! Please check your training dashboard.", alertType: "sound" })}
                      style={{
                        padding: "8px 14px", background: "rgba(255,77,77,0.1)",
                        border: `1px solid ${C.red}35`, borderRadius: 8, cursor: "pointer",
                        color: C.red, fontFamily: "Inter", fontSize: 10, letterSpacing: "0.08em",
                      }}
                    >🔔 SOUND</button>
                  </div>
                </div>

                {/* Add Note */}
                <div className="glass-card" style={{ padding: "12px 14px", marginBottom: 10, border: `1px solid ${C.gold}20` }}>
                  <div className="font-orbitron" style={{ fontSize: 9, color: C.gold, letterSpacing: "0.1em", marginBottom: 8 }}>📝 INSTRUCTOR NOTE</div>
                  <textarea
                    value={noteText} onChange={e => { setNoteText(e.target.value); sessionStorage.setItem(`tls_admin_note_${traineeId}`, e.target.value); }}
                    placeholder="Private note (only visible to admins)..."
                    rows={2}
                    style={{
                      width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.3)",
                      border: `1px solid ${C.gold}30`, borderRadius: 8,
                      color: "#fff", fontSize: 12, padding: "8px 10px", resize: "none", outline: "none",
                    }}
                  />
                  <button
                    disabled={acting || !noteText.trim()}
                    onClick={() => { const txt = noteText; act("note", { note: txt }, () => { setNoteText(""); sessionStorage.removeItem(`tls_admin_note_${traineeId}`); }); }}
                    style={{
                      marginTop: 8, padding: "8px 16px",
                      background: noteText.trim() ? `${C.gold}15` : "transparent",
                      border: `1px solid ${C.gold}35`, borderRadius: 8, cursor: noteText.trim() ? "pointer" : "default",
                      color: noteText.trim() ? C.gold : "var(--text-muted)",
                      fontFamily: "Inter", fontSize: 10, letterSpacing: "0.08em",
                    }}
                  >{acting ? "SAVING..." : "SAVE NOTE"}</button>
                </div>

                {/* Assign Module */}
                <div className="glass-card" style={{ padding: "12px 14px", marginBottom: 10, border: `1px solid ${C.cyan}20` }}>
                  <div className="font-orbitron" style={{ fontSize: 9, color: C.cyan, letterSpacing: "0.1em", marginBottom: 8 }}>📡 ASSIGN MODULE</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="number" min="1" max="9" value={assignModuleId}
                      onChange={e => setAssignModuleId(e.target.value)}
                      placeholder="Module #"
                      style={{
                        width: 80, padding: "8px 10px", background: "rgba(0,0,0,0.3)",
                        border: `1px solid ${C.cyan}30`, borderRadius: 8,
                        color: "#fff", fontSize: 12, outline: "none",
                      }}
                    />
                    <input
                      type="text" value={assignModuleName}
                      onChange={e => setAssignModuleName(e.target.value)}
                      placeholder="Module name (optional)"
                      style={{
                        flex: 1, padding: "8px 10px", background: "rgba(0,0,0,0.3)",
                        border: `1px solid ${C.cyan}30`, borderRadius: 8,
                        color: "#fff", fontSize: 12, outline: "none",
                      }}
                    />
                  </div>
                  <button
                    disabled={acting || !assignModuleId}
                    onClick={() => { const mid = assignModuleId; const mn = assignModuleName; act("assign-module", { moduleId: parseInt(mid), moduleName: mn }, () => { setAssignModuleId(""); setAssignModuleName(""); }); }}
                    style={{
                      marginTop: 8, padding: "8px 16px",
                      background: assignModuleId ? `${C.cyan}12` : "transparent",
                      border: `1px solid ${C.cyan}35`, borderRadius: 8, cursor: assignModuleId ? "pointer" : "default",
                      color: assignModuleId ? C.cyan : "var(--text-muted)",
                      fontFamily: "Inter", fontSize: 10, letterSpacing: "0.08em",
                    }}
                  >{acting ? "ASSIGNING..." : "ASSIGN"}</button>
                </div>

                {/* Reset Quiz / Complete Module */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  {/* Reset Quiz */}
                  <div className="glass-card" style={{ padding: "12px 14px", border: `1px solid ${C.red}20` }}>
                    <div className="font-orbitron" style={{ fontSize: 9, color: C.red, letterSpacing: "0.1em", marginBottom: 8 }}>🔄 RESET QUIZ</div>
                    <input
                      type="number" min="1" max="9" value={resetModuleId}
                      onChange={e => setResetModuleId(e.target.value)}
                      placeholder="Module #"
                      style={{
                        width: "100%", boxSizing: "border-box", padding: "8px 10px",
                        background: "rgba(0,0,0,0.3)", border: `1px solid ${C.red}30`,
                        borderRadius: 8, color: "#fff", fontSize: 12, outline: "none",
                      }}
                    />
                    <button
                      disabled={acting || !resetModuleId}
                      onClick={() => { const mid = resetModuleId; act("reset-quiz", { moduleId: parseInt(mid) }, () => setResetModuleId("")); }}
                      style={{
                        marginTop: 8, width: "100%", padding: "8px",
                        background: resetModuleId ? `${C.red}12` : "transparent",
                        border: `1px solid ${C.red}35`, borderRadius: 8, cursor: resetModuleId ? "pointer" : "default",
                        color: resetModuleId ? C.red : "var(--text-muted)",
                        fontFamily: "Inter", fontSize: 10,
                      }}
                    >{acting ? "..." : "RESET"}</button>
                  </div>

                  {/* Complete Module */}
                  <div className="glass-card" style={{ padding: "12px 14px", border: `1px solid ${C.green}20` }}>
                    <div className="font-orbitron" style={{ fontSize: 9, color: C.green, letterSpacing: "0.1em", marginBottom: 8 }}>✅ COMPLETE MOD</div>
                    <input
                      type="number" min="1" max="9" value={completeModuleId}
                      onChange={e => setCompleteModuleId(e.target.value)}
                      placeholder="Module #"
                      style={{
                        width: "100%", boxSizing: "border-box", padding: "8px 10px",
                        background: "rgba(0,0,0,0.3)", border: `1px solid ${C.green}30`,
                        borderRadius: 8, color: "#fff", fontSize: 12, outline: "none",
                      }}
                    />
                    <input
                      type="text" value={completeModuleName}
                      onChange={e => setCompleteModuleName(e.target.value)}
                      placeholder="Name (optional)"
                      style={{
                        width: "100%", boxSizing: "border-box", marginTop: 6, padding: "8px 10px",
                        background: "rgba(0,0,0,0.3)", border: `1px solid ${C.green}30`,
                        borderRadius: 8, color: "#fff", fontSize: 12, outline: "none",
                      }}
                    />
                    <button
                      disabled={acting || !completeModuleId}
                      onClick={() => { const mid = completeModuleId; const mn = completeModuleName; act("complete-module", { moduleId: parseInt(mid), moduleName: mn }, () => { setCompleteModuleId(""); setCompleteModuleName(""); }); }}
                      style={{
                        marginTop: 8, width: "100%", padding: "8px",
                        background: completeModuleId ? `${C.green}12` : "transparent",
                        border: `1px solid ${C.green}35`, borderRadius: 8, cursor: completeModuleId ? "pointer" : "default",
                        color: completeModuleId ? C.green : "var(--text-muted)",
                        fontFamily: "Inter", fontSize: 10,
                      }}
                    >{acting ? "..." : "COMPLETE"}</button>
                  </div>
                </div>

                {/* TRAINING LEVEL */}
                <div className="font-orbitron" style={{ fontSize: 9, color: C.cyan, letterSpacing: "0.15em", marginBottom: 10, marginTop: 16 }}>TRAINING LEVEL</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {(['beginner', 'advanced'] as const).map(lvl => (
                    <button
                      key={lvl}
                      onClick={async () => {
                        await fetch(`/api/admin/trainee/${traineeId}/training-level`, {
                          method: 'POST',
                          headers: { 'x-admin-password': adminPw, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ level: lvl }),
                        });
                        // Refresh detail
                        const r = await fetch(`/api/admin/trainee/${traineeId}`, { headers: { 'x-admin-password': adminPw } });
                        if (r.ok) setDetail(await r.json() as TraineeDetail);
                      }}
                      style={{
                        flex: 1, padding: "10px 8px", borderRadius: 8, cursor: "pointer",
                        fontFamily: "Inter", fontSize: 11, letterSpacing: "0.05em",
                        background: lvl === 'advanced' ? `${C.gold}15` : "rgba(0,174,239,0.1)",
                        border: `1px solid ${lvl === 'advanced' ? C.gold + "50" : C.cyan + "40"}`,
                        color: lvl === 'advanced' ? C.gold : C.cyan,
                      }}
                    >
                      {lvl === 'advanced' ? '⭐ Set Advanced' : '🔵 Set Beginner'}
                    </button>
                  ))}
                </div>

                {/* EXPORT REPORT */}
                <div className="font-orbitron" style={{ fontSize: 9, color: C.gold, letterSpacing: "0.15em", marginBottom: 10, marginTop: 16 }}>TRAINEE REPORT</div>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/admin/report/${traineeId}`, { headers: { "x-admin-password": adminPw } });
                      if (!res.ok) return;
                      const rpt = await res.json() as {
                        trainee: { name: string; rank: string | null; unit: string | null; login_count: number };
                        stats: { totalAttempts: number; passedAttempts: number; failedAttempts: number; avgScore: number; bestScore: number; completedModules: number; totalModuleCount: number; trainingHours: number };
                        quizAttempts: Array<{ module_name: string | null; pct: number; passed: number; ts: number }>;
                        moduleProgress: Array<{ module_name: string | null; progress: number; completed: number; last_accessed_at: number }>;
                        evaluation: { rating: string; recommendation: string; technical_observations: string; updated_at: number } | null;
                        timeLogs: Array<{ module_name: string; total_ms: number }>;
                        manualLogs: Array<{ manual_name: string; view_count: number; total_ms: number }>;
                        notes: Array<{ note: string; ts: number }>;
                        generatedAt: number;
                      };
                      const ratingLabel = (r: string) => ({ excellent: '⭐⭐⭐ Excellent', good: '⭐⭐ Good', weak: '⚠️ Weak', needs_review: '🔍 Needs Review', pending: '⏳ Pending' }[r] ?? r);
                      const fmtMs = (ms: number) => { const h = Math.floor(ms/3600000); const m = Math.floor((ms%3600000)/60000); return h > 0 ? `${h}h ${m}m` : `${m}m`; };
                      const fmtDt = (ms: number) => ms ? new Date(ms).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '—';

                      // Fetch per-question answers for strength/weakness analysis
                      let answersData: Array<{ question_text: string; is_correct: number; module_id: number }> = [];
                      try {
                        const answersRes = await fetch(`/api/admin/quiz-answers/${traineeId}`, { headers: { 'x-admin-password': adminPw } });
                        if (answersRes.ok) answersData = await answersRes.json();
                      } catch {}

                      // Group by question — find most missed
                      const qMap = new Map<string, { text: string; total: number; wrong: number }>();
                      for (const a of answersData) {
                        const key = String(a.question_text);
                        const existing = qMap.get(key) ?? { text: a.question_text, total: 0, wrong: 0 };
                        existing.total++;
                        if (!a.is_correct) existing.wrong++;
                        qMap.set(key, existing);
                      }
                      const missedQuestions = Array.from(qMap.values()).filter(q => q.total > 0).sort((a, b) => (b.wrong/b.total) - (a.wrong/a.total)).slice(0, 10);
                      const strongQuestions = Array.from(qMap.values()).filter(q => q.total > 0 && q.wrong === 0).slice(0, 5);

                      const weaknessSection = missedQuestions.filter(q => q.wrong > 0).length > 0
                        ? `<h2>⚠️ AREAS NEEDING IMPROVEMENT</h2><table><tr><th>#</th><th>Question</th><th>Wrong</th><th>Attempts</th><th>Miss Rate</th></tr>${missedQuestions.filter(q => q.wrong > 0).map((q, i) => `<tr><td>${i+1}</td><td>${q.text}</td><td style="color:#cc2200;font-weight:600">${q.wrong}</td><td>${q.total}</td><td style="color:#cc2200;font-weight:600">${Math.round(q.wrong/q.total*100)}%</td></tr>`).join('')}</table>`
                        : '';

                      const strengthSection = strongQuestions.length > 0
                        ? `<h2>✅ STRONG AREAS</h2><table><tr><th>#</th><th>Question</th><th>Attempts</th></tr>${strongQuestions.map((q, i) => `<tr><td>${i+1}</td><td>${q.text}</td><td style="color:#00a550;font-weight:600">${q.total}</td></tr>`).join('')}</table>`
                        : '';

                      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Trainee Report - ${rpt.trainee.name}</title>
<style>
  body { font-family: Arial, sans-serif; background: #fff; color: #222; max-width: 900px; margin: 0 auto; padding: 32px; }
  h1 { color: #004080; font-size: 24px; margin-bottom: 4px; }
  h2 { color: #004080; font-size: 14px; border-bottom: 2px solid #004080; padding-bottom: 4px; margin-top: 28px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .stat { background: #f0f6ff; border: 1px solid #c0d4f0; border-radius: 8px; padding: 12px; text-align: center; }
  .stat .val { font-size: 22px; font-weight: 700; color: #004080; }
  .stat .lbl { font-size: 10px; color: #666; margin-top: 4px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
  th { background: #004080; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
  td { padding: 7px 10px; border-bottom: 1px solid #e0e8f0; }
  tr:nth-child(even) td { background: #f8fbff; }
  .pass { color: #00a550; font-weight: 600; }
  .fail { color: #cc2200; font-weight: 600; }
  .eval-box { background: #fffbf0; border: 2px solid #e0c060; border-radius: 8px; padding: 16px; margin-top: 10px; }
  .eval-rating { font-size: 20px; font-weight: 700; color: #884400; margin-bottom: 8px; }
  .obs { background: #f8f8f8; border-left: 3px solid #004080; padding: 8px 12px; margin-top: 8px; font-size: 12px; color: #444; white-space: pre-wrap; }
  .footer { margin-top: 40px; font-size: 11px; color: #aaa; text-align: center; border-top: 1px solid #e0e8f0; padding-top: 16px; }
  @media print { body { padding: 16px; } button { display: none !important; } }
</style></head><body>
<button onclick="window.print()" style="float:right;padding:8px 18px;background:#004080;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">🖨️ Print / Save PDF</button>
<h1>TRAINEE PERFORMANCE REPORT</h1>
<div class="meta">
  <strong>${rpt.trainee.name}</strong> &nbsp;|&nbsp; ${rpt.trainee.rank ?? ''} ${rpt.trainee.unit ?? ''}<br>
  Generated: ${fmtDt(rpt.generatedAt)} &nbsp;|&nbsp; Total Logins: ${rpt.trainee.login_count}
</div>
<h2>PERFORMANCE SUMMARY</h2>
<div class="grid">
  <div class="stat"><div class="val">${rpt.stats.trainingHours}h</div><div class="lbl">Training Time</div></div>
  <div class="stat"><div class="val">${rpt.stats.completedModules}/${rpt.stats.totalModuleCount}</div><div class="lbl">Modules Done</div></div>
  <div class="stat"><div class="val">${rpt.stats.avgScore}%</div><div class="lbl">Avg Quiz Score</div></div>
  <div class="stat"><div class="val">${rpt.stats.passedAttempts}/${rpt.stats.totalAttempts}</div><div class="lbl">Quizzes Passed</div></div>
</div>
${rpt.evaluation ? `
<h2>INSTRUCTOR EVALUATION</h2>
<div class="eval-box">
  <div class="eval-rating">${ratingLabel(rpt.evaluation.rating)}</div>
  ${rpt.evaluation.recommendation ? `<div><strong>Recommendation:</strong><div class="obs">${rpt.evaluation.recommendation}</div></div>` : ''}
  ${rpt.evaluation.technical_observations ? `<div style="margin-top:8px"><strong>Technical Observations:</strong><div class="obs">${rpt.evaluation.technical_observations}</div></div>` : ''}
  <div style="font-size:11px;color:#999;margin-top:8px">Last updated: ${fmtDt(rpt.evaluation.updated_at)}</div>
</div>` : ''}
<h2>MODULE PROGRESS</h2>
<table><tr><th>Module</th><th>Progress</th><th>Completed</th><th>Last Accessed</th></tr>
${rpt.moduleProgress.map(m => `<tr><td>${m.module_name ?? '—'}</td><td>${m.progress}%</td><td>${m.completed ? '<span class="pass">✓ Yes</span>' : 'No'}</td><td>${fmtDt(m.last_accessed_at)}</td></tr>`).join('')}
</table>
${rpt.timeLogs.length > 0 ? `
<h2>TIME SPENT PER MODULE</h2>
<table><tr><th>Module</th><th>Total Time</th></tr>
${rpt.timeLogs.map(tl => `<tr><td>${tl.module_name}</td><td>${fmtMs(tl.total_ms)}</td></tr>`).join('')}
</table>` : ''}
${rpt.manualLogs.length > 0 ? `
<h2>MANUALS VIEWED</h2>
<table><tr><th>Manual</th><th>Views</th><th>Total Read Time</th></tr>
${rpt.manualLogs.map(ml => `<tr><td>${ml.manual_name}</td><td>${ml.view_count}</td><td>${fmtMs(ml.total_ms)}</td></tr>`).join('')}
</table>` : ''}
${rpt.quizAttempts.length > 0 ? `
<h2>QUIZ ATTEMPTS</h2>
<table><tr><th>Module</th><th>Score</th><th>Result</th><th>Date</th></tr>
${rpt.quizAttempts.map(a => `<tr><td>${a.module_name ?? '—'}</td><td>${a.pct}%</td><td>${a.passed ? '<span class="pass">PASS</span>' : '<span class="fail">FAIL</span>'}</td><td>${fmtDt(a.ts)}</td></tr>`).join('')}
</table>` : ''}
${rpt.notes.length > 0 ? `
<h2>INSTRUCTOR NOTES</h2>
${rpt.notes.map(n => `<div class="obs" style="margin-bottom:8px"><strong>${fmtDt(n.ts)}:</strong> ${n.note}</div>`).join('')}` : ''}
${weaknessSection}${strengthSection}
<div class="footer">TLS Trainer System — Confidential Training Report</div>
</body></html>`;
                      const w = window.open('', '_blank');
                      if (w) { w.document.write(html); w.document.close(); }
                    } catch { /* non-fatal */ }
                  }}
                  style={{
                    width: "100%", padding: "12px 16px",
                    background: `${C.gold}15`, border: `1px solid ${C.gold}50`,
                    borderRadius: 10, cursor: "pointer",
                    color: C.gold, fontFamily: "Inter", fontSize: 11,
                    letterSpacing: "0.1em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                  </svg>
                  EXPORT REPORT (PRINT / PDF)
                </button>
              </div>
            )

            // ── ACTIVITY TAB ──
            : tab === "activity" ? (
              <div>
                {detail.activityLog.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0", fontSize: 12 }}>No activity yet</div>
                ) : detail.activityLog.map(log => (
                  <div key={log.id} style={{
                    padding: "10px 12px", marginBottom: 6,
                    background: "rgba(0,174,239,0.04)", border: "1px solid rgba(0,174,239,0.1)",
                    borderRadius: 8, display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: log.event === "login" ? C.green : log.event === "logout" ? C.red : C.cyan,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "Inter" }}>{log.event.replace(/_/g, " ").toUpperCase()}</div>
                      {log.detail && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1, fontFamily: "Inter" }}>{log.detail}</div>}
                      {log.page && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>📍 {log.page}</div>}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", flexShrink: 0, fontFamily: "Inter" }}>{timeAgo(log.ts)}</div>
                  </div>
                ))}
              </div>
            )

            // ── QUIZ TAB ──
            : tab === "quiz" ? (
              <div>
                {detail.quizAttempts.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0", fontSize: 12 }}>No quiz attempts yet</div>
                ) : detail.quizAttempts.map(a => (
                  <div key={a.id} style={{
                    padding: "12px 14px", marginBottom: 8,
                    background: a.passed ? "rgba(0,210,106,0.05)" : "rgba(255,77,77,0.05)",
                    border: `1px solid ${a.passed ? C.green : C.red}25`,
                    borderRadius: 10,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "Inter" }}>
                        Module {a.module_id} {a.module_name ? `— ${a.module_name}` : ""}
                      </div>
                      <span style={{
                        fontSize: 9, padding: "2px 8px", fontFamily: "Inter",
                        background: a.passed ? "rgba(0,210,106,0.15)" : "rgba(255,77,77,0.15)",
                        border: `1px solid ${a.passed ? C.green : C.red}40`,
                        color: a.passed ? C.green : C.red, borderRadius: 10,
                      }}>{a.passed ? "PASSED" : "FAILED"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-muted)", fontFamily: "Inter" }}>
                      <span>Score: <b style={{ color: "var(--text-secondary)" }}>{Math.round(a.pct)}%</b></span>
                      <span>✅ {a.correct}  ❌ {a.wrong}</span>
                      <span>{timeAgo(a.ts)}</span>
                    </div>
                    {/* Per-question breakdown button */}
                    <QuizAnswerBreakdown attemptId={a.id} traineeId={detail.trainee.id} adminPw={adminPw} />
                  </div>
                ))}
              </div>
            )

            // ── NOTES TAB ──
            : tab === "notes" ? (
              <div>
                {/* Quick add */}
                <div className="glass-card" style={{ padding: "12px 14px", marginBottom: 12, border: `1px solid ${C.gold}20` }}>
                  <textarea
                    value={noteText} onChange={e => { setNoteText(e.target.value); sessionStorage.setItem(`tls_admin_note_${traineeId}`, e.target.value); }}
                    placeholder="Add instructor note..."
                    rows={2}
                    style={{
                      width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.3)",
                      border: `1px solid ${C.gold}25`, borderRadius: 8,
                      color: "#fff", fontSize: 12, padding: "8px 10px", resize: "none", outline: "none",
                    }}
                  />
                  <button
                    disabled={acting || !noteText.trim()}
                    onClick={() => { const txt = noteText; act("note", { note: txt }, () => { setNoteText(""); sessionStorage.removeItem(`tls_admin_note_${traineeId}`); }); }}
                    style={{
                      marginTop: 6, padding: "7px 14px",
                      background: noteText.trim() ? `${C.gold}15` : "transparent",
                      border: `1px solid ${C.gold}35`, borderRadius: 8, cursor: noteText.trim() ? "pointer" : "default",
                      color: noteText.trim() ? C.gold : "var(--text-muted)",
                      fontFamily: "Inter", fontSize: 10,
                    }}
                  >{acting ? "SAVING..." : "ADD NOTE"}</button>
                </div>
                {detail.instructorNotes.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px 0", fontSize: 12 }}>No notes yet</div>
                ) : detail.instructorNotes.map(n => (
                  <div key={n.id} style={{
                    padding: "12px 14px", marginBottom: 8,
                    background: `${C.gold}06`, border: `1px solid ${C.gold}20`,
                    borderRadius: 10,
                  }}>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "Inter", lineHeight: 1.5 }}>{n.note}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, fontFamily: "Inter" }}>
                      by {n.author_id} · {fmtDate(n.ts)}
                    </div>
                  </div>
                ))}
              </div>
            )

            // ── MESSAGES TAB ──
            : tab === "messages" ? (
              <div>
                {/* Chat thread — fills scroll area */}
                <div style={{
                  display: "flex", flexDirection: "column", gap: 6, padding: "4px 0",
                }}>
                  {(() => {
                    const allItems: Array<{ id: number; kind: "msg" | "alert"; sender_role?: string; text?: string; message?: string; alert_type?: string; read: number; ts: number }> = [
                      ...detail.messages.map(m => ({ ...m, kind: "msg" as const })),
                      ...detail.alerts.map(a => ({ ...a, kind: "alert" as const, text: a.message })),
                    ].sort((a, b) => (a.ts as number) - (b.ts as number));

                    if (allItems.length === 0) return (
                      <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "30px 0", fontSize: 12 }}>
                        No messages yet. Start a conversation below.
                      </div>
                    );

                    return allItems.map(item => {
                      const isAdmin = item.kind === "msg" ? item.sender_role === "admin" : false;
                      const isAlert = item.kind === "alert";
                      return (
                        <div key={`${item.kind}-${item.id}`} style={{
                          display: "flex", flexDirection: "column",
                          alignItems: isAlert ? "flex-start" : isAdmin ? "flex-end" : "flex-start",
                        }}>
                          <div style={{
                            maxWidth: "80%", padding: "8px 12px",
                            borderRadius: isAdmin ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                            background: isAlert ? `${C.yellow}10` : isAdmin ? `${C.blue}20` : "rgba(255,255,255,0.07)",
                            border: `1px solid ${isAlert ? C.yellow + "30" : isAdmin ? C.blue + "35" : "rgba(255,255,255,0.12)"}`,
                          }}>
                            {isAlert && (
                              <div style={{ fontSize: 10, color: C.yellow, fontFamily: "Inter", letterSpacing: "0.08em", marginBottom: 3 }}>
                                {(item.alert_type ?? "info").toUpperCase()} ALERT
                              </div>
                            )}
                            <div style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "Inter", lineHeight: 1.4 }}>
                              {item.text}
                            </div>
                            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 4, fontFamily: "Inter", textAlign: isAdmin ? "right" : "left" }}>
                              {isAlert ? "SYSTEM" : isAdmin ? "Admin" : (t?.name ?? "Trainee")} · {fmtDate(item.ts)}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )

            // ── MODERATION TAB ──
            : tab === "moderation" ? (
              <div>
                {/* Current status badge */}
                <div className="glass-card" style={{ padding: "14px", marginBottom: 14, border: `1px solid ${C.red}20`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div className="font-orbitron" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.15em", marginBottom: 4 }}>CURRENT STATUS</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "Inter", color:
                      t?.status === 'blocked' ? C.red :
                      t?.status === 'suspended' ? C.yellow :
                      t?.status === 'muted' ? C.gold :
                      C.green
                    }}>
                      {t?.status === 'blocked' ? '🚫 BLOCKED' :
                       t?.status === 'suspended' ? '⏸️ SUSPENDED' :
                       t?.status === 'muted' ? '🔇 MUTED' :
                       '✅ ACTIVE'}
                    </div>
                  </div>
                </div>

                {/* Reason input */}
                <div className="glass-card" style={{ padding: "12px 14px", marginBottom: 12, border: `1px solid ${C.cyan}15` }}>
                  <div className="font-orbitron" style={{ fontSize: 9, color: C.cyan, letterSpacing: "0.1em", marginBottom: 8 }}>REASON (optional)</div>
                  <input
                    value={modReason}
                    onChange={e => setModReason(e.target.value)}
                    placeholder="Reason for action..."
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "rgba(0,0,0,0.3)", border: `1px solid ${C.cyan}25`, borderRadius: 8,
                      color: "#fff", fontSize: 12, padding: "8px 10px", outline: "none",
                    }}
                  />
                </div>

                {/* Action buttons */}
                <div className="font-orbitron" style={{ fontSize: 9, color: C.red, letterSpacing: "0.15em", marginBottom: 8 }}>RESTRICT</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[
                    { action: "block",   label: "BLOCK",   color: C.red,    disabled: t?.status === 'blocked',   icon: "🚫" },
                    { action: "suspend", label: "SUSPEND", color: C.yellow, disabled: t?.status === 'suspended', icon: "⏸️" },
                    { action: "mute",    label: "MUTE",    color: C.gold,   disabled: t?.status === 'muted',     icon: "🔇" },
                  ].map(({ action, label, color, disabled, icon }) => (
                    <button key={action} disabled={moderating || disabled}
                      onClick={() => moderate(action)}
                      style={{
                        padding: "10px 6px", borderRadius: 8,
                        background: disabled ? "rgba(255,255,255,0.04)" : `${color}15`,
                        border: `1px solid ${disabled ? "rgba(255,255,255,0.08)" : color + "40"}`,
                        color: disabled ? "var(--text-muted)" : color,
                        fontFamily: "Inter", fontSize: 9, letterSpacing: "0.08em",
                        cursor: disabled || moderating ? "not-allowed" : "pointer",
                      }}
                    >{icon} {moderating ? "..." : label}</button>
                  ))}
                </div>

                <div className="font-orbitron" style={{ fontSize: 9, color: C.green, letterSpacing: "0.15em", marginBottom: 8 }}>RESTORE</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
                  {[
                    { action: "unblock", label: "UNBLOCK", color: C.green, disabled: t?.status !== 'blocked',   icon: "✅" },
                    { action: "restore", label: "RESTORE", color: C.cyan,  disabled: t?.status !== 'suspended', icon: "▶️" },
                    { action: "unmute",  label: "UNMUTE",  color: C.blue,  disabled: t?.status !== 'muted',     icon: "🔊" },
                  ].map(({ action, label, color, disabled, icon }) => (
                    <button key={action} disabled={moderating || disabled}
                      onClick={() => moderate(action)}
                      style={{
                        padding: "10px 6px", borderRadius: 8,
                        background: disabled ? "rgba(255,255,255,0.04)" : `${color}15`,
                        border: `1px solid ${disabled ? "rgba(255,255,255,0.08)" : color + "40"}`,
                        color: disabled ? "var(--text-muted)" : color,
                        fontFamily: "Inter", fontSize: 9, letterSpacing: "0.08em",
                        cursor: disabled || moderating ? "not-allowed" : "pointer",
                      }}
                    >{icon} {moderating ? "..." : label}</button>
                  ))}
                </div>

                {/* Danger Zone — Delete Account */}
                <div style={{ marginBottom: 20, padding: "14px", borderRadius: 10, background: "rgba(255,40,40,0.04)", border: `1px solid ${C.red}25` }}>
                  <div className="font-orbitron" style={{ fontSize: 9, color: C.red, letterSpacing: "0.15em", marginBottom: 8 }}>⚠ DANGER ZONE</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "Inter", marginBottom: 10 }}>
                    Permanently delete this trainee and all their data. This cannot be undone.
                  </div>
                  {!showDeleteConfirm ? (
                    <button
                      disabled={moderating}
                      onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmText(""); }}
                      style={{
                        width: "100%", padding: "10px", borderRadius: 8,
                        background: `${C.red}15`, border: `1px solid ${C.red}50`,
                        color: C.red, fontFamily: "Inter", fontSize: 10,
                        letterSpacing: "0.1em", cursor: "pointer",
                      }}
                    >🗑 DELETE ACCOUNT</button>
                  ) : (
                    <div style={{ background: "rgba(255,40,40,0.07)", border: `1px solid ${C.red}40`, borderRadius: 10, padding: "14px" }}>
                      {/* Warning banner */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14, padding: "10px 12px", background: `${C.red}12`, borderRadius: 8, border: `1px solid ${C.red}30` }}>
                        <span style={{ fontSize: 20, lineHeight: 1.2 }}>⚠️</span>
                        <div>
                          <div className="font-orbitron" style={{ fontSize: 10, color: C.red, marginBottom: 4 }}>PERMANENT DELETE WARNING</div>
                          <div style={{ fontSize: 11, fontFamily: "Inter", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                            You are about to permanently delete <strong style={{ color: "#fff" }}>{t?.name}</strong>.<br />
                            The following will be <strong style={{ color: C.red }}>permanently removed</strong>:
                          </div>
                          <ul style={{ fontSize: 11, fontFamily: "Inter", color: "var(--text-muted)", margin: "6px 0 0 0", paddingLeft: 16, lineHeight: 1.8 }}>
                            <li>Account &amp; login credentials</li>
                            <li>All quiz attempts &amp; scores</li>
                            <li>Module progress &amp; completions</li>
                            <li>Activity &amp; session history</li>
                            <li>Moderation log</li>
                            <li>Chat messages</li>
                          </ul>
                        </div>
                      </div>
                      {/* Type DELETE confirmation */}
                      <div className="font-orbitron" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 6 }}>
                        TYPE <span style={{ color: C.red }}>DELETE</span> TO CONFIRM
                      </div>
                      <input
                        autoFocus
                        value={deleteConfirmText}
                        onChange={e => setDeleteConfirmText(e.target.value)}
                        placeholder="Type DELETE here..."
                        style={{
                          width: "100%", boxSizing: "border-box",
                          background: "rgba(0,0,0,0.4)", border: `1px solid ${deleteConfirmText === "DELETE" ? C.red : "rgba(255,255,255,0.1)"}`,
                          borderRadius: 8, color: deleteConfirmText === "DELETE" ? C.red : "#fff",
                          fontSize: 13, fontFamily: "Inter", letterSpacing: "0.15em",
                          padding: "10px 12px", outline: "none", marginBottom: 12,
                          transition: "border-color 0.15s",
                        }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                          style={{
                            flex: 1, padding: "10px", borderRadius: 8,
                            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                            color: "var(--text-muted)", fontFamily: "Inter", fontSize: 10,
                            letterSpacing: "0.08em", cursor: "pointer",
                          }}
                        >CANCEL</button>
                        <button
                          disabled={deleteConfirmText !== "DELETE" || moderating}
                          onClick={async () => {
                            if (deleteConfirmText !== "DELETE") return;
                            setModerating(true);
                            try {
                              const res = await fetch(`/api/admin/trainee/${traineeId}`, {
                                method: "DELETE", headers: { "x-admin-password": adminPw },
                              });
                              if (res.ok) { onClose(); }
                              else { setActionResult({ ok: false, text: "Delete failed" }); setShowDeleteConfirm(false); }
                            } catch { setActionResult({ ok: false, text: "Network error" }); setShowDeleteConfirm(false); }
                            setModerating(false);
                          }}
                          style={{
                            flex: 1, padding: "10px", borderRadius: 8,
                            background: deleteConfirmText === "DELETE" ? `${C.red}25` : "rgba(255,255,255,0.03)",
                            border: `1px solid ${deleteConfirmText === "DELETE" ? C.red : "rgba(255,255,255,0.06)"}`,
                            color: deleteConfirmText === "DELETE" ? C.red : "var(--text-muted)",
                            fontFamily: "Inter", fontSize: 10, letterSpacing: "0.08em",
                            cursor: deleteConfirmText === "DELETE" && !moderating ? "pointer" : "not-allowed",
                            transition: "all 0.15s",
                          }}
                        >{moderating ? "DELETING..." : "CONFIRM DELETE"}</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Moderation log */}
                <div className="font-orbitron" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.15em", marginBottom: 8 }}>ACTION HISTORY</div>
                {modLog.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "30px 0", fontSize: 12, fontFamily: "Inter" }}>No moderation actions yet</div>
                ) : modLog.map(entry => {
                  const entryColor = ['block','suspend','mute'].includes(entry.action) ? C.red : C.green;
                  return (
                    <div key={entry.id} style={{
                      padding: "10px 12px", marginBottom: 8, borderRadius: 8,
                      background: `${entryColor}08`, border: `1px solid ${entryColor}20`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="font-orbitron" style={{ fontSize: 10, color: entryColor, letterSpacing: "0.08em" }}>
                          {entry.action.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "Inter" }}>{timeAgo(entry.ts)}</span>
                      </div>
                      {entry.reason && <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "Inter", marginTop: 4 }}>{entry.reason}</div>}
                    </div>
                  );
                })}
              </div>
            )

            // ── EVALUATION TAB ──
            : tab === "evaluation" ? (
              <div>
                <div className="font-orbitron" style={{ fontSize: 9, color: C.gold, letterSpacing: "0.15em", marginBottom: 14 }}>INSTRUCTOR EVALUATION</div>

                {/* Rating selector */}
                <div className="glass-card" style={{ padding: "14px", marginBottom: 12, border: `1px solid ${C.gold}25` }}>
                  <div className="font-orbitron" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 10 }}>OVERALL RATING</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {([
                      { val: "excellent",    label: "⭐⭐⭐ Excellent",   color: C.green },
                      { val: "good",         label: "⭐⭐ Good",           color: C.cyan },
                      { val: "weak",         label: "⚠️ Weak",            color: C.red },
                      { val: "needs_review", label: "🔍 Needs Review",    color: C.yellow },
                      { val: "pending",      label: "⏳ Pending",         color: "var(--text-muted)" },
                    ] as const).map(({ val, label, color }) => (
                      <button key={val} onClick={() => setEvalRating(val)} style={{
                        padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                        background: evalRating === val ? `${color}18` : "rgba(255,255,255,0.02)",
                        border: `1px solid ${evalRating === val ? color : "rgba(255,255,255,0.08)"}`,
                        color: evalRating === val ? color : "var(--text-muted)",
                        fontFamily: "Inter", fontSize: 11, letterSpacing: "0.05em",
                        textAlign: "left", transition: "all 0.15s",
                        boxShadow: evalRating === val ? `0 0 8px ${color}20` : "none",
                      }}>{label}</button>
                    ))}
                  </div>
                </div>

                {/* Technical Observations */}
                <div className="glass-card" style={{ padding: "12px 14px", marginBottom: 12, border: `1px solid ${C.cyan}20` }}>
                  <div className="font-orbitron" style={{ fontSize: 9, color: C.cyan, letterSpacing: "0.1em", marginBottom: 8 }}>TECHNICAL OBSERVATIONS</div>
                  <textarea
                    value={evalObservations}
                    onChange={e => setEvalObservations(e.target.value)}
                    placeholder="Notes on technical performance, strengths, weaknesses..."
                    rows={4}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "rgba(0,0,0,0.3)", border: `1px solid ${C.cyan}25`,
                      borderRadius: 8, color: "#fff", fontSize: 12,
                      padding: "8px 10px", resize: "none", outline: "none",
                    }}
                  />
                </div>

                {/* Recommendation */}
                <div className="glass-card" style={{ padding: "12px 14px", marginBottom: 16, border: `1px solid ${C.gold}20` }}>
                  <div className="font-orbitron" style={{ fontSize: 9, color: C.gold, letterSpacing: "0.1em", marginBottom: 8 }}>RECOMMENDATION</div>
                  <textarea
                    value={evalRecommendation}
                    onChange={e => setEvalRecommendation(e.target.value)}
                    placeholder="Recommend for certification / additional training / re-evaluation..."
                    rows={3}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "rgba(0,0,0,0.3)", border: `1px solid ${C.gold}25`,
                      borderRadius: 8, color: "#fff", fontSize: 12,
                      padding: "8px 10px", resize: "none", outline: "none",
                    }}
                  />
                </div>

                {/* Save button */}
                <button
                  disabled={evalSaving}
                  onClick={async () => {
                    setEvalSaving(true); setEvalSaved(false);
                    try {
                      const res = await fetch('/api/admin/evaluation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPw },
                        body: JSON.stringify({
                          traineeId,
                          rating: evalRating,
                          recommendation: evalRecommendation,
                          technical_observations: evalObservations,
                        }),
                      });
                      if (res.ok) { setEvalSaved(true); setTimeout(() => setEvalSaved(false), 3000); }
                    } catch { /* non-fatal */ }
                    setEvalSaving(false);
                  }}
                  style={{
                    width: "100%", padding: "12px 16px",
                    background: evalSaved ? `${C.green}20` : `${C.gold}15`,
                    border: `1px solid ${evalSaved ? C.green : C.gold}50`,
                    borderRadius: 10, cursor: evalSaving ? "wait" : "pointer",
                    color: evalSaved ? C.green : C.gold,
                    fontFamily: "Inter", fontSize: 11, letterSpacing: "0.1em",
                    transition: "all 0.3s",
                  }}
                >
                  {evalSaving ? "SAVING..." : evalSaved ? "✅ SAVED" : "SAVE EVALUATION"}
                </button>

                {/* Current evaluation summary */}
                {detail.evaluation && (
                  <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="font-orbitron" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 6 }}>LAST SAVED EVALUATION</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "Inter" }}>
                      Rating: <strong style={{ color: C.gold }}>{detail.evaluation.rating}</strong>
                      &nbsp;·&nbsp; Updated: {fmtDate(detail.evaluation.updated_at)}
                    </div>
                  </div>
                )}
              </div>
            )

            : null
          )}
          </div>{/* end scrollable */}

          {/* Messages compose — pinned outside scroll, above keyboard on iOS */}
          {!loading && detail && tab === "messages" && (
            <div style={{
              flexShrink: 0, padding: "8px 16px 12px",
              borderTop: `1px solid ${C.blue}20`,
              background: "#071426",
            }}>
              <div className="glass-card" style={{ padding: "8px 10px", border: `1px solid ${C.blue}25` }}>
                <textarea
                  value={msgText} onChange={e => { setMsgText(e.target.value); sessionStorage.setItem(`tls_admin_msg_${traineeId}`, e.target.value); }}
                  placeholder="Type a message..."
                  rows={2}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (msgText.trim()) { const txt = msgText; act("message", { text: txt }, () => { setMsgText(""); sessionStorage.removeItem(`tls_admin_msg_${traineeId}`); }); } } }}
                  style={{
                    width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.3)",
                    border: `1px solid ${C.blue}25`, borderRadius: 8,
                    color: "#fff", fontSize: 14, padding: "8px 10px", resize: "none", outline: "none",
                    WebkitAppearance: "none",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "Inter" }}>Enter to send · Shift+Enter newline</span>
                  <button
                    disabled={acting || !msgText.trim()}
                    onClick={() => { const txt = msgText; act("message", { text: txt }, () => { setMsgText(""); sessionStorage.removeItem(`tls_admin_msg_${traineeId}`); }); }}
                    style={{
                      padding: "7px 18px",
                      background: msgText.trim() ? `linear-gradient(135deg, ${C.blue}, ${C.cyan})` : "transparent",
                      border: `1px solid ${C.blue}35`, borderRadius: 8,
                      cursor: msgText.trim() ? "pointer" : "default",
                      color: msgText.trim() ? "#020810" : "var(--text-muted)",
                      fontFamily: "Inter", fontSize: 10, fontWeight: 700,
                    }}
                  >{acting ? "..." : "SEND"}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Telegram Settings Panel ──────────────────────────────────────────────────
// ── Types ─────────────────────────────────────────────────────────────────────
type BackupEntry = {
  id: string; label: string; note: string | null;
  created_at: number; size_bytes: number; table_counts: string;
};
type BackupStats = {
  totalBytes: number; totalBackups: number;
  lastBackup: { label: string; created_at: number } | null;
  counts: Record<string, number>;
};

function MissedQuestionsPanel({ adminPw }: { adminPw: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!open && data.length === 0) {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/missed-questions', { headers: { 'x-admin-password': adminPw } });
        if (res.ok) setData(await res.json());
      } catch {}
      setLoading(false);
    }
    setOpen(o => !o);
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={load} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background: open ? "rgba(255,77,77,0.08)" : "rgba(8,15,28,0.9)", border:`1px solid ${open ? "rgba(255,77,77,0.35)" : "rgba(255,77,77,0.18)"}`, borderRadius: open ? "12px 12px 0 0" : 12, cursor:"pointer", color:"inherit", transition:"all 0.2s" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:18 }}>📊</span>
          <span className="font-orbitron" style={{ fontSize:11, letterSpacing:"0.15em", color:"#FF4D4D" }}>MOST MISSED QUESTIONS</span>
        </div>
        <span style={{ color:"var(--text-muted)", fontSize:14, transform: open ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}>▾</span>
      </button>
      {open && (
        <div style={{ background:"rgba(6,12,24,0.97)", border:"1px solid rgba(255,77,77,0.2)", borderTop:"none", borderRadius:"0 0 12px 12px", padding:"16px" }}>
          {loading ? <div style={{ textAlign:"center", color:"var(--text-muted)", padding:20, fontFamily:"Inter", fontSize:12 }}>Loading...</div>
          : data.length === 0 ? <div style={{ textAlign:"center", color:"var(--text-muted)", padding:20, fontFamily:"Inter", fontSize:12 }}>No data yet — trainees need to complete quizzes first.</div>
          : data.map((q: any, i: number) => (
            <div key={i} style={{ padding:"10px 12px", marginBottom:8, borderRadius:8, background: q.wrong_pct>=70 ? "rgba(255,77,77,0.07)" : "rgba(255,209,102,0.07)", border:`1px solid ${q.wrong_pct>=70 ? "rgba(255,77,77,0.2)" : "rgba(255,209,102,0.2)"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
                <div style={{ flex:1, fontSize:11, color:"var(--text-secondary)", fontFamily:"Inter" }}>
                  <span style={{ color:"var(--text-muted)", marginRight:6 }}>#{i+1}</span>{q.question_text}
                  <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:4 }}>Module {q.module_id} · {q.total_attempts} attempts</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:16, fontWeight:800, fontFamily:"Inter", color: q.wrong_pct>=70 ? "#FF4D4D" : "#FFD166" }}>{q.wrong_pct}%</div>
                  <div style={{ fontSize:9, color:"var(--text-muted)", fontFamily:"Inter" }}>miss rate</div>
                </div>
              </div>
              <div style={{ marginTop:8, height:3, background:"rgba(255,255,255,0.05)", borderRadius:2 }}>
                <div style={{ height:"100%", borderRadius:2, width:`${q.wrong_pct}%`, background: q.wrong_pct>=70 ? "#FF4D4D" : "#FFD166" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BackupPanel({ adminPw }: { adminPw: string }) {
  const [open, setOpen]           = useState(false);
  const [tab, setTab]             = useState<'db' | 'export' | 'import' | 'snapshots'>('db');
  const [backups, setBackups]     = useState<BackupEntry[]>([]);
  const [stats, setStats]         = useState<BackupStats | null>(null);
  const [loading, setLoading]     = useState(false);
  const [creating, setCreating]   = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [note, setNote]           = useState("");
  const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<BackupEntry | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const headers = { "x-admin-password": adminPw, "Content-Type": "application/json" };

  const formatBytes = (b: number) => b > 1_000_000 ? `${(b/1_000_000).toFixed(1)} MB` : b > 1000 ? `${(b/1000).toFixed(1)} KB` : `${b} B`;
  const timeAgoStr = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  };
  const labelColor = (label: string) =>
    label === 'manual' ? C.cyan : label === 'weekly' ? C.gold : label === 'pre-restore' ? C.yellow : C.green;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, sRes] = await Promise.all([
        fetch("/api/admin/backup/list", { headers: { "x-admin-password": adminPw } }),
        fetch("/api/admin/backup/stats", { headers: { "x-admin-password": adminPw } }),
      ]);
      setBackups(await bRes.json() as BackupEntry[]);
      setStats(await sRes.json() as BackupStats);
    } catch { /* ignore */ }
    setLoading(false);
  }, [adminPw]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const createBackup = async () => {
    setCreating(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/backup/create", { method: "POST", headers, body: JSON.stringify({ note: note.trim() || "Manual backup" }) });
      const data = await res.json() as { ok: boolean; id?: string; sizeBytes?: number; error?: string };
      if (data.ok) {
        setMsg({ ok: true, text: `✅ Backup created (${formatBytes(data.sizeBytes ?? 0)})` });
        setNote("");
        load();
      } else {
        setMsg({ ok: false, text: `❌ ${data.error ?? "Failed"}` });
      }
    } catch { setMsg({ ok: false, text: "❌ Network error" }); }
    setCreating(false);
  };

  const downloadBackup = (b: BackupEntry) => {
    const url = `/api/admin/backup/${b.id}/download?pw=${encodeURIComponent(adminPw)}`;
    const a = document.createElement("a"); a.href = url;
    a.download = `TLS-backup-${b.label}-${new Date(b.created_at).toISOString().slice(0,10)}.json`;
    a.click();
  };

  const exportData = (format: 'json' | 'sql') => {
    const url = `/api/admin/backup/export/${format}?pw=${encodeURIComponent(adminPw)}`;
    const a = document.createElement("a"); a.href = url;
    a.download = `TLS-export-${new Date().toISOString().slice(0,10)}.${format}`;
    a.click();
  };

  const exportProject = async () => {
    setExporting('project'); setMsg(null);
    try {
      const res = await fetch(`/api/admin/backup/export/project?pw=${encodeURIComponent(adminPw)}`);
      if (!res.ok) { const e = await res.json() as { error: string }; setMsg({ ok: false, text: `❌ ${e.error}` }); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `TLS-Trainer-source-${new Date().toISOString().slice(0,10)}.zip`;
      a.click(); URL.revokeObjectURL(url);
      setMsg({ ok: true, text: `✅ Project source exported` });
    } catch { setMsg({ ok: false, text: "❌ Export failed" }); }
    setExporting(null);
  };

  const exportMigration = async () => {
    setExporting('migration'); setMsg(null);
    try {
      const res = await fetch(`/api/admin/backup/export/migration?pw=${encodeURIComponent(adminPw)}`);
      if (!res.ok) { const e = await res.json() as { error: string }; setMsg({ ok: false, text: `❌ ${e.error}` }); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `TLS-Trainer-migration-${new Date().toISOString().slice(0,10)}.zip`;
      a.click(); URL.revokeObjectURL(url);
      setMsg({ ok: true, text: `✅ Migration package exported — includes source + DB + files` });
    } catch { setMsg({ ok: false, text: "❌ Migration export failed" }); }
    setExporting(null);
  };

  const doImportFile = async () => {
    if (!importFile) return;
    setImporting(true); setMsg(null); setConfirmImport(false);
    try {
      const form = new FormData();
      form.append('file', importFile);
      const res = await fetch('/api/admin/backup/import', {
        method: 'POST',
        headers: { 'x-admin-password': adminPw },
        body: form,
      });
      const data = await res.json() as { ok: boolean; tablesRestored?: number; error?: string };
      if (data.ok) {
        setMsg({ ok: true, text: `✅ Restored ${data.tablesRestored} tables from ${importFile.name}. Pre-restore snapshot saved.` });
        setImportFile(null);
        load();
      } else {
        setMsg({ ok: false, text: `❌ ${data.error ?? "Import failed"}` });
      }
    } catch { setMsg({ ok: false, text: "❌ Network error during import" }); }
    setImporting(false);
  };

  const doRestore = async (b: BackupEntry) => {
    setRestoring(b.id); setMsg(null); setConfirmRestore(null);
    try {
      const res = await fetch(`/api/admin/backup/${b.id}/restore`, { method: "POST", headers });
      const data = await res.json() as { ok: boolean; tablesRestored?: number; error?: string };
      if (data.ok) {
        setMsg({ ok: true, text: `✅ Restored ${data.tablesRestored} tables. A pre-restore snapshot was saved.` });
        load();
      } else {
        setMsg({ ok: false, text: `❌ ${data.error ?? "Restore failed"}` });
      }
    } catch { setMsg({ ok: false, text: "❌ Network error" }); }
    setRestoring(null);
  };

  const deleteBackup = async (id: string) => {
    setDeleting(id);
    await fetch(`/api/admin/backup/${id}`, { method: "DELETE", headers: { "x-admin-password": adminPw } }).catch(() => {});
    setDeleting(null);
    load();
  };

  const TABS = [
    { id: 'db',        label: '💾 DATABASE',   color: C.green },
    { id: 'export',    label: '📦 EXPORT',     color: C.gold },
    { id: 'import',    label: '📥 IMPORT',     color: C.cyan },
    { id: 'snapshots', label: '🕐 HISTORY',    color: C.blue },
  ] as const;

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Header toggle */}
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px",
        background: open ? "rgba(0,210,106,0.08)" : "rgba(8,15,28,0.9)",
        border: `1px solid ${open ? "rgba(0,210,106,0.35)" : "rgba(0,210,106,0.18)"}`,
        borderRadius: open ? "12px 12px 0 0" : 12, cursor: "pointer", color: "inherit", transition: "all 0.2s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🛡️</span>
          <span className="font-orbitron" style={{ fontSize: 11, letterSpacing: "0.15em", color: C.green }}>BACKUP · EXPORT · RESTORE</span>
          {stats && (
            <span style={{ fontSize: 8, fontFamily: "Inter", letterSpacing: "0.1em", background: "rgba(0,210,106,0.12)", border: "1px solid rgba(0,210,106,0.35)", color: C.green, padding: "2px 8px", borderRadius: 10 }}>
              {stats.totalBackups} SNAPSHOTS
            </span>
          )}
        </div>
        <span style={{ color: "var(--text-muted)", fontSize: 14, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </button>

      {open && (
        <div style={{ background: "rgba(6,12,24,0.97)", border: "1px solid rgba(0,210,106,0.2)", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "16px" }}>

          {/* Stats bar */}
          {stats && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                { label: "SNAPSHOTS", value: String(stats.totalBackups), color: C.green },
                { label: "DB SIZE", value: formatBytes(stats.totalBytes), color: C.cyan },
                { label: "LAST BACKUP", value: stats.lastBackup ? timeAgoStr(stats.lastBackup.created_at) : "None", color: C.gold },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: "10px 8px", textAlign: "center", background: "rgba(0,0,0,0.3)", border: `1px solid ${color}20`, borderRadius: 8 }}>
                  <div className="font-orbitron" style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: 8, color: "var(--text-muted)", fontFamily: "Inter", letterSpacing: "0.06em", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Auto-backup indicators */}
          <div style={{ marginBottom: 14, padding: "8px 12px", background: "rgba(0,210,106,0.04)", border: "1px solid rgba(0,210,106,0.12)", borderRadius: 8, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            {[{ dot: C.green, label: "Daily auto-backup" }, { dot: C.gold, label: "Weekly auto-backup" }].map(({ dot, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, display: "inline-block", boxShadow: `0 0 5px ${dot}` }} />
                <span style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "Inter" }}>{label}</span>
              </div>
            ))}
            {stats && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto" }}>
                {Object.entries(stats.counts).map(([label, count]) => count > 0 && (
                  <span key={label} style={{ fontSize: 9, fontFamily: "Inter", color: labelColor(label), background: `${labelColor(label)}10`, border: `1px solid ${labelColor(label)}25`, padding: "2px 7px", borderRadius: 8 }}>
                    {label}: {count}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Message */}
          {msg && (
            <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, fontSize: 12, fontFamily: "Inter",
              background: msg.ok ? "rgba(0,210,106,0.08)" : "rgba(255,77,77,0.08)",
              border: `1px solid ${msg.ok ? C.green : C.red}30`,
              color: msg.ok ? C.green : C.red,
            }} onClick={() => setMsg(null)}>{msg.text}</div>
          )}

          {/* Tab nav */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 16 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "8px 4px", borderRadius: 8, fontFamily: "Inter", fontSize: 8, letterSpacing: "0.06em",
                background: tab === t.id ? `${t.color}18` : "rgba(0,0,0,0.2)",
                border: `1px solid ${tab === t.id ? t.color + "50" : "rgba(255,255,255,0.06)"}`,
                color: tab === t.id ? t.color : "var(--text-muted)", cursor: "pointer", transition: "all 0.15s",
              }}>{t.label}</button>
            ))}
          </div>

          {/* ── TAB: DATABASE BACKUPS ── */}
          {tab === 'db' && (
            <div>
              <div className="font-orbitron" style={{ fontSize: 9, color: C.cyan, letterSpacing: "0.15em", marginBottom: 10 }}>CREATE SNAPSHOT</div>
              <input
                value={note} onChange={e => setNote(e.target.value)}
                placeholder="Label / note (e.g. v2.1 before quiz update)"
                style={{ width: "100%", boxSizing: "border-box", marginBottom: 8, padding: "9px 12px", background: "rgba(0,0,0,0.3)", border: `1px solid ${C.cyan}20`, borderRadius: 8, color: "#fff", fontSize: 12, outline: "none", fontFamily: "Inter" }}
              />
              <button onClick={createBackup} disabled={creating} style={{
                width: "100%", padding: "11px", borderRadius: 8,
                background: creating ? "rgba(0,174,239,0.04)" : "rgba(0,174,239,0.12)",
                border: `1px solid ${C.cyan}${creating ? "15" : "45"}`,
                color: creating ? "var(--text-muted)" : C.cyan,
                fontFamily: "Inter", fontSize: 10, letterSpacing: "0.1em", cursor: creating ? "not-allowed" : "pointer",
              }}>{creating ? "⏳ CREATING SNAPSHOT..." : "💾 SNAPSHOT DATABASE NOW"}</button>

              <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="font-orbitron" style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 6 }}>WHAT'S INCLUDED</div>
                {['trainees & auth', 'quiz attempts & scores', 'chat messages & attachments', 'activity logs', 'moderation log', 'modules & questions', 'instructor notes', 'trainee alerts', 'module progress'].map(item => (
                  <div key={item} style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "Inter", padding: "2px 0", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: C.green, fontSize: 9 }}>✓</span> {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: EXPORT ── */}
          {tab === 'export' && (
            <div>
              {/* Data exports */}
              <div className="font-orbitron" style={{ fontSize: 9, color: C.gold, letterSpacing: "0.15em", marginBottom: 8 }}>DATA EXPORTS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                <button onClick={() => exportData('json')} style={{
                  padding: "12px 8px", borderRadius: 8, textAlign: "center",
                  background: "rgba(201,166,107,0.07)", border: `1px solid ${C.gold}25`,
                  color: C.gold, fontFamily: "Inter", fontSize: 8, letterSpacing: "0.06em", cursor: "pointer",
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>📄</div>
                  <div>DATABASE.JSON</div>
                  <div style={{ fontSize: 7, color: "var(--text-muted)", marginTop: 3, fontFamily: "Inter" }}>All tables as JSON</div>
                </button>
                <button onClick={() => exportData('sql')} style={{
                  padding: "12px 8px", borderRadius: 8, textAlign: "center",
                  background: "rgba(201,166,107,0.07)", border: `1px solid ${C.gold}25`,
                  color: C.gold, fontFamily: "Inter", fontSize: 8, letterSpacing: "0.06em", cursor: "pointer",
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>🗃️</div>
                  <div>DATABASE.SQL</div>
                  <div style={{ fontSize: 7, color: "var(--text-muted)", marginTop: 3, fontFamily: "Inter" }}>SQL INSERT statements</div>
                </button>
              </div>

              {/* Project source */}
              <div className="font-orbitron" style={{ fontSize: 9, color: C.cyan, letterSpacing: "0.15em", marginBottom: 8 }}>PROJECT SOURCE CODE</div>
              <button onClick={exportProject} disabled={exporting === 'project'} style={{
                width: "100%", padding: "14px 12px", borderRadius: 10, marginBottom: 16,
                background: exporting === 'project' ? "rgba(0,174,239,0.04)" : "rgba(0,174,239,0.08)",
                border: `1px solid ${C.cyan}${exporting === 'project' ? "15" : "35"}`,
                color: exporting === 'project' ? "var(--text-muted)" : C.cyan,
                fontFamily: "Inter", cursor: exporting === 'project' ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ fontSize: 24 }}>📁</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.1em" }}>{exporting === 'project' ? "⏳ BUILDING ZIP..." : "EXPORT SOURCE CODE (.ZIP)"}</div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "Inter", marginTop: 2 }}>Full codebase without node_modules · Redeploy anywhere</div>
                </div>
              </button>

              {/* Migration package */}
              <div className="font-orbitron" style={{ fontSize: 9, color: "#c084fc", letterSpacing: "0.15em", marginBottom: 8 }}>FULL MIGRATION PACKAGE</div>
              <button onClick={exportMigration} disabled={exporting === 'migration'} style={{
                width: "100%", padding: "14px 12px", borderRadius: 10, marginBottom: 12,
                background: exporting === 'migration' ? "rgba(192,132,252,0.04)" : "rgba(192,132,252,0.08)",
                border: `1px solid ${exporting === 'migration' ? "rgba(192,132,252,0.15)" : "rgba(192,132,252,0.35)"}`,
                color: exporting === 'migration' ? "var(--text-muted)" : "#c084fc",
                fontFamily: "Inter", cursor: exporting === 'migration' ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ fontSize: 24 }}>🚀</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.1em" }}>{exporting === 'migration' ? "⏳ BUILDING PACKAGE..." : "MIGRATION PACKAGE (.ZIP)"}</div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "Inter", marginTop: 2 }}>Source + Database + Files + README · Move to any platform</div>
                </div>
              </button>
              <div style={{ padding: "10px 12px", background: "rgba(192,132,252,0.05)", border: "1px solid rgba(192,132,252,0.15)", borderRadius: 8 }}>
                <div className="font-orbitron" style={{ fontSize: 8, color: "#c084fc", letterSpacing: "0.1em", marginBottom: 6 }}>MIGRATION PACKAGE CONTAINS</div>
                {[
                  ['migration/source/', 'Full project source code'],
                  ['migration/database/tls-database.json', 'All DB data as JSON'],
                  ['migration/database/tls-database.sql', 'SQL migration file'],
                  ['migration/files/attachments-manifest.json', 'Uploaded files list'],
                  ['migration/README.md', 'Restore instructions'],
                ].map(([path, desc]) => (
                  <div key={path} style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: "#c084fc", fontFamily: "monospace" }}>{path}</span>
                    <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "Inter" }}> — {desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: IMPORT / RESTORE FROM FILE ── */}
          {tab === 'import' && (
            <div>
              <div className="font-orbitron" style={{ fontSize: 9, color: C.cyan, letterSpacing: "0.15em", marginBottom: 10 }}>RESTORE FROM BACKUP FILE</div>
              <div style={{ padding: "12px", background: "rgba(255,209,102,0.05)", border: `1px solid ${C.gold}20`, borderRadius: 8, marginBottom: 14, fontSize: 11, color: C.gold, fontFamily: "Inter", lineHeight: 1.6 }}>
                ⚠ Upload a TLS Trainer backup JSON file. Current data will be replaced. A pre-restore snapshot is saved automatically.
              </div>

              {/* File drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: "24px 16px", borderRadius: 10, textAlign: "center", cursor: "pointer", marginBottom: 14,
                  background: importFile ? "rgba(0,174,239,0.07)" : "rgba(0,0,0,0.2)",
                  border: `2px dashed ${importFile ? C.cyan + "60" : "rgba(255,255,255,0.1)"}`,
                  transition: "all 0.2s",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file" accept=".json" style={{ display: "none" }}
                  onChange={e => setImportFile(e.target.files?.[0] ?? null)}
                />
                {importFile ? (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
                    <div style={{ fontSize: 12, color: C.cyan, fontFamily: "Inter" }}>{importFile.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter", marginTop: 3 }}>{formatBytes(importFile.size)}</div>
                    <button onClick={e => { e.stopPropagation(); setImportFile(null); }} style={{ marginTop: 8, fontSize: 10, color: C.red, background: "none", border: "none", cursor: "pointer", fontFamily: "Inter" }}>✕ REMOVE</button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📥</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "Inter", letterSpacing: "0.08em" }}>TAP TO SELECT BACKUP FILE</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter", marginTop: 4 }}>Accepts TLS-backup-*.json files</div>
                  </>
                )}
              </div>

              <button
                onClick={() => importFile && setConfirmImport(true)}
                disabled={!importFile || importing}
                style={{
                  width: "100%", padding: "12px", borderRadius: 8,
                  background: !importFile ? "rgba(255,255,255,0.02)" : importing ? "rgba(0,174,239,0.04)" : "rgba(0,174,239,0.12)",
                  border: `1px solid ${!importFile ? "rgba(255,255,255,0.05)" : importing ? C.cyan + "15" : C.cyan + "50"}`,
                  color: !importFile ? "var(--text-muted)" : importing ? "var(--text-muted)" : C.cyan,
                  fontFamily: "Inter", fontSize: 10, letterSpacing: "0.1em",
                  cursor: !importFile || importing ? "not-allowed" : "pointer",
                }}
              >{importing ? "⏳ RESTORING..." : "♻ RESTORE FROM FILE"}</button>

              <div style={{ marginTop: 16, padding: "12px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8 }}>
                <div className="font-orbitron" style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 6 }}>HOW RESTORE WORKS</div>
                {[
                  '1. Auto-snapshot of current data is saved',
                  '2. All tables are cleared',
                  '3. Backup data is re-inserted',
                  '4. Online flags reset for all trainees',
                  '5. App continues — no restart needed',
                ].map(s => (
                  <div key={s} style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "Inter", padding: "2px 0" }}>{s}</div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: SNAPSHOT HISTORY ── */}
          {tab === 'snapshots' && (
            <div>
              <div className="font-orbitron" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.15em", marginBottom: 10 }}>
                SNAPSHOT HISTORY {loading && <span style={{ color: C.cyan }}>· Loading...</span>}
                <button onClick={load} style={{ marginLeft: 8, background: "none", border: "none", color: C.cyan, cursor: "pointer", fontSize: 9, fontFamily: "Inter" }}>↻ REFRESH</button>
              </div>

              {!loading && backups.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: 12, fontFamily: "Inter" }}>
                  No snapshots yet. Create one from the Database tab.
                </div>
              )}

              {backups.map(b => {
                const bCounts = (() => { try { return JSON.parse(b.table_counts) as Record<string, number>; } catch { return {}; } })();
                const totalRows = Object.values(bCounts).reduce((s, n) => s + n, 0);
                const isRestoring = restoring === b.id;
                const isDeleting = deleting === b.id;

                return (
                  <div key={b.id} style={{ marginBottom: 10, padding: "12px 14px", borderRadius: 10, background: "rgba(0,0,0,0.25)", border: `1px solid ${labelColor(b.label)}20` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 9, fontFamily: "Inter", color: labelColor(b.label), background: `${labelColor(b.label)}15`, border: `1px solid ${labelColor(b.label)}35`, padding: "2px 8px", borderRadius: 10, letterSpacing: "0.08em" }}>
                          {b.label.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter", marginLeft: 8 }}>{timeAgoStr(b.created_at)}</span>
                      </div>
                      <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter" }}>{formatBytes(b.size_bytes)}</span>
                    </div>
                    {b.note && <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "Inter", marginBottom: 5 }}>{b.note}</div>}
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter", marginBottom: 8 }}>
                      {totalRows} rows · {new Date(b.created_at).toLocaleString("en-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" })}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {(['trainees', 'quiz_attempts', 'chat_messages', 'moderation_log'] as const).map(key => (
                        typeof bCounts[key] === 'number' && (
                          <span key={key} style={{ fontSize: 8, fontFamily: "Inter", color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", padding: "2px 7px", borderRadius: 7 }}>
                            {key.replace('_', ' ')}: {bCounts[key]}
                          </span>
                        )
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => downloadBackup(b)} style={{
                        flex: 1, padding: "7px 4px", borderRadius: 7,
                        background: "rgba(0,174,239,0.07)", border: `1px solid ${C.cyan}20`,
                        color: C.cyan, fontFamily: "Inter", fontSize: 8, letterSpacing: "0.05em", cursor: "pointer",
                      }}>⬇ DOWNLOAD</button>
                      <button onClick={() => setConfirmRestore(b)} disabled={!!restoring} style={{
                        flex: 1, padding: "7px 4px", borderRadius: 7,
                        background: isRestoring ? "rgba(255,255,255,0.02)" : "rgba(0,210,106,0.07)",
                        border: `1px solid ${isRestoring ? "rgba(255,255,255,0.04)" : C.green + "25"}`,
                        color: isRestoring ? "var(--text-muted)" : C.green,
                        fontFamily: "Inter", fontSize: 8, letterSpacing: "0.05em", cursor: restoring ? "not-allowed" : "pointer",
                      }}>{isRestoring ? "..." : "♻ RESTORE"}</button>
                      <button onClick={() => deleteBackup(b.id)} disabled={!!deleting || b.label === 'pre-restore'} style={{
                        padding: "7px 10px", borderRadius: 7,
                        background: "rgba(255,77,77,0.05)", border: `1px solid ${C.red}15`,
                        color: isDeleting ? "var(--text-muted)" : C.red,
                        fontFamily: "Inter", fontSize: 8, cursor: deleting || b.label === 'pre-restore' ? "not-allowed" : "pointer",
                        opacity: b.label === 'pre-restore' ? 0.3 : 1,
                      }} title={b.label === 'pre-restore' ? "Pre-restore snapshots cannot be deleted" : "Delete"}>{isDeleting ? "..." : "🗑"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Restore confirmation modal ── */}
          {confirmRestore && (
            <div style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            }} onClick={() => setConfirmRestore(null)}>
              <div onClick={e => e.stopPropagation()} style={{
                background: "#071426", border: `1px solid ${C.gold}40`,
                borderRadius: 16, padding: 24, maxWidth: 360, width: "100%",
              }}>
                <div style={{ fontSize: 32, textAlign: "center", marginBottom: 10 }}>♻️</div>
                <div className="font-orbitron" style={{ fontSize: 13, color: C.gold, textAlign: "center", marginBottom: 8 }}>RESTORE SNAPSHOT?</div>
                <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.3)", borderRadius: 8, marginBottom: 10, border: `1px solid ${labelColor(confirmRestore.label)}25` }}>
                  <div style={{ fontSize: 11, color: labelColor(confirmRestore.label), fontFamily: "Inter" }}>{confirmRestore.label.toUpperCase()}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "Inter", marginTop: 3 }}>{confirmRestore.note || "No note"}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter" }}>{new Date(confirmRestore.created_at).toLocaleString("en-SA", { timeZone: "Asia/Riyadh" })}</div>
                </div>
                <div style={{ padding: "8px 12px", background: "rgba(255,209,102,0.05)", border: `1px solid ${C.gold}18`, borderRadius: 8, marginBottom: 14, fontSize: 11, color: C.gold, fontFamily: "Inter", lineHeight: 1.5 }}>
                  ⚠ Current data will be overwritten. A pre-restore snapshot is saved automatically.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmRestore(null)} style={{
                    flex: 1, padding: "10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    color: "var(--text-muted)", fontFamily: "Inter", fontSize: 10, cursor: "pointer",
                  }}>CANCEL</button>
                  <button onClick={() => doRestore(confirmRestore)} style={{
                    flex: 1, padding: "10px", borderRadius: 8, background: "rgba(0,210,106,0.14)", border: `1px solid ${C.green}45`,
                    color: C.green, fontFamily: "Inter", fontSize: 10, cursor: "pointer",
                  }}>CONFIRM RESTORE</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Import confirmation modal ── */}
          {confirmImport && importFile && (
            <div style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            }} onClick={() => setConfirmImport(false)}>
              <div onClick={e => e.stopPropagation()} style={{
                background: "#071426", border: `1px solid ${C.cyan}40`,
                borderRadius: 16, padding: 24, maxWidth: 360, width: "100%",
              }}>
                <div style={{ fontSize: 32, textAlign: "center", marginBottom: 10 }}>📥</div>
                <div className="font-orbitron" style={{ fontSize: 13, color: C.cyan, textAlign: "center", marginBottom: 8 }}>IMPORT & RESTORE?</div>
                <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.3)", borderRadius: 8, marginBottom: 10, border: `1px solid ${C.cyan}20` }}>
                  <div style={{ fontSize: 11, color: C.cyan, fontFamily: "Inter" }}>{importFile.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter", marginTop: 3 }}>{formatBytes(importFile.size)}</div>
                </div>
                <div style={{ padding: "8px 12px", background: "rgba(255,209,102,0.05)", border: `1px solid ${C.gold}18`, borderRadius: 8, marginBottom: 14, fontSize: 11, color: C.gold, fontFamily: "Inter", lineHeight: 1.5 }}>
                  ⚠ All current data will be replaced with this backup's data. A pre-restore snapshot is saved first.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmImport(false)} style={{
                    flex: 1, padding: "10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    color: "var(--text-muted)", fontFamily: "Inter", fontSize: 10, cursor: "pointer",
                  }}>CANCEL</button>
                  <button onClick={doImportFile} style={{
                    flex: 1, padding: "10px", borderRadius: 8, background: "rgba(0,174,239,0.14)", border: `1px solid ${C.cyan}45`,
                    color: C.cyan, fontFamily: "Inter", fontSize: 10, cursor: "pointer",
                  }}>CONFIRM IMPORT</button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function TelegramPanel({ adminPw }: { adminPw: string }) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<{ hasToken: boolean; chatId: string; enabled: boolean } | null>(null);
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const headers = { "Content-Type": "application/json", "x-admin-password": adminPw };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/telegram", { headers: { "x-admin-password": adminPw } });
      const data = await res.json() as { hasToken: boolean; chatId: string; enabled: boolean };
      setConfig(data); setChatId(data.chatId ?? ""); setEnabled(data.enabled ?? false); setBotToken("");
    } catch { /* ignore */ }
  }, [adminPw]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const body: Record<string, unknown> = { chatId, enabled };
      if (botToken.trim()) body.botToken = botToken.trim();
      const res = await fetch("/api/admin/telegram", { method: "POST", headers, body: JSON.stringify(body) });
      const data = await res.json() as { ok: boolean };
      setMsg(data.ok ? { ok: true, text: "Settings saved." } : { ok: false, text: "Save failed." });
      if (data.ok) { setBotToken(""); load(); }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setSaving(false);
  };

  const test = async () => {
    setTesting(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/telegram/test", { method: "POST", headers });
      const data = await res.json() as { ok: boolean; error?: string };
      setMsg(data.ok ? { ok: true, text: "✅ Test message sent!" } : { ok: false, text: `❌ ${data.error ?? "Failed"}` });
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setTesting(false);
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px",
        background: open ? "rgba(0,174,239,0.08)" : "rgba(8,15,28,0.9)",
        border: `1px solid ${open ? "rgba(0,174,239,0.35)" : "rgba(0,174,239,0.15)"}`,
        borderRadius: open ? "12px 12px 0 0" : 12, cursor: "pointer", color: "inherit", transition: "all 0.2s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>📡</span>
          <span className="font-orbitron" style={{ fontSize: 11, letterSpacing: "0.15em", color: C.cyan }}>TELEGRAM NOTIFICATIONS</span>
          {config?.enabled && (
            <span style={{ fontSize: 8, fontFamily: "Inter", letterSpacing: "0.1em", background: "rgba(0,210,106,0.15)", border: "1px solid rgba(0,210,106,0.4)", color: C.green, padding: "2px 8px", borderRadius: 10 }}>ACTIVE</span>
          )}
        </div>
        <span style={{ color: "var(--text-muted)", fontSize: 14, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </button>

      {open && (
        <div style={{ background: "rgba(6,12,24,0.97)", border: "1px solid rgba(0,174,239,0.2)", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "Inter" }}>Enable Telegram Notifications</span>
            <button onClick={() => setEnabled(e => !e)} style={{
              width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
              background: enabled ? C.green : "rgba(0,174,239,0.15)", position: "relative", transition: "background 0.25s",
            }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: enabled ? 23 : 3, transition: "left 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
            </button>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="font-orbitron" style={{ fontSize: 9, letterSpacing: "0.15em", color: "var(--text-muted)", marginBottom: 6 }}>BOT TOKEN {config?.hasToken && <span style={{ color: C.green }}>· SET ✓</span>}</div>
            <input type="password" value={botToken} onChange={e => setBotToken(e.target.value)} placeholder={config?.hasToken ? "Leave blank to keep current" : "Enter bot token"} style={{ width: "100%", padding: "10px 12px", background: "rgba(0,174,239,0.05)", border: "1px solid rgba(0,174,239,0.2)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div className="font-orbitron" style={{ fontSize: 9, letterSpacing: "0.15em", color: "var(--text-muted)", marginBottom: 6 }}>ADMIN CHAT ID</div>
            <input type="text" value={chatId} onChange={e => setChatId(e.target.value)} placeholder="e.g. 123456789" style={{ width: "100%", padding: "10px 12px", background: "rgba(0,174,239,0.05)", border: "1px solid rgba(0,174,239,0.2)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving} className="tac-btn tac-btn-primary" style={{ flex: 1, opacity: saving ? 0.6 : 1 }}>{saving ? "SAVING..." : "SAVE SETTINGS"}</button>
            <button onClick={test} disabled={testing} style={{ flex: 1, opacity: testing ? 0.6 : 1, background: "rgba(0,210,106,0.1)", border: "1px solid rgba(0,210,106,0.35)", borderRadius: 8, color: C.green, fontFamily: "Inter", fontSize: 11, padding: "10px", cursor: "pointer" }}>{testing ? "SENDING..." : "🔔 TEST"}</button>
          </div>
          {msg && (
            <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: msg.ok ? "rgba(0,210,106,0.1)" : "rgba(255,77,77,0.1)", border: `1px solid ${msg.ok ? "rgba(0,210,106,0.35)" : "rgba(255,77,77,0.35)"}`, fontSize: 11, color: msg.ok ? C.green : C.red }}>{msg.text}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── QuickModBtn — inline moderation button on trainee card ──────────────────
function QuickModBtn({ traineeId, action, label, color, adminPw, onDone }: {
  traineeId: string; action: string; label: string; color: string; adminPw: string; onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const go = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy || done) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPw },
        body: JSON.stringify({ traineeId, action }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) { setDone(true); setTimeout(() => { setDone(false); onDone(); }, 800); }
    } catch { /* ignore */ }
    setBusy(false);
  };

  return (
    <button
      onClick={go}
      disabled={busy}
      style={{
        padding: "5px 10px", borderRadius: 8, border: `1px solid ${color}35`,
        background: done ? `${color}25` : `${color}10`,
        color: done ? color : `${color}cc`,
        fontFamily: "Inter", fontSize: 9, letterSpacing: "0.06em",
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.6 : 1,
        transition: "all 0.15s",
        flexShrink: 0,
      }}
    >
      {busy ? "..." : done ? "✓" : label}
    </button>
  );
}

// ─── Nav Manager Admin ────────────────────────────────────────────────────────
function NavManagerAdmin({ adminPw }: { adminPw: string }) {
  const [items, setItems] = React.useState<{ id: number; label: string; href: string; icon: string; order: number; isVisible: boolean }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [showAdd, setShowAdd] = React.useState(false);
  const [newItem, setNewItem] = React.useState({ label: "", href: "", icon: "BookOpen" });
  const [dragging, setDragging] = React.useState<number | null>(null);

  const headers = { "Content-Type": "application/json", "x-admin-pw": adminPw };
  const ICONS = ["Home","BookOpen","Zap","FileText","MessageSquare","MessageCircle","Monitor","ShieldAlert","Trophy","BarChart","Bell","Settings","Crosshair","Users"];
  const ICON_EMOJI: Record<string,string> = { Home:"⌂", BookOpen:"📡", Zap:"⭐", FileText:"📋", MessageSquare:"💬", MessageCircle:"🔒", Monitor:"🎮", ShieldAlert:"⚠️", Trophy:"🏅", BarChart:"📊", Bell:"🔔", Settings:"⚙️", Crosshair:"🎯", Users:"👥" };

  React.useEffect(() => {
    fetch(`/api/admin/nav-items`, { headers: { "x-admin-pw": adminPw } })
      .then(r => r.json()).then((d: any[]) => { if (Array.isArray(d)) setItems(d); }).finally(() => setLoading(false));
  }, []);

  const saveAll = async () => {
    setSaving(true);
    await fetch(`/api/admin/nav-items`, {
      method: "PUT", headers,
      body: JSON.stringify(items.map(({ id, isVisible, order, label, icon }) => ({ id, isVisible, order, label, icon }))),
    });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const toggle = (id: number) => setItems(prev => prev.map(i => i.id === id ? { ...i, isVisible: !i.isVisible } : i));
  const moveUp = (idx: number) => { if (idx === 0) return; setItems(prev => { const a = [...prev]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; return a.map((x,i) => ({ ...x, order: i+1 })); }); };
  const moveDown = (idx: number) => setItems(prev => { if (idx >= prev.length-1) return prev; const a = [...prev]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a.map((x,i) => ({ ...x, order: i+1 })); });

  const addItem = async () => {
    if (!newItem.label || !newItem.href) return;
    const res = await fetch(`/api/admin/nav-items`, { method: "POST", headers, body: JSON.stringify({ ...newItem, order: items.length + 1 }) });
    const item = await res.json();
    setItems(prev => [...prev, item]);
    setNewItem({ label: "", href: "", icon: "BookOpen" }); setShowAdd(false);
  };

  const deleteItem = async (id: number) => {
    await fetch(`/api/admin/nav-items/${id}`, { method: "DELETE", headers });
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const C = { primary: "#00FF88", cyan: "#00AEEF", gold: "#FFD166", red: "#FF4D4D", muted: "rgba(255,255,255,0.35)" };
  const inp: React.CSSProperties = { background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontFamily: "Inter", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: C.muted, fontFamily: "Inter", fontSize: 12 }}>Loading...</div>;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 600 }}>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "Orbitron", fontSize: 11, color: C.cyan, letterSpacing: "0.18em", marginBottom: 4 }}>NAV MANAGER</div>
          <div style={{ fontFamily: "Inter", fontSize: 12, color: C.muted }}>Control trainee sidebar navigation</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowAdd(v => !v)} style={{ padding: "8px 14px", background: "rgba(0,174,239,0.1)", border: "1px solid rgba(0,174,239,0.3)", borderRadius: 8, color: C.cyan, fontFamily: "Inter", fontSize: 11, cursor: "pointer" }}>+ Add</button>
          <button onClick={saveAll} disabled={saving} style={{ padding: "8px 14px", background: saving ? "rgba(0,255,136,0.05)" : "rgba(0,255,136,0.15)", border: `1px solid ${C.primary}40`, borderRadius: 8, color: C.primary, fontFamily: "Inter", fontSize: 11, cursor: "pointer" }}>{saved ? "✓ Saved" : saving ? "Saving..." : "Save All"}</button>
        </div>
      </div>

      {showAdd && (
        <div style={{ background: "rgba(0,174,239,0.06)", border: "1px solid rgba(0,174,239,0.2)", borderRadius: 12, padding: "16px", marginBottom: 16 }}>
          <div style={{ fontFamily: "Orbitron", fontSize: 10, color: C.cyan, letterSpacing: "0.15em", marginBottom: 12 }}>NEW ITEM</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div><div style={{ fontFamily: "Inter", fontSize: 10, color: C.muted, marginBottom: 4 }}>LABEL</div><input value={newItem.label} onChange={e => setNewItem(p => ({ ...p, label: e.target.value }))} placeholder="My Page" style={inp} /></div>
            <div><div style={{ fontFamily: "Inter", fontSize: 10, color: C.muted, marginBottom: 4 }}>PATH</div><input value={newItem.href} onChange={e => setNewItem(p => ({ ...p, href: e.target.value }))} placeholder="/my-page" style={inp} /></div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: "Inter", fontSize: 10, color: C.muted, marginBottom: 4 }}>ICON</div>
            <select value={newItem.icon} onChange={e => setNewItem(p => ({ ...p, icon: e.target.value }))} style={{ ...inp }}>
              {ICONS.map(ic => <option key={ic} value={ic}>{ICON_EMOJI[ic] ?? "•"} {ic}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setShowAdd(false)} style={{ padding: "6px 14px", background: "none", border: "none", color: C.muted, fontFamily: "Inter", fontSize: 11, cursor: "pointer" }}>Cancel</button>
            <button onClick={addItem} style={{ padding: "6px 14px", background: "rgba(0,255,136,0.15)", border: `1px solid ${C.primary}40`, borderRadius: 8, color: C.primary, fontFamily: "Inter", fontSize: 11, cursor: "pointer" }}>Add</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item, idx) => (
          <div key={item.id}
            draggable onDragStart={() => setDragging(item.id)}
            onDragOver={e => { e.preventDefault(); if (dragging === null || dragging === item.id) return; setItems(prev => { const a = [...prev]; const fi = a.findIndex(x => x.id === dragging); const ti = a.findIndex(x => x.id === item.id); if (fi === -1 || ti === -1) return prev; const [m] = a.splice(fi, 1); a.splice(ti, 0, m); return a.map((x, i) => ({ ...x, order: i+1 })); }); }}
            onDragEnd={() => setDragging(null)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: item.isVisible ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)", border: `1px solid ${item.isVisible ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)"}`, borderRadius: 10, opacity: item.isVisible ? 1 : 0.45, cursor: "grab" }}>
            <span style={{ color: C.muted, fontSize: 14 }}>⠿</span>
            <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{ICON_EMOJI[item.icon] ?? "•"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600, color: "#fff" }}>{item.label}</div>
              <div style={{ fontFamily: "Inter", fontSize: 10, color: C.muted }}>{item.href} · {item.icon}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => moveUp(idx)} disabled={idx === 0} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, opacity: idx === 0 ? 0.2 : 1 }}>▲</button>
              <button onClick={() => moveDown(idx)} disabled={idx === items.length-1} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, opacity: idx === items.length-1 ? 0.2 : 1 }}>▼</button>
              <button onClick={() => toggle(item.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }} title={item.isVisible ? "Hide" : "Show"}>{item.isVisible ? "👁️" : "🚫"}</button>
              <button onClick={() => deleteItem(item.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 13 }}>🗑</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, textAlign: "center", fontFamily: "Inter", fontSize: 10, color: C.muted }}>
        {items.filter(i => i.isVisible).length} of {items.length} items visible to trainees
      </div>
    </div>
  );
}

// ─── Simulator Admin ──────────────────────────────────────────────────────────
function SimulatorAdmin({ adminPw }: { adminPw: string }) {
  type SimTab = "overview" | "preview" | "config" | "live" | "scenarios" | "broadcast" | "stats" | "reports" | "chat";
  const [tab, setTab] = React.useState<SimTab>("overview");
  const [cfg, setCfg] = React.useState<Record<string, string>>({});
  const [live, setLive] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState<any>(null);
  const [scenarios, setScenarios] = React.useState<any[]>([]);
  const [broadcasts, setBroadcasts] = React.useState<any[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [newScenario, setNewScenario] = React.useState({ name: "", description: "", aircraft_count: 3, speed_multiplier: 1.0, weather: "clear", wind_speed: 0, wind_direction: 0, difficulty: "medium", pass_score: 70 });
  const [showNewScenario, setShowNewScenario] = React.useState(false);
  const [bcastMsg, setBcastMsg] = React.useState("");
  const [bcastType, setBcastType] = React.useState("info");
  const [bcastDur, setBcastDur] = React.useState("30");
  const [bcastSending, setBcastSending] = React.useState(false);

  const H = { "x-admin-password": adminPw };

  const load = React.useCallback(async () => {
    const [c, l, s, sc, b] = await Promise.all([
      fetch('/api/admin/simulator/config', { headers: H }).then(r => r.json()).catch(() => ({})),
      fetch('/api/admin/simulator/live', { headers: H }).then(r => r.json()).catch(() => []),
      fetch('/api/admin/simulator/stats', { headers: H }).then(r => r.json()).catch(() => null),
      fetch('/api/admin/simulator/scenarios', { headers: H }).then(r => r.json()).catch(() => []),
      fetch('/api/admin/simulator/broadcasts', { headers: H }).then(r => r.json()).catch(() => []),
    ]);
    setCfg(c); setLive(Array.isArray(l) ? l : []); setStats(s);
    setScenarios(Array.isArray(sc) ? sc : []); setBroadcasts(Array.isArray(b) ? b : []);
  }, [adminPw]);

  React.useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const saveConfig = async () => {
    setSaving(true);
    await fetch('/api/admin/simulator/config', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const sendBroadcast = async () => {
    if (!bcastMsg.trim()) return;
    setBcastSending(true);
    await fetch('/api/admin/simulator/broadcast', {
      method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: bcastMsg, type: bcastType, duration_minutes: Number(bcastDur) || null }),
    });
    setBcastMsg(""); setBcastSending(false); load();
  };

  const deleteBroadcast = async (id: number) => {
    await fetch(`/api/admin/simulator/broadcast/${id}`, { method: 'DELETE', headers: H });
    load();
  };

  const addScenario = async () => {
    if (!newScenario.name.trim()) return;
    await fetch('/api/admin/simulator/scenarios', {
      method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify(newScenario),
    });
    setShowNewScenario(false); setNewScenario({ name: "", description: "", aircraft_count: 3, speed_multiplier: 1.0, weather: "clear", wind_speed: 0, wind_direction: 0, difficulty: "medium", pass_score: 70 });
    load();
  };

  const deleteScenario = async (id: number) => {
    await fetch(`/api/admin/simulator/scenarios/${id}`, { method: 'DELETE', headers: H });
    load();
  };

  const toggleEnabled = async () => {
    const next = cfg.enabled === 'true' ? 'false' : 'true';
    await fetch('/api/admin/simulator/config', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: next }) });
    setCfg(prev => ({ ...prev, enabled: next }));
  };

  // ── Chat state ──
  const [chatTrainees, setChatTrainees] = React.useState<any[]>([]);
  const [selectedChatTrainee, setSelectedChatTrainee] = React.useState<string | null>(null);
  const [chatMsgs, setChatMsgs] = React.useState<any[]>([]);
  const [chatInput, setChatInput] = React.useState("");
  const [chatSending, setChatSending] = React.useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  const loadChatTrainees = React.useCallback(async () => {
    const r = await fetch('/api/admin/simulator/stats', { headers: H }).then(x => x.json()).catch(() => null);
    if (r?.byTrainee) setChatTrainees(r.byTrainee);
  }, [adminPw]);

  const loadChatMsgs = React.useCallback(async (tid: string) => {
    const r = await fetch(`/api/simulator/messages?trainee_id=${tid}`, { headers: H }).then(x => x.json()).catch(() => []);
    setChatMsgs(Array.isArray(r) ? r : []);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [adminPw]);

  React.useEffect(() => {
    if (tab !== "chat") return;
    loadChatTrainees();
    const t = setInterval(loadChatTrainees, 10000);
    return () => clearInterval(t);
  }, [tab, loadChatTrainees]);

  React.useEffect(() => {
    if (!selectedChatTrainee) return;
    loadChatMsgs(selectedChatTrainee);
    const t = setInterval(() => loadChatMsgs(selectedChatTrainee), 5000);
    return () => clearInterval(t);
  }, [selectedChatTrainee, loadChatMsgs]);

  const sendChatReply = async () => {
    if (!chatInput.trim() || !selectedChatTrainee) return;
    setChatSending(true);
    await fetch('/api/admin/simulator/messages', {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trainee_id: selectedChatTrainee, text: chatInput.trim() }),
    });
    setChatInput("");
    setChatSending(false);
    loadChatMsgs(selectedChatTrainee);
  };

  const SIM_TABS: { id: SimTab; label: string; icon: string }[] = [
    { id: "overview",  label: "Overview",   icon: "⚡" },
    { id: "preview",   label: "Simulator",  icon: "🖥️" },
    { id: "config",    label: "Config",     icon: "⚙️" },
    { id: "live",      label: "Live",       icon: "📡" },
    { id: "scenarios", label: "Scenarios",  icon: "🗂️" },
    { id: "broadcast", label: "Broadcast",  icon: "📢" },
    { id: "chat",      label: "Chat",       icon: "💬" },
    { id: "stats",     label: "Stats",      icon: "📊" },
    { id: "reports",   label: "Reports",    icon: "📥" },
  ];

  const card: React.CSSProperties = { background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 12, padding: "16px" };
  const inp: React.CSSProperties = { width: "100%", padding: "8px 12px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "Inter", outline: "none", boxSizing: "border-box" as const };
  const btn: React.CSSProperties = { padding: "8px 16px", background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.35)", borderRadius: 8, color: "#00FF88", fontFamily: "Inter", fontSize: 11, letterSpacing: "0.08em", cursor: "pointer" };
  const lbl: React.CSSProperties = { fontSize: 10, color: "rgba(0,255,136,0.6)", fontFamily: "Inter", marginBottom: 4, display: "block" };

  const fmtDur = (ms: number) => { if (!ms) return "—"; const m = Math.floor(ms / 60000); if (m < 60) return `${m}m`; return `${Math.floor(m/60)}h ${m%60}m`; };
  const fmtTime = (ts: number) => { if (!ts) return "—"; const d = new Date(ts); return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); };

  return (
    <div style={{ background: "#030d03", minHeight: "100vh", color: "#fff", fontFamily: "Inter" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(0,255,136,0.15)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "Orbitron, monospace", fontSize: 14, color: "#00FF88", letterSpacing: "0.12em" }}>SIMULATOR CONTROL</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Full admin control over TLS simulator</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            padding: "6px 14px", borderRadius: 20,
            background: cfg.enabled === 'true' ? "rgba(0,255,136,0.12)" : "rgba(255,68,68,0.12)",
            border: `1px solid ${cfg.enabled === 'true' ? "rgba(0,255,136,0.4)" : "rgba(255,68,68,0.4)"}`,
            color: cfg.enabled === 'true' ? "#00FF88" : "#FF4444",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
          }}>{cfg.enabled === 'true' ? "● ONLINE" : "● OFFLINE"}</div>
          <button onClick={toggleEnabled} style={{
            ...btn,
            background: cfg.enabled === 'true' ? "rgba(255,68,68,0.1)" : "rgba(0,255,136,0.1)",
            border: `1px solid ${cfg.enabled === 'true' ? "rgba(255,68,68,0.4)" : "rgba(0,255,136,0.4)"}`,
            color: cfg.enabled === 'true' ? "#FF4444" : "#00FF88",
          }}>{cfg.enabled === 'true' ? "⛔ DISABLE" : "▶ ENABLE"}</button>
          <button onClick={() => setTab("preview")} style={{ ...btn }}>🖥️ OPEN SIM</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(0,255,136,0.1)", overflowX: "auto" as const }}>
        {SIM_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 18px", background: "none", border: "none",
            borderBottom: tab === t.id ? "2px solid #00FF88" : "2px solid transparent",
            color: tab === t.id ? "#00FF88" : "rgba(255,255,255,0.4)",
            fontSize: 11, fontFamily: "Inter", letterSpacing: "0.08em",
            cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0,
          }}>{t.icon} {t.label.toUpperCase()}{t.id === "live" && live.length > 0 ? ` (${live.length})` : ""}</button>
        ))}
      </div>

      {/* ── PREVIEW (fullscreen iframe, outside padded wrapper) ── */}
      {tab === "preview" && (
        <div style={{ position: "relative", width: "100%", height: "calc(100vh - 130px)", background: "#020602" }}>
          <iframe
            key="sim-admin-preview"
            src="/simulator_tls.html"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            title="Simulator Admin Preview"
          />
        </div>
      )}

      <div style={{ padding: "20px 24px", maxWidth: 1100, display: tab === "preview" ? "none" : undefined }}>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* KPI row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              {[
                { label: "LIVE USERS", value: live.length, color: live.length > 0 ? "#00FF88" : "rgba(255,255,255,0.4)" },
                { label: "TOTAL SESSIONS", value: stats?.totals?.total_sessions ?? "…", color: "#00FF88" },
                { label: "PASS RATE", value: stats?.totals?.total_sessions > 0 ? `${Math.round((stats.totals.passed_count / stats.totals.total_sessions) * 100)}%` : "—", color: "#FFD700" },
                { label: "AVG DURATION", value: fmtDur(stats?.totals?.avg_duration), color: "#00FF88" },
                { label: "DEFAULT MODE", value: cfg.default_mode ?? "PAR", color: "#00FF88" },
                { label: "AIRCRAFT COUNT", value: cfg.aircraft_count ?? "3", color: "#00FF88" },
              ].map(k => (
                <div key={k.label} style={{ ...card, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 6, letterSpacing: "0.1em" }}>{k.label}</div>
                  <div style={{ fontSize: 24, fontFamily: "Orbitron, monospace", color: k.color, fontWeight: 700 }}>{k.value}</div>
                </div>
              ))}
            </div>
            {/* Live users mini table */}
            {live.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 11, color: "#00FF88", fontFamily: "Orbitron, monospace", marginBottom: 12, letterSpacing: "0.1em" }}>● ACTIVE SESSIONS</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ color: "rgba(255,255,255,0.35)" }}>
                      {["Trainee", "Mode", "Scenario", "Started", "Online"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "4px 8px", fontWeight: 400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {live.map((s: any) => (
                      <tr key={s.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "6px 8px", color: "#fff" }}>{s.trainee_name ?? s.trainee_id}</td>
                        <td style={{ padding: "6px 8px", color: "#00FF88" }}>{s.mode}</td>
                        <td style={{ padding: "6px 8px", color: "rgba(255,255,255,0.5)" }}>{s.scenario_name ?? "Free"}</td>
                        <td style={{ padding: "6px 8px", color: "rgba(255,255,255,0.5)" }}>{fmtTime(s.started_at)}</td>
                        <td style={{ padding: "6px 8px" }}><span style={{ color: s.is_online ? "#00FF88" : "#FF4444" }}>{s.is_online ? "●" : "○"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Recent broadcasts */}
            {broadcasts.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 11, color: "#00FF88", fontFamily: "Orbitron, monospace", marginBottom: 12, letterSpacing: "0.1em" }}>📢 ACTIVE BROADCASTS</div>
                {broadcasts.slice(0, 3).map((b: any) => (
                  <div key={b.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ fontSize: 14 }}>{b.type === "warning" ? "⚠️" : b.type === "danger" ? "🚨" : b.type === "success" ? "✅" : "ℹ️"}</span>
                    <span style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{b.message}</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{fmtTime(b.created_at)}</span>
                    <button onClick={() => deleteBroadcast(b.id)} style={{ background: "none", border: "none", color: "#FF4444", cursor: "pointer", fontSize: 12 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CONFIG ── */}
        {tab === "config" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={card}>
              <div style={{ fontSize: 11, color: "#00FF88", fontFamily: "Orbitron, monospace", marginBottom: 16, letterSpacing: "0.1em" }}>⚙️ SIMULATOR SETTINGS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <div>
                  <label style={lbl}>DEFAULT MODE</label>
                  <select value={cfg.default_mode ?? "PAR"} onChange={e => setCfg(p => ({ ...p, default_mode: e.target.value }))} style={{ ...inp }}>
                    <option value="PAR">PAR</option>
                    <option value="SURVEILLANCE">SURVEILLANCE</option>
                    <option value="SPLIT">SPLIT</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>AIRCRAFT COUNT</label>
                  <input type="number" min={1} max={12} value={cfg.aircraft_count ?? "3"} onChange={e => setCfg(p => ({ ...p, aircraft_count: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>SPEED MULTIPLIER</label>
                  <input type="number" min={0.1} max={5} step={0.1} value={cfg.speed_multiplier ?? "1.0"} onChange={e => setCfg(p => ({ ...p, speed_multiplier: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>WEATHER</label>
                  <select value={cfg.weather ?? "clear"} onChange={e => setCfg(p => ({ ...p, weather: e.target.value }))} style={inp}>
                    <option value="clear">Clear</option>
                    <option value="light_rain">Light Rain</option>
                    <option value="heavy_rain">Heavy Rain</option>
                    <option value="fog">Fog</option>
                    <option value="storm">Storm</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>WIND SPEED (knots)</label>
                  <input type="number" min={0} max={60} value={cfg.wind_speed ?? "0"} onChange={e => setCfg(p => ({ ...p, wind_speed: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>WIND DIRECTION (°)</label>
                  <input type="number" min={0} max={360} value={cfg.wind_direction ?? "0"} onChange={e => setCfg(p => ({ ...p, wind_direction: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>DIFFICULTY</label>
                  <select value={cfg.difficulty ?? "medium"} onChange={e => setCfg(p => ({ ...p, difficulty: e.target.value }))} style={inp}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>PASS SCORE (%)</label>
                  <input type="number" min={0} max={100} value={cfg.pass_score ?? "70"} onChange={e => setCfg(p => ({ ...p, pass_score: e.target.value }))} style={inp} />
                </div>
              </div>
              <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={saveConfig} disabled={saving} style={{ ...btn, opacity: saving ? 0.6 : 1 }}>
                  {saving ? "SAVING…" : "💾 SAVE CONFIG"}
                </button>
                {saved && <span style={{ fontSize: 11, color: "#00FF88" }}>✓ Saved</span>}
              </div>
            </div>
            <div style={{ ...card, background: "rgba(255,140,0,0.04)", border: "1px solid rgba(255,140,0,0.2)" }}>
              <div style={{ fontSize: 10, color: "#FF8C00", fontFamily: "Inter", lineHeight: 1.6 }}>
                ⚠️ Config changes take effect on the trainee's <strong>next simulator load</strong>. Active sessions are not affected in real-time — use Broadcast to notify trainees.
              </div>
            </div>
          </div>
        )}

        {/* ── LIVE ── */}
        {tab === "live" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Auto-refreshes every 10s • {fmtTime(Date.now())}</div>
              <button onClick={load} style={btn}>🔄 REFRESH</button>
            </div>
            {live.length === 0 ? (
              <div style={{ ...card, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13, padding: 40 }}>No active simulator sessions</div>
            ) : (
              <div style={card}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      {["#", "Trainee", "Mode", "Scenario", "Started", "Duration", "Status"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 400, fontSize: 10, letterSpacing: "0.08em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {live.map((s: any, i: number) => (
                      <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "8px 10px", color: "rgba(255,255,255,0.3)" }}>{i + 1}</td>
                        <td style={{ padding: "8px 10px", color: "#fff", fontWeight: 600 }}>{s.trainee_name ?? s.trainee_id}</td>
                        <td style={{ padding: "8px 10px" }}><span style={{ background: "rgba(0,255,136,0.1)", color: "#00FF88", padding: "2px 8px", borderRadius: 4, fontSize: 10 }}>{s.mode}</span></td>
                        <td style={{ padding: "8px 10px", color: "rgba(255,255,255,0.5)" }}>{s.scenario_name ?? "Free Run"}</td>
                        <td style={{ padding: "8px 10px", color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{fmtTime(s.started_at)}</td>
                        <td style={{ padding: "8px 10px", color: "#00FF88" }}>{fmtDur(Date.now() - s.started_at)}</td>
                        <td style={{ padding: "8px 10px" }}><span style={{ color: s.is_online ? "#00FF88" : "#FF4444", fontSize: 10 }}>{s.is_online ? "● ONLINE" : "○ AWAY"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── SCENARIOS ── */}
        {tab === "scenarios" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setShowNewScenario(v => !v)} style={btn}>+ NEW SCENARIO</button>
            </div>
            {showNewScenario && (
              <div style={card}>
                <div style={{ fontSize: 11, color: "#00FF88", marginBottom: 14, fontFamily: "Orbitron, monospace" }}>NEW SCENARIO</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <div style={{ gridColumn: "1/-1" }}>
                    <label style={lbl}>SCENARIO NAME *</label>
                    <input value={newScenario.name} onChange={e => setNewScenario(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Night ILS Approach" style={inp} />
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <label style={lbl}>DESCRIPTION</label>
                    <input value={newScenario.description} onChange={e => setNewScenario(p => ({ ...p, description: e.target.value }))} placeholder="Brief description…" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>AIRCRAFT COUNT</label>
                    <input type="number" min={1} max={12} value={newScenario.aircraft_count} onChange={e => setNewScenario(p => ({ ...p, aircraft_count: Number(e.target.value) }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>SPEED MULTIPLIER</label>
                    <input type="number" min={0.1} max={5} step={0.1} value={newScenario.speed_multiplier} onChange={e => setNewScenario(p => ({ ...p, speed_multiplier: Number(e.target.value) }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>WEATHER</label>
                    <select value={newScenario.weather} onChange={e => setNewScenario(p => ({ ...p, weather: e.target.value }))} style={inp}>
                      <option value="clear">Clear</option><option value="light_rain">Light Rain</option>
                      <option value="heavy_rain">Heavy Rain</option><option value="fog">Fog</option><option value="storm">Storm</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>WIND SPEED (kts)</label>
                    <input type="number" min={0} max={60} value={newScenario.wind_speed} onChange={e => setNewScenario(p => ({ ...p, wind_speed: Number(e.target.value) }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>WIND DIRECTION (°)</label>
                    <input type="number" min={0} max={360} value={newScenario.wind_direction} onChange={e => setNewScenario(p => ({ ...p, wind_direction: Number(e.target.value) }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>DIFFICULTY</label>
                    <select value={newScenario.difficulty} onChange={e => setNewScenario(p => ({ ...p, difficulty: e.target.value }))} style={inp}>
                      <option value="easy">Easy</option><option value="medium">Medium</option>
                      <option value="hard">Hard</option><option value="expert">Expert</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>PASS SCORE (%)</label>
                    <input type="number" min={0} max={100} value={newScenario.pass_score} onChange={e => setNewScenario(p => ({ ...p, pass_score: Number(e.target.value) }))} style={inp} />
                  </div>
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                  <button onClick={addScenario} style={btn}>✓ CREATE</button>
                  <button onClick={() => setShowNewScenario(false)} style={{ ...btn, color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.15)" }}>CANCEL</button>
                </div>
              </div>
            )}
            {scenarios.length === 0 ? (
              <div style={{ ...card, textAlign: "center", color: "rgba(255,255,255,0.25)", padding: 40, fontSize: 13 }}>No scenarios yet — create one above</div>
            ) : scenarios.map((s: any) => (
              <div key={s.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>{s.name}</span>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: s.difficulty === "hard" || s.difficulty === "expert" ? "rgba(255,68,68,0.15)" : "rgba(0,255,136,0.1)", color: s.difficulty === "hard" || s.difficulty === "expert" ? "#FF4444" : "#00FF88" }}>{s.difficulty?.toUpperCase()}</span>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: s.active ? "#00FF88" : "rgba(255,255,255,0.3)" }}>{s.active ? "ACTIVE" : "INACTIVE"}</span>
                    </div>
                    {s.description && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>{s.description}</div>}
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 16, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                      <span>✈️ {s.aircraft_count} aircraft</span>
                      <span>🌤 {s.weather?.replace('_', ' ')}</span>
                      <span>💨 {s.wind_speed}kts @ {s.wind_direction}°</span>
                      <span>⚡ ×{s.speed_multiplier}</span>
                      <span>🎯 Pass: {s.pass_score}%</span>
                    </div>
                  </div>
                  <button onClick={() => deleteScenario(s.id)} style={{ background: "none", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 6, color: "#FF4444", cursor: "pointer", padding: "4px 10px", fontSize: 11, flexShrink: 0 }}>DELETE</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── BROADCAST ── */}
        {tab === "broadcast" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={card}>
              <div style={{ fontSize: 11, color: "#00FF88", fontFamily: "Orbitron, monospace", marginBottom: 14, letterSpacing: "0.1em" }}>📢 BROADCAST MESSAGE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={lbl}>MESSAGE</label>
                  <textarea value={bcastMsg} onChange={e => setBcastMsg(e.target.value)} placeholder="Type your message to all trainees currently in simulator…" rows={3}
                    style={{ ...inp, resize: "vertical" as const, fontFamily: "Inter" }} />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>TYPE</label>
                    <select value={bcastType} onChange={e => setBcastType(e.target.value)} style={inp}>
                      <option value="info">ℹ️ Info</option>
                      <option value="warning">⚠️ Warning</option>
                      <option value="danger">🚨 Danger</option>
                      <option value="success">✅ Success</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>DURATION (minutes, 0=permanent)</label>
                    <input type="number" min={0} value={bcastDur} onChange={e => setBcastDur(e.target.value)} style={inp} />
                  </div>
                </div>
                <button onClick={sendBroadcast} disabled={bcastSending || !bcastMsg.trim()} style={{ ...btn, opacity: (!bcastMsg.trim() || bcastSending) ? 0.5 : 1, alignSelf: "flex-start" }}>
                  {bcastSending ? "SENDING…" : "📢 BROADCAST"}
                </button>
              </div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 11, color: "#00FF88", fontFamily: "Orbitron, monospace", marginBottom: 12, letterSpacing: "0.1em" }}>RECENT BROADCASTS</div>
              {broadcasts.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", padding: 20, fontSize: 12 }}>No broadcasts yet</div>
              ) : broadcasts.map((b: any) => (
                <div key={b.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{b.type === "warning" ? "⚠️" : b.type === "danger" ? "🚨" : b.type === "success" ? "✅" : "ℹ️"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "#fff", marginBottom: 2 }}>{b.message}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{fmtTime(b.created_at)}{b.expires_at ? ` · expires ${fmtTime(b.expires_at)}` : " · permanent"}</div>
                  </div>
                  <button onClick={() => deleteBroadcast(b.id)} style={{ background: "none", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 6, color: "#FF4444", cursor: "pointer", padding: "4px 10px", fontSize: 11, flexShrink: 0 }}>DELETE</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STATS ── */}
        {tab === "stats" && stats && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* By mode */}
            <div style={card}>
              <div style={{ fontSize: 11, color: "#00FF88", fontFamily: "Orbitron, monospace", marginBottom: 12, letterSpacing: "0.1em" }}>SESSIONS BY MODE</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" as const }}>
                {(stats.byMode ?? []).map((m: any) => (
                  <div key={m.mode} style={{ textAlign: "center", minWidth: 80 }}>
                    <div style={{ fontSize: 22, fontFamily: "Orbitron, monospace", color: "#00FF88", fontWeight: 700 }}>{m.cnt}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{m.mode}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Per trainee */}
            <div style={card}>
              <div style={{ fontSize: 11, color: "#00FF88", fontFamily: "Orbitron, monospace", marginBottom: 12, letterSpacing: "0.1em" }}>PER-TRAINEE STATS</div>
              <div style={{ overflowX: "auto" as const }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      {["Trainee", "Sessions", "Avg Score", "Pass Rate", "Total Time", "Last Active"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontWeight: 400, fontSize: 10, letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.byTrainee ?? []).map((t: any) => (
                      <tr key={t.trainee_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "7px 10px", color: "#fff", fontWeight: 600 }}>{t.trainee_name ?? t.trainee_id}</td>
                        <td style={{ padding: "7px 10px", color: "#00FF88" }}>{t.sessions}</td>
                        <td style={{ padding: "7px 10px", color: t.avg_score >= 70 ? "#00FF88" : "#FF4444" }}>{t.avg_score != null ? `${Math.round(t.avg_score)}%` : "—"}</td>
                        <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.6)" }}>{t.sessions > 0 ? `${Math.round((t.passed / t.sessions) * 100)}%` : "—"}</td>
                        <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.6)" }}>{fmtDur(t.total_ms)}</td>
                        <td style={{ padding: "7px 10px", color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{fmtTime(t.last_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Recent sessions */}
            <div style={card}>
              <div style={{ fontSize: 11, color: "#00FF88", fontFamily: "Orbitron, monospace", marginBottom: 12, letterSpacing: "0.1em" }}>RECENT SESSIONS</div>
              <div style={{ overflowX: "auto" as const }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      {["Trainee", "Mode", "Scenario", "Score", "Result", "Duration", "Date"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontWeight: 400, fontSize: 10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.recent ?? []).map((r: any) => (
                      <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "6px 10px", color: "#fff" }}>{r.trainee_name}</td>
                        <td style={{ padding: "6px 10px", color: "#00FF88", fontSize: 10 }}>{r.mode}</td>
                        <td style={{ padding: "6px 10px", color: "rgba(255,255,255,0.4)" }}>{r.scenario_name ?? "Free"}</td>
                        <td style={{ padding: "6px 10px", color: r.score >= 70 ? "#00FF88" : "#FF4444" }}>{r.score != null ? `${r.score}%` : "—"}</td>
                        <td style={{ padding: "6px 10px" }}><span style={{ color: r.passed ? "#00FF88" : "#FF4444", fontWeight: 700, fontSize: 10 }}>{r.passed ? "PASS" : "FAIL"}</span></td>
                        <td style={{ padding: "6px 10px", color: "rgba(255,255,255,0.4)" }}>{fmtDur(r.duration_ms)}</td>
                        <td style={{ padding: "6px 10px", color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{fmtTime(r.started_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CHAT ── */}
        {tab === "chat" && (
          <div style={{ display: "flex", gap: 16, height: "calc(100vh - 180px)", minHeight: 400 }}>
            {/* Trainee list */}
            <div style={{ ...card, width: 200, flexShrink: 0, overflowY: "auto" as const, padding: 0 }}>
              <div style={{ padding: "10px 14px", fontSize: 10, color: "rgba(0,255,136,0.6)", fontFamily: "Orbitron, monospace", letterSpacing: "0.1em", borderBottom: "1px solid rgba(0,255,136,0.1)" }}>TRAINEES</div>
              {chatTrainees.length === 0 ? (
                <div style={{ padding: 16, fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>No trainees yet</div>
              ) : chatTrainees.map((t: any) => (
                <div key={t.trainee_id} onClick={() => setSelectedChatTrainee(t.trainee_id)}
                  style={{
                    padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: selectedChatTrainee === t.trainee_id ? "rgba(0,255,136,0.08)" : "none",
                    borderLeft: selectedChatTrainee === t.trainee_id ? "2px solid #00FF88" : "2px solid transparent",
                  }}>
                  <div style={{ fontSize: 12, color: "#fff", fontWeight: selectedChatTrainee === t.trainee_id ? 600 : 400 }}>{t.trainee_name ?? t.trainee_id}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{t.sessions} session{t.sessions !== 1 ? "s" : ""}</div>
                </div>
              ))}
            </div>
            {/* Chat window */}
            <div style={{ ...card, flex: 1, display: "flex", flexDirection: "column" as const, padding: 0, overflow: "hidden" }}>
              {!selectedChatTrainee ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>← Select a trainee to chat</div>
              ) : (
                <>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(0,255,136,0.1)", fontSize: 11, color: "#00FF88", fontFamily: "Orbitron, monospace", letterSpacing: "0.08em" }}>
                    {chatTrainees.find(t => t.trainee_id === selectedChatTrainee)?.trainee_name ?? selectedChatTrainee}
                  </div>
                  <div style={{ flex: 1, overflowY: "auto" as const, padding: "14px 16px", display: "flex", flexDirection: "column" as const, gap: 8 }}>
                    {chatMsgs.length === 0 && (
                      <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 12, marginTop: 40 }}>No messages yet</div>
                    )}
                    {chatMsgs.map((m: any) => (
                      <div key={m.id} style={{ display: "flex", flexDirection: "column" as const, alignItems: m.sender_role === "admin" ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "75%", padding: "8px 12px", borderRadius: 10,
                          background: m.sender_role === "admin" ? "rgba(0,255,136,0.12)" : "rgba(255,255,255,0.07)",
                          border: `1px solid ${m.sender_role === "admin" ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.1)"}`,
                          fontSize: 12, color: "#fff", lineHeight: 1.5,
                        }}>{m.text}</div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
                          {m.sender_role === "admin" ? "Instructor" : "Trainee"} · {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(0,255,136,0.1)", display: "flex", gap: 8 }}>
                    <input
                      value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatReply(); } }}
                      placeholder="Type instructor message… (Enter to send)"
                      style={{ flex: 1, padding: "8px 12px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "Inter", outline: "none" }}
                    />
                    <button onClick={sendChatReply} disabled={chatSending || !chatInput.trim()}
                      style={{ ...btn, opacity: (chatSending || !chatInput.trim()) ? 0.5 : 1, flexShrink: 0 }}>
                      {chatSending ? "…" : "SEND"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── REPORTS ── */}
        {tab === "reports" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={card}>
              <div style={{ fontSize: 11, color: "#00FF88", fontFamily: "Orbitron, monospace", marginBottom: 12, letterSpacing: "0.1em" }}>📥 EXPORT TRAINING REPORT</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 16, lineHeight: 1.6 }}>
                Download a full CSV report of all simulator sessions — trainee name, mode, scenario, score, pass/fail, duration, and date.
              </div>
              <button
                style={{ ...btn, cursor: "pointer" }}
                onClick={async () => {
                  const res = await fetch('/api/admin/simulator/export', { headers: { 'x-admin-password': adminPw } });
                  if (!res.ok) { alert('Export failed: ' + (await res.text())); return; }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'simulator-report.xlsx'; a.click();
                  URL.revokeObjectURL(url);
                }}
              >📥 DOWNLOAD EXCEL REPORT</button>
            </div>
            <div style={{ ...card, background: "rgba(0,255,136,0.02)" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", lineHeight: 1.7 }}>
                Excel report includes: Trainee ID · Trainee Name · Mode · Scenario · Difficulty · Score · Passed · Started · Duration · Callsign · Altitude · Heading · Localizer Entry · GS Entry · Touchdown
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin Nav Items ──────────────────────────────────────────────────────────
// ADMIN_NAV kept for type reference only — navigation is entirely via ☰ MENU dropdown
const ADMIN_NAV = [] as const;

const NAV_LINKS = [
  { id: "dashboard",     label: "Dashboard",      icon: "⚡", divider: false },
  { id: "trainees",      label: "Trainees",       icon: "👥", divider: false },
  { id: "reports",       label: "Reports",        icon: "📊", divider: false },
  { id: "settings",      label: "Settings",       icon: "⚙️", divider: true  },
  { id: "basics",        label: "TLS Basic",      icon: "📘", divider: false },
  { id: "advanced",      label: "TLS Advanced",   icon: "⭐", divider: false },
  { id: "quiz",          label: "Quiz",           icon: "🎯", divider: false },
  { id: "chat",          label: "Chat",           icon: "💬", divider: false },
  { id: "status",        label: "System Status",  icon: "📶", divider: false },
  { id: "notifications", label: "Notifications",  icon: "🔔", divider: false },
  { id: "about",         label: "About",          icon: "ℹ️", divider: false },
  { id: "documents",     label: "Documents",      icon: "📄", divider: false },
  { id: "common_faults",  label: "Common Faults",  icon: "⚠️", divider: false },
  { id: "simulator",      label: "Simulator",      icon: "🛩️", divider: false },
  { id: "nav_manager",   label: "Nav Manager",    icon: "🗂️", divider: true  },
] as const;

type AdminView = "dashboard" | "trainees" | "reports" | "settings"
  | "basics" | "advanced" | "quiz" | "chat" | "status" | "notifications" | "about" | "documents" | "common_faults" | "simulator" | "nav_manager";

// ─── Admin Password Change ────────────────────────────────────────────────────
function AdminPasswordChange({ adminPw }: { adminPw: string }) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!oldPw || !newPw) { setStatus({ ok: false, msg: "Fill all fields." }); return; }
    if (newPw !== confirm) { setStatus({ ok: false, msg: "Passwords don't match." }); return; }
    if (oldPw !== adminPw) { setStatus({ ok: false, msg: "Current password incorrect." }); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPw },
        body: JSON.stringify({ newPassword: newPw }),
      });
      if (res.ok) {
        setStatus({ ok: true, msg: "Password changed. Re-login required." });
        setOldPw(""); setNewPw(""); setConfirm("");
      } else {
        setStatus({ ok: false, msg: "Failed to update password." });
      }
    } catch { setStatus({ ok: false, msg: "Network error." }); }
    finally { setBusy(false); }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", background: "rgba(0,255,136,0.04)",
    border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8,
    color: "#fff", fontSize: 12, fontFamily: "Inter", outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ marginBottom: 16, padding: "16px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 12 }}>
      <div style={{ fontFamily: "Orbitron, monospace", fontSize: 10, color: "rgba(0,255,136,0.6)", marginBottom: 12 }}>CHANGE ADMIN PASSWORD</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input type="password" placeholder="Current password" value={oldPw} onChange={e => setOldPw(e.target.value)} style={inp} />
        <input type="password" placeholder="New password" value={newPw} onChange={e => setNewPw(e.target.value)} style={inp} />
        <input type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} style={inp} />
        <button onClick={submit} disabled={busy} style={{
          padding: "9px", background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.35)",
          borderRadius: 8, color: "#00FF88", fontSize: 11, fontFamily: "Inter", cursor: "pointer",
        }}>{busy ? "Updating…" : "Update Password"}</button>
        {status && <div style={{ fontSize: 11, color: status.ok ? "#00FF88" : "#FF4444", fontFamily: "Inter" }}>{status.msg}</div>}
      </div>
    </div>
  );
}

// ─── Admin Private Chat List ──────────────────────────────────────────────────
function AdminPrivateChatList({ adminPw }: { adminPw: string }) {
  const [trainees, setTrainees] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/trainees", { headers: { "x-admin-password": adminPw } })
      .then(r => r.json())
      .then((data: any[]) => setTrainees(data.map(t => ({ id: t.id, name: t.name }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [adminPw]);

  if (selected) {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          style={{ margin: "12px 16px", padding: "6px 12px", background: "rgba(0,255,136,0.07)", border: "1px solid rgba(0,255,136,0.25)", borderRadius: 8, color: "#00FF88", fontSize: 11, fontFamily: "Inter", cursor: "pointer" }}
        >← Back to list</button>
        <div style={{ padding: "0 16px 8px", fontFamily: "Orbitron, monospace", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Private: {selected.name}</div>
        <PrivateChat />
      </div>
    );
  }

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ fontFamily: "Orbitron, monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(0,255,136,0.5)", marginBottom: 8 }}>SELECT TRAINEE</div>
      {loading && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, fontFamily: "Inter" }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {trainees.map(t => (
          <button
            key={t.id}
            onClick={() => setSelected(t)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px", background: "rgba(0,255,136,0.04)",
              border: "1px solid rgba(0,255,136,0.15)", borderRadius: 10,
              cursor: "pointer", textAlign: "left",
            }}
          >
            <span style={{ fontSize: 18 }}>👤</span>
            <span style={{ color: "#fff", fontSize: 12, fontFamily: "Inter" }}>{t.name}</span>
            <span style={{ marginLeft: "auto", color: "rgba(0,255,136,0.5)", fontSize: 10, fontFamily: "Inter" }}>Open →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Common Faults Admin ─────────────────────────────────────────────────────
interface FaultMedia { id: number; fault_id: number; mime_type: string; filename: string; sort_order: number; }
interface FaultItem { id: number; title: string; cause: string; solution: string; created_at: number; media: FaultMedia[]; }

function AdminFaults({ adminPw }: { adminPw: string }) {
  const [faults, setFaults]         = useState<FaultItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form state (add / edit)
  const [editId, setEditId]         = useState<number | null>(null); // null = new
  const [showForm, setShowForm]     = useState(false);
  const [fTitle, setFTitle]         = useState("");
  const [fCause, setFCause]         = useState("");
  const [fSolution, setFSolution]   = useState("");

  // CSV import
  const csvRef = useRef<HTMLInputElement>(null);
  // Media upload
  const mediaRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);

  const headers = { "x-admin-pw": adminPw, "Content-Type": "application/json" };

  function load() {
    setLoading(true);
    fetch("/api/faults").then(r => r.json()).then(d => { setFaults(d); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEditId(null);
    setFTitle(""); setFCause(""); setFSolution("");
    setShowForm(true);
  }
  function openEdit(f: FaultItem) {
    setEditId(f.id);
    setFTitle(f.title); setFCause(f.cause); setFSolution(f.solution);
    setShowForm(true);
  }

  async function saveFault() {
    if (!fTitle.trim() || !fCause.trim() || !fSolution.trim()) { alert("All fields are required."); return; }
    setSaving(true);
    try {
      if (editId === null) {
        const r = await fetch("/api/admin/faults", { method: "POST", headers, body: JSON.stringify({ title: fTitle, cause: fCause, solution: fSolution }) });
        if (!r.ok) throw new Error(await r.text());
      } else {
        const r = await fetch(`/api/admin/faults/${editId}`, { method: "PATCH", headers, body: JSON.stringify({ title: fTitle, cause: fCause, solution: fSolution }) });
        if (!r.ok) throw new Error(await r.text());
      }
      setShowForm(false);
      load();
    } catch (e: any) { alert("Error: " + e.message); }
    setSaving(false);
  }

  async function deleteFault(id: number) {
    if (!confirm("Delete this fault and all its media?")) return;
    await fetch(`/api/admin/faults/${id}`, { method: "DELETE", headers: { "x-admin-pw": adminPw } });
    load();
  }

  async function deleteMedia(mediaId: number) {
    if (!confirm("Delete this media file?")) return;
    await fetch(`/api/admin/faults/media/${mediaId}`, { method: "DELETE", headers: { "x-admin-pw": adminPw } });
    load();
  }

  async function uploadMedia(faultId: number, files: FileList) {
    setUploadingFor(faultId);
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = async () => {
          const b64 = (reader.result as string).split(",")[1];
          await fetch(`/api/admin/faults/${faultId}/media`, {
            method: "POST",
            headers,
            body: JSON.stringify({ media_data: b64, mime_type: file.type, filename: file.name }),
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    setUploadingFor(null);
    load();
  }

  // CSV import: columns title, cause, solution
  async function importCsv(file: File) {
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    let created = 0;
    for (const line of lines.slice(1)) { // skip header
      const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
      if (cols.length < 3) continue;
      const [title, cause, solution] = cols;
      if (!title || !cause || !solution) continue;
      await fetch("/api/admin/faults", { method: "POST", headers, body: JSON.stringify({ title, cause, solution }) });
      created++;
    }
    alert(`Imported ${created} faults.`);
    load();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", boxSizing: "border-box",
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, color: "#f0f0f0", fontSize: 13, outline: "none",
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: "#aaa", fontWeight: 700, letterSpacing: 1, marginBottom: 4, display: "block" };

  return (
    <div style={{ padding: "24px 20px", maxWidth: 860, margin: "0 auto" }}>
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>⚠️ Common Faults</h2>
          <p style={{ color: "#555", fontSize: 13, margin: "4px 0 0" }}>{faults.length} fault{faults.length !== 1 ? "s" : ""} documented</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => csvRef.current?.click()}
            style={{ padding: "8px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#ccc", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
          >📥 Import CSV</button>
          <input ref={csvRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
          <button
            onClick={openNew}
            style={{ padding: "8px 16px", background: "rgba(0,212,255,0.1)", border: "1px solid #00d4ff55", color: "#00d4ff", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >+ Add Fault</button>
        </div>
      </div>

      {/* CSV hint */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#555" }}>
        CSV format: <code style={{ color: "#888" }}>title,cause,solution</code> — first row is header, ignored.
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: "rgba(0,212,255,0.04)", border: "1px solid #00d4ff33", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px", color: "#00d4ff", fontSize: 15 }}>
            {editId === null ? "New Fault" : "Edit Fault"}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>TITLE</label>
              <input style={inputStyle} value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="e.g. ILS LOC signal lost on approach" />
            </div>
            <div>
              <label style={labelStyle}>CAUSE</label>
              <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={fCause} onChange={e => setFCause(e.target.value)} placeholder="Root cause, contributing factors..." />
            </div>
            <div>
              <label style={labelStyle}>SOLUTION</label>
              <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={fSolution} onChange={e => setFSolution(e.target.value)} placeholder="Steps to resolve, checks, fix procedure..." />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              onClick={saveFault}
              disabled={saving}
              style={{ padding: "9px 20px", background: saving ? "rgba(0,212,255,0.05)" : "rgba(0,212,255,0.12)", border: "1px solid #00d4ff55", color: "#00d4ff", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}
            >{saving ? "Saving..." : editId === null ? "Create" : "Save"}</button>
            <button
              onClick={() => setShowForm(false)}
              style={{ padding: "9px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#888", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
            >Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", color: "#444", padding: 40 }}>Loading...</div>
      ) : faults.length === 0 ? (
        <div style={{ textAlign: "center", color: "#333", padding: 60 }}>No faults yet — add the first one.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {faults.map(f => (
            <div key={f.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 12, overflow: "hidden" }}>
              {/* Row */}
              <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span
                  onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                  style={{ flex: 1, color: "#e0e0e0", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
                >{f.title}</span>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: "#555" }}>
                    {f.media.length > 0 ? `${f.media.length} media` : "no media"}
                  </span>
                  <button
                    onClick={() => openEdit(f)}
                    style={{ padding: "4px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#aaa", borderRadius: 6, cursor: "pointer", fontSize: 12 }}
                  >Edit</button>
                  <button
                    onClick={() => deleteFault(f.id)}
                    style={{ padding: "4px 10px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", color: "#ff8080", borderRadius: 6, cursor: "pointer", fontSize: 12 }}
                  >Delete</button>
                </div>
              </div>

              {/* Expanded detail + media manager */}
              {expandedId === f.id && (
                <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#ff8080", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>CAUSE</div>
                    <div style={{ color: "#bbb", fontSize: 13, whiteSpace: "pre-wrap" }}>{f.cause}</div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>SOLUTION</div>
                    <div style={{ color: "#bbb", fontSize: 13, whiteSpace: "pre-wrap" }}>{f.solution}</div>
                  </div>

                  {/* Media */}
                  <div style={{ fontSize: 11, color: "#00d4ff", fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>MEDIA FILES</div>
                  {f.media.length === 0 ? (
                    <div style={{ color: "#444", fontSize: 13, marginBottom: 10 }}>No media attached.</div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                      {f.media.map(m => (
                        <div key={m.id} style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 10px" }}>
                          <span style={{ fontSize: 12 }}>
                            {m.mime_type.startsWith("image/") ? "🖼" : m.mime_type.startsWith("video/") ? "🎬" : "📄"}
                          </span>
                          <span style={{ fontSize: 12, color: "#aaa", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {m.filename || m.mime_type}
                          </span>
                          <button
                            onClick={() => deleteMedia(m.id)}
                            style={{ background: "none", border: "none", color: "#ff6060", cursor: "pointer", fontSize: 13, padding: "0 2px" }}
                            title="Remove"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      onClick={() => { setUploadingFor(f.id); mediaRef.current?.click(); }}
                      style={{ padding: "7px 14px", background: "rgba(0,212,255,0.08)", border: "1px solid #00d4ff33", color: "#00d4ff", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
                    >📎 Add Media</button>
                    {uploadingFor === f.id && <span style={{ color: "#555", fontSize: 12 }}>Uploading...</span>}
                    <input
                      ref={mediaRef}
                      type="file"
                      accept="image/*,video/*,application/pdf"
                      multiple
                      style={{ display: "none" }}
                      onChange={e => {
                        const files = e.target.files;
                        if (files && uploadingFor !== null) uploadMedia(uploadingFor, files);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function AdminDashboard({ adminPw, onLogout }: { adminPw: string; onLogout: () => void }) {
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");
  const [sortBy, setSortBy] = useState<"xp" | "completedModules" | "currentStreak">("xp");
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedId, setSelectedId] = useState<string | null>(() => sessionStorage.getItem("tls_admin_selected") || null);
  const [retakeRequests, setRetakeRequests] = useState<Array<{ id: number; trainee_id: string; trainee_name: string; module_id: number; module_name: string; ts: number }>>([]);
  const [retakeActioning, setRetakeActioning] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<AdminView>("dashboard");

  // ── Menu dropdown ─────────────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Chat sub-tab ──────────────────────────────────────────────────────────────
  const [chatSubTab, setChatSubTab] = useState<"general" | "private">("general");

  // ── Theme toggle ─────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("tls_theme") as "dark" | "light") ?? "dark");
  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("light-mode");
    } else {
      document.documentElement.classList.remove("light-mode");
    }
    // Remove stale inline overrides from old approach
    const root = document.documentElement;
    ["--bg-primary","--bg-secondary","--bg-card","--bg-elevated",
     "--text-primary","--text-secondary","--text-muted","--border-color","--card-bg"]
      .forEach(v => root.style.removeProperty(v));
    localStorage.setItem("tls_theme", theme);
  }, [theme]);



  // ── Admin mode flag — suppresses Telegram tracking inside imported pages ──────
  const IMPORTED_VIEWS = ["basics", "advanced", "quiz", "chat", "status", "notifications", "about", "documents", "simulator"];
  useEffect(() => {
    if (IMPORTED_VIEWS.includes(activeView)) {
      sessionStorage.setItem("tls_admin_mode", "1");
    } else {
      sessionStorage.removeItem("tls_admin_mode");
    }
  }, [activeView]);

  const fetchData = useCallback(async () => {
    try {
      const [res, retakeRes] = await Promise.all([
        fetch("/api/admin/trainees", { headers: { "x-admin-password": adminPw } }),
        fetch("/api/admin/retake-requests", { headers: { "x-admin-password": adminPw } }),
      ]);
      if (!res.ok) { setError("Session expired. Please log in again."); return; }
      const data = await res.json() as Trainee[];
      setTrainees(data); setLastRefresh(new Date());
      if (retakeRes.ok) setRetakeRequests(await retakeRes.json() as any[]);
    } catch { setError("Failed to load data."); }
    finally { setLoading(false); }
  }, [adminPw]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30_000);
    return () => clearInterval(t);
  }, [fetchData]);

  const online = trainees.filter(t => t.online);
  const filtered = trainees
    .filter(t => filter === "all" ? true : filter === "online" ? t.online : !t.online)
    .sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));

  const totalXp = trainees.reduce((s, t) => s + t.xp, 0);
  const avgModules = trainees.length ? (trainees.reduce((s, t) => s + t.completedModules, 0) / trainees.length).toFixed(1) : "0";
  const avgScore = trainees.length ? Math.round(trainees.reduce((s, t) => s + (t.completedModules / Math.max(t.totalModules, 1)) * 100, 0) / trainees.length) : 0;
  const levelFromXp = (xp: number) => Math.floor(xp / 500) + 1;

  // ── Admin-specific background: dark green military ──────────────────────────
  const adminBg = "linear-gradient(160deg, #050f05 0%, #080f08 40%, #050a05 100%)";

  return (
    <div style={{
      background: adminBg,
      minHeight: "100vh",
      paddingTop: 0,
      overflowY: "auto",
      WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
      paddingBottom: "calc(80px + env(safe-area-inset-bottom))",
    } as React.CSSProperties}>

      {/* Detail modal */}
      {selectedId && (
        <TraineeDetailModal
          traineeId={selectedId}
          adminPw={adminPw}
          onClose={() => {
            setSelectedId(null);
            sessionStorage.removeItem("tls_admin_selected");
          }}
        />
      )}

      {/* ── TOPBAR ── */}
      <div style={{
        background: "linear-gradient(180deg, #030d03 0%, #050f05 100%)",
        borderBottom: "1px solid rgba(0,255,136,0.15)",
        padding: "0 16px",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        {/* Brand row */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: "env(safe-area-inset-top, 12px)", paddingBottom: 0,
          minHeight: 52,
        }}>
          {/* Logo + title */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, rgba(0,255,136,0.2), rgba(0,255,136,0.05))",
              border: "1px solid rgba(0,255,136,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0,
              boxShadow: "0 0 12px rgba(0,255,136,0.15)",
            }}>⚡</div>
            <div>
              <div style={{
                fontFamily: "Orbitron, monospace", fontSize: 11, fontWeight: 900,
                color: "#00FF88", letterSpacing: "0.1em",
                textShadow: "0 0 12px rgba(0,255,136,0.4)",
              }}>COMMAND CENTER</div>
              <div style={{
                fontFamily: "Inter, sans-serif", fontSize: 8, letterSpacing: "0.3em",
                color: "rgba(0,255,136,0.45)", marginTop: 1,
              }}>TLS ADMIN SYSTEM</div>
            </div>
          </div>

          {/* Right side: menu + logout */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* ☰ MENU dropdown */}
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{
                  padding: "5px 12px", background: menuOpen ? "rgba(0,255,136,0.12)" : "rgba(0,255,136,0.05)",
                  border: "1px solid rgba(0,255,136,0.3)",
                  borderRadius: 8, cursor: "pointer", color: "#00FF88",
                  fontSize: 9, fontFamily: "Inter", letterSpacing: "0.08em",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >☰ MENU</button>
              {menuOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  background: "#0a1a0a", border: "1px solid rgba(0,255,136,0.25)",
                  borderRadius: 10, overflow: "hidden", zIndex: 999,
                  minWidth: 160, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}>
                  {NAV_LINKS.map(link => (
                    <React.Fragment key={link.id}>
                      <button
                        onClick={() => { setActiveView(link.id as AdminView); setMenuOpen(false); }}
                        onMouseEnter={() => setHoveredItem(link.id)}
                        onMouseLeave={() => setHoveredItem(null)}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          width: "100%", padding: "10px 14px",
                          background: hoveredItem === link.id || activeView === link.id ? "rgba(0,255,136,0.12)" : "transparent",
                          border: "none", borderBottom: "1px solid rgba(0,255,136,0.07)",
                          color: hoveredItem === link.id || activeView === link.id ? "#00FF88" : "rgba(255,255,255,0.6)",
                          fontSize: 11, fontFamily: "Inter", cursor: "pointer",
                          textAlign: "left", transition: "background 0.15s, color 0.15s",
                        }}
                      >
                        <span>{link.icon}</span>{link.label}
                        {link.id === "trainees" && retakeRequests.length > 0 && (
                          <span style={{ marginLeft: "auto", background: "#FFD700", color: "#000", borderRadius: 10, padding: "0 5px", fontSize: 8, fontWeight: 700 }}>{retakeRequests.length}</span>
                        )}
                      </button>
                      {link.divider && <div style={{ height: 1, background: "rgba(0,255,136,0.2)", margin: "2px 0" }} />}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => { sessionStorage.removeItem(SESSION_KEY); onLogout(); }}
              style={{
                padding: "5px 12px", background: "rgba(255,68,68,0.08)",
                border: "1px solid rgba(255,68,68,0.3)",
                borderRadius: 8, cursor: "pointer", color: "#FF4444",
                fontSize: 9, fontFamily: "Inter", letterSpacing: "0.08em",
              }}
            >LOGOUT</button>
          </div>
        </div>

      </div>

      {error && (
        <div style={{ margin: "12px 16px", padding: "12px 16px", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 10, color: "#FF4444", fontSize: 12 }}>{error}</div>
      )}

      {/* ── DASHBOARD VIEW ── stat cards + overview ── */}
      {activeView === "dashboard" && !loading && (
        <div className="admin-view" style={{ padding: "16px 16px 0" }}>
          {/* Large stat banner */}
          <div style={{
            background: "linear-gradient(135deg, rgba(0,255,136,0.06), rgba(0,255,136,0.02))",
            border: "1px solid rgba(0,255,136,0.15)",
            borderRadius: 14, padding: "16px", marginBottom: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: "Orbitron, monospace", fontSize: 8, letterSpacing: "0.3em", color: "rgba(0,255,136,0.5)", marginBottom: 4 }}>SYSTEM STATUS</div>
                <div style={{ fontFamily: "Orbitron, monospace", fontSize: 18, fontWeight: 700, color: "#ffffff" }}>
                  {trainees.length} TRAINEES
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "Inter" }}>Last sync</div>
                <div style={{ fontSize: 11, color: "rgba(0,255,136,0.6)", fontFamily: "Inter" }}>{lastRefresh.toLocaleTimeString()}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { label: "TOTAL", value: String(trainees.length), color: "#00FF88", sub: "registered", icon: "👥" },
                { label: "LIVE NOW", value: String(online.length), color: "#00CC66", sub: "online", icon: "🟢" },
                { label: "TOTAL XP", value: totalXp >= 1000 ? `${(totalXp / 1000).toFixed(1)}k` : String(totalXp), color: "#FFD700", sub: "earned", icon: "⚡" },
                { label: "AVG MODS", value: avgModules, color: "#FFD700", sub: "completed", icon: "📚" },
              ].map(({ label, value, color, sub, icon }) => (
                <div key={label} style={{
                  background: `${color}08`, border: `1px solid ${color}20`,
                  borderRadius: 10, padding: "12px 8px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontFamily: "Orbitron, monospace", fontSize: 15, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "Inter", marginTop: 2, letterSpacing: "0.06em" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              { label: "PENDING RETAKES", value: String(retakeRequests.length), color: retakeRequests.length > 0 ? "#FFD700" : "rgba(255,255,255,0.2)" },
              { label: "BLOCKED",  value: String(trainees.filter(t => (t as any).status === "blocked").length), color: "#FF4444" },
              { label: "ADVANCED", value: String(trainees.filter(t => (t as any).trainingLevel === "advanced").length), color: "#FFD700" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, padding: "10px 8px", textAlign: "center",
              }}>
                <div style={{ fontFamily: "Orbitron, monospace", fontSize: 18, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "Inter", marginTop: 2, letterSpacing: "0.06em" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Top performers */}
          {trainees.length > 0 && (
            <div style={{
              background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.12)",
              borderRadius: 12, padding: "14px", marginBottom: 16,
            }}>
              <div style={{ fontFamily: "Orbitron, monospace", fontSize: 9, letterSpacing: "0.2em", color: "#FFD700", marginBottom: 12 }}>
                🏆 TOP PERFORMERS
              </div>
              {[...trainees].sort((a, b) => b.xp - a.xp).slice(0, 3).map((t, i) => (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 0",
                  borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    background: i === 0 ? "rgba(255,215,0,0.2)" : i === 1 ? "rgba(192,192,192,0.15)" : "rgba(205,127,50,0.15)",
                    border: `1px solid ${i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : "#CD7F32"}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontFamily: "Orbitron, monospace", fontWeight: 700,
                    color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : "#CD7F32",
                  }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#ffffff", fontFamily: "Inter", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "Inter" }}>{t.completedModules} modules</div>
                  </div>
                  <div style={{ fontFamily: "Orbitron, monospace", fontSize: 12, fontWeight: 700, color: "#FFD700", flexShrink: 0 }}>{t.xp} XP</div>
                </div>
              ))}
            </div>
          )}

          {/* Panels: Missed Q + Backup + Telegram */}
          <MissedQuestionsPanel adminPw={adminPw} />
          <BackupPanel adminPw={adminPw} />
          <TelegramPanel adminPw={adminPw} />
        </div>
      )}

      {/* ── REPORTS VIEW ── */}
      {activeView === "reports" && (
        <div className="admin-view" style={{ padding: "16px" }}>
          <div style={{ fontFamily: "Orbitron, monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(0,255,136,0.5)", marginBottom: 8 }}>REPORTS</div>
          <div style={{ fontFamily: "Orbitron, monospace", fontSize: 18, fontWeight: 700, color: "#ffffff", marginBottom: 16 }}>ANALYTICS</div>
          {!loading && trainees.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...trainees].sort((a, b) => b.xp - a.xp).map((t, i) => (
                <div key={t.id} style={{
                  background: "rgba(0,255,136,0.03)", border: "1px solid rgba(0,255,136,0.1)",
                  borderRadius: 10, padding: "12px 14px",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Orbitron, monospace", fontSize: 11, color: "#00FF88" }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", fontFamily: "Inter" }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Inter" }}>{t.email}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#FFD700", fontFamily: "Orbitron, monospace" }}>{t.xp}</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "Inter" }}>XP</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#00FF88", fontFamily: "Orbitron, monospace" }}>{t.completedModules}/{t.totalModules}</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "Inter" }}>MODS</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && trainees.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.2)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
              <div style={{ fontFamily: "Orbitron, monospace", fontSize: 11 }}>NO DATA YET</div>
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS VIEW ── */}
      {activeView === "settings" && (
        <div className="admin-view" style={{ padding: "16px" }}>
          <div style={{ fontFamily: "Orbitron, monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(0,255,136,0.5)", marginBottom: 8 }}>SYSTEM</div>
          <div style={{ fontFamily: "Orbitron, monospace", fontSize: 18, fontWeight: 700, color: "#ffffff", marginBottom: 16 }}>SETTINGS</div>

          {/* Change Admin Password */}
          <AdminPasswordChange adminPw={adminPw} />

          <BackupPanel adminPw={adminPw} />
          <TelegramPanel adminPw={adminPw} />

          {/* Theme toggle */}
          <div style={{ marginTop: 16, padding: "16px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 12 }}>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: 10, color: "rgba(0,255,136,0.6)", marginBottom: 12 }}>APPEARANCE</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter" }}>
                {theme === "dark" ? "🌙 Dark Mode" : "🌞 Light Mode"}
              </span>
              <button
                onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
                style={{
                  padding: "6px 14px", background: "rgba(0,255,136,0.08)",
                  border: "1px solid rgba(0,255,136,0.3)", borderRadius: 8,
                  color: "#00FF88", fontSize: 11, fontFamily: "Inter", cursor: "pointer",
                }}
              >Toggle {theme === "dark" ? "Light" : "Dark"}</button>
            </div>
          </div>

          <div style={{ marginTop: 16, padding: "16px", background: "rgba(255,68,68,0.05)", border: "1px solid rgba(255,68,68,0.2)", borderRadius: 12 }}>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: 10, color: "#FF4444", marginBottom: 8 }}>DANGER ZONE</div>
            <button
              onClick={() => { sessionStorage.removeItem(SESSION_KEY); onLogout(); }}
              style={{
                width: "100%", padding: "12px", background: "rgba(255,68,68,0.1)",
                border: "1px solid rgba(255,68,68,0.4)", borderRadius: 8,
                color: "#FF4444", fontFamily: "Inter", fontSize: 11,
                letterSpacing: "0.1em", cursor: "pointer",
              }}
            >⛔ LOGOUT & REVOKE SESSION</button>
          </div>
        </div>
      )}

      {/* ── IMPORTED TRAINEE PAGES ── dark wrapper keeps admin shell consistent */}
      {activeView === "basics"        && <div className="admin-view" style={{ background: "#050f05", minHeight: "100vh" }}><Basics /></div>}
      {activeView === "advanced"      && <div className="admin-view" style={{ background: "#050f05", minHeight: "100vh" }}><Advanced /></div>}
      {activeView === "quiz"          && <div className="admin-view" style={{ background: "#050f05", minHeight: "100vh" }}><QuizList adminMode={true} /></div>}
      {activeView === "status"        && <div className="admin-view" style={{ background: "#050f05", minHeight: "100vh" }}><Status /></div>}
      {activeView === "notifications" && <div className="admin-view" style={{ background: "#050f05", minHeight: "100vh" }}><Notifications adminMode={true} /></div>}
      {activeView === "about"         && <div className="admin-view" style={{ background: "#050f05", minHeight: "100vh" }}><About /></div>}
      {activeView === "documents"     && <div className="admin-view" style={{ background: "#03080f", minHeight: "100vh", padding: "24px 32px" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: "#00FF88", fontFamily: "Inter", marginBottom: 4 }}>📄 DOCUMENTS</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter" }}>TLS reference documents — click OPEN to view in a new tab</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            "020-00089 RevA.pdf",
            "020-00098 Rev B.pdf",
            "1899539853.pdf",
            "843572488.pdf",
            "8D7799AD-C01F-4EC9-8AB9-E6C3E8B23537.pdf",
            "ANPC-Data-Sheet_TLS_Final.pdf",
            "ATC quick guide TLS.pdf",
            "Antennas_Presentation.pdf",
            "Application_of_the_Transponder_Landing_System_to_Achieve_Airport_Accessibility.pdf",
            "Att.-B-FAA-8200.47-Transponder-Landing-System.pdf",
            "B26FC8A9-237C-4A2B-A3C1-BCBC9CC6A897.pdf",
            "Calibration Procedure.pdf",
            "DME_TLS_Report_Clean.pdf",
            "DOC-20250724-WA0007..pdf",
            "DOC-2222222222.pdf",
            "Extracted 3333333333.pdf",
            "Extracted pages from 020-00103_Rev B.pdf",
            "FTM_Theodolite_Survey_and_Calibration.pdf",
            "FTM___Checklists44444444.pdf",
            "GTU Program55555555.pdf",
            "GTU setup.pdf",
            "GetAtt.html.pdf",
            "Input survey 111111111.pdf",
            "Input survey data procedure.pdf",
            "KKMC RWY 32.pdf",
            "Pre-Calibration Procedure.pdf",
            "Setting Monitor Limits and computing nominals.pdf",
            "Setting Pulse in the frame.pdf",
            "Survey procedure.pdf",
            "TLS Training Slides.pdf",
            "TLS all four Palau RWY9 (1).pdf",
            "TLS_Antenna_System_Advantages_AllHeadersWhite.pdf",
            "TLS_Approach_Guidance...pdf",
            "TLS_Preliminary_Guide.pdf",
            "TLS_System_Overview_EN.pdf",
            "TTLS2027 Spares identification listing(3).pdf",
            "TransponderLandingSystem.pdf",
            "Transponder_Landing_System_Flight_Inspection.pdf",
            "patria-anpc-a4-brochure-0124pdf.pdf",
            "transponder-landing-system-material-2.pptx",
            "‎⁨خطوات مسح موقع جهاز الثيودوليت⁩.pdf",
          ].map(file => (
            <div key={file} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8, padding: "10px 16px", gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>
                  {file.endsWith(".pptx") ? "📊" : "📄"}
                </span>
                <span style={{
                  fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Inter",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{file}</span>
              </div>
              <a
                href={`/admin-docs/${encodeURIComponent(file)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flexShrink: 0, padding: "5px 14px",
                  background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.3)",
                  borderRadius: 6, color: "#00FF88", fontSize: 10,
                  fontFamily: "Inter", fontWeight: 700, letterSpacing: "0.08em",
                  textDecoration: "none", whiteSpace: "nowrap",
                  transition: "background 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,255,136,0.18)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,255,136,0.08)")}
              >OPEN</a>
            </div>
          ))}
        </div>
      </div>}

      {/* ── RADAR GALLERY ADMIN ── */}

      {activeView === "common_faults" && (
        <AdminFaults adminPw={adminPw} />
      )}

      {/* ── SIMULATOR CONTROL ── */}
      {activeView === "simulator" && (
        <div className="admin-view" style={{ background: "#030d03", minHeight: "100vh" }}>
          <SimulatorAdmin adminPw={adminPw} />
        </div>
      )}

      {activeView === "nav_manager" && (
        <div className="admin-view" style={{ background: "#03080f", minHeight: "100vh" }}>
          <NavManagerAdmin adminPw={adminPw} />
        </div>
      )}

      {/* ── CHAT VIEW ── General / Private sub-tabs */}
      {activeView === "chat" && (
        <div className="admin-view" style={{ background: "#050f05", minHeight: "100vh" }}>
          {/* Sub-tab strip */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(0,255,136,0.1)", background: "#071207" }}>
            {(["general", "private"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setChatSubTab(tab)}
                style={{
                  padding: "10px 20px", background: "none", border: "none",
                  borderBottom: chatSubTab === tab ? "2px solid #00FF88" : "2px solid transparent",
                  color: chatSubTab === tab ? "#00FF88" : "rgba(255,255,255,0.4)",
                  fontFamily: "Inter", fontSize: 11, letterSpacing: "0.08em",
                  cursor: "pointer", textTransform: "uppercase",
                }}
              >{tab === "general" ? "💬 General Chat" : "🔒 Private Chat"}</button>
            ))}
          </div>
          {chatSubTab === "general" && <Chat />}
          {chatSubTab === "private" && <AdminPrivateChatList adminPw={adminPw} />}
        </div>
      )}

      {/* ── TRAINEES VIEW (default list) ── */}
      {(activeView === "trainees" || activeView === "dashboard") && (
      <div className="admin-view" style={{ padding: activeView === "trainees" ? "16px 16px 0" : "0 16px 0" }}>
        {activeView === "trainees" && (
          <>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(0,255,136,0.5)", marginBottom: 4 }}>PERSONNEL</div>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: 18, fontWeight: 700, color: "#ffffff", marginBottom: 12 }}>TRAINEES</div>
          </>
        )}

        {/* Stat cards — only show in trainees view (dashboard has its own) */}
        {!loading && activeView === "trainees" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              { label: "TRAINEES", value: String(trainees.length), color: C.primary },
              { label: "ONLINE", value: String(online.length), color: C.green },
              { label: "TOTAL XP", value: totalXp >= 1000 ? `${(totalXp / 1000).toFixed(1)}k` : String(totalXp), color: C.accent },
              { label: "AVG MOD", value: avgModules, color: C.yellow },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: "10px 8px", textAlign: "center", background: `${color}08`, border: `1px solid ${color}20`, borderRadius: 10 }}>
                <div style={{ fontFamily: "Orbitron, monospace", fontSize: 16, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "Inter", letterSpacing: "0.08em", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

      {/* Filter + Sort */}
      {!loading && trainees.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "online", "offline"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 10, fontFamily: "Inter",
                cursor: "pointer", letterSpacing: "0.06em",
                background: filter === f ? "#00FF88" : "rgba(255,255,255,0.04)",
                border: `1px solid ${filter === f ? "#00FF88" : "rgba(255,255,255,0.1)"}`,
                color: filter === f ? "#000000" : "rgba(255,255,255,0.4)",
              }}>{f.toUpperCase()}</button>
            ))}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} style={{
            background: "rgba(0,20,0,0.8)", border: "1px solid rgba(0,255,136,0.2)",
            borderRadius: 20, padding: "5px 10px", color: "rgba(255,255,255,0.6)",
            fontSize: 10, fontFamily: "Inter", cursor: "pointer", outline: "none",
          }}>
            <option value="xp">Sort: XP</option>
            <option value="completedModules">Sort: Modules</option>
            <option value="currentStreak">Sort: Streak</option>
          </select>
        </div>
      )}

      <div style={{ paddingBottom: 40 }}>

        {/* ── RETAKE REQUESTS ── */}
        {retakeRequests.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontFamily: "Orbitron, monospace", letterSpacing: "0.15em", color: "#FFD700", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              🔁 RETAKE REQUESTS
              <span style={{ background: "#FFD700", color: "#000", borderRadius: 10, padding: "1px 7px", fontSize: 9, fontWeight: 700 }}>
                {retakeRequests.length}
              </span>
            </div>
            {retakeRequests.map(req => (
              <div key={req.id} style={{ padding: "12px 14px", marginBottom: 8, background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.25)", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{req.trainee_name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      Module: <span style={{ color: C.yellow }}>{req.module_name}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      {new Date(req.ts).toLocaleString("en-SA", { timeZone: "Asia/Riyadh" })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      disabled={retakeActioning === req.id}
                      onClick={async () => {
                        setRetakeActioning(req.id);
                        await fetch(`/api/admin/retake-request/${req.id}/approve`, { method: "POST", headers: { "x-admin-password": adminPw } });
                        setRetakeRequests(r => r.filter(x => x.id !== req.id));
                        setRetakeActioning(null);
                      }}
                      style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.green}50`, background: `${C.green}12`, color: C.green, fontSize: 10, cursor: "pointer", fontFamily: "Inter" }}
                    >APPROVE</button>
                    <button
                      disabled={retakeActioning === req.id}
                      onClick={async () => {
                        setRetakeActioning(req.id);
                        await fetch(`/api/admin/retake-request/${req.id}/deny`, { method: "POST", headers: { "x-admin-password": adminPw } });
                        setRetakeRequests(r => r.filter(x => x.id !== req.id));
                        setRetakeActioning(null);
                      }}
                      style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.red}50`, background: `${C.red}12`, color: C.red, fontSize: 10, cursor: "pointer", fontFamily: "Inter" }}
                    >DENY</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && [...Array(3)].map((_, i) => (
          <div key={i} style={{ height: 90, opacity: 0.3, marginBottom: 10, background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.08)", borderRadius: 12 }} />
        ))}

        {!loading && trainees.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.2)" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>👥</div>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: 13, marginBottom: 8 }}>NO TRAINEES REGISTERED YET</div>
            <div style={{ fontSize: 12, fontFamily: "Inter" }}>Trainees will appear here once they register and log in.</div>
          </div>
        )}

        {!loading && trainees.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.2)" }}>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: 12 }}>
              {filter === "online" ? "NO ACTIVE TRAINEES ONLINE" : "NO OFFLINE TRAINEES"}
            </div>
          </div>
        )}

        {/* ── Trainee Cards — CLICKABLE ── */}
        {!loading && filtered.map((t, i) => {
          const level = levelFromXp(t.xp);
          const pct = Math.round(((t.xp % 500) / 500) * 100);
          const progressPct = t.totalModules > 0 ? Math.round((t.completedModules / t.totalModules) * 100) : 0;
          const cardBorderColor = t.online ? "rgba(0,204,102,0.3)" : "rgba(0,255,136,0.12)";
          const cardBg = t.online
            ? "linear-gradient(135deg, rgba(0,204,102,0.07), rgba(0,0,0,0))"
            : "linear-gradient(135deg, rgba(0,255,136,0.04), rgba(0,0,0,0))";

          return (
            <div
              key={t.id}
              onClick={() => { setSelectedId(t.id); sessionStorage.setItem("tls_admin_selected", t.id); }}
              style={{
                marginBottom: 10, cursor: "pointer",
                border: `1px solid ${cardBorderColor}`,
                background: cardBg,
                borderRadius: 12,
                padding: "14px 16px",
                transition: "border-color 0.18s, box-shadow 0.18s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = t.online ? "rgba(0,204,102,0.6)" : "rgba(0,255,136,0.3)";
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${t.online ? "rgba(0,204,102,0.12)" : "rgba(0,255,136,0.08)"}`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = cardBorderColor;
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {/* Top row */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  background: t.online ? "linear-gradient(135deg, rgba(0,204,102,0.25), rgba(0,0,0,0))" : "linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,0,0,0))",
                  border: `2px solid ${t.online ? "#00CC66" : "rgba(0,255,136,0.3)"}`,
                  boxShadow: t.online ? "0 0 12px rgba(0,204,102,0.3)" : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Inter", fontSize: 16, fontWeight: 700,
                  color: t.online ? "#00CC66" : "#00FF88", position: "relative",
                }}>
                  {t.name.charAt(0).toUpperCase()}
                  <span style={{
                    position: "absolute", bottom: 1, right: 1,
                    width: 10, height: 10, borderRadius: "50%",
                    background: t.online ? "#00CC66" : "rgba(255,255,255,0.15)",
                    boxShadow: t.online ? "0 0 6px #00CC66" : "none",
                    border: "2px solid #050f05",
                  }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ fontFamily: "Orbitron, monospace", fontSize: 12, fontWeight: 700, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.name.toUpperCase()}
                    </div>
                    {(t.role === "admin" || t.role === "instructor") && (
                      <span style={{ fontSize: 8, padding: "2px 6px", background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.35)", borderRadius: 10, color: "#FFD700", fontFamily: "Inter" }}>
                        {t.role.toUpperCase()}
                      </span>
                    )}
                    {t.status && t.status !== 'active' && (
                      <span style={{
                        fontSize: 8, padding: "2px 6px", borderRadius: 10, fontFamily: "Inter",
                        background: t.status === 'blocked' ? "rgba(255,68,68,0.12)" : t.status === 'suspended' ? "rgba(255,215,0,0.12)" : "rgba(255,215,0,0.12)",
                        border: `1px solid ${t.status === 'blocked' ? "rgba(255,68,68,0.4)" : "rgba(255,215,0,0.4)"}`,
                        color: t.status === 'blocked' ? "#FF4444" : t.status === 'suspended' ? "#FFD700" : "#FFD700",
                      }}>
                        {t.status === 'blocked' ? '🚫' : t.status === 'suspended' ? '⏸️' : '🔇'} {t.status.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1, fontFamily: "Inter", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.email}</div>
                  <div style={{ fontSize: 10, color: t.online ? "#00CC66" : "rgba(255,255,255,0.25)", marginTop: 2, fontFamily: "Inter" }}>
                    {t.online ? "● Online now" : `Last: ${timeAgo(t.lastActiveAt ?? t.lastActive)}`}
                  </div>
                  {t.lastPage && (
                    <div style={{ fontSize: 9, color: "rgba(0,174,239,0.5)", marginTop: 1, fontFamily: "Inter", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      📍 {t.lastPage}
                    </div>
                  )}
                </div>

                {/* Level badge */}
                <div style={{ flexShrink: 0, textAlign: "center", background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.3)", borderRadius: 8, padding: "6px 10px" }}>
                  <div style={{ fontFamily: "Orbitron, monospace", fontSize: 14, fontWeight: 700, color: "#FFD700" }}>{level}</div>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "Inter" }}>LVL</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00FF88" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.4 }}>
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
                {[
                  { label: "XP", value: String(t.xp), color: "#FFD700" },
                  { label: "MODULES", value: `${t.completedModules}/${t.totalModules}`, color: "#00FF88" },
                  { label: "STREAK", value: `${t.currentStreak}d`, color: "#FFD700" },
                  { label: "BADGES", value: String(t.earnedBadges), color: "#00CC66" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "Inter" }}>{value}</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "Inter", letterSpacing: "0.06em" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* XP progress */}
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "Inter" }}>XP to next level</span>
                  <span style={{ fontSize: 9, color: "#FFD700", fontFamily: "Inter" }}>{pct}%</span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #FFD700, #FFA500)", borderRadius: 2 }} />
                </div>
              </div>

              {/* Module progress */}
              {t.totalModules > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "Inter" }}>Module completion</span>
                    <span style={{ fontSize: 9, color: "#00FF88", fontFamily: "Inter" }}>{progressPct}%</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${progressPct}%`, height: "100%", background: "linear-gradient(90deg, #00FF88, #00CC66)", borderRadius: 2 }} />
                  </div>
                </div>
              )}

              {/* Quick moderation buttons */}
              <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
                {t.status === 'active' ? (
                  <>
                    <QuickModBtn traineeId={t.id} action="block"   label="🚫 Block"   color="#FF4444" adminPw={adminPw} onDone={fetchData} />
                    <QuickModBtn traineeId={t.id} action="suspend" label="⏸️ Suspend" color="#FFD700" adminPw={adminPw} onDone={fetchData} />
                    <QuickModBtn traineeId={t.id} action="mute"    label="🔇 Mute"    color="#FFD700" adminPw={adminPw} onDone={fetchData} />
                  </>
                ) : t.status === 'blocked' ? (
                  <QuickModBtn traineeId={t.id} action="unblock"  label="✅ Unblock"  color="#00CC66" adminPw={adminPw} onDone={fetchData} />
                ) : t.status === 'suspended' ? (
                  <QuickModBtn traineeId={t.id} action="restore"  label="▶️ Restore"  color="#00FF88" adminPw={adminPw} onDone={fetchData} />
                ) : t.status === 'muted' ? (
                  <QuickModBtn traineeId={t.id} action="unmute"   label="🔊 Unmute"   color="#00CC66" adminPw={adminPw} onDone={fetchData} />
                ) : null}
                <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                  <span style={{ fontSize: 8, color: "rgba(0,255,136,0.3)", fontFamily: "Inter", letterSpacing: "0.08em" }}>TAP FOR DETAILS →</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function Admin() {
  const ADMIN_PW = "TLS@Admin2025";
  // Auto-authenticate — no password prompt
  if (!sessionStorage.getItem(SESSION_KEY)) {
    sessionStorage.setItem(SESSION_KEY, ADMIN_PW);
  }
  return <AdminDashboard adminPw={ADMIN_PW} onLogout={() => sessionStorage.removeItem(SESSION_KEY)} />;
}
