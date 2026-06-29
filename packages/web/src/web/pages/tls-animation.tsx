import { useState, useEffect, useRef } from "react";
import BackButton from "../components/BackButton";

const C  = "#00AEEF";
const G  = "#00D26A";
const Y  = "#FFD166";
const R  = "#FF6B6B";

const css = `
@keyframes ring-expand {
  0%   { r: 5;  opacity: 0.9; }
  100% { r: 58; opacity: 0;   }
}
.tls-ring { animation: ring-expand 2.2s ease-out infinite; }
.tls-ring:nth-child(2) { animation-delay: 0.55s; }
.tls-ring:nth-child(3) { animation-delay: 1.1s;  }
.tls-ring:nth-child(4) { animation-delay: 1.65s; }

@keyframes dash-resp {
  0%   { stroke-dashoffset: 200; }
  100% { stroke-dashoffset: 0;   }
}
.resp-line { stroke-dasharray: 6 4; stroke-dashoffset: 200; animation: dash-resp 2s linear infinite; }
.resp-line.d1 { animation-delay: 0s;    }
.resp-line.d2 { animation-delay: 0.3s;  }
.resp-line.d3 { animation-delay: 0.6s;  }

@keyframes scan-h {
  0%,100% { transform: translateY(-32px); opacity: 0.7; }
  50%      { transform: translateY(32px);  opacity: 1;   }
}
.scan-ln { animation: scan-h 1.6s ease-in-out infinite; }

@keyframes lock-pulse {
  0%,100% { opacity: 0.3; }
  50%      { opacity: 1;   }
}
.lock-c { animation: lock-pulse 0.8s ease-in-out infinite; }

@keyframes dev-bounce {
  0%,100% { transform: translateY(0);   }
  50%      { transform: translateY(-14px); }
}
.ac-off { animation: dev-bounce 2s ease-in-out infinite; }

@keyframes arr-blink {
  0%,100% { opacity: 0.25; }
  50%      { opacity: 1;    }
}
.dev-arr { animation: arr-blink 0.7s ease-in-out infinite; }

@keyframes guide-pulse {
  0%,100% { opacity: 0.15; stroke-width: 1;   }
  50%      { opacity: 1;    stroke-width: 2.5; }
}
.guide-b  { animation: guide-pulse 1.2s ease-in-out infinite; }
.guide-b2 { animation: guide-pulse 1.2s ease-in-out infinite; animation-delay: 0.2s; }
.guide-b3 { animation: guide-pulse 1.2s ease-in-out infinite; animation-delay: 0.4s; }

@keyframes needle-swing {
  0%,100% { transform: rotate(-16deg); }
  50%      { transform: rotate(9deg);  }
}
.hsi-needle { transform-origin: 50% 84%; animation: needle-swing 2s ease-in-out infinite; }

@keyframes ac-align {
  0%   { transform: translateY(12px) rotate(4deg); }
  100% { transform: translateY(0)    rotate(0deg); }
}
.ac-align { animation: ac-align 3.5s ease-out forwards; }

@keyframes badge-in {
  from { transform: translateX(-18px); opacity: 0; }
  to   { transform: translateX(0);     opacity: 1; }
}
@keyframes txt-in {
  from { transform: translateX(-12px); opacity: 0; }
  to   { transform: translateX(0);     opacity: 1; }
}
.badge-anim { animation: badge-in 0.4s 0.15s ease both; }
.desc-anim  { animation: txt-in  0.4s 0.3s  ease both; }
.ar-anim    { animation: txt-in  0.4s 0.45s ease both; }

@keyframes prog-bar {
  from { width: 0%; }
  to   { width: 100%; }
}
.prog-bar { animation: prog-bar 4.8s linear forwards; }
`;

// ── Aircraft SVG helper ──────────────────────────────────────────────────
function Plane({ x, y, stroke: s = C, cls = "" }: { x: number; y: number; stroke?: string; cls?: string }) {
  return (
    <g className={cls} transform={`translate(${x},${y}) rotate(180)`}>
      <path d="M0,0 L20,-6 L24,0 L20,6 Z"      fill="#0d1e32" stroke={s} strokeWidth={1.5}/>
      <path d="M8,-6 L18,-14 L22,-10 L10,-4 Z"  fill="#0d1e32" stroke={s} strokeWidth={0.9}/>
      <path d="M8,6 L18,14 L22,10 L10,4 Z"      fill="#0d1e32" stroke={s} strokeWidth={0.9}/>
    </g>
  );
}

