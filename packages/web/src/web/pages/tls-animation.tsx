/**
 * TLS Animation — Figure 4-1 TLS Operation Cycle
 * 6-step animated SVG/CSS visualization matching the official TLS Operators Manual
 * Split into: Surveillance (Steps 1-3) and Guidance (Steps 4-6)
 */
import { useState, useEffect, useRef, useCallback } from "react";
import BackButton from "../components/BackButton";

// ── Palette ───────────────────────────────────────────────────────────────────
const BG      = "#030b18";
const SURFACE = "#040d1c";

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  {
    n: 1,
    phase: "SURVEILLANCE",
    color: "#00E676",
    label: "INTERROGATION",
    freq:  "1030 MHz",
    en: "System interrogates all transponders within the service volume with alternating Mode A and Mode C request.",
    ar: "يرسل النظام إشارة استجواب بتردد 1030 MHz لجميع الطائرات داخل نطاق الخدمة بتناوب Mode A و Mode C.",
  },
  {
    n: 2,
    phase: "SURVEILLANCE",
    color: "#FF9500",
    label: "TRANSPONDER REPLY",
    freq:  "1090 MHz",
    en: "Aircraft transponder responds to the interrogation signal.",
    ar: "يرد جهاز الإرسال (Transponder) في الطائرة على إشارة الاستجواب بتردد 1090 MHz.",
  },
  {
    n: 3,
    phase: "SURVEILLANCE",
    color: "#00C8FF",
    label: "POSITION FIX",
    freq:  "MLAT x,y,z",
    en: "System sensors measure the reply signal and determine aircraft position.",
    ar: "تقيس حساسات النظام إشارة الرد وتحدد موضع الطائرة ثلاثياً (x, y, z).",
  },
  {
    n: 4,
    phase: "GUIDANCE",
    color: "#FFD700",
    label: "DISPLACEMENT CALC",
    freq:  "Δ PATH",
    en: "The system determines the displacement from the desired approach (programmed into the system).",
    ar: "يحدد النظام انحراف الطائرة عن مسار الاقتراب المبرمج مسبقاً.",
  },
  {
    n: 5,
    phase: "GUIDANCE",
    color: "#FF6B35",
    label: "COURSE ADJUSTMENT",
    freq:  "RCU COMPUTE",
    en: "The system calculates the required course adjustments.",
    ar: "يحسب النظام التعديلات اللازمة على مسار الطيران.",
  },
  {
    n: 6,
    phase: "GUIDANCE",
    color: "#00AEEF",
    label: "GUIDANCE SIGNAL",
    freq:  "ILS / GCA",
    en: "Course correction information is sent to the aircraft either by verbal instruction (GCA) or transmitted signals (ILS).",
    ar: "تُرسل معلومات تصحيح المسار للطائرة إما بتعليمات صوتية (GCA) أو إشارات إرسال (ILS).",
  },
] as const;

const STEP_DUR = 4500;

// ── SVG scene dimensions ──────────────────────────────────────────────────────
const VW = 860;
const VH = 300;

