/**
 * TLS Animation — Figure 4-1 TLS Operation Cycle
 * 6-step animated SVG/CSS visualization matching the official TLS Installation Manual
 * Components drawn to match: Shelter (Fig 2-5), ASA (Fig 2-6), ESA (Fig 2-7),
 * Interrogator (Fig 2-10), Cal/BIT (Fig 2-11), ATA (Fig 2-12)
 * Layout matches IMG_4200 — runway horizontal on top, components below
 */
import { useState, useEffect, useRef, useCallback } from "react";
import BackButton from "../components/BackButton";

// ── Palette ───────────────────────────────────────────────────────────────────
const BG      = "#030b18";
const SURFACE = "#040d1c";
const TEAL    = "#4dd0c8";
const GOLD    = "#FFD700";
const DIM     = "rgba(100,180,180,.25)";
const ACTIVE_GLOW = "drop-shadow(0 0 12px rgba(77,208,200,.8))";

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  {
    n: 1, phase: "SURVEILLANCE", color: "#00E676",
    label: "INTERROGATION", freq: "1030 MHz",
    en: "System interrogates all transponders within the service volume with alternating Mode A and Mode C request.",
    ar: "يرسل النظام إشارة استجواب بتردد 1030 MHz لجميع الطائرات داخل نطاق الخدمة.",
    active: ["INTERROGATOR"],  // which component glows
  },
  {
    n: 2, phase: "SURVEILLANCE", color: "#FF9500",
    label: "TRANSPONDER REPLY", freq: "1090 MHz",
    en: "Aircraft transponder responds to the interrogation signal.",
    ar: "يرد جهاز الإرسال (Transponder) في الطائرة على إشارة الاستجواب بتردد 1090 MHz.",
    active: ["ASA", "ATA"],
  },
  {
    n: 3, phase: "SURVEILLANCE", color: "#00C8FF",
    label: "POSITION FIX", freq: "MLAT x,y,z",
    en: "System sensors measure the reply signal and determine aircraft position (x, y, z).",
    ar: "تقيس حساسات النظام (ASA + ESA) إشارة الرد وتحدد موضع الطائرة ثلاثياً.",
    active: ["ASA", "ESA", "ATA", "SHELTER"],
  },
  {
    n: 4, phase: "GUIDANCE", color: "#FFD700",
    label: "DISPLACEMENT CALC", freq: "Δ PATH",
    en: "The system determines the displacement from the desired approach (programmed into the system).",
    ar: "يحدد النظام انحراف الطائرة عن مسار الاقتراب المبرمج مسبقاً.",
    active: ["SHELTER"],
  },
  {
    n: 5, phase: "GUIDANCE", color: "#FF6B35",
    label: "COURSE ADJUSTMENT", freq: "RCU",
    en: "The system calculates the required course adjustments.",
    ar: "يحسب النظام التعديلات اللازمة على مسار الطيران.",
    active: ["SHELTER"],
  },
  {
    n: 6, phase: "GUIDANCE", color: "#00AEEF",
    label: "GUIDANCE SIGNAL", freq: "ILS / GCA",
    en: "Course correction information is sent to the aircraft either by verbal instruction (GCA) or transmitted signals (ILS).",
    ar: "تُرسل معلومات تصحيح المسار للطائرة إما بتعليمات صوتية (GCA) أو إشارات ILS.",
    active: ["SHELTER"],
  },
] as const;

