import { useState, useEffect } from "react";
import BackButton from "../components/BackButton";

const BG = "#081420";

const CSS = `
@keyframes step-in { from { opacity:0 } to { opacity:1 } }
.fade-in { animation: step-in 0.6s ease both; }

@keyframes prog { from { width:0 } to { width:100% } }
.pbar { animation: prog 10s linear forwards; }

/* slow waves emitting from radar (step 1) */
@keyframes wave-emit {
  0%   { transform: scale(0.1); opacity:0; }
  15%  { opacity:0.9; }
  100% { transform: scale(1); opacity:0; }
}
.w-emit { animation: wave-emit 4s ease-out infinite; }
.w-emit.d2 { animation-delay: 1.3s; }
.w-emit.d3 { animation-delay: 2.6s; }

/* slow rings expanding from aircraft (step 2) */
@keyframes ring-grow {
  0%   { transform: scale(0.15); opacity:0; }
  20%  { opacity:0.95; }
  100% { transform: scale(1); opacity:0; }
}
.ring-g { animation: ring-grow 3.5s ease-out infinite; }
.ring-g.d2 { animation-delay: 1.15s; }
.ring-g.d3 { animation-delay: 2.3s; }

/* rings converging to radar (step 3) */
@keyframes ring-shrink {
  0%   { transform: scale(1); opacity:0; }
  20%  { opacity:0.95; }
  100% { transform: scale(0.12); opacity:0; }
}
.ring-s { animation: ring-shrink 3.5s ease-in infinite; }
.ring-s.d2 { animation-delay: 1.15s; }
.ring-s.d3 { animation-delay: 2.3s; }

/* gentle blink */
@keyframes soft-blink { 0%,100% { opacity:0.3 } 50% { opacity:1 } }
.blink { animation: soft-blink 1.4s ease-in-out infinite; }

/* red guidance beam pulse (step 5) */
@keyframes beam-pulse { 0%,100% { opacity:0.25 } 50% { opacity:1 } }
.beam  { animation: beam-pulse 2s ease-in-out infinite; }
.beam.d2 { animation-delay: 0.35s; }
.beam.d3 { animation-delay: 0.7s; }

/* ILS needle gentle drift inside circle (step 5) */
@keyframes loc-drift { 0%,100% { transform: translateX(-7px) } 50% { transform: translateX(7px) } }
.loc-needle { animation: loc-drift 3.5s ease-in-out infinite; }
@keyframes gs-drift { 0%,100% { transform: translateY(-5px) } 50% { transform: translateY(6px) } }
.gs-needle { animation: gs-drift 4s ease-in-out infinite; }
`;

/* ── Ground + runway (simple perspective, sitting on the ground) ── */
function Ground() {
  return (
    <g>
      {/* horizon ground band */}
      <rect x={0} y={150} width={320} height={50} fill="#0c2030" />
      <line x1={0} y1={150} x2={320} y2={150} stroke="#1a4055" strokeWidth={1} opacity={0.6} />
      {/* runway perspective strip */}
      <polygon points="35,188 95,188 215,152 178,152" fill="#16344a" stroke="#2a6080" strokeWidth={1} />
      {/* centerline dashes */}
      {[0, 1, 2, 3].map((i) => {
        const t = 0.15 + i * 0.2;
        const x1 = 95 + (178 - 95) * t, y1 = 188 + (152 - 188) * t;
        const x2 = 95 + (178 - 95) * (t + 0.1), y2 = 188 + (152 - 188) * (t + 0.1);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} />;
      })}
    </g>
  );
}