// ── CSS keyframes ─────────────────────────────────────────────────────────────
const CSS = `
@keyframes tls-fadein { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
@keyframes tls-prog   { from{width:0%} to{width:100%} }
@keyframes tls-blink  { 0%,100%{opacity:1} 50%{opacity:.2} }

/* Expanding concentric circles — outward from source */
@keyframes ring-expand {
  0%   { r: 8;  opacity: .95; stroke-width: 2.5; }
  40%  { opacity: .7; }
  100% { r: 130; opacity: 0;  stroke-width: .8; }
}
.ring { animation: ring-expand 2.2s ease-out infinite; }
.ring:nth-child(2) { animation-delay: .55s; }
.ring:nth-child(3) { animation-delay: 1.1s; }
.ring:nth-child(4) { animation-delay: 1.65s; }

/* Step 3 — grid lines draw in */
@keyframes line-draw { from{stroke-dashoffset:500} to{stroke-dashoffset:0} }
.grid-line { stroke-dasharray:500; animation: line-draw 1.3s ease both; }

/* Step 3 — crosshair pop */
@keyframes cross-pop { 0%{opacity:0;transform:scale(.3)} 60%{opacity:1;transform:scale(1.2)} 100%{transform:scale(1)} }
.cross-pop { animation: cross-pop .7s ease both; }

/* Step 4 — beam grow */
@keyframes beam-grow { from{opacity:0;transform:scaleX(.04)} to{opacity:1;transform:scaleX(1)} }
.beam-grow { transform-origin: left center; animation: beam-grow 1.2s ease both; }

/* Step 4 — CDI needle swing */
@keyframes needle-swing { 0%{transform:rotate(-38deg)} 65%{transform:rotate(10deg)} 100%{transform:rotate(0deg)} }
.needle-swing { transform-origin: 50% 100%; animation: needle-swing 1.5s ease both; }

/* Step 5 — RCU screen blink */
@keyframes rcu-blink { 0%,100%{opacity:.8} 50%{opacity:.3} }
.rcu-blink { animation: rcu-blink .9s ease-in-out infinite; }

/* Step 5 — compute dots */
@keyframes dot-seq { 0%,100%{opacity:.2} 33%{opacity:1} }
.dot1 { animation: dot-seq 1.2s ease-in-out infinite; }
.dot2 { animation: dot-seq 1.2s ease-in-out infinite .4s; }
.dot3 { animation: dot-seq 1.2s ease-in-out infinite .8s; }

/* Step 6 — guidance beam pulse */
@keyframes guid-pulse { 0%,100%{opacity:.5} 50%{opacity:.9} }
.guid-pulse { animation: guid-pulse 1.5s ease-in-out infinite; }

/* Step 6 — aircraft glide onto path */
@keyframes ac-glide { from{transform:translate(0,20px)} to{transform:translate(0,0)} }
.ac-glide { animation: ac-glide 1.8s ease both; }

/* Step 6 — signal ripple */
@keyframes sig-ripple { 0%{r:5;opacity:.9} 100%{r:28;opacity:0} }
.sig-ripple { animation: sig-ripple 1.4s ease-out infinite; }
.sig-ripple:nth-child(2){animation-delay:.47s}
.sig-ripple:nth-child(3){animation-delay:.94s}

.tls-fadein { animation: tls-fadein .5s ease both; }
.tls-blink  { animation: tls-blink 1.1s ease-in-out infinite; }
`;

// ── Shared SVG sub-components ─────────────────────────────────────────────────

/** Simple aircraft silhouette — side view */
function Aircraft({ x, y, scale = 1, color = "#d0e8f8" }: {
  x: number; y: number; scale?: number; color?: string;
}) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}
       style={{ filter: `drop-shadow(0 0 5px ${color}55)` }}>
      {/* fuselage */}
      <ellipse cx="0" cy="0" rx="40" ry="8" fill={color} opacity=".92" />
      {/* nose cone */}
      <ellipse cx="38" cy="-1" rx="10" ry="5" fill={color} opacity=".85" />
      {/* main wing */}
      <polygon points="-6,-8 20,-8 8,16 -20,16" fill={color} opacity=".88" />
      {/* tail fin */}
      <polygon points="-34,-8 -23,-8 -30,-24 -38,-8" fill={color} opacity=".8" />
      {/* horizontal stabiliser */}
      <polygon points="-32,0 -22,0 -26,9 -36,9" fill={color} opacity=".75" />
      {/* engine */}
      <ellipse cx="5" cy="13" rx="10" ry="4" fill={color} opacity=".6" />
    </g>
  );
}

/** Small ground antenna — simple pole + radiating element (matches Figure 4-1) */
function GroundAntenna({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {/* base */}
      <rect x="-5" y="0" width="10" height="4" rx="1" fill={color} opacity=".6" />
      {/* pole */}
      <line x1="0" y1="0" x2="0" y2="-22" stroke={color} strokeWidth="1.8" opacity=".85" />
      {/* radiating element top */}
      <line x1="-7" y1="-20" x2="7" y2="-20" stroke={color} strokeWidth="2" opacity=".9" />
      {/* small element mid */}
      <line x1="-4" y1="-14" x2="4" y2="-14" stroke={color} strokeWidth="1.4" opacity=".7" />
      {/* tip dot */}
      <circle cx="0" cy="-22" r="2" fill={color} opacity=".9" />
    </g>
  );
}

