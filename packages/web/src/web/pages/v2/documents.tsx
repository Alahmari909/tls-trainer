import { useState, useEffect } from "react";
import V2Layout, { BackButton } from "./layout";
import { getSession } from "../../hooks/useTelegramTrack";

// PDF Viewer Modal — renders pages as images so it works inside the mobile app
// webview (which cannot display PDFs inline). Lazy-loads each page.
function PdfModal({ docId, title, onClose }: { docId: number; title: string; onClose: () => void }) {
  const fileUrl = `${window.location.origin}/api/documents/${docId}/file`;
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [zoom, setZoom] = useState(1);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let alive = true;
    fetch(`/api/documents/${docId}/page-count`)
      .then(r => r.json())
      .then(d => { if (!alive) return; if (d.pages > 0) setPageCount(d.pages); else setErr(d.error || "Cannot read file"); })
      .catch(() => { if (alive) setErr("Network error"); });
    return () => { alive = false; };
  }, [docId]);

  return (
    <div className="pdf-modal-overlay">
      {/* Header */}
      <div className="pdf-modal-header">
        <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.85rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          📄 {title}
        </span>
        <div style={{ display: "flex", gap: "0.4rem", marginLeft: "1rem", alignItems: "center", flexShrink: 0 }}>
          <button onClick={() => setZoom(z => Math.max(0.6, +(z - 0.2).toFixed(2)))}
            style={{ padding: "0.25rem 0.5rem", borderRadius: 6, cursor: "pointer", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: "0.85rem", fontWeight: 700 }}>−</button>
          <span style={{ color: "#94a3b8", fontSize: "0.65rem", minWidth: 30, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, +(z + 0.2).toFixed(2)))}
            style={{ padding: "0.25rem 0.5rem", borderRadius: 6, cursor: "pointer", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: "0.85rem", fontWeight: 700 }}>+</button>
          <a href={fileUrl} download
            style={{ padding: "0.25rem 0.5rem", borderRadius: 6, background: "rgba(0,174,239,0.1)", border: "1px solid rgba(0,174,239,0.3)", color: "#00aeef", fontSize: "0.68rem", fontWeight: 600, textDecoration: "none" }}>
            ⬇
          </a>
          <button onClick={onClose}
            style={{ padding: "0.25rem 0.5rem", borderRadius: 6, cursor: "pointer", background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)", color: "#ff5555", fontSize: "0.72rem", fontWeight: 600 }}>
            ✕
          </button>
        </div>
      </div>
      {/* Viewer */}
      <div className="pdf-modal-scroll">
        {err && <div style={{ color: "#ff6b6b", padding: 40, fontSize: "0.85rem" }}>{err}</div>}
        {!err && pageCount === null && <div style={{ color: "#94a3b8", padding: 40, fontSize: "0.85rem" }}>Loading…</div>}
        {!err && pageCount !== null && Array.from({ length: pageCount }, (_, i) => i + 1).map(p => (
          <div key={p} style={{ marginBottom: 14 }}>
            <img
              src={`/api/documents/${docId}/page/${p}`}
              loading="lazy"
              onLoad={() => setLoaded(s => ({ ...s, [p]: true }))}
              alt={`page ${p}`}
              className="pdf-modal-page-img"
              style={{ transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: "top center", minHeight: loaded[p] ? undefined : 200 }}
            />
            <div style={{ color: "#64748b", fontSize: "0.6rem", marginTop: zoom !== 1 ? `${(zoom - 1) * 100}%` : 4 }}>{p} / {pageCount}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const CATEGORIES = ["All", "Technical", "Installation", "Operations", "Maintenance", "Calibration", "Logistics", "ATC", "Regulatory", "Training", "Other"];

const CATEGORY_COLORS: Record<string, string> = {
  Technical: "#00ff88", Installation: "#00d4ff", Operations: "#1e90ff",
  Maintenance: "#0080ff", Calibration: "#00bfff", Logistics: "#6366f1",
  ATC: "#ffaa00", Regulatory: "#ff6b35", Training: "#a855f7", Other: "#94a3b8",
};

type Doc = {
  id: number; title: string; filename: string; category: string;
  description: string; pages: number; size: number; share_mode: string;
};

export default function V2Documents() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [openPdf, setOpenPdf] = useState<{ id: number; title: string } | null>(null);

  useEffect(() => {
    const traineeId = getSession()?.id ?? "";
    fetch(`/api/documents?trainee_id=${encodeURIComponent(traineeId)}`)
      .then(r => r.json())
      .then(data => { setDocs(Array.isArray(data) ? data : []); })
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = docs.filter(doc => {
    const matchSearch = !search ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || doc.category === category;
    return matchSearch && matchCat;
  });

  const openDoc = (id: number, title: string) => {
    setOpenPdf({ id, title });
  };

  return (
    <V2Layout role="trainee">
      {openPdf && <PdfModal docId={openPdf.id} title={openPdf.title} onClose={() => setOpenPdf(null)} />}
      <BackButton to="/v2/trainee" label="← Back" />
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ fontSize: "0.72rem", letterSpacing: "0.15em", color: "#00ff88", marginBottom: "0.5rem" }}>RESOURCES</div>
        <h2 style={{ fontSize: "1.9rem", fontWeight: 900, color: "#e2e8f0", margin: "0 0 0.5rem" }}>Technical Manuals</h2>
        <p style={{ color: "#64748b", fontSize: "0.88rem" }}>Official TLS documentation, manuals, and reference guides.</p>
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search documents..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: "200px", padding: "0.6rem 1rem",
            background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px", color: "#e2e8f0", fontSize: "0.85rem", outline: "none",
          }}
        />
      </div>

      {/* Category pills */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)} style={{
            padding: "0.3rem 0.9rem", borderRadius: "20px", cursor: "pointer",
            fontSize: "0.75rem", fontWeight: category === cat ? 600 : 400,
            background: category === cat ? "rgba(0,255,136,0.12)" : "rgba(15,23,42,0.6)",
            border: category === cat ? "1px solid rgba(0,255,136,0.3)" : "1px solid rgba(255,255,255,0.08)",
            color: category === cat ? "#00ff88" : "#64748b",
          }}>{cat}</button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", color: "#475569", padding: "3rem", fontSize: "0.9rem" }}>
          Loading documents...
        </div>
      )}

      {/* Document grid */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
          {filtered.map(doc => {
            const color = CATEGORY_COLORS[doc.category] || "#00ff88";
            return (
              <div
                key={doc.id}
                style={{
                  background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "12px", padding: "1.25rem",
                  display: "flex", flexDirection: "column", gap: "0.75rem",
                  transition: "all 0.2s", cursor: "pointer",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = `${color}44`)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
              >
                {/* Icon + category */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "10px",
                    background: `${color}18`, border: `1px solid ${color}33`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.3rem",
                  }}>📄</div>
                  <span style={{
                    fontSize: "0.68rem", padding: "0.2rem 0.6rem",
                    background: `${color}15`, color: color,
                    border: `1px solid ${color}30`, borderRadius: "20px", letterSpacing: "0.05em",
                  }}>{doc.category}</span>
                </div>

                <div>
                  <div style={{ fontWeight: 600, color: "#e2e8f0", fontSize: "0.9rem", marginBottom: "0.3rem" }}>
                    {doc.title}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", lineHeight: 1.5 }}>
                    {doc.description}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                  <span style={{ fontSize: "0.72rem", color: "#475569" }}>
                    {doc.pages > 0 ? `${doc.pages} pages` : doc.size > 0 ? `${(doc.size / 1024).toFixed(0)} KB` : ""}
                  </span>
                  <button
                    onClick={() => openDoc(doc.id, doc.title)}
                    style={{
                      padding: "0.35rem 0.9rem",
                      background: `${color}18`, border: `1px solid ${color}33`,
                      borderRadius: "6px", color: color, cursor: "pointer",
                      fontSize: "0.75rem", fontWeight: 600,
                    }}>
                    Open PDF →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && docs.length > 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#475569" }}>
          No documents found matching your search.
        </div>
      )}

      {!loading && docs.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#475569" }}>
          No documents available yet.
        </div>
      )}
    </V2Layout>
  );
}
