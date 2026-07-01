import { Link, useLocation } from "wouter";
import { useEffect, useState, useRef, useCallback } from "react";
import { getSession, setSession, clearSession } from "../hooks/useTelegramTrack";
import type { TraineeSession } from "../hooks/useTelegramTrack";
import { unlockAudio, playAlertTone, vibrate, showToast } from "../lib/audio";
import { useLanguage } from "../hooks/useLanguage";

type Module = { id: number; title: string; order: number };
type ProgressRow = { moduleId: number; progress: number; completed: number };
type Streak = { currentStreak: number; longestStreak: number; totalXp: number };
type TraineeListItem = { id: string; name: string; rank: string | null; unit: string | null; created_at: number };
type Notification = { id: number; message?: string; text?: string; alert_type?: string; sender_role?: string; read: number; ts: number };

const COLORS = ["#00AEEF","#35D4FF","#00D26A","#FFD166","#00AEEF","#35D4FF","#C9A66B","#00D26A","#FF4D4D"];

function RadarRings() {
  return (
    <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:320,height:320,pointerEvents:"none" }}>
      {[1,2,3].map(n=>(
        <div key={n} style={{ position:"absolute",inset:0,borderRadius:"50%",border:`1px solid rgba(0,174,239,${0.18-n*0.04})`,animation:`radar-ring ${2.5+n*0.6}s ease-in-out infinite`,animationDelay:`${n*0.4}s`,transform:`scale(${0.3+n*0.22})` }} />
      ))}
      <div style={{ position:"absolute",top:"50%",left:"50%",width:"50%",height:1,transformOrigin:"0 50%",background:"linear-gradient(90deg,rgba(0,174,239,0.7),transparent)",animation:"radar-sweep 3s linear infinite" }} />
      <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"#00AEEF",boxShadow:"0 0 10px #00AEEF,0 0 20px rgba(0,174,239,0.5)",animation:"pulse-glow 1.5s ease infinite" }} />
    </div>
  );
}

function useLiveClock() {
  const fmt = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2,"0");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const mon = months[now.getMonth()];
    const yr = now.getFullYear();
    let h = now.getHours();
    const ampm = h>=12?"PM":"AM";
    h = h%12||12;
    const min = String(now.getMinutes()).padStart(2,"0");
    return `${day} ${mon} ${yr} · ${String(h).padStart(2,"0")}:${min} ${ampm}`;
  };
  const [clock,setClock] = useState(fmt);
  useEffect(()=>{ const id=setInterval(()=>setClock(fmt()),1000); return()=>clearInterval(id); },[]);
  return clock;
}

