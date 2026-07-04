/**
 * QuizEditor — Admin Quiz Question Editor
 * Allows admin to: list, add, edit, delete questions per module
 * Design: dark military-green theme matching admin panel
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp, Save, X,
  BookOpen, HelpCircle, CheckCircle2, AlertCircle, Loader2,
  Search, RefreshCw, ChevronLeft, GripVertical, Copy,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface Module {
  id: number;
  title: string;
  subtitle?: string;
  icon?: string;
  color?: string;
  lessonCount?: number;
  isPublished?: number;
}

interface Question {
  id: number;
  moduleId: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  explanation?: string;
  order: number;
}

type CorrectOption = "A" | "B" | "C" | "D";

interface QuestionForm {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: CorrectOption;
  explanation: string;
}

const EMPTY_FORM: QuestionForm = {
  question: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOption: "A",
  explanation: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getAdminPw(): string {
  try {
    const raw = sessionStorage.getItem("tls_admin_pw") || localStorage.getItem("tls_admin_pw");
    if (!raw) return "";
    // admin.tsx stores as JSON object: { pw: string, exp: number }
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && obj.pw) return obj.pw;
    return raw; // fallback if plain string
  } catch {
    return sessionStorage.getItem("tls_admin_pw") ?? localStorage.getItem("tls_admin_pw") ?? "";
  }
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const pw = getAdminPw();
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": pw,
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json();
}

// ── Colour palette (admin green theme) ───────────────────────────────────────
const C = {
  bg:       "#030f03",
  surface:  "#071407",
  card:     "#0a1a0a",
  border:   "rgba(0,255,136,0.12)",
  borderHi: "rgba(0,255,136,0.3)",
  green:    "#00FF88",
  greenDim: "rgba(0,255,136,0.6)",
  gold:     "#FFD700",
  red:      "#FF4444",
  orange:   "#FF9500",
  text:     "rgba(255,255,255,0.85)",
  muted:    "rgba(255,255,255,0.35)",
  faint:    "rgba(255,255,255,0.08)",
};

const OPTION_COLORS: Record<CorrectOption, string> = {
  A: "#00c8ff",
  B: "#00FF88",
  C: C.gold,
  D: C.orange,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: "ok" | "err"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, minWidth: 260, maxWidth: "90vw",
      background: type === "ok" ? "rgba(0,255,136,0.12)" : "rgba(255,68,68,0.12)",
      border: `1px solid ${type === "ok" ? C.green : C.red}40`,
      borderRadius: 10, padding: "12px 18px",
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      animation: "fadeInUp 0.25s ease",
    }}>
      {type === "ok"
        ? <CheckCircle2 size={16} color={C.green} />
        : <AlertCircle size={16} color={C.red} />}
      <span style={{ fontSize: 13, color: C.text }}>{msg}</span>
      <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 0 }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ── Question Form (Add / Edit) ────────────────────────────────────────────────
function QuestionFormModal({
  initial, moduleId, onSave, onCancel, saving,
}: {
  initial?: Question | null;
  moduleId: number;
  onSave: (form: QuestionForm) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<QuestionForm>(
    initial
      ? {
          question:      initial.question,
          optionA:       initial.optionA,
          optionB:       initial.optionB,
          optionC:       initial.optionC,
          optionD:       initial.optionD,
          correctOption: initial.correctOption as CorrectOption,
          explanation:   initial.explanation ?? "",
        }
      : { ...EMPTY_FORM }
  );

  const set = (k: keyof QuestionForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid =
    form.question.trim().length > 0 &&
    form.optionA.trim().length > 0 &&
    form.optionB.trim().length > 0 &&
    form.optionC.trim().length > 0 &&
    form.optionD.trim().length > 0;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "10px 12px",
    color: C.text,
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    resize: "vertical",
    transition: "border-color 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    color: C.greenDim,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    fontFamily: "Orbitron, monospace",
    marginBottom: 5,
    display: "block",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "16px 12px",
      overflowY: "auto",
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: C.card,
        border: `1px solid ${C.borderHi}`,
        borderRadius: 14,
        padding: "24px 20px",
        width: "100%",
        maxWidth: 560,
        boxShadow: "0 0 40px rgba(0,255,136,0.08), 0 16px 48px rgba(0,0,0,0.7)",
        position: "relative",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "rgba(0,255,136,0.1)", border: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {initial ? <Pencil size={14} color={C.green} /> : <Plus size={14} color={C.green} />}
          </div>
          <div>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: 9, color: C.greenDim, letterSpacing: "0.2em" }}>
              QUIZ EDITOR
            </div>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: 14, fontWeight: 700, color: "#fff" }}>
              {initial ? "EDIT QUESTION" : "NEW QUESTION"}
            </div>
          </div>
          <button onClick={onCancel} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Question Text */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Question *</label>
          <textarea
            value={form.question}
            onChange={set("question")}
            placeholder="Enter the question text..."
            rows={3}
            style={{ ...inputStyle }}
          />
        </div>

        {/* Options Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {(["A", "B", "C", "D"] as CorrectOption[]).map((opt) => {
            const key = `option${opt}` as keyof QuestionForm;
            const isCorrect = form.correctOption === opt;
            return (
              <div key={opt} style={{ position: "relative" }}>
                <label style={{ ...labelStyle, color: isCorrect ? OPTION_COLORS[opt] : C.muted }}>
                  Option {opt} {isCorrect && "✓ Correct"}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    value={form[key] as string}
                    onChange={set(key)}
                    placeholder={`Option ${opt}...`}
                    style={{
                      ...inputStyle,
                      paddingRight: 36,
                      borderColor: isCorrect ? `${OPTION_COLORS[opt]}50` : C.border,
                      background: isCorrect ? `${OPTION_COLORS[opt]}08` : "rgba(255,255,255,0.04)",
                    }}
                  />
                  {/* Mark as correct button */}
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, correctOption: opt }))}
                    title={`Mark ${opt} as correct`}
                    style={{
                      position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", padding: 2,
                      color: isCorrect ? OPTION_COLORS[opt] : "rgba(255,255,255,0.2)",
                      transition: "color 0.15s",
                    }}
                  >
                    <CheckCircle2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Correct Answer Selector */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Correct Answer *</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["A", "B", "C", "D"] as CorrectOption[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setForm((f) => ({ ...f, correctOption: opt }))}
                style={{
                  flex: 1, padding: "8px 4px",
                  background: form.correctOption === opt ? `${OPTION_COLORS[opt]}20` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${form.correctOption === opt ? OPTION_COLORS[opt] : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 8, cursor: "pointer",
                  color: form.correctOption === opt ? OPTION_COLORS[opt] : C.muted,
                  fontFamily: "Orbitron, monospace", fontSize: 13, fontWeight: 700,
                  transition: "all 0.15s",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Explanation */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Explanation (optional)</label>
          <textarea
            value={form.explanation}
            onChange={set("explanation")}
            placeholder="Explain why this answer is correct..."
            rows={2}
            style={{ ...inputStyle }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "12px",
              background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`,
              borderRadius: 10, cursor: "pointer", color: C.muted,
              fontFamily: "Orbitron, monospace", fontSize: 10, letterSpacing: "0.1em",
              transition: "all 0.15s",
            }}
          >
            CANCEL
          </button>
          <button
            onClick={() => valid && onSave(form)}
            disabled={!valid || saving}
            style={{
              flex: 2, padding: "12px",
              background: valid && !saving ? "rgba(0,255,136,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${valid && !saving ? C.green : "rgba(255,255,255,0.08)"}`,
              borderRadius: 10, cursor: valid && !saving ? "pointer" : "not-allowed",
              color: valid && !saving ? C.green : C.muted,
              fontFamily: "Orbitron, monospace", fontSize: 10, letterSpacing: "0.1em",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.15s",
            }}
          >
            {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
            {saving ? "SAVING..." : initial ? "SAVE CHANGES" : "ADD QUESTION"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Question Card ─────────────────────────────────────────────────────────────
function QuestionCard({
  q, index, onEdit, onDelete, onDuplicate,
}: {
  q: Question;
  index: number;
  onEdit: (q: Question) => void;
  onDelete: (q: Question) => void;
  onDuplicate: (q: Question) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const correctColor = OPTION_COLORS[q.correctOption as CorrectOption] ?? C.green;

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      marginBottom: 8,
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      {/* Header row */}
      <div
        style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "12px 14px", cursor: "pointer",
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Index badge */}
        <div style={{
          minWidth: 26, height: 26, borderRadius: 6,
          background: "rgba(0,255,136,0.08)", border: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "Orbitron, monospace", fontSize: 9, color: C.greenDim,
          flexShrink: 0, marginTop: 1,
        }}>
          {index + 1}
        </div>

        {/* Question text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, color: C.text, lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: expanded ? undefined : 2,
            WebkitBoxOrient: "vertical", overflow: expanded ? "visible" : "hidden",
          }}>
            {q.question}
          </div>
          {!expanded && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 9, fontFamily: "Orbitron, monospace",
                color: correctColor, letterSpacing: "0.1em",
                background: `${correctColor}15`, border: `1px solid ${correctColor}30`,
                borderRadius: 4, padding: "2px 6px",
              }}>
                {q.correctOption}
              </span>
              {q.explanation && (
                <span style={{ fontSize: 10, color: C.muted }}>Has explanation</span>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onDuplicate(q)}
            title="Duplicate"
            style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 5, borderRadius: 6, transition: "color 0.15s" }}
          >
            <Copy size={13} />
          </button>
          <button
            onClick={() => onEdit(q)}
            title="Edit"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#00c8ff", padding: 5, borderRadius: 6, transition: "color 0.15s" }}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(q)}
            title="Delete"
            style={{ background: "none", border: "none", cursor: "pointer", color: C.red, padding: 5, borderRadius: 6, transition: "color 0.15s" }}
          >
            <Trash2 size={13} />
          </button>
          <div style={{ color: C.muted, padding: 5 }}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ paddingTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(["A", "B", "C", "D"] as CorrectOption[]).map((opt) => {
              const text = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[opt];
              const isCorrect = q.correctOption === opt;
              const color = OPTION_COLORS[opt];
              return (
                <div key={opt} style={{
                  background: isCorrect ? `${color}10` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isCorrect ? `${color}40` : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 7, padding: "8px 10px",
                  display: "flex", alignItems: "flex-start", gap: 8,
                }}>
                  <span style={{
                    fontFamily: "Orbitron, monospace", fontSize: 10, fontWeight: 700,
                    color: isCorrect ? color : C.muted, flexShrink: 0, marginTop: 1,
                  }}>
                    {opt}
                  </span>
                  <span style={{ fontSize: 12, color: isCorrect ? C.text : C.muted, lineHeight: 1.4 }}>
                    {text}
                  </span>
                  {isCorrect && <CheckCircle2 size={12} color={color} style={{ flexShrink: 0, marginLeft: "auto", marginTop: 2 }} />}
                </div>
              );
            })}
          </div>
          {q.explanation && (
            <div style={{
              marginTop: 10, padding: "10px 12px",
              background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)",
              borderRadius: 7,
            }}>
              <div style={{ fontSize: 9, color: C.gold, letterSpacing: "0.12em", fontFamily: "Orbitron, monospace", marginBottom: 4 }}>
                EXPLANATION
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                {q.explanation}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Delete Confirm Dialog ─────────────────────────────────────────────────────
function DeleteConfirm({ question, onConfirm, onCancel }: { question: Question; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1100,
      background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: C.card, border: "1px solid rgba(255,68,68,0.3)",
        borderRadius: 14, padding: "24px 20px", maxWidth: 380, width: "100%",
        boxShadow: "0 0 30px rgba(255,68,68,0.1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <AlertCircle size={20} color={C.red} />
          <span style={{ fontFamily: "Orbitron, monospace", fontSize: 13, fontWeight: 700, color: C.red }}>DELETE QUESTION</span>
        </div>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
          Are you sure you want to delete this question? This action cannot be undone.
          <br /><br />
          <span style={{ color: C.text, fontStyle: "italic" }}>"{question.question.slice(0, 80)}{question.question.length > 80 ? "…" : ""}"</span>
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "11px", background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9,
            cursor: "pointer", color: C.muted,
            fontFamily: "Orbitron, monospace", fontSize: 10, letterSpacing: "0.1em",
          }}>CANCEL</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "11px", background: "rgba(255,68,68,0.12)",
            border: "1px solid rgba(255,68,68,0.35)", borderRadius: 9,
            cursor: "pointer", color: C.red,
            fontFamily: "Orbitron, monospace", fontSize: 10, letterSpacing: "0.1em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <Trash2 size={12} /> DELETE
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main QuizEditor Component ─────────────────────────────────────────────────
export default function QuizEditor() {
  const [modules, setModules]           = useState<Module[]>([]);
  const [selectedModule, setSelected]   = useState<Module | null>(null);
  const [questions, setQuestions]       = useState<Question[]>([]);
  const [loadingMods, setLoadingMods]   = useState(true);
  const [loadingQs, setLoadingQs]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [editTarget, setEditTarget]     = useState<Question | null | undefined>(undefined); // undefined=closed, null=new
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [toast, setToast]               = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [search, setSearch]             = useState("");

  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
  }, []);

  // Load modules
  useEffect(() => {
    setLoadingMods(true);
    apiFetch("/admin/quiz/modules")
      .then((data) => setModules(data as Module[]))
      .catch((err) => showToast(err.message, "err"))
      .finally(() => setLoadingMods(false));
  }, [showToast]);

  // Load questions when module selected
  const loadQuestions = useCallback((mod: Module) => {
    setLoadingQs(true);
    setQuestions([]);
    apiFetch(`/admin/quiz/questions?moduleId=${mod.id}`)
      .then((data) => setQuestions(data as Question[]))
      .catch((err) => showToast(err.message, "err"))
      .finally(() => setLoadingQs(false));
  }, [showToast]);

  const selectModule = (mod: Module) => {
    setSelected(mod);
    setSearch("");
    loadQuestions(mod);
  };

  // Save (create or update)
  const handleSave = async (form: QuestionForm) => {
    if (!selectedModule) return;
    setSaving(true);
    try {
      if (editTarget) {
        // Update
        const updated = await apiFetch(`/admin/quiz/questions/${editTarget.id}`, {
          method: "PUT",
          body: JSON.stringify({ ...form, moduleId: selectedModule.id }),
        }) as Question;
        setQuestions((qs) => qs.map((q) => (q.id === updated.id ? updated : q)));
        showToast("Question updated successfully");
      } else {
        // Create
        const created = await apiFetch("/admin/quiz/questions", {
          method: "POST",
          body: JSON.stringify({ ...form, moduleId: selectedModule.id, order: questions.length }),
        }) as Question;
        setQuestions((qs) => [...qs, created]);
        showToast("Question added successfully");
      }
      setEditTarget(undefined);
    } catch (err: unknown) {
      showToast((err as Error).message, "err");
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/quiz/questions/${deleteTarget.id}`, { method: "DELETE" });
      setQuestions((qs) => qs.filter((q) => q.id !== deleteTarget.id));
      showToast("Question deleted");
      setDeleteTarget(null);
    } catch (err: unknown) {
      showToast((err as Error).message, "err");
    } finally {
      setSaving(false);
    }
  };

  // Duplicate
  const handleDuplicate = async (q: Question) => {
    if (!selectedModule) return;
    setSaving(true);
    try {
      const created = await apiFetch("/admin/quiz/questions", {
        method: "POST",
        body: JSON.stringify({
          moduleId: selectedModule.id,
          question:      q.question + " (copy)",
          optionA:       q.optionA,
          optionB:       q.optionB,
          optionC:       q.optionC,
          optionD:       q.optionD,
          correctOption: q.correctOption,
          explanation:   q.explanation ?? "",
          order:         questions.length,
        }),
      }) as Question;
      setQuestions((qs) => [...qs, created]);
      showToast("Question duplicated");
    } catch (err: unknown) {
      showToast((err as Error).message, "err");
    } finally {
      setSaving(false);
    }
  };

  const filtered = questions.filter((q) =>
    search.trim() === "" ||
    q.question.toLowerCase().includes(search.toLowerCase()) ||
    q.optionA.toLowerCase().includes(search.toLowerCase()) ||
    q.optionB.toLowerCase().includes(search.toLowerCase())
  );

  // ── Render: Module List ────────────────────────────────────────────────────
  if (!selectedModule) {
    return (
      <div style={{ padding: "16px", minHeight: "100vh", background: C.bg }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "Orbitron, monospace", fontSize: 9, color: C.greenDim, letterSpacing: "0.3em", marginBottom: 4 }}>
            ADMIN PANEL
          </div>
          <div style={{ fontFamily: "Orbitron, monospace", fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
            QUIZ EDITOR
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            Select a module to manage its questions
          </div>
        </div>

        {loadingMods ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 10, color: C.muted }}>
            <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 12 }}>Loading modules...</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {modules.map((mod) => (
              <button
                key={mod.id}
                onClick={() => selectModule(mod)}
                style={{
                  width: "100%", textAlign: "left",
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: "14px 16px",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 12,
                  transition: "border-color 0.2s, background 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderHi;
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,255,136,0.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;
                  (e.currentTarget as HTMLButtonElement).style.background = C.card;
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: `${mod.color ?? "#1e90ff"}15`,
                  border: `1px solid ${mod.color ?? "#1e90ff"}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18,
                }}>
                  <BookOpen size={18} color={mod.color ?? C.green} strokeWidth={1.5} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>{mod.title}</div>
                  {mod.subtitle && <div style={{ fontSize: 11, color: C.muted }}>{mod.subtitle}</div>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "Orbitron, monospace", fontSize: 16, fontWeight: 700, color: C.green }}>
                    —
                  </div>
                  <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.08em" }}>QUESTIONS</div>
                </div>
                <ChevronDown size={14} color={C.muted} style={{ transform: "rotate(-90deg)" }} />
              </button>
            ))}
            {modules.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
                <HelpCircle size={32} style={{ margin: "0 auto 12px", opacity: 0.3, display: "block" }} />
                <div style={{ fontFamily: "Orbitron, monospace", fontSize: 11 }}>NO MODULES FOUND</div>
              </div>
            )}
          </div>
        )}

        {/* CSS animations */}
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fadeInUp { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        `}</style>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  // ── Render: Question List ──────────────────────────────────────────────────
  return (
    <div style={{ padding: "16px", minHeight: "100vh", background: C.bg }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16 }}>
        <button
          onClick={() => { setSelected(null); setQuestions([]); setSearch(""); }}
          style={{
            background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: C.muted,
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            transition: "all 0.15s",
          }}
        >
          <ChevronLeft size={14} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Orbitron, monospace", fontSize: 9, color: C.greenDim, letterSpacing: "0.2em", marginBottom: 2 }}>
            QUIZ EDITOR
          </div>
          <div style={{
            fontFamily: "Orbitron, monospace", fontSize: 15, fontWeight: 700, color: "#fff",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {selectedModule.title.toUpperCase()}
          </div>
        </div>
        <button
          onClick={() => loadQuestions(selectedModule)}
          title="Refresh"
          style={{
            background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: C.muted,
            display: "flex", alignItems: "center", flexShrink: 0,
            transition: "all 0.15s",
          }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { label: "TOTAL",    value: questions.length,                                          color: C.green },
          { label: "FILTERED", value: filtered.length,                                           color: "#00c8ff" },
          { label: "MODULE",   value: `#${selectedModule.id}`,                                   color: C.gold },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "10px 8px", textAlign: "center",
          }}>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: 16, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 8, color: C.muted, letterSpacing: "0.08em", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Search + Add */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted, pointerEvents: "none" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions..."
            style={{
              width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 8, color: C.text, fontSize: 13, outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>
        <button
          onClick={() => setEditTarget(null)}
          style={{
            background: "rgba(0,255,136,0.1)", border: `1px solid ${C.green}`,
            borderRadius: 8, padding: "9px 14px", cursor: "pointer", color: C.green,
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            fontFamily: "Orbitron, monospace", fontSize: 10, letterSpacing: "0.1em",
            transition: "all 0.15s",
          }}
        >
          <Plus size={14} /> ADD
        </button>
      </div>

      {/* Questions */}
      {loadingQs ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 10, color: C.muted }}>
          <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 12 }}>Loading questions...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
          <HelpCircle size={32} style={{ margin: "0 auto 12px", opacity: 0.3, display: "block" }} />
          <div style={{ fontFamily: "Orbitron, monospace", fontSize: 11, marginBottom: 8 }}>
            {search ? "NO MATCHING QUESTIONS" : "NO QUESTIONS YET"}
          </div>
          {!search && (
            <button
              onClick={() => setEditTarget(null)}
              style={{
                marginTop: 8, background: "rgba(0,255,136,0.08)", border: `1px solid ${C.green}40`,
                borderRadius: 8, padding: "10px 20px", cursor: "pointer", color: C.green,
                fontFamily: "Orbitron, monospace", fontSize: 10, letterSpacing: "0.1em",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <Plus size={13} /> ADD FIRST QUESTION
            </button>
          )}
        </div>
      ) : (
        <div>
          {filtered.map((q, i) => (
            <QuestionCard
              key={q.id}
              q={q}
              index={i}
              onEdit={(q) => setEditTarget(q)}
              onDelete={(q) => setDeleteTarget(q)}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {editTarget !== undefined && (
        <QuestionFormModal
          initial={editTarget}
          moduleId={selectedModule.id}
          onSave={handleSave}
          onCancel={() => setEditTarget(undefined)}
          saving={saving}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          question={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* CSS animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>
    </div>
  );
}