/* ── TLS antenna unit: 3 array panels on a base (ASA style) ── */
function TLSUnit({ color = "#00AEEF" }: { color?: string }) {
  return (
    <g transform="translate(48,150)">
      {/* base platform */}
      <rect x={-22} y={6} width={44} height={7} rx={2} fill="#13354c" stroke={color} strokeWidth={0.8} />
      {/* center mast */}
      <rect x={-2} y={-4} width={4} height={12} fill="#1a4866" />
      {/* 3 antenna array panels */}
      <g stroke={color} strokeWidth={1}>
        <rect x={-20} y={-22} width={11} height={26} rx={1.5} fill="#0e2a3e" />
        <rect x={-5}  y={-26} width={11} height={30} rx={1.5} fill="#0e2a3e" />
        <rect x={10}  y={-22} width={11} height={26} rx={1.5} fill="#0e2a3e" />
      </g>
      {/* panel array lines */}
      <g stroke={color} strokeWidth={0.5} opacity={0.6}>
        {[-17, -14, -11].map((x, i) => <line key={"a" + i} x1={x} y1={-20} x2={x} y2={2} />)}
        {[-2, 1, 4].map((x, i) => <line key={"b" + i} x1={x} y1={-24} x2={x} y2={2} />)}
        {[13, 16, 19].map((x, i) => <line key={"c" + i} x1={x} y1={-20} x2={x} y2={2} />)}
      </g>
      <text x={0} y={26} textAnchor="middle" fill={color} fontSize={8} fontFamily="Courier New,monospace" fontWeight="bold">TLS</text>
    </g>
  );
}

/* ── Aircraft side-view, nose pointing LEFT toward runway ── */
function Aircraft({ x, y, color = "#cfe6f5" }: { x: number; y: number; color?: string }) {
  return (
    <g transform={`translate(${x},${y}) scale(-1,1)`}>
      <ellipse cx={0} cy={0} rx={30} ry={6.5} fill="#1c3e5a" stroke={color} strokeWidth={1} />
      {/* nose */}
      <path d="M 30,-3 Q 44,0 30,3 Z" fill={color} opacity={0.9} />
      {/* tail fin */}
      <path d="M -30,-3 L -26,-3 L -27,-17 Q -34,-17 -36,-9 L -36,-3 Z" fill="#1c3e5a" stroke={color} strokeWidth={0.8} />
      {/* wing */}
      <path d="M -4,-6 L 16,-6 L 20,13 L -8,13 Z" fill="#23507a" stroke={color} strokeWidth={0.7} />
      {/* tail wing */}
      <path d="M -26,-3 L -18,-3 L -16,6 L -28,6 Z" fill="#23507a" stroke={color} strokeWidth={0.6} />
      {/* engine */}
      <ellipse cx={6} cy={14} rx={5.5} ry={2.8} fill="#0d2236" stroke={color} strokeWidth={0.7} />
      {/* windows */}
      {[-8, -2, 4, 10, 16].map((wx, i) => (
        <rect key={i} x={wx} y={-2.5} width={3.5} height={2.6} rx={1} fill="rgba(170,225,255,0.65)" />
      ))}
    </g>
  );
}

/* ════ SCENE 1 — radar emits waves toward aircraft ════ */
function Scene1() {
  const ox = 48, oy = 138; // emit origin (top of antenna)
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width={320} height={200} fill={BG} />
      <Ground />
      <Aircraft x={250} y={66} color="#bcd9ef" />
      <TLSUnit color="#00D26A" />
      {/* faint direction cone */}
      <polygon points={`${ox},${oy} 250,52 250,80`} fill="rgba(0,210,106,0.10)" />
      {/* slow expanding wave arcs from radar */}
      <g>
        <circle className="w-emit"    cx={ox} cy={oy} r={120} fill="none" stroke="#00D26A" strokeWidth={2} style={{ transformOrigin: `${ox}px ${oy}px` }} />
        <circle className="w-emit d2" cx={ox} cy={oy} r={120} fill="none" stroke="#00D26A" strokeWidth={1.6} style={{ transformOrigin: `${ox}px ${oy}px` }} />
        <circle className="w-emit d3" cx={ox} cy={oy} r={120} fill="none" stroke="#00D26A" strokeWidth={1.2} style={{ transformOrigin: `${ox}px ${oy}px` }} />
      </g>
      <rect x={120} y={108} width={84} height={18} rx={4} fill="rgba(0,210,106,0.14)" stroke="rgba(0,210,106,0.4)" strokeWidth={0.8} />
      <text x={162} y={120} textAnchor="middle" fill="#00D26A" fontSize={9} fontFamily="Courier New,monospace">1030 MHz ►</text>
    </svg>
  );
}

