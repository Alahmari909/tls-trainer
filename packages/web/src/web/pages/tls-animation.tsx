/**
 * TLS Animation — Technical Operational Sequence
 * 5-step animated SVG/CSS visualization of how TLS works
 * Dark military theme, landscape-optimised, auto-looping
 */
import { useState, useEffect, useRef, useCallback } from "react";
import BackButton from "../components/BackButton";

// ── Palette ───────────────────────────────────────────────────────────────────
const BG      = "#030b18";
const SURFACE = "#050f1e";
const GRID    = "rgba(0,174,239,0.07)";

const STEPS = [
  {
    n: 1,
    color:   "#00E676",
    label:   "INTERROGATION",
    freq:    "1030 MHz",
    en:      "TLS interrogates all aircraft transponders within the service volume.",
    ar:      "يرسل نظام TLS إشارة استجواب بتردد 1030 MHz لجميع الطائرات داخل نطاق الخدمة.",
  },
  {
    n: 2,
    color:   "#FF9500",
    label:   "TRANSPONDER REPLY",
    freq:    "1090 MHz",
    en:      "Aircraft transponders respond to the interrogation signal at 1090 MHz.",
    ar:      "يرد جهاز الإرسال (Transponder) في الطائرة على إشارة الاستجواب بتردد 1090 MHz.",
  },
  {
    n: 3,
    color:   "#00C8FF",
    label:   "POSITION FIX",
    freq:    "MLAT x,y,z",
    en:      "TLS sensors receive replies at multiple antennas and compute the aircraft position in 3D.",
    ar:      "تستقبل حساسات TLS الردود عبر أنتينات متعددة وتحسب موضع الطائرة ثلاثياً (x, y, z).",
  },
  {
    n: 4,
    color:   "#FFD700",
    label:   "DEVIATION CALC",
    freq:    "Δ CDI / GS",
    en:      "TLS computes the localizer and glide-slope needle deflections from the aircraft's position.",
    ar:      "يحسب النظام انحراف الطائرة عن مسار ILS ويحدد قيمة مؤشر CDI وزاوية الانزلاق.",
  },
  {
    n: 5,
    color:   "#00AEEF",
    label:   "ILS GUIDANCE",
    freq:    "LOC + GS",
    en:      "TLS transmits ILS-equivalent guidance signals to guide the aircraft to the correct approach path.",
    ar:      "يرسل TLS إشارة توجيه مكافئة لنظام ILS لتوجيه الطائرة إلى مسار الاقتراب الصحيح.",
  },
] as const;

const STEP_DUR = 4000; // ms per step

