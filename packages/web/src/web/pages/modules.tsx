import { useState, useEffect, useRef } from "react";
import BackButton from "../components/BackButton";
import { telegramTrack, getSession } from "../hooks/useTelegramTrack";

type Module = {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  lessonCount: number;
  progress?: number;
};

type Lesson = {
  id: number;
  moduleId: number;
  title: string;
  content: string;
  order: number;
};

// PDF mapping — one PDF per module, exact filenames
const MODULE_PDFS: Record<number, { label: string; file: string }> = {
  1: { label: "TLS_ANPC_English.pdf",                    file: "TLS_ANPC_English.pdf" },
  2: { label: "TLS_Training_June_2021_KSA.pdf",          file: "TLS_Training_June_2021_KSA.pdf" },
  3: { label: "020-00073_RevF.pdf",                      file: "020-00073_RevF.pdf" },
  4: { label: "020-00072_RevF.pdf",                      file: "020-00072_RevF.pdf" },
  5: { label: "020-00071_RevE.pdf",                      file: "020-00071_RevE.pdf" },
  6: { label: "020-00074_RevG.pdf",                      file: "020-00074_RevG.pdf" },
  7: { label: "020-00076_RevD.pdf",                      file: "020-00076_RevD.pdf" },
  8: { label: "020-00077_RevC.pdf",                      file: "020-00077_RevC.pdf" },
  9: { label: "ATC_quick_guide_TLS.pdf",                 file: "ATC_quick_guide_TLS.pdf" },
};

