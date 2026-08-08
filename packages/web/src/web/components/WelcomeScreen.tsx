import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogIn, Download, Share2, PlusSquare, Check, X, Smartphone } from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   TRAINEE ENTRY / LAUNCH SCREEN
   Shown once per browser session BEFORE login. Never suppressed permanently
   (sessionStorage only — a brand-new visit/session always sees it again).
───────────────────────────────────────────────────────────────────────────── */

export const WELCOME_KEY = "tls_welcome_done";

/** True when the pre-login welcome screen still has to be shown this session. */
export function shouldShowWelcome(): boolean {
  try {
    return sessionStorage.getItem(WELCOME_KEY) !== "1";
  } catch {
    return true;
  }
}

/** Called on logout so the next visit shows the welcome screen again. */
export function resetWelcome() {
  try { sessionStorage.removeItem(WELCOME_KEY); } catch { /* ignore */ }
}

function markWelcomeDone() {
  try { sessionStorage.setItem(WELCOME_KEY, "1"); } catch { /* ignore */ }
}

/* ── PWA install prompt capture ──────────────────────────────────────────────
   beforeinstallprompt can fire before this component mounts, so we capture it
   at module scope (this module is imported by the entry chunk). */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferredPrompt: BIPEvent | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e as BIPEvent;
    promptListeners.forEach(fn => fn());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    promptListeners.forEach(fn => fn());
  });
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const mq = typeof window.matchMedia === "function"
    && (window.matchMedia("(display-mode: standalone)").matches
      || window.matchMedia("(display-mode: fullscreen)").matches
      || window.matchMedia("(display-mode: minimal-ui)").matches);
  return iosStandalone || mq;
}

function isIOS(): boolean {
  const ua = navigator.userAgent || "";
  const iPadOS = navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
}

const CYAN = "#00AEEF";

/* ── Install instructions bottom sheet ───────────────────────────────────── */
function InstallSheet({ ios, onClose }: { ios: boolean; onClose: () => void }) {
  const steps = ios
    ? [
        { icon: <Share2 size={20} strokeWidth={2} color={CYAN} />, text: 'Tap the Share icon in Safari.' },
        { icon: <PlusSquare size={20} strokeWidth={2} color={CYAN} />, text: 'Select "Add to Home Screen".' },
        { icon: <Check size={20} strokeWidth={2} color={CYAN} />, text: 'Tap "Add".' },
      ]
    : [
        { icon: <Smartphone size={20} strokeWidth={2} color={CYAN} />, text: "Open your browser menu (⋮)." },
        { icon: <PlusSquare size={20} strokeWidth={2} color={CYAN} />, text: 'Choose "Install app" or "Add to Home screen".' },
        { icon: <Check size={20} strokeWidth={2} color={CYAN} />, text: "Confirm to finish installing." },
      ];

  /* Rendered through a portal to <body>: a position:fixed overlay nested inside
     another fixed + scrollable ancestor is hit-tested at the wrong offset on
     iOS Safari (visible, but taps land on the element behind it). */
  const sheet = (
    <div
      className="tls-install-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Install TLS Trainer"
    >
      <div className="tls-install-sheet" onClick={e => e.stopPropagation()}>
        <div className="tls-install-grip" />
        <div className="tls-install-head">
          <div className="font-orbitron tls-install-title">Install TLS Trainer</div>
          <button
            className="tls-install-x"
            onClick={e => { e.stopPropagation(); onClose(); }}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <ol className="tls-install-steps">
          {steps.map((s, i) => (
            <li key={i} className="tls-install-step">
              <span className="tls-install-step-n">{i + 1}</span>
              <span className="tls-install-step-ic">{s.icon}</span>
              <span className="tls-install-step-t">{s.text}</span>
            </li>
          ))}
        </ol>
        <button
          className="tls-btn tls-btn--ghost tls-install-cancel"
          onClick={e => { e.stopPropagation(); onClose(); }}
        >
          CANCEL
        </button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.body);
}

/* ── Welcome screen ──────────────────────────────────────────────────────── */
export default function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  const [installed] = useState(() => isStandalone());
  const [hasPrompt, setHasPrompt] = useState(() => deferredPrompt !== null);
  const [sheet, setSheet] = useState<null | "ios" | "other">(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const fn = () => setHasPrompt(deferredPrompt !== null);
    promptListeners.add(fn);
    return () => { promptListeners.delete(fn); };
  }, []);

  // Lock page scroll while the entry screen owns the viewport
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const goLogin = () => { markWelcomeDone(); onContinue(); };

  const doInstall = async () => {
    if (deferredPrompt) {
      try {
        const p = deferredPrompt;
        await p.prompt();
        const choice = await p.userChoice;
        deferredPrompt = null;
        setHasPrompt(false);
        if (choice.outcome === "accepted") setNote("Installing TLS Trainer…");
        else setNote("");
      } catch {
        setNote("Install prompt unavailable — use your browser menu to add TLS Trainer.");
      }
      return;
    }
    setSheet(isIOS() ? "ios" : "other");
  };

  return (
    <div className="tls-welcome">
      {/* corner brackets — existing trainee visual language, pure CSS */}
      <span className="tls-welcome-corner tls-welcome-corner--tl" />
      <span className="tls-welcome-corner tls-welcome-corner--tr" />
      <span className="tls-welcome-corner tls-welcome-corner--bl" />
      <span className="tls-welcome-corner tls-welcome-corner--br" />
      <span className="tls-welcome-glow" aria-hidden="true" />

      <div className="tls-welcome-inner">
        <div className="tls-welcome-mark" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={CYAN} strokeWidth="1.7">
            <circle cx="12" cy="12" r="2" />
            <path d="M12 2a10 10 0 0 1 0 20" />
            <path d="M12 2a10 10 0 0 0 0 20" />
            <line x1="2" y1="12" x2="22" y2="12" />
          </svg>
        </div>

        <h1 className="font-orbitron tls-welcome-title">TLS TRAINER</h1>
        <p className="tls-welcome-sub">Training. Practice. Master TLS.</p>
        <p className="tls-welcome-kicker">TRANSPONDER LANDING SYSTEM</p>

        <div className="tls-welcome-actions">
          <button className="tls-btn tls-btn--primary" onClick={goLogin}>
            <LogIn size={21} strokeWidth={2} />
            <span>{installed ? "CONTINUE" : "LOGIN TO WEB"}</span>
          </button>

          {!installed && (
            <button className="tls-btn tls-btn--ghost" onClick={doInstall}>
              <Download size={21} strokeWidth={2} />
              <span>INSTALL APP</span>
            </button>
          )}
        </div>

        {note && <div className="tls-welcome-note">{note}</div>}
      </div>

      {sheet && <InstallSheet ios={sheet === "ios"} onClose={() => setSheet(null)} />}
    </div>
  );
}