/** Runway strip */
function Runway({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="-70" y="-10" width="140" height="20" rx="2" fill="#111" opacity=".8" />
      {[-50, -30, -10, 10, 30, 50].map((dx) => (
        <rect key={dx} x={dx - 8} y="-2" width="16" height="4" rx="1" fill="#FFD700" opacity=".4" />
      ))}
    </g>
  );
}

// ── Step 1: Interrogation — expanding rings from antenna toward aircraft ───────
function Step1Scene({ color }: { color: string }) {
  const antX = 160, antY = 220, acX = 680, acY = 110;
  return (
    <g>
      <Runway x={160} y={240} />
      <GroundAntenna x={antX} y={antY} color={color} />
      <Aircraft x={acX} y={acY} scale={1} color="#d0e8f8" />

      {/* Expanding concentric rings from antenna */}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} className="ring" cx={antX} cy={antY - 11}
          r={8} fill="none" stroke={color} strokeWidth="2.5"
          style={{ animationDelay: `${i * 0.55}s` }} />
      ))}

      {/* Direction arrow overlay to show signal going toward aircraft */}
      <line x1={antX + 20} y1={antY - 20} x2={acX - 50} y2={acY + 10}
        stroke={color} strokeWidth="1" strokeDasharray="6 4" opacity=".3" />

      {/* Freq badge */}
      <g className="tls-fadein" style={{ animationDelay: ".4s" }}>
        <rect x="340" y="140" width="120" height="22" rx="5"
          fill="rgba(0,0,0,.65)" stroke={color} strokeWidth="1" />
        <text x="400" y="155" textAnchor="middle" fill={color}
          fontSize="11" fontFamily="Courier New,monospace" fontWeight="700">1030 MHz ►</text>
      </g>

      {/* Mode label */}
      <g className="tls-fadein" style={{ animationDelay: ".7s" }}>
        <rect x="340" y="170" width="120" height="18" rx="4"
          fill="rgba(0,0,0,.5)" stroke={`${color}55`} strokeWidth="1" />
        <text x="400" y="183" textAnchor="middle" fill={`${color}cc`}
          fontSize="9" fontFamily="Courier New,monospace">MODE A / MODE C</text>
      </g>
    </g>
  );
}

// ── Step 2: Transponder Reply — rings from aircraft back to antenna ────────────
function Step2Scene({ color }: { color: string }) {
  const antX = 160, antY = 220, acX = 680, acY = 110;
  return (
    <g>
      <Runway x={160} y={240} />
      <GroundAntenna x={antX} y={antY} color="#00E676" />
      <Aircraft x={acX} y={acY} scale={1} color={color} />

      {/* Expanding rings from aircraft */}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} className="ring" cx={acX} cy={acY}
          r={8} fill="none" stroke={color} strokeWidth="2.5"
          style={{ animationDelay: `${i * 0.55}s` }} />
      ))}

      {/* Direction arrow */}
      <line x1={acX - 60} y1={acY + 15} x2={antX + 25} y2={antY - 15}
        stroke={color} strokeWidth="1" strokeDasharray="6 4" opacity=".3" />

      {/* Freq badge */}
      <g className="tls-fadein" style={{ animationDelay: ".4s" }}>
        <rect x="330" y="140" width="130" height="22" rx="5"
          fill="rgba(0,0,0,.65)" stroke={color} strokeWidth="1" />
        <text x="395" y="155" textAnchor="middle" fill={color}
          fontSize="11" fontFamily="Courier New,monospace" fontWeight="700">◄ 1090 MHz</text>
      </g>

      {/* Transponder label */}
      <g className="tls-fadein" style={{ animationDelay: ".7s" }}>
        <rect x="590" y="60" width="110" height="18" rx="4"
          fill="rgba(0,0,0,.6)" stroke={`${color}55`} strokeWidth="1" />
        <text x="645" y="73" textAnchor="middle" fill={`${color}cc`}
          fontSize="9" fontFamily="Courier New,monospace">TRANSPONDER</text>
      </g>
    </g>
  );
}

