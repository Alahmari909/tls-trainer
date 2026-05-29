// ── Settings helpers (avoids circular import) ─────────────────────────────────
import { loadSettings } from "../hooks/useSettings";

function canPlaySound(): boolean {
  try { return loadSettings().notificationSound; } catch { return true; }
}
function canVibrate(): boolean {
  try { return loadSettings().notificationVibrate; } catch { return true; }
}

// ── Audio unlock registry ─────────────────────────────────────────────────────
let _audioCtx: AudioContext | null = null;

export function getAudioCtx(): AudioContext | null {
  return _audioCtx;
}

export function unlockAudio() {
  try {
    if (!_audioCtx) {
      _audioCtx = new AudioContext();
    }
    if (_audioCtx.state === "suspended") {
      _audioCtx.resume().catch(() => {});
    }
  } catch { /* no audio available */ }
}

// ── Play alert tone ───────────────────────────────────────────────────────────
export function playAlertTone(type: "message" | "info" | "warning" | "danger" | "sound" = "info") {
  if (!canPlaySound()) return;
  try {
    unlockAudio();
    const ctx = _audioCtx;
    if (!ctx) return;
    if (ctx.state === "suspended") { ctx.resume().catch(() => {}); return; }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case "message":
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
        break;
      case "sound":
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.24);
        osc.frequency.setValueAtTime(440, ctx.currentTime + 0.36);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start(); osc.stop(ctx.currentTime + 0.6);
        break;
      case "warning":
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
        osc.frequency.setValueAtTime(440, ctx.currentTime + 0.3);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.55);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
        osc.start(); osc.stop(ctx.currentTime + 0.65);
        break;
      case "danger":
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(180, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(220, ctx.currentTime + 0.2);
        osc.frequency.setValueAtTime(180, ctx.currentTime + 0.3);
        osc.frequency.setValueAtTime(220, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start(); osc.stop(ctx.currentTime + 0.6);
        break;
      default: // info
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(); osc.stop(ctx.currentTime + 0.35);
    }
  } catch { /* audio blocked */ }
}

// ── Vibrate ───────────────────────────────────────────────────────────────────
export function vibrate(type: "light" | "medium" | "heavy" = "medium") {
  if (!canVibrate()) return;
  try {
    if (!navigator.vibrate) return;
    switch (type) {
      case "light":  navigator.vibrate(100); break;
      case "medium": navigator.vibrate([200, 80, 200]); break;
      case "heavy":  navigator.vibrate([300, 100, 300, 100, 300]); break;
    }
  } catch { /* not supported */ }
}

// ── Toast system ──────────────────────────────────────────────────────────────
export interface ToastItem {
  id: string;
  message: string;
  alertType: string;
  ts: number;
}

export const _toastListeners: Set<(t: ToastItem) => void> = new Set();

export function showToast(message: string, alertType: string) {
  const toast: ToastItem = { id: crypto.randomUUID(), message, alertType, ts: Date.now() };
  _toastListeners.forEach(fn => fn(toast));
}