// ── CSS animations injected once ─────────────────────────────────────────────
const CSS = `
@keyframes tls-fadein   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@keyframes tls-prog     { from{width:0%} to{width:100%} }
@keyframes tls-pulse    { 0%,100%{opacity:.7} 50%{opacity:1} }
@keyframes tls-blink    { 0%,100%{opacity:1} 50%{opacity:.25} }

/* Step 1 — interrogation waves outward from TLS toward aircraft */
@keyframes wave-out {
  0%   { r: 0;   opacity: .9; }
  70%  { opacity: .6; }
  100% { r: 160; opacity: 0; }
}
.wave-out { animation: wave-out 1.8s ease-out infinite; }
.wave-out:nth-child(2) { animation-delay:.45s; }
.wave-out:nth-child(3) { animation-delay:.9s;  }
.wave-out:nth-child(4) { animation-delay:1.35s;}

/* Step 2 — reply waves inward from aircraft toward TLS */
@keyframes wave-in {
  0%   { r: 0;   opacity: .9; }
  70%  { opacity: .6; }
  100% { r: 160; opacity: 0; }
}
.wave-in { animation: wave-in 1.8s ease-out infinite; }
.wave-in:nth-child(2) { animation-delay:.45s; }
.wave-in:nth-child(3) { animation-delay:.9s;  }
.wave-in:nth-child(4) { animation-delay:1.35s;}

/* Step 3 — grid lines draw in */
@keyframes line-draw { from{stroke-dashoffset:400} to{stroke-dashoffset:0} }
.grid-line { stroke-dasharray:400; animation: line-draw 1.2s ease both; }

/* Step 3 — crosshair blink */
@keyframes cross-pop { 0%{opacity:0;transform:scale(.4)} 60%{opacity:1;transform:scale(1.15)} 100%{transform:scale(1)} }
.cross-pop { animation: cross-pop .6s ease both; }

/* Step 4 — beam expand */
@keyframes beam-grow { from{opacity:0;transform:scaleX(.05)} to{opacity:1;transform:scaleX(1)} }
.beam-grow { transform-origin: left center; animation: beam-grow 1.1s ease both; }

/* Step 4 — CDI needle swing */
@keyframes needle-swing { 0%{transform:rotate(-35deg)} 60%{transform:rotate(8deg)} 100%{transform:rotate(0deg)} }
.needle-swing { transform-origin: 50% 100%; animation: needle-swing 1.4s ease both; }

/* Step 5 — aircraft glide */
@keyframes ac-glide { from{transform:translate(0,18px)} to{transform:translate(0,0)} }
.ac-glide { animation: ac-glide 1.6s ease both; }

/* Step 5 — guidance beam pulse */
@keyframes guid-pulse { 0%,100%{opacity:.55} 50%{opacity:.9} }
.guid-pulse { animation: guid-pulse 1.4s ease-in-out infinite; }

/* Step 5 — signal ripple */
@keyframes sig-ripple { 0%{r:4;opacity:.9} 100%{r:22;opacity:0} }
.sig-ripple { animation: sig-ripple 1.2s ease-out infinite; }
.sig-ripple:nth-child(2){animation-delay:.4s}
.sig-ripple:nth-child(3){animation-delay:.8s}

.tls-fadein { animation: tls-fadein .55s ease both; }
.tls-pulse  { animation: tls-pulse 2s ease-in-out infinite; }
.tls-blink  { animation: tls-blink 1.1s ease-in-out infinite; }
`;

// ── Shared scene dimensions (viewBox) ────────────────────────────────────────
const VW = 900;
const VH = 340;

// Aircraft SVG path (simplified side-view silhouette)
function AircraftShape({ x, y, scale = 1, color = "#d0e8f8" }: { x: number; y: number; scale?: number; color?: string }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}>
      {/* fuselage */}
      <ellipse cx="0" cy="0" rx="38" ry="8" fill={color} opacity=".92" />
      {/* nose */}
      <ellipse cx="36" cy="-1" rx="10" ry="5" fill={color} opacity=".85" />
      {/* main wing */}
      <polygon points="-8,-8 18,-8 6,14 -18,14" fill={color} opacity=".88" />
      {/* tail fin */}
      <polygon points="-32,-8 -22,-8 -28,-22 -36,-8" fill={color} opacity=".8" />
      {/* horizontal stabilizer */}
      <polygon points="-30,0 -20,0 -24,8 -34,8" fill={color} opacity=".75" />
      {/* engine pod */}
      <ellipse cx="4" cy="12" rx="10" ry="4" fill={color} opacity=".6" />
    </g>
  );
}

