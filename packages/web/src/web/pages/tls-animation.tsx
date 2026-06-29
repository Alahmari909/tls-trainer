import { useState, useEffect } from "react";
import BackButton from "../components/BackButton";

/* ── palette ─────────────────────────────────────────────────────── */
const BG   = "#050d1c";
const BLUE = "#1a90d9";

/* ── CSS (injected once) ─────────────────────────────────────────── */
const CSS = `
/* step fade */
@keyframes step-in  { from { opacity:0; transform:scale(0.97) } to { opacity:1; transform:scale(1) } }
@keyframes step-out { from { opacity:1 } to { opacity:0 } }
.stp-in  { animation: step-in  0.7s ease both; }
.stp-out { animation: step-out 0.5s ease both; }

/* progress bar */
@keyframes prog { from{width:0} to{width:100%} }
.pbar { animation: prog 10s linear forwards; }

/* ── Step 1: green cone from TLS to aircraft ─── */
@keyframes cone-pulse {
  0%,100% { opacity:0.55; }
  50%      { opacity:1;    }
}
.cone-pulse { animation: cone-pulse 1.8s ease-in-out infinite; }

/* ── Step 2: pink rings from aircraft ─── */
@keyframes ring-out {
  0%   { r:8;  opacity:0.85; stroke-width:2.5; }
  100% { r:72; opacity:0;    stroke-width:0.5; }
}
.ring { animation: ring-out 3s ease-out infinite; }
.ring.r1 { animation-delay:0s;    }
.ring.r2 { animation-delay:0.75s; }
.ring.r3 { animation-delay:1.5s;  }
.ring.r4 { animation-delay:2.25s; }

/* ── Step 3: rings inward toward TLS ─── */
@keyframes ring-in {
  0%   { r:65; opacity:0;    stroke-width:0.5; }
  100% { r:6;  opacity:0.85; stroke-width:2;   }
}
.ring-in { animation: ring-in 3s ease-in infinite; }
.ring-in.r1 { animation-delay:0s;    }
.ring-in.r2 { animation-delay:0.75s; }
.ring-in.r3 { animation-delay:1.5s;  }

/* ── Step 4: glide slope approach ─── */
@keyframes disp-bounce {
  0%,100% { transform:translateY(0px);   }
  50%      { transform:translateY(-10px); }
}
.ac-bounce { animation: disp-bounce 2.5s ease-in-out infinite; }
@keyframes arrow-blink { 0%,100%{opacity:0.2} 50%{opacity:1} }
.arr-blink { animation: arrow-blink 1s ease-in-out infinite; }

/* ── Step 5: red beam TLS→aircraft ─── */
@keyframes beam-pulse {
  0%,100% { opacity:0.2; stroke-width:1;   }
  50%      { opacity:1;   stroke-width:3; }
}
.beam  { animation: beam-pulse 2s ease-in-out infinite; }
.beam2 { animation: beam-pulse 2s ease-in-out infinite; animation-delay:0.3s; }
.beam3 { animation: beam-pulse 2s ease-in-out infinite; animation-delay:0.6s; }

/* cockpit instrument needle */
@keyframes needle-s {
  0%,100% { transform:rotate(-12deg); }
  50%      { transform:rotate(10deg); }
}
.inst-needle { transform-origin:50% 83%; animation:needle-s 3s ease-in-out infinite; }

/* scan line step 3 */
@keyframes scan-sweep {
  0%,100% { transform:translateY(-28px); opacity:0.5; }
  50%      { transform:translateY(28px);  opacity:1;   }
}
.scan { animation: scan-sweep 2s ease-in-out infinite; }
`;

/* ═══════════════════════════════════════════════════════════════════
   SVG BUILDING BLOCKS
   All viewBox = "0 0 320 200"
═══════════════════════════════════════════════════════════════════ */

