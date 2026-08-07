import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface FaultMedia {
  id: number;
  fault_id: number;
  mime_type: string;
  filename: string;
  caption?: string;
  sort_order: number;
}

interface Fault {
  id: number;
  title: string;
  category?: string;
  cause: string;
  solution: string;
  error_message?: string;
  symptom?: string;
  quick_check?: string;
  fix_procedure?: string;
  verify_text?: string;
  published?: number;
  created_at: number;
  media: FaultMedia[];
}

function mediaUrl(faultId: number, mediaId: number) {
  return `/api/faults/${faultId}/media/${mediaId}`;
}

function isVideo(mime: string) {
  return mime.startsWith("video/");
}
function isImage(mime: string) {
  return mime.startsWith("image/");
}
function isPdf(mime: string) {
  return mime === "application/pdf";
}

const LTR: React.CSSProperties = { direction: "ltr", textAlign: "left", unicodeBidi: "isolate" };

// ── Zoomable Image Viewer ─────────────────────────────────────────────────────
function ImageViewer({
  items,
  index,
  onClose,
}: {
  items: { url: string; caption: string }[];
  index: number;
  onClose: () => void;
}) {
  const [cur, setCur] = useState(index);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const reset = useCallback(() => { setScale(1); setTx(0); setTy(0); }, []);

  const go = useCallback((dir: number) => {
    setCur((i) => Math.min(Math.max(i + dir, 0), items.length - 1));
    reset();
  }, [items.length, reset]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(s + 0.5, 6));
      if (e.key === "-") setScale((s) => Math.max(s - 0.5, 1));
      if (e.key === "0") reset();
    };
    window.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose, reset]);

  const item = items[cur];
  if (!item) return null;

  const dist = (t: TouchList) => {
    const a = t[0], b = t[1];
    if (!a || !b) return 0;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  const body = (
    <div
      style={{
        position: "fixed", inset: 0, background: "#000",
        zIndex: 100000, display: "flex", flexDirection: "column",
        touchAction: "none", overscrollBehavior: "contain",
      }}
    >
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
        paddingTop: "calc(10px + env(safe-area-inset-top))",
        borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.6)", flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
            color: "#eee", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600,
          }}
        >← Back</button>
        <div style={{ flex: 1, color: "#aaa", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...LTR }}>
          {item.caption}
        </div>
        <button onClick={() => setScale((s) => Math.max(s - 0.5, 1))} style={zoomBtn} title="Zoom out">−</button>
        <span style={{ color: "#00d4ff", fontSize: 12, minWidth: 42, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(s + 0.5, 6))} style={zoomBtn} title="Zoom in">+</button>
        <button onClick={reset} style={{ ...zoomBtn, fontSize: 12, padding: "8px 10px" }} title="Reset zoom">Reset</button>
      </div>

      {/* Image stage */}
      <div
        style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}
        onDoubleClick={() => (scale > 1 ? reset() : setScale(2.5))}
        onWheel={(e) => {
          e.preventDefault();
          setScale((s) => Math.min(Math.max(s + (e.deltaY < 0 ? 0.3 : -0.3), 1), 6));
        }}
        onMouseDown={(e) => { if (scale > 1) drag.current = { x: e.clientX, y: e.clientY, tx, ty }; }}
        onMouseMove={(e) => {
          if (!drag.current) return;
          setTx(drag.current.tx + (e.clientX - drag.current.x));
          setTy(drag.current.ty + (e.clientY - drag.current.y));
        }}
        onMouseUp={() => { drag.current = null; }}
        onMouseLeave={() => { drag.current = null; }}
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            pinch.current = { dist: dist(e.touches), scale };
          } else if (e.touches.length === 1 && scale > 1) {
            const t = e.touches[0]!;
            drag.current = { x: t.clientX, y: t.clientY, tx, ty };
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinch.current) {
            const d = dist(e.touches);
            if (pinch.current.dist > 0) {
              setScale(Math.min(Math.max(pinch.current.scale * (d / pinch.current.dist), 1), 6));
            }
          } else if (e.touches.length === 1 && drag.current) {
            const t = e.touches[0]!;
            setTx(drag.current.tx + (t.clientX - drag.current.x));
            setTy(drag.current.ty + (t.clientY - drag.current.y));
          }
        }}
        onTouchEnd={() => { pinch.current = null; drag.current = null; }}
      >
        <img
          src={item.url}
          alt={item.caption}
          draggable={false}
          style={{
            maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transition: drag.current || pinch.current ? "none" : "transform 0.12s ease-out",
            cursor: scale > 1 ? "grab" : "zoom-in",
            userSelect: "none",
          }}
        />

        {items.length > 1 && (
          <>
            <button onClick={() => go(-1)} disabled={cur === 0} style={{ ...arrowBtn, left: 10, opacity: cur === 0 ? 0.25 : 1 }}>‹</button>
            <button onClick={() => go(1)} disabled={cur === items.length - 1} style={{ ...arrowBtn, right: 10, opacity: cur === items.length - 1 ? 0.25 : 1 }}>›</button>
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{
        flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.6)",
        padding: "10px 12px", paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
        display: "flex", flexDirection: "column", gap: 8, alignItems: "center",
      }}>
        <span style={{ color: "#777", fontSize: 12 }}>
          {items.length > 1 ? `${cur + 1} / ${items.length} · ` : ""}Pinch or double-tap to zoom
        </span>
        <button
          onClick={onClose}
          style={{
            width: "100%", maxWidth: 420, padding: "11px 0", background: "rgba(255,80,80,0.12)",
            border: "1px solid rgba(255,80,80,0.35)", color: "#ff9b9b", borderRadius: 10,
            cursor: "pointer", fontSize: 14, fontWeight: 700,
          }}
        >Close</button>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(body, document.body) : body;
}

