import { useState, useEffect, useRef } from "react";
import { getSession } from "../hooks/useTelegramTrack";

type Manual = {
  id: number;
  title: string;
  subtitle: string;
  file: string;
  category: string;
  color: string;
  icon: string;
  pages?: string;
};

const MANUALS: Manual[] = [
  { id: 1, title: "introduction",            subtitle: "Full TLS system training reference — English edition",     file: "TLS_ANPC_English.pdf",       category: "Training",     color: "#00AEEF", icon: "📘", pages: "Reference" },
  { id: 2, title: "Overview",               subtitle: "KSA field training manual — June 2021 revision",           file: "TLS_Training_June_2021_KSA.pdf", category: "Training",  color: "#35D4FF", icon: "📗", pages: "Reference" },
  { id: 3, title: "Installation",           subtitle: "020-00073 Rev F — TLS system installation procedures",     file: "020-00073_RevF.pdf",         category: "Installation", color: "#C9A66B", icon: "🔩", pages: "RevF" },
  { id: 4, title: "Operation",              subtitle: "020-00072 Rev F — System operation and controls",          file: "020-00072_RevF.pdf",         category: "Operation",    color: "#00D26A", icon: "⚙️", pages: "RevF" },
  { id: 5, title: "Calibration",            subtitle: "020-00071 Rev E — Calibration and alignment procedures",   file: "020-00071_RevE.pdf",         category: "Calibration",  color: "#FFD166", icon: "🎯", pages: "RevE" },
  { id: 6, title: "Maintenance Manual",     subtitle: "020-00074 Rev G — Scheduled and corrective maintenance",   file: "020-00074_RevG.pdf",         category: "Maintenance",  color: "#FF4D4D", icon: "🔧", pages: "RevG" },
  { id: 7, title: "Container & Deployment", subtitle: "020-00076 Rev D — Shelter and deployment procedures",      file: "020-00076_RevD.pdf",         category: "Deployment",   color: "#00AEEF", icon: "📦", pages: "RevD" },
  { id: 8, title: "Packing Instructions",   subtitle: "020-00077 Rev C — Packing and transport guidelines",       file: "020-00077_RevC.pdf",         category: "Deployment",   color: "#35D4FF", icon: "🗃️", pages: "RevC" },
  { id: 9, title: "ATC Quick Guide",        subtitle: "Quick reference guide for ATC operators",                   file: "ATC_quick_guide_TLS.pdf",    category: "Reference",    color: "#C9A66B", icon: "⚡", pages: "Quick Ref" },
];

const CATEGORIES = ["All", "Favorites", "Training", "Installation", "Operation", "Calibration", "Maintenance", "Deployment", "Reference"];
const FAV_KEY = "tls_manual_favorites";