// TLS ground station — realistic layout:
// main mast with guy wires + equipment container + 2 cross-dipole antennas
function TLSStation({ x, y }: { x: number; y: number }) {
  const c = "#00E676";
  return (
    <g transform={`translate(${x},${y})`}>

      {/* ── Equipment container (shelter) ── */}
      <rect x="-22" y="-8" width="44" height="18" rx="2"
        fill="#1c2e1c" stroke={c} strokeWidth="1" opacity=".9" />
      {/* container panel lines */}
      {[-12, -4, 4, 12].map((dx) => (
        <line key={dx} x1={dx} y1="-8" x2={dx} y2="10"
          stroke={c} strokeWidth=".4" opacity=".35" />
      ))}
      {/* container label */}
      <text x="0" y="4" textAnchor="middle" fill={c}
        fontSize="5.5" fontFamily="Courier New,monospace" fontWeight="700" letterSpacing=".5"
        opacity=".8">SHELTER</text>

      {/* ── Main mast (tall, thin) ── */}
      <rect x="-1.5" y="-58" width="3" height="50"
        fill={c} opacity=".85" />
      {/* mast cross-bar at top */}
      <line x1="-10" y1="-56" x2="10" y2="-56"
        stroke={c} strokeWidth="1.5" opacity=".8" />
      {/* mast cross-bar mid */}
      <line x1="-7" y1="-44" x2="7" y2="-44"
        stroke={c} strokeWidth="1" opacity=".6" />
      {/* antenna element at top */}
      <line x1="0" y1="-58" x2="0" y2="-66"
        stroke={c} strokeWidth="1.5" opacity=".9" />
      <line x1="-5" y1="-63" x2="5" y2="-63"
        stroke={c} strokeWidth="1.5" opacity=".9" />

      {/* ── Guy wires (3 directions) ── */}
      <line x1="0" y1="-52" x2="-36" y2="-2"
        stroke={c} strokeWidth=".8" strokeDasharray="3 2" opacity=".45" />
      <line x1="0" y1="-52" x2="36" y2="-2"
        stroke={c} strokeWidth=".8" strokeDasharray="3 2" opacity=".45" />
      <line x1="0" y1="-52" x2="0" y2="-2"
        stroke={c} strokeWidth=".8" strokeDasharray="3 2" opacity=".3" />
      {/* guy wire anchors */}
      <circle cx="-36" cy="-2" r="2" fill={c} opacity=".5" />
      <circle cx="36" cy="-2" r="2" fill={c} opacity=".5" />

      {/* ── Cross-dipole antenna A (left, on ground) ── */}
      <g transform="translate(-44, -4)">
        {/* vertical pole */}
        <line x1="0" y1="0" x2="0" y2="-18"
          stroke={c} strokeWidth="1.2" opacity=".8" />
        {/* horizontal arm top */}
        <line x1="-8" y1="-16" x2="8" y2="-16"
          stroke={c} strokeWidth="1.2" opacity=".8" />
        {/* horizontal arm mid */}
        <line x1="-6" y1="-10" x2="6" y2="-10"
          stroke={c} strokeWidth="1" opacity=".65" />
        {/* base plate */}
        <rect x="-4" y="0" width="8" height="3" rx="1"
          fill={c} opacity=".5" />
        <text x="0" y="10" textAnchor="middle" fill={c}
          fontSize="5" fontFamily="Courier New,monospace" opacity=".6">ANT</text>
      </g>

      {/* ── Cross-dipole antenna B (right, on ground) ── */}
      <g transform="translate(44, -4)">
        <line x1="0" y1="0" x2="0" y2="-18"
          stroke={c} strokeWidth="1.2" opacity=".8" />
        <line x1="-8" y1="-16" x2="8" y2="-16"
          stroke={c} strokeWidth="1.2" opacity=".8" />
        <line x1="-6" y1="-10" x2="6" y2="-10"
          stroke={c} strokeWidth="1" opacity=".65" />
        <rect x="-4" y="0" width="8" height="3" rx="1"
          fill={c} opacity=".5" />
        <text x="0" y="10" textAnchor="middle" fill={c}
          fontSize="5" fontFamily="Courier New,monospace" opacity=".6">ANT</text>
      </g>

      {/* ── TLS label ── */}
      <text x="0" y="22" textAnchor="middle" fill={c}
        fontSize="9" fontFamily="Courier New,monospace" fontWeight="700" letterSpacing="1"
        style={{ filter: `drop-shadow(0 0 4px ${c})` }}>TLS</text>
    </g>
  );
}

// Runway
function Runway({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="-60" y="-14" width="120" height="28" rx="2" fill="#1a1a1a" opacity=".85" />
      {/* centerline dashes */}
      {[-40, -20, 0, 20, 40].map((dx) => (
        <rect key={dx} x={dx - 8} y="-2" width="16" height="4" rx="1" fill="#FFD700" opacity=".5" />
      ))}
      {/* threshold markings */}
      <rect x="-58" y="-12" width="6" height="24" rx="1" fill="#fff" opacity=".3" />
      <rect x="52" y="-12" width="6" height="24" rx="1" fill="#fff" opacity=".3" />
    </g>
  );
}

