import { useState, useEffect, useRef } from "react";
import BackButton from "../components/BackButton";
import { getSession } from "../hooks/useTelegramTrack";

type Component = {
  id: string;
  name: string;
  fullName: string;
  image: string;
  color: string;
  shortDesc: string;
  definition: string;
  function: string;
  relation: string;
  facts: string[];
};

const COMPONENTS: Component[] = [
  {
    id: "ASA",
    name: "ASA",
    fullName: "Azimuth Sensor Assembly",
    image: "/components/asa.webp",
    color: "#00AEEF",
    shortDesc: "Detects aircraft horizontal position and provides lateral guidance data.",
    definition: "The ASA is a ground-based antenna assembly consisting of three sensor elements (ASA HIGH, ASA LOW, ASA REF) mounted on a horizontal beam with a Base Electronics Unit.",
    function: "Detects the aircraft's horizontal (azimuth) position by measuring the angle of arrival of transponder signals. Provides lateral guidance data to compute whether the aircraft is left or right of the runway centerline.",
    relation: "Works in conjunction with the ATA for azimuth tracking. The ASA data feeds into the GTU to generate ILS-equivalent Localizer guidance signals.",
    facts: [
      "Three sensor elements: ASA HIGH, ASA LOW, ASA REF",
      "Measures lateral (azimuth) deviation",
      "Works with ATA for precise azimuth tracking",
      "High accuracy & reliable operation",
      "Mounted on adjustable leveling system",
    ],
  },
  {
    id: "ESA",
    name: "ESA",
    fullName: "Elevation Sensor Assembly",
    image: "/components/esa.webp",
    color: "#35D4FF",
    shortDesc: "Measures aircraft vertical position to determine above or below glide path.",
    definition: "The ESA is a tall antenna tower assembly with four elevation elements (ESA HIGH, ESA MED, ESA LOW, ESA REF) and a Base Electronics Unit. It measures the vertical angle of aircraft transponder signals.",
    function: "Measures the aircraft's vertical (elevation) position to determine whether it is above or below the glide path. Provides accurate elevation data for safe approach, feeding into the Glide Slope guidance computation.",
    relation: "ESA data is processed by the GTU to generate ILS-equivalent Glide Slope signals. Works with the ILS system for precise vertical guidance during approach and landing.",
    facts: [
      "Four elevation elements: HIGH, MED, LOW, REF",
      "Measures vertical deviation from glide path",
      "Integrated with ILS system",
      "Provides reliable & stable performance",
      "Glide path monitoring capability",
    ],
  },
  {
    id: "ATA",
    name: "ATA",
    fullName: "Azimuth Tracking Antenna",
    image: "/components/ata.webp",
    color: "#00AEEF",
    shortDesc: "Provides azimuth tracking for aircraft approach alignment.",
    definition: "The ATA is a single antenna unit mounted on a tripod base with a status beacon light on top. It supports azimuth tracking and provides additional reference data for aircraft alignment during approach.",
    function: "Supports azimuth tracking by providing additional angle-of-arrival measurements. Works alongside the ASA to improve lateral guidance accuracy and aircraft alignment during approach.",
    relation: "Pairs with the ASA to enhance azimuth tracking precision. The combined ASA+ATA data provides higher accuracy lateral position measurements fed to the GTU.",
    facts: [
      "Single antenna with status beacon",
      "Enhances ASA azimuth accuracy",
      "Tripod-mounted for field deployment",
      "Provides aircraft approach alignment",
      "Works in tandem with ASA",
    ],
  },
  {
    id: "CAL/BIT",
    name: "CAL/BIT",
    fullName: "Calibration / Built-In-Test",
    image: "/components/calbit.webp",
    color: "#FFD166",
    shortDesc: "Validates system accuracy through calibration and self-test functions.",
    definition: "The CAL/BIT unit is a calibration antenna assembly with a Test Interface Unit, Status Indicator light, and secure anchoring system. It validates TLS system accuracy through automated self-tests.",
    function: "Verifies system accuracy through self-tests, checks signal performance and stability, detects and reports system anomalies, and ensures reliable operation and compliance with operational standards.",
    relation: "Essential for maintaining TLS system integrity. Provides reference signals used by the GTU and other components to validate their operational accuracy before and during use.",
    facts: [
      "Automatic self-test diagnostics",
      "Signal performance verification",
      "Calibration antenna reference signal",
      "Status indicator for visual feedback",
      "Ensures reliable and compliant operation",
    ],
  },
  {
    id: "INTERROGATOR",
    name: "Interrogator",
    fullName: "Interrogator Unit",
    image: "/components/interrogator.webp",
    color: "#35D4FF",
    shortDesc: "Transmits and receives radar interrogation signals for aircraft tracking.",
    definition: "The Interrogator is a dual-antenna unit mounted on a tripod base. It transmits Mode S interrogation signals on 1030 MHz and receives transponder replies on 1090 MHz from approaching aircraft.",
    function: "Transmits radar interrogation signals to aircraft transponders and receives Mode S replies. Provides the primary means of detecting and identifying aircraft during the TLS approach sequence.",
    relation: "Central to TLS operation — the Interrogator initiates the sequence by interrogating aircraft transponders. Its received data feeds into the RCU for tracking and the ASA/ESA for guidance computation.",
    facts: [
      "Transmits on 1030 MHz, receives on 1090 MHz",
      "Mode S interrogation capability",
      "Dual antenna configuration",
      "Provides aircraft ID and position",
      "Primary tracking component of TLS",
    ],
  },
  {
    id: "RCU",
    name: "RCU",
    fullName: "Remote Control Unit",
    image: "/components/rcu.webp",
    color: "#00D26A",
    shortDesc: "Main operator interface for TLS monitoring, aircraft tracking, and system control.",
    definition: "The RCU is a computer workstation with dual display setup — a PAR-style radar display for aircraft tracking and a control panel for system management. It is the primary operator interface for the TLS system.",
    function: "Displays and tracks aircraft using TLS surveillance data, allows system configuration and control, monitors system health and integrity, enables surveillance track display, and continuously checks system integrity for safe operation.",
    relation: "The RCU is the command center of the TLS. It receives data from all sensors (ASA, ESA, ATA, Interrogator), processes it, and provides the operator with full system visibility and control.",
    facts: [
      "PAR-style radar display",
      "Dual monitor configuration",
      "Aircraft tracking at 3.7 Hz update rate",
      "Altitude limit: up to 10,000 ft",
      "Supports TLS 3.0 approach mode",
    ],
  },
  {
    id: "GTU",
    name: "GTU",
    fullName: "Guidance Transmitter Unit",
    image: "/components/gtu.webp",
    color: "#C9A66B",
    shortDesc: "Generates and transmits ILS guidance signals for Localizer and Glide Slope.",
    definition: "The GTU is a rack-mounted electronics unit containing multiple transmitter cards (GTU 1-4), CPU modules, Monitor/Keyboard, MIU, UPS, and batteries. It generates the ILS-format guidance signals broadcast to approaching aircraft.",
    function: "Generates ILS guidance signals, provides Localizer (horizontal) guidance, provides Glide Slope (vertical) guidance, and ensures stable, accurate, and reliable transmission to aircraft cockpit displays.",
    relation: "The GTU is the output stage of the TLS. It takes position data computed from ASA, ESA, and ATA measurements and converts them into ILS-equivalent Localizer and Glide Slope signals.",
    facts: [
      "Four GTU transmitter cards (GTU 1-4)",
      "Dual CPU processing units",
      "Built-in UPS and battery backup",
      "Generates LOC and GS signals",
      "MIU for maintenance interface",
    ],
  },
  {
    id: "GS",
    name: "GS",
    fullName: "Glide Slope",
    image: "/components/gs.webp",
    color: "#00D26A",
    shortDesc: "Provides vertical guidance to the aircraft during landing approach.",
    definition: "The GS (Glide Slope) is part of the TLS shelter installation, integrated with the main container and tower. It transmits vertical guidance signals that replicate ILS Glide Slope functionality.",
    function: "Provides precise vertical guidance during the approach phase, ensures accurate glide path information, and works as part of the integrated TLS system for safe and efficient landings.",
    relation: "The GS works in conjunction with the LOC to provide complete ILS-equivalent guidance. ESA measurements are processed by the GTU to generate the GS signal transmitted to aircraft.",
    facts: [
      "Provides vertical approach guidance",
      "Replicates ILS Glide Slope signal",
      "High reliability in all conditions",
      "Integrated with TLS container system",
      "Works with LOC for complete ILS coverage",
    ],
  },
  {
    id: "LOC",
    name: "LOC",
    fullName: "Localizer",
    image: "/components/loc.webp",
    color: "#00AEEF",
    shortDesc: "Provides horizontal guidance and aligns aircraft with the runway centerline.",
    definition: "The LOC (Localizer) is part of the TLS shelter installation, integrated with the main container and tower. It transmits lateral guidance signals that replicate ILS Localizer functionality to inbound aircraft.",
    function: "Provides horizontal guidance to align the aircraft with the runway centerline, ensures accurate lateral course information, and works with the ILS system for safe and efficient landings.",
    relation: "The LOC works alongside the GS to provide complete precision approach guidance. ASA and ATA measurements are processed by the GTU to generate the LOC signal. Works with the ILS system for integrated approach.",
    facts: [
      "Provides horizontal runway alignment",
      "Replicates ILS Localizer signal",
      "Accurate lateral course guidance",
      "Integrated with TLS container system",
      "Works with GS for complete ILS coverage",
    ],
  },
];