/* ── 3-D Runway ─────────────────────────────────────────────────── */
function Runway({ flip = false }: { flip?: boolean }) {
  /* perspective trapezoid: near-bottom wide, far-top narrow */
  /* base along bottom of viewBox, vanishing toward top-right */
  const pts = flip
    ? "20,185 100,185 280,120 220,120"   // runway going right→left (aircraft approaching from right)
    : "20,185 100,185 280,130 220,130";  // normal: left (near TLS) to right
  return (
    <g>
      {/* runway surface */}
      <polygon points={pts} fill="#0e2a4a" opacity={0.9}/>
      <polygon points={pts} fill="none" stroke="#1a5a8a" strokeWidth={1}/>
      {/* centerline dashes — approximate */}
      {[0.25,0.40,0.55,0.70,0.85].map((t,i) => {
        /* lerp endpoints */
        const x1 = flip ? 100+(220-100)*t     : 100+(280-100)*t;
        const y1 = flip ? 185+(120-185)*t      : 185+(130-185)*t;
        const x2 = flip ? 100+(220-100)*(t+0.07) : 100+(280-100)*(t+0.07);
        const y2 = flip ? 185+(120-185)*(t+0.07): 185+(130-185)*(t+0.07);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5}/>;
      })}
      {/* runway edge lines */}
      <polygon points={pts} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={0.8}/>
    </g>
  );
}

/* ── TLS Ground Unit ────────────────────────────────────────────── */
function TLSUnit({ x, y, scale = 1, color = "#00AEEF" }: { x:number; y:number; scale?:number; color?:string }) {
  const s = scale;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      {/* base/legs */}
      <rect x={-14} y={8} width={28} height={6} rx={2} fill="#1a3a5c" stroke={color} strokeWidth={0.8}/>
      <rect x={-9} y={14} width={4} height={5} fill="#0d2236"/>
      <rect x={5} y={14} width={4} height={5} fill="#0d2236"/>
      {/* main body */}
      <rect x={-10} y={-2} width={20} height={12} rx={2} fill="#0d2236" stroke={color} strokeWidth={1}/>
      {/* antenna dish */}
      <ellipse cx={0} cy={-8} rx={10} ry={4} fill="none" stroke={color} strokeWidth={1.2}/>
      <line x1={0} y1={-4} x2={0} y2={-2} stroke={color} strokeWidth={1}/>
      {/* indicator lights */}
      <circle cx={-5} cy={3} r={1.5} fill={color} opacity={0.8}/>
      <circle cx={0}  cy={3} r={1.5} fill="#00D26A" opacity={0.7}/>
      <circle cx={5}  cy={3} r={1.5} fill={color} opacity={0.6}/>
      {/* label */}
      <text x={0} y={24} textAnchor="middle" fill={color} fontSize={7} fontFamily="Courier New,monospace" fontWeight="bold">TLS</text>
    </g>
  );
}

/* ── Commercial Aircraft (side silhouette) ──────────────────────── */
function Aircraft({ x, y, scale = 1, color = "#c8dff0", flip = false }:
  { x:number; y:number; scale?:number; color?:string; flip?:boolean }) {
  const s = scale * (flip ? -1 : 1);
  return (
    <g transform={`translate(${x},${y}) scale(${s},${scale})`}>
      {/* fuselage */}
      <ellipse cx={0} cy={0} rx={32} ry={7} fill="#1a3a5c" stroke={color} strokeWidth={1}/>
      {/* nose cone */}
      <path d="M 32,-3 Q 48,0 32,3 Z" fill={color} opacity={0.85}/>
      {/* tail */}
      <path d="M -32,-3 L -28,-3 L -28,-18 Q -36,-18 -38,-10 L -38,-3 Z" fill="#1a3a5c" stroke={color} strokeWidth={0.8}/>
      {/* main wing */}
      <path d="M -5,-7 L 18,-7 L 22,16 L -10,16 Z" fill="#1e4570" stroke={color} strokeWidth={0.7}/>
      {/* tail wing */}
      <path d="M -28,-3 L -20,-3 L -18,8 L -30,8 Z" fill="#1e4570" stroke={color} strokeWidth={0.6}/>
      {/* engines */}
      <ellipse cx={8}  cy={18} rx={6} ry={3} fill="#0d2236" stroke={color} strokeWidth={0.8}/>
      <ellipse cx={-8} cy={18} rx={5} ry={2.5} fill="#0d2236" stroke={color} strokeWidth={0.7}/>
      {/* windows row */}
      {[-10,-4,2,8,14,20].map((wx,i) => (
        <rect key={i} x={wx} y={-3} width={4} height={3} rx={1} fill="rgba(180,230,255,0.6)"/>
      ))}
    </g>
  );
}