// ── Step Scenes ───────────────────────────────────────────────────────────────

function Step1Scene({ color }: { color: string }) {
  return (
    <g>
      {/* Background grid */}
      <line x1="0" y1="0" x2={VW} y2={VH} stroke={GRID} strokeWidth="1" />
      {/* Runway */}
      <Runway x={180} y={260} />
      {/* TLS station */}
      <TLSStation x={180} y={230} />
      {/* Aircraft far right, high */}
      <AircraftShape x={720} y={100} scale={1.1} color="#d0e8f8" />
      {/* Interrogation waves — arcs expanding from TLS toward aircraft */}
      <g>
        {[0, 1, 2, 3].map((i) => (
          <circle
            key={i}
            className="wave-out"
            cx={180} cy={225}
            r={0}
            fill="none"
            stroke={color}
            strokeWidth="2"
            style={{ animationDelay: `${i * 0.45}s` }}
          />
        ))}
      </g>
      {/* Directional arrow from TLS to aircraft */}
      <line x1="200" y1="215" x2="690" y2="115" stroke={color} strokeWidth="1.5" strokeDasharray="8 5" opacity=".4" />
      {/* Freq label */}
      <g className="tls-fadein" style={{ animationDelay: ".3s" }}>
        <rect x="350" y="130" width="110" height="22" rx="5" fill="rgba(0,0,0,.6)" stroke={color} strokeWidth="1" />
        <text x="405" y="145" textAnchor="middle" fill={color} fontSize="11" fontFamily="Courier New,monospace" fontWeight="700">1030 MHz ►</text>
      </g>
    </g>
  );
}

function Step2Scene({ color }: { color: string }) {
  return (
    <g>
      <Runway x={180} y={260} />
      <TLSStation x={180} y={230} />
      <AircraftShape x={720} y={100} scale={1.1} color="#FF9500" />
      {/* Reply waves from aircraft back to TLS */}
      <g>
        {[0, 1, 2, 3].map((i) => (
          <circle
            key={i}
            className="wave-in"
            cx={720} cy={100}
            r={0}
            fill="none"
            stroke={color}
            strokeWidth="2"
            style={{ animationDelay: `${i * 0.45}s` }}
          />
        ))}
      </g>
      {/* Dashed return line */}
      <line x1="690" y1="110" x2="205" y2="218" stroke={color} strokeWidth="1.5" strokeDasharray="8 5" opacity=".45" />
      {/* Freq label */}
      <g className="tls-fadein" style={{ animationDelay: ".3s" }}>
        <rect x="350" y="130" width="120" height="22" rx="5" fill="rgba(0,0,0,.6)" stroke={color} strokeWidth="1" />
        <text x="410" y="145" textAnchor="middle" fill={color} fontSize="11" fontFamily="Courier New,monospace" fontWeight="700">◄ 1090 MHz</text>
      </g>
      {/* Transponder label on aircraft */}
      <g className="tls-fadein" style={{ animationDelay: ".6s" }}>
        <rect x="630" y="60" width="100" height="18" rx="4" fill="rgba(0,0,0,.65)" stroke={color} strokeWidth="1" />
        <text x="680" y="73" textAnchor="middle" fill={color} fontSize="9.5" fontFamily="Courier New,monospace" fontWeight="700">TRANSPONDER</text>
      </g>
    </g>
  );
}