function StarIcon({ filled, color }: { filled: boolean; color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

export default function Manuals() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch]               = useState("");

  const [favorites, setFavorites]         = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]")); }
    catch { return new Set(); }
  });

  // Persist favorites
  useEffect(() => {
    localStorage.setItem(FAV_KEY, JSON.stringify([...favorites]));
  }, [favorites]);

  const toggleFav = (id: number) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = MANUALS.filter((m) => {
    if (activeCategory === "Favorites") return favorites.has(m.id);
    const matchCat    = activeCategory === "All" || m.category === activeCategory;
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase()) ||
                        m.subtitle.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // Manual view tracking
  const openTimeRef = useRef<number | null>(null);
  const openFileRef = useRef<{ name: string; file: string } | null>(null);

  const postManualView = (durationMs: number) => {
    if (!openFileRef.current || durationMs < 3000) return;
    const traineeId = getSession()?.id;
    if (!traineeId) return;
    fetch('/api/trainee/manual-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-trainee-id': traineeId },
      body: JSON.stringify({
        traineeId,
        manualName: openFileRef.current.name,
        fileName: openFileRef.current.file,
        durationMs,
      }),
    }).catch(() => {});
    openFileRef.current = null;
    openTimeRef.current = null;
  };

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && openTimeRef.current != null) {
        postManualView(Date.now() - openTimeRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const handleOpen = (manual: Manual) => {
    // Log open time for duration tracking
    openTimeRef.current = Date.now();
    openFileRef.current = { name: manual.title, file: manual.file };
    // Log view immediately (duration 0 — updated on close)
    const traineeId = getSession()?.id;
    if (traineeId) {
      fetch('/api/trainee/manual-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-trainee-id': traineeId },
        body: JSON.stringify({
          traineeId,
          manualName: manual.title,
          fileName: manual.file,
          durationMs: 0,
        }),
      }).catch(() => {});
    }
    // On all devices: open PDF directly in browser tab — full scrollable view
    window.open(`/pdfs/${manual.file}`, '_blank');
  };

  const handleSave = (file: string) => {
    // ?dl=1 sets Content-Disposition: attachment → iOS shows share/save sheet
    window.open(`/pdfs/${file}?dl=1`, '_blank');
  };

  return (
    <div className="page" style={{ background: "var(--bg-primary)" }}>

      {/* PDF viewer removed — opens in browser tab via window.open */}

      {/* Header */}
      <div className="radar-grid" style={{
        background: "linear-gradient(180deg, #071426 0%, #050a12 100%)",
        padding: "24px 20px 20px",
        borderBottom: "1px solid rgba(201,166,107,0.2)",
        position: "relative", overflow: "hidden",
      }}>
        <div className="scan-line" />

        {/* Corner brackets */}
        {[
          { top: 14, left: 16 }, { top: 14, right: 16 },
          { bottom: 14, left: 16 }, { bottom: 14, right: 16 },
        ].map((pos, i) => (
          <div key={i} style={{
            position: "absolute", ...pos, width: 16, height: 16,
            borderTop:    i < 2 ? "2px solid rgba(201,166,107,0.45)" : undefined,
            borderBottom: i >= 2 ? "2px solid rgba(201,166,107,0.45)" : undefined,
            borderLeft:   i === 0 || i === 2 ? "2px solid rgba(201,166,107,0.45)" : undefined,
            borderRight:  i === 1 || i === 3 ? "2px solid rgba(201,166,107,0.45)" : undefined,
          }} />
        ))}

        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="font-orbitron" style={{ fontSize: 9, letterSpacing: "0.25em", color: "#C9A66B", marginBottom: 6 }}>
            TECHNICAL LIBRARY
          </div>
          <div className="font-orbitron" style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
            MANUALS & DOCS
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {MANUALS.length} official TLS documents
            </div>
            {favorites.size > 0 && (
              <div style={{
                fontSize: 9, fontFamily: "Inter", color: "#FFD166",
                background: "rgba(255,209,102,0.12)", border: "1px solid rgba(255,209,102,0.3)",
                borderRadius: 4, padding: "2px 7px", letterSpacing: "0.07em",
              }}>
                ★ {favorites.size} SAVED
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 16px 44px" }}>

        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "rgba(28,38,51,0.8)", border: "1px solid rgba(0,174,239,0.2)",
          borderRadius: 10, padding: "10px 14px", marginBottom: 12,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents..."
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "var(--text-primary)", fontSize: 13, fontFamily: "Inter, sans-serif",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{
              background: "none", border: "none", color: "var(--text-muted)",
              cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1,
            }}>✕</button>
          )}
        </div>

        {/* Category filters */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 16, scrollbarWidth: "none" }}>
          {CATEGORIES.map((cat) => {
            const isFavTab = cat === "Favorites";
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  flexShrink: 0, padding: "5px 12px",
                  borderRadius: 6, cursor: "pointer", fontSize: 9,
                  fontFamily: "Inter", letterSpacing: "0.08em",
                  background: active
                    ? (isFavTab ? "rgba(255,209,102,0.18)" : "rgba(0,174,239,0.18)")
                    : "rgba(28,38,51,0.6)",
                  border: `1px solid ${active
                    ? (isFavTab ? "rgba(255,209,102,0.6)" : "rgba(0,174,239,0.6)")
                    : "rgba(255,255,255,0.08)"}`,
                  color: active
                    ? (isFavTab ? "#FFD166" : "#00AEEF")
                    : "var(--text-muted)",
                  transition: "all 0.15s",
                }}
              >
                {isFavTab ? `★ ${cat.toUpperCase()}` : cat.toUpperCase()}
                {isFavTab && favorites.size > 0 && (
                  <span style={{ marginLeft: 4, opacity: 0.75 }}>({favorites.size})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Documents list */}
        <div className="glass-card" style={{ padding: "4px 0", border: "1px solid rgba(201,166,107,0.15)" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {activeCategory === "Favorites"
                ? "No favorites yet — tap ★ on any document to save it"
                : "No documents found"}
            </div>
          ) : (
            filtered.map((manual, i) => {
              const isFav = favorites.has(manual.id);
              return (
                <div key={manual.id}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 13, padding: "13px 16px",
                    background: `linear-gradient(90deg, ${manual.color}08 0%, transparent 100%)`,
                  }}>
                    {/* Doc icon */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                      background: `${manual.color}15`, border: `1px solid ${manual.color}40`,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                    }}>
                      {manual.icon}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{manual.title}</span>
                        <span style={{
                          fontSize: 7, color: manual.color, fontFamily: "Inter",
                          background: `${manual.color}15`, border: `1px solid ${manual.color}35`,
                          borderRadius: 3, padding: "1px 5px", letterSpacing: "0.08em", flexShrink: 0,
                        }}>
                          {manual.pages}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>{manual.subtitle}</div>
                      <div style={{ fontSize: 9, color: manual.color, marginTop: 4, fontFamily: "Inter", letterSpacing: "0.06em" }}>
                        {manual.category.toUpperCase()}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end", flexShrink: 0 }}>
                      {/* Favorite star */}
                      <button
                        onClick={() => toggleFav(manual.id)}
                        title={isFav ? "Remove from favorites" : "Save to favorites"}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          padding: "3px 4px", display: "flex", alignItems: "center", justifyContent: "center",
                          opacity: isFav ? 1 : 0.4,
                          transition: "opacity 0.15s, transform 0.15s",
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = isFav ? "1" : "0.4"}
                      >
                        <StarIcon filled={isFav} color="#FFD166" />
                      </button>

                      {/* Open */}
                      <button
                        onClick={() => handleOpen(manual)}
                        style={{
                          padding: "5px 10px",
                          background: `${manual.color}20`, border: `1px solid ${manual.color}50`,
                          borderRadius: 5, cursor: "pointer",
                          color: manual.color, fontFamily: "Inter", fontSize: 8,
                          letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 3,
                        }}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        OPEN
                      </button>

                      {/* Save */}
                      <button
                        onClick={() => handleSave(manual.file)}
                        style={{
                          padding: "5px 10px",
                          background: `${manual.color}10`, border: `1px solid ${manual.color}35`,
                          borderRadius: 5, cursor: "pointer",
                          color: manual.color, fontFamily: "Inter", fontSize: 8,
                          letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 3,
                        }}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        SAVE
                      </button>
                    </div>
                  </div>

                  {i < filtered.length - 1 && (
                    <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "0 16px" }} />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer count */}
        {filtered.length > 0 && (
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter", letterSpacing: "0.08em" }}>
            {filtered.length} DOCUMENT{filtered.length !== 1 ? "S" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
