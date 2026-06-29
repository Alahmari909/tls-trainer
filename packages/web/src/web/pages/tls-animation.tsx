import { useState, useEffect } from "react";
import BackButton from "../components/BackButton";
import s1 from "../assets/anim/s1.jpg";
import s2 from "../assets/anim/s2.jpg";
import s3 from "../assets/anim/s3.jpg";
import s4 from "../assets/anim/s4.jpg";
import s5 from "../assets/anim/s5.jpg";

const BG = "#050d1c";

const CSS = `
@keyframes step-in { from { opacity:0 } to { opacity:1 } }
.fade-in { animation: step-in 0.7s ease both; }

@keyframes prog { from { width:0 } to { width:100% } }
.pbar { animation: prog 10s linear forwards; }

@keyframes kb { 0% { transform: scale(1.015) } 100% { transform: scale(1.09) } }
.kb { animation: kb 11s ease-out both; }

@keyframes scan { 0% { transform: translateY(-110%) } 100% { transform: translateY(110%) } }
.scan { animation: scan 5s linear infinite; }
`;

const STEPS = [
  {
    n: 1,
    color: "#00D26A",
    label: "INTERROGATION 1030 MHz",
    badge: "1030 MHz ►",
    img: s1,
    en: "TLS interrogates all aircraft transponders within the service volume.",
    ar: "يرسل نظام TLS إشارة استجواب بتردد 1030 MHz لجميع الطائرات داخل نطاق الخدمة.",
  },
  {
    n: 2,
    color: "#ec4ba6",
    label: "TRANSPONDER REPLY 1090 MHz",
    badge: "◄ 1090 MHz",
    img: s2,
    en: "Aircraft transponders respond to the interrogation signal.",
    ar: "يرد جهاز الإرسال (Transponder) في الطائرة على إشارة الاستجواب بتردد 1090 MHz.",
  },
  {
    n: 3,
    color: "#FFD166",
    label: "SENSORS MEASURE REPLY",
    badge: "MLAT FIX",
    img: s3,
    en: "Ground sensor arrays measure each reply and fix the aircraft position.",
    ar: "تقيس حساسات الاستقبال الأرضية كل رد وتحدد موضع الطائرة بدقة (Multilateration).",
  },
  {
    n: 4,
    color: "#3fb6ff",
    label: "APPROACH PATH TRACKING",
    badge: "Δ DISPLACEMENT",
    img: s4,
    en: "TLS computes the aircraft displacement from the desired approach path.",
    ar: "يحسب النظام انحراف الطائرة عن مسار الاقتراب المطلوب نحو المدرج.",
  },
  {
    n: 5,
    color: "#ff5252",
    label: "ILS / PAR GUIDANCE",
    badge: "GUIDANCE ACTIVE",
    img: s5,
    en: "TLS transmits ILS-equivalent guidance for a precision controlled approach.",
    ar: "يرسل النظام إشارة توجيه مكافئة لنظام ILS لتنفيذ اقتراب دقيق ومُوجَّه.",
  },
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

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", flexShrink: 0, background: "rgba(5,13,28,0.97)", borderBottom: "1px solid rgba(0,174,239,0.18)" }}>
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

      {/* ── STEP LABEL ── */}
      <div key={`l${tick}`} className="fade-in" style={{ padding: "7px 16px 5px", background: `linear-gradient(90deg, ${step.color}18 0%, transparent 100%)`, borderBottom: `1px solid ${step.color}25`, borderLeft: `4px solid ${step.color}`, flexShrink: 0 }}>
        <span style={{ fontFamily: "Courier New,monospace", fontSize: 10, fontWeight: 700, color: step.color, letterSpacing: "0.12em" }}>STEP {step.n} — {step.label}</span>
      </div>

      {/* ── SCENE (real 3D render frame) ── */}
      <div key={`s${tick}`} className="fade-in" style={{ flex: 1, position: "relative", overflow: "hidden", background: BG }}>
        {/* blurred fill so landscape frames sit cleanly in any aspect */}
        <div
          style={{
            position: "absolute",
            inset: -30,
            backgroundImage: `url(${step.img})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(26px) brightness(0.42)",
          }}
        />
        {/* sharp framed render */}
        <img
          key={`img${tick}`}
          src={step.img}
          alt={step.label}
          className="kb"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
        />
        {/* subtle sensor-sweep line in step color */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div className="scan" style={{ position: "absolute", left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${step.color}, transparent)`, opacity: 0.16 }} />
        </div>
        {/* technical badge */}
        <div style={{ position: "absolute", top: 12, right: 12, padding: "4px 10px", borderRadius: 5, background: "rgba(5,13,28,0.72)", border: `1px solid ${step.color}66`, color: step.color, fontFamily: "Courier New,monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", boxShadow: `0 0 14px ${step.color}33` }}>
          {step.badge}
        </div>
        {/* step-color inner glow + legibility gradients */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", boxShadow: `inset 0 0 70px ${step.color}1f`, background: "linear-gradient(180deg, rgba(5,13,28,0.45) 0%, transparent 22%, transparent 80%, rgba(5,13,28,0.55) 100%)" }} />
      </div>

      {/* ── DESCRIPTION ── */}
      <div key={`d${tick}`} className="fade-in" style={{ padding: "9px 16px 7px", flexShrink: 0, background: "rgba(5,13,28,0.92)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontFamily: "Inter,sans-serif", fontSize: 12, lineHeight: 1.55, color: "rgba(255,255,255,0.88)" }}>{step.en}</div>
        <div style={{ fontFamily: "Inter,sans-serif", fontSize: 11.5, lineHeight: 1.6, color: `${step.color}dd`, marginTop: 4, direction: "rtl", fontWeight: 500 }}>{step.ar}</div>
      </div>

      {/* ── PROGRESS ── */}
      <div style={{ flexShrink: 0, height: 3, background: "rgba(255,255,255,0.06)" }}>
        <div key={tick} className="pbar" style={{ height: "100%", background: `linear-gradient(90deg,${step.color},${step.color}88)`, borderRadius: 2 }} />
      </div>

      {/* ── STEP DOTS ── */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "8px 0 10px", flexShrink: 0, background: "rgba(5,13,28,0.95)" }}>
        {STEPS.map((s, idx) => (
          <div
            key={idx}
            onClick={() => { setCur(idx); setTick((t) => t + 1); }}
            style={{ width: idx === cur ? 24 : 7, height: 7, borderRadius: 4, background: idx === cur ? s.color : idx < cur ? `${s.color}55` : "rgba(255,255,255,0.12)", boxShadow: idx === cur ? `0 0 10px ${s.color}` : "none", transition: "all 0.4s ease", cursor: "pointer" }}
          />
        ))}
      </div>
    </div>
  );
}
