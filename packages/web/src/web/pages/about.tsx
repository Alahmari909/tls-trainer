import { useState, useEffect, useRef, useCallback } from "react";

// ── Radar Systems Experience ──────────────────────────────────────────────────
const EXPERIENCE = [
  {
    id: "TPS72",
    system: "TPS-72",
    fullName: "TPS-72 Ground Surveillance Radar",
    company: "Westinghouse",
    country: "USA",
    flag: "🇺🇸",
    period: "2001 – 2015",
    years: 14,
    status: "completed",
    role: "Ground Radar Operation & Maintenance",
    color: "#C9A66B",
    icon: "📻",
  },
  {
    id: "TPS78",
    system: "TPS-78",
    fullName: "TPS-78 Ground Surveillance Radar",
    company: "Northrop Grumman Company",
    country: "USA",
    flag: "🇺🇸",
    period: "2015 – Present",
    years: 2025 - 2015,
    status: "active",
    role: "Ground Radar Operation & Maintenance Specialist",
    color: "#00AEEF",
    icon: "🎯",
  },
  {
    id: "GM200",
    system: "GM-200",
    fullName: "GM-200 Multi-Mission Ground Master Radar",
    company: "Thales",
    country: "France",
    flag: "🇫🇷",
    period: "2019 – Present",
    years: 2025 - 2019,
    status: "active",
    role: "Multi-Mission Radar Operation & Maintenance",
    color: "#35D4FF",
    icon: "📡",
  },
  {
    id: "TLS",
    system: "TLS",
    fullName: "Transponder Landing System",
    company: "ANPC",
    country: "USA",
    flag: "🇺🇸",
    period: "2022 – Present",
    years: 2025 - 2022,
    status: "active",
    role: "TLS Operation, Maintenance & Technical Training",
    color: "#00D26A",
    icon: "✈️",
  },
];

const TOTAL_YEARS = 2025 - 2001; // 24

// ── Certifications ────────────────────────────────────────────────────────────
const CERTIFICATIONS = [
  {
    id: "tps78-training",
    title: "Saudi TPS-78 Radar Maintenance Training",
    org: "Northrop Grumman Electronic Systems",
    detail: "USA · November 2015 · 12 weeks",
    color: "#00AEEF",
    icon: "🎯",
    certNo: null,
  },
  {
    id: "ipc-j001",
    title: "Certified IPC Specialist — J-STD-001",
    org: "IPC Association",
    detail: "Soldering of Electronic Assemblies",
    color: "#35D4FF",
    icon: "🔧",
    certNo: "J001-S 1856738670",
  },
  {
    id: "ipc-7711",
    title: "Certified IPC Specialist — IPC-7711/7721",
    org: "IPC Association",
    detail: "Rework & Repair of Electronic Assemblies",
    color: "#35D4FF",
    icon: "🔩",
    certNo: "RR-S 5856739066",
  },
  {
    id: "tpc",
    title: "Trainer Preparation Certificate (TPC)",
    org: "Authorized Trainer Qualification Program",
    detail: "Professional Training Delivery",
    color: "#FFD166",
    icon: "🏫",
    certNo: null,
  },
  {
    id: "anpc",
    title: "ANPC Certification",
    org: "Aviation / Navigation Professional Certification",
    detail: "Transponder Landing System",
    color: "#00D26A",
    icon: "✈️",
    certNo: null,
  },
];

// ── Technical Skills ──────────────────────────────────────────────────────────
const SKILL_GROUPS = [
  {
    label: "Radar & Navigation",
    color: "#00AEEF",
    icon: "📡",
    skills: ["TLS Operation", "Ground Radar TPS Series", "GM-200 Radar", "Transponder Systems"],
  },
  {
    label: "Electronics & Repair",
    color: "#35D4FF",
    icon: "🔧",
    skills: ["PCB Soldering", "SMT Rework", "Circuit Repair", "Electronic Assembly", "Conformal Coating"],
  },
  {
    label: "Field Operations",
    color: "#00D26A",
    icon: "🛡️",
    skills: ["Preventive Maintenance", "Fault Diagnosis", "System Troubleshooting", "Aviation Environment"],
  },
  {
    label: "Training & Documentation",
    color: "#FFD166",
    icon: "📋",
    skills: ["Technical Reporting", "Maintenance Logs", "IPC Training Delivery", "Structured Training"],
  },
];