// ── TLS Box SVG ─────────────────────────────────────────────────────────
function TLSBox({ x, y, stroke: s = C }: { x: number; y: number; stroke?: string }) {
  return (
    <>
      <rect x={x} y={y} width={24} height={18} rx={3} fill="#071220" stroke={s} strokeWidth={1.5}/>
      <rect x={x+4} y={y-5} width={16} height={6} rx={1.5} fill={s} opacity={0.55}/>
      <text x={x+12} y={y+28} textAnchor="middle" fill={s} fontSize={7} fontFamily="Courier New">TLS</text>
    </>
  );
}

// ── Radar grid background ────────────────────────────────────────────────
function RadarBg() {
  const lines: React.ReactNode[] = [];
  for (let i = 0; i <= 10; i++) {
    const pct = i * 10;
    lines.push(<line key={`h${i}`} x1="0" y1={`${pct}%`} x2="100%" y2={`${pct}%`} stroke="rgba(0,174,239,0.07)" strokeWidth="0.5"/>);
    lines.push(<line key={`v${i}`} x1={`${pct}%`} y1="0" x2={`${pct}%`} y2="100%" stroke="rgba(0,174,239,0.07)" strokeWidth="0.5"/>);
  }
  const stars = Array.from({length:40},(_,i)=>({
    cx: (i*73+17)%100, cy: (i*53+29)%100,
    r: 0.4 + (i%3)*0.3, op: 0.2 + (i%5)*0.08
  }));
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="url(#bgGrad)"/>
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#020a17"/>
          <stop offset="50%"  stopColor="#040c1a"/>
          <stop offset="100%" stopColor="#060d1e"/>
        </linearGradient>
      </defs>
      {lines}
      {stars.map((s,i)=>(
        <circle key={i} cx={`${s.cx}%`} cy={`${s.cy}%`} r={s.r} fill={`rgba(255,255,255,${s.op})`}/>
      ))}
    </svg>
  );
}

// ── Step SVG scenes ──────────────────────────────────────────────────────
function Scene1() {
  return (
    <svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"80%",maxHeight:110}}>
      <TLSBox x={108} y={38}/>
      <circle className="tls-ring" cx={120} cy={47} r={5} stroke={C} fill="none" strokeWidth={2}/>
      <circle className="tls-ring" cx={120} cy={47} r={5} stroke="#35D4FF" fill="none" strokeWidth={1.5}/>
      <circle className="tls-ring" cx={120} cy={47} r={5} stroke={C} fill="none" strokeWidth={1}/>
      <circle className="tls-ring" cx={120} cy={47} r={5} stroke="#35D4FF" fill="none" strokeWidth={0.8}/>
      <Plane x={12} y={47}/>
      <circle cx={78} cy={28} r={2} fill={C} opacity={0.5}/>
      <circle cx={52} cy={58} r={1.5} fill="#35D4FF" opacity={0.4}/>
    </svg>
  );
}

function Scene2() {
  return (
    <svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"80%",maxHeight:110}}>
      <TLSBox x={108} y={38} stroke={G}/>
      <Plane x={12} y={47} stroke={G}/>
      <line className="resp-line d1" x1={36} y1={41} x2={108} y2={44} stroke={G} strokeWidth={2}/>
      <line className="resp-line d2" x1={36} y1={47} x2={108} y2={47} stroke={G} strokeWidth={1.5}/>
      <line className="resp-line d3" x1={36} y1={53} x2={108} y2={50} stroke={G} strokeWidth={1}/>
      <text x={72} y={33} textAnchor="middle" fill={G} fontSize={7.5} fontFamily="Courier New" opacity={0.85}>REPLY ►</text>
    </svg>
  );
}

function Scene3() {
  return (
    <svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"80%",maxHeight:110}}>
      <TLSBox x={108} y={38} stroke={Y}/>
      <rect x={18} y={18} width={82} height={64} rx={4} fill="rgba(255,209,102,0.02)" stroke="rgba(255,209,102,0.18)" strokeWidth={0.8}/>
      <g className="scan-ln">
        <rect x={18} y={47} width={82} height={1.5} fill="rgba(255,209,102,0.55)" rx={0.5}/>
      </g>
      <Plane x={32} y={47} stroke={Y}/>
      <circle className="lock-c" cx={43} cy={47} r={13} stroke={Y} fill="none" strokeWidth={1}/>
      <line x1={43} y1={29} x2={43} y2={36} stroke={Y} strokeWidth={1} opacity={0.7}/>
      <line x1={43} y1={58} x2={43} y2={65} stroke={Y} strokeWidth={1} opacity={0.7}/>
      <line x1={25} y1={47} x2={32} y2={47} stroke={Y} strokeWidth={1} opacity={0.7}/>
      <line x1={54} y1={47} x2={61} y2={47} stroke={Y} strokeWidth={1} opacity={0.7}/>
      <text x={43} y={78} textAnchor="middle" fill={Y} fontSize={6.5} fontFamily="Courier New">POSITION LOCK</text>
    </svg>
  );
}