// ── Step 3: Position Fix — lines from multiple sensors converging on aircraft ──
function Step3Scene({ color }: { color: string }) {
  const acX = 640, acY = 120;
  const sensors = [
    { x: 150, y: 230 },
    { x: 220, y: 255 },
    { x: 100, y: 200 },
    { x: 190, y: 270 },
  ];
  return (
    <g>
      <Runway x={170} y={250} />
      {sensors.map((s, i) => (
        <GroundAntenna key={i} x={s.x} y={s.y} color={color} />
      ))}
      <Aircraft x={acX} y={acY} scale={1} color="#d0e8f8" />

      {/* Lines from each sensor to aircraft */}
      {sensors.map((s, i) => (
        <line key={i} className="grid-line"
          x1={s.x} y1={s.y - 22} x2={acX} y2={acY}
          stroke={color} strokeWidth="1.5" opacity=".65"
          style={{ animationDelay: `${i * 0.15}s` }} />
      ))}

      {/* Crosshair at aircraft */}
      <g className="cross-pop" style={{ animationDelay: ".7s" }}>
        <line x1={acX - 24} y1={acY} x2={acX + 24} y2={acY}
          stroke={color} strokeWidth="2" />
        <line x1={acX} y1={acY - 24} x2={acX} y2={acY + 24}
          stroke={color} strokeWidth="2" />
        <circle cx={acX} cy={acY} r="9" fill="none" stroke={color} strokeWidth="1.5" />
      </g>

      {/* Position readout */}
      <g className="tls-fadein" style={{ animationDelay: ".9s" }}>
        <rect x={acX + 32} y={acY - 55} width="140" height="52" rx="5"
          fill="rgba(0,0,0,.78)" stroke={color} strokeWidth="1" />
        <text x={acX + 102} y={acY - 39} textAnchor="middle" fill={color}
          fontSize="9" fontFamily="Courier New,monospace" fontWeight="700">POSITION FIX</text>
        <text x={acX + 102} y={acY - 25} textAnchor="middle" fill="rgba(255,255,255,.7)"
          fontSize="8.5" fontFamily="Courier New,monospace">x: +0.42  y: -0.18</text>
        <text x={acX + 102} y={acY - 13} textAnchor="middle" fill="rgba(255,255,255,.7)"
          fontSize="8.5" fontFamily="Courier New,monospace">z: 1240 ft</text>
      </g>
    </g>
  );
}