// ── Skill data with percentages ─────────────────────────────────────────────
const SKILL_GROUPS_WITH_PCT = [
  {
    label: "Radar & Navigation",
    color: "#00AEEF",
    icon: "📡",
    skills: [
      { name: "TLS Operation", pct: 95 },
      { name: "Ground Radar TPS Series", pct: 98 },
      { name: "GM-200 Radar", pct: 82 },
      { name: "Transponder Systems", pct: 90 },
    ],
  },
  {
    label: "Electronics & Repair",
    color: "#35D4FF",
    icon: "🔧",
    skills: [
      { name: "PCB Soldering", pct: 95 },
      { name: "SMT Rework", pct: 88 },
      { name: "Circuit Repair", pct: 85 },
      { name: "Electronic Assembly", pct: 90 },
      { name: "Conformal Coating", pct: 78 },
    ],
  },
  {
    label: "Field Operations",
    color: "#00D26A",
    icon: "🛡️",
    skills: [
      { name: "Preventive Maintenance", pct: 97 },
      { name: "Fault Diagnosis", pct: 92 },
      { name: "System Troubleshooting", pct: 90 },
      { name: "Aviation Environment", pct: 88 },
    ],
  },
  {
    label: "Training & Documentation",
    color: "#FFD166",
    icon: "📋",
    skills: [
      { name: "Technical Reporting", pct: 90 },
      { name: "Maintenance Logs", pct: 92 },
      { name: "IPC Training Delivery", pct: 85 },
      { name: "Structured Training", pct: 88 },
    ],
  },
];

// ── Company logo placeholders ─────────────────────────────────────────────────
const COMPANY_LOGOS: Record<string, { letter: string; bg: string; fg: string }> = {
  Westinghouse:             { letter: "W", bg: "#1a2a4a", fg: "#C9A66B" },
  "Northrop Grumman Company": { letter: "NG", bg: "#0a1e38", fg: "#00AEEF" },
  Thales:                   { letter: "T", bg: "#0d1a2e", fg: "#35D4FF" },
  ANPC:                     { letter: "A", bg: "#0a1f14", fg: "#00D26A" },
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Counts from 0 to `target` over `duration` ms once `start` is true */
function useCountUp(target: number, duration = 1200, start = false): number {
  const [count, setCount] = useState(0);
  const raf = useRef<number>(0);
  const startTime = useRef<number>(0);

  const animate = useCallback((ts: number) => {
    if (!startTime.current) startTime.current = ts;
    const elapsed = ts - startTime.current;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    setCount(Math.round(eased * target));
    if (progress < 1) raf.current = requestAnimationFrame(animate);
  }, [target, duration]);

  useEffect(() => {
    if (!start) return;
    startTime.current = 0;
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [start, animate]);

  return count;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return { copied, copy };
}

// ── Profile Photo ─────────────────────────────────────────────────────────────
// ── Company Logo Placeholder ──────────────────────────────────────────────────────────
function CompanyLogo({ company, size = 36 }: { company: string; size?: number }) {
  const logo = COMPANY_LOGOS[company];
  if (!logo) return null;
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, flexShrink: 0,
      background: logo.bg,
      border: `1px solid ${logo.fg}40`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter", fontWeight: 800,
      fontSize: logo.letter.length > 1 ? size * 0.28 : size * 0.38,
      color: logo.fg,
      letterSpacing: logo.letter.length > 1 ? "-0.04em" : "0",
      boxShadow: `0 0 8px ${logo.fg}25`,
    }}>
      {logo.letter}
    </div>
  );
}

// ── Animated Skill Bar ─────────────────────────────────────────────────────────────────
function SkillBar({ name, pct, color, delay = 0, animate: shouldAnimate = false }: {
  name: string; pct: number; color: string; delay?: number; animate?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const rgb = hexToRgb(color);

  useEffect(() => {
    if (!shouldAnimate) return;
    const t = setTimeout(() => setWidth(pct), delay);
    return () => clearTimeout(t);
  }, [shouldAnimate, pct, delay]);

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "Inter" }}>{name}</span>
        <span style={{ fontSize: 10, color, fontFamily: "Inter", fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${width}%`,
          background: `linear-gradient(90deg, ${color}, rgba(${rgb},0.5))`,
          borderRadius: 3,
          boxShadow: `0 0 6px rgba(${rgb},0.6)`,
          transition: `width 0.9s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        }} />
      </div>
    </div>
  );
}