function Scene4() {
  return (
    <svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"80%",maxHeight:110}}>
      <line x1={14} y1={75} x2={126} y2={47} stroke="rgba(0,174,239,0.25)" strokeWidth={1} strokeDasharray="4 3"/>
      <line x1={14} y1={70} x2={126} y2={47} stroke={C} strokeWidth={1.5} opacity={0.7}/>
      <line x1={14} y1={65} x2={126} y2={47} stroke="rgba(0,174,239,0.25)" strokeWidth={1} strokeDasharray="4 3"/>
      <text x={18} y={62} fill={C} fontSize={6} fontFamily="Courier New" opacity={0.6}>G/S PATH</text>
      <TLSBox x={110} y={38} stroke={C}/>
      <g className="ac-off">
        <Plane x={52} y={28} stroke={R}/>
      </g>
      <g className="dev-arr">
        <line x1={63} y1={46} x2={63} y2={62} stroke={R} strokeWidth={1.5}/>
        <polygon points="60,62 63,68 66,62" fill={R}/>
        <text x={67} y={57} fill={R} fontSize={6} fontFamily="Courier New">DISP</text>
      </g>
    </svg>
  );
}

function Scene5({ key: _k }: { key?: number }) {
  return (
    <svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"80%",maxHeight:110}}>
      <line className="guide-b"  x1={108} y1={44} x2={34} y2={38} stroke={C} strokeWidth={2}/>
      <line className="guide-b2" x1={108} y1={47} x2={34} y2={47} stroke="#35D4FF" strokeWidth={2.5}/>
      <line className="guide-b3" x1={108} y1={50} x2={34} y2={56} stroke={C} strokeWidth={2}/>
      <TLSBox x={110} y={38} stroke={C}/>
      <g className="ac-align">
        <Plane x={10} y={42} stroke={G}/>
      </g>
      {/* Cockpit HSI */}
      <circle cx={72} cy={26} r={19} fill="#071220" stroke={C} strokeWidth={1.2}/>
      <circle cx={72} cy={26} r={14} fill="none" stroke="rgba(0,174,239,0.25)" strokeWidth={0.5}/>
      <text x={72} y={13} textAnchor="middle" fill={C} fontSize={5.5} fontFamily="Courier New">N</text>
      <line x1={72} y1={12} x2={72} y2={16} stroke={C} strokeWidth={1.2} opacity={0.8}/>
      <line x1={87} y1={26} x2={82} y2={26} stroke={C} strokeWidth={0.8} opacity={0.45}/>
      <line x1={57} y1={26} x2={62} y2={26} stroke={C} strokeWidth={0.8} opacity={0.45}/>
      <g className="hsi-needle">
        <line x1={72} y1={14} x2={72} y2={37} stroke={Y} strokeWidth={1.8}/>
        <polygon points="72,12 69,19 75,19" fill={Y}/>
      </g>
      <text x={72} y={52} textAnchor="middle" fill={C} fontSize={5.5} fontFamily="Courier New">COCKPIT HSI</text>
      <text x={72} y={83} textAnchor="middle" fill={G} fontSize={7} fontFamily="Courier New" fontWeight="bold">✓ GUIDANCE ACTIVE</text>
    </svg>
  );
}

// ── Step data ────────────────────────────────────────────────────────────
const STEPS = [
  {
    n: 1, color: C,
    scene: <Scene1/>,
    en: "TLS interrogates all aircraft transponders within the service volume",
    ar: "يرسل TLS إشارة استجواب لجميع transponders في نطاق الخدمة",
  },
  {
    n: 2, color: G,
    scene: <Scene2/>,
    en: "Aircraft transponders respond to the interrogation signal",
    ar: "تستجيب transponders الطائرة لإشارة الاستجواب",
  },
  {
    n: 3, color: Y,
    scene: <Scene3/>,
    en: "TLS sensors measure each reply & determine aircraft position",
    ar: "يقيس TLS كل رد ويحدد موضع الطائرة بدقة",
  },
  {
    n: 4, color: R,
    scene: <Scene4/>,
    en: "TLS determines aircraft displacement from the ILS approach path",
    ar: "يحسب TLS انحراف الطائرة عن مسار الاقتراب",
  },
  {
    n: 5, color: G,
    scene: <Scene5 key={0}/>,
    en: "TLS transmits ILS signal — LOC & G/S displayed on cockpit instrumentation",
    ar: "يرسل TLS إشارة ILS — تظهر على أجهزة قمرة القيادة",
  },
] as const;

