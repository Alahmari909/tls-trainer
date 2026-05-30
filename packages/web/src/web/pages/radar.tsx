import { useState, useEffect } from "react";
import BackButton from "../components/BackButton";

const C = {
  navy:  "#071426",
  steel: "#1C2633",
  cyan:  "#00AEEF",
  blue:  "#35D4FF",
  green: "#00D26A",
  gold:  "#C9A66B",
};

interface GalleryItem {
  id: number;
  title: string;
  caption: string;
  sort_order: number;
  created_at: number;
}

// ── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ item, onClose }: { item: GalleryItem; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 860, width: "100%",
          background: C.steel,
          border: `1px solid ${C.cyan}30`,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: `0 0 60px ${C.cyan}25`,
        }}
      >
        <img
          src={`/api/radar/gallery/${item.id}/image`}
          alt={item.title}
          style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", display: "block", background: "#000" }}
        />
        <div style={{ padding: "16px 20px" }}>
          <div style={{ color: C.cyan, fontFamily: "Orbitron, monospace", fontSize: 13, marginBottom: 6 }}>
            {item.title}
          </div>
          {item.caption && (
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.6 }}>
              {item.caption}
            </div>
          )}
          <button
            onClick={onClose}
            style={{
              marginTop: 14, padding: "8px 22px", background: "transparent",
              border: `1px solid ${C.cyan}50`, borderRadius: 8,
              color: C.cyan, cursor: "pointer", fontFamily: "monospace", fontSize: 12,
            }}
          >
            ✕ CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gallery Card ──────────────────────────────────────────────────────────────
