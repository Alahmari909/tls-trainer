import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import V2Layout from "./layout";
import { MODULES_DATA, type Lesson } from "./_data";

export default function V2Module() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const moduleId = parseInt(id ?? "1");
  const module = MODULES_DATA.find(m => m.id === moduleId);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    if (module && module.lessons.length > 0 && !activeLesson) {
      setActiveLesson(module.lessons[0]);
    }
  }, [module]);

  if (!module) {
    return (
      <V2Layout>
        <div style={{ textAlign: "center", padding: "4rem", color: "#64748b" }}>
          Module not found. <button onClick={() => setLocation("/v2/trainee")} style={{ color: "#00ff88", background: "none", border: "none", cursor: "pointer" }}>Go back</button>
        </div>
      </V2Layout>
    );
  }

  const lessonIdx = activeLesson ? module.lessons.findIndex(l => l.id === activeLesson.id) : 0;

  const markProgress = (idx: number) => {
    const pct = Math.round(((idx + 1) / module.lessons.length) * 100);
    localStorage.setItem(`v2_progress_${module.id}`, String(pct));
    localStorage.setItem(`v2_lesson_${module.id}`, String(idx));
  };

  const goNext = () => {
    const nextIdx = lessonIdx + 1;
    if (nextIdx < module.lessons.length) {
      setActiveLesson(module.lessons[nextIdx]);
      markProgress(nextIdx);
    } else {
      // Module complete
      localStorage.setItem(`v2_progress_${module.id}`, "100");
      setLocation("/v2/trainee");
    }
  };

  const goPrev = () => {
    const prevIdx = lessonIdx - 1;
    if (prevIdx >= 0) {
      setActiveLesson(module.lessons[prevIdx]);
    }
  };

  return (
    <V2Layout role="trainee">
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", fontSize: "0.8rem", color: "#475569" }}>
        <button onClick={() => setLocation("/v2/trainee")} style={{ background: "none", border: "none", color: "#00ff88", cursor: "pointer", fontSize: "0.8rem" }}>
          ← Back to Modules
        </button>
        <span>/</span>
        <span style={{ color: "#94a3b8" }}>{module.title}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Sidebar: lesson list */}
        <div style={{
          background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "12px", overflow: "hidden", position: "sticky", top: "80px",
        }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: "0.68rem", letterSpacing: "0.12em", color: "#00ff88", marginBottom: "0.25rem" }}>MODULE {String(module.order).padStart(2, "0")}</div>
            <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.95rem" }}>{module.title}</div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>{module.lessons.length} lessons</div>
          </div>
          <div style={{ padding: "0.5rem 0" }}>
            {module.lessons.map((lesson, idx) => {
              const savedIdx = parseInt(localStorage.getItem(`v2_lesson_${module.id}`) ?? "-1");
              const isCompleted = idx <= savedIdx;
              const isActive = activeLesson?.id === lesson.id;
              return (
                <div
                  key={lesson.id}
                  onClick={() => setActiveLesson(lesson)}
                  style={{
                    padding: "0.75rem 1.25rem", cursor: "pointer",
                    background: isActive ? "rgba(0,255,136,0.08)" : "transparent",
                    borderLeft: isActive ? "3px solid #00ff88" : "3px solid transparent",
                    display: "flex", alignItems: "center", gap: "0.75rem",
                    transition: "all 0.15s",
                  }}>
                  <div style={{
                    width: "20px", height: "20px", borderRadius: "50%", flexShrink: 0,
                    background: isCompleted ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isCompleted ? "rgba(0,255,136,0.5)" : "rgba(255,255,255,0.1)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.6rem", color: isCompleted ? "#00ff88" : "#475569",
                  }}>
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: isActive ? 600 : 400, color: isActive ? "#e2e8f0" : "#94a3b8" }}>
                      {lesson.title}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#475569" }}>{lesson.duration}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <div>
          {activeLesson && (
            <div style={{
              background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px", padding: "2rem",
            }}>
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontSize: "0.7rem", letterSpacing: "0.15em", color: "#00ff88", marginBottom: "0.5rem" }}>
                  LESSON {lessonIdx + 1} OF {module.lessons.length}
                </div>
                <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#e2e8f0", margin: "0 0 0.5rem" }}>
                  {activeLesson.title}
                </h1>
                <span style={{
                  fontSize: "0.72rem", padding: "0.2rem 0.6rem",
                  background: "rgba(0,255,136,0.1)", color: "#00ff88",
                  border: "1px solid rgba(0,255,136,0.2)", borderRadius: "20px",
                }}>⏱ {activeLesson.duration}</span>
              </div>

              {/* Content */}
              <div style={{ lineHeight: 1.8, color: "#94a3b8", fontSize: "0.92rem", marginBottom: "2rem" }}>
                {activeLesson.content.split("\n\n").map((para, i) => {
                  if (para.startsWith("**") && para.includes(":**")) {
                    // Section heading
                    const parts = para.split(":**");
                    const heading = parts[0].replace(/\*\*/g, "");
                    const rest = parts.slice(1).join(":**");
                    return (
                      <div key={i} style={{ marginBottom: "1rem" }}>
                        <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "1rem", marginBottom: "0.5rem" }}>
                          {heading}:
                        </div>
                        {rest && <p style={{ margin: 0 }}>{renderInline(rest)}</p>}
                      </div>
                    );
                  }
                  // Bullet list
                  if (para.includes("\n- ")) {
                    const lines = para.split("\n");
                    return (
                      <div key={i} style={{ marginBottom: "1rem" }}>
                        {lines.map((line, j) => {
                          if (line.startsWith("- ")) {
                            return (
                              <div key={j} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginBottom: "0.4rem" }}>
                                <span style={{ color: "#00ff88", flexShrink: 0, marginTop: "0.15rem" }}>▸</span>
                                <span>{renderInline(line.slice(2))}</span>
                              </div>
                            );
                          }
                          return <p key={j} style={{ margin: "0 0 0.5rem" }}>{renderInline(line)}</p>;
                        })}
                      </div>
                    );
                  }
                  return <p key={i} style={{ margin: "0 0 1rem" }}>{renderInline(para)}</p>;
                })}
              </div>

              {/* Key Points */}
              {activeLesson.keyPoints.length > 0 && (
                <div style={{
                  background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.15)",
                  borderRadius: "10px", padding: "1.25rem",
                  marginBottom: "2rem",
                }}>
                  <div style={{ fontSize: "0.72rem", letterSpacing: "0.12em", color: "#00ff88", marginBottom: "0.75rem", fontWeight: 600 }}>
                    KEY POINTS
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.5rem" }}>
                    {activeLesson.keyPoints.map((point, i) => (
                      <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.82rem", color: "#94a3b8" }}>
                        <span style={{ color: "#00ff88", flexShrink: 0 }}>✓</span>
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div style={{ display: "flex", gap: "1rem", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  onClick={goPrev}
                  disabled={lessonIdx === 0}
                  style={{
                    padding: "0.6rem 1.25rem", borderRadius: "8px", cursor: lessonIdx === 0 ? "not-allowed" : "pointer",
                    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                    color: lessonIdx === 0 ? "#334155" : "#94a3b8", fontSize: "0.85rem",
                  }}>
                  ← Previous
                </button>
                <span style={{ fontSize: "0.75rem", color: "#475569" }}>
                  {lessonIdx + 1} / {module.lessons.length}
                </span>
                <button
                  onClick={goNext}
                  style={{
                    padding: "0.6rem 1.5rem", borderRadius: "8px", cursor: "pointer",
                    background: "#00ff88", border: "none",
                    color: "#050a0e", fontSize: "0.85rem", fontWeight: 700,
                  }}>
                  {lessonIdx === module.lessons.length - 1 ? "Complete Module ✓" : "Next Lesson →"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </V2Layout>
  );
}

function renderInline(text: string): React.ReactNode {
  // Handle **bold** text
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} style={{ color: "#e2e8f0", fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