// ── Animated Stats Card ────────────────────────────────────────────────────────────────
function StatCard({ label, target, sub, started }: { label: string; target: number; sub: string; started: boolean }) {
  const count = useCountUp(target, 1000 + target * 20, started);
  return (
    <div style={{
      background: "rgba(8,15,28,0.9)",
      border: "1px solid rgba(0,174,239,0.15)",
      borderRadius: 10, padding: "10px 4px",
      textAlign: "center",
    }}>
      <div className="font-orbitron" style={{ fontSize: 22, fontWeight: 700, color: "var(--accent-cyan)", lineHeight: 1 }}>
        {count}
      </div>
      <div className="font-orbitron" style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: "0.1em", marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 2, fontFamily: "Inter" }}>{sub}</div>
    </div>
  );
}

function ProfilePhoto({ size = 90 }: { size?: number }) {
  const [imgErr, setImgErr] = useState(false);
  if (!imgErr) {
    return (
      <img
        src="/profile.jpg"
        alt="Ayidh A. Alahmari"
        onError={() => setImgErr(true)}
        style={{ width: size, height: size, objectFit: "cover", borderRadius: "50%" }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, #00AEEF, #35D4FF)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter", fontSize: size * 0.28, fontWeight: 700, color: "#020810",
    }}>
      AA
    </div>
  );
}

// ── Online dot ────────────────────────────────────────────────────────────────
function OnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const h = () => setOnline(navigator.onLine);
    window.addEventListener("online", h);
    window.addEventListener("offline", h);
    setOnline(navigator.onLine);
    return () => { window.removeEventListener("online", h); window.removeEventListener("offline", h); };
  }, []);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: online ? "#00D26A" : "#ff4d4d",
        boxShadow: online ? "0 0 6px #00D26A" : "0 0 6px #ff4d4d",
        display: "inline-block",
        animation: online ? "pulse-glow 2s infinite" : "none",
      }} />
      <span style={{ fontSize: 9, fontFamily: "Inter", letterSpacing: "0.1em", color: online ? "#00D26A" : "var(--text-muted)" }}>
        {online ? "ONLINE" : "OFFLINE"}
      </span>
    </span>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ label, icon }: { label: string; icon: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div className="font-orbitron" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--accent-cyan)", fontWeight: 700 }}>
          {label}
        </div>
        <div style={{ marginTop: 4, height: 1, background: "linear-gradient(90deg, rgba(0,174,239,0.5), transparent)" }} />
      </div>
    </div>
  );
}