function XpBar({ xp }: { xp: number }) {
  const level = Math.floor(xp/500)+1;
  const pct = (xp%500)/5;
  return (
    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
      <div className="font-orbitron" style={{ fontSize:9,color:"#FFD166",letterSpacing:"0.1em",flexShrink:0 }}>LVL {level}</div>
      <div style={{ flex:1,height:4,background:"rgba(255,255,255,0.08)",borderRadius:2,overflow:"hidden" }}>
        <div style={{ height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#FFD166,#C9A66B)",borderRadius:2,transition:"width 0.8s ease" }} />
      </div>
      <div className="font-orbitron" style={{ fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:"0.05em",flexShrink:0 }}>{xp} XP</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   LOGIN / REGISTER SCREEN
───────────────────────────────────────────────────────── */
function LoginScreen({ onLogin }: { onLogin: (s: TraineeSession) => void }) {
  const [mode, setMode] = useState<"pick"|"register"|"login"|"pending">("pick");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [forceLogoutMsg] = useState(() => {
    const msg = sessionStorage.getItem('tls_force_logout_reason');
    if (msg) { sessionStorage.removeItem('tls_force_logout_reason'); return msg; }
    return null;
  });

  // Register fields
  const [name, setName]   = useState("");
  const [rank, setRank]   = useState("");
  const [unit, setUnit]   = useState("");
  const [airBase, setAirBase] = useState("");
  const [years, setYears] = useState("");
  const [pin,  setPin]    = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pendingName, setPendingName] = useState("");

  // Login
  const [loginName, setLoginName] = useState("");
  const [loginPin, setLoginPin] = useState("");

  const doRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockAudio();
    if (!name.trim())  { setError("Full name is required"); return; }
    if (!pin.trim() || !/^\d{4,8}$/.test(pin.trim())) { setError("PIN must be 4-8 digits"); return; }
    if (pin !== confirmPin) { setError("PIN confirmation does not match"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/trainee/register", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          name: name.trim(), rank: rank.trim()||undefined,
          unit: unit.trim()||undefined, air_base: airBase.trim()||undefined,
          years_of_service: years ? parseInt(years) : undefined,
          pin: pin.trim(),
        }),
      });
      const data = await res.json() as { ok:boolean; pending?:boolean; requestId?:string; error?:string };
      if (!data.ok) { setError(data.error ?? "Registration failed"); return; }
      // Show pending screen
      setPendingName(name.trim());
      setMode("pending");
    } catch { setError("Connection error"); } finally { setLoading(false); }
  };

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockAudio();
    if (!loginName.trim()) { setError("الرجاء كتابة اسمك"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/trainee/login", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ name:loginName.trim(), pin:loginPin.trim()||undefined }),
      });
      const data = await res.json() as { ok:boolean; id?:string; name?:string; rank?:string|null; unit?:string|null; error?:string; message?:string };
      if (res.status===403 && data.error==='blocked')    { setError(data.message ?? 'Your account is blocked. Contact your instructor.'); return; }
      if (res.status===403 && data.error==='suspended')  { setError(data.message ?? 'Your account is temporarily suspended.'); return; }
      if (!data.ok || !data.id) { setError(data.error ?? "Invalid credentials"); return; }
      const session: TraineeSession = { id:data.id, name:data.name!, rank:data.rank, unit:data.unit };
      setSession(session);
      fetch("/api/track",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ type:"login", userId:data.id, traineeName:data.name }) }).catch(()=>{});
      onLogin(session);
    } catch { setError("Connection error"); } finally { setLoading(false); }
  };

  const C = { cyan:"#00AEEF", navy:"#071426" };
  const cardStyle: React.CSSProperties = {
    padding:24, border:"1px solid rgba(0,174,239,0.25)",
    background:"rgba(7,20,38,0.85)", borderRadius:16,
    backdropFilter:"blur(12px)",
  };
  const inputStyle: React.CSSProperties = {
    width:"100%", padding:"10px 12px", boxSizing:"border-box" as const,
    background:"rgba(0,0,0,0.3)", border:"1px solid rgba(0,174,239,0.3)",
    borderRadius:8, color:"#fff", fontSize:13, outline:"none", fontFamily:"inherit",
  };

  return (
    <div className="page" style={{
      background:"var(--bg-primary)", minHeight:"100vh",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"24px",
    }}>
      <style>{`
        @keyframes radar-ring { 0%,100%{opacity:0.4}50%{opacity:0.9} }
        @keyframes radar-sweep { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse-glow { 0%,100%{opacity:1;transform:translate(-50%,-50%) scale(1)} 50%{opacity:0.6;transform:translate(-50%,-50%) scale(1.3)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {[{top:16,left:16},{top:16,right:16},{bottom:16,left:16},{bottom:16,right:16}].map((pos,i)=>(
        <div key={i} style={{
          position:"fixed",...pos,width:16,height:16,
          borderTop:i<2?"2px solid rgba(0,174,239,0.5)":undefined,
          borderBottom:i>=2?"2px solid rgba(0,174,239,0.5)":undefined,
          borderLeft:(i===0||i===2)?"2px solid rgba(0,174,239,0.5)":undefined,
          borderRight:(i===1||i===3)?"2px solid rgba(0,174,239,0.5)":undefined,
        }} />
      ))}

      {/* Logo */}
      <div style={{ textAlign:"center", marginBottom:32 }}>
        <div className="font-orbitron" style={{ fontSize:28,fontWeight:700,color:"#fff",letterSpacing:"0.05em" }}>TLS TRAINER</div>
        <div style={{ fontFamily:"Inter",fontSize:9,letterSpacing:"0.2em",color:"#00AEEF",marginTop:4 }}>TRANSPONDER LANDING SYSTEM</div>
        <div style={{ fontFamily:"Inter",fontSize:7,letterSpacing:"0.15em",color:"rgba(0,174,239,0.5)",marginTop:6 }}>◈ GROUND RADAR UNIT · ANPC · JEDDAH ◈</div>
      </div>

      <div style={{ width:"100%", maxWidth:400 }}>
        {forceLogoutMsg && (
          <div style={{ padding:"12px 16px",marginBottom:16,borderRadius:10,background:"rgba(255,77,77,0.12)",border:"1px solid rgba(255,77,77,0.4)",color:"#FF4D4D",fontSize:12,textAlign:"center",lineHeight:1.5 }}>
            🚫 {forceLogoutMsg}
          </div>
        )}

        {/* PICK */}
        {mode==="pick" && (
          <div style={cardStyle}>
            <div className="font-orbitron" style={{ fontSize:11,color:C.cyan,letterSpacing:"0.15em",textAlign:"center",marginBottom:24 }}>
              IDENTIFY YOURSELF
            </div>
            <button onClick={()=>setMode("register")} style={{
              width:"100%",padding:"14px 0",marginBottom:12,
              background:"linear-gradient(135deg,#00AEEF20,#35D4FF15)",
              border:"1px solid #00AEEF60",borderRadius:10,cursor:"pointer",
              color:"#00AEEF",fontFamily:"Inter",fontSize:12,letterSpacing:"0.1em",
            }}>+ NEW TRAINEE REGISTRATION</button>
            <button onClick={()=>setMode("login")} style={{
              width:"100%",padding:"14px 0",
              background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,cursor:"pointer",
              color:"rgba(255,255,255,0.5)",fontFamily:"Inter",fontSize:12,letterSpacing:"0.1em",
            }}>REGISTERED TRAINEE LOGIN</button>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:16 }}>
              <div style={{ flex:1,height:1,background:"rgba(255,255,255,0.07)" }} />
              <div style={{ fontSize:9,color:"rgba(255,255,255,0.2)",fontFamily:"Inter",letterSpacing:"0.12em" }}>OR</div>
              <div style={{ flex:1,height:1,background:"rgba(255,255,255,0.07)" }} />
            </div>
            <button onClick={()=>onLogin({ id:'guest', name:'GUEST', rank:null, unit:null })} style={{
              width:"100%",padding:"12px 0",marginTop:12,
              background:"transparent",
              border:"1px solid rgba(255,215,0,0.18)",borderRadius:10,cursor:"pointer",
              color:"rgba(255,215,0,0.55)",fontFamily:"Inter",fontSize:11,letterSpacing:"0.12em",
              display:"flex",alignItems:"center",justifyContent:"center",gap:6,
            }}>
              <span style={{fontSize:14}}>👁</span> BROWSE AS GUEST <span style={{fontSize:9,color:"rgba(255,215,0,0.3)"}}>(LIMITED)</span>
            </button>
          </div>
        )}

        {/* REGISTER FORM */}
        {mode==="register" && (
          <form onSubmit={doRegister} style={cardStyle}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:20 }}>
              <button type="button" onClick={()=>{setMode("pick");setError("");}}
                style={{ background:"none",border:"none",color:C.cyan,cursor:"pointer",padding:4,fontSize:18 }}>←</button>
              <div className="font-orbitron" style={{ fontSize:11,color:C.cyan,letterSpacing:"0.15em" }}>NEW REGISTRATION REQUEST</div>
            </div>

            <div style={{ fontSize:10,color:"rgba(0,174,239,0.6)",fontFamily:"Inter",marginBottom:16,lineHeight:1.6,padding:"10px 12px",background:"rgba(0,174,239,0.06)",borderRadius:8,border:"1px solid rgba(0,174,239,0.15)" }}>
              Your request will be reviewed by the admin before your account is activated
            </div>

            {[
              { label:"FULL NAME *", val:name, set:setName, ph:"e.g. Mohammed Al-Otaibi", type:"text" },
              { label:"MILITARY RANK", val:rank, set:setRank, ph:"e.g. Sergeant, Lieutenant, Captain", type:"text" },
              { label:"UNIT / SECTION", val:unit, set:setUnit, ph:"e.g. Ground Radar", type:"text" },
              { label:"AIR BASE", val:airBase, set:setAirBase, ph:"e.g. King Abdulaziz Air Base", type:"text" },
              { label:"YEARS OF SERVICE", val:years, set:setYears, ph:"e.g. 5", type:"number" },
              { label:"ACCESS PIN (4-8 digits) *", val:pin, set:setPin, ph:"Enter access PIN", type:"password" },
              { label:"CONFIRM PIN *", val:confirmPin, set:setConfirmPin, ph:"Re-enter access PIN", type:"password" },
            ].map(f=>(
              <div key={f.label} style={{ marginBottom:12 }}>
                <div style={{ fontSize:9,fontFamily:"Inter",color:C.cyan,letterSpacing:"0.1em",marginBottom:5 }}>{f.label}</div>
                <input type={f.type} value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
                  inputMode={f.type==="number"||f.type==="password"?"numeric":undefined}
                  style={inputStyle} />
              </div>
            ))}

            {error && <div style={{ color:"#FF4D4D",fontSize:12,marginBottom:12,textAlign:"center" }}>{error}</div>}

            <button type="submit" disabled={loading} style={{
              width:"100%",padding:"14px 0",marginTop:4,
              background:loading?"rgba(0,174,239,0.2)":"linear-gradient(135deg,#00AEEF,#35D4FF)",
              border:"none",borderRadius:10,cursor:loading?"not-allowed":"pointer",
              color:loading?"rgba(255,255,255,0.5)":"#fff",fontFamily:"Inter",fontSize:12,letterSpacing:"0.1em",fontWeight:700,
            }}>
              {loading ? "SUBMITTING..." : "SUBMIT REGISTRATION REQUEST"}
            </button>
          </form>
        )}

        {/* PENDING SCREEN */}
        {mode==="pending" && (
          <div style={{ ...cardStyle, textAlign:"center", animation:"fadeUp 0.4s ease" }}>
            <div style={{ fontSize:52,marginBottom:16 }}>🕐</div>
            <div className="font-orbitron" style={{ fontSize:13,color:C.cyan,letterSpacing:"0.15em",marginBottom:12 }}>
              REQUEST UNDER REVIEW
            </div>
            <div style={{ fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.7,marginBottom:20 }}>
              Your registration request has been submitted as <strong style={{ color:"#fff" }}>{pendingName}</strong><br/>
              The admin will review and activate your account shortly.<br/>
              Once approved, use <em>"Registered Trainee Login"</em> to sign in
            </div>
            <div style={{ padding:"12px 16px",background:"rgba(0,174,239,0.06)",border:"1px solid rgba(0,174,239,0.15)",borderRadius:10,marginBottom:20 }}>
              <div style={{ fontSize:10,color:"rgba(0,174,239,0.5)",fontFamily:"Orbitron, monospace",letterSpacing:"0.15em",marginBottom:6 }}>REGISTRATION STATUS</div>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                <div style={{ width:8,height:8,borderRadius:"50%",background:"#FFD166",animation:"pulse-glow 1.4s infinite" }} />
                <span style={{ color:"#FFD166",fontSize:12,fontFamily:"Inter",fontWeight:600 }}>PENDING ADMIN APPROVAL</span>
              </div>
            </div>
            <button onClick={()=>{setMode("pick");setName("");setRank("");setUnit("");setAirBase("");setYears("");setPin("");setConfirmPin("");}} style={{
              padding:"10px 24px",background:"rgba(255,255,255,0.05)",
              border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,
              color:"rgba(255,255,255,0.45)",fontFamily:"Inter",fontSize:12,cursor:"pointer",
            }}>BACK TO HOME</button>
          </div>
        )}

        {/* LOGIN */}
        {mode==="login" && (
          <form onSubmit={doLogin} style={cardStyle}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:20 }}>
              <button type="button" onClick={()=>{setMode("pick");setError("");}}
                style={{ background:"none",border:"none",color:C.cyan,cursor:"pointer",padding:4,fontSize:18 }}>←</button>
              <div className="font-orbitron" style={{ fontSize:11,color:C.cyan,letterSpacing:"0.15em" }}>دخول المتدرب</div>
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:9,fontFamily:"Inter",color:C.cyan,letterSpacing:"0.1em",marginBottom:6 }}>اسمك</div>
              <input type="text" value={loginName} onChange={e=>setLoginName(e.target.value)}
                placeholder="اكتب اسمك" autoComplete="off" style={inputStyle} />
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:9,fontFamily:"Inter",color:C.cyan,letterSpacing:"0.1em",marginBottom:6 }}>رمز الدخول</div>
              <input type="password" value={loginPin} onChange={e=>setLoginPin(e.target.value)}
                placeholder="أدخل رمز الدخول" inputMode="numeric" style={inputStyle} />
            </div>

            {error && <div style={{ color:"#FF4D4D",fontSize:12,marginBottom:12,textAlign:"center",lineHeight:1.5 }}>{error}</div>}

            <button type="submit" disabled={loading||!loginName.trim()} style={{
              width:"100%",padding:"14px 0",
              background:(!loginName.trim()||loading)?"rgba(0,174,239,0.15)":"linear-gradient(135deg,#00AEEF,#35D4FF)",
              border:"none",borderRadius:10,cursor:(!loginName.trim()||loading)?"not-allowed":"pointer",
              color:(!loginName.trim()||loading)?"rgba(255,255,255,0.35)":"#fff",
              fontFamily:"Inter",fontSize:12,letterSpacing:"0.1em",fontWeight:700,
            }}>
              {loading?"جاري الدخول...":"دخول"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}


/* ─── Daily TLS Tip data ─────────────────────────────────────────────────── */
const DAILY_TIPS = [
  { cat: "ILS / LOC",     icon: "📡", ar: "الـ Localizer يعمل على تردد بين 108.10 و 111.95 MHz، ويُرسل إشارتين (CSB و SBO) لتحديد انحراف الطائرة يميناً أو يساراً عن المنتصف.", en: "Localizer operates between 108.10–111.95 MHz, transmitting CSB & SBO signals to detect aircraft lateral deviation." },
  { cat: "Glide Slope",   icon: "📐", ar: "زاوية انحدار الـ Glide Slope في TLS هي 3 درجات، ويُحدِّد DDM=0 نقطة المسار الصحيح بدقة 0.175 DDM عند الحدين.", en: "TLS glide slope angle is 3°. DDM=0 defines the correct path, with limits at ±0.175 DDM." },
  { cat: "DDM",           icon: "🔢", ar: "DDM (Difference in Depth of Modulation) يقيس الفرق بين 90Hz و 150Hz. DDM=0 يعني مركز المسار تماماً.", en: "DDM measures the difference between 90Hz & 150Hz modulation depths. DDM=0 = exact path center." },
  { cat: "VSWR",          icon: "⚡", ar: "VSWR (Voltage Standing Wave Ratio) يجب ألا يتجاوز 1.5:1 في أنظمة TLS. القيمة المثالية هي 1:1 (لا انعكاس للطاقة).", en: "VSWR must not exceed 1.5:1 in TLS systems. Ideal value is 1:1 (no reflected power)." },
  { cat: "ESA",           icon: "📶", ar: "هوائي ESA (Electronically Steered Array) يتحكم في شعاع الإشارة إلكترونياً دون حركة ميكانيكية، مما يزيد الدقة والاستجابة.", en: "ESA (Electronically Steered Array) controls beam direction electronically without mechanical movement, improving accuracy and response time." },
  { cat: "صيانة",        icon: "🔧", ar: "تحقق دائماً من مستوى الإشارة RF قبل وبعد أي تعديل على الهوائي. أي تغيير يؤثر مباشرةً على معايرة DDM.", en: "Always check RF signal level before and after any antenna adjustment — any change directly affects DDM calibration." },
  { cat: "ILS Categories",icon: "🛫", ar: "CAT I: رؤية ≥800m. CAT II: رؤية ≥400m. CAT III: رؤية أقل من 200m أو صفر. كل فئة تتطلب معايير دقة أعلى.", en: "CAT I: visibility ≥800m. CAT II: ≥400m. CAT III: <200m or zero. Each category demands higher accuracy standards." },
  { cat: "Integrity",     icon: "🛡️", ar: "مراقب النزاهة (Integrity Monitor) في TLS يكتشف أي انحراف في الإشارة خلال 6 ثواني ويُوقف الإرسال تلقائياً.", en: "TLS Integrity Monitor detects signal deviation within 6 seconds and automatically halts transmission." },
  { cat: "Marker Beacon", icon: "🔔", ar: "نقاط الـ Marker Beacon الثلاث: Outer (400Hz/أزرق)، Middle (1300Hz/أصفر)، Inner (3000Hz/أبيض). تُحدد مراحل الاقتراب.", en: "Three marker beacons: Outer (400Hz/blue), Middle (1300Hz/amber), Inner (3000Hz/white). They mark approach phases." },
  { cat: "GP vs LOC",     icon: "↕️", ar: "الـ Glide Path يعمل على UHF (329–335 MHz)، بينما الـ Localizer يعمل على VHF (108–112 MHz). كلاهما مقترنان تلقائياً.", en: "Glide Path operates on UHF (329–335 MHz), while Localizer uses VHF (108–112 MHz). They are automatically paired." },
  { cat: "معايرة",        icon: "🎯", ar: "معايرة TLS تتطلب طائرة معايرة (Flight Inspection) معتمدة. لا تُعدِّل الجهاز بدون موافقة فريق ANPC الفني.", en: "TLS calibration requires a certified Flight Inspection aircraft. Never adjust equipment without ANPC technical team approval." },
  { cat: "RCU",           icon: "🖥️", ar: "RCU (Remote Control Unit) يُتيح التحكم الكامل في منظومة TLS عن بُعد، بما في ذلك تشغيل/إيقاف وقراءة المنبهات.", en: "RCU (Remote Control Unit) enables full remote control of the TLS system, including power, alarms, and status monitoring." },
  { cat: "CSB/SBO",       icon: "📻", ar: "CSB (Carrier + Sideband) يحمل الإشارة الرئيسية. SBO (Sideband Only) يُنشئ نمط DDM. التوازن بينهما يُحدد دقة المسار.", en: "CSB (Carrier+Sideband) carries the main signal. SBO (Sideband Only) creates the DDM pattern. Their balance defines path accuracy." },
  { cat: "Critical Area",  icon: "🚧", ar: "المنطقة الحساسة (Critical Area) يجب أن تكون خالية من المركبات والطائرات أثناء العمليات. أي اختراق يُشوّه الإشارة.", en: "The Critical Area must be clear of vehicles and aircraft during operations. Any intrusion distorts the signal." },
  { cat: "Sensitive Area", icon: "⚠️", ar: "المنطقة الحساسة (Sensitive Area) أوسع من Critical Area وتتأثر بالطائرات الكبيرة. تُراقَب بصرياً وراداراً.", en: "The Sensitive Area is wider than the Critical Area and is affected by large aircraft. Monitored visually and by radar." },
  { cat: "تشغيل",         icon: "▶️", ar: "تسلسل التشغيل: 1-تشغيل RCU 2-التحقق من Datalink 3-Self-Test 4-انتظار READY 5-الإرسال. لا تتخطَّ أي خطوة.", en: "Startup sequence: 1-Power RCU 2-Verify Datalink 3-Self-Test 4-Await READY 5-Transmit. Never skip a step." },
  { cat: "Alarm Codes",   icon: "🚨", ar: "كود الخطأ 702 يشير إلى فقدان إشارة RF. كود 501 يعني فشل Self-Test. راجع دليل RCU لقائمة الأكواد الكاملة.", en: "Error 702 = RF signal loss. Error 501 = Self-Test failure. Refer to the RCU manual for the complete alarm code list." },
  { cat: "Transponder",   icon: "✈️", ar: "Mode C Transponder يُرسل ارتفاع الطائرة تلقائياً كل 1/8 ثانية. الكود 7700 للطوارئ، 7600 لفقدان الاتصال.", en: "Mode C Transponder auto-transmits altitude every 1/8 second. Code 7700=emergency, 7600=comms failure." },
  { cat: "Power",         icon: "🔌", ar: "TLS يعمل على طاقة ثنائية (Primary + UPS). تحقق من مستوى البطارية شهرياً ومن نتائج اختبار Load Test ربع سنوياً.", en: "TLS operates on dual power (Primary + UPS). Check battery level monthly and Load Test results quarterly." },
  { cat: "Temperature",   icon: "🌡️", ar: "درجة حرارة تشغيل TLS: -20°C إلى +55°C. تجاوز هذه الحدود يُسبب انجراف التردد وانتهاك معايير ICAO.", en: "TLS operating temperature: -20°C to +55°C. Exceeding these limits causes frequency drift and ICAO standard violations." },
  { cat: "ICAO",          icon: "🌐", ar: "معيار ICAO Annex 10 يُلزم دقة Localizer ≤10.5m عند عتبة المدرج. TLS يُحقق هذه الدقة بفضل ESA.", en: "ICAO Annex 10 requires Localizer accuracy ≤10.5m at runway threshold. TLS achieves this via ESA technology." },
  { cat: "Bends",         icon: "〰️", ar: "الـ Bends (تموجات في الإشارة) تُسببها انعكاسات من المباني أو الطائرات. تُقلَّص بتحديد المناطق الحساسة وحمايتها.", en: "Signal bends are caused by reflections from buildings or aircraft. Minimized by defining and protecting sensitive areas." },
  { cat: "NDB",           icon: "📍", ar: "NDB (Non-Directional Beacon) يعمل على LF/MF (190–1750 kHz) ويُستخدم كنقطة مرجعية. دقته أقل من ILS/TLS.", en: "NDB operates on LF/MF (190–1750 kHz) and serves as a reference point. Its accuracy is lower than ILS/TLS." },
  { cat: "GP Angle",      icon: "📏", ar: "تغيير زاوية Glide Path بمقدار 0.1 درجة يُغيّر نقطة الهبوط بنحو 30–40 متراً. الدقة في الضبط حرجة جداً.", en: "Changing GP angle by 0.1° shifts the touchdown point by 30–40 meters. Precision adjustment is critical." },
  { cat: "Datalink",      icon: "🔗", ar: "Datalink بين RCU والأجهزة الطرفية يعمل على RS-422 أو Ethernet. اعطال Datalink تُوقف العمليات فوراً.", en: "Datalink between RCU and remote units uses RS-422 or Ethernet. Datalink failures immediately halt operations." },
  { cat: "NOTAM",         icon: "📋", ar: "أي عطل في TLS يجب الإبلاغ عنه فوراً لإصدار NOTAM (إشعار للطيارين). تأخير الإبلاغ يُعرّض سلامة الرحلات للخطر.", en: "Any TLS malfunction must be reported immediately for a NOTAM issuance. Delayed reporting endangers flight safety." },
  { cat: "Self-Test",     icon: "🧪", ar: "Self-Test اليومي يفحص 47 نقطة في النظام خلال 90 ثانية. فشل أكثر من 3 نقاط يستلزم إشعار الفريق الفني فوراً.", en: "Daily Self-Test checks 47 system points in 90 seconds. Failure of 3+ points requires immediate technical team notification." },
  { cat: "Calibration",   icon: "⚖️", ar: "معايرة الـ DDM تُنفَّذ كل 6 أشهر أو بعد أي تعديل هيكلي. تُوثَّق كل جلسة معايرة في سجل الجهاز.", en: "DDM calibration is performed every 6 months or after any structural modification. Each session is logged in the equipment record." },
  { cat: "RF Safety",     icon: "🔴", ar: "لا تقف أمام هوائي LOC أو GP أثناء الإرسال. مستوى RF يتجاوز حدود ICNIRP على مسافة أقل من 10 أمتار.", en: "Never stand in front of LOC or GP antenna during transmission. RF levels exceed ICNIRP limits within 10 meters." },
  { cat: "Log Book",      icon: "📓", ar: "سجّل كل حادثة، عطل، أو إجراء صيانة في Log Book مع التوقيت الدقيق. السجلات دليل قانوني عند التحقيقات.", en: "Log every incident, fault, and maintenance action in the Log Book with exact timestamps. Records are legal evidence in investigations." },
];

// Map tip categories to illustrated technical diagrams
const TIP_IMAGES: Record<string, string> = {
  "Glide Slope":   "/tip-glide-slope.png",
  "DDM":           "/tip-ddm.png",
  "ILS / LOC":     "/tip-loc.png",
  "ILS Categories":"/tip-ils-cat.png",
  "Marker Beacon": "/tip-marker.png",
  "Critical Area": "/tip-critical-area.png",
  "Sensitive Area":"/tip-critical-area.png",
  "Self-Test":     "/tip-self-test.png",
  "RF Safety":     "/tip-rf-safety.png",
  "VSWR":          "/tip-vswr.png",
  "تشغيل":         "/tip-startup.png",
};

function DailyTip() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const tipIndex = dayOfYear % DAILY_TIPS.length;
  const tip = DAILY_TIPS[tipIndex];
  const C = "#00AEEF";
  const lang = navigator.language?.startsWith("ar") ? "ar" : "en";
  const tipImg = TIP_IMAGES[tip.cat] ?? null;
  const [imgOpen, setImgOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const lastDist = { current: 0 };
  const lastPan  = { current: { x: 0, y: 0 } };

  const openLightbox  = () => { setZoom(1); setPan({ x: 0, y: 0 }); setImgOpen(true); };
  const closeLightbox = () => setImgOpen(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDist.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1) {
      lastPan.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastDist.current > 0) setZoom(z => Math.min(8, Math.max(1, z * (dist / lastDist.current))));
      lastDist.current = dist;
    } else if (e.touches.length === 1) {
      const nx = e.touches[0].clientX; const ny = e.touches[0].clientY;
      setPan(p => ({ x: p.x + nx - lastPan.current.x, y: p.y + ny - lastPan.current.y }));
      lastPan.current = { x: nx, y: ny };
    }
  };
  const onTouchEnd = () => { lastDist.current = 0; };

  return (
    <div style={{ padding: "0 16px 24px" }}>

      {/* ── Lightbox ── */}
      {imgOpen && tipImg && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.96)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", touchAction: "none" }}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          onClick={e => { if (e.target === e.currentTarget) closeLightbox(); }}
        >
          <img src={tipImg} alt={tip.cat} draggable={false}
            style={{ maxWidth: "100vw", maxHeight: "100vh", objectFit: "contain",
              userSelect: "none",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center", transition: "none" }} />
          <div onClick={closeLightbox}
            style={{ position: "absolute", top: 20, right: 20, width: 40, height: 40,
              borderRadius: "50%", background: "rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, color: "#fff", cursor: "pointer" }}>✕</div>
          {zoom > 1 && (
            <div onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              style={{ position: "absolute", bottom: 28, background: "rgba(255,255,255,0.15)",
                borderRadius: 20, padding: "6px 16px", fontSize: 12, color: "#fff", cursor: "pointer" }}>
              ↺ إعادة الحجم
            </div>
          )}
          {zoom === 1 && (
            <div style={{ position: "absolute", bottom: 28, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
              إصبعان للتكبير
            </div>
          )}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{
          fontFamily: "Orbitron, monospace",
          fontSize: 18, fontWeight: 700,
          color: C, letterSpacing: "0.18em",
          textShadow: `0 0 18px ${C}80`,
        }}>
          TODAY&apos;S TIP
        </div>
        <div style={{
          fontFamily: "Inter", fontSize: 10, color: "rgba(255,255,255,0.4)",
          letterSpacing: "0.12em", marginTop: 3, textTransform: "uppercase",
        }}>
          النصيحة التقنية اليومية
        </div>
      </div>

      {/* ── Card ── */}
      <div style={{
        borderRadius: 18,
        background: "linear-gradient(145deg, rgba(0,174,239,0.08) 0%, rgba(0,10,30,0.70) 100%)",
        border: `1px solid ${C}28`,
        boxShadow: `0 8px 32px rgba(0,174,239,0.08), inset 0 1px 0 rgba(0,174,239,0.12)`,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Top glow line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C}80, transparent)` }} />

        {/* Icon + Category row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "18px 18px 14px",
          borderBottom: `1px solid rgba(0,174,239,0.10)`,
        }}>
          {/* Icon circle */}
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: `radial-gradient(circle, ${C}22, ${C}08)`,
            border: `1px solid ${C}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, flexShrink: 0,
            boxShadow: `0 0 16px ${C}30`,
          }}>
            {tip.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "Inter", fontSize: 13, fontWeight: 700,
              color: C, letterSpacing: "0.06em",
            }}>{tip.cat}</div>
            <div style={{
              fontFamily: "Orbitron, monospace", fontSize: 9,
              color: "rgba(255,255,255,0.30)", marginTop: 2,
              letterSpacing: "0.1em",
            }}>TIP {tipIndex + 1} / {DAILY_TIPS.length}</div>
          </div>
          {/* Pulse dot */}
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: C,
            boxShadow: `0 0 8px ${C}`,
            animation: "pulse 2s ease-in-out infinite",
          }} />
        </div>

        {/* Illustration image — tap to open lightbox */}
        {tipImg && (
          <div onClick={openLightbox}
            style={{ padding: "0", overflow: "hidden", maxHeight: 180, cursor: "zoom-in", position: "relative" }}>
            <img
              src={tipImg}
              alt={tip.cat}
              style={{
                width: "100%",
                height: 180,
                objectFit: "cover",
                objectPosition: "center",
                display: "block",
                filter: "brightness(0.88) saturate(0.95)",
              }}
            />
            {/* Tap hint */}
            <div style={{
              position: "absolute", bottom: 8, right: 10,
              background: "rgba(0,0,0,0.55)", borderRadius: 10,
              padding: "3px 10px", fontSize: 10,
              color: "rgba(255,255,255,0.6)",
              backdropFilter: "blur(4px)",
            }}>🔍 اضغط للتكبير</div>
          </div>
        )}

        {/* Text body */}
        <div style={{ padding: "16px 18px 20px" }}>
          <div style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 14, lineHeight: 1.85, fontWeight: 400,
            color: "rgba(255,255,255,0.85)",
            direction: "auto" as any,
          }}>
            {lang === "ar" ? tip.ar : tip.en}
          </div>
        </div>

        {/* Bottom accent */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${C}30, transparent)` }} />
      </div>
    </div>
  );
}