function Step3Scene({ color }: { color: string }) {
  const delays = [0, 0.15, 0.3, 0.45, 0.6, 0.75];
  // Grid lines converging on aircraft position
  const acX = 680, acY = 130;
  const antennas = [
    { x: 180, y: 230 },
    { x: 280, y: 270 },
    { x: 120, y: 200 },
    { x: 230, y: 290 },
  ];
  return (
    <g>
      <Runway x={180} y={260} />
      <TLSStation x={180} y={230} />
      {/* Multiple antennas */}
      {antennas.slice(1).map((a, i) => (
        <g key={i} transform={`translate(${a.x},${a.y})`}>
          <rect x="-6" y="-16" width="12" height="16" fill="#0d2a0d" stroke={color} strokeWidth="1" opacity=".7" />
          <line x1="-8" y1="-16" x2="8" y2="-16" stroke={color} strokeWidth="1.5" opacity=".8" />
          <text x="0" y="8" textAnchor="middle" fill={color} fontSize="7" fontFamily="Courier New,monospace" opacity=".7">ANT</text>
        </g>
      ))}
      {/* Lines from each antenna to aircraft */}
      {antennas.map((a, i) => (
        <line
          key={i}
          className="grid-line"
          x1={a.x} y1={a.y - 20}
          x2={acX} y2={acY}
          stroke={color}
          strokeWidth="1.5"
          opacity=".7"
          style={{ animationDelay: `${delays[i]}s` }}
        />
      ))}
      {/* Perspective grid */}
      {[0, 1, 2, 3].map((i) => (
        <line
          key={`h${i}`}
          className="grid-line"
          x1={300 + i * 120} y1={80}
          x2={300 + i * 120} y2={VH - 40}
          stroke={color}
          strokeWidth=".8"
          opacity=".2"
          style={{ animationDelay: `${0.5 + i * 0.1}s` }}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <line
          key={`v${i}`}
          className="grid-line"
          x1={280} y1={80 + i * 70}
          x2={VW - 60} y2={80 + i * 70}
          stroke={color}
          strokeWidth=".8"
          opacity=".2"
          style={{ animationDelay: `${0.5 + i * 0.1}s` }}
        />
      ))}
      {/* Aircraft */}
      <AircraftShape x={acX} y={acY} scale={1.1} color="#d0e8f8" />
      {/* Crosshair at aircraft */}
      <g className="cross-pop" style={{ animationDelay: ".8s" }}>
        <line x1={acX - 22} y1={acY} x2={acX + 22} y2={acY} stroke={color} strokeWidth="2" />
        <line x1={acX} y1={acY - 22} x2={acX} y2={acY + 22} stroke={color} strokeWidth="2" />
        <circle cx={acX} cy={acY} r="8" fill="none" stroke={color} strokeWidth="1.5" />
      </g>
      {/* Position readout */}
      <g className="tls-fadein" style={{ animationDelay: "1s" }}>
        <rect x={acX + 30} y={acY - 50} width="130" height="46" rx="5" fill="rgba(0,0,0,.75)" stroke={color} strokeWidth="1" />
        <text x={acX + 95} y={acY - 34} textAnchor="middle" fill={color} fontSize="9" fontFamily="Courier New,monospace" fontWeight="700">POSITION FIX</text>
        <text x={acX + 95} y={acY - 20} textAnchor="middle" fill="rgba(255,255,255,.7)" fontSize="9" fontFamily="Courier New,monospace">x:+0.42  y:-0.18</text>
        <text x={acX + 95} y={acY - 8} textAnchor="middle" fill="rgba(255,255,255,.7)" fontSize="9" fontFamily="Courier New,monospace">z: 1240 ft</text>
      </g>
    </g>
  );
}