function GalleryCard({ item, onClick }: { item: GalleryItem; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.steel,
        border: `1px solid ${hovered ? C.cyan + "60" : C.cyan + "18"}`,
        borderRadius: 12,
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.25s, transform 0.2s, box-shadow 0.25s",
        transform: hovered ? "translateY(-3px)" : "none",
        boxShadow: hovered ? `0 8px 32px ${C.cyan}20` : "none",
      }}
    >
      {/* Image thumbnail */}
      <div style={{ position: "relative", paddingBottom: "62%", background: "#0a1628", overflow: "hidden" }}>
        <img
          src={`/api/radar/gallery/${item.id}/image`}
          alt={item.title}
          loading="lazy"
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover",
            transition: "transform 0.3s",
            transform: hovered ? "scale(1.04)" : "scale(1)",
          }}
        />
        {/* Overlay badge */}
        <div style={{
          position: "absolute", top: 8, left: 8,
          background: "rgba(0,14,30,0.8)",
          border: `1px solid ${C.cyan}40`,
          borderRadius: 6, padding: "3px 8px",
          fontSize: 10, color: C.cyan, fontFamily: "monospace", letterSpacing: "0.08em",
        }}>
          RADAR VISUAL
        </div>
      </div>

      {/* Caption */}
      <div style={{ padding: "12px 14px 14px" }}>
        <div style={{
          color: "#fff", fontFamily: "Orbitron, monospace",
          fontSize: 12, marginBottom: 6, letterSpacing: "0.05em",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {item.title}
        </div>
        {item.caption && (
          <div style={{
            color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.55,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {item.caption}
          </div>
        )}
        <div style={{
          marginTop: 10, fontSize: 10, color: `${C.cyan}80`,
          fontFamily: "monospace", letterSpacing: "0.06em",
        }}>
          {new Date(item.created_at).toLocaleDateString("en-GB")}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RadarPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);

  useEffect(() => {
    fetch("/api/radar/gallery")
      .then(r => r.json())
      .then((d: { ok: boolean; items: GalleryItem[] }) => {
        setItems(d.items ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const gifUrl = "/api/radar/gallery"; // GIF served from static

  return (
    <div style={{
      minHeight: "100vh",
      background: C.navy,
      paddingBottom: 80,
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px 12px",
        borderBottom: `1px solid ${C.cyan}15`,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <BackButton />
        <div>
          <div style={{
            fontFamily: "Orbitron, monospace",
            fontSize: 15, color: C.cyan, letterSpacing: "0.12em",
          }}>
            RADAR & TRACKING
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            Final Approach Simulation + Field Visuals
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 16px", maxWidth: 900, margin: "0 auto" }}>

        {/* ── GIF Section ─────────────────────────────────────────────────── */}
        <div style={{
          background: C.steel,
          border: `1px solid ${C.cyan}25`,
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 32,
          boxShadow: `0 0 40px ${C.cyan}10`,
        }}>
          {/* GIF header */}
          <div style={{
            padding: "12px 16px",
            borderBottom: `1px solid ${C.cyan}15`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: C.green,
              boxShadow: `0 0 8px ${C.green}`,
              animation: "ping 2s infinite",
            }} />
            <span style={{
              fontFamily: "Orbitron, monospace", fontSize: 12,
              color: C.cyan, letterSpacing: "0.1em",
            }}>
              TLS FINAL APPROACH SIMULATION — RWY 31
            </span>
            <span style={{
              marginLeft: "auto", fontSize: 10,
              color: "rgba(255,255,255,0.3)", fontFamily: "monospace",
            }}>
              LIVE SIM · LOOP
            </span>
          </div>

          {/* GIF display */}
          <div style={{
            background: "#010905",
            display: "flex", justifyContent: "center", alignItems: "center",
            padding: "12px 8px",
          }}>
            <img
              src="https://storage.googleapis.com/runable-templates/cli-uploads%2FZAdw1465tKtNrEQVeMpLAPbNPCqsOR6A%2Fl7K59TGwYODJPCrx_3Qcb%2FTLS_Final_Approach_Simulation.gif"
              alt="TLS Final Approach Simulation"
              style={{
                maxWidth: "100%",
                borderRadius: 6,
                imageRendering: "crisp-edges",
              }}
            />
          </div>

          {/* Info bar */}
          <div style={{
            padding: "10px 16px",
            borderTop: `1px solid ${C.cyan}10`,
            display: "flex", flexWrap: "wrap", gap: "6px 24px",
          }}>
            {[
              ["LOC", "22 NM / ±35°"],
              ["GS",  "18 NM / ±8°"],
              ["TRAFFIC", "7 AIRCRAFT"],
              ["STATUS", "NO CONFLICT"],
            ].map(([k, v]) => (
              <span key={k} style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.45)" }}>
                <span style={{ color: C.cyan, marginRight: 4 }}>{k}</span>{v}
              </span>
            ))}
          </div>
        </div>

        {/* ── Gallery Section ──────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 18,
        }}>
          <div style={{
            width: 3, height: 20, background: C.gold, borderRadius: 2,
          }} />
          <span style={{
            fontFamily: "Orbitron, monospace", fontSize: 13,
            color: "#fff", letterSpacing: "0.1em",
          }}>
            FIELD VISUALS
          </span>
          <span style={{
            fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "monospace",
          }}>
            Real radar screenshots · incidents · maintenance
          </span>
          {!loading && (
            <span style={{
              marginLeft: "auto", fontSize: 10, fontFamily: "monospace",
              color: `${C.cyan}80`,
              background: `${C.cyan}12`, border: `1px solid ${C.cyan}25`,
              borderRadius: 20, padding: "2px 10px",
            }}>
              {items.length} ITEM{items.length !== 1 ? "S" : ""}
            </span>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: 48, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
            LOADING...
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{
            textAlign: "center", padding: "48px 24px",
            background: C.steel, borderRadius: 12,
            border: `1px dashed ${C.cyan}20`,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontFamily: "monospace", fontSize: 13 }}>
              No field visuals yet
            </div>
            <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 6 }}>
              Admin can upload radar screenshots from the Admin Panel
            </div>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}>
            {items.map(item => (
              <GalleryCard key={item.id} item={item} onClick={() => setLightbox(item)} />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && <Lightbox item={lightbox} onClose={() => setLightbox(null)} />}

      <style>{`
        @keyframes ping {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
