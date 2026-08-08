import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * ImageLightbox — trainee-scoped fullscreen image viewer.
 *
 * Rendered through a portal into <body> because `.v2-layout` / trainee shells use
 * CSS `zoom` on small screens, which breaks `position: fixed` inside the subtree.
 *
 * Features: fit-to-screen min zoom, pinch zoom, double-tap zoom, wheel zoom,
 * drag/touch pan while zoomed, auto-center at min zoom, body scroll lock,
 * long-press action sheet with exactly two actions (Save Image / Back).
 *
 * UI/UX only — it never transforms, re-fetches or re-encodes the source image.
 */

const MIN_SCALE = 1;   // 1 = fit-to-screen (image is laid out with object-fit: contain)
const MAX_SCALE = 4.5;
const DBL_SCALE = 2.5;
const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

type Props = {
  src: string;
  label?: string;
  onClose: () => void;
};

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export default function ImageLightbox({ src, label, onClose }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [scale, setScale] = useState(MIN_SCALE);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [animate, setAnimate] = useState(false);

  // Live mirror of the transform so native (non-React) gesture handlers read fresh values.
  const view = useRef({ scale: MIN_SCALE, tx: 0, ty: 0 });
  useLayoutEffect(() => { view.current = { scale, tx, ty }; }, [scale, tx, ty]);

  // ── body scroll lock ────────────────────────────────────────────────────────
  useEffect(() => {
    const b = document.body;
    const prev = {
      overflow: b.style.overflow,
      position: b.style.position,
      width: b.style.width,
      touchAction: b.style.touchAction,
      overscroll: (b.style as any).overscrollBehavior as string,
    };
    const y = window.scrollY || window.pageYOffset || 0;
    b.style.overflow = "hidden";
    b.style.touchAction = "none";
    (b.style as any).overscrollBehavior = "none";
    return () => {
      b.style.overflow = prev.overflow;
      b.style.position = prev.position;
      b.style.width = prev.width;
      b.style.touchAction = prev.touchAction;
      (b.style as any).overscrollBehavior = prev.overscroll || "";
      window.scrollTo(0, y);
    };
  }, []);

  // ── esc to close ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (sheet) setSheet(false); else onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, onClose]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const sheetAt = useRef(0);
  const openSheet = useCallback(() => { sheetAt.current = Date.now(); setSheet(true); }, []);
  const closeSheetFromBackdrop = useCallback(() => {
    if (Date.now() - sheetAt.current < 450) return; // ignore the tap that opened it
    setSheet(false);
  }, []);

  /** Max allowed |translate| so the image can never be dragged off-screen. */
  const bounds = useCallback((s: number) => {
    const el = imgRef.current;
    if (!el) return { x: 0, y: 0 };
    // offsetWidth/Height = untransformed (fit) size
    const w = el.offsetWidth * s;
    const h = el.offsetHeight * s;
    const stage = stageRef.current;
    const vw = stage ? stage.clientWidth : window.innerWidth;
    const vh = stage ? stage.clientHeight : window.innerHeight;
    return { x: Math.max(0, (w - vw) / 2), y: Math.max(0, (h - vh) / 2) };
  }, []);

  const applyView = useCallback((s: number, x: number, y: number, smooth = false) => {
    const ns = clamp(s, MIN_SCALE, MAX_SCALE);
    let nx = x, ny = y;
    if (ns <= MIN_SCALE + 0.001) { nx = 0; ny = 0; } // auto-center at minimum zoom
    else {
      const b = bounds(ns);
      nx = clamp(nx, -b.x, b.x);
      ny = clamp(ny, -b.y, b.y);
    }
    view.current = { scale: ns, tx: nx, ty: ny };
    setAnimate(smooth);
    setScale(ns);
    setTx(nx);
    setTy(ny);
  }, [bounds]);

  /** Zoom keeping the screen point (px,py) anchored. */
  const zoomAt = useCallback((nextScale: number, px: number, py: number, smooth = false) => {
    const stage = stageRef.current;
    const rect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } as DOMRect;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const { scale: s0, tx: x0, ty: y0 } = view.current;
    const s1 = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const k = s1 / s0;
    const dx = px - cx;
    const dy = py - cy;
    applyView(s1, dx - k * (dx - x0), dy - k * (dy - y0), smooth);
  }, [applyView]);

  // ── gestures (native listeners so we can preventDefault reliably on iOS) ─────
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let mode: "none" | "pan" | "pinch" = "none";
    let startTouch = { x: 0, y: 0, tx: 0, ty: 0 };
    let pinch = { dist: 0, scale: 1, cx: 0, cy: 0 };
    let lpTimer: ReturnType<typeof setTimeout> | null = null;
    let lpFired = false;
    let lastTap = 0;
    let lastTapPos = { x: 0, y: 0 };
    let moved = false;

    const clearLP = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
    const dist = (t: TouchList) => {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.hypot(dx, dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        clearLP();
        mode = "pinch";
        pinch = {
          dist: dist(e.touches),
          scale: view.current.scale,
          cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          cy: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        e.preventDefault();
        return;
      }
      const t = e.touches[0];
      moved = false;
      lpFired = false;
      mode = "pan";
      startTouch = { x: t.clientX, y: t.clientY, tx: view.current.tx, ty: view.current.ty };
      clearLP();
      lpTimer = setTimeout(() => {
        lpFired = true;
        lpTimer = null;
        openSheet();
      }, LONG_PRESS_MS);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (mode === "pinch" && e.touches.length >= 2) {
        e.preventDefault();
        const d = dist(e.touches);
        if (pinch.dist > 0) {
          const next = pinch.scale * (d / pinch.dist);
          const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          // anchor on the current midpoint
          const stageRect = stage.getBoundingClientRect();
          const ccx = stageRect.left + stageRect.width / 2;
          const ccy = stageRect.top + stageRect.height / 2;
          const s0 = view.current.scale;
          const s1 = clamp(next, MIN_SCALE, MAX_SCALE);
          const k = s1 / s0;
          const dx = cx - ccx;
          const dy = cy - ccy;
          applyView(s1, dx - k * (dx - view.current.tx), dy - k * (dy - view.current.ty));
        }
        return;
      }
      if (mode !== "pan" || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startTouch.x;
      const dy = t.clientY - startTouch.y;
      if (!moved && Math.hypot(dx, dy) > MOVE_CANCEL_PX) { moved = true; clearLP(); }
      if (lpFired) return;
      if (view.current.scale > MIN_SCALE + 0.001) {
        e.preventDefault();
        applyView(view.current.scale, startTouch.tx + dx, startTouch.ty + dy);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      clearLP();
      const wasPinch = mode === "pinch";
      if (e.touches.length === 0) mode = "none";
      if (lpFired) {
        // Suppress the synthetic click that follows a long press, otherwise it
        // immediately dismisses the action sheet we just opened.
        e.preventDefault();
        return;
      }
      if (wasPinch || moved) return;
      // tap / double-tap
      const t = e.changedTouches[0];
      if (!t) return;
      const now = Date.now();
      const near = Math.hypot(t.clientX - lastTapPos.x, t.clientY - lastTapPos.y) < 40;
      if (now - lastTap < 320 && near) {
        lastTap = 0;
        e.preventDefault();
        if (view.current.scale > MIN_SCALE + 0.001) applyView(MIN_SCALE, 0, 0, true);
        else zoomAt(DBL_SCALE, t.clientX, t.clientY, true);
      } else {
        lastTap = now;
        lastTapPos = { x: t.clientX, y: t.clientY };
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0025);
      zoomAt(view.current.scale * factor, e.clientX, e.clientY);
    };

    const onContextMenu = (e: Event) => { e.preventDefault(); openSheet(); };

    stage.addEventListener("touchstart", onTouchStart, { passive: false });
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    stage.addEventListener("touchend", onTouchEnd, { passive: false });
    stage.addEventListener("touchcancel", onTouchEnd, { passive: false });
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("contextmenu", onContextMenu);
    return () => {
      clearLP();
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
      stage.removeEventListener("touchcancel", onTouchEnd);
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("contextmenu", onContextMenu);
    };
  }, [applyView, zoomAt, openSheet]);

  // ── desktop mouse pan + long-press (mouse hold) ─────────────────────────────
  const drag = useRef<{ on: boolean; x: number; y: number; tx: number; ty: number } | null>(null);
  const mouseLP = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    drag.current = { on: false, x: e.clientX, y: e.clientY, tx: view.current.tx, ty: view.current.ty };
    if (mouseLP.current) clearTimeout(mouseLP.current);
    mouseLP.current = setTimeout(() => { mouseLP.current = null; openSheet(); }, LONG_PRESS_MS + 200);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.on && Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
      d.on = true;
      if (mouseLP.current) { clearTimeout(mouseLP.current); mouseLP.current = null; }
    }
    if (d.on && view.current.scale > MIN_SCALE + 0.001) applyView(view.current.scale, d.tx + dx, d.ty + dy);
  };
  const endMouse = () => {
    if (mouseLP.current) { clearTimeout(mouseLP.current); mouseLP.current = null; }
    drag.current = null;
  };

  // ── save the ORIGINAL full-resolution image ─────────────────────────────────
  const fileName = (() => {
    try {
      const clean = src.split("?")[0].split("#")[0];
      const base = clean.substring(clean.lastIndexOf("/") + 1) || "tls-reference";
      return /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}.png`;
    } catch { return "tls-reference.png"; }
  })();

  const saveImage = async () => {
    if (saving) return;
    setSaving(true);
    let blob: Blob | null = null;
    try {
      const res = await fetch(src, { cache: "force-cache" });
      if (res.ok) blob = await res.blob();
    } catch { /* fall through */ }

    try {
      if (blob) {
        const file = new File([blob], fileName, { type: blob.type || "image/png" });
        const nav = navigator as any;
        // iOS Safari / PWA: native share sheet → "Save Image" to Photos
        if (nav.canShare && nav.canShare({ files: [file] }) && typeof nav.share === "function") {
          try {
            await nav.share({ files: [file], title: label || fileName });
            setSheet(false);
            setSaving(false);
            return;
          } catch (err: any) {
            if (err && (err.name === "AbortError" || err.name === "NotAllowedError")) { setSaving(false); return; }
            // otherwise fall through to download
          }
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 15000);
        setToast("Image saved");
        setSheet(false);
        setSaving(false);
        return;
      }
      // Last resort: open the original so the user can long-press → Save to Photos
      const w = window.open(src, "_blank");
      if (w) { setToast("Opened original image — hold it to save"); setSheet(false); }
      else setToast("Could not save the image. Please try again.");
    } catch {
      setToast("Could not save the image. Please try again.");
    }
    setSaving(false);
  };

  const zoomed = scale > MIN_SCALE + 0.001;

  return createPortal((
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 4000,
        background: "rgba(0,0,0,0.96)",
        display: "flex", flexDirection: "column",
        overscrollBehavior: "none",
        WebkitUserSelect: "none", userSelect: "none",
      }}
    >
      {/* header */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 10,
        padding: "calc(env(safe-area-inset-top, 0px) + 10px) 12px 10px",
        background: "linear-gradient(180deg, rgba(0,0,0,0.75), rgba(0,0,0,0))",
        position: "relative", zIndex: 2,
      }}>
        <button
          onClick={onClose}
          aria-label="Close image"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)",
            color: "#fff", borderRadius: 10, padding: "8px 14px",
            fontSize: 14, fontWeight: 600, fontFamily: "Inter,sans-serif", cursor: "pointer",
          }}
        >
          ← Back
        </button>
        <div style={{
          flex: 1, minWidth: 0, color: "rgba(255,255,255,0.82)", fontSize: 12,
          fontFamily: "Inter,sans-serif", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center",
        }}>{label}</div>
        <div style={{ width: 74, display: "flex", justifyContent: "flex-end" }}>
          {zoomed && (
            <button
              onClick={() => applyView(MIN_SCALE, 0, 0, true)}
              aria-label="Reset zoom"
              style={{
                background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)",
                color: "#fff", borderRadius: 10, padding: "8px 10px",
                fontSize: 12, fontFamily: "Inter,sans-serif", cursor: "pointer",
              }}
            >Reset</button>
          )}
        </div>
      </div>

      {/* stage */}
      <div
        ref={stageRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endMouse}
        onMouseLeave={endMouse}
        onDragStart={e => e.preventDefault()}
        style={{
          flex: 1, minHeight: 0, position: "relative", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          touchAction: "none",
          cursor: zoomed ? "grab" : "zoom-in",
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={label || "reference"}
          draggable={false}
          onLoad={() => applyView(view.current.scale, view.current.tx, view.current.ty)}
          style={{
            maxWidth: "100%", maxHeight: "100%",
            width: "auto", height: "auto",
            objectFit: "contain",
            display: "block",
            transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
            transformOrigin: "center center",
            transition: animate ? "transform 0.22s ease-out" : "none",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
            pointerEvents: "none",
          } as React.CSSProperties}
        />
      </div>

      {/* footer hint */}
      <div style={{
        flexShrink: 0, textAlign: "center",
        padding: "8px 12px calc(env(safe-area-inset-bottom, 0px) + 10px)",
        color: "rgba(255,255,255,0.45)", fontSize: 10.5, fontFamily: "Inter,sans-serif",
        background: "linear-gradient(0deg, rgba(0,0,0,0.7), rgba(0,0,0,0))",
      }}>
        Pinch or double-tap to zoom · hold the image for options
      </div>

      {/* toast */}
      {toast && (
        <div style={{
          position: "absolute", left: "50%", transform: "translateX(-50%)",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 74px)",
          background: "rgba(20,26,38,0.96)", border: "1px solid rgba(255,255,255,0.18)",
          color: "#fff", padding: "9px 14px", borderRadius: 10, fontSize: 12.5,
          fontFamily: "Inter,sans-serif", zIndex: 6, maxWidth: "86%", textAlign: "center",
        }}>{toast}</div>
      )}

      {/* long-press action sheet — exactly two actions */}
      {sheet && (
        <div
          onClick={closeSheetFromBackdrop}
          onContextMenu={e => e.preventDefault()}
          style={{
            position: "absolute", inset: 0, zIndex: 8,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            padding: "0 10px calc(env(safe-area-inset-bottom, 0px) + 10px)",
          } as React.CSSProperties}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "rgba(28,32,40,0.96)",
              borderRadius: 14, overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.12)",
              fontFamily: "Inter,sans-serif",
            }}
          >
            <button
              onClick={saveImage}
              disabled={saving}
              style={{
                width: "100%", background: "none", border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.10)",
                color: "#fff", fontSize: 17, padding: "16px 12px",
                cursor: saving ? "default" : "pointer", fontFamily: "inherit",
                opacity: saving ? 0.6 : 1,
              }}
            >{saving ? "Saving…" : "Save Image"}</button>
            <button
              onClick={() => setSheet(false)}
              style={{
                width: "100%", background: "none", border: "none",
                color: "#5AC8FA", fontSize: 17, fontWeight: 600, padding: "16px 12px",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >Back</button>
          </div>
        </div>
      )}
    </div>
  ), document.body);
}