/* ─── HomeBanner (welcome → intro → rotating service slides) ─── */
const BANNER_FADE = 420;

function HomeBanner({ name, navigate }: { name: string; navigate: (to: string) => void }) {
  const firstName = (name || "").split(/[\s·,]+/)[0] || name;
  const [idx,     setIdx]     = useState(0);
  const [visible, setVisible] = useState(true);

  const services = [
    {
      icon:"🤖", color:"#00AEEF", path:"/chat",
      en:{ label:"AI INSTRUCTOR", title:"AI Instructor", sub:"Ask anything about the TTLS system and get an instant, clear answer." },
      ar:{ title:"المدرب الذكي", sub:"اسأل عن جهاز TTLS واحصل على إجابة فورية وواضحة." },
    },
    {
      icon:"🕹️", color:"#00FF88", path:"/simulator",
      en:{ label:"RCU SIMULATOR", title:"RCU Simulator", sub:"Train on a real-like control panel and track live aircraft codes." },
      ar:{ title:"محاكي واجهة RCU", sub:"تدرّب على شاشة تحكم واقعية وتتبّع أكواد الطائرات مباشرة." },
    },
    {
      icon:"🏆", color:"#FFD166", path:"/quiz",
      en:{ label:"QUIZ", title:"Quiz", sub:"Test your knowledge and climb to the top of the leaderboard." },
      ar:{ title:"الاختبار", sub:"اختبر معرفتك وتصدّر قائمة المتميّزين." },
    },
    {
      icon:"📚", color:"#C9A66B", path:"/basics",
      en:{ label:"TLS BASIC", title:"TLS Basic", sub:"Start from the foundations — setup, systems, and operations." },
      ar:{ title:"أساسيات TLS", sub:"ابدأ من الأساسيات — الإعداد والأنظمة والتشغيل." },
    },
  ] as const;

  // Slide plan: 0 = welcome, 1 = intro, 2.. = services
  const WELCOME = 15000, INTRO = 15000, SERVICE = 30000;
  const totalSlides = 2 + services.length;
  const durationFor = (i: number) => (i === 0 ? WELCOME : i === 1 ? INTRO : SERVICE);

  useEffect(() => {
    const dur = durationFor(idx);
    const t1 = setTimeout(() => setVisible(false), dur - BANNER_FADE);
    const t2 = setTimeout(() => {
      setIdx(i => (i + 1) % totalSlides);
      setVisible(true);
    }, dur);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [idx]);

  const accent = idx >= 2 ? services[idx - 2].color : "#00AEEF";

  const shell = (children: React.ReactNode) => (
    <div style={{ padding:"0 16px", marginBottom:4 }}>
      <style>{`
        @keyframes welcome-zoom {
          0%   {transform:scale(.55);opacity:0}
          28%  {transform:scale(1.22);opacity:1}
          48%  {transform:scale(1.22);opacity:1}
          70%  {transform:scale(1);opacity:1}
          100% {transform:scale(1);opacity:1}
        }
        @keyframes hb-shimmer { 0%{background-position:-250% center} 100%{background-position:250% center} }
        @keyframes hb-pulse { 0%,100%{opacity:1;filter:brightness(1)} 50%{opacity:.86;filter:brightness(1.55)} }
        @keyframes hb-rise { 0%{transform:translateY(14px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        @keyframes hb-arrow { 0%,100%{transform:translateX(0)} 50%{transform:translateX(5px)} }
        @keyframes hb-timer { from{width:0%} to{width:100%} }
      `}</style>
      <div style={{
        background:`linear-gradient(145deg,rgba(4,16,31,.97) 0%,${accent}0C 100%)`,
        border:`1px solid ${accent}22`,
        borderRadius:18, padding:"20px 18px",
        position:"relative", overflow:"hidden", minHeight:190,
        boxShadow:`0 8px 40px ${accent}0A`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-6px)",
        transition:`opacity ${BANNER_FADE}ms ease,transform ${BANNER_FADE}ms ease`,
      }}>
        <div style={{position:"absolute",top:-60,right:-40,width:180,height:180,
          borderRadius:"50%",background:`${accent}08`,filter:"blur(55px)",pointerEvents:"none"}} />
        {children}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:"rgba(255,255,255,.05)"}}>
          <div key={idx} style={{height:"100%",
            background:`linear-gradient(90deg,${accent},${accent}88)`,
            animation:`hb-timer ${durationFor(idx)}ms linear forwards`}}/>
        </div>
      </div>
    </div>
  );

  // ── Slide 0: Welcome ──
  if (idx === 0) {
    return shell(
      <div key="welcome" style={{textAlign:"center",padding:"16px 0 20px"}}>
        <div style={{fontSize:11,fontFamily:"Poppins,sans-serif",fontWeight:600,letterSpacing:"0.28em",
          color:"rgba(255,255,255,.5)",marginBottom:12}}>WELCOME BACK</div>
        <div style={{
          fontSize:40,fontWeight:800,fontFamily:"Poppins,sans-serif",lineHeight:1.05,
          color:"#fff",textShadow:`0 0 22px ${accent}66`,
          animation:"welcome-zoom 1.7s cubic-bezier(.22,1,.36,1) forwards",
        }}>Mr. {firstName}</div>
        <div style={{fontSize:22,fontFamily:"Cairo,sans-serif",fontWeight:700,
          color:accent,marginTop:12,direction:"rtl"}}>
          مرحباً يا {firstName}
        </div>
      </div>
    );
  }

  // ── Slide 1: Intro ──
  if (idx === 1) {
    return shell(
      <div key="intro" style={{textAlign:"center",padding:"18px 0 22px",
        animation:"hb-rise .6s ease forwards"}}>
        <div style={{fontSize:36,marginBottom:10,animation:"hb-pulse 2.6s ease infinite"}}>🧭</div>
        <div style={{
          fontSize:22,fontWeight:700,fontFamily:"Poppins,sans-serif",lineHeight:1.25,
          color:"#fff",marginBottom:8}}>
          Let's explore our<br/>new menus &amp; tools
        </div>
        <div style={{fontSize:18,fontFamily:"Cairo,sans-serif",fontWeight:700,
          color:accent,direction:"rtl",lineHeight:1.55}}>
          تعال نتعرّف على<br/>قوائمنا وخدماتنا الجديدة
        </div>
      </div>
    );
  }

  // ── Slides 2+: Services ──
  const s = services[idx - 2];
  return shell(
    <div key={idx} style={{animation:"hb-rise .55s ease forwards"}}>
      <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:14}}>
        <div style={{
          width:60,height:60,borderRadius:16,flexShrink:0,
          background:`${s.color}12`,border:`1px solid ${s.color}30`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:30,boxShadow:`0 4px 22px ${s.color}22`,
          animation:"hb-pulse 2.6s ease infinite"}}>{s.icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <span style={{
            fontSize:9,fontFamily:"Poppins,sans-serif",fontWeight:600,letterSpacing:"0.16em",
            background:`${s.color}16`,color:s.color,border:`1px solid ${s.color}38`,
            borderRadius:5,padding:"3px 9px",display:"inline-block",marginBottom:8}}>{s.en.label}</span>
          <div onClick={()=>navigate(s.path)} style={{
            fontSize:20,fontWeight:700,fontFamily:"Poppins,sans-serif",cursor:"pointer",
            marginBottom:5,lineHeight:1.2,
            background:`linear-gradient(90deg,${s.color} 0%,#fff 35%,${s.color}CC 60%,#fff 80%,${s.color} 100%)`,
            backgroundSize:"280% auto",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
            animation:"hb-shimmer 7s linear infinite",
          } as React.CSSProperties}>{s.en.title}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.5)",fontFamily:"Poppins,sans-serif",lineHeight:1.5,marginBottom:10}}>
            {s.en.sub}
          </div>
          <div style={{direction:"rtl"}}>
            <div onClick={()=>navigate(s.path)} style={{
              fontSize:18,fontWeight:700,fontFamily:"Cairo,sans-serif",cursor:"pointer",
              color:s.color,marginBottom:4,lineHeight:1.3}}>{s.ar.title}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.5)",fontFamily:"Cairo,sans-serif",lineHeight:1.6}}>
              {s.ar.sub}
            </div>
          </div>
        </div>
      </div>
      <button onClick={()=>navigate(s.path)} style={{
        width:"100%",padding:"12px 16px",borderRadius:12,cursor:"pointer",
        background:`linear-gradient(90deg,${s.color}22,${s.color}10)`,
        border:`1px solid ${s.color}44`,
        display:"flex",alignItems:"center",justifyContent:"center",gap:10,
        color:"#fff",fontSize:14,fontWeight:700}}>
        <span style={{fontFamily:"Cairo,sans-serif"}}>للدخول اضغط هنا</span>
        <span style={{fontFamily:"Poppins,sans-serif",opacity:.85}}>· Enter</span>
        <span style={{display:"inline-block",animation:"hb-arrow 1.2s ease infinite"}}>→</span>
      </button>
    </div>
  );
}


