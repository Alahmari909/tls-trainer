import { useState, useEffect, useCallback, useRef } from "react";
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

// ── Zoomable Image Component ──────────────────────────────────────────────────
function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const lastTap = useRef(0);
  const lastDist = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clampPos = (x: number, y: number, s: number) => {
    const el = containerRef.current;
    if (!el) return { x, y };
    const rect = el.getBoundingClientRect();
    const maxX = Math.max(0, (rect.width * s - rect.width) / 2);
    const maxY = Math.max(0, (rect.height * s - rect.height) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };

  const zoom = useCallback((delta: number, cx = 0, cy = 0) => {
    setScale(prev => {
      const next = Math.max(1, Math.min(8, prev + delta));
      if (next === 1) setPos({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Mouse wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoom(e.deltaY < 0 ? 0.3 : -0.3);
  };

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPos(clampPos(dragStart.current.px + dx, dragStart.current.py + dy, scale));
  };
  const onMouseUp = () => setDragging(false);

  // Touch: pinch-to-zoom + drag
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDist.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: pos.x, py: pos.y };
      // Double-tap detection
      const now = Date.now();
      if (now - lastTap.current < 300) {
        if (scale > 1) { setScale(1); setPos({ x: 0, y: 0 }); }
        else { setScale(3); }
      }
      lastTap.current = now;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (lastDist.current !== null) {
        const delta = (dist - lastDist.current) * 0.02;
        zoom(delta);
      }
      lastDist.current = dist;
    } else if (e.touches.length === 1 && scale > 1) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      setPos(clampPos(dragStart.current.px + dx, dragStart.current.py + dy, scale));
    }
  };
  const onTouchEnd = () => { lastDist.current = null; };

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      {/* Zoom controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => zoom(-0.5)} style={zoomBtn}>−</button>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "Inter", minWidth: 36, textAlign: "center" }}>
          {Math.round(scale * 100)}%
        </span>
        <button onClick={() => zoom(0.5)} style={zoomBtn}>+</button>
        <button onClick={() => { setScale(1); setPos({ x: 0, y: 0 }); }} style={{ ...zoomBtn, padding: "6px 12px", fontSize: 9 }}>
          RESET
        </button>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "Inter" }}>
          Scroll / Pinch / Double-tap
        </span>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          overflow: "hidden",
          borderRadius: 10,
          cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
          maxWidth: "min(90vw, 900px)",
          maxHeight: "65vh",
          userSelect: "none",
          touchAction: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            maxWidth: "min(90vw, 900px)",
            maxHeight: "65vh",
            objectFit: "contain",
            transform: `scale(${scale}) translate(${pos.x / scale}px, ${pos.y / scale}px)`,
            transformOrigin: "center center",
            transition: dragging ? "none" : "transform 0.15s ease",
            userSelect: "none",
          }}
        />
      </div>
    </div>
  );
}

const zoomBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 6, cursor: "pointer",
  background: "rgba(0,174,239,0.15)", border: "1px solid rgba(0,174,239,0.35)",
  color: "#00AEEF", fontFamily: "Inter", fontSize: 16, fontWeight: 700,
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "0",
};

// ── Modal ─────────────────────────────────────────────────────────────────────
function MediaModal({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const isImage = item.type === "image" || item.type === "gif";
  const src = item.source_type === "upload" ? `/api/media/${item.id}/file` : (item.url ?? "");

  const renderContent = () => {
    if (item.source_type === "upload" && item.mime_type) {
      if (item.mime_type.startsWith("image/")) {
        return <ZoomableImage src={src} alt={item.title} />;
      }
      if (item.mime_type.startsWith("video/")) {
        return <video src={src} controls autoPlay style={{ maxWidth: "min(90vw,854px)", maxHeight: "65vh", borderRadius: 10 }} />;
      }
    }
    if (item.url) {
      const ytId = getYouTubeId(item.url);
      if (ytId) {
        return (
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
            style={{ width: "min(90vw,854px)", height: "min(50vw,480px)", borderRadius: 10, border: "none" }}
            allow="autoplay; fullscreen" allowFullScreen
          />
        );
      }
      if (isImage) return <ZoomableImage src={src} alt={item.title} />;
      window.open(item.url, "_blank"); onClose(); return null;
    }
    return <p style={{ color: "#aaa" }}>No preview available.</p>;
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: "100%" }}>
        {renderContent()}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "Orbitron, monospace", fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{item.title}</div>
          {item.description && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", maxWidth: 560 }}>{item.description}</div>}
        </div>
        <button onClick={onClose} style={{
          padding: "7px 22px", background: "rgba(0,174,239,0.12)",
          border: "1px solid rgba(0,174,239,0.35)", borderRadius: 8,
          color: "#00AEEF", fontFamily: "Inter", fontSize: 11, cursor: "pointer",
        }}>CLOSE</button>
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

// ── Main Page ─────────────────────────────────────────────────────────────────
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
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? items : items.filter(i => i.type === filter);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary, #020c14)" }}>
      <Sidebar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 16px 40px" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "Orbitron, monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(0,174,239,0.6)", marginBottom: 4 }}>TRAINING RESOURCES</div>
          <h1 style={{ fontFamily: "Orbitron, monospace", fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>MEDIA LIBRARY</h1>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["all", "video", "image", "gif"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "6px 16px", borderRadius: 20, cursor: "pointer",
              fontFamily: "Inter", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase",
              background: filter === f ? "rgba(0,174,239,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${filter === f ? "rgba(0,174,239,0.5)" : "rgba(255,255,255,0.08)"}`,
              color: filter === f ? "#00AEEF" : "rgba(255,255,255,0.4)",
              transition: "all 0.2s",
            }}>
              {f === "all" ? "All" : f === "video" ? "🎬 Videos" : f === "image" ? "🖼 Images" : "🎞 GIFs"}
            </button>
          ))}
        </div>

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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {filtered.map(item => {
              const thumb = getThumbnail(item);
              return (
                <div
                  key={item.id}
                  onClick={() => setSelected(item)}
                  style={{
                    borderRadius: 14, overflow: "hidden", cursor: "pointer",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.transform = "translateY(-4px)";
                    el.style.borderColor = "rgba(0,174,239,0.4)";
                    el.style.boxShadow = "0 8px 32px rgba(0,174,239,0.12)";
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.transform = "none";
                    el.style.borderColor = "rgba(255,255,255,0.06)";
                    el.style.boxShadow = "none";
                  }}
                >
                  <div style={{ height: 160, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                    {thumb ? (
                      <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : item.source_type === "upload" && item.mime_type?.startsWith("image/") ? (
                      <img src={`/api/media/${item.id}/file`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ fontSize: 42, opacity: 0.4 }}>
                        {item.type === "video" ? "🎬" : item.type === "image" ? "🖼️" : "🎞️"}
                      </div>
                    )}
                    {item.type === "video" && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,174,239,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <TypeBadge type={item.type} />
                    </div>
                    <div style={{ fontFamily: "Orbitron, monospace", fontSize: 12, fontWeight: 600, color: "#fff", marginBottom: 6, lineHeight: 1.4 }}>{item.title}</div>
                    {item.description && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
