import { useState, useEffect } from "react";
import BackButton from "../components/BackButton";

const BG = "#081420";

const CSS = `
@keyframes step-in { from { opacity:0 } to { opacity:1 } }
.fade-in { animation: step-in 0.6s ease both; }

@keyframes prog { from { width:0 } to { width:100% } }
.pbar { animation: prog 10s linear forwards; }

@keyframes wave-emit { 0% { transform: scale(0.08); opacity:0 } 15% { opacity:0.85 } 100% { transform: scale(1); opacity:0 } }
.w-emit { animation: wave-emit 4s ease-out infinite; }
.w-emit.d2 { animation-delay: 1.3s; }
.w-emit.d3 { animation-delay: 2.6s; }

@keyframes ring-grow { 0% { transform: scale(0.12); opacity:0 } 20% { opacity:0.95 } 100% { transform: scale(1); opacity:0 } }
.ring-g { animation: ring-grow 3.5s ease-out infinite; }
.ring-g.d2 { animation-delay: 1.15s; }
.ring-g.d3 { animation-delay: 2.3s; }

@keyframes ring-shrink { 0% { transform: scale(1); opacity:0 } 20% { opacity:0.95 } 100% { transform: scale(0.1); opacity:0 } }
.ring-s { animation: ring-shrink 3.5s ease-in infinite; }
.ring-s.d2 { animation-delay: 1.15s; }
.ring-s.d3 { animation-delay: 2.3s; }

@keyframes soft-blink { 0%,100% { opacity:0.3 } 50% { opacity:1 } }
.blink { animation: soft-blink 1.4s ease-in-out infinite; }

@keyframes beam-pulse { 0%,100% { opacity:0.25 } 50% { opacity:1 } }
.beam { animation: beam-pulse 2s ease-in-out infinite; }
.beam.d2 { animation-delay: 0.35s; }
.beam.d3 { animation-delay: 0.7s; }

@keyframes loc-drift { 0%,100% { transform: translateX(-7px) } 50% { transform: translateX(7px) } }
.loc-needle { animation: loc-drift 3.5s ease-in-out infinite; }
@keyframes gs-drift { 0%,100% { transform: translateY(-5px) } 50% { transform: translateY(6px) } }
.gs-needle { animation: gs-drift 4s ease-in-out infinite; }

@keyframes led { 0%,100% { opacity:0.4 } 50% { opacity:1 } }
.led { animation: led 1.2s ease-in-out infinite; }
`;

/* ── Simple grounded runway (perspective strip), no space/stars ── */
function Ground() {
  return (
    <g>
      <rect x={0} y={150} width={320} height={50} fill="#0b1a27" />
      <line x1={0} y1={150} x2={320} y2={150} stroke="#173346" strokeWidth={1} opacity={0.7} />
      <polygon points="52,190 168,190 212,158 120,158" fill="#15324704" />
      <polygon points="52,190 168,190 212,158 120,158" fill="#143247" stroke="#27597c" strokeWidth={1} />
      {[0, 1, 2, 3].map((i) => {
        const t = 0.12 + i * 0.22;
        const x1 = 110 + (160 - 110) * t, y1 = 190 + (158 - 190) * t;
        const x2 = 110 + (160 - 110) * (t + 0.11), y2 = 190 + (158 - 190) * (t + 0.11);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />;
      })}
    </g>
  );
}