// ── Step 4: Displacement Calculation ─────────────────────────────────────────
function Step4Scene({ color }: { color: string }) {
  const antX = 160, antY = 230, acX = 680, acY = 115;
  return (
    <g>
      <Runway x={160} y={248} />
      <GroundAntenna x={antX} y={antY} color={color} />

      {/* ILS beam — triangular */}
      <polygon className="beam-grow"
        points={`${antX},${antY - 4} ${antX},${antY + 4} ${acX + 30},${acY + 35} ${acX + 30},${acY - 35}`}
        fill={`${color}1a`} stroke={color} strokeWidth="1" opacity=".85" />

      {/* Centerline (ideal path) */}
      <line x1={antX} y1={antY} x2={acX + 30} y2={acY}
        stroke={color} strokeWidth="1.5" strokeDasharray="10 5" opacity=".6" />

      {/* Aircraft off path */}
      <Aircraft x={acX} y={acY + 24} scale={1} color={color} />

      {/* Deviation arrow */}
      <g className="tls-fadein" style={{ animationDelay: ".5s" }}>
        <line x1={acX} y1={acY + 24} x2={acX} y2={acY + 4}
          stroke={color} strokeWidth="2.5" />
        <polygon points={`${acX - 5},${acY + 6} ${acX + 5},${acY + 6} ${acX},${acY - 2}`}
          fill={color} />
        <text x={acX + 14} y={acY + 18} fill={color}
          fontSize="11" fontFamily="Courier New,monospace" fontWeight="700">Δ</text>
      </g>

      {/* CDI instrument */}
      <g className="tls-fadein" style={{ animationDelay: ".7s" }} transform="translate(770,155)">
        <circle cx="0" cy="0" r="58" fill="#080808" stroke={color} strokeWidth="1.5" />
        <line x1="-38" y1="0" x2="38" y2="0" stroke="rgba(255,255,255,.2)" strokeWidth="1" />
        <line x1="0" y1="-38" x2="0" y2="38" stroke="rgba(255,255,255,.2)" strokeWidth="1" />
        {[-22, -11, 11, 22].map((d) => (
          <circle key={d} cx={d} cy="0" r="2.5" fill="rgba(255,255,255,.2)" />
        ))}
        {[-22, -11, 11, 22].map((d) => (
          <circle key={d} cx="0" cy={d} r="2.5" fill="rgba(255,255,255,.2)" />
        ))}
        <rect className="needle-swing" x="-2" y="-36" width="4" height="72" rx="2" fill={color} opacity=".9" />
        <rect x="-36" y="-2" width="72" height="4" rx="2" fill={color} opacity=".55"
          style={{ transform: "rotate(10deg)", transformOrigin: "center" }} />
        <circle cx="0" cy="0" r="5" fill={color} opacity=".9" />
        <text x="0" y="70" textAnchor="middle" fill={color}
          fontSize="7.5" fontFamily="Courier New,monospace" fontWeight="700">CDI</text>
      </g>

      {/* Deviation readout */}
      <g className="tls-fadein" style={{ animationDelay: ".9s" }}>
        <rect x="330" y="50" width="170" height="52" rx="5"
          fill="rgba(0,0,0,.75)" stroke={color} strokeWidth="1" />
        <text x="415" y="68" textAnchor="middle" fill={color}
          fontSize="9" fontFamily="Courier New,monospace" fontWeight="700">DISPLACEMENT</text>
        <text x="415" y="82" textAnchor="middle" fill="rgba(255,255,255,.7)"
          fontSize="8.5" fontFamily="Courier New,monospace">LOC: +0.08°  GS: -0.12°</text>
        <text x="415" y="96" textAnchor="middle" fill="rgba(255,255,255,.45)"
          fontSize="8" fontFamily="Courier New,monospace">COMPUTING ADJUSTMENTS…</text>
      </g>
    </g>
  );
}

// ── Step 5: Course Adjustment Calculation — RCU computer screen ───────────────
function Step5Scene({ color }: { color: string }) {
  const antX = 160, antY = 230;
  return (
    <g>
      <Runway x={160} y={248} />
      <GroundAntenna x={antX} y={antY} color={color} />
      <Aircraft x={650} y={110} scale={1} color="#d0e8f8" />

      {/* RCU / Computer screen */}
      <g className="tls-fadein" transform="translate(350,130)">
        {/* outer casing */}
        <rect x="-60" y="-55" width="120" height="90" rx="6"
          fill="#0a1a0a" stroke={color} strokeWidth="1.5" opacity=".95" />
        {/* screen */}
        <rect x="-50" y="-48" width="100" height="60" rx="3"
          fill="#030d03" stroke={`${color}66`} strokeWidth="1" />
        {/* screen header */}
        <text x="0" y="-33" textAnchor="middle" fill={color}
          fontSize="7" fontFamily="Courier New,monospace" fontWeight="700">RCU PROCESSOR</text>
        {/* data lines */}
        {["LOC ADJ: -0.08°", "GS  ADJ: +0.12°", "XPDR: A4721"].map((txt, i) => (
          <text key={i} x="-44" y={-20 + i * 13} fill="rgba(255,255,255,.65)"
            fontSize="7" fontFamily="Courier New,monospace">{txt}</text>
        ))}
        {/* computing dots */}
        <text x="-10" y="22" fill={color} fontSize="7" fontFamily="Courier New,monospace">CALC</text>
        <circle className="dot1" cx="20" cy="18" r="3" fill={color} />
        <circle className="dot2" cx="28" cy="18" r="3" fill={color} />
        <circle className="dot3" cx="36" cy="18" r="3" fill={color} />
        {/* blinking cursor */}
        <rect className="rcu-blink" x="-44" y="28" width="6" height="8" rx="1" fill={color} />
        {/* base */}
        <rect x="-20" y="35" width="40" height="6" rx="2" fill={color} opacity=".4" />
      </g>

      {/* Processing arrow from antenna to RCU */}
      <line x1={antX + 10} y1={antY - 22} x2="290" y2="140"
        stroke={color} strokeWidth="1.2" strokeDasharray="6 4" opacity=".45" />

      {/* Arrow from RCU to aircraft */}
      <line x1="410" y1="130" x2="610" y2="115"
        stroke={color} strokeWidth="1.2" strokeDasharray="6 4" opacity=".45" />

      {/* Status badge */}
      <g className="tls-fadein" style={{ animationDelay: ".5s" }}>
        <rect x="490" y="55" width="170" height="22" rx="5"
          fill="rgba(0,0,0,.65)" stroke={color} strokeWidth="1" />
        <circle cx="506" cy="66" r="5" fill={color} className="tls-blink" />
        <text x="590" y="70" textAnchor="middle" fill={color}
          fontSize="10" fontFamily="Courier New,monospace" fontWeight="700">COMPUTING…</text>
      </g>
    </g>
  );
}