/* ── Star background ─────────────────────────────────────────────── */
function Stars() {
  const pts = [
    [20,15],[60,8],[130,20],[200,5],[270,12],[300,25],[50,40],[180,30],[250,45],
    [10,60],[90,55],[160,65],[230,50],[290,70],[40,85],[140,80],[210,90],[280,80],
    [70,100],[190,105],[260,95],[15,110],[100,120],[170,115],[240,125],[310,100],
  ];
  return (
    <g>
      {pts.map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r={0.6+((i*7)%5)*0.2}
          fill={`rgba(255,255,255,${0.25+((i*3)%5)*0.1})`}/>
      ))}
    </g>
  );
}

/* ═══ SCENE 1 — TLS interrogates (green cone) ═══════════════════ */
function Scene1() {
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
      <rect width={320} height={200} fill={BG}/>
      <Stars/>
      <Runway/>
      <TLSUnit x={55} y={162} scale={1.1} color="#00D26A"/>
      <Aircraft x={240} y={90} scale={1.05} color="#b0d8f0"/>
      {/* green cone beam from TLS dish to aircraft */}
      <g className="cone-pulse">
        <polygon points="55,155 240,74 240,106" fill="rgba(0,210,106,0.22)"/>
        <line x1={55} y1={155} x2={240} y2={74}  stroke="#00D26A" strokeWidth={1.5} opacity={0.8}/>
        <line x1={55} y1={155} x2={240} y2={106} stroke="#00D26A" strokeWidth={1.5} opacity={0.8}/>
        {/* dashed center beam */}
        <line x1={55} y1={155} x2={240} y2={90}
          stroke="#00D26A" strokeWidth={2.5} strokeDasharray="8 5" opacity={0.9}/>
      </g>
      {/* freq label */}
      <rect x={100} y={125} width={78} height={18} rx={4} fill="rgba(0,210,106,0.15)" stroke="rgba(0,210,106,0.4)" strokeWidth={0.8}/>
      <text x={139} y={137} textAnchor="middle" fill="#00D26A" fontSize={9} fontFamily="Courier New,monospace">1030 MHz ►</text>
    </svg>
  );
}

/* ═══ SCENE 2 — Aircraft responds (pink rings from aircraft) ═════ */
function Scene2() {
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
      <rect width={320} height={200} fill={BG}/>
      <Stars/>
      <Runway/>
      <TLSUnit x={55} y={162} scale={1.1} color="#00AEEF"/>
      <Aircraft x={230} y={88} scale={1.05} color="#c8d8f0"/>
      {/* pink expanding rings from aircraft */}
      <circle className="ring r1" cx={230} cy={88} r={8}  stroke="#e040a0" fill="none" strokeWidth={2.5}/>
      <circle className="ring r2" cx={230} cy={88} r={8}  stroke="#e040a0" fill="none" strokeWidth={2}/>
      <circle className="ring r3" cx={230} cy={88} r={8}  stroke="#e040a0" fill="none" strokeWidth={1.5}/>
      <circle className="ring r4" cx={230} cy={88} r={8}  stroke="#e040a0" fill="none" strokeWidth={1}/>
      {/* freq label */}
      <rect x={120} y={128} width={78} height={18} rx={4} fill="rgba(224,64,160,0.15)" stroke="rgba(224,64,160,0.4)" strokeWidth={0.8}/>
      <text x={159} y={140} textAnchor="middle" fill="#e040a0" fontSize={9} fontFamily="Courier New,monospace">◄ 1090 MHz</text>
    </svg>
  );
}