function HomePage({ session, onLogout }: { session: TraineeSession; onLogout: () => void }) {
  const [modules, setModules]   = useState<Module[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [streak, setStreak]     = useState<Streak>({ currentStreak: 0, longestStreak: 0, totalXp: 0 });
  const [, navigate] = useLocation();
  const clock = useLiveClock();
  const { t } = useLanguage();
  const [arSubtitles, setArSubtitles] = useState(false);
  const [subtitleText, setSubtitleText] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const attach = () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        track.mode = "hidden";
        track.oncuechange = () => {
          const cue = track.activeCues?.[0] as VTTCue | undefined;
          setSubtitleText(cue ? cue.text.replace(/<[^>]+>/g, "") : "");
        };
      }
    };
    if (video.readyState >= 1) attach();
    else video.addEventListener("loadedmetadata", attach, { once: true });
    return () => { video.removeEventListener("loadedmetadata", attach); };
  }, []);

  const toggleSubtitles = () => {
    const next = !arSubtitles;
    setArSubtitles(next);
    if (!next) setSubtitleText("");
  };
;

  const fetchDashboard = useCallback(() => {
    Promise.all([
      fetch(`/api/ensure-user/${session.id}`).catch(() => {}),
      fetch("/api/modules").then(r => r.json()),
      fetch(`/api/progress/${session.id}`).then(r => r.json()),
      fetch(`/api/streaks/${session.id}`).then(r => r.json()),
    ]).then(([, modsRaw, progRaw, streakRaw]) => {
      const mods: Module[] = (Array.isArray(modsRaw) ? modsRaw : modsRaw.modules ?? [])
        .map((m: any) => ({ id: m.id, title: m.title, order: m.order ?? m.orderIndex ?? m.id }))
        .sort((a: Module, b: Module) => a.order - b.order);
      setModules(mods);
      setProgress(Array.isArray(progRaw) ? progRaw : []);
      setStreak(streakRaw ?? { currentStreak: 0, longestStreak: 0, totalXp: 0 });
    }).catch(() => {});
  }, [session.id]);

  // Initial load
  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Re-fetch whenever user navigates back to this page (tab focus / visibility)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") fetchDashboard(); };
    const onFocus   = () => fetchDashboard();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchDashboard]);

  const totalMods = 9;
  const completedMods = progress.filter(p => Number(p.completed) === 1).length;
  const overallPct = progress.length === 0
    ? 0
    : Math.round(progress.reduce((sum, p) => sum + p.progress, 0) / totalMods);

  const getModProgress = (moduleId: number) => progress.find(p => p.moduleId === moduleId)?.progress ?? 0;
  const displayMods = modules.slice(0, 4);
