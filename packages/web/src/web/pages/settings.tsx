import { useState, useEffect } from "react";
import BackButton from "../components/BackButton";
import { getSession } from "../hooks/useTelegramTrack";
import { useSettings } from "../hooks/useSettings";
import { playAlertTone } from "../lib/audio";

const C = {
  navy:  "#071426",
  cyan:  "#00AEEF",
  blue:  "#35D4FF",
  green: "#00D26A",
  red:   "#FF4D4D",
  gold:  "#C9A66B",
};

function Toggle({ on, onChange, disabled = false }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onChange}
      aria-checked={on}
      role="switch"
      style={{
        width: 46, height: 26, borderRadius: 13, border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "rgba(255,255,255,0.06)" : on ? C.cyan : "rgba(255,255,255,0.1)",
        position: "relative", transition: "background 0.25s", flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: on ? 23 : 3,
        width: 20, height: 20, borderRadius: "50%",
        background: disabled ? "rgba(255,255,255,0.3)" : on ? C.navy : "rgba(255,255,255,0.5)",
        transition: "left 0.25s, background 0.25s",
        display: "block",
      }} />
    </button>
  );
}

function Section({ title, titleAr, children }: { title: string; titleAr?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <h2 style={{
          fontFamily: "Orbitron", fontSize: 11, letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.35)", margin: 0, textTransform: "uppercase",
        }}>{title}</h2>
        {titleAr && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "Rajdhani" }}>{titleAr}</span>}
      </div>
      <div style={{
        background: "rgba(28,38,51,0.5)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, overflow: "hidden",
      }}>{children}</div>
    </div>
  );
}