/* ═══ SCENE 3 — TLS measures reply ═══════════════════════════════ */
function Scene3() {
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
      <rect width={320} height={200} fill={BG}/>
      <Stars/>
      <Runway/>
      <TLSUnit x={55} y={162} scale={1.1} color="#e040a0"/>
      <Aircraft x={230} y={88} scale={1.05} color="#c8d8f0"/>
      {/* rings traveling from aircraft toward TLS */}
      <circle className="ring-in r1" cx={230} cy={88} r={65} stroke="#e040a0" fill="none" strokeWidth={2}/>
      <circle className="ring-in r2" cx={230} cy={88} r={65} stroke="#e040a0" fill="none" strokeWidth={1.5}/>
      <circle className="ring-in r3" cx={230} cy={88} r={65} stroke="#e040a0" fill="none" strokeWidth={1}/>
      {/* scan line at TLS */}
      <g className="scan" style={{transformOrigin:"55px 155px"}}>
        <line x1={30} y1={150} x2={80} y2={150} stroke="#e040a0" strokeWidth={2} opacity={0.8}/>
      </g>
      {/* lock crosshair on aircraft */}
      <circle cx={230} cy={88} r={18} stroke="#FFD166" fill="none" strokeWidth={1} strokeDasharray="3 3" opacity={0.7}/>
      <line x1={230} y1={64} x2={230} y2={72} stroke="#FFD166" strokeWidth={1.2} opacity={0.8}/>
      <line x1={230} y1={104} x2={230} y2={112} stroke="#FFD166" strokeWidth={1.2} opacity={0.8}/>
      <line x1={206} y1={88} x2={214} y2={88} stroke="#FFD166" strokeWidth={1.2} opacity={0.8}/>
      <line x1={246} y1={88} x2={254} y2={88} stroke="#FFD166" strokeWidth={1.2} opacity={0.8}/>
      <text x={230} y={126} textAnchor="middle" fill="#FFD166" fontSize={8} fontFamily="Courier New,monospace">POSITION LOCK</text>
    </svg>
  );
}

/* ═══ SCENE 4 — Displacement from approach path ═════════════════ */
function Scene4() {
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
      <rect width={320} height={200} fill={BG}/>
      <Stars/>
      <Runway/>
      <TLSUnit x={55} y={162} scale={1.1} color={BLUE}/>
      {/* glide slope centerline path */}
      <line x1={55} y1={155} x2={295} y2={60} stroke={BLUE} strokeWidth={1.5} opacity={0.6}/>
      <line x1={55} y1={155} x2={295} y2={60} stroke={BLUE} strokeWidth={8} opacity={0.06}/>
      {/* approach corridor dashes */}
      <line x1={55} y1={145} x2={295} y2={50} stroke="rgba(0,174,239,0.25)" strokeWidth={1} strokeDasharray="6 5"/>
      <line x1={55} y1={165} x2={295} y2={70} stroke="rgba(0,174,239,0.25)" strokeWidth={1} strokeDasharray="6 5"/>
      {/* aircraft OFF path (bouncing) */}
      <g className="ac-bounce">
        <Aircraft x={220} y={68} scale={1} color="#FF6B6B" flip={false}/>
      </g>
      {/* displacement arrows */}
      <g className="arr-blink">
        <line x1={220} y1={82} x2={220} y2={104} stroke="#FF6B6B" strokeWidth={2}/>
        <polygon points="216,104 220,112 224,104" fill="#FF6B6B"/>
        <text x={228} y={100} fill="#FF6B6B" fontSize={8} fontFamily="Courier New,monospace">DISP</text>
      </g>
      {/* ILS path marker */}
      <text x={140} y={122} textAnchor="middle" fill={BLUE} fontSize={8} fontFamily="Courier New,monospace" opacity={0.8}>— ILS APPROACH PATH —</text>
    </svg>
  );
}

