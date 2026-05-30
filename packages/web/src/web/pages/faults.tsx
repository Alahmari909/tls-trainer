import { useEffect, useState, useRef } from "react";

interface FaultMedia {
  id: number;
  fault_id: number;
  mime_type: string;
  filename: string;
  sort_order: number;
}

interface Fault {
  id: number;
  title: string;
  cause: string;
  solution: string;
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

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({
  items,
  index,
  onClose,
}: {
  items: { url: string; mime: string; filename: string }[];
  index: number;
  onClose: () => void;
}) {
  const [cur, setCur] = useState(index);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setCur((i) => Math.min(i + 1, items.length - 1));
      if (e.key === "ArrowLeft") setCur((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [items.length, onClose]);

  const item = items[cur];
  if (!item) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", zIndex: 9999, padding: "16px",
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "90vw", maxHeight: "85vh", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        {isImage(item.mime) && (
          <img src={item.url} alt={item.filename} style={{ maxWidth: "85vw", maxHeight: "75vh", borderRadius: 8, objectFit: "contain" }} />
        )}
        {isVideo(item.mime) && (
          <video src={item.url} controls autoPlay style={{ maxWidth: "85vw", maxHeight: "75vh", borderRadius: 8 }} />
        )}
        {isPdf(item.mime) && (
          <iframe src={item.url} style={{ width: "80vw", height: "70vh", borderRadius: 8, border: "none" }} title={item.filename} />
        )}
        <span style={{ color: "#aaa", fontSize: 13 }}>{item.filename || item.mime}</span>
      </div>
      {/* nav arrows */}
      {items.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setCur((i) => Math.max(i - 1, 0)); }}
            disabled={cur === 0}
            style={{
              position: "fixed", left: 16, top: "50%", transform: "translateY(-50%)",
              background: "rgba(0,212,255,0.15)", border: "1px solid #00d4ff44",
              color: "#00d4ff", borderRadius: 8, padding: "10px 14px", cursor: "pointer",
              fontSize: 20, opacity: cur === 0 ? 0.3 : 1,
            }}
          >‹</button>
          <button
            onClick={(e) => { e.stopPropagation(); setCur((i) => Math.min(i + 1, items.length - 1)); }}
            disabled={cur === items.length - 1}
            style={{
              position: "fixed", right: 16, top: "50%", transform: "translateY(-50%)",
              background: "rgba(0,212,255,0.15)", border: "1px solid #00d4ff44",
              color: "#00d4ff", borderRadius: 8, padding: "10px 14px", cursor: "pointer",
              fontSize: 20, opacity: cur === items.length - 1 ? 0.3 : 1,
            }}
          >›</button>
        </>
      )}
      <button
        onClick={onClose}
        style={{
          position: "fixed", top: 16, right: 16, background: "rgba(255,80,80,0.15)",
          border: "1px solid #ff505044", color: "#ff8080", borderRadius: 8,
          padding: "6px 12px", cursor: "pointer", fontSize: 16,
        }}
      >✕</button>
      <div style={{ position: "fixed", bottom: 16, color: "#888", fontSize: 13 }}>
        {cur + 1} / {items.length} &nbsp;·&nbsp; Esc to close
      </div>
    </div>
  );
}

// ── Fault Card ─────────────────────────────────────────────────────────────────
function FaultCard({ fault }: { fault: Fault }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const lightboxItems = fault.media.map((m) => ({
    url: mediaUrl(fault.id, m.id),
    mime: m.mime_type,
    filename: m.filename || m.mime_type,
  }));

  const images = fault.media.filter((m) => isImage(m.mime_type));
  const videos = fault.media.filter((m) => isVideo(m.mime_type));
  const pdfs   = fault.media.filter((m) => isPdf(m.mime_type));

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
        <span style={{ flex: 1, color: "#f0f0f0", fontWeight: 600, fontSize: 15 }}>
          {fault.title}
        </span>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {images.length > 0 && (
            <span style={{ fontSize: 11, background: "rgba(0,212,255,0.1)", border: "1px solid #00d4ff33", color: "#00d4ff", borderRadius: 4, padding: "2px 6px" }}>
              🖼 {images.length}
            </span>
          )}
          {videos.length > 0 && (
            <span style={{ fontSize: 11, background: "rgba(0,212,255,0.1)", border: "1px solid #00d4ff33", color: "#00d4ff", borderRadius: 4, padding: "2px 6px" }}>
              🎬 {videos.length}
            </span>
          )}
          {pdfs.length > 0 && (
            <span style={{ fontSize: 11, background: "rgba(0,212,255,0.1)", border: "1px solid #00d4ff33", color: "#00d4ff", borderRadius: 4, padding: "2px 6px" }}>
              📄 {pdfs.length}
            </span>
          )}
        </div>
        <span style={{ color: "#555", fontSize: 12, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>▼</span>
      </div>

      {expanded && (
        <div style={{ padding: "0 20px 20px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Cause */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: "#ff8080", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>CAUSE</div>
            <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{fault.cause}</div>
          </div>

          {/* Solution */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>SOLUTION</div>
            <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{fault.solution}</div>
          </div>

          {/* Media */}
          {fault.media.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: "#00d4ff", fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>REFERENCE MEDIA</div>

              {/* Images grid */}
              {images.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: 10 }}>
                  {images.map((m, idx) => (
                    <div
                      key={m.id}
                      onClick={() => setLightboxIndex(lightboxItems.findIndex(l => l.url === mediaUrl(fault.id, m.id)))}
                      style={{ cursor: "pointer", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", aspectRatio: "4/3", background: "#111" }}
                    >
                      <img
                        src={mediaUrl(fault.id, m.id)}
                        alt={m.filename}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Videos */}
              {videos.map((m) => (
                <div key={m.id} style={{ marginBottom: 10 }}>
                  <video
                    src={mediaUrl(fault.id, m.id)}
                    controls
                    style={{ width: "100%", maxHeight: 300, borderRadius: 8, background: "#000" }}
                  />
                </div>
              ))}

              {/* PDFs */}
              {pdfs.map((m) => (
                <a
                  key={m.id}
                  href={mediaUrl(fault.id, m.id)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "8px 14px", marginRight: 8, marginBottom: 8,
                    background: "rgba(0,212,255,0.08)", border: "1px solid #00d4ff33",
                    color: "#00d4ff", borderRadius: 8, fontSize: 13, textDecoration: "none",
                  }}
                >
                  📄 {m.filename || "View PDF"}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox items={lightboxItems} index={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function FaultsPage() {
  const [faults, setFaults] = useState<Fault[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/faults")
      .then((r) => r.json())
      .then((data) => { setFaults(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = faults.filter(
    (f) =>
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.cause.toLowerCase().includes(search.toLowerCase()) ||
      f.solution.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "24px 20px", maxWidth: 860, margin: "0 auto" }}>
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
