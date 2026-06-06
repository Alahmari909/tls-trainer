import { useState } from "react";
import V2Layout, { BackButton } from "./layout";
import { DOCUMENTS } from "./_data";

const CATEGORIES = ["All", "Technical", "Installation", "Operations", "Maintenance", "Calibration", "Logistics", "ATC", "Regulatory", "Training"];

const CATEGORY_COLORS: Record<string, string> = {
  Technical: "#00ff88", Installation: "#00d4ff", Operations: "#1e90ff",
  Maintenance: "#0080ff", Calibration: "#00bfff", Logistics: "#6366f1",
  ATC: "#ffaa00", Regulatory: "#ff6b35", Training: "#a855f7",
};

export default function V2Documents() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = DOCUMENTS.filter(doc => {
    const matchSearch = !search || doc.title.toLowerCase().includes(search.toLowerCase()) || doc.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || doc.category === category;
    return matchSearch && matchCat;
  });

  const openDoc = (filename: string) => {
    window.open(`/pdfs/${filename}`, "_blank");
  };

  return (
    <V2Layout role="trainee">
      <BackButton to="/v2/trainee" label="← Back" />
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ fontSize: "0.72rem", letterSpacing: "0.15em", color: "#00ff88", marginBottom: "0.5rem" }}>RESOURCES</div>
        <h2 style={{ fontSize: "1.9rem", fontWeight: 900, color: "#e2e8f0", margin: "0 0 0.5rem" }}>Technical Manuals</h2>
        <p style={{ color: "#64748b", fontSize: "0.88rem" }}>Official TLS documentation, manuals, and reference guides.</p>
      </div>

      {/* Search + filter */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search documents..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: "200px", padding: "0.6rem 1rem",
            background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px", color: "#e2e8f0", fontSize: "0.85rem",
            outline: "none",
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

      {/* Document grid */}
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
                <span style={{ fontSize: "0.72rem", color: "#475569" }}>{doc.pages} pages</span>
                <button
                  onClick={() => openDoc(doc.filename)}
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

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#475569" }}>
          No documents found matching your search.
        </div>
      )}
    </V2Layout>
  );
}