function Step4Scene({ color }: { color: string }) {
  // ILS beam from TLS toward aircraft — triangular beam
  const tlsX = 180, tlsY = 240;
  const acX  = 700, acY  = 110;
  return (
    <g>
      <Runway x={180} y={260} />
      <TLSStation x={180} y={230} />
      {/* ILS glide beam — triangular fill */}
      <polygon
        className="beam-grow"
        points={`${tlsX},${tlsY - 4} ${tlsX},${tlsY + 4} ${acX + 30},${acY + 30} ${acX + 30},${acY - 30}`}
        fill={`${color}22`}
        stroke={color}
        strokeWidth="1"
        opacity=".85"
      />
      {/* Centerline (ideal path) */}
      <line
        className="tls-fadein"
        x1={tlsX} y1={tlsY}
        x2={acX + 30} y2={acY}
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray="10 5"
        opacity=".7"
      />
      {/* Aircraft — slightly off path */}
      <AircraftShape x={acX} y={acY + 22} scale={1.1} color="#FFD700" />
      {/* Deviation arrow */}
      <g className="tls-fadein" style={{ animationDelay: ".5s" }}>
        <line x1={acX} y1={acY + 22} x2={acX} y2={acY} stroke={color} strokeWidth="2" markerEnd={`url(#arr-${color.replace('#','')})`} />
        <text x={acX + 14} y={acY + 14} fill={color} fontSize="10" fontFamily="Courier New,monospace" fontWeight="700">Δ</text>
      </g>
      {/* CDI instrument (simplified SVG) */}
      <g className="tls-fadein" style={{ animationDelay: ".7s" }} transform="translate(760,160)">
        <circle cx="0" cy="0" r="60" fill="#0a0a0a" stroke={color} strokeWidth="1.5" />
        <circle cx="0" cy="0" r="55" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="1" />
        {/* CDI cross */}
        <line x1="-40" y1="0" x2="40" y2="0" stroke="rgba(255,255,255,.3)" strokeWidth="1" />
        <line x1="0" y1="-40" x2="0" y2="40" stroke="rgba(255,255,255,.3)" strokeWidth="1" />
        {/* Localizer dots */}
        {[-24, -12, 12, 24].map((dx) => (
          <circle key={dx} cx={dx} cy="0" r="3" fill="rgba(255,255,255,.25)" />
        ))}
        {/* Glide slope dots */}
        {[-24, -12, 12, 24].map((dy) => (
          <circle key={dy} cx="0" cy={dy} r="3" fill="rgba(255,255,255,.25)" />
        ))}
        {/* LOC needle — deflected */}
        <rect className="needle-swing" x="-2" y="-38" width="4" height="76" rx="2" fill={color} opacity=".9" />
        {/* GS needle — deflected */}
        <rect x="-38" y="-2" width="76" height="4" rx="2" fill={color} opacity=".6" style={{ transform: "rotate(8deg)", transformOrigin: "center" }} />
        {/* Center dot */}
        <circle cx="0" cy="0" r="5" fill={color} opacity=".9" />
        {/* Label */}
        <text x="0" y="72" textAnchor="middle" fill={color} fontSize="8" fontFamily="Courier New,monospace" fontWeight="700">CDI</text>
      </g>
      {/* Deviation readout */}
      <g className="tls-fadein" style={{ animationDelay: ".9s" }}>
        <rect x="360" y="50" width="160" height="52" rx="5" fill="rgba(0,0,0,.75)" stroke={color} strokeWidth="1" />
        <text x="440" y="68" textAnchor="middle" fill={color} fontSize="9" fontFamily="Courier New,monospace" fontWeight="700">DEVIATION</text>
        <text x="440" y="82" textAnchor="middle" fill="rgba(255,255,255,.7)" fontSize="9" fontFamily="Courier New,monospace">LOC: +0.08°  GS: -0.12°</text>
        <text x="440" y="96" textAnchor="middle" fill="rgba(255,255,255,.5)" fontSize="8" fontFamily="Courier New,monospace">COMPUTING ILS SIGNAL…</text>
      </g>
      {/* Arrow defs */}
      <defs>
        <marker id={`arr-${color.replace('#','')}`} markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill={color} />
        </marker>
      </defs>
    </g>
  );
}

