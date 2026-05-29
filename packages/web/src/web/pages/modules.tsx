import { useState, useEffect, useRef } from "react";
import BackButton from "../components/BackButton";
import { telegramTrack, getSession } from "../hooks/useTelegramTrack";



type Module = {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  lessonCount: number;
  progress?: number;
};

// PDF mapping — one PDF per module, exact filenames
const MODULE_PDFS: Record<number, { label: string; file: string }> = {
  1: { label: "TLS_ANPC_English.pdf",                    file: "TLS_ANPC_English.pdf" },
  2: { label: "TLS_Training_June_2021_KSA.pdf",          file: "TLS_Training_June_2021_KSA.pdf" },
  3: { label: "020-00073_RevF.pdf",                      file: "020-00073_RevF.pdf" },
  4: { label: "020-00072_RevF.pdf",                      file: "020-00072_RevF.pdf" },   // pending upload
  5: { label: "020-00071_RevE.pdf",                      file: "020-00071_RevE.pdf" },
  6: { label: "020-00074_RevG.pdf",                      file: "020-00074_RevG.pdf" },
  7: { label: "020-00076_RevD.pdf",                      file: "020-00076_RevD.pdf" },
  8: { label: "020-00077_RevC.pdf",                      file: "020-00077_RevC.pdf" },
  9: { label: "ATC_quick_guide_TLS.pdf",                 file: "ATC_quick_guide_TLS.pdf" },
};