// ── Experience Card ────────────────────────────────────────────────────────────
function ExperienceCard({ exp, index }: { exp: typeof EXPERIENCE[0]; index: number }) {
  const barWidth = Math.round((exp.years / TOTAL_YEARS) * 100);
  const isActive = exp.status === "active";
  const rgb = hexToRgb(exp.color);

  return (
    <div
      style={{
        background: `rgba(${rgb},0.05)`,
        border: `1px solid rgba(${rgb},0.25)`,
        borderRadius: 12,
        overflow: "hidden",
        animation: `fadeIn 0.4s ease ${index * 0.08}s both`,
      }}
    >
      <div style={{ height: 2, background: `linear-gradient(90deg, ${exp.color}, transparent)` }} />
      <div style={{ padding: "14px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            background: `rgba(${rgb},0.12)`,
            border: `1px solid rgba(${rgb},0.35)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}>
            {exp.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="font-orbitron" style={{ fontSize: 14, fontWeight: 700, color: exp.color }}>
                {exp.system}
              </span>
              {isActive ? (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 8, fontFamily: "Inter", letterSpacing: "0.1em",
                  background: "rgba(0,210,106,0.15)", border: "1px solid rgba(0,210,106,0.4)",
                  color: "#00D26A", padding: "2px 8px", borderRadius: 10,
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%", background: "#00D26A",
                    display: "inline-block", animation: "pulse-glow 1.5s infinite",
                  }} />
                  ACTIVE
                </span>
              ) : (
                <span style={{
                  fontSize: 8, fontFamily: "Inter", letterSpacing: "0.1em",
                  background: "rgba(201,166,107,0.12)", border: "1px solid rgba(201,166,107,0.3)",
                  color: "#C9A66B", padding: "2px 8px", borderRadius: 10,
                }}>
                  COMPLETED
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, fontFamily: "Inter" }}>
              {exp.fullName}
            </div>
          </div>
        </div>

        {/* Details */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginTop: 12 }}>
          <div>
            <div className="font-orbitron" style={{ fontSize: 8, letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 3 }}>COMPANY</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <CompanyLogo company={exp.company} size={30} />
              <div>
                <div style={{ fontSize: 11, color: "var(--text-primary)", fontFamily: "Inter", fontWeight: 600, lineHeight: 1.2 }}>
                  {exp.flag} {exp.company}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter" }}>{exp.country}</div>
              </div>
            </div>
          </div>
          <div>
            <div className="font-orbitron" style={{ fontSize: 8, letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 3 }}>PERIOD</div>
            <div style={{ fontSize: 12, color: exp.color, fontFamily: "Inter", fontWeight: 700 }}>{exp.period}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter" }}>{exp.years} year{exp.years !== 1 ? "s" : ""}</div>
          </div>
        </div>

        {/* Role */}
        <div style={{
          marginTop: 10, padding: "8px 10px",
          background: `rgba(${rgb},0.07)`,
          border: `1px solid rgba(${rgb},0.15)`,
          borderRadius: 8,
        }}>
          <div className="font-orbitron" style={{ fontSize: 8, letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 3 }}>ROLE</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "Inter", lineHeight: 1.4 }}>{exp.role}</div>
        </div>

        {/* Bar */}
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "Inter", letterSpacing: "0.1em" }}>EXPERIENCE SPAN</span>
            <span style={{ fontSize: 9, color: exp.color, fontFamily: "Inter" }}>{exp.years}/{TOTAL_YEARS} yrs</span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${barWidth}%`,
              background: `linear-gradient(90deg, ${exp.color}, rgba(${rgb},0.4))`,
              borderRadius: 2,
              boxShadow: `0 0 6px rgba(${rgb},0.6)`,
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cert Card ─────────────────────────────────────────────────────────────────
function CertCard({ cert, index }: { cert: typeof CERTIFICATIONS[0]; index: number }) {
  const rgb = hexToRgb(cert.color);
  return (
    <div style={{
      background: `rgba(${rgb},0.05)`,
      border: `1px solid rgba(${rgb},0.22)`,
      borderRadius: 12, padding: "14px 14px",
      animation: `fadeIn 0.4s ease ${index * 0.07}s both`,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9, flexShrink: 0,
          background: `rgba(${rgb},0.12)`,
          border: `1px solid rgba(${rgb},0.3)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>
          {cert.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: cert.color, fontFamily: "Inter", lineHeight: 1.3 }}>
            {cert.title}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "Inter", marginTop: 2 }}>
            {cert.org}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter", marginTop: 2 }}>
            {cert.detail}
          </div>
          {cert.certNo && (
            <div style={{
              marginTop: 6, display: "inline-block",
              fontSize: 9, fontFamily: "Inter", letterSpacing: "0.08em",
              background: `rgba(${rgb},0.1)`,
              border: `1px solid rgba(${rgb},0.25)`,
              color: cert.color, padding: "2px 8px", borderRadius: 6,
            }}>
              CERT# {cert.certNo}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CV Modal ──────────────────────────────────────────────────────────────────
function CVModal({ onClose }: { onClose: () => void }) {
  const C = { cyan: "#00AEEF", blue: "#35D4FF", green: "#00D26A", yellow: "#FFD166", red: "#FF4D4D", gold: "#C9A66B" };
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 3000,
      background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
    } as React.CSSProperties} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: "100%", maxWidth: 520,
        height: "min(94dvh, 94vh)",
        background: "#071426", border: `1px solid ${C.cyan}30`,
        borderRadius: "16px 16px 0 0", overflow: "hidden",
        display: "flex", flexDirection: "column",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px 14px", borderBottom: `1px solid ${C.cyan}20`,
          background: "linear-gradient(180deg,#0a1e38,#071426)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: "Inter", fontSize: 8, letterSpacing: "0.25em", color: C.cyan, marginBottom: 4 }}>ADMIN PROFILE</div>
            <div style={{ fontFamily: "Inter", fontSize: 16, fontWeight: 700, color: "#fff" }}>Ayidh A. Alahmari</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>TLS Technical Trainer · RSAF · Jeddah</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 22, padding: "4px 8px" }}>✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

          {/* Professional Profile */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Inter", fontSize: 9, letterSpacing: "0.2em", color: C.cyan, marginBottom: 10 }}>PROFESSIONAL PROFILE</div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "Inter", lineHeight: 1.7, margin: 0 }}>
              Over {TOTAL_YEARS} years of experience in Ground Surveillance Radar operation and maintenance within the Royal Saudi Air Force.
              Specialist in TPS-72 and TPS-78 radar systems with deep expertise in electronics repair, system diagnostics, and technical training delivery.
              Certified IPC Specialist and Authorized Trainer with a proven track record in field operations and instructional design.
            </p>
          </div>

          {/* Radar Systems Experience */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Inter", fontSize: 9, letterSpacing: "0.2em", color: C.gold, marginBottom: 10 }}>RADAR SYSTEMS EXPERIENCE</div>
            {EXPERIENCE.map(exp => (
              <div key={exp.id} style={{
                padding: "12px 14px", marginBottom: 8,
                background: `${exp.color}06`, border: `1px solid ${exp.color}20`, borderRadius: 10,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 700, color: exp.color }}>{exp.system}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter" }}>{exp.period}</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "Inter", marginBottom: 3 }}>{exp.fullName}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "Inter" }}>{exp.company} · {exp.flag} {exp.country}</div>
                <div style={{ fontSize: 11, color: exp.color, fontFamily: "Inter", marginTop: 4 }}>{exp.role}</div>
                <div style={{
                  display: "inline-block", marginTop: 6, fontSize: 9, fontFamily: "Inter",
                  padding: "2px 8px", borderRadius: 8,
                  background: exp.status === "active" ? "rgba(0,210,106,0.12)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${exp.status === "active" ? "rgba(0,210,106,0.35)" : "rgba(255,255,255,0.1)"}`,
                  color: exp.status === "active" ? C.green : "var(--text-muted)",
                }}>{exp.status === "active" ? "● ACTIVE" : "COMPLETED"} · {exp.years} YRS</div>
              </div>
            ))}
          </div>

          {/* Certifications */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Inter", fontSize: 9, letterSpacing: "0.2em", color: C.yellow, marginBottom: 10 }}>CERTIFICATIONS</div>
            {CERTIFICATIONS.map(cert => (
              <div key={cert.id} style={{
                padding: "10px 14px", marginBottom: 8,
                background: `${cert.color}06`, border: `1px solid ${cert.color}20`, borderRadius: 10,
                display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{cert.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "Inter", marginBottom: 2 }}>{cert.title}</div>
                  <div style={{ fontSize: 11, color: cert.color, fontFamily: "Inter" }}>{cert.org}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter", marginTop: 2 }}>{cert.detail}</div>
                  {cert.certNo && (
                    <div style={{ fontSize: 9, fontFamily: "Inter", color: "var(--text-muted)", marginTop: 4 }}>CERT# {cert.certNo}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Technical Skills */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Inter", fontSize: 9, letterSpacing: "0.2em", color: C.blue, marginBottom: 10 }}>TECHNICAL SKILLS</div>
            {SKILL_GROUPS.map(grp => (
              <div key={grp.label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontFamily: "Inter", color: grp.color, marginBottom: 6 }}>{grp.icon} {grp.label}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {grp.skills.map(s => (
                    <span key={s} style={{
                      fontSize: 10, fontFamily: "Inter", padding: "3px 10px", borderRadius: 12,
                      background: `${grp.color}10`, border: `1px solid ${grp.color}25`, color: grp.color,
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Languages */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Inter", fontSize: 9, letterSpacing: "0.2em", color: C.green, marginBottom: 10 }}>LANGUAGES</div>
            {[
              { lang: "Arabic", level: "Native", pct: 100, color: C.gold },
              { lang: "English", level: "Professional", pct: 75, color: C.cyan },
            ].map(l => (
              <div key={l.lang} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "Inter" }}>{l.lang}</span>
                  <span style={{ fontSize: 10, color: l.color, fontFamily: "Inter" }}>{l.level}</span>
                </div>
                <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${l.pct}%`, background: `linear-gradient(90deg,${l.color},${C.blue})`, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: "Inter", fontSize: 9, letterSpacing: "0.2em", color: C.red, marginBottom: 10 }}>CONTACT</div>
            {[
              { label: "Email", value: "alahmari60@yahoo.com", icon: "✉️" },
              { label: "Phone", value: "+966 59 456 6660", icon: "📞" },
              { label: "Location", value: "Jeddah, Saudi Arabia · RSAF / ANPC", icon: "📍" },
            ].map(c => (
              <div key={c.label} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", marginBottom: 6,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{c.icon}</span>
                <div>
                  <div style={{ fontSize: 9, fontFamily: "Inter", color: "var(--text-muted)", marginBottom: 2 }}>{c.label.toUpperCase()}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "Inter" }}>{c.value}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function About() {
  const { copied, copy } = useCopy();
  const email = "alahmari60@yahoo.com";
  const phone = "+966 59 456 6660";
  const whatsapp = "https://wa.me/966594566660";
  const [showCV, setShowCV] = useState(false);
  const [statsStarted, setStatsStarted] = useState(false);
  const [skillsVisible, setSkillsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const skillsRef = useRef<HTMLDivElement>(null);

  // Trigger counter animation when stats section enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.target === statsRef.current && e.isIntersecting) setStatsStarted(true);
          if (e.target === skillsRef.current && e.isIntersecting) setSkillsVisible(true);
        });
      },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    if (skillsRef.current) observer.observe(skillsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="page" style={{ background: "var(--bg-primary)", paddingBottom: 90 }}>

      {/* ══════════════════════════════════════════════════════
          HERO HEADER — Profile Photo + Name + Title
         ══════════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden radar-grid"
        style={{
          background: "linear-gradient(175deg, #04091a 0%, #050c18 100%)",
          paddingBottom: 24,
        }}
      >
        <div className="scan-line" />

        {/* Radial glow */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          width: 340, height: 340,
          background: "radial-gradient(circle, rgba(0,174,239,0.09) 0%, transparent 65%)",
          pointerEvents: "none",
        }} />

        {/* Corner brackets */}
        {[["top:12px;left:12px", "borderTop,borderLeft"], ["top:12px;right:12px", "borderTop,borderRight"],
          ["bottom:12px;left:12px", "borderBottom,borderLeft"], ["bottom:12px;right:12px", "borderBottom,borderRight"]
        ].map(([pos], pi) => {
          const positions = pos.split(";").reduce((acc, p) => {
            const [k, v] = p.split(":");
            return { ...acc, [k]: v };
          }, {} as Record<string, string>);
          const borders: Record<string, string> = {};
          [["borderTop", "borderLeft"], ["borderTop", "borderRight"], ["borderBottom", "borderLeft"], ["borderBottom", "borderRight"]][pi]
            .forEach(b => { borders[b] = "2px solid rgba(0,174,239,0.4)"; });
          return (
            <div key={pi} style={{ position: "absolute", width: 16, height: 16, ...positions, ...borders }} />
          );
        })}

        <div className="relative flex flex-col items-center pt-8 px-4" style={{ gap: 0 }}>
          {/* Rank label */}
          <div className="font-orbitron" style={{
            fontSize: 8, letterSpacing: "0.35em", color: "rgba(0,174,239,0.6)",
            marginBottom: 14, textAlign: "center",
          }}>
            RSAF · GROUND RADAR UNIT
          </div>

          {/* Photo + animated border */}
          <div style={{ position: "relative", width: 110, height: 110, marginBottom: 16 }}>
            {/* Outer pulsing glow halo */}
            <div style={{
              position: "absolute", inset: -10,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(0,174,239,0.18) 0%, transparent 70%)",
              animation: "pulse-glow 2.5s ease-in-out infinite",
              pointerEvents: "none",
            }} />
            {/* Outer rotating gradient ring (thick) */}
            <div style={{
              position: "absolute", inset: -5,
              borderRadius: "50%",
              background: "conic-gradient(from 0deg, #00AEEF 0%, #35D4FF 30%, #00D26A 55%, #FFD166 75%, #00AEEF 100%)",
              animation: "rotate-slow 5s linear infinite",
            }} />
            {/* Gap ring */}
            <div style={{
              position: "absolute", inset: -2, borderRadius: "50%",
              background: "var(--bg-primary)",
            }} />
            {/* Inner counter-rotating accent ring */}
            <div style={{
              position: "absolute", inset: 1,
              borderRadius: "50%",
              background: "conic-gradient(from 180deg, transparent 0%, rgba(53,212,255,0.5) 30%, transparent 60%)",
              animation: "rotate-slow 8s linear infinite reverse",
              pointerEvents: "none",
            }} />
            {/* Photo container */}
            <div style={{
              position: "absolute", inset: 3, borderRadius: "50%",
              border: "1.5px solid rgba(0,174,239,0.5)",
              boxShadow: "0 0 20px rgba(0,174,239,0.4), 0 0 40px rgba(0,174,239,0.15), inset 0 0 12px rgba(0,174,239,0.08)",
              overflow: "hidden",
            }}>
              <ProfilePhoto size={104} />
            </div>
          </div>

          {/* Name */}
          <div className="font-orbitron" style={{
            fontSize: 18, fontWeight: 700, color: "var(--text-primary)",
            textAlign: "center", letterSpacing: "0.04em",
          }}>
            Ayidh A. Alahmari
          </div>

          {/* Job title */}
          <div style={{
            fontSize: 12, color: "var(--accent-cyan)", marginTop: 4,
            fontFamily: "Inter", letterSpacing: "0.08em", textAlign: "center",
          }}>
            Radar Systems Operation & Maintenance Technician
          </div>

          {/* Location + status row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "Inter" }}>📍 Jeddah, Saudi Arabia</span>
            <span style={{ color: "rgba(0,174,239,0.3)" }}>·</span>
            <OnlineStatus />
          </div>

          {/* Contact row */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <a href={`mailto:${email}`} style={{ textDecoration: "none" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 10, fontFamily: "Inter", letterSpacing: "0.04em",
                background: "rgba(0,174,239,0.1)", border: "1px solid rgba(0,174,239,0.3)",
                color: "var(--accent-cyan)", padding: "5px 12px", borderRadius: 20,
              }}>
                ✉️ {email}
              </span>
            </a>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 10, fontFamily: "Inter", letterSpacing: "0.04em",
                background: "rgba(0,210,106,0.1)", border: "1px solid rgba(0,210,106,0.3)",
                color: "#00D26A", padding: "5px 12px", borderRadius: 20,
              }}>
                📞 {phone}
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          PAGE CONTENT
         ══════════════════════════════════════════════════════ */}
      <div style={{ padding: "0 14px" }}>

        {/* ── Quick stats row (animated counter) ── */}
        <div
          ref={statsRef}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8, marginTop: 16 }}
        >
          <StatCard label="SYSTEMS" target={4}  sub="Radar platforms"  started={statsStarted} />
          <StatCard label="ACTIVE"  target={3}  sub="Current systems"  started={statsStarted} />
          <StatCard label="YEARS"   target={24} sub="Field experience" started={statsStarted} />
          <StatCard label="CERTS"   target={5}  sub="Qualifications"   started={statsStarted} />
        </div>

        {/* ══════════════════════════════════════════════════════
            PROFESSIONAL PROFILE
           ══════════════════════════════════════════════════════ */}
        <div className="glass-card" style={{ marginTop: 20, padding: "18px 16px" }}>
          <SectionHeader label="PROFESSIONAL PROFILE" icon="👤" />
          <p style={{
            fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.75,
            margin: 0, fontFamily: "Inter",
          }}>
            Highly skilled Radar Systems Technician with hands-on experience in{" "}
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>operation, maintenance, troubleshooting, and training</span>{" "}
            of ground-based radar systems and Transponder Landing Systems (TLS) in operational aviation environments.
            Experienced in high-stakes defense and aviation environments with strong technical reporting,
            fault diagnosis, and field maintenance skills.
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════
            RADAR SYSTEMS EXPERIENCE
           ══════════════════════════════════════════════════════ */}
        <div style={{ marginTop: 24 }}>
          <SectionHeader label="RADAR SYSTEMS EXPERIENCE" icon="📡" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {EXPERIENCE.map((exp, i) => (
              <ExperienceCard key={exp.id} exp={exp} index={i} />
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            CERTIFICATIONS & TRAINING
           ══════════════════════════════════════════════════════ */}
        <div style={{ marginTop: 28 }}>
          <SectionHeader label="CERTIFICATIONS & TRAINING" icon="🏆" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {CERTIFICATIONS.map((cert, i) => (
              <CertCard key={cert.id} cert={cert} index={i} />
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            TECHNICAL SKILLS
           ══════════════════════════════════════════════════════ */}
        <div ref={skillsRef} style={{ marginTop: 28 }}>
          <SectionHeader label="TECHNICAL SKILLS" icon="⚙️" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SKILL_GROUPS_WITH_PCT.map((group, gi) => {
              const rgb = hexToRgb(group.color);
              return (
                <div key={group.label} style={{
                  background: `rgba(${rgb},0.05)`,
                  border: `1px solid rgba(${rgb},0.22)`,
                  borderRadius: 12, padding: "14px 14px",
                  animation: `fadeIn 0.4s ease ${gi * 0.08}s both`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: 14 }}>{group.icon}</span>
                    <div className="font-orbitron" style={{ fontSize: 9, color: group.color, letterSpacing: "0.1em" }}>
                      {group.label}
                    </div>
                  </div>
                  {group.skills.map((skill, si) => (
                    <SkillBar
                      key={skill.name}
                      name={skill.name}
                      pct={skill.pct}
                      color={group.color}
                      delay={gi * 80 + si * 60}
                      animate={skillsVisible}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            LANGUAGES
           ══════════════════════════════════════════════════════ */}
        <div style={{ marginTop: 28 }}>
          <SectionHeader label="LANGUAGES" icon="🌐" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            {[
              { lang: "Arabic", level: "Native", pct: 100, color: "#00D26A", flag: "🇸🇦" },
              { lang: "English", level: "Professional Working", pct: 75, color: "#00AEEF", flag: "🇺🇸" },
            ].map(l => (
              <div key={l.lang} style={{
                background: "rgba(8,15,28,0.9)",
                border: `1px solid rgba(${hexToRgb(l.color)},0.2)`,
                borderRadius: 12, padding: "14px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{l.flag}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: l.color, fontFamily: "Inter" }}>{l.lang}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter" }}>{l.level}</div>
                  </div>
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${l.pct}%`,
                    background: l.color,
                    boxShadow: `0 0 6px ${l.color}`,
                    borderRadius: 2,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            ABOUT TLS TRAINER
           ══════════════════════════════════════════════════════ */}
        <div className="glass-card" style={{ marginTop: 28, padding: "18px 16px" }}>
          <SectionHeader label="ABOUT TLS TRAINER" icon="🛰️" />
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, fontFamily: "Inter" }}>
            <strong style={{ color: "var(--text-primary)" }}>TLS Trainer</strong> is a professional self-study platform
            built for RSAF Ground Radar Technicians. Covers all 9 official TLS training modules with interactive
            content, quizzes, and reference PDFs. Built to military-grade standards for offline deployment in the field.
          </p>
          <div className="tac-divider" style={{ margin: "14px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="font-orbitron" style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: "0.15em" }}>
              TLS TRAINER · v1.0.0
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter" }}>RSAF · ANPC · Jeddah</div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            ACTIONS — VIEW CV / WHATSAPP / etc.
           ══════════════════════════════════════════════════════ */}
        {showCV && <CVModal onClose={() => setShowCV(false)} />}
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8 }}>
            <button
              onClick={() => setShowCV(true)}
              className="tac-btn tac-btn-primary"
              style={{ width: "100%", flexDirection: "column", gap: 4, padding: "10px 4px", borderRadius: 10 }}
            >
              <span style={{ fontSize: 16 }}>🪪</span>
              <span style={{ fontSize: 8, letterSpacing: "0.1em" }}>VIEW ADMIN CV</span>
            </button>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <button style={{
                width: "100%", flexDirection: "column", gap: 4, padding: "10px 4px", borderRadius: 10,
                background: "rgba(0,210,106,0.1)", border: "1px solid rgba(0,210,106,0.35)", color: "#00D26A",
                fontSize: 8, fontFamily: "Inter", letterSpacing: "0.1em", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 16 }}>💬</span>
                <span style={{ fontSize: 8, letterSpacing: "0.1em" }}>WHATSAPP</span>
              </button>
            </a>
            <button
              onClick={() => copy(email)}
              style={{
                width: "100%", flexDirection: "column", gap: 4, padding: "10px 4px", borderRadius: 10,
                background: copied ? "rgba(0,210,106,0.15)" : "rgba(53,212,255,0.08)",
                border: `1px solid ${copied ? "rgba(0,210,106,0.5)" : "rgba(53,212,255,0.3)"}`,
                color: copied ? "#00D26A" : "var(--accent-cyan)",
                fontSize: 8, fontFamily: "Inter", letterSpacing: "0.1em", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.3s",
              }}
            >
              <span style={{ fontSize: 16 }}>{copied ? "✓" : "📧"}</span>
              <span style={{ fontSize: 8, letterSpacing: "0.1em" }}>{copied ? "COPIED!" : "COPY EMAIL"}</span>
            </button>
          </div>
        </div>

        {/* Bottom signature */}
        <div style={{ marginTop: 28, textAlign: "center", paddingBottom: 8 }}>
          <div className="font-orbitron" style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: "0.3em" }}>
            BUILT WITH PRECISION · RSAF GROUND RADAR
          </div>
          <div style={{
            marginTop: 8, height: 1,
            background: "linear-gradient(90deg, transparent, rgba(0,174,239,0.3), transparent)",
          }} />
        </div>

      </div>
    </div>
  );
}