/* ── Realistic 3D TLS ground unit (box + dish + antenna masts) ── */
function TLSUnit({ accent = "#00AEEF" }: { accent?: string }) {
  return (
    <g transform="translate(30,150)">
      {/* thin platform slab */}
      <polygon points="2,9 44,9 57,0 13,0" fill="#2c4a60" stroke="#3a6585" strokeWidth={0.6} />
      {/* left antenna masts */}
      <line x1={5} y1={-14} x2={5} y2={32} stroke="#28333b" strokeWidth={1.6} />
      <line x1={9} y1={-10} x2={9} y2={30} stroke="#4a7ba0" strokeWidth={1.3} />
      {/* box: top / front / side faces */}
      <polygon points="10,9 40,9 52,1 22,1" fill="#5f8aac" stroke="#3a5a73" strokeWidth={0.6} />
      <polygon points="10,9 40,9 40,30 10,30" fill="#7c868e" stroke="#5a636a" strokeWidth={0.6} />
      <polygon points="40,9 52,1 52,22 40,30" fill="#566069" stroke="#3f474e" strokeWidth={0.6} />
      {/* status LED on the box (active-step color) */}
      <circle className="led" cx={16} cy={15} r={2} fill={accent} />
      {/* dish on a pole */}
      <line x1={30} y1={1} x2={30} y2={-13} stroke="#3a444c" strokeWidth={1.6} />
      <g transform="rotate(-14 30 -15)">
        <ellipse cx={30} cy={-15} rx={9.5} ry={3.4} fill="#4a545c" stroke="#2b333a" strokeWidth={0.8} />
        <ellipse cx={30} cy={-15} rx={5} ry={1.7} fill="#5d6973" />
      </g>
      <text x={28} y={45} textAnchor="middle" fill={accent} fontSize={8} fontFamily="Courier New,monospace" fontWeight="bold" letterSpacing="1">TLS</text>
    </g>
  );
}