const zoomBtn: React.CSSProperties = {
  padding: "8px 12px", background: "rgba(0,212,255,0.1)", border: "1px solid #00d4ff44",
  color: "#00d4ff", borderRadius: 8, cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0,
};

const arrowBtn: React.CSSProperties = {
  position: "absolute", top: "50%", transform: "translateY(-50%)",
  background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.2)",
  color: "#fff", borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontSize: 22, lineHeight: 1,
};

// ── Section helpers ───────────────────────────────────────────────────────────
function SectionLabel({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: 1 }}>{text}</span>
    </div>
  );
}

function splitSteps(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^\s*(\d+[).:-]?|[-•*])\s*/, ""));
}

// ── Fault Card ─────────────────────────────────────────────────────────────────
function FaultCard({ fault }: { fault: Fault }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const images = fault.media.filter((m) => isImage(m.mime_type));
  const videos = fault.media.filter((m) => isVideo(m.mime_type));
  const pdfs   = fault.media.filter((m) => isPdf(m.mime_type));

  const viewerItems = images.map((m) => ({
    url: mediaUrl(fault.id, m.id),
    caption: m.caption || m.filename || m.mime_type,
  }));

  const errorMessage = (fault.error_message ?? "").trim();
  const symptom      = (fault.symptom ?? "").trim();
  const quickCheck   = (fault.quick_check ?? "").trim();
  const fixProcedure = (fault.fix_procedure ?? "").trim();
  const verifyText   = (fault.verify_text ?? "").trim();
  const structured   = !!(errorMessage || symptom || quickCheck || fixProcedure || verifyText);
  const cause        = (fault.cause ?? "").trim();
  const solution     = (fault.solution ?? "").trim();

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,80,80,0.2)",
      borderRadius: 12,
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          padding: "16px 20px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
          userSelect: "none",
        }}
      >
        <span style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "rgba(255,80,80,0.15)", border: "1px solid rgba(255,80,80,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0,
        }}>⚠️</span>
        <span style={{ flex: 1, minWidth: 0, color: "#f0f0f0", fontWeight: 600, fontSize: 15, ...LTR }}>
          {fault.title}
          {fault.category ? (
            <span style={{
              marginInlineStart: 8, fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
              background: "rgba(0,212,255,0.1)", border: "1px solid #00d4ff33",
              color: "#00d4ff", borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap",
            }}>{fault.category}</span>
          ) : null}
        </span>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {images.length > 0 && (
            <span style={badge}>🖼 {images.length}</span>
          )}
          {videos.length > 0 && (
            <span style={badge}>🎬 {videos.length}</span>
          )}
          {pdfs.length > 0 && (
            <span style={badge}>📄 {pdfs.length}</span>
          )}
        </div>
        <span style={{ color: "#555", fontSize: 12, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>▼</span>
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", overflowWrap: "anywhere" }}>
          {/* ── ERROR MESSAGE ── */}
          {errorMessage && (
            <div style={{ marginTop: 16 }}>
              <SectionLabel icon="⚠" text="ERROR MESSAGE" color="#ff8080" />
              <div style={{
                background: "rgba(255,60,60,0.07)", border: "1px solid rgba(255,80,80,0.35)",
                borderRadius: 10, padding: "12px 14px",
                color: "#ffdede", fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                ...LTR,
              }}>{errorMessage}</div>
            </div>
          )}

          {/* ── FAULT IMAGE ── */}
          {images.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <SectionLabel icon="📷" text={images.length > 1 ? "FAULT IMAGES" : "FAULT IMAGE"} color="#00d4ff" />
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {images.map((m, idx) => (
                  <figure key={m.id} style={{ margin: 0 }}>
                    <div
                      onClick={() => setViewerIndex(idx)}
                      style={{
                        cursor: "zoom-in", borderRadius: 10, overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.12)", background: "#0b0b0f",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <img
                        src={mediaUrl(fault.id, m.id)}
                        alt={m.caption || m.filename}
                        loading="lazy"
                        style={{ width: "100%", height: "auto", maxHeight: "60vh", objectFit: "contain", display: "block" }}
                      />
                    </div>
                    <figcaption style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 8, marginTop: 6, color: "#8a8a8a", fontSize: 12,
                    }}>
                      <span style={LTR}>{m.caption || m.filename}</span>
                      <button
                        onClick={() => setViewerIndex(idx)}
                        style={{
                          background: "rgba(0,212,255,0.08)", border: "1px solid #00d4ff33",
                          color: "#00d4ff", borderRadius: 6, padding: "4px 9px",
                          cursor: "pointer", fontSize: 11, whiteSpace: "nowrap", flexShrink: 0,
                        }}
                      >🔍 Zoom</button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}

          {/* ── SYMPTOM ── */}
          {symptom && (
            <div style={{ marginTop: 16 }}>
              <SectionLabel icon="🩺" text="SYMPTOM" color="#ffb84d" />
              <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", ...LTR }}>{symptom}</div>
            </div>
          )}

          {/* ── QUICK CHECK ── */}
          {quickCheck && (
            <div style={{ marginTop: 16 }}>
              <SectionLabel icon="🔍" text="QUICK CHECK" color="#00d4ff" />
              <div style={{
                background: "rgba(0,212,255,0.05)", border: "1px solid #00d4ff2b",
                borderRadius: 10, padding: "11px 13px",
                color: "#cfe9f2", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", ...LTR,
              }}>{quickCheck}</div>
            </div>
          )}

          {/* ── FIX PROCEDURE ── */}
          {fixProcedure && (
            <div style={{ marginTop: 16 }}>
              <SectionLabel icon="🛠" text="FIX PROCEDURE" color="#4ade80" />
              <ol style={{ margin: 0, paddingInlineStart: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {splitSteps(fixProcedure).map((step, i) => (
                  <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{
                      flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
                      background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.4)",
                      color: "#4ade80", fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{i + 1}</span>
                    <span style={{ color: "#ccc", fontSize: 14, lineHeight: 1.55, ...LTR }}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* ── REPAIR PROCEDURE (video) ── */}
          {videos.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <SectionLabel icon="🎥" text="REPAIR PROCEDURE" color="#00d4ff" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {videos.map((m) => (
                  <figure key={m.id} style={{ margin: 0 }}>
                    <div style={{
                      borderRadius: 10, overflow: "hidden", background: "#000",
                      border: "1px solid rgba(255,255,255,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      // hug the video so a portrait clip doesn't sit inside a wide black band
                      width: "fit-content", maxWidth: "100%", marginInline: "auto",
                    }}>
                      <video
                        // #t=0.1 makes browsers paint a real first frame instead of a black box
                        src={`${mediaUrl(fault.id, m.id)}#t=0.1`}
                        controls
                        playsInline
                        preload="metadata"
                        controlsList="nodownload"
                        style={{
                          // height-capped so portrait clips don't dominate the page,
                          // width-capped so landscape clips never overflow. Aspect ratio preserved.
                          maxWidth: "100%", maxHeight: "min(70vh, 560px)",
                          width: "auto", height: "auto",
                          objectFit: "contain", display: "block", background: "#000",
                        }}
                      />
                    </div>
                    {(m.caption || m.filename) && (
                      <figcaption style={{ marginTop: 6, color: "#8a8a8a", fontSize: 12, ...LTR }}>
                        {m.caption || m.filename}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </div>
          )}

          {/* ── VERIFY ── */}
          {verifyText && (
            <div style={{ marginTop: 18 }}>
              <SectionLabel icon="✓" text="VERIFY" color="#4ade80" />
              <div style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.35)",
                borderRadius: 10, padding: "12px 14px",
              }}>
                <span style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
                  background: "rgba(74,222,128,0.18)", border: "1px solid rgba(74,222,128,0.5)",
                  color: "#4ade80", fontSize: 13, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>✓</span>
                <span style={{ color: "#d8f5e2", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", ...LTR }}>{verifyText}</span>
              </div>
            </div>
          )}

          {/* ── Legacy fields (older entries without structured sections) ── */}
          {!structured && (
            <>
              {cause && (
                <div style={{ marginTop: 16 }}>
                  <SectionLabel icon="⚠" text="CAUSE" color="#ff8080" />
                  <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", ...LTR }}>{cause}</div>
                </div>
              )}
              {solution && (
                <div style={{ marginTop: 14 }}>
                  <SectionLabel icon="🛠" text="SOLUTION" color="#4ade80" />
                  <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", ...LTR }}>{solution}</div>
                </div>
              )}
            </>
          )}

          {/* ── PDFs ── */}
          {pdfs.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <SectionLabel icon="📄" text="REFERENCE DOCUMENTS" color="#00d4ff" />
              {pdfs.map((m) => (
                <a
                  key={m.id}
                  href={mediaUrl(fault.id, m.id)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "8px 14px", marginInlineEnd: 8, marginBottom: 8,
                    background: "rgba(0,212,255,0.08)", border: "1px solid #00d4ff33",
                    color: "#00d4ff", borderRadius: 8, fontSize: 13, textDecoration: "none",
                  }}
                >📄 {m.caption || m.filename || "View PDF"}</a>
              ))}
            </div>
          )}
        </div>
      )}

      {viewerIndex !== null && (
        <ImageViewer items={viewerItems} index={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </div>
  );
}

const badge: React.CSSProperties = {
  fontSize: 11, background: "rgba(0,212,255,0.1)", border: "1px solid #00d4ff33",
  color: "#00d4ff", borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap",
};

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function FaultsPage() {
  const [faults, setFaults] = useState<Fault[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/faults")
      .then((r) => r.json())
      .then((data) => { setFaults(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const q = search.toLowerCase();
  const filtered = faults.filter((f) =>
    [f.title, f.category, f.cause, f.solution, f.error_message, f.symptom, f.quick_check, f.fix_procedure, f.verify_text]
      .some((v) => (v ?? "").toLowerCase().includes(q))
  );

  return (
    <div style={{ padding: "24px 16px", maxWidth: 860, margin: "0 auto", overflowX: "hidden" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>Common Faults</h1>
        </div>
        <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
          Documented faults, causes, and solutions from real operational experience.
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search faults..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", padding: "10px 14px", boxSizing: "border-box",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, color: "#f0f0f0", fontSize: 14, outline: "none",
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "#555", padding: 40 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "#444", padding: 60 }}>
          {search ? "No faults match your search." : "No faults documented yet."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((f) => <FaultCard key={f.id} fault={f} />)}
        </div>
      )}

      <div style={{ marginTop: 20, color: "#333", fontSize: 12, textAlign: "right" }}>
        {filtered.length} of {faults.length} faults
      </div>
    </div>
  );
}