// ── Simple Markdown-to-HTML renderer (no deps) ─────────────────────────────────
function renderMarkdown(md: string, accentColor: string): string {
  let html = md
    // Tables
    .replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/g, (_match, header, body) => {
      const headerCols = header.split("|").map((c: string) => c.trim()).filter(Boolean);
      const headerHtml = headerCols.map((c: string) => `<th>${c}</th>`).join("");
      const bodyRows = body.trim().split("\n").map((row: string) => {
        const cols = row.split("|").map((c: string) => c.trim()).filter(Boolean);
        return `<tr>${cols.map((c: string) => `<td>${c}</td>`).join("")}</tr>`;
      }).join("");
      return `<table class="md-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyRows}</tbody></table>`;
    })
    // Code blocks
    .replace(/```[\w]*\n?([\s\S]*?)```/g, (_m: string, code: string) =>
      `<pre class="md-code">${code.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, "<code class=\"md-inline-code\">$1</code>")
    // H2
    .replace(/^## (.+)$/gm, `<h2 class="md-h2" style="color:${accentColor}">$1</h2>`)
    // H3
    .replace(/^### (.+)$/gm, `<h3 class="md-h3">$1</h3>`)
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Numbered list
    .replace(/^\d+\. (.+)$/gm, "<li class=\"md-li-num\">$1</li>")
    // Bullet list
    .replace(/^[-•] (.+)$/gm, "<li class=\"md-li\">$1</li>")
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, "<ul class=\"md-ul\">$1</ul>")
    // Line breaks
    .replace(/\n\n/g, "<br/><br/>");
  return html;
}

export default function Modules() {
  const [modules, setModules] = useState<Module[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfStatus, setPdfStatus] = useState<Record<string, boolean>>({});

  // Lessons state
  const [lessons, setLessons] = useState<Record<number, Lesson[]>>({});
  const [lessonsLoading, setLessonsLoading] = useState<Record<number, boolean>>({});
  const [activeLesson, setActiveLesson] = useState<{ modId: number; lessonId: number } | null>(null);
  const [questionCount, setQuestionCount] = useState<Record<number, number>>({});

  useEffect(() => {
    fetch("/api/modules")
      .then(r => r.json())
      .then(data => { setModules(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Check which PDFs exist
  useEffect(() => {
    const checkPdfs = async () => {
      const status: Record<string, boolean> = {};
      for (const pdf of Object.values(MODULE_PDFS)) {
        try {
          const r = await fetch(`/pdfs/${pdf.file}`, { method: "HEAD" });
          status[pdf.file] = r.ok;
        } catch {
          status[pdf.file] = false;
        }
      }
      setPdfStatus(status);
    };
    checkPdfs();
  }, []);

  // Load lessons for a module
  const loadLessons = async (modId: number) => {
    if (lessons[modId]) return; // already loaded
    setLessonsLoading(prev => ({ ...prev, [modId]: true }));
    try {
      const [lessonsRes, questionsRes] = await Promise.all([
        fetch(`/api/modules/${modId}/lessons`).then(r => r.json()),
        fetch(`/api/modules/${modId}/questions`).then(r => r.json()),
      ]);
      setLessons(prev => ({ ...prev, [modId]: lessonsRes }));
      setQuestionCount(prev => ({ ...prev, [modId]: Array.isArray(questionsRes) ? questionsRes.length : 0 }));
    } catch {
      setLessons(prev => ({ ...prev, [modId]: [] }));
    } finally {
      setLessonsLoading(prev => ({ ...prev, [modId]: false }));
    }
  };

  // Module time tracking
  const moduleOpenTimeRef = useRef<number | null>(null);
  const moduleOpenIdRef   = useRef<{ id: number; title: string } | null>(null);

  const postModuleTime = (durationMs: number) => {
    if (!moduleOpenIdRef.current || durationMs < 3000) return;
    const traineeId = getSession()?.id;
    if (!traineeId) return;
    fetch('/api/trainee/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-trainee-id': traineeId },
      body: JSON.stringify({
        traineeId,
        moduleId: moduleOpenIdRef.current.id,
        moduleName: moduleOpenIdRef.current.title,
        durationMs,
      }),
    }).catch(() => {});
  };

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && moduleOpenTimeRef.current != null) {
        postModuleTime(Date.now() - moduleOpenTimeRef.current);
        moduleOpenIdRef.current = null;
        moduleOpenTimeRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (moduleOpenTimeRef.current != null) {
        postModuleTime(Date.now() - moduleOpenTimeRef.current);
      }
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const toggle = (id: number) => {
    const now = Date.now();
    if (moduleOpenIdRef.current && moduleOpenTimeRef.current != null) {
      postModuleTime(now - moduleOpenTimeRef.current);
      moduleOpenIdRef.current = null;
      moduleOpenTimeRef.current = null;
    }
    if (selected === id) {
      setSelected(null);
      setActiveLesson(null);
      return;
    }
    setSelected(id);
    setActiveLesson(null);
    const mod = modules.find(m => m.id === id);
    if (mod) {
      telegramTrack.moduleOpen(mod.title);
      moduleOpenIdRef.current = { id: mod.id, title: mod.title };
      moduleOpenTimeRef.current = now;
    }
    loadLessons(id);
  };

  const handleOpen = (e: React.MouseEvent, file: string) => {
    e.stopPropagation();
    window.open(`/pdfs/${file}`, "_blank", "noopener,noreferrer");
  };

  const handleSave = (e: React.MouseEvent, file: string, label: string) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = `/pdfs/${file}`;
    a.download = label;
    a.click();
  };

  const handleStartQuiz = (e: React.MouseEvent, modId: number) => {
    e.stopPropagation();
    window.location.href = `/quiz/${modId}`;
  };

  // Get current lesson object
  const getCurrentLesson = (): Lesson | null => {
    if (!activeLesson) return null;
    return lessons[activeLesson.modId]?.find(l => l.id === activeLesson.lessonId) ?? null;
  };

  const currentLesson = getCurrentLesson();
  const currentMod = currentLesson ? modules.find(m => m.id === activeLesson?.modId) : null;

  return (
    <div className="page" style={{ background: "var(--bg-primary)" }}>

      {/* ── Lesson Detail Overlay ──────────────────────────────────────── */}
      {currentLesson && currentMod && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "var(--bg-primary)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}>
          {/* Lesson header */}
          <div style={{
            padding: "14px 16px 12px",
            borderBottom: `1px solid ${currentMod.color}30`,
            background: `linear-gradient(135deg, ${currentMod.color}15 0%, transparent 100%)`,
            flexShrink: 0,
            position: "sticky", top: 0, zIndex: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <button
                onClick={() => setActiveLesson(null)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  color: currentMod.color, padding: 0,
                  fontFamily: "Orbitron", fontSize: 10, letterSpacing: "0.1em",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                {t("back_to_module")}
              </button>
              <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>|</span>
              <button
                onClick={() => { setActiveLesson(null); setSelected(null); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  color: "rgba(255,255,255,0.4)", padding: 0,
                  fontFamily: "Orbitron", fontSize: 10, letterSpacing: "0.1em",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                {t("modules_list")}
              </button>
            </div>
            <div className="font-orbitron" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
              {currentLesson.title}
            </div>
            <div style={{ fontSize: 11, color: currentMod.color, opacity: 0.8 }}>
              {currentMod.icon} {currentMod.title}
            </div>
          </div>

          {/* Lesson content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            <div
              className="lesson-content"
              style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, maxWidth: 680 }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(currentLesson.content ?? "", currentMod.color) }}
            />
          </div>

          {/* Lesson nav */}
          <div style={{
            padding: "12px 16px",
            borderTop: `1px solid ${currentMod.color}20`,
            display: "flex", gap: 8,
            flexShrink: 0,
          }}>
            {(() => {
              const modLessons = lessons[currentMod.id] ?? [];
              const idx = modLessons.findIndex(l => l.id === currentLesson.id);
              const prev = modLessons[idx - 1];
              const next = modLessons[idx + 1];
              return (
                <>
                  <button
                    disabled={!prev}
                    onClick={() => prev && setActiveLesson({ modId: currentMod.id, lessonId: prev.id })}
                    style={{
                      flex: 1, padding: "10px",
                      background: prev ? `${currentMod.color}15` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${prev ? currentMod.color + "40" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 8, cursor: prev ? "pointer" : "not-allowed",
                      color: prev ? currentMod.color : "var(--text-muted)",
                      fontFamily: "Orbitron", fontSize: 9, letterSpacing: "0.08em",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    PREV
                  </button>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 12px",
                    color: "var(--text-muted)", fontSize: 10, fontFamily: "Orbitron",
                    flexShrink: 0,
                  }}>
                    {idx + 1}/{modLessons.length}
                  </div>
                  {next ? (
                    <button
                      onClick={() => setActiveLesson({ modId: currentMod.id, lessonId: next.id })}
                      style={{
                        flex: 1, padding: "10px",
                        background: `${currentMod.color}25`,
                        border: `1px solid ${currentMod.color}60`,
                        borderRadius: 8, cursor: "pointer",
                        color: currentMod.color,
                        fontFamily: "Orbitron", fontSize: 9, letterSpacing: "0.08em",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}
                    >
                      NEXT
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleStartQuiz(e, currentMod.id)}
                      style={{
                        flex: 1, padding: "10px",
                        background: `${currentMod.color}30`,
                        border: `1px solid ${currentMod.color}70`,
                        borderRadius: 8, cursor: "pointer",
                        color: currentMod.color,
                        fontFamily: "Orbitron", fontSize: 9, letterSpacing: "0.08em",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        fontWeight: 700,
                      }}
                    >
                      START QUIZ
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="radar-grid" style={{
        padding: "16px 20px 14px",
        borderBottom: "1px solid rgba(30,144,255,0.15)"
      }}>
        <div style={{ marginBottom: 10 }}>
          <BackButton to="/" />
        </div>
        <div className="font-orbitron text-glow" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
          TRAINING MODULES
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          {modules.length} modules available
        </div>
      </div>

      {/* Modules */}
      <div style={{ padding: "16px" }}>
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="glass-card" style={{ height: 90, marginBottom: 12, opacity: 0.4, animation: "pulse-glow 1.5s ease infinite" }} />
          ))
        ) : (
          modules.map((mod, i) => {
            const pdf = MODULE_PDFS[mod.id];
            const pdfAvailable = pdf && pdfStatus[pdf.file];
            const modLessons = lessons[mod.id] ?? [];
            const qCount = questionCount[mod.id] ?? 0;
            const isLoading = lessonsLoading[mod.id];

            return (
              <div
                key={mod.id}
                className="glass-card fade-in"
                style={{ marginBottom: 12, border: `1px solid ${mod.color}30`, overflow: "hidden", cursor: "pointer", animationDelay: `${i * 0.07}s` }}
                onClick={() => toggle(mod.id)}
              >
                {/* Module Row */}
                <div style={{
                  padding: "16px",
                  background: `linear-gradient(135deg, ${mod.color}15 0%, transparent 100%)`,
                  display: "flex", alignItems: "center", gap: 14
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 10,
                    background: `${mod.color}20`,
                    border: `1px solid ${mod.color}50`,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", flexShrink: 0, gap: 1
                  }}>
                    <span style={{ fontSize: 18 }}>{mod.icon}</span>
                    <span className="font-orbitron" style={{ fontSize: 8, color: mod.color }}>{String(i + 1).padStart(2, "0")}</span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-orbitron" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                      {mod.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {mod.subtitle} · {mod.lessonCount} lessons
                    </div>
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div className="progress-fill" style={{ width: `${mod.progress ?? 0}%`, background: `linear-gradient(90deg, ${mod.color}, #00d4ff)` }} />
                      </div>
                      <span className="font-orbitron" style={{ fontSize: 10, color: mod.color }}>{mod.progress ?? 0}%</span>
                    </div>
                  </div>

                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={mod.color} strokeWidth="2"
                    style={{ transform: selected === mod.id ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>

                {/* Expanded */}
                {selected === mod.id && (
                  <div style={{ borderTop: `1px solid ${mod.color}20` }} onClick={e => e.stopPropagation()}>

                    {/* Description */}
                    <div style={{ padding: "14px 16px 0" }}>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 14px", lineHeight: 1.6 }}>
                        {mod.description}
                      </p>
                    </div>

                    {/* Lessons Section */}
                    <div style={{ padding: "0 16px 14px" }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 8, fontFamily: "Orbitron" }}>
                        LESSONS
                      </div>

                      {isLoading ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          {[...Array(3)].map((_, j) => (
                            <div key={j} style={{ height: 60, flex: 1, borderRadius: 8, background: "rgba(255,255,255,0.04)", animation: "pulse-glow 1.5s ease infinite" }} />
                          ))}
                        </div>
                      ) : modLessons.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {modLessons.map((lesson, li) => (
                            <button
                              key={lesson.id}
                              onClick={() => setActiveLesson({ modId: mod.id, lessonId: lesson.id })}
                              style={{
                                width: "100%",
                                padding: "10px 14px",
                                background: `${mod.color}0d`,
                                border: `1px solid ${mod.color}30`,
                                borderRadius: 8,
                                cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 10,
                                textAlign: "left",
                              }}
                            >
                              <div style={{
                                width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                                background: `${mod.color}25`, border: `1px solid ${mod.color}50`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontFamily: "Orbitron", fontSize: 9, color: mod.color, fontWeight: 700,
                              }}>
                                {li + 1}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>
                                  {lesson.title}
                                </div>
                                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                                  Tap to read →
                                </div>
                              </div>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={mod.color} strokeWidth="2.5" style={{ flexShrink: 0 }}>
                                <path d="M9 18l6-6-6-6"/>
                              </svg>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>
                          No lessons available yet.
                        </div>
                      )}
                    </div>

                    {/* Quiz Button */}
                    <div style={{ padding: "0 16px 14px" }}>
                      <button
                        onClick={(e) => handleStartQuiz(e, mod.id)}
                        style={{
                          width: "100%",
                          padding: "12px",
                          background: `linear-gradient(135deg, ${mod.color}25 0%, ${mod.color}15 100%)`,
                          border: `1px solid ${mod.color}60`,
                          borderRadius: 10,
                          cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          color: mod.color,
                          fontFamily: "Orbitron", fontSize: 11, letterSpacing: "0.1em", fontWeight: 700,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                          START QUIZ
                        </div>
                        <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>
                          {qCount > 0 ? `${qCount} questions` : "loading..."}
                        </span>
                      </button>
                    </div>

                    {/* PDF Section */}
                    {pdf && (
                      <div style={{ padding: "0 16px 16px" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 8, fontFamily: "Orbitron" }}>
                          REFERENCE DOCUMENT
                        </div>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "12px 14px",
                          background: `${mod.color}0d`,
                          border: `1px solid ${mod.color}35`,
                          borderRadius: 10,
                        }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                            background: `${mod.color}20`, border: `1px solid ${mod.color}50`,
                            display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={mod.color} strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <line x1="16" y1="13" x2="8" y2="13"/>
                              <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {pdf.label}
                            </div>
                            {!pdfAvailable && (
                              <div style={{ fontSize: 10, color: "#ff6b35", marginTop: 2 }}>pending upload</div>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button
                              onClick={(e) => handleOpen(e, pdf.file)}
                              disabled={!pdfAvailable}
                              style={{
                                padding: "6px 12px",
                                background: pdfAvailable ? `${mod.color}25` : "rgba(255,255,255,0.05)",
                                border: `1px solid ${pdfAvailable ? mod.color + "70" : "rgba(255,255,255,0.1)"}`,
                                borderRadius: 6, cursor: pdfAvailable ? "pointer" : "not-allowed",
                                color: pdfAvailable ? mod.color : "var(--text-muted)",
                                fontFamily: "Orbitron", fontSize: 9, letterSpacing: "0.08em",
                                display: "flex", alignItems: "center", gap: 4
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                              OPEN
                            </button>
                            <button
                              onClick={(e) => handleSave(e, pdf.file, pdf.label)}
                              disabled={!pdfAvailable}
                              style={{
                                padding: "6px 12px",
                                background: pdfAvailable ? `${mod.color}15` : "rgba(255,255,255,0.05)",
                                border: `1px solid ${pdfAvailable ? mod.color + "50" : "rgba(255,255,255,0.1)"}`,
                                borderRadius: 6, cursor: pdfAvailable ? "pointer" : "not-allowed",
                                color: pdfAvailable ? mod.color : "var(--text-muted)",
                                fontFamily: "Orbitron", fontSize: 9, letterSpacing: "0.08em",
                                display: "flex", alignItems: "center", gap: 4
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                              </svg>
                              SAVE
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Lesson content styles */}
      <style>{`
        .lesson-content h2.md-h2 {
          font-family: 'Orbitron', sans-serif;
          font-size: 15px;
          font-weight: 700;
          margin: 20px 0 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          letter-spacing: 0.05em;
        }
        .lesson-content h3.md-h3 {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 16px 0 8px;
        }
        .lesson-content .md-table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
          font-size: 11px;
        }
        .lesson-content .md-table th {
          background: rgba(255,255,255,0.06);
          padding: 7px 10px;
          text-align: left;
          color: var(--text-primary);
          font-weight: 700;
          border: 1px solid rgba(255,255,255,0.1);
          font-size: 10px;
          letter-spacing: 0.05em;
        }
        .lesson-content .md-table td {
          padding: 6px 10px;
          border: 1px solid rgba(255,255,255,0.08);
          color: var(--text-secondary);
          vertical-align: top;
        }
        .lesson-content .md-table tr:nth-child(even) td {
          background: rgba(255,255,255,0.02);
        }
        .lesson-content .md-code {
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          padding: 12px;
          font-size: 11px;
          color: #7ec8e3;
          overflow-x: auto;
          margin: 10px 0;
          white-space: pre;
          font-family: 'Courier New', monospace;
        }
        .lesson-content .md-inline-code {
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 3px;
          padding: 1px 5px;
          font-size: 11px;
          color: #7ec8e3;
          font-family: 'Courier New', monospace;
        }
        .lesson-content .md-ul {
          margin: 8px 0;
          padding: 0;
          list-style: none;
        }
        .lesson-content .md-li {
          padding: 3px 0 3px 16px;
          position: relative;
          font-size: 12px;
        }
        .lesson-content .md-li::before {
          content: '▸';
          position: absolute;
          left: 0;
          opacity: 0.5;
          font-size: 10px;
        }
        .lesson-content .md-li-num {
          padding: 3px 0 3px 20px;
          position: relative;
          font-size: 12px;
          counter-increment: list;
        }
        .lesson-content strong {
          color: var(--text-primary);
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