/* ── Aircraft side-view, nose points DOWN-LEFT toward the runway (approach) ── */
function Aircraft({ x, y, rot = -16, color = "#cfe6f5" }: { x: number; y: number; rot?: number; color?: string }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) scale(-1,1)`}>
      <ellipse cx={0} cy={0} rx={30} ry={6.5} fill="#1c3e5a" stroke={color} strokeWidth={1} />
      <path d="M 30,-3 Q 44,0 30,3 Z" fill={color} opacity={0.9} />
      <path d="M -30,-3 L -26,-3 L -27,-17 Q -34,-17 -36,-9 L -36,-3 Z" fill="#1c3e5a" stroke={color} strokeWidth={0.8} />
      <path d="M -4,-6 L 16,-6 L 20,13 L -8,13 Z" fill="#23507a" stroke={color} strokeWidth={0.7} />
      <path d="M -26,-3 L -18,-3 L -16,6 L -28,6 Z" fill="#23507a" stroke={color} strokeWidth={0.6} />
      <ellipse cx={6} cy={14} rx={5.5} ry={2.8} fill="#0d2236" stroke={color} strokeWidth={0.7} />
      {[-8, -2, 4, 10, 16].map((wx, i) => (
        <rect key={i} x={wx} y={-2.5} width={3.5} height={2.6} rx={1} fill="rgba(170,225,255,0.65)" />
      ))}
    </g>
  );
}

const OX = 60, OY = 135; // TLS dish emit point (absolute)

/* SCENE 1 — interrogation: gradual waves from radar toward aircraft */
function Scene1() {
  const ax = 252, ay = 70;
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width={320} height={200} fill={BG} />
      <Ground />
      <Aircraft x={ax} y={ay} color="#bcd9ef" />
      <TLSUnit accent="#00D26A" />
      <polygon points={`${OX},${OY} ${ax},${ay - 14} ${ax},${ay + 14}`} fill="rgba(0,210,106,0.10)" />
      <g>
        <circle className="w-emit" cx={OX} cy={OY} r={210} fill="none" stroke="#00D26A" strokeWidth={2} style={{ transformOrigin: `${OX}px ${OY}px` }} />
        <circle className="w-emit d2" cx={OX} cy={OY} r={210} fill="none" stroke="#00D26A" strokeWidth={1.6} style={{ transformOrigin: `${OX}px ${OY}px` }} />
        <circle className="w-emit d3" cx={OX} cy={OY} r={210} fill="none" stroke="#00D26A" strokeWidth={1.2} style={{ transformOrigin: `${OX}px ${OY}px` }} />
      </g>
      <rect x={118} y={104} width={86} height={18} rx={4} fill="rgba(0,210,106,0.14)" stroke="rgba(0,210,106,0.4)" strokeWidth={0.8} />
      <text x={161} y={116} textAnchor="middle" fill="#00D26A" fontSize={9} fontFamily="Courier New,monospace">1030 MHz ►</text>
    </svg>
  );
}

/* SCENE 2 — transponder reply: rings expand FROM stationary aircraft */
function Scene2() {
  const ax = 252, ay = 70;
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width={320} height={200} fill={BG} />
      <Ground />
      <TLSUnit accent="#ec4ba6" />
      <Aircraft x={ax} y={ay} color="#cfe6f5" />
      <g>
        <circle className="ring-g" cx={ax} cy={ay} r={78} fill="none" stroke="#ec4ba6" strokeWidth={2.4} style={{ transformOrigin: `${ax}px ${ay}px` }} />
        <circle className="ring-g d2" cx={ax} cy={ay} r={78} fill="none" stroke="#ec4ba6" strokeWidth={1.8} style={{ transformOrigin: `${ax}px ${ay}px` }} />
        <circle className="ring-g d3" cx={ax} cy={ay} r={78} fill="none" stroke="#ec4ba6" strokeWidth={1.3} style={{ transformOrigin: `${ax}px ${ay}px` }} />
      </g>
      <rect x={108} y={104} width={86} height={18} rx={4} fill="rgba(236,75,166,0.14)" stroke="rgba(236,75,166,0.4)" strokeWidth={0.8} />
      <text x={151} y={116} textAnchor="middle" fill="#ec4ba6" fontSize={9} fontFamily="Courier New,monospace">◄ 1090 MHz</text>
    </svg>
  );
}

/* SCENE 3 — sensors measure reply & lock position */
function Scene3() {
  const ax = 252, ay = 70;
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width={320} height={200} fill={BG} />
      <Ground />
      <TLSUnit accent="#FFD166" />
      <Aircraft x={ax} y={ay} color="#cfe6f5" />
      <g>
        <circle className="ring-s" cx={ax} cy={ay} r={78} fill="none" stroke="#ec4ba6" strokeWidth={2} style={{ transformOrigin: `${ax}px ${ay}px` }} />
        <circle className="ring-s d2" cx={ax} cy={ay} r={78} fill="none" stroke="#ec4ba6" strokeWidth={1.5} style={{ transformOrigin: `${ax}px ${ay}px` }} />
        <circle className="ring-s d3" cx={ax} cy={ay} r={78} fill="none" stroke="#ec4ba6" strokeWidth={1.1} style={{ transformOrigin: `${ax}px ${ay}px` }} />
      </g>
      <circle className="blink" cx={ax} cy={ay} r={21} fill="none" stroke="#FFD166" strokeWidth={1} strokeDasharray="3 3" />
      <line x1={ax} y1={ay - 27} x2={ax} y2={ay - 18} stroke="#FFD166" strokeWidth={1.2} />
      <line x1={ax} y1={ay + 18} x2={ax} y2={ay + 27} stroke="#FFD166" strokeWidth={1.2} />
      <line x1={ax - 27} y1={ay} x2={ax - 18} y2={ay} stroke="#FFD166" strokeWidth={1.2} />
      <line x1={ax + 18} y1={ay} x2={ax + 27} y2={ay} stroke="#FFD166" strokeWidth={1.2} />
      <text x={ax} y={ay + 40} textAnchor="middle" fill="#FFD166" fontSize={8} fontFamily="Courier New,monospace">POSITION LOCK</text>
    </svg>
  );
}

/* SCENE 4 — displacement from desired approach path */
function Scene4() {
  const C = "#00AEEF";
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width={320} height={200} fill={BG} />
      <Ground />
      <TLSUnit accent={C} />
      <line x1={70} y1={150} x2={292} y2={56} stroke={C} strokeWidth={1.6} opacity={0.7} strokeDasharray="6 4" />
      <line x1={70} y1={150} x2={292} y2={56} stroke={C} strokeWidth={10} opacity={0.05} />
      <text x={158} y={150} textAnchor="middle" fill={C} fontSize={8} fontFamily="Courier New,monospace" opacity={0.75}>DESIRED APPROACH PATH</text>
      <Aircraft x={248} y={50} color="#ff8a8a" />
      <g className="blink">
        <line x1={248} y1={60} x2={248} y2={86} stroke="#ff8a8a" strokeWidth={2} strokeDasharray="3 2" />
        <polygon points="244,86 248,94 252,86" fill="#ff8a8a" />
        <text x={256} y={80} fill="#ff8a8a" fontSize={8} fontFamily="Courier New,monospace">Δ DISP</text>
      </g>
    </svg>
  );
}

/* SCENE 5 — ILS guidance + circular cockpit indicator */
function Scene5() {
  const cx = 270, cy = 54, R = 33;
  const ax = 196, ay = 96;
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width={320} height={200} fill={BG} />
      <Ground />
      <TLSUnit accent="#ff5252" />
      <line x1={70} y1={150} x2={ax} y2={ay + 6} stroke="#2a4a66" strokeWidth={1.2} opacity={0.6} strokeDasharray="5 4" />
      <Aircraft x={ax} y={ay} color="#bfe6bf" />
      <line className="beam" x1={OX} y1={OY} x2={ax} y2={ay - 8} stroke="#ff5252" strokeWidth={2} />
      <line className="beam d2" x1={OX} y1={OY + 3} x2={ax} y2={ay} stroke="#ff7070" strokeWidth={2.4} />
      <line className="beam d3" x1={OX} y1={OY + 6} x2={ax} y2={ay + 8} stroke="#ff5252" strokeWidth={2} />
      {/* circular ILS indicator */}
      <circle cx={cx} cy={cy} r={R + 4} fill="#0a1824" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={R} fill="#5a9bc8" />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#2a4a66" strokeWidth={1} />
      <g className="gs-needle"><line x1={cx - R + 3} y1={cy} x2={cx + R - 3} y2={cy} stroke="#fff" strokeWidth={1.6} strokeDasharray="4 3" /></g>
      <g className="loc-needle"><line x1={cx} y1={cy - R + 3} x2={cx} y2={cy + R - 3} stroke="#fff" strokeWidth={1.6} strokeDasharray="4 3" /></g>
      {[-2, -1, 1, 2].map((k) => <circle key={"h" + k} cx={cx + k * 9} cy={cy} r={1.4} fill="rgba(255,255,255,0.5)" />)}
      {[-2, -1, 1, 2].map((k) => <circle key={"v" + k} cx={cx} cy={cy + k * 9} r={1.4} fill="rgba(255,255,255,0.5)" />)}
      <circle cx={cx} cy={cy} r={2.2} fill="#fff" />
      <text x={cx} y={cy + R + 15} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={7} fontFamily="Courier New,monospace">ILS INDICATOR</text>
      <text x={150} y={184} textAnchor="middle" fill="#00D26A" fontSize={9} fontFamily="Courier New,monospace" fontWeight="bold">✓ ON GLIDE PATH</text>
    </svg>
  );
}

const STEPS = [
  { n: 1, color: "#00D26A", label: "INTERROGATION 1030 MHz",
    en: "TLS interrogates all aircraft transponders within the service volume",
    ar: "يرسل TLS إشارة استجواب بتردد 1030 MHz لجميع الطائرات في نطاق الخدمة", scene: <Scene1 /> },
  { n: 2, color: "#ec4ba6", label: "TRANSPONDER REPLY 1090 MHz",
    en: "Aircraft transponders respond to the interrogation signal",
    ar: "ترد أجهزة الطائرة (Transponder) بتردد 1090 MHz", scene: <Scene2 /> },
  { n: 3, color: "#FFD166", label: "SENSORS MEASURE REPLY",
    en: "TLS sensors measure each reply and determine the aircraft position",
    ar: "تقيس حساسات TLS كل رد وتحدد موضع الطائرة بدقة", scene: <Scene3 /> },
  { n: 4, color: "#ff8a8a", label: "DISPLACEMENT CALCULATION",
    en: "TLS determines the aircraft displacement from the desired approach path",
    ar: "يحسب TLS انحراف الطائرة عن مسار الاقتراب المطلوب", scene: <Scene4 /> },
  { n: 5, color: "#ff5252", label: "ILS GUIDANCE SIGNAL",
    en: "TLS transmits ILS guidance shown on the cockpit ILS indicator",
    ar: "يرسل TLS إشارة توجيه ILS تظهر على مؤشر ILS في قمرة القيادة", scene: <Scene5 /> },
];

const STEP_DUR = 10000;

export default function TLSAnimation() {
  const [cur, setCur] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCur((c) => (c + 1) % STEPS.length);
      setTick((t) => t + 1);
    }, STEP_DUR);
    return () => clearInterval(id);
  }, []);

  const step = STEPS[cur];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: BG, overflow: "hidden" }}>
      <style>{CSS}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", flexShrink: 0, background: "rgba(8,20,32,0.97)", borderBottom: "1px solid rgba(0,174,239,0.18)" }}>
        <BackButton />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#d0e8f8", fontFamily: "Courier New,monospace", letterSpacing: 2 }}>TLS OPERATION</div>
          <div style={{ fontSize: 9, color: "rgba(0,174,239,0.55)", fontFamily: "Courier New,monospace", letterSpacing: 3 }}>OPERATIONAL SEQUENCE</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: step.color, fontFamily: "Courier New,monospace", lineHeight: 1, textShadow: `0 0 12px ${step.color}` }}>{cur + 1}</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "Courier New,monospace" }}>OF 5</div>
        </div>
      </div>

      <div key={`l${tick}`} className="fade-in" style={{ padding: "7px 16px 5px", background: `linear-gradient(90deg, ${step.color}18 0%, transparent 100%)`, borderBottom: `1px solid ${step.color}25`, borderLeft: `4px solid ${step.color}`, flexShrink: 0 }}>
        <span style={{ fontFamily: "Courier New,monospace", fontSize: 10, fontWeight: 700, color: step.color, letterSpacing: "0.12em" }}>STEP {step.n} — {step.label}</span>
      </div>

      <div key={`s${tick}`} className="fade-in" style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {step.scene}
      </div>

      <div key={`d${tick}`} className="fade-in" style={{ padding: "8px 16px 6px", flexShrink: 0, background: "rgba(8,20,32,0.9)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontFamily: "Inter,sans-serif", fontSize: 12, lineHeight: 1.55, color: "rgba(255,255,255,0.88)" }}>{step.en}</div>
        <div style={{ fontFamily: "Inter,sans-serif", fontSize: 10.5, lineHeight: 1.5, color: `${step.color}cc`, marginTop: 3, direction: "rtl" }}>{step.ar}</div>
      </div>

      <div style={{ flexShrink: 0, height: 3, background: "rgba(255,255,255,0.06)" }}>
        <div key={tick} className="pbar" style={{ height: "100%", background: `linear-gradient(90deg,${step.color},${step.color}88)`, borderRadius: 2 }} />
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "8px 0 10px", flexShrink: 0, background: "rgba(8,20,32,0.95)" }}>
        {STEPS.map((s, idx) => (
          <div key={idx} onClick={() => { setCur(idx); setTick((t) => t + 1); }} style={{ width: idx === cur ? 24 : 7, height: 7, borderRadius: 4, background: idx === cur ? s.color : idx < cur ? `${s.color}55` : "rgba(255,255,255,0.12)", boxShadow: idx === cur ? `0 0 10px ${s.color}` : "none", transition: "all 0.4s ease", cursor: "pointer" }} />
        ))}
      </div>
    </div>
  );
}