function Step5Scene({ color }: { color: string }) {
  const tlsX = 180, tlsY = 240;
  return (
    <g>
      <Runway x={180} y={260} />
      <TLSStation x={180} y={230} />
      {/* ILS guidance beam */}
      <polygon
        className="guid-pulse"
        points={`${tlsX},${tlsY - 6} ${tlsX},${tlsY + 6} 820,190 820,60`}
        fill={`${color}18`}
        stroke={color}
        strokeWidth="1"
      />
      {/* Centerline */}
      <line
        x1={tlsX} y1={tlsY}
        x2={820} y2={125}
        stroke={color}
        strokeWidth="2"
        strokeDasharray="12 6"
        opacity=".7"
      />
      {/* Aircraft on correct path */}
      <g className="ac-glide">
        <AircraftShape x={680} y={125} scale={1.15} color="#00AEEF" />
      </g>
      {/* Signal ripple from TLS */}
      <g>
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            className="sig-ripple"
            cx={tlsX} cy={tlsY}
            r={4}
            fill="none"
            stroke={color}
            strokeWidth="2"
            style={{ animationDelay: `${i * 0.4}s` }}
          />
        ))}
      </g>
      {/* ON GLIDEPATH badge */}
      <g className="tls-fadein" style={{ animationDelay: ".5s" }}>
        <rect x="480" y="60" width="150" height="22" rx="5" fill="rgba(0,174,239,.15)" stroke={color} strokeWidth="1" />
        <circle cx="496" cy="71" r="5" fill={color} className="tls-blink" />
        <text x="575" y="75" textAnchor="middle" fill={color} fontSize="10" fontFamily="Courier New,monospace" fontWeight="700">ON GLIDEPATH</text>
      </g>
      {/* ILS signal info */}
      <g className="tls-fadein" style={{ animationDelay: ".8s" }}>
        <rect x="310" y="180" width="200" height="56" rx="5" fill="rgba(0,0,0,.75)" stroke={color} strokeWidth="1" />
        <text x="410" y="197" textAnchor="middle" fill={color} fontSize="9" fontFamily="Courier New,monospace" fontWeight="700">ILS GUIDANCE ACTIVE</text>
        <text x="410" y="211" textAnchor="middle" fill="rgba(255,255,255,.65)" fontSize="9" fontFamily="Courier New,monospace">LOC: 108.10 MHz</text>
        <text x="410" y="225" textAnchor="middle" fill="rgba(255,255,255,.65)" fontSize="9" fontFamily="Courier New,monospace">GS:  334.70 MHz</text>
      </g>
      {/* Cockpit instrument indicator */}
      <g className="tls-fadein" style={{ animationDelay: "1s" }} transform="translate(800,160)">
        <circle cx="0" cy="0" r="52" fill="#080808" stroke={color} strokeWidth="1.5" />
        <line x1="-35" y1="0" x2="35" y2="0" stroke="rgba(255,255,255,.25)" strokeWidth="1" />
        <line x1="0" y1="-35" x2="0" y2="35" stroke="rgba(255,255,255,.25)" strokeWidth="1" />
        {[-20, -10, 10, 20].map((d) => (
          <circle key={`lx${d}`} cx={d} cy="0" r="2.5" fill="rgba(255,255,255,.2)" />
        ))}
        {[-20, -10, 10, 20].map((d) => (
          <circle key={`ly${d}`} cx="0" cy={d} r="2.5" fill="rgba(255,255,255,.2)" />
        ))}
        {/* Centered needles */}
        <rect x="-1.5" y="-32" width="3" height="64" rx="1.5" fill={color} opacity=".95" />
        <rect x="-32" y="-1.5" width="64" height="3" rx="1.5" fill={color} opacity=".7" />
        <circle cx="0" cy="0" r="5" fill={color} />
        <text x="0" y="63" textAnchor="middle" fill={color} fontSize="7" fontFamily="Courier New,monospace" fontWeight="700">CENTERED</text>
      </g>
    </g>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function TLSAnimation() {
  const [cur, setCur]     = useState(0);
  const [tick, setTick]   = useState(0);
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
    if (!paused) startTimer(); // reset timer
  };

  const step = STEPS[cur];

  const SceneMap: Record<number, JSX.Element> = {
    0: <Step1Scene color={step.color} />,
    1: <Step2Scene color={step.color} />,
    2: <Step3Scene color={step.color} />,
    3: <Step4Scene color={step.color} />,
    4: <Step5Scene color={step.color} />,
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
        padding: "8px 14px", flexShrink: 0,
        background: "rgba(3,11,24,0.97)",
        borderBottom: `1px solid ${step.color}30`,
        transition: "border-color 0.5s",
      }}>
        <BackButton />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#d0e8f8", letterSpacing: 2 }}>TLS OPERATION</div>
          <div style={{ fontSize: 8, color: "rgba(0,174,239,.5)", letterSpacing: 3 }}>TECHNICAL OPERATIONAL SEQUENCE</div>
        </div>
        {/* Step counter */}
        <div style={{ textAlign: "center", marginRight: 4 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: step.color, lineHeight: 1, textShadow: `0 0 14px ${step.color}` }}>
            {cur + 1}
          </div>
          <div style={{ fontSize: 7, color: "rgba(255,255,255,.35)", letterSpacing: 1 }}>OF 5</div>
        </div>
        {/* Pause/Play */}
        <button
          onClick={() => setPaused((p) => !p)}
          style={{
            background: "rgba(255,255,255,.05)", border: `1px solid ${step.color}40`,
            borderRadius: 6, padding: "5px 10px", cursor: "pointer",
            color: step.color, fontSize: 10, letterSpacing: "0.1em",
            transition: "all 0.2s",
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
          padding: "6px 14px",
          background: `linear-gradient(90deg, ${step.color}1a 0%, transparent 100%)`,
          borderBottom: `1px solid ${step.color}22`,
          borderLeft: `4px solid ${step.color}`,
          flexShrink: 0,
          display: "flex", alignItems: "center", gap: 12,
          transition: "border-color 0.4s",
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: step.color, letterSpacing: "0.15em" }}>
          STEP {step.n} — {step.label}
        </span>
        <span style={{
          fontSize: 9, padding: "2px 8px", borderRadius: 4,
          background: `${step.color}20`, border: `1px solid ${step.color}40`,
          color: step.color, letterSpacing: "0.1em",
        }}>
          {step.freq}
        </span>
      </div>

      {/* ── SVG ANIMATION SCENE ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: SURFACE }}>
        {/* Subtle background grid */}
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.4 }}
          preserveAspectRatio="xMidYMid slice"
          viewBox={`0 0 ${VW} ${VH}`}
        >
          {Array.from({ length: 18 }, (_, i) => (
            <line key={`bg-v${i}`} x1={i * 50} y1="0" x2={i * 50} y2={VH} stroke={GRID} strokeWidth="1" />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <line key={`bg-h${i}`} x1="0" y1={i * 50} x2={VW} y2={i * 50} stroke={GRID} strokeWidth="1" />
          ))}
        </svg>

        {/* Main animated scene */}
        <svg
          key={`scene${tick}`}
          className="tls-fadein"
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          {/* Subtle vignette */}
          <defs>
            <radialGradient id="vig" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor={BG} stopOpacity=".5" />
            </radialGradient>
          </defs>

          {SceneMap[cur]}

          {/* Vignette overlay */}
          <rect x="0" y="0" width={VW} height={VH} fill="url(#vig)" />
        </svg>

        {/* Step color inner glow */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          boxShadow: `inset 0 0 80px ${step.color}10`,
          transition: "box-shadow 0.6s",
        }} />
      </div>

      {/* ── DESCRIPTION ── */}
      <div
        key={`d${tick}`}
        className="tls-fadein"
        style={{
          padding: "8px 14px 6px", flexShrink: 0,
          background: "rgba(3,11,24,.95)",
          borderTop: `1px solid rgba(255,255,255,.06)`,
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

      {/* ── STEP DOTS ── */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: 8, padding: "8px 0 10px", flexShrink: 0,
        background: "rgba(3,11,24,.97)",
      }}>
        {STEPS.map((s, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            title={`Step ${s.n}: ${s.label}`}
            style={{
              width: idx === cur ? 28 : 8,
              height: 8,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              background: idx === cur
                ? s.color
                : idx < cur
                  ? `${s.color}55`
                  : "rgba(255,255,255,.12)",
              boxShadow: idx === cur ? `0 0 10px ${s.color}` : "none",
              transition: "all 0.4s ease",
              padding: 0,
            }}
          />
        ))}
        <span style={{ fontSize: 8, color: "rgba(255,255,255,.25)", letterSpacing: "0.1em", marginLeft: 8 }}>
          {paused ? "PAUSED" : "AUTO"}
        </span>
      </div>
    </div>
  );
}