const specs = [
  { label: "Frequency",      value: "1030 / 1090 MHz" },
  { label: "Range",          value: "Up to 40 NM" },
  { label: "Accuracy",       value: "±7.5m Lateral / ±0.75m Vertical" },
  { label: "Update Rate",    value: "Every 1 second" },
  { label: "ICAO Category",  value: "CAT I / II / III" },
  { label: "Operating Temp", value: "-20°C to +55°C" },
  { label: "Power Supply",   value: "115/230V AC, 50/60 Hz" },
];

/* ── Detail view ── */
function ComponentDetail({ comp, onBack }: { comp: Component; onBack: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);

  // Time tracking
  const openTimeRef = useRef<number>(Date.now());
  useEffect(() => {
    openTimeRef.current = Date.now();
    const onVisibility = () => {
      if (document.hidden) postTime();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      postTime();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp.id]);

  const postTime = () => {
    const durationMs = Date.now() - openTimeRef.current;
    if (durationMs < 3000) return;
    const traineeId = getSession()?.id;
    if (!traineeId) return;
    fetch('/api/trainee/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-trainee-id': traineeId },
      body: JSON.stringify({ traineeId, moduleId: comp.id, moduleName: comp.name, durationMs }),
    }).catch(() => {});
    openTimeRef.current = Date.now(); // reset so re-show doesn't double-count
  };

  return (
    <div className="page" style={{
      background: "var(--bg-primary)",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateX(0)" : "translateX(20px)",
      transition: "opacity 0.3s ease, transform 0.3s ease",
    }}>

      {/* ── FULL-BLEED HERO IMAGE — no back button, no overlays, edge to edge ── */}
      <div style={{
        // Break out of any parent padding to reach true viewport edges
        width: "100vw",
        marginLeft: "calc(50% - 50vw)",
        marginRight: "calc(50% - 50vw)",
        position: "relative",
        background: "linear-gradient(180deg, #050d1a 0%, #020608 100%)",
        lineHeight: 0,
        // Push image up to sit right under the fixed nav (52px)
        marginTop: 0,
      }}>
        {/* Colour glow behind image */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at 50% 40%, ${comp.color}18 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
        <img
          src={comp.image}
          alt={comp.name}
          draggable={false}
          loading="lazy"
          decoding="async"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            position: "relative",
            zIndex: 1,
          }}
        />
        {/* Bottom fade */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: 60,
          background: "linear-gradient(to top, var(--bg-primary) 0%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 2,
        }} />
      </div>

      {/* ── Title + BACK ── */}
      <div style={{ padding: "14px 16px 0" }}>
        {/* BACK link below image */}
        <button
          onClick={onBack}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "none", border: "none", padding: "0 0 10px 0",
            color: comp.color, fontFamily: "Orbitron", fontSize: 9,
            letterSpacing: "0.12em", cursor: "pointer",
            WebkitTapHighlightColor: "rgba(0,0,0,0)",
            opacity: 0.75,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          ALL COMPONENTS
        </button>
        <div className="font-orbitron" style={{
          fontSize: 26, fontWeight: 700, color: "#fff",
          textShadow: `0 0 20px ${comp.color}60`,
        }}>
          {comp.name}
        </div>
        <div style={{ fontSize: 13, color: comp.color, marginTop: 3, marginBottom: 14 }}>
          {comp.fullName}
        </div>
      </div>

      <div style={{ padding: "0 16px 48px" }}>

        {/* Short desc */}
        <div style={{
          padding: "12px 16px", borderRadius: 10,
          background: `linear-gradient(90deg, ${comp.color}15, ${comp.color}06)`,
          border: `1px solid ${comp.color}30`,
          marginBottom: 16,
        }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {comp.shortDesc}
          </p>
        </div>

        {/* Sections */}
        {[
          { title: "DEFINITION", content: comp.definition },
          { title: "FUNCTION", content: comp.function },
          { title: "RELATION TO TLS OPERATION", content: comp.relation },
        ].map((s, i) => (
          <div key={s.title} className="glass-card" style={{
            padding: "16px 18px", marginBottom: 12,
            border: `1px solid ${comp.color}20`,
            animationDelay: `${i * 0.08}s`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: comp.color, boxShadow: `0 0 8px ${comp.color}` }} />
              <div className="font-orbitron" style={{ fontSize: 9, letterSpacing: "0.2em", color: comp.color }}>
                {s.title}
              </div>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.75, margin: 0 }}>
              {s.content}
            </p>
          </div>
        ))}

        {/* Quick Facts */}
        <div className="glass-card" style={{ padding: "16px 18px", marginBottom: 20, border: `1px solid ${comp.color}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: comp.color, boxShadow: `0 0 8px ${comp.color}` }} />
            <div className="font-orbitron" style={{ fontSize: 9, letterSpacing: "0.2em", color: comp.color }}>QUICK FACTS</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {comp.facts.map((fact, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  background: `${comp.color}15`, border: `1px solid ${comp.color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: comp.color, boxShadow: `0 0 6px ${comp.color}` }} />
                </div>
                <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{fact}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Back to all components */}
        <button
          onClick={onBack}
          style={{
            width: "100%", padding: "14px",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, cursor: "pointer",
            color: "var(--text-muted)", fontFamily: "Orbitron", fontSize: 11,
            letterSpacing: "0.1em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          ALL COMPONENTS
        </button>
      </div>
    </div>
  );
}

