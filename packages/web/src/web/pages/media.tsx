import { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";

interface MediaItem {
  id: number;
  type: "video" | "image" | "gif";
  title: string;
  description: string | null;
  source_type: "url" | "upload";
  url: string | null;
  mime_type: string | null;
  filename: string | null;
  thumbnail_url: string | null;
  created_at: number;
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function getThumbnail(item: MediaItem): string | null {
  if (item.thumbnail_url) return item.thumbnail_url;
  if (item.url) {
    const yt = getYouTubeId(item.url);
    if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
  }
  return null;
}

function MediaModal({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const renderContent = () => {
    if (item.source_type === "upload" && item.mime_type) {
      const src = `/api/media/${item.id}/file`;
      if (item.mime_type.startsWith("image/")) {
        return <img src={src} alt={item.title} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 10, objectFit: "contain" }} />;
      }
      if (item.mime_type.startsWith("video/")) {
        return <video src={src} controls autoPlay style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 10 }} />;
      }
    }
    if (item.url) {
      const ytId = getYouTubeId(item.url);
      if (ytId) {
        return (
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
            style={{ width: "min(80vw, 854px)", height: "min(45vw, 480px)", borderRadius: 10, border: "none" }}
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        );
      }
      if (item.type === "image" || item.type === "gif") {
        return <img src={item.url} alt={item.title} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 10, objectFit: "contain" }} />;
      }
      // fallback — open in new tab
      window.open(item.url, "_blank");
      onClose();
      return null;
    }
    return <p style={{ color: "#aaa" }}>No preview available.</p>;
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: "90vw", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {renderContent()}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "Orbitron, monospace", fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{item.title}</div>
          {item.description && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", maxWidth: 600 }}>{item.description}</div>}
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 8, padding: "8px 24px", background: "rgba(0,174,239,0.15)",
            border: "1px solid rgba(0,174,239,0.4)", borderRadius: 8,
            color: "#00AEEF", fontFamily: "Inter", fontSize: 12, cursor: "pointer",
          }}
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = { video: "#00AEEF", image: "#22C55E", gif: "#F59E0B" };
  const color = colors[type] ?? "#888";
  return (
    <span style={{
      fontSize: 9, fontFamily: "Orbitron, monospace", letterSpacing: "0.1em",
      padding: "2px 7px", borderRadius: 4,
      background: `${color}18`, border: `1px solid ${color}50`, color,
    }}>
      {type.toUpperCase()}
    </span>
  );
}

export default function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "video" | "image" | "gif">("all");
  const [selected, setSelected] = useState<MediaItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media");
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? items : items.filter(i => i.type === filter);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary, #020c14)" }}>
      <Sidebar />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 16px 32px" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "Orbitron, monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(0,174,239,0.6)", marginBottom: 4 }}>
            TRAINING RESOURCES
          </div>
          <h1 style={{ fontFamily: "Orbitron, monospace", fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>
            MEDIA LIBRARY
          </h1>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["all", "video", "image", "gif"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 16px", borderRadius: 20, cursor: "pointer",
                fontFamily: "Inter", fontSize: 11, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                background: filter === f ? "rgba(0,174,239,0.2)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${filter === f ? "rgba(0,174,239,0.5)" : "rgba(255,255,255,0.08)"}`,
                color: filter === f ? "#00AEEF" : "rgba(255,255,255,0.4)",
                transition: "all 0.2s",
              }}
            >
              {f === "all" ? "All" : f === "video" ? "🎬 Videos" : f === "image" ? "🖼 Images" : "🎞 GIFs"}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ width: 36, height: 36, border: "2px solid #00AEEF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "Inter" }}>Loading media…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📽️</div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, fontFamily: "Inter" }}>No media available yet</div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}>
            {filtered.map(item => {
              const thumb = getThumbnail(item);
              return (
                <div
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="glass-card"
                  style={{
                    borderRadius: 14, overflow: "hidden", cursor: "pointer",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,174,239,0.4)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(0,174,239,0.12)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = "none";
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    height: 160, background: "rgba(0,0,0,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative", overflow: "hidden",
                  }}>
                    {thumb ? (
                      <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : item.source_type === "upload" && item.mime_type?.startsWith("image/") ? (
                      <img src={`/api/media/${item.id}/file`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ fontSize: 42, opacity: 0.4 }}>
                        {item.type === "video" ? "🎬" : item.type === "image" ? "🖼️" : "🎞️"}
                      </div>
                    )}
                    {/* Play overlay for videos */}
                    {item.type === "video" && (
                      <div style={{
                        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        background: "rgba(0,0,0,0.3)",
                      }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: "50%",
                          background: "rgba(0,174,239,0.85)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <TypeBadge type={item.type} />
                    </div>
                    <div style={{
                      fontFamily: "Orbitron, monospace", fontSize: 12, fontWeight: 600,
                      color: "#fff", marginBottom: 6, lineHeight: 1.4,
                    }}>
                      {item.title}
                    </div>
                    {item.description && (
                      <div style={{
                        fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.5,
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && <MediaModal item={selected} onClose={() => setSelected(null)} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