/* ═══ SCENE 5 — TLS guides aircraft (red beam + cockpit) ════════ */
function Scene5() {
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
      <rect width={320} height={200} fill={BG}/>
      <Stars/>
      <Runway/>
      <TLSUnit x={55} y={162} scale={1.1} color="#FF4444"/>
      <Aircraft x={220} y={85} scale={1.05} color="#b0e0b0"/>
      {/* red guidance beams TLS→aircraft */}
      <line className="beam"  x1={55} y1={153} x2={220} y2={75}  stroke="#FF4444" strokeWidth={2}/>
      <line className="beam2" x1={55} y1={155} x2={220} y2={85}  stroke="#FF6666" strokeWidth={2.5}/>
      <line className="beam3" x1={55} y1={157} x2={220} y2={95}  stroke="#FF4444" strokeWidth={2}/>
      {/* cockpit instrument view — top right */}
      <rect x={248} y={22} width={62} height={62} rx={4} fill="#0a1520" stroke="rgba(255,255,255,0.25)" strokeWidth={1}/>
      {/* runway view in cockpit */}
      <rect x={252} y={26} width={54} height={54} rx={2} fill="#1a2a3a"/>
      {/* runway seen from cockpit (trapezoid) */}
      <polygon points="265,76 275,76 289,38 251,38" fill="#2a4a2a" opacity={0.7}/>
      {/* centerline */}
      {[0.2,0.35,0.5,0.65,0.8].map((t,i)=>{
        const y1=38+(76-38)*t, y2=38+(76-38)*(t+0.08);
        const x1=265+(t*10), x2=265+(t*10)+0.5;
        return <line key={i} x1={x1} y1={y1} x2={x2+(1-t)*4} y2={y2} stroke="rgba(255,255,255,0.7)" strokeWidth={1.5}/>;
      })}
      {/* LOC needle */}
      <g className="inst-needle">
        <line x1={279} y1={28} x2={279} y2={74} stroke="#00D26A" strokeWidth={2}/>
        <polygon points="276,28 279,22 282,28" fill="#00D26A"/>
      </g>
      {/* GS bar horizontal */}
      <line x1={252} y1={52} x2={306} y2={52} stroke="rgba(255,255,255,0.15)" strokeWidth={5}/>
      <line x1={278} y1={52} x2={280} y2={52} stroke="#00D26A" strokeWidth={5}/>
      <text x={279} y={92} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={6} fontFamily="Courier New,monospace">COCKPIT HSI</text>
      {/* guidance label */}
      <text x={138} y={178} textAnchor="middle" fill="#00D26A" fontSize={9} fontFamily="Courier New,monospace" fontWeight="bold">✓ GUIDANCE SIGNAL ACTIVE</text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STEP DATA
═══════════════════════════════════════════════════════════════════ */
const STEPS = [
  {
    n: 1, color: "#00D26A",
    label: "INTERROGATION  1030 MHz",
    en: "TLS interrogates all aircraft transponders within the service volume",
    ar: "يرسل TLS إشارة استجواب بتردد 1030 MHz لجميع الـ Transponders",
    Scene: Scene1,
  },
  {
    n: 2, color: "#e040a0",
    label: "TRANSPONDER REPLY  1090 MHz",
    en: "Aircraft transponders respond to the interrogation signal",
    ar: "تستجيب transponders الطائرة بتردد 1090 MHz",
    Scene: Scene2,
  },
  {
    n: 3, color: "#FFD166",
    label: "SENSORS MEASURE REPLY",
    en: "TLS sensors measure each transponder reply & determine aircraft position",
    ar: "يقيس TLS كل رد ويحدد موضع الطائرة بدقة عالية",
    Scene: Scene3,
  },
  {
    n: 4, color: "#FF6B6B",
    label: "DISPLACEMENT CALCULATION",
    en: "TLS determines aircraft displacement from the desired ILS approach path",
    ar: "يحسب TLS انحراف الطائرة عن مسار الاقتراب المطلوب",
    Scene: Scene4,
  },
  {
    n: 5, color: "#FF4444",
    label: "ILS GUIDANCE SIGNAL",
    en: "TLS transmits ILS guidance — localizer & glide slope on cockpit instruments",
    ar: "يُرسل TLS إشارة ILS — تظهر LOC & G/S على أجهزة قمرة القيادة",
    Scene: Scene5,
  },
] as const;

const STEP_DUR = 10000; // 10 seconds

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
export default function TLSAnimation() {
  const [cur, setCur]   = useState(0);
  const [tick, setTick] = useState(0); // forces remount of pbar

  useEffect(() => {
    const id = setInterval(() => {
      setCur(c => (c + 1) % STEPS.length);
      setTick(t => t + 1);
    }, STEP_DUR);
    return () => clearInterval(id);
  }, []);

  const step = STEPS[cur];
  const { Scene } = step;

  return (
    <div style={{
      display:"flex", flexDirection:"column",
      height:"100dvh", background:BG, overflow:"hidden",
    }}>
      <style>{CSS}</style>

      {/* ── header ─────────────────────────────────────── */}
      <div style={{
        display:"flex", alignItems:"center", gap:12,
        padding:"10px 16px", flexShrink:0,
        background:"rgba(5,13,28,0.97)",
        borderBottom:"1px solid rgba(0,174,239,0.18)",
      }}>
        <BackButton/>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"#d0e8f8",
            fontFamily:"Courier New,monospace", letterSpacing:2 }}>
            TLS OPERATION
          </div>
          <div style={{ fontSize:9, color:"rgba(0,174,239,0.55)",
            fontFamily:"Courier New,monospace", letterSpacing:3 }}>
            TECHNICAL OPERATIONAL SEQUENCE
          </div>
        </div>
        {/* step counter */}
        <div style={{ marginLeft:"auto", textAlign:"center" }}>
          <div style={{ fontSize:22, fontWeight:900, color:step.color,
            fontFamily:"Courier New,monospace", lineHeight:1, textShadow:`0 0 12px ${step.color}` }}>
            {cur + 1}
          </div>
          <div style={{ fontSize:8, color:"rgba(255,255,255,0.4)",
            fontFamily:"Courier New,monospace" }}>OF 5</div>
        </div>
      </div>

      {/* ── step label ─────────────────────────────────── */}
      <div key={`lbl${tick}`} className="stp-in" style={{
        padding:"7px 16px 5px",
        background:`linear-gradient(90deg, ${step.color}18 0%, transparent 100%)`,
        borderBottom:`1px solid ${step.color}25`,
        borderLeft:`4px solid ${step.color}`,
        flexShrink:0,
      }}>
        <span style={{
          fontFamily:"Courier New,monospace", fontSize:10,
          fontWeight:700, color:step.color, letterSpacing:"0.15em",
        }}>
          STEP {step.n} — {step.label}
        </span>
      </div>

      {/* ── SVG animation area ─────────────────────────── */}
      <div key={`sc${tick}`} className="stp-in" style={{
        flex:1, position:"relative", overflow:"hidden",
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:"4px 0",
      }}>
        <Scene/>
      </div>

      {/* ── description ────────────────────────────────── */}
      <div key={`dsc${tick}`} className="stp-in" style={{
        padding:"8px 16px 6px", flexShrink:0,
        background:"rgba(5,13,28,0.9)",
        borderTop:"1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          fontFamily:"Inter,sans-serif", fontSize:12, lineHeight:1.55,
          color:"rgba(255,255,255,0.88)",
        }}>{step.en}</div>
        <div style={{
          fontFamily:"Inter,sans-serif", fontSize:10.5, lineHeight:1.5,
          color:`${step.color}99`, marginTop:3, direction:"rtl",
        }}>{step.ar}</div>
      </div>

      {/* ── progress bar ───────────────────────────────── */}
      <div style={{ flexShrink:0, height:3, background:"rgba(255,255,255,0.06)" }}>
        <div key={tick} className="pbar" style={{
          height:"100%",
          background:`linear-gradient(90deg,${step.color},${step.color}88)`,
          borderRadius:2,
        }}/>
      </div>

      {/* ── progress dots ──────────────────────────────── */}
      <div style={{
        display:"flex", justifyContent:"center", gap:10,
        padding:"8px 0 10px", flexShrink:0,
        background:"rgba(5,13,28,0.95)",
      }}>
        {STEPS.map((s, idx) => (
          <div
            key={idx}
            onClick={() => { setCur(idx); setTick(t=>t+1); }}
            style={{
              width: idx===cur ? 24 : 7, height:7, borderRadius:4,
              background: idx===cur ? s.color : idx<cur ? `${s.color}55` : "rgba(255,255,255,0.12)",
              boxShadow: idx===cur ? `0 0 10px ${s.color}` : "none",
              transition:"all 0.4s ease", cursor:"pointer",
            }}
          />
        ))}
      </div>
    </div>
  );
}