const STEP_DUR = 7000;
const VW = 900;
const VH = 420;

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@keyframes tls-fadein { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
@keyframes tls-prog   { from{width:0%} to{width:100%} }
@keyframes tls-blink  { 0%,100%{opacity:1} 50%{opacity:.25} }
@keyframes glow-pulse { 0%,100%{filter:${ACTIVE_GLOW}} 50%{filter:drop-shadow(0 0 20px rgba(77,208,200,1))} }

/* Expanding rings */
@keyframes ring-expand {
  0%   { r: 6;  opacity: .9; stroke-width: 2.5; }
  100% { r: 90; opacity: 0;  stroke-width: .6; }
}
.ring { animation: ring-expand 2s ease-out infinite; }
.ring:nth-child(2) { animation-delay: .5s; }
.ring:nth-child(3) { animation-delay: 1s; }
.ring:nth-child(4) { animation-delay: 1.5s; }

/* Moving dots — outward (Step 1: Interrogator → Aircraft) */
@keyframes dot-out {
  0%   { offset-distance: 0%;   opacity: 0; }
  5%   { opacity: 1; }
  90%  { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}
.dot-out {
  offset-path: path('M 310 230 Q 550 150 790 80');
  animation: dot-out 2s linear infinite;
}
.dot-out:nth-child(2) { animation-delay: .65s; }
.dot-out:nth-child(3) { animation-delay: 1.3s; }

/* Moving dots — inward (Step 2: Aircraft → ASA/ATA) */
@keyframes dot-in {
  0%   { offset-distance: 0%;   opacity: 0; }
  5%   { opacity: 1; }
  90%  { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}
.dot-in {
  offset-path: path('M 790 80 Q 550 150 310 230');
  animation: dot-in 2s linear infinite;
}
.dot-in:nth-child(2) { animation-delay: .65s; }
.dot-in:nth-child(3) { animation-delay: 1.3s; }

/* Step 3 — lines draw */
@keyframes line-draw { from{stroke-dashoffset:600} to{stroke-dashoffset:0} }
.grid-line { stroke-dasharray:600; animation: line-draw 1.5s ease both; }

/* Crosshair pop */
@keyframes cross-pop { 0%{opacity:0;transform:scale(.3)} 60%{opacity:1;transform:scale(1.15)} 100%{transform:scale(1)} }
.cross-pop { animation: cross-pop .7s ease both; }

/* Step 4 — beam grow */
@keyframes beam-grow { from{opacity:0;transform:scaleX(.05)} to{opacity:.7;transform:scaleX(1)} }
.beam-grow { transform-origin: left center; animation: beam-grow 1.4s ease both; }

/* Step 4 — CDI needle */
@keyframes needle-swing { 0%{transform:rotate(-35deg)} 70%{transform:rotate(8deg)} 100%{transform:rotate(0deg)} }
.needle-swing { transform-origin: 50% 100%; animation: needle-swing 1.5s ease both; }

/* Step 5 — dots */
@keyframes dot-seq { 0%,100%{opacity:.2} 33%{opacity:1} }
.dot1 { animation: dot-seq 1.2s ease-in-out infinite; }
.dot2 { animation: dot-seq 1.2s ease-in-out infinite .4s; }
.dot3 { animation: dot-seq 1.2s ease-in-out infinite .8s; }
@keyframes rcu-blink { 0%,100%{opacity:.8} 50%{opacity:.3} }
.rcu-blink { animation: rcu-blink .9s ease-in-out infinite; }

/* Step 6 — guidance pulse */
@keyframes guid-pulse { 0%,100%{opacity:.4} 50%{opacity:.85} }
.guid-pulse { animation: guid-pulse 1.5s ease-in-out infinite; }
@keyframes ac-glide { from{transform:translate(0,14px)} to{transform:translate(0,0)} }
.ac-glide { animation: ac-glide 2s ease both; }
@keyframes sig-ripple { 0%{r:4;opacity:.9} 100%{r:22;opacity:0} }
.sig-ripple { animation: sig-ripple 1.3s ease-out infinite; }
.sig-ripple:nth-child(2){animation-delay:.43s}
.sig-ripple:nth-child(3){animation-delay:.86s}

.tls-fadein { animation: tls-fadein .45s ease both; }
.tls-blink  { animation: tls-blink 1.1s ease-in-out infinite; }
.comp-active { animation: glow-pulse 1.5s ease-in-out infinite; }
`;

// ══════════════════════════════════════════════════════════════════════════════
// SVG COMPONENT DRAWINGS — Detailed to match official figures
// ══════════════════════════════════════════════════════════════════════════════

/**
 * SHELTER with Uplink Tower (Figure 2-5)
 * - Shipping container (rectangular) with vertical corrugation lines
 * - Raised on 4 cylindrical legs
 * - Tall red/teal uplink tower on top
 * - Yagi antenna (multiple horizontal elements) on tower
 * - Equipment boxes on side
 */
function ShelterSVG({ x, y, active }: { x: number; y: number; active: boolean }) {
  const c = active ? TEAL : DIM;
  return (
    <g transform={`translate(${x},${y})`} className={active ? "comp-active" : ""}>
      {/* 4 cylindrical legs */}
      <rect x="-42" y="0" width="6" height="14" rx="3" fill={c} opacity=".7" />
      <rect x="-18" y="0" width="6" height="14" rx="3" fill={c} opacity=".7" />
      <rect x="12"  y="0" width="6" height="14" rx="3" fill={c} opacity=".7" />
      <rect x="36"  y="0" width="6" height="14" rx="3" fill={c} opacity=".7" />

      {/* Container body — corrugated */}
      <rect x="-46" y="-30" width="92" height="30" rx="2" fill="#0a1a1a" stroke={c} strokeWidth="1.2" />
      {/* Vertical corrugation lines */}
      {Array.from({ length: 11 }, (_, i) => (
        <line key={i} x1={-40 + i * 8} y1="-28" x2={-40 + i * 8} y2="-2"
          stroke={c} strokeWidth=".5" opacity=".4" />
      ))}
      {/* Door lines */}
      <rect x="-20" y="-26" width="16" height="24" rx="1" fill="none" stroke={c} strokeWidth=".8" opacity=".6" />
      <circle cx="-6" cy="-14" r="1.5" fill={c} opacity=".5" />

      {/* Equipment boxes on left side */}
      <rect x="-54" y="-22" width="8" height="16" rx="1" fill="#0a1a1a" stroke={c} strokeWidth=".8" />
      <rect x="-54" y="-8" width="8" height="4" rx="1" fill={c} opacity=".3" />

      {/* Uplink Tower — lattice structure */}
      {/* Two vertical rails */}
      <line x1="8" y1="-30" x2="8" y2="-110" stroke={c} strokeWidth="1.5" />
      <line x1="18" y1="-30" x2="18" y2="-110" stroke={c} strokeWidth="1.5" />
      {/* Cross bracing (X pattern) */}
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i}>
          <line x1="8" y1={-30 - i * 10} x2="18" y2={-40 - i * 10}
            stroke={c} strokeWidth=".7" opacity=".6" />
          <line x1="18" y1={-30 - i * 10} x2="8" y2={-40 - i * 10}
            stroke={c} strokeWidth=".7" opacity=".6" />
        </g>
      ))}
      {/* Horizontal rungs */}
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1="8" y1={-30 - i * 10} x2="18" y2={-30 - i * 10}
          stroke={c} strokeWidth=".8" opacity=".5" />
      ))}

      {/* Guy wire from tower top to container edge */}
      <line x1="8" y1="-100" x2="-40" y2="-30" stroke={c} strokeWidth=".6" strokeDasharray="3 2" opacity=".4" />

      {/* Yagi antenna on tower (multiple horizontal elements) */}
      <line x1="0" y1="-88" x2="28" y2="-88" stroke={c} strokeWidth="1.2" />
      {[-95, -91, -88, -85, -82].map((yy) => (
        <line key={yy} x1="4" y1={yy} x2="24" y2={yy} stroke={c} strokeWidth=".8" opacity=".7" />
      ))}
      {/* Yagi boom (horizontal backbone) */}
      <line x1="13" y1="-98" x2="13" y2="-78" stroke={c} strokeWidth="1" />

      {/* Top cap */}
      <circle cx="13" cy="-112" r="2.5" fill={c} opacity=".8" />

      {/* Label */}
      <text x="0" y="28" textAnchor="middle" fill={GOLD}
        fontSize="7" fontFamily="Courier New,monospace" fontWeight="700">SHELTER</text>
    </g>
  );
}

/**
 * ASA — Azimuth Sensor Assembly (Figure 2-6)
 * - Rectangular base plate on 4 legs
 * - Equipment box (grey)
 * - Long horizontal orange/teal boom arm
 * - Two vertical antenna poles (one taller, one shorter)
 * - Red ball on top of taller pole
 * - Tripod support structure
 */
function ASASVG({ x, y, active }: { x: number; y: number; active: boolean }) {
  const c = active ? TEAL : DIM;
  return (
    <g transform={`translate(${x},${y})`} className={active ? "comp-active" : ""}>
      {/* 4 legs */}
      <rect x="-24" y="0" width="4" height="10" rx="2" fill={c} opacity=".6" />
      <rect x="-8"  y="0" width="4" height="10" rx="2" fill={c} opacity=".6" />
      <rect x="8"   y="0" width="4" height="10" rx="2" fill={c} opacity=".6" />
      <rect x="20"  y="0" width="4" height="10" rx="2" fill={c} opacity=".6" />

      {/* Base plate */}
      <rect x="-28" y="-6" width="56" height="6" rx="1" fill="#1a2a2a" stroke={c} strokeWidth="1" />

      {/* Equipment box (left side) */}
      <rect x="-24" y="-22" width="18" height="16" rx="1.5" fill="#0a1a1a" stroke={c} strokeWidth=".9" />
      {/* Box detail lines */}
      <line x1="-22" y1="-18" x2="-8" y2="-18" stroke={c} strokeWidth=".4" opacity=".4" />
      <line x1="-22" y1="-14" x2="-8" y2="-14" stroke={c} strokeWidth=".4" opacity=".4" />

      {/* Tripod support structure (A-frame) */}
      <line x1="-2" y1="-6" x2="8" y2="-32" stroke={c} strokeWidth="1.2" />
      <line x1="18" y1="-6" x2="8" y2="-32" stroke={c} strokeWidth="1.2" />
      {/* Cross bar */}
      <line x1="1" y1="-16" x2="15" y2="-16" stroke={c} strokeWidth=".8" />

      {/* Horizontal boom arm (the distinctive orange arm) */}
      <rect x="-6" y="-34" width="44" height="3" rx="1" fill={c} opacity=".8" />

      {/* Taller antenna pole (right end of boom) */}
      <line x1="34" y1="-34" x2="34" y2="-68" stroke={c} strokeWidth="1.5" />
      {/* Shorter antenna pole (middle of boom) */}
      <line x1="18" y1="-34" x2="18" y2="-55" stroke={c} strokeWidth="1.2" />

      {/* Antenna elements on taller pole */}
      <line x1="30" y1="-62" x2="38" y2="-62" stroke={c} strokeWidth=".8" />
      <line x1="30" y1="-56" x2="38" y2="-56" stroke={c} strokeWidth=".8" />

      {/* Red ball on top */}
      <circle cx="34" cy="-70" r="3" fill="#e53935" opacity=".9" />

      {/* Cable from box to boom */}
      <path d="M -15,-22 C -15,-28 -6,-32 -4,-33" fill="none" stroke={c} strokeWidth=".6" opacity=".5" />

      {/* Label */}
      <text x="5" y="24" textAnchor="middle" fill={GOLD}
        fontSize="7" fontFamily="Courier New,monospace" fontWeight="700">ASA</text>
    </g>
  );
}

/**
 * ESA — Elevation Sensor Assembly (Figure 2-7)
 * - Tall lattice/truss tower with X-pattern cross bracing
 * - 3 guy wires extending to 3 ground anchor blocks
 * - Equipment box at base
 * - Multiple antenna elements along tower height
 * - Distinctive tall narrow structure
 */
function ESASVG({ x, y, active }: { x: number; y: number; active: boolean }) {
  const c = active ? TEAL : DIM;
  return (
    <g transform={`translate(${x},${y})`} className={active ? "comp-active" : ""}>
      {/* Equipment box at base */}
      <rect x="-8" y="-8" width="16" height="10" rx="1.5" fill="#0a1a1a" stroke={c} strokeWidth=".9" />
      {/* Box detail */}
      <rect x="-5" y="-5" width="4" height="4" rx=".5" fill={c} opacity=".3" />
      <rect x="2" y="-5" width="4" height="4" rx=".5" fill={c} opacity=".2" />

      {/* Base plate */}
      <rect x="-12" y="0" width="24" height="4" rx="1" fill="#1a2a2a" stroke={c} strokeWidth=".8" />

      {/* Lattice tower — two vertical rails */}
      <line x1="-4" y1="-8" x2="-4" y2="-120" stroke={c} strokeWidth="1.5" />
      <line x1="4"  y1="-8" x2="4"  y2="-120" stroke={c} strokeWidth="1.5" />

      {/* Cross bracing (X pattern) — the distinctive lattice look */}
      {Array.from({ length: 14 }, (_, i) => (
        <g key={i}>
          <line x1="-4" y1={-8 - i * 8} x2="4" y2={-16 - i * 8}
            stroke={c} strokeWidth=".6" opacity=".55" />
          <line x1="4" y1={-8 - i * 8} x2="-4" y2={-16 - i * 8}
            stroke={c} strokeWidth=".6" opacity=".55" />
        </g>
      ))}

      {/* Horizontal rungs every 16px */}
      {Array.from({ length: 8 }, (_, i) => (
        <line key={i} x1="-4" y1={-8 - i * 16} x2="4" y2={-8 - i * 16}
          stroke={c} strokeWidth=".7" opacity=".4" />
      ))}

      {/* Antenna elements along tower (horizontal stubs) */}
      {[-40, -60, -80, -100].map((yy) => (
        <g key={yy}>
          <line x1="-4" y1={yy} x2="-10" y2={yy} stroke={c} strokeWidth=".8" opacity=".6" />
          <line x1="4" y1={yy} x2="10" y2={yy} stroke={c} strokeWidth=".8" opacity=".6" />
        </g>
      ))}

      {/* Top antenna element */}
      <line x1="0" y1="-120" x2="0" y2="-128" stroke={c} strokeWidth="1.2" />
      <circle cx="0" cy="-130" r="2" fill={c} opacity=".7" />

      {/* 3 Guy wires from near top to ground anchors */}
      {/* Left wire */}
      <line x1="-3" y1="-105" x2="-38" y2="4" stroke={c} strokeWidth=".6" strokeDasharray="4 2" opacity=".5" />
      {/* Right wire */}
      <line x1="3" y1="-105" x2="38" y2="4" stroke={c} strokeWidth=".6" strokeDasharray="4 2" opacity=".5" />
      {/* Back wire (center-ish) */}
      <line x1="0" y1="-105" x2="0" y2="4" stroke={c} strokeWidth=".5" strokeDasharray="4 2" opacity=".35" />

      {/* Ground anchor blocks (concrete) */}
      <rect x="-42" y="2" width="8" height="5" rx="1" fill={c} opacity=".35" />
      <rect x="34"  y="2" width="8" height="5" rx="1" fill={c} opacity=".35" />
      <rect x="-4"  y="4" width="8" height="4" rx="1" fill={c} opacity=".25" />

      {/* Label */}
      <text x="0" y="18" textAnchor="middle" fill={GOLD}
        fontSize="7" fontFamily="Courier New,monospace" fontWeight="700">ESA</text>
    </g>
  );
}

/**
 * INTERROGATOR (Figure 2-10)
 * - Square base plate on 4 cylindrical legs
 * - 3-leg tripod support rising from base
 * - Vertical pole from tripod apex
 * - Cylindrical antenna on top
 * - Red ball at very top
 * - Cable running down
 */
function InterrogatorSVG({ x, y, active }: { x: number; y: number; active: boolean }) {
  const c = active ? TEAL : DIM;
  return (
    <g transform={`translate(${x},${y})`} className={active ? "comp-active" : ""}>
      {/* 4 legs */}
      <rect x="-16" y="0" width="3" height="8" rx="1.5" fill={c} opacity=".6" />
      <rect x="-4"  y="0" width="3" height="8" rx="1.5" fill={c} opacity=".6" />
      <rect x="5"   y="0" width="3" height="8" rx="1.5" fill={c} opacity=".6" />
      <rect x="13"  y="0" width="3" height="8" rx="1.5" fill={c} opacity=".6" />

      {/* Square base plate */}
      <rect x="-18" y="-5" width="36" height="5" rx="1" fill="#1a2a2a" stroke={c} strokeWidth=".9" />

      {/* Tripod legs (3 legs converging upward) */}
      <line x1="-14" y1="-5" x2="0" y2="-38" stroke={c} strokeWidth="1.2" />
      <line x1="14" y1="-5" x2="0" y2="-38" stroke={c} strokeWidth="1.2" />
      <line x1="0" y1="-5" x2="0" y2="-38" stroke={c} strokeWidth="1" opacity=".7" />

      {/* Horizontal brace ring */}
      <ellipse cx="0" cy="-20" rx="8" ry="2" fill="none" stroke={c} strokeWidth=".7" opacity=".5" />

      {/* Vertical pole from apex */}
      <line x1="0" y1="-38" x2="0" y2="-62" stroke={c} strokeWidth="1.5" />

      {/* Cylindrical antenna */}
      <rect x="-4" y="-62" width="8" height="14" rx="4" fill="#0a1a1a" stroke={c} strokeWidth="1" />
      {/* Antenna detail rings */}
      <line x1="-4" y1="-56" x2="4" y2="-56" stroke={c} strokeWidth=".5" opacity=".5" />
      <line x1="-4" y1="-52" x2="4" y2="-52" stroke={c} strokeWidth=".5" opacity=".5" />

      {/* Red ball on top */}
      <circle cx="0" cy="-65" r="2.5" fill="#e53935" opacity=".9" />

      {/* Cable */}
      <path d="M 4,-48 C 12,-40 14,-20 16,-5" fill="none" stroke={c} strokeWidth=".6" opacity=".4" />

      {/* Label */}
      <text x="0" y="20" textAnchor="middle" fill={GOLD}
        fontSize="6" fontFamily="Courier New,monospace" fontWeight="700">INTERROGATOR</text>
    </g>
  );
}

/**
 * ATA — Azimuth Tracking Antenna (Figure 2-12)
 * - Similar to Interrogator but slightly different proportions
 * - Square base on 4 legs
 * - Tripod support
 * - Omni-directional antenna (thinner cylinder)
 * - Red ball
 */
function ATASVG({ x, y, active }: { x: number; y: number; active: boolean }) {
  const c = active ? TEAL : DIM;
  return (
    <g transform={`translate(${x},${y})`} className={active ? "comp-active" : ""}>
      {/* 4 legs */}
      <rect x="-14" y="0" width="3" height="8" rx="1.5" fill={c} opacity=".6" />
      <rect x="-4"  y="0" width="3" height="8" rx="1.5" fill={c} opacity=".6" />
      <rect x="5"   y="0" width="3" height="8" rx="1.5" fill={c} opacity=".6" />
      <rect x="11"  y="0" width="3" height="8" rx="1.5" fill={c} opacity=".6" />

      {/* Base plate */}
      <rect x="-16" y="-5" width="32" height="5" rx="1" fill="#1a2a2a" stroke={c} strokeWidth=".9" />

      {/* Tripod */}
      <line x1="-12" y1="-5" x2="0" y2="-34" stroke={c} strokeWidth="1.1" />
      <line x1="12" y1="-5" x2="0" y2="-34" stroke={c} strokeWidth="1.1" />
      <line x1="0" y1="-5" x2="0" y2="-34" stroke={c} strokeWidth=".9" opacity=".6" />

      {/* Brace */}
      <ellipse cx="0" cy="-18" rx="7" ry="1.8" fill="none" stroke={c} strokeWidth=".6" opacity=".45" />

      {/* Vertical pole */}
      <line x1="0" y1="-34" x2="0" y2="-58" stroke={c} strokeWidth="1.3" />

      {/* Omni antenna (thinner, taller cylinder) */}
      <rect x="-2.5" y="-58" width="5" height="16" rx="2.5" fill="#0a1a1a" stroke={c} strokeWidth=".9" />
      {/* Detail */}
      <line x1="-2.5" y1="-50" x2="2.5" y2="-50" stroke={c} strokeWidth=".4" opacity=".5" />

      {/* Red ball */}
      <circle cx="0" cy="-60" r="2.5" fill="#e53935" opacity=".9" />

      {/* Cable */}
      <path d="M 3,-44 C 10,-36 12,-18 14,-5" fill="none" stroke={c} strokeWidth=".5" opacity=".4" />

      {/* Label */}
      <text x="0" y="20" textAnchor="middle" fill={GOLD}
        fontSize="7" fontFamily="Courier New,monospace" fontWeight="700">ATA</text>
    </g>
  );
}

/**
 * CAL/BIT (Figure 2-11)
 * - Similar structure to Interrogator
 * - Directional antenna (pointed shape)
 * - Square base, tripod, pole
 */
function CalBitSVG({ x, y, active }: { x: number; y: number; active: boolean }) {
  const c = active ? TEAL : DIM;
  return (
    <g transform={`translate(${x},${y})`} className={active ? "comp-active" : ""}>
      {/* 4 legs */}
      <rect x="-12" y="0" width="3" height="7" rx="1.5" fill={c} opacity=".6" />
      <rect x="-3"  y="0" width="3" height="7" rx="1.5" fill={c} opacity=".6" />
      <rect x="4"   y="0" width="3" height="7" rx="1.5" fill={c} opacity=".6" />
      <rect x="10"  y="0" width="3" height="7" rx="1.5" fill={c} opacity=".6" />

      {/* Base plate */}
      <rect x="-14" y="-4" width="28" height="4" rx="1" fill="#1a2a2a" stroke={c} strokeWidth=".8" />

      {/* Tripod */}
      <line x1="-10" y1="-4" x2="0" y2="-30" stroke={c} strokeWidth="1" />
      <line x1="10" y1="-4" x2="0" y2="-30" stroke={c} strokeWidth="1" />
      <line x1="0" y1="-4" x2="0" y2="-30" stroke={c} strokeWidth=".8" opacity=".6" />

      {/* Pole */}
      <line x1="0" y1="-30" x2="0" y2="-50" stroke={c} strokeWidth="1.2" />

      {/* Directional antenna (pointed/dish shape) */}
      <ellipse cx="0" cy="-50" rx="6" ry="3" fill="#0a1a1a" stroke={c} strokeWidth=".9" />
      <line x1="0" y1="-50" x2="0" y2="-56" stroke={c} strokeWidth="1" />

      {/* Red ball */}
      <circle cx="0" cy="-57" r="2" fill="#e53935" opacity=".85" />

      {/* Cable */}
      <path d="M 3,-38 C 8,-30 10,-15 12,-4" fill="none" stroke={c} strokeWidth=".5" opacity=".4" />

      {/* Label */}
      <text x="0" y="18" textAnchor="middle" fill={GOLD}
        fontSize="6.5" fontFamily="Courier New,monospace" fontWeight="700">CAL/BIT</text>
    </g>
  );
}

/** Aircraft — top-down silhouette (approaching from right) */
function Aircraft({ x, y, color = "#d0e8f8" }: { x: number; y: number; color?: string }) {
  return (
    <g transform={`translate(${x},${y})`}
       style={{ filter: `drop-shadow(0 0 6px ${color}44)` }}>
      {/* Fuselage */}
      <ellipse cx="0" cy="0" rx="28" ry="5" fill={color} opacity=".9" />
      {/* Nose */}
      <ellipse cx="28" cy="0" rx="8" ry="3.5" fill={color} opacity=".85" />
      {/* Wings */}
      <polygon points="-4,-5 12,-5 6,-22 -14,-22" fill={color} opacity=".85" />
      <polygon points="-4,5 12,5 6,22 -14,22" fill={color} opacity=".85" />
      {/* Tail */}
      <polygon points="-26,-4 -20,-4 -22,-14 -28,-14" fill={color} opacity=".75" />
      <polygon points="-26,4 -20,4 -22,14 -28,14" fill={color} opacity=".75" />
      {/* Engines */}
      <ellipse cx="2" cy="-14" rx="6" ry="2.5" fill={color} opacity=".6" />
      <ellipse cx="2" cy="14" rx="6" ry="2.5" fill={color} opacity=".6" />
    </g>
  );
}

/** Runway — horizontal strip with markings */
function RunwayStrip() {
  return (
    <g>
      {/* Runway surface */}
      <rect x="40" y="30" width="720" height="28" rx="2" fill="#111" stroke="rgba(255,255,255,.1)" strokeWidth="1" />
      {/* Center line dashes */}
      {Array.from({ length: 18 }, (_, i) => (
        <rect key={i} x={60 + i * 40} y="42" width="20" height="4" rx="1" fill="rgba(255,255,255,.35)" />
      ))}
      {/* Threshold markings (right end) */}
      {Array.from({ length: 4 }, (_, i) => (
        <rect key={i} x="700" y={33 + i * 6} width="30" height="3" rx="1" fill="rgba(255,255,255,.4)" />
      ))}
      {/* Touch down zone (left-center) */}
      <rect x="280" y="38" width="24" height="3" rx="1" fill="rgba(255,255,255,.3)" />
      <rect x="280" y="47" width="24" height="3" rx="1" fill="rgba(255,255,255,.3)" />

      {/* Labels */}
      <text x="292" y="26" textAnchor="middle" fill="rgba(255,255,255,.35)"
        fontSize="6" fontFamily="Courier New,monospace">TOUCH DOWN</text>
      <text x="715" y="26" textAnchor="middle" fill="rgba(255,255,255,.35)"
        fontSize="6" fontFamily="Courier New,monospace">THRESHOLD</text>
    </g>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE COMPONENTS FOR EACH STEP
// ══════════════════════════════════════════════════════════════════════════════

// Component positions (matching IMG_4200 layout — below runway)
const POS = {
  ASA:          { x: 220, y: 160 },
  INTERROGATOR: { x: 330, y: 210 },
  SHELTER:      { x: 440, y: 260 },
  ESA:          { x: 500, y: 190 },
  ATA:          { x: 590, y: 180 },
  CALBIT:       { x: 700, y: 200 },
  AIRCRAFT:     { x: 790, y: 44 },
};

function AllComponents({ activeList }: { activeList: readonly string[] }) {
  return (
    <g>
      <RunwayStrip />
      <ASASVG x={POS.ASA.x} y={POS.ASA.y} active={activeList.includes("ASA")} />
      <InterrogatorSVG x={POS.INTERROGATOR.x} y={POS.INTERROGATOR.y} active={activeList.includes("INTERROGATOR")} />
      <ShelterSVG x={POS.SHELTER.x} y={POS.SHELTER.y} active={activeList.includes("SHELTER")} />
      <ESASVG x={POS.ESA.x} y={POS.ESA.y} active={activeList.includes("ESA")} />
      <ATASVG x={POS.ATA.x} y={POS.ATA.y} active={activeList.includes("ATA")} />
      <CalBitSVG x={POS.CALBIT.x} y={POS.CALBIT.y} active={activeList.includes("CALBIT")} />
    </g>
  );
}

// ── Step 1: Interrogation ─────────────────────────────────────────────────────
function Step1Scene({ color, active }: { color: string; active: readonly string[] }) {
  const intX = POS.INTERROGATOR.x, intY = POS.INTERROGATOR.y - 65;
  const acX = POS.AIRCRAFT.x, acY = POS.AIRCRAFT.y;
  return (
    <g>
      <AllComponents activeList={active} />
      <Aircraft x={acX} y={acY} color="#d0e8f8" />

      {/* Expanding rings from Interrogator */}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} className="ring" cx={intX} cy={intY}
          r={6} fill="none" stroke={color} strokeWidth="2"
          style={{ animationDelay: `${i * 0.5}s` }} />
      ))}

      {/* Moving dots — Interrogator → Aircraft */}
      {[0, 1, 2].map((i) => (
        <circle key={i} className="dot-out"
          r="4.5" fill={color} opacity=".85"
          style={{ animationDelay: `${i * 0.65}s` }} />
      ))}

      {/* Arrow near aircraft */}
      <polygon points={`${acX - 40},${acY} ${acX - 50},${acY - 6} ${acX - 50},${acY + 6}`}
        fill={color} opacity=".55" />

      {/* Freq badge */}
      <g className="tls-fadein" style={{ animationDelay: ".4s" }}>
        <rect x="480" y="100" width="120" height="20" rx="4"
          fill="rgba(0,0,0,.7)" stroke={color} strokeWidth="1" />
        <text x="540" y="114" textAnchor="middle" fill={color}
          fontSize="10" fontFamily="Courier New,monospace" fontWeight="700">1030 MHz ►</text>
      </g>
    </g>
  );
}

// ── Step 2: Transponder Reply ─────────────────────────────────────────────────
function Step2Scene({ color, active }: { color: string; active: readonly string[] }) {
  const acX = POS.AIRCRAFT.x, acY = POS.AIRCRAFT.y;
  return (
    <g>
      <AllComponents activeList={active} />
      <Aircraft x={acX} y={acY} color={color} />

      {/* Expanding rings from Aircraft */}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} className="ring" cx={acX} cy={acY}
          r={6} fill="none" stroke={color} strokeWidth="2"
          style={{ animationDelay: `${i * 0.5}s` }} />
      ))}

      {/* Moving dots — Aircraft → sensors */}
      {[0, 1, 2].map((i) => (
        <circle key={i} className="dot-in"
          r="4.5" fill={color} opacity=".85"
          style={{ animationDelay: `${i * 0.65}s` }} />
      ))}

      {/* Arrow near ASA */}
      <polygon points={`${POS.ASA.x + 30},${POS.ASA.y - 30} ${POS.ASA.x + 20},${POS.ASA.y - 36} ${POS.ASA.x + 20},${POS.ASA.y - 24}`}
        fill={color} opacity=".55" />

      {/* Freq badge */}
      <g className="tls-fadein" style={{ animationDelay: ".4s" }}>
        <rect x="480" y="100" width="120" height="20" rx="4"
          fill="rgba(0,0,0,.7)" stroke={color} strokeWidth="1" />
        <text x="540" y="114" textAnchor="middle" fill={color}
          fontSize="10" fontFamily="Courier New,monospace" fontWeight="700">◄ 1090 MHz</text>
      </g>

      {/* TRANSPONDER label on aircraft */}
      <g className="tls-fadein" style={{ animationDelay: ".6s" }}>
        <rect x={acX - 50} y={acY + 14} width="80" height="16" rx="3"
          fill="rgba(0,0,0,.6)" stroke={`${color}55`} strokeWidth="1" />
        <text x={acX - 10} y={acY + 26} textAnchor="middle" fill={`${color}cc`}
          fontSize="8" fontFamily="Courier New,monospace">TRANSPONDER</text>
      </g>
    </g>
  );
}

// ── Step 3: Position Fix ──────────────────────────────────────────────────────
function Step3Scene({ color, active }: { color: string; active: readonly string[] }) {
  const acX = POS.AIRCRAFT.x, acY = POS.AIRCRAFT.y;
  const sensors = [
    { x: POS.ASA.x, y: POS.ASA.y - 60, label: "ASA" },
    { x: POS.ESA.x, y: POS.ESA.y - 120, label: "ESA" },
    { x: POS.ATA.x, y: POS.ATA.y - 50, label: "ATA" },
  ];
  return (
    <g>
      <AllComponents activeList={active} />
      <Aircraft x={acX} y={acY} color="#d0e8f8" />

      {/* Lines from sensors to aircraft */}
      {sensors.map((s, i) => (
        <line key={i} className="grid-line"
          x1={s.x} y1={s.y} x2={acX} y2={acY}
          stroke={color} strokeWidth="1.5" opacity=".6"
          style={{ animationDelay: `${i * 0.2}s` }} />
      ))}

      {/* Crosshair */}
      <g className="cross-pop" style={{ animationDelay: ".8s" }}>
        <line x1={acX - 20} y1={acY} x2={acX + 20} y2={acY} stroke={color} strokeWidth="2" />
        <line x1={acX} y1={acY - 20} x2={acX} y2={acY + 20} stroke={color} strokeWidth="2" />
        <circle cx={acX} cy={acY} r="8" fill="none" stroke={color} strokeWidth="1.5" />
      </g>

      {/* Position readout */}
      <g className="tls-fadein" style={{ animationDelay: "1s" }}>
        <rect x="600" y="80" width="130" height="48" rx="4"
          fill="rgba(0,0,0,.8)" stroke={color} strokeWidth="1" />
        <text x="665" y="96" textAnchor="middle" fill={color}
          fontSize="8" fontFamily="Courier New,monospace" fontWeight="700">POSITION FIX</text>
        <text x="665" y="109" textAnchor="middle" fill="rgba(255,255,255,.7)"
          fontSize="7.5" fontFamily="Courier New,monospace">x: +0.42  y: -0.18</text>
        <text x="665" y="121" textAnchor="middle" fill="rgba(255,255,255,.7)"
          fontSize="7.5" fontFamily="Courier New,monospace">z: 1240 ft MSL</text>
      </g>
    </g>
  );
}

// ── Step 4: Displacement Calculation ──────────────────────────────────────────
function Step4Scene({ color, active }: { color: string; active: readonly string[] }) {
  const shX = POS.SHELTER.x, shY = POS.SHELTER.y - 100;
  const acX = POS.AIRCRAFT.x, acY = POS.AIRCRAFT.y;
  return (
    <g>
      <AllComponents activeList={active} />

      {/* ILS beam — triangular from shelter uplink */}
      <polygon className="beam-grow"
        points={`${shX + 13},${shY} ${shX + 13},${shY + 8} ${acX + 20},${acY + 28} ${acX + 20},${acY - 28}`}
        fill={`${color}15`} stroke={color} strokeWidth="1" opacity=".8" />

      {/* Centerline */}
      <line x1={shX + 13} y1={shY + 4} x2={acX + 20} y2={acY}
        stroke={color} strokeWidth="1.5" strokeDasharray="10 5" opacity=".5" />

      {/* Aircraft off path */}
      <Aircraft x={acX} y={acY + 18} color={color} />

      {/* Deviation arrow */}
      <g className="tls-fadein" style={{ animationDelay: ".5s" }}>
        <line x1={acX} y1={acY + 18} x2={acX} y2={acY + 2} stroke={color} strokeWidth="2.5" />
        <polygon points={`${acX - 4},${acY + 4} ${acX + 4},${acY + 4} ${acX},${acY - 2}`} fill={color} />
        <text x={acX + 12} y={acY + 14} fill={color}
          fontSize="10" fontFamily="Courier New,monospace" fontWeight="700">Δ</text>
      </g>

      {/* CDI */}
      <g className="tls-fadein" style={{ animationDelay: ".7s" }} transform="translate(120,320)">
        <circle cx="0" cy="0" r="40" fill="#080808" stroke={color} strokeWidth="1.2" />
        <line x1="-28" y1="0" x2="28" y2="0" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
        <line x1="0" y1="-28" x2="0" y2="28" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
        {[-14, -7, 7, 14].map((d) => (
          <circle key={d} cx={d} cy="0" r="2" fill="rgba(255,255,255,.15)" />
        ))}
        <rect className="needle-swing" x="-1.5" y="-26" width="3" height="52" rx="1.5" fill={color} opacity=".85" />
        <circle cx="0" cy="0" r="4" fill={color} opacity=".8" />
        <text x="0" y="50" textAnchor="middle" fill={color}
          fontSize="6.5" fontFamily="Courier New,monospace" fontWeight="700">CDI</text>
      </g>

      {/* Readout */}
      <g className="tls-fadein" style={{ animationDelay: ".9s" }}>
        <rect x="120" y="100" width="160" height="44" rx="4"
          fill="rgba(0,0,0,.75)" stroke={color} strokeWidth="1" />
        <text x="200" y="116" textAnchor="middle" fill={color}
          fontSize="8" fontFamily="Courier New,monospace" fontWeight="700">DISPLACEMENT</text>
        <text x="200" y="129" textAnchor="middle" fill="rgba(255,255,255,.65)"
          fontSize="7.5" fontFamily="Courier New,monospace">LOC: +0.08°  GS: -0.12°</text>
        <text x="200" y="140" textAnchor="middle" fill="rgba(255,255,255,.4)"
          fontSize="7" fontFamily="Courier New,monospace">COMPUTING…</text>
      </g>
    </g>
  );
}

// ── Step 5: Course Adjustment — RCU ───────────────────────────────────────────
function Step5Scene({ color, active }: { color: string; active: readonly string[] }) {
  return (
    <g>
      <AllComponents activeList={active} />
      <Aircraft x={POS.AIRCRAFT.x} y={POS.AIRCRAFT.y} color="#d0e8f8" />

      {/* RCU screen */}
      <g className="tls-fadein" transform="translate(150,160)">
        <rect x="-50" y="-45" width="100" height="75" rx="5"
          fill="#0a1a0a" stroke={color} strokeWidth="1.3" />
        <rect x="-42" y="-38" width="84" height="50" rx="3"
          fill="#030d03" stroke={`${color}55`} strokeWidth="1" />
        <text x="0" y="-24" textAnchor="middle" fill={color}
          fontSize="6.5" fontFamily="Courier New,monospace" fontWeight="700">RCU PROCESSOR</text>
        {["LOC ADJ: -0.08°", "GS  ADJ: +0.12°", "XPDR: A4721"].map((txt, i) => (
          <text key={i} x="-36" y={-12 + i * 11} fill="rgba(255,255,255,.6)"
            fontSize="6.5" fontFamily="Courier New,monospace">{txt}</text>
        ))}
        <text x="-8" y="18" fill={color} fontSize="6.5" fontFamily="Courier New,monospace">CALC</text>
        <circle className="dot1" cx="14" cy="15" r="2.5" fill={color} />
        <circle className="dot2" cx="21" cy="15" r="2.5" fill={color} />
        <circle className="dot3" cx="28" cy="15" r="2.5" fill={color} />
        <rect className="rcu-blink" x="-36" y="22" width="5" height="7" rx="1" fill={color} />
        <rect x="-16" y="30" width="32" height="5" rx="2" fill={color} opacity=".35" />
      </g>

      {/* Arrows: Shelter → RCU → Aircraft */}
      <line x1={POS.SHELTER.x} y1={POS.SHELTER.y - 80} x2="200" y2="160"
        stroke={color} strokeWidth="1" strokeDasharray="5 3" opacity=".4" />
      <line x1="200" y1="140" x2={POS.AIRCRAFT.x - 30} y2={POS.AIRCRAFT.y + 10}
        stroke={color} strokeWidth="1" strokeDasharray="5 3" opacity=".4" />

      {/* Status */}
      <g className="tls-fadein" style={{ animationDelay: ".5s" }}>
        <rect x="280" y="90" width="150" height="20" rx="4"
          fill="rgba(0,0,0,.65)" stroke={color} strokeWidth="1" />
        <circle cx="294" cy="100" r="4" fill={color} className="tls-blink" />
        <text x="370" y="104" textAnchor="middle" fill={color}
          fontSize="9" fontFamily="Courier New,monospace" fontWeight="700">COMPUTING…</text>
      </g>
    </g>
  );
}

// ── Step 6: Guidance Signal ───────────────────────────────────────────────────
function Step6Scene({ color, active }: { color: string; active: readonly string[] }) {
  const shX = POS.SHELTER.x + 13, shY = POS.SHELTER.y - 100;
  return (
    <g>
      <AllComponents activeList={active} />

      {/* ILS guidance beam */}
      <polygon className="guid-pulse"
        points={`${shX},${shY} ${shX},${shY + 8} 830,72 830,16`}
        fill={`${color}14`} stroke={color} strokeWidth="1" />

      {/* Centerline */}
      <line x1={shX} y1={shY + 4} x2={830} y2={44}
        stroke={color} strokeWidth="1.8" strokeDasharray="12 6" opacity=".55" />

      {/* Aircraft on correct path */}
      <g className="ac-glide">
        <Aircraft x={POS.AIRCRAFT.x} y={POS.AIRCRAFT.y} color={color} />
      </g>

      {/* Signal ripples */}
      {[0, 1, 2].map((i) => (
        <circle key={i} className="sig-ripple"
          cx={shX} cy={shY + 4} r={4}
          fill="none" stroke={color} strokeWidth="1.8"
          style={{ animationDelay: `${i * 0.43}s` }} />
      ))}

      {/* ON GLIDEPATH */}
      <g className="tls-fadein" style={{ animationDelay: ".5s" }}>
        <rect x="600" y="80" width="140" height="20" rx="4"
          fill={`${color}15`} stroke={color} strokeWidth="1" />
        <circle cx="614" cy="90" r="4" fill={color} className="tls-blink" />
        <text x="685" y="94" textAnchor="middle" fill={color}
          fontSize="9" fontFamily="Courier New,monospace" fontWeight="700">ON GLIDEPATH</text>
      </g>

      {/* ILS info */}
      <g className="tls-fadein" style={{ animationDelay: ".8s" }}>
        <rect x="100" y="300" width="180" height="48" rx="4"
          fill="rgba(0,0,0,.75)" stroke={color} strokeWidth="1" />
        <text x="190" y="316" textAnchor="middle" fill={color}
          fontSize="8" fontFamily="Courier New,monospace" fontWeight="700">ILS GUIDANCE ACTIVE</text>
        <text x="190" y="329" textAnchor="middle" fill="rgba(255,255,255,.6)"
          fontSize="7.5" fontFamily="Courier New,monospace">LOC: 108.10 MHz</text>
        <text x="190" y="342" textAnchor="middle" fill="rgba(255,255,255,.6)"
          fontSize="7.5" fontFamily="Courier New,monospace">GS: 334.70 MHz / GCA</text>
      </g>

      {/* CDI centered */}
      <g className="tls-fadein" style={{ animationDelay: "1s" }} transform="translate(120,350)">
        <circle cx="0" cy="0" r="35" fill="#080808" stroke={color} strokeWidth="1.2" />
        <line x1="-24" y1="0" x2="24" y2="0" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
        <line x1="0" y1="-24" x2="0" y2="24" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
        <rect x="-1.2" y="-22" width="2.4" height="44" rx="1.2" fill={color} opacity=".9" />
        <rect x="-22" y="-1.2" width="44" height="2.4" rx="1.2" fill={color} opacity=".65" />
        <circle cx="0" cy="0" r="3.5" fill={color} />
        <text x="0" y="44" textAnchor="middle" fill={color}
          fontSize="6" fontFamily="Courier New,monospace" fontWeight="700">CENTERED</text>
      </g>
    </g>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function TLSAnimation() {
  const [cur, setCur]       = useState(0);
  const [tick, setTick]     = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(() => {
    setCur((c) => (c + 1) % STEPS.length);
    setTick((t) => t + 1);
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(advance, STEP_DUR);
  }, [advance]);

  useEffect(() => {
    if (!paused) startTimer();
    else if (timerRef.current) clearInterval(timerRef.current);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, startTimer]);

  const goTo = (idx: number) => {
    setCur(idx);
    setTick((t) => t + 1);
    if (!paused) startTimer();
  };

  const step = STEPS[cur];

  const SceneMap: Record<number, JSX.Element> = {
    0: <Step1Scene color={step.color} active={step.active} />,
    1: <Step2Scene color={step.color} active={step.active} />,
    2: <Step3Scene color={step.color} active={step.active} />,
    3: <Step4Scene color={step.color} active={step.active} />,
    4: <Step5Scene color={step.color} active={step.active} />,
    5: <Step6Scene color={step.color} active={step.active} />,
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100dvh",
      background: BG, overflow: "hidden", fontFamily: "Courier New, monospace",
    }}>
      <style>{CSS}</style>

      {/* ── HEADER ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "6px 12px", flexShrink: 0,
        background: "rgba(3,11,24,.97)",
        borderBottom: `1px solid ${step.color}30`,
        transition: "border-color .5s",
      }}>
        <BackButton />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#d0e8f8", letterSpacing: 2 }}>
            TLS OPERATION CYCLE
          </div>
          <div style={{ fontSize: 7, color: "rgba(0,174,239,.45)", letterSpacing: 2 }}>
            FIGURE 4-1 — TECHNICAL OPERATIONAL SEQUENCE
          </div>
        </div>
        <div style={{
          padding: "2px 8px", borderRadius: 4,
          background: `${step.color}18`, border: `1px solid ${step.color}44`,
          fontSize: 8, color: step.color, letterSpacing: "0.1em",
        }}>
          {step.phase}
        </div>
        <div style={{ textAlign: "center", marginLeft: 4 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: step.color, lineHeight: 1,
            textShadow: `0 0 12px ${step.color}` }}>{cur + 1}</div>
          <div style={{ fontSize: 6, color: "rgba(255,255,255,.3)", letterSpacing: 1 }}>OF 6</div>
        </div>
        <button
          onClick={() => setPaused((p) => !p)}
          style={{
            background: "rgba(255,255,255,.05)", border: `1px solid ${step.color}35`,
            borderRadius: 5, padding: "4px 9px", cursor: "pointer",
            color: step.color, fontSize: 9, letterSpacing: "0.08em",
            fontFamily: "Courier New, monospace",
          }}
        >
          {paused ? "▶ PLAY" : "⏸ PAUSE"}
        </button>
      </div>

      {/* ── STEP LABEL BAR ── */}
      <div
        key={`l${tick}`}
        className="tls-fadein"
        style={{
          padding: "4px 12px",
          background: `linear-gradient(90deg, ${step.color}15 0%, transparent 100%)`,
          borderBottom: `1px solid ${step.color}18`,
          borderLeft: `3px solid ${step.color}`,
          flexShrink: 0,
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 700, color: step.color, letterSpacing: "0.12em" }}>
          STEP {step.n} — {step.label}
        </span>
        <span style={{
          fontSize: 8, padding: "1px 6px", borderRadius: 3,
          background: `${step.color}15`, border: `1px solid ${step.color}30`,
          color: step.color, letterSpacing: "0.06em",
        }}>
          {step.freq}
        </span>
      </div>

      {/* ── SVG SCENE ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: SURFACE }}>
        {/* Grid */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: .3 }}
          viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: 19 }, (_, i) => (
            <line key={i} x1={i * 50} y1="0" x2={i * 50} y2={VH}
              stroke="rgba(0,174,239,.05)" strokeWidth="1" />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1="0" y1={i * 50} x2={VW} y2={i * 50}
              stroke="rgba(0,174,239,.05)" strokeWidth="1" />
          ))}
        </svg>

        {/* Scene */}
        <svg
          key={`sc${tick}`}
          className="tls-fadein"
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <defs>
            <radialGradient id="vig3" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor={BG} stopOpacity=".4" />
            </radialGradient>
          </defs>
          {SceneMap[cur]}
          <rect x="0" y="0" width={VW} height={VH} fill="url(#vig3)" />
        </svg>

        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          boxShadow: `inset 0 0 60px ${step.color}0a`,
          transition: "box-shadow .5s",
        }} />
      </div>

      {/* ── DESCRIPTION ── */}
      <div
        key={`d${tick}`}
        className="tls-fadein"
        style={{
          padding: "6px 12px 4px", flexShrink: 0,
          background: "rgba(3,11,24,.95)",
          borderTop: "1px solid rgba(255,255,255,.04)",
        }}
      >
        <div style={{ fontSize: 11, lineHeight: 1.5, color: "rgba(255,255,255,.85)" }}>
          {step.en}
        </div>
        <div style={{
          fontSize: 10.5, lineHeight: 1.55, color: `${step.color}cc`,
          marginTop: 2, direction: "rtl", fontWeight: 500,
          fontFamily: "Inter, sans-serif",
        }}>
          {step.ar}
        </div>
      </div>

      {/* ── PROGRESS BAR ── */}
      <div style={{ flexShrink: 0, height: 3, background: "rgba(255,255,255,.05)" }}>
        {!paused && (
          <div
            key={`p${tick}`}
            style={{
              height: "100%",
              background: `linear-gradient(90deg, ${step.color}, ${step.color}88)`,
              borderRadius: 2,
              animation: `tls-prog ${STEP_DUR}ms linear forwards`,
            }}
          />
        )}
      </div>

      {/* ── STEP DOTS ── */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: 0, padding: "6px 0 8px", flexShrink: 0,
        background: "rgba(3,11,24,.97)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 6, color: "rgba(255,255,255,.25)", letterSpacing: "0.06em", marginRight: 3 }}>
            SURV
          </span>
          {STEPS.slice(0, 3).map((s, idx) => (
            <button key={idx} onClick={() => goTo(idx)} title={`Step ${s.n}`}
              style={{
                width: idx === cur ? 22 : 7, height: 7, borderRadius: 4, border: "none",
                cursor: "pointer", padding: 0,
                background: idx === cur ? s.color : idx < cur ? `${s.color}55` : "rgba(255,255,255,.1)",
                boxShadow: idx === cur ? `0 0 8px ${s.color}` : "none",
                transition: "all .4s",
              }}
            />
          ))}
        </div>
        <div style={{ width: 1, height: 14, background: "rgba(255,255,255,.12)", margin: "0 10px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 6, color: "rgba(255,255,255,.25)", letterSpacing: "0.06em", marginRight: 3 }}>
            GUID
          </span>
          {STEPS.slice(3).map((s, idx) => {
            const ri = idx + 3;
            return (
              <button key={ri} onClick={() => goTo(ri)} title={`Step ${s.n}`}
                style={{
                  width: ri === cur ? 22 : 7, height: 7, borderRadius: 4, border: "none",
                  cursor: "pointer", padding: 0,
                  background: ri === cur ? s.color : ri < cur ? `${s.color}55` : "rgba(255,255,255,.1)",
                  boxShadow: ri === cur ? `0 0 8px ${s.color}` : "none",
                  transition: "all .4s",
                }}
              />
            );
          })}
        </div>
        <span style={{ fontSize: 6, color: "rgba(255,255,255,.18)", letterSpacing: "0.06em", marginLeft: 10 }}>
          {paused ? "PAUSED" : "AUTO"}
        </span>
      </div>
    </div>
  );
}