// ── Step 6: Guidance Signal — ILS beam + aircraft on path ────────────────────
function Step6Scene({ color }: { color: string }) {
  const antX = 160, antY = 230;
  return (
    <g>
      <Runway x={160} y={248} />
      <GroundAntenna x={antX} y={antY} color={color} />

      {/* ILS guidance beam */}
      <polygon className="guid-pulse"
        points={`${antX},${antY - 6} ${antX},${antY + 6} 820,195 820,55`}
        fill={`${color}18`} stroke={color} strokeWidth="1" />

      {/* Centerline */}
      <line x1={antX} y1={antY} x2={820} y2={125}
        stroke={color} strokeWidth="2" strokeDasharray="12 6" opacity=".65" />

      {/* Aircraft on correct path */}
      <g className="ac-glide">
        <Aircraft x={660} y={125} scale={1.05} color={color} />
      </g>

      {/* Signal ripples from antenna */}
      {[0, 1, 2].map((i) => (
        <circle key={i} className="sig-ripple"
          cx={antX} cy={antY - 11} r={5}
          fill="none" stroke={color} strokeWidth="2"
          style={{ animationDelay: `${i * 0.47}s` }} />
      ))}

      {/* ON GLIDEPATH badge */}
      <g className="tls-fadein" style={{ animationDelay: ".5s" }}>
        <rect x="460" y="55" width="160" height="22" rx="5"
          fill={`${color}18`} stroke={color} strokeWidth="1" />
        <circle cx="476" cy="66" r="5" fill={color} className="tls-blink" />
        <text x="560" y="70" textAnchor="middle" fill={color}
          fontSize="10" fontFamily="Courier New,monospace" fontWeight="700">ON GLIDEPATH</text>
      </g>

      {/* ILS / GCA info */}
      <g className="tls-fadein" style={{ animationDelay: ".8s" }}>
        <rect x="290" y="185" width="200" height="52" rx="5"
          fill="rgba(0,0,0,.75)" stroke={color} strokeWidth="1" />
        <text x="390" y="202" textAnchor="middle" fill={color}
          fontSize="9" fontFamily="Courier New,monospace" fontWeight="700">ILS GUIDANCE ACTIVE</text>
        <text x="390" y="216" textAnchor="middle" fill="rgba(255,255,255,.65)"
          fontSize="8.5" fontFamily="Courier New,monospace">LOC: 108.10 MHz</text>
        <text x="390" y="230" textAnchor="middle" fill="rgba(255,255,255,.65)"
          fontSize="8.5" fontFamily="Courier New,monospace">GS:  334.70 MHz  / GCA</text>
      </g>

      {/* CDI centered */}
      <g className="tls-fadein" style={{ animationDelay: "1s" }} transform="translate(790,155)">
        <circle cx="0" cy="0" r="50" fill="#080808" stroke={color} strokeWidth="1.5" />
        <line x1="-34" y1="0" x2="34" y2="0" stroke="rgba(255,255,255,.2)" strokeWidth="1" />
        <line x1="0" y1="-34" x2="0" y2="34" stroke="rgba(255,255,255,.2)" strokeWidth="1" />
        {[-18, -9, 9, 18].map((d) => (
          <circle key={d} cx={d} cy="0" r="2.2" fill="rgba(255,255,255,.2)" />
        ))}
        {[-18, -9, 9, 18].map((d) => (
          <circle key={d} cx="0" cy={d} r="2.2" fill="rgba(255,255,255,.2)" />
        ))}
        <rect x="-1.5" y="-30" width="3" height="60" rx="1.5" fill={color} opacity=".95" />
        <rect x="-30" y="-1.5" width="60" height="3" rx="1.5" fill={color} opacity=".7" />
        <circle cx="0" cy="0" r="5" fill={color} />
        <text x="0" y="60" textAnchor="middle" fill={color}
          fontSize="7" fontFamily="Courier New,monospace" fontWeight="700">CENTERED</text>
      </g>
    </g>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
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
    0: <Step1Scene color={step.color} />,
    1: <Step2Scene color={step.color} />,
    2: <Step3Scene color={step.color} />,
    3: <Step4Scene color={step.color} />,
    4: <Step5Scene color={step.color} />,
    5: <Step6Scene color={step.color} />,
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100dvh",
      background: BG, overflow: "hidden", fontFamily: "Courier New, monospace",
    }}>
      <style>{CSS}</style>

      {/* ── HEADER ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "7px 14px", flexShrink: 0,
        background: "rgba(3,11,24,.97)",
        borderBottom: `1px solid ${step.color}30`,
        transition: "border-color .5s",
      }}>
        <BackButton />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#d0e8f8", letterSpacing: 2 }}>
            TLS OPERATION CYCLE
          </div>
          <div style={{ fontSize: 8, color: "rgba(0,174,239,.5)", letterSpacing: 3 }}>
            FIGURE 4-1 — TECHNICAL OPERATIONAL SEQUENCE
          </div>
        </div>
        {/* Phase badge */}
        <div style={{
          padding: "3px 10px", borderRadius: 4,
          background: `${step.color}20`, border: `1px solid ${step.color}50`,
          fontSize: 9, color: step.color, letterSpacing: "0.12em",
        }}>
          {step.phase}
        </div>
        {/* Step counter */}
        <div style={{ textAlign: "center", marginLeft: 4, marginRight: 4 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: step.color, lineHeight: 1,
            textShadow: `0 0 14px ${step.color}` }}>{cur + 1}</div>
          <div style={{ fontSize: 7, color: "rgba(255,255,255,.3)", letterSpacing: 1 }}>OF 6</div>
        </div>
        {/* Pause/Play */}
        <button
          onClick={() => setPaused((p) => !p)}
          style={{
            background: "rgba(255,255,255,.05)", border: `1px solid ${step.color}40`,
            borderRadius: 6, padding: "5px 10px", cursor: "pointer",
            color: step.color, fontSize: 10, letterSpacing: "0.1em",
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
          padding: "5px 14px",
          background: `linear-gradient(90deg, ${step.color}18 0%, transparent 100%)`,
          borderBottom: `1px solid ${step.color}20`,
          borderLeft: `4px solid ${step.color}`,
          flexShrink: 0,
          display: "flex", alignItems: "center", gap: 10,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: step.color, letterSpacing: "0.15em" }}>
          STEP {step.n} — {step.label}
        </span>
        <span style={{
          fontSize: 9, padding: "2px 8px", borderRadius: 4,
          background: `${step.color}18`, border: `1px solid ${step.color}38`,
          color: step.color, letterSpacing: "0.08em",
        }}>
          {step.freq}
        </span>
      </div>

      {/* ── SVG ANIMATION SCENE ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: SURFACE }}>
        {/* Background grid */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: .35 }}
          viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: 18 }, (_, i) => (
            <line key={i} x1={i * 50} y1="0" x2={i * 50} y2={VH}
              stroke="rgba(0,174,239,.06)" strokeWidth="1" />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <line key={i} x1="0" y1={i * 50} x2={VW} y2={i * 50}
              stroke="rgba(0,174,239,.06)" strokeWidth="1" />
          ))}
        </svg>

        {/* Animated scene */}
        <svg
          key={`sc${tick}`}
          className="tls-fadein"
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <defs>
            <radialGradient id="vig2" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor={BG} stopOpacity=".45" />
            </radialGradient>
          </defs>
          {SceneMap[cur]}
          <rect x="0" y="0" width={VW} height={VH} fill="url(#vig2)" />
        </svg>

        {/* Step color glow */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          boxShadow: `inset 0 0 80px ${step.color}0d`,
          transition: "box-shadow .6s",
        }} />
      </div>

      {/* ── DESCRIPTION ── */}
      <div
        key={`d${tick}`}
        className="tls-fadein"
        style={{
          padding: "7px 14px 5px", flexShrink: 0,
          background: "rgba(3,11,24,.95)",
          borderTop: "1px solid rgba(255,255,255,.05)",
        }}
      >
        <div style={{ fontSize: 12, lineHeight: 1.55, color: "rgba(255,255,255,.88)" }}>
          {step.en}
        </div>
        <div style={{
          fontSize: 11.5, lineHeight: 1.6, color: `${step.color}dd`,
          marginTop: 3, direction: "rtl", fontWeight: 500,
          fontFamily: "Inter, sans-serif",
        }}>
          {step.ar}
        </div>
      </div>

      {/* ── PROGRESS BAR ── */}
      <div style={{ flexShrink: 0, height: 3, background: "rgba(255,255,255,.06)" }}>
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

      {/* ── STEP DOTS — split by phase ── */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: 0, padding: "7px 0 9px", flexShrink: 0,
        background: "rgba(3,11,24,.97)",
      }}>
        {/* Surveillance group */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 7, color: "rgba(255,255,255,.3)", letterSpacing: "0.08em", marginRight: 4 }}>
            SURV
          </span>
          {STEPS.slice(0, 3).map((s, idx) => (
            <button key={idx} onClick={() => goTo(idx)} title={`Step ${s.n}: ${s.label}`}
              style={{
                width: idx === cur ? 26 : 8, height: 8, borderRadius: 4, border: "none",
                cursor: "pointer", padding: 0,
                background: idx === cur ? s.color : idx < cur ? `${s.color}55` : "rgba(255,255,255,.12)",
                boxShadow: idx === cur ? `0 0 10px ${s.color}` : "none",
                transition: "all .4s ease",
              }}
            />
          ))}
        </div>

        {/* Divider */}
        <div style={{
          width: 1, height: 16, background: "rgba(255,255,255,.15)",
          margin: "0 12px",
        }} />

        {/* Guidance group */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 7, color: "rgba(255,255,255,.3)", letterSpacing: "0.08em", marginRight: 4 }}>
            GUID
          </span>
          {STEPS.slice(3).map((s, idx) => {
            const realIdx = idx + 3;
            return (
              <button key={realIdx} onClick={() => goTo(realIdx)} title={`Step ${s.n}: ${s.label}`}
                style={{
                  width: realIdx === cur ? 26 : 8, height: 8, borderRadius: 4, border: "none",
                  cursor: "pointer", padding: 0,
                  background: realIdx === cur ? s.color : realIdx < cur ? `${s.color}55` : "rgba(255,255,255,.12)",
                  boxShadow: realIdx === cur ? `0 0 10px ${s.color}` : "none",
                  transition: "all .4s ease",
                }}
              />
            );
          })}
        </div>

        <span style={{ fontSize: 7, color: "rgba(255,255,255,.2)", letterSpacing: "0.08em", marginLeft: 12 }}>
          {paused ? "PAUSED" : "AUTO"}
        </span>
      </div>
    </div>
  );
}