export default function Modules() {
  const [modules, setModules] = useState<Module[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfStatus, setPdfStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/modules")
      .then(r => r.json())
      .then(data => { setModules(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Check which PDFs exist
  useEffect(() => {
    const checkPdfs = async () => {
      const status: Record<string, boolean> = {};
      for (const pdf of Object.values(MODULE_PDFS)) {
        try {
          const r = await fetch(`/pdfs/${pdf.file}`, { method: "HEAD" });
          status[pdf.file] = r.ok;
        } catch {
          status[pdf.file] = false;
        }
      }
      setPdfStatus(status);
    };
    checkPdfs();
  }, []);

  // Module time tracking
  const moduleOpenTimeRef = useRef<number | null>(null);
  const moduleOpenIdRef   = useRef<{ id: number; title: string } | null>(null);

  const postModuleTime = (durationMs: number) => {
    if (!moduleOpenIdRef.current || durationMs < 3000) return;
    const traineeId = getSession()?.id;
    if (!traineeId) return;
    fetch('/api/trainee/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-trainee-id': traineeId },
      body: JSON.stringify({
        traineeId,
        moduleId: moduleOpenIdRef.current.id,
        moduleName: moduleOpenIdRef.current.title,
        durationMs,
      }),
    }).catch(() => {});
  };

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && moduleOpenTimeRef.current != null) {
        postModuleTime(Date.now() - moduleOpenTimeRef.current);
        moduleOpenIdRef.current = null;
        moduleOpenTimeRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      // Post on unmount too
      if (moduleOpenTimeRef.current != null) {
        postModuleTime(Date.now() - moduleOpenTimeRef.current);
      }
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const toggle = (id: number) => {
    const now = Date.now();
    // Close previously open module — post time
    if (moduleOpenIdRef.current && moduleOpenTimeRef.current != null) {
      postModuleTime(now - moduleOpenTimeRef.current);
      moduleOpenIdRef.current = null;
      moduleOpenTimeRef.current = null;
    }
    if (selected === id) { setSelected(null); return; }
    setSelected(id);
    // Track module open
    const mod = modules.find(m => m.id === id);
    if (mod) {
      telegramTrack.moduleOpen(mod.title);
      moduleOpenIdRef.current = { id: mod.id, title: mod.title };
      moduleOpenTimeRef.current = now;
    }
  };

  const handleOpen = (e: React.MouseEvent, file: string) => {
    e.stopPropagation();
    window.open(`/pdfs/${file}`, "_blank", "noopener,noreferrer");
  };

  const handleSave = (e: React.MouseEvent, file: string, label: string) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = `/pdfs/${file}`;
    a.download = label;
    a.click();
  };

  return (
    <div className="page" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="radar-grid" style={{
        padding: "16px 20px 14px",
        borderBottom: "1px solid rgba(30,144,255,0.15)"
      }}>
        <div style={{ marginBottom: 10 }}>
          <BackButton to="/" />
        </div>
        <div className="font-orbitron text-glow" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
          TRAINING MODULES
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          {modules.length} modules available
        </div>
      </div>

      {/* Modules */}
      <div style={{ padding: "16px" }}>
        {loading ? (
          [...Array(9)].map((_, i) => (
            <div key={i} className="glass-card" style={{ height: 90, marginBottom: 12, opacity: 0.4, animation: "pulse-glow 1.5s ease infinite" }} />
          ))
        ) : (
          modules.map((mod, i) => {
            const pdf = MODULE_PDFS[mod.id];
            const pdfAvailable = pdf && pdfStatus[pdf.file];

            return (
              <div
                key={mod.id}
                className="glass-card fade-in"
                style={{ marginBottom: 12, border: `1px solid ${mod.color}30`, overflow: "hidden", cursor: "pointer", animationDelay: `${i * 0.07}s` }}
                onClick={() => toggle(mod.id)}
              >
                {/* Module Row */}
                <div style={{
                  padding: "16px",
                  background: `linear-gradient(135deg, ${mod.color}15 0%, transparent 100%)`,
                  display: "flex", alignItems: "center", gap: 14
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 10,
                    background: `${mod.color}20`,
                    border: `1px solid ${mod.color}50`,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", flexShrink: 0, gap: 1
                  }}>
                    <span style={{ fontSize: 18 }}>{mod.icon}</span>
                    <span className="font-orbitron" style={{ fontSize: 8, color: mod.color }}>{String(mod.id).padStart(2, "0")}</span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-orbitron" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                      {mod.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {mod.subtitle} · {mod.lessonCount} lessons
                    </div>
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div className="progress-fill" style={{ width: `${mod.progress ?? 0}%`, background: `linear-gradient(90deg, ${mod.color}, #00d4ff)` }} />
                      </div>
                      <span className="font-orbitron" style={{ fontSize: 10, color: mod.color }}>{mod.progress ?? 0}%</span>
                    </div>
                  </div>

                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={mod.color} strokeWidth="2"
                    style={{ transform: selected === mod.id ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>

                {/* Expanded */}
                {selected === mod.id && (
                  <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${mod.color}20` }}>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "14px 0 14px", lineHeight: 1.6 }}>
                      {mod.description}
                    </p>

                    {/* PDF Section */}
                    {pdf && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 8, fontFamily: "Orbitron" }}>
                          REFERENCE DOCUMENT
                        </div>

                        {/* PDF card */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "12px 14px",
                          background: `${mod.color}0d`,
                          border: `1px solid ${mod.color}35`,
                          borderRadius: 10,
                        }}>
                          {/* PDF icon */}
                          <div style={{
                            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                            background: `${mod.color}20`, border: `1px solid ${mod.color}50`,
                            display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={mod.color} strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <line x1="16" y1="13" x2="8" y2="13"/>
                              <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                          </div>

                          {/* Filename */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {pdf.label}
                            </div>
                            {!pdfAvailable && (
                              <div style={{ fontSize: 10, color: "#ff6b35", marginTop: 2 }}>pending upload</div>
                            )}
                          </div>

                          {/* Buttons */}
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button
                              onClick={(e) => handleOpen(e, pdf.file)}
                              disabled={!pdfAvailable}
                              style={{
                                padding: "6px 12px",
                                background: pdfAvailable ? `${mod.color}25` : "rgba(255,255,255,0.05)",
                                border: `1px solid ${pdfAvailable ? mod.color + "70" : "rgba(255,255,255,0.1)"}`,
                                borderRadius: 6, cursor: pdfAvailable ? "pointer" : "not-allowed",
                                color: pdfAvailable ? mod.color : "var(--text-muted)",
                                fontFamily: "Orbitron", fontSize: 9, letterSpacing: "0.08em",
                                display: "flex", alignItems: "center", gap: 4
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                              OPEN
                            </button>
                            <button
                              onClick={(e) => handleSave(e, pdf.file, pdf.label)}
                              disabled={!pdfAvailable}
                              style={{
                                padding: "6px 12px",
                                background: pdfAvailable ? `${mod.color}15` : "rgba(255,255,255,0.05)",
                                border: `1px solid ${pdfAvailable ? mod.color + "50" : "rgba(255,255,255,0.1)"}`,
                                borderRadius: 6, cursor: pdfAvailable ? "pointer" : "not-allowed",
                                color: pdfAvailable ? mod.color : "var(--text-muted)",
                                fontFamily: "Orbitron", fontSize: 9, letterSpacing: "0.08em",
                                display: "flex", alignItems: "center", gap: 4
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                              </svg>
                              SAVE
                            </button>
                          </div>
                        </div>
                      </div>
                    )}


                  </div>
                )}
              </div>
            );
          })
        )}
      </div>


    </div>
  );
}