;

  const handleLogout = async () => {
    try {
      await fetch("/api/trainee/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id }),
      });
    } catch { /* non-fatal */ }
    clearSession();
    onLogout();
  };



  return (
    <div className="page" style={{ background: "var(--bg-primary)" }}>

      {/* ── HERO: RADAR ── */}
      <div className="radar-grid" style={{
        minHeight: 360,
        background: "linear-gradient(180deg, #04101f 0%, #020810 100%)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div className="scan-line" />
        <RadarRings />

        {/* Corner brackets */}
        {[{top:12,left:14},{top:12,right:14},{bottom:12,left:14},{bottom:12,right:14}].map((pos,i) => (
          <div key={i} style={{
            position:"absolute",...pos,width:16,height:16,
            borderTop:    i<2  ? "1.5px solid rgba(0,174,239,0.55)" : undefined,
            borderBottom: i>=2 ? "1.5px solid rgba(0,174,239,0.55)" : undefined,
            borderLeft:  (i===0||i===2) ? "1.5px solid rgba(0,174,239,0.55)" : undefined,
            borderRight: (i===1||i===3) ? "1.5px solid rgba(0,174,239,0.55)" : undefined,
          }} />
        ))}

        {/* Center content — title only, radar is behind */}
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center",
          minHeight: 360, padding: "28px 20px",
          textAlign: "center",
        }}>
          {/* Main title */}
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "clamp(28px, 8vw, 42px)",
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "0.06em",
            lineHeight: 1.1,
            textShadow: "0 0 24px rgba(0,174,239,0.9), 0 0 60px rgba(0,174,239,0.4)",
            marginBottom: 8,
          }}>
            TLS TRAINER
          </div>
          <div style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "clamp(9px, 2.5vw, 12px)",
            fontWeight: 600,
            letterSpacing: "0.28em",
            color: "#00AEEF",
            textTransform: "uppercase",
            textShadow: "0 0 12px rgba(0,174,239,0.6)",
            marginBottom: 20,
          }}>
            TRANSPONDER LANDING SYSTEM
          </div>

          {/* Status pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "rgba(0,174,239,0.08)",
            border: "1px solid rgba(0,174,239,0.25)",
            borderRadius: 20, padding: "5px 16px",
            marginBottom: 20,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#00AEEF", boxShadow: "0 0 8px #00AEEF",
              animation: "pulse-glow 2s ease infinite",
            }} />
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 8, color: "#35D4FF", letterSpacing: "0.18em",
            }}>{t("system_active")}</div>
          </div>

          {/* XP bar */}
          <div style={{ width: "100%", maxWidth: 300 }}>
            <XpBar xp={streak.totalXp} />
          </div>
        </div>
      </div>


      {/* ── BANNER ── */}
      <HomeBanner name={session.name} navigate={navigate} />

      {/* ── CONTINUE TRAINING CTA ── */}
      {(() => {
        const inProgress = progress.find(p => p.progress > 0 && Number(p.completed) !== 1);
        if (!inProgress) return null;
        const mod = modules.find(m => m.id === inProgress.moduleId);
        const color = COLORS[(inProgress.moduleId - 1) % COLORS.length];
        return (
          <div style={{ padding: "12px 16px 0" }}>
            <div onClick={() => navigate("/modules")} className="glass-card" style={{
              padding: "13px 16px", cursor: "pointer",
              border: `1px solid ${color}45`,
              background: `linear-gradient(90deg, ${color}10 0%, transparent 100%)`,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `${color}18`, border: `1px solid ${color}45`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0,
              }}>▶</div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "Inter", fontSize: 9, color,
                  letterSpacing: "0.14em", marginBottom: 4,
                }}>{t("continue_training")}</div>
                <div style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                }}>
                  {mod?.title ?? `Module ${inProgress.moduleId}`}
                </div>
                <div className="progress-bar" style={{ marginTop: 7 }}>
                  <div className="progress-fill animated-bar" style={{
                    width: `${inProgress.progress}%`,
                    ["--bar-width" as any]: `${inProgress.progress}%`,
                    background: `linear-gradient(90deg, ${color}, #35D4FF)`,
                  }} />
                </div>
              </div>
              <div style={{ fontFamily: "Inter", fontSize: 13, color, flexShrink: 0 }}>
                {Math.round(inProgress.progress)}%
              </div>
            </div>
          </div>
        );
      })()}



      {/* ── INTRO VIDEO ── */}
      <div style={{ padding: "18px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{
            fontFamily: "Inter", fontSize: 9, letterSpacing: "0.22em",
            color: "var(--text-muted)",
          }}>{t("system_intro")}</div>
          <button
            onClick={toggleSubtitles}
            style={{
              background: arSubtitles ? "rgba(0,174,239,0.2)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${arSubtitles ? "#00AEEF" : "rgba(255,255,255,0.12)"}`,
              borderRadius: 6,
              color: arSubtitles ? "#00AEEF" : "rgba(255,255,255,0.45)",
              fontFamily: "Inter",
              fontSize: 9,
              letterSpacing: "0.08em",
              padding: "4px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: 11 }}>CC</span>
            <span>ترجمة</span>
          </button>
        </div>
        <div style={{
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid rgba(0,174,239,0.2)",
          background: "#000",
          boxShadow: "0 0 24px rgba(0,174,239,0.08)",
          position: "relative",
        }}>
          <video
            ref={videoRef}
            src="/tls-intro.webm"
            controls
            autoPlay
            muted
            playsInline
            preload="auto"
            style={{ width: "100%", height: "100%", display: "block", objectFit: "cover", aspectRatio: "16/9" }}
          >
            <track
              kind="subtitles"
              src="/tls-video-ar.vtt"
              srcLang="ar"
              label="العربية"
            />
          </video>
          {/* Custom subtitle overlay — constrained to bottom 28% of video */}
          {arSubtitles && subtitleText && (
            <div style={{
              position: "absolute",
              bottom: "3%",
              left: "4%",
              right: "4%",
              maxHeight: "28%",
              overflow: "hidden",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              textAlign: "center",
              pointerEvents: "none",
              direction: "rtl",
            }}>
              <span style={{
                display: "inline-block",
                background: "rgba(0,0,0,0.80)",
                color: "#fff",
                fontSize: "clamp(9px, 1.9vw, 12px)",
                fontFamily: "Tajawal, Arial, sans-serif",
                fontWeight: 500,
                lineHeight: 1.4,
                padding: "3px 8px",
                borderRadius: 4,
                maxWidth: "100%",
                wordBreak: "break-word",
              }}>
                {subtitleText}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── DAILY TIP ── */}
      <DailyTip />

      {/* ── LOGOUT (bottom) ── */}
      <div style={{ padding: "0 16px 32px", textAlign: "center" }}>
        <button onClick={handleLogout} style={{
          background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
          color: "var(--text-muted)", fontFamily: "Inter", fontSize: 9,
          letterSpacing: "0.1em", padding: "8px 20px", cursor: "pointer",
        }}>
          {t("logout")}
        </button>
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────
   GUEST HOME PAGE — limited read-only access
───────────────────────────────────────────────────────── */
function GuestHomePage({ onExit }: { onExit: () => void }) {
  const handleExit = () => {
    sessionStorage.removeItem('tls_guest_mode');
    onExit();
  };
  const [, navigate] = useLocation();
  const sections = [
    { icon:"📘", label:"TLS BASICS",    sub:"Core TLS concepts",        path:"/basics",   color:"#00AEEF", available:true  },
    { icon:"⭐", label:"TLS ADVANCED",  sub:"Advanced procedures",      path:"/advanced", color:"#FFD166", available:true  },
    { icon:"📄", label:"MANUALS",       sub:"Reference documents",      path:"/manuals",  color:"#C9A66B", available:true  },
    { icon:"ℹ️", label:"ABOUT",         sub:"System information",       path:"/about",    color:"#35D4FF", available:true  },
    { icon:"🎯", label:"QUIZ",          sub:"Requires registration",    path:"/quiz-list",color:"#00D26A", available:false },
    { icon:"🏆", label:"LEADERBOARD",   sub:"Requires registration",    path:"/leaderboard",color:"#FF4D4D",available:false},
    { icon:"💬", label:"CHAT",          sub:"Requires registration",    path:"/chat",     color:"#FF9500", available:false },
    { icon:"📊", label:"PROGRESS",      sub:"Requires registration",    path:"/",         color:"#AF52DE", available:false },
  ];
  return (
    <div className="page" style={{ background:"var(--bg-primary)", minHeight:"100vh", paddingBottom:40 }}>
      {/* Guest banner */}
      <div style={{
        background:"linear-gradient(135deg,rgba(255,215,0,0.1),rgba(255,215,0,0.04))",
        border:"1px solid rgba(255,215,0,0.25)", padding:"12px 20px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{fontSize:18}}>👁</span>
          <div>
            <div style={{ fontFamily:"Orbitron,monospace", fontSize:10, color:"#FFD166", letterSpacing:"0.15em" }}>GUEST MODE</div>
            <div style={{ fontFamily:"Inter", fontSize:10, color:"rgba(255,215,0,0.5)", marginTop:2 }}>Read-only access · Limited features</div>
          </div>
        </div>
        <button onClick={handleExit} style={{
          background:"rgba(255,215,0,0.1)", border:"1px solid rgba(255,215,0,0.3)",
          borderRadius:8, color:"#FFD166", fontFamily:"Inter", fontSize:10,
          letterSpacing:"0.1em", padding:"6px 14px", cursor:"pointer",
        }}>EXIT GUEST</button>
      </div>

      {/* Register CTA */}
      <div style={{ padding:"16px 16px 0" }}>
        <div style={{
          background:"linear-gradient(135deg,rgba(0,174,239,0.1),rgba(0,174,239,0.04))",
          border:"1px solid rgba(0,174,239,0.25)", borderRadius:14, padding:"16px 20px",
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:12,
        }}>
          <div>
            <div style={{ fontFamily:"Inter", fontSize:12, color:"#00AEEF", fontWeight:600 }}>Unlock all features</div>
            <div style={{ fontFamily:"Inter", fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:3 }}>Register to track progress, take quizzes &amp; more</div>
          </div>
          <button onClick={handleExit} style={{
            background:"linear-gradient(135deg,#00AEEF,#35D4FF)",
            border:"none", borderRadius:10, color:"#fff",
            fontFamily:"Orbitron,monospace", fontSize:9, letterSpacing:"0.12em",
            padding:"10px 16px", cursor:"pointer", flexShrink:0, whiteSpace:"nowrap" as const,
          }}>REGISTER</button>
        </div>
      </div>

      {/* Section grid */}
      <div style={{ padding:"20px 16px 0" }}>
        <div style={{ fontFamily:"Inter", fontSize:9, letterSpacing:"0.2em", color:"rgba(255,255,255,0.25)", marginBottom:14 }}>AVAILABLE SECTIONS</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {sections.map(s=>(
            <div key={s.label} onClick={()=>{ if(s.available) navigate(s.path); }} style={{
              padding:"16px 14px", borderRadius:14, cursor:s.available?"pointer":"not-allowed",
              background: s.available ? `${s.color}0d` : "rgba(255,255,255,0.02)",
              border:`1px solid ${s.available ? s.color+"30" : "rgba(255,255,255,0.07)"}`,
              opacity: s.available ? 1 : 0.45,
              transition:"all 0.15s",
            }}>
              <div style={{ fontSize:22, marginBottom:8 }}>{s.icon}</div>
              <div style={{ fontFamily:"Orbitron,monospace", fontSize:9, color:s.available?s.color:"rgba(255,255,255,0.25)", letterSpacing:"0.1em" }}>{s.label}</div>
              <div style={{ fontFamily:"Inter", fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:4 }}>{s.sub}</div>
              {!s.available && <div style={{ fontFamily:"Inter", fontSize:8, color:"rgba(255,255,255,0.18)", marginTop:5, letterSpacing:"0.08em" }}>🔒 LOCKED</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ROOT EXPORT — gates login vs home
───────────────────────────────────────────────────────────────────────────── */

export default function Index() {
  const [session, setSessionState] = useState<TraineeSession | null>(() => getSession());

  const handleLogin = (s: TraineeSession) => {
    if (s.id !== 'guest') {
      setSession(s);
      sessionStorage.removeItem('tls_guest_mode');
    } else {
      sessionStorage.setItem('tls_guest_mode', '1'); // AuthGate reads this to allow guest pages
    }
    setSessionState(s);
  };

  const handleLogout = () => {
    clearSession();
    setSessionState(null);
    // Clear all persistence keys on real logout
    localStorage.removeItem("tls_last_page");
    localStorage.removeItem("tls_last_page_token");
    localStorage.removeItem("tls_intended");
    localStorage.removeItem("tls_site_open_ts");
    sessionStorage.removeItem("tls_last_page");
    sessionStorage.removeItem("tls_session_token"); // next open is a fresh session
  };

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (session.id === 'guest') {
    return <GuestHomePage onExit={() => { sessionStorage.removeItem('tls_guest_mode'); setSessionState(null); }} />;
  }

  return <HomePage session={session} onLogout={handleLogout} />;
}