/* ════ SCENE 2 — aircraft transponder replies (rings from plane) ════ */
function Scene2() {
  const ox = 250, oy = 66;
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width={320} height={200} fill={BG} />
      <Ground />
      <TLSUnit color="#00AEEF" />
      <Aircraft x={ox} y={oy} color="#cfe6f5" />
      {/* pink rings expanding FROM aircraft, plane stays still */}
      <g>
        <circle className="ring-g"    cx={ox} cy={oy} r={75} fill="none" stroke="#ec4ba6" strokeWidth={2.4} style={{ transformOrigin: `${ox}px ${oy}px` }} />
        <circle className="ring-g d2" cx={ox} cy={oy} r={75} fill="none" stroke="#ec4ba6" strokeWidth={1.8} style={{ transformOrigin: `${ox}px ${oy}px` }} />
        <circle className="ring-g d3" cx={ox} cy={oy} r={75} fill="none" stroke="#ec4ba6" strokeWidth={1.3} style={{ transformOrigin: `${ox}px ${oy}px` }} />
      </g>
      <rect x={110} y={108} width={84} height={18} rx={4} fill="rgba(236,75,166,0.14)" stroke="rgba(236,75,166,0.4)" strokeWidth={0.8} />
      <text x={152} y={120} textAnchor="middle" fill="#ec4ba6" fontSize={9} fontFamily="Courier New,monospace">◄ 1090 MHz</text>
    </svg>
  );
}

/* ════ SCENE 3 — TLS measures the reply (rings to radar + lock) ════ */
function Scene3() {
  const ox = 250, oy = 66;
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width={320} height={200} fill={BG} />
      <Ground />
      <TLSUnit color="#ec4ba6" />
      <Aircraft x={ox} y={oy} color="#cfe6f5" />
      {/* rings converging toward the aircraft origin (received reply) */}
      <g>
        <circle className="ring-s"    cx={ox} cy={oy} r={75} fill="none" stroke="#ec4ba6" strokeWidth={2} style={{ transformOrigin: `${ox}px ${oy}px` }} />
        <circle className="ring-s d2" cx={ox} cy={oy} r={75} fill="none" stroke="#ec4ba6" strokeWidth={1.5} style={{ transformOrigin: `${ox}px ${oy}px` }} />
        <circle className="ring-s d3" cx={ox} cy={oy} r={75} fill="none" stroke="#ec4ba6" strokeWidth={1.1} style={{ transformOrigin: `${ox}px ${oy}px` }} />
      </g>
      {/* lock reticle on aircraft */}
      <circle className="blink" cx={ox} cy={oy} r={20} fill="none" stroke="#FFD166" strokeWidth={1} strokeDasharray="3 3" />
      <line x1={ox} y1={oy - 26} x2={ox} y2={oy - 17} stroke="#FFD166" strokeWidth={1.2} />
      <line x1={ox} y1={oy + 17} x2={ox} y2={oy + 26} stroke="#FFD166" strokeWidth={1.2} />
      <line x1={ox - 26} y1={oy} x2={ox - 17} y2={oy} stroke="#FFD166" strokeWidth={1.2} />
      <line x1={ox + 17} y1={oy} x2={ox + 26} y2={oy} stroke="#FFD166" strokeWidth={1.2} />
      <text x={ox} y={oy + 38} textAnchor="middle" fill="#FFD166" fontSize={8} fontFamily="Courier New,monospace">POSITION LOCK</text>
    </svg>
  );
}