function SettingRow({ label, labelAr, desc, children, last = false }: {
  label: string; labelAr?: string; desc?: string; children: React.ReactNode; last?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16, padding: "15px 18px",
      borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.05)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{label}</span>
          {labelAr && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{labelAr}</span>}
        </div>
        {desc && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function SaveBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={{
      background: "rgba(0,210,106,0.12)", border: "1px solid rgba(0,210,106,0.4)",
      borderRadius: 10, padding: "12px 16px", marginBottom: 20,
      display: "flex", alignItems: "center", gap: 10,
      color: C.green, fontSize: 14, fontWeight: 600, fontFamily: "Rajdhani",
      animation: "fadeIn 0.2s ease",
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Settings saved · تم حفظ الإعدادات
    </div>
  );
}

export default function Settings() {
  const session = getSession();
  const [settings, updateSettings] = useSettings();
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({
    name:  session?.name  ?? "",
    rank:  session?.rank  ?? "",
    unit:  session?.unit  ?? "",
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  // Auto-save on toggle with banner flash
  function toggle(key: keyof typeof settings) {
    updateSettings({ [key]: !settings[key] });
    showSaved();
    // Play a quick preview sound when enabling notification sound
    if (key === "notificationSound" && !settings.notificationSound) {
      setTimeout(() => playAlertTone("info"), 100);
    }
  }

  function showSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function saveProfile() {
    if (!session) return;
    setProfileSaving(true);
    try {
      await fetch("/api/trainee/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, name: profile.name, rank: profile.rank, unit: profile.unit }),
      });
      // Update localStorage session
      const s = { ...session, name: profile.name, rank: profile.rank, unit: profile.unit };
      localStorage.setItem("tls_trainee_session", JSON.stringify(s));
      window.dispatchEvent(new Event("storage"));
    } catch { /* best effort */ }
    setProfileSaving(false);
    setEditingProfile(false);
    showSaved();
  }

  // If no session, show login prompt
  if (!session) {
    return (
      <div style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${C.navy} 0%, #050d1a 60%, #0a1628 100%)`,
        paddingTop: 80, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Rajdhani, sans-serif",
      }}>
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "0 32px" }}>
          <div style={{ fontFamily: "Orbitron", fontSize: 14, marginBottom: 8, color: C.cyan }}>LOGIN REQUIRED</div>
          <div style={{ fontSize: 14 }}>Please log in to access settings.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${C.navy} 0%, #050d1a 60%, #0a1628 100%)`,
      paddingTop: 68, paddingBottom: 60,
      fontFamily: "Rajdhani, sans-serif",
    }}>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 14 }}><BackButton to="/" /></div>
          <h1 style={{ fontFamily: "Orbitron", fontSize: 20, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "0.06em" }}>
            SETTINGS
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "4px 0 0" }}>الإعدادات</p>
        </div>

        <SaveBanner visible={saved} />

        {/* ── Profile ─────────────────────────────────────────────────── */}
        <Section title="Profile" titleAr="الملف الشخصي">
          {!editingProfile ? (
            <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                background: `linear-gradient(135deg, ${C.cyan}, ${C.blue})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Orbitron", fontSize: 16, fontWeight: 700, color: C.navy,
              }}>
                {session.name.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{session.name}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                  {[session.rank, session.unit].filter(Boolean).join(" · ") || "No rank/unit set"}
                </div>
              </div>
              <button
                onClick={() => setEditingProfile(true)}
                style={{
                  background: "rgba(0,174,239,0.1)", border: "1px solid rgba(0,174,239,0.3)",
                  borderRadius: 8, padding: "7px 14px",
                  color: C.cyan, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "Rajdhani",
                }}
              >Edit</button>
            </div>
          ) : (
            <div style={{ padding: "16px 18px" }}>
              {[
                { label: "Name", key: "name" as const },
                { label: "Rank", key: "rank" as const },
                { label: "Unit", key: "unit" as const },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 4, letterSpacing: "0.1em", fontFamily: "Orbitron" }}>
                    {f.label.toUpperCase()}
                  </div>
                  <input
                    value={profile[f.key]}
                    onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(0,174,239,0.3)",
                      borderRadius: 8, padding: "10px 14px",
                      color: "#fff", fontSize: 14, fontFamily: "Rajdhani",
                      outline: "none",
                    }}
                  />
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  style={{
                    flex: 1, padding: "10px",
                    background: "rgba(0,210,106,0.15)", border: "1px solid rgba(0,210,106,0.4)",
                    borderRadius: 8, color: C.green, fontSize: 14, fontWeight: 600,
                    cursor: "pointer", fontFamily: "Rajdhani",
                    opacity: profileSaving ? 0.6 : 1,
                  }}
                >{profileSaving ? "Saving…" : "Save Profile"}</button>
                <button
                  onClick={() => { setEditingProfile(false); setProfile({ name: session.name, rank: session.rank ?? "", unit: session.unit ?? "" }); }}
                  style={{
                    padding: "10px 16px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: 600,
                    cursor: "pointer", fontFamily: "Rajdhani",
                  }}
                >Cancel</button>
              </div>
            </div>
          )}
        </Section>

        {/* ── Display Preferences ─────────────────────────────────────── */}
        <Section title="Display" titleAr="العرض">
          <SettingRow
            label="Arabic Labels"
            labelAr="التسميات العربية"
            desc="Show Arabic text alongside English throughout the app"
          >
            <Toggle on={settings.showArabicLabels} onChange={() => toggle("showArabicLabels")} />
          </SettingRow>
          <SettingRow
            label="Sound Effects"
            labelAr="المؤثرات الصوتية"
            desc="Play sounds on quiz answers and achievements"
            last
          >
            <Toggle on={settings.soundEffects} onChange={() => toggle("soundEffects")} />
          </SettingRow>
        </Section>

        {/* ── Alerts ──────────────────────────────────────────────────── */}
        <Section title="Instructor Alerts" titleAr="تنبيهات المدرب">
          <SettingRow
            label="Notification Sound"
            labelAr="صوت الإشعار"
            desc="Play a tone when the instructor sends you an alert"
          >
            <Toggle on={settings.notificationSound} onChange={() => toggle("notificationSound")} />
          </SettingRow>
          <SettingRow
            label="Vibration"
            labelAr="الاهتزاز"
            desc="Vibrate device on incoming alerts (mobile only)"
            last
          >
            <Toggle on={settings.notificationVibrate} onChange={() => toggle("notificationVibrate")} />
          </SettingRow>
        </Section>

        {/* Info footer */}
        <div style={{
          textAlign: "center", color: "rgba(255,255,255,0.15)",
          fontSize: 11, fontFamily: "Orbitron", letterSpacing: "0.1em", marginTop: 8,
        }}>
          TLS TRAINER · v2.1.0
        </div>

      </div>
    </div>
  );
}