const STEP_DUR = 4800;

export default function TLSAnimation() {
  const [cur, setCur] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCur(c => (c + 1) % STEPS.length);
      setTick(t => t + 1);
    }, STEP_DUR);
    return () => clearInterval(id);
  }, []);

  const step = STEPS[cur];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100dvh", background:"#040c1a", overflow:"hidden" }}>
      <style>{css}</style>

      {/* Header */}
      <div style={{
        display:"flex", alignItems:"center", gap:12,
        padding:"11px 16px",
        background:"rgba(4,12,26,0.97)",
        borderBottom:"1px solid rgba(0,174,239,0.15)",
        flexShrink:0,
      }}>
        <BackButton/>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:"#e0e0e0", fontFamily:"Courier New,monospace", letterSpacing:1 }}>
            TLS OPERATION
          </div>
          <div style={{ fontSize:10, color:"rgba(0,174,239,0.6)", fontFamily:"Courier New,monospace", letterSpacing:2 }}>
            ANIMATED TRAINING VISUALIZATION
          </div>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex:1, position:"relative", display:"flex", flexDirection:"column" }}>
        <RadarBg/>

        {/* 5 step panels stacked */}
        <div style={{ position:"relative", zIndex:1, flex:1, display:"flex", flexDirection:"column" }}>
          {STEPS.map((s, idx) => {
            const isActive = idx === cur;
            const isDone   = idx < cur;
            return (
              <div
                key={s.n}
                style={{
                  flex:1, display:"flex", alignItems:"center",
                  padding:"0 12px 0 8px",
                  borderBottom: idx < 4 ? "1px solid rgba(0,174,239,0.08)" : "none",
                  opacity: isActive ? 1 : isDone ? 0.18 : 0.35,
                  transition: "opacity 0.5s ease",
                  position:"relative", overflow:"hidden",
                }}
              >
                {/* progress bar at bottom of active panel */}
                {isActive && (
                  <div key={tick} className="prog-bar" style={{
                    position:"absolute", bottom:0, left:0, height:2,
                    background:`linear-gradient(90deg,${s.color},${s.color}88)`,
                    borderRadius:1,
                  }}/>
                )}

                {/* SVG scene */}
                <div style={{ flexShrink:0, width:"54%", maxWidth:210, height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {s.scene}
                </div>

                {/* Text */}
                <div style={{ flex:1, paddingLeft:10 }}>
                  {isActive ? (
                    <>
                      <div key={`b${tick}`} className="badge-anim" style={{
                        display:"inline-flex", alignItems:"center", gap:5,
                        background:`${s.color}18`, border:`1px solid ${s.color}55`,
                        borderRadius:20, padding:"3px 10px",
                        fontSize:9.5, fontWeight:700, color:s.color,
                        letterSpacing:"0.1em", marginBottom:6,
                      }}>◉ STEP {s.n}</div>
                      <div key={`d${tick}`} className="desc-anim" style={{
                        fontFamily:"Inter,sans-serif", fontSize:11.5, lineHeight:1.6,
                        color:"rgba(255,255,255,0.85)",
                      }}>{s.en}</div>
                      <div key={`a${tick}`} className="ar-anim" style={{
                        fontFamily:"Inter,sans-serif", fontSize:10, lineHeight:1.5,
                        color:`${s.color}88`, marginTop:4, direction:"rtl" as any,
                      }}>{s.ar}</div>
                    </>
                  ) : (
                    <>
                      <div style={{
                        display:"inline-flex", alignItems:"center", gap:5,
                        fontSize:9, fontWeight:700, color:s.color,
                        letterSpacing:"0.1em", marginBottom:4, opacity:0.7,
                      }}>◉ STEP {s.n}</div>
                      <div style={{ fontFamily:"Inter,sans-serif", fontSize:10, color:"rgba(255,255,255,0.4)" }}>
                        {s.en}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress dots */}
        <div style={{
          position:"absolute", bottom:8, left:0, right:0,
          display:"flex", justifyContent:"center", gap:8, zIndex:20,
        }}>
          {STEPS.map((s, idx) => (
            <div
              key={idx}
              onClick={() => { setCur(idx); setTick(t => t+1); }}
              style={{
                width: idx === cur ? 20 : 6,
                height: 6, borderRadius: 3,
                background: idx === cur ? s.color : idx < cur ? `${s.color}55` : "rgba(255,255,255,0.15)",
                boxShadow: idx === cur ? `0 0 8px ${s.color}` : "none",
                transition:"all 0.35s ease", cursor:"pointer",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