/* ════ SCENE 4 — displacement from approach path ════ */
function Scene4() {
  const C = "#00AEEF";
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width={320} height={200} fill={BG} />
      <Ground />
      <TLSUnit color={C} />
      {/* desired approach path (glide slope) from runway up to the right */}
      <line x1={60} y1={150} x2={290} y2={55} stroke={C} strokeWidth={1.6} opacity={0.7} />
      <line x1={60} y1={150} x2={290} y2={55} stroke={C} strokeWidth={9} opacity={0.06} />
      <text x={150} y={150} textAnchor="middle" fill={C} fontSize={8} fontFamily="Courier New,monospace" opacity={0.75}>DESIRED APPROACH PATH</text>
      {/* aircraft above the path (static) */}
      <Aircraft x={232} y={50} color="#ff7a7a" />
      {/* displacement arrow from aircraft down to path */}
      <g className="blink">
        <line x1={232} y1={58} x2={232} y2={84} stroke="#ff7a7a" strokeWidth={2} strokeDasharray="3 2" />
        <polygon points="228,84 232,92 236,84" fill="#ff7a7a" />
        <text x={240} y={78} fill="#ff7a7a" fontSize={8} fontFamily="Courier New,monospace">Δ DISP</text>
      </g>
    </svg>
  );
}

/* ════ SCENE 5 — ILS guidance + cockpit instrument (blue circle) ════ */
function Scene5() {
  const cx = 268, cy = 56, R = 34; // instrument center
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width={320} height={200} fill={BG} />
      <Ground />
      <TLSUnit color="#ff5252" />
      <Aircraft x={150} y={92} color="#bfe6bf" />
      {/* red guidance beams TLS -> aircraft */}
      <line className="beam"    x1={48} y1={140} x2={150} y2={84}  stroke="#ff5252" strokeWidth={2} />
      <line className="beam d2" x1={48} y1={143} x2={150} y2={92}  stroke="#ff7070" strokeWidth={2.4} />
      <line className="beam d3" x1={48} y1={146} x2={150} y2={100} stroke="#ff5252" strokeWidth={2} />

      {/* ── Cockpit ILS indicator: blue circle with crosshair ── */}
      <circle cx={cx} cy={cy} r={R + 4} fill="#0a1824" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={R} fill="#5a9bc8" />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#2a4a66" strokeWidth={1} />
      {/* horizontal GS needle (dashed white) */}
      <g className="gs-needle">
        <line x1={cx - R + 3} y1={cy} x2={cx + R - 3} y2={cy} stroke="#fff" strokeWidth={1.6} strokeDasharray="4 3" />
      </g>
      {/* vertical LOC needle (dashed white) */}
      <g className="loc-needle">
        <line x1={cx} y1={cy - R + 3} x2={cx} y2={cy + R - 3} stroke="#fff" strokeWidth={1.6} strokeDasharray="4 3" />
      </g>
      {/* scale dots on crosshair */}
      {[-2, -1, 1, 2].map((k) => (
        <circle key={"h" + k} cx={cx + k * 9} cy={cy} r={1.4} fill="rgba(255,255,255,0.5)" />
      ))}
      {[-2, -1, 1, 2].map((k) => (
        <circle key={"v" + k} cx={cx} cy={cy + k * 9} r={1.4} fill="rgba(255,255,255,0.5)" />
      ))}
      {/* center */}
      <circle cx={cx} cy={cy} r={2.2} fill="#fff" />
      <text x={cx} y={cy + R + 16} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={7} fontFamily="Courier New,monospace">ILS INDICATOR</text>

      <text x={150} y={182} textAnchor="middle" fill="#00D26A" fontSize={9} fontFamily="Courier New,monospace" fontWeight="bold">✓ ON GLIDE PATH</text>
    </svg>
  );
}

