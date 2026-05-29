// ── User Settings — persisted to localStorage ─────────────────────────────────
// Only trainee-level preferences. No system/admin settings here.

export const SETTINGS_KEY = "tls_user_settings";

export interface UserSettings {
  showArabicLabels: boolean;   // show Arabic text alongside English
  soundEffects: boolean;       // quiz/achievement sounds
  notificationSound: boolean;  // play tone on instructor alerts
  notificationVibrate: boolean; // vibrate on instructor alerts
}

export const DEFAULT_SETTINGS: UserSettings = {
  showArabicLabels: true,
  soundEffects: true,
  notificationSound: true,
  notificationVibrate: true,
};

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: UserSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  // Dispatch event so other tabs/hooks can react
  window.dispatchEvent(new Event("tls_settings_changed"));
}

/** React hook — auto-reloads when settings change in any tab */
import { useState, useEffect } from "react";

export function useSettings(): [UserSettings, (patch: Partial<UserSettings>) => void] {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  useEffect(() => {
    const handler = () => setSettings(loadSettings());
    window.addEventListener("tls_settings_changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("tls_settings_changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const update = (patch: Partial<UserSettings>) => {
    const next = { ...settings, ...patch };
    saveSettings(next);
    setSettings(next);
  };

  return [settings, update];
}