/* ── Component card — horizontal: thumb LEFT, text RIGHT ── */
function CompCard({ comp, index, onClick }: { comp: Component; index: number; onClick: () => void }) {
  const [pressed, setPressed] = useState(false);

  return (
    <div
      className="fade-in"
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        cursor: "pointer",
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${pressed ? comp.color + "55" : comp.color + "22"}`,
        background: pressed ? "rgba(8,15,28,0.98)" : "rgba(8,15,28,0.88)",
        transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
        boxShadow: pressed ? `0 0 16px ${comp.color}25` : "0 2px 8px rgba(0,0,0,0.25)",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        animationDelay: `${index * 0.05}s`,
        WebkitTapHighlightColor: "rgba(0,0,0,0)",
        minHeight: 88,
      }}
    >
      {/* LEFT — square thumbnail */}
      <div style={{
        width: 88,
        flexShrink: 0,
        position: "relative",
        background: `linear-gradient(135deg, ${comp.color}18, rgba(0,0,0,0.6))`,
        overflow: "hidden",
      }}>
        <img
          src={comp.image}
          alt={comp.name}
          draggable={false}
          decoding="async"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            display: "block",
            opacity: 0.92,
          }}
        />
        {/* colour tint strip on left edge */}
        <div style={{
          position: "absolute", top: 0, left: 0, bottom: 0, width: 3,
          background: comp.color,
          boxShadow: `0 0 8px ${comp.color}`,
        }} />
      </div>

      {/* RIGHT — text */}
      <div style={{
        flex: 1,
        padding: "10px 12px 10px 14px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 4,
        minWidth: 0,
      }}>
        {/* Name */}
        <div className="font-orbitron" style={{
          fontSize: 13, fontWeight: 700,
          color: "#fff",
          letterSpacing: "0.04em",
          lineHeight: 1.2,
        }}>
          {comp.name}
        </div>
        {/* Full name */}
        <div style={{
          fontSize: 10, color: comp.color,
          fontFamily: "Orbitron", letterSpacing: "0.03em",
          lineHeight: 1.3,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {comp.fullName}
        </div>
        {/* Short desc */}
        <div style={{
          fontSize: 11, color: "var(--text-muted)",
          lineHeight: 1.5,
          marginTop: 2,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {comp.shortDesc}
        </div>
        {/* LEARN MORE */}
        <div style={{
          marginTop: 6,
          display: "inline-flex", alignItems: "center", gap: 5,
          color: comp.color, fontSize: 9,
          fontFamily: "Orbitron", letterSpacing: "0.12em",
        }}>
          LEARN MORE
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function Basics() {
  const [selected, setSelected] = useState<Component | null>(null);

  if (selected) {
    return <ComponentDetail comp={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="page" style={{ background: "var(--bg-primary)" }}>

      {/* ── Hero Header ── */}
      <div className="radar-grid" style={{
        background: "linear-gradient(180deg, #071426 0%, #050a12 100%)",
        padding: "28px 20px 24px",
        borderBottom: "1px solid rgba(0,174,239,0.15)",
        position: "relative", overflow: "hidden",
      }}>
        <div className="scan-line" />
        {/* Radial glow */}
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          width: 360, height: 200,
          background: "radial-gradient(ellipse, rgba(0,174,239,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        {/* Corner brackets */}
        {[{top:14,left:16},{top:14,right:16},{bottom:14,left:16},{bottom:14,right:16}].map((pos,i) => (
          <div key={i} style={{
            position:"absolute",...pos,width:14,height:14,
            borderTop:i<2?"2px solid rgba(0,174,239,0.5)":undefined,
            borderBottom:i>=2?"2px solid rgba(0,174,239,0.5)":undefined,
            borderLeft:(i===0||i===2)?"2px solid rgba(0,174,239,0.5)":undefined,
            borderRight:(i===1||i===3)?"2px solid rgba(0,174,239,0.5)":undefined,
          }}/>
        ))}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ marginBottom: 12 }}>
            <BackButton to="/" />
          </div>
          <div className="font-orbitron" style={{ fontSize: 9, letterSpacing: "0.3em", color: "#00AEEF", marginBottom: 8, opacity: 0.7 }}>
            REFERENCE MATERIAL
          </div>
          <div className="font-orbitron text-glow" style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
            TLS BASICS
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Transponder Landing System — Core Concepts
          </div>
          {/* Component count */}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(0,174,239,0.1)", border: "1px solid rgba(0,174,239,0.25)",
              borderRadius: 20, padding: "4px 12px",
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#00AEEF", boxShadow: "0 0 6px #00AEEF" }} />
              <span className="font-orbitron" style={{ fontSize: 9, color: "#00AEEF", letterSpacing: "0.1em" }}>
                9 COMPONENTS
              </span>
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(0,210,106,0.1)", border: "1px solid rgba(0,210,106,0.25)",
              borderRadius: 20, padding: "4px 12px",
            }}>
              <div className="online-dot" />
              <span className="font-orbitron" style={{ fontSize: 9, color: "#00D26A", letterSpacing: "0.1em" }}>
                ACTIVE
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 16px 48px" }}>

        {/* What is TLS */}
        <div className="glass-card glow-blue fade-in" style={{ marginTop: 20, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: "#00AEEF", boxShadow: "0 0 8px #00AEEF" }} />
            <div className="font-orbitron" style={{ fontSize: 9, letterSpacing: "0.2em", color: "#00AEEF" }}>WHAT IS TLS?</div>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.75, margin: 0 }}>
            The <strong style={{ color: "#00AEEF" }}>Transponder Landing System (TLS)</strong> is a precision approach aid
            that uses existing aircraft Mode S transponders to provide ILS-equivalent lateral and vertical guidance —
            without requiring special aircraft equipment or a conventional ILS installation.
          </p>
        </div>

        {/* Key Specs */}
        <div style={{ marginTop: 20 }}>
          <div className="font-orbitron" style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-muted)", marginBottom: 12 }}>
            KEY SPECIFICATIONS
          </div>
          <div className="glass-card" style={{ padding: "4px 0", border: "1px solid rgba(0,174,239,0.18)" }}>
            {specs.map((s, i) => (
              <div key={s.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "11px 18px",
                borderBottom: i < specs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{s.label}</span>
                <span className="font-orbitron" style={{ fontSize: 11, fontWeight: 600, color: "#00AEEF" }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Components Grid */}
        <div style={{ marginTop: 24 }}>
          <div className="font-orbitron" style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--text-muted)", marginBottom: 14 }}>
            SYSTEM COMPONENTS — SELECT TO EXPLORE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {COMPONENTS.map((comp, i) => (
              <CompCard
                key={comp.id}
                comp={comp}
                index={i}
                onClick={() => setSelected(comp)}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