const STEPS = [
  { n: 1, color: "#00D26A", label: "INTERROGATION 1030 MHz",
    en: "TLS interrogates all aircraft transponders within the service volume",
    ar: "يرسل TLS إشارة استجواب بتردد 1030 MHz لجميع الطائرات في نطاق الخدمة",
    scene: <Scene1 /> },
  { n: 2, color: "#ec4ba6", label: "TRANSPONDER REPLY 1090 MHz",
    en: "Aircraft transponders respond to the interrogation signal",
    ar: "ترد أجهزة الطائرة (Transponder) بتردد 1090 MHz",
    scene: <Scene2 /> },
  { n: 3, color: "#FFD166", label: "SENSORS MEASURE REPLY",
    en: "TLS sensors measure each reply and determine the aircraft position",
    ar: "تقيس حساسات TLS كل رد وتحدد موضع الطائرة بدقة",
    scene: <Scene3 /> },
  { n: 4, color: "#ff7a7a", label: "DISPLACEMENT CALCULATION",
    en: "TLS determines the aircraft displacement from the desired approach path",
    ar: "يحسب TLS انحراف الطائرة عن مسار الاقتراب المطلوب",
    scene: <Scene4 /> },
  { n: 5, color: "#ff5252", label: "ILS GUIDANCE SIGNAL",
    en: "TLS transmits ILS guidance shown on the cockpit ILS indicator",
    ar: "يرسل TLS إشارة توجيه ILS تظهر على مؤشر ILS في قمرة القيادة",
    scene: <Scene5 /> },
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

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", flexShrink: 0,
        background: "rgba(8,20,32,0.97)", borderBottom: "1px solid rgba(0,174,239,0.18)" }}>
        <BackButton />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#d0e8f8", fontFamily: "Courier New,monospace", letterSpacing: 2 }}>
            TLS OPERATION
          </div>
          <div style={{ fontSize: 9, color: "rgba(0,174,239,0.55)", fontFamily: "Courier New,monospace", letterSpacing: 3 }}>
            OPERATIONAL SEQUENCE
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: step.color, fontFamily: "Courier New,monospace",
            lineHeight: 1, textShadow: `0 0 12px ${step.color}` }}>{cur + 1}</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "Courier New,monospace" }}>OF 5</div>
        </div>
      </div>

      {/* step label */}
      <div key={`l${tick}`} className="fade-in" style={{ padding: "7px 16px 5px",
        background: `linear-gradient(90deg, ${step.color}18 0%, transparent 100%)`,
        borderBottom: `1px solid ${step.color}25`, borderLeft: `4px solid ${step.color}`, flexShrink: 0 }}>
        <span style={{ fontFamily: "Courier New,monospace", fontSize: 10, fontWeight: 700, color: step.color, letterSpacing: "0.12em" }}>
          STEP {step.n} — {step.label}
        </span>
      </div>

      {/* animation area */}
      <div key={`s${tick}`} className="fade-in" style={{ flex: 1, position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        {step.scene}
      </div>

      {/* description */}
      <div key={`d${tick}`} className="fade-in" style={{ padding: "8px 16px 6px", flexShrink: 0,
        background: "rgba(8,20,32,0.9)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontFamily: "Inter,sans-serif", fontSize: 12, lineHeight: 1.55, color: "rgba(255,255,255,0.88)" }}>{step.en}</div>
        <div style={{ fontFamily: "Inter,sans-serif", fontSize: 10.5, lineHeight: 1.5, color: `${step.color}cc`, marginTop: 3, direction: "rtl" }}>{step.ar}</div>
      </div>

      {/* progress bar */}
      <div style={{ flexShrink: 0, height: 3, background: "rgba(255,255,255,0.06)" }}>
        <div key={tick} className="pbar" style={{ height: "100%", background: `linear-gradient(90deg,${step.color},${step.color}88)`, borderRadius: 2 }} />
      </div>

      {/* progress dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "8px 0 10px", flexShrink: 0, background: "rgba(8,20,32,0.95)" }}>
        {STEPS.map((s, idx) => (
          <div key={idx} onClick={() => { setCur(idx); setTick((t) => t + 1); }}
            style={{ width: idx === cur ? 24 : 7, height: 7, borderRadius: 4,
              background: idx === cur ? s.color : idx < cur ? `${s.color}55` : "rgba(255,255,255,0.12)",
              boxShadow: idx === cur ? `0 0 10px ${s.color}` : "none", transition: "all 0.4s ease", cursor: "pointer" }} />
        ))}
      </div>
    </div>
  );
}
