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
  const [trainees, setTrainees] = useState<TraineeListItem[]>([]);
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
  const [selectedId, setSelectedId] = useState("");
  const [loginPin, setLoginPin] = useState("");

  useEffect(() => {
    if (mode === "login") {
      fetch("/api/trainee/list").then(r=>r.json()).then((rows:TraineeListItem[])=>setTrainees(rows)).catch(()=>{});
    }
  }, [mode]);

  const doRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockAudio();
    if (!name.trim())  { setError("الاسم مطلوب"); return; }
    if (!pin.trim() || !/^\d{4,8}$/.test(pin.trim())) { setError("رمز الدخول لازم يكون 4-8 أرقام"); return; }
    if (pin !== confirmPin) { setError("رمز الدخول وتأكيده غير متطابقين"); return; }
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
      if (!data.ok) { setError(data.error ?? "فشل التسجيل"); return; }
      // Show pending screen
      setPendingName(name.trim());
      setMode("pending");
    } catch { setError("خطأ في الاتصال"); } finally { setLoading(false); }
  };

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockAudio();
    if (!selectedId) { setError("اختر اسمك من القائمة"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/trainee/login", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ id:selectedId, pin:loginPin.trim()||undefined }),
      });
      const data = await res.json() as { ok:boolean; id?:string; name?:string; rank?:string|null; unit?:string|null; error?:string; message?:string };
      if (res.status===403 && data.error==='blocked')    { setError(data.message ?? 'حسابك موقوف. تواصل مع المدرب.'); return; }
      if (res.status===403 && data.error==='suspended')  { setError(data.message ?? 'حسابك معلّق مؤقتاً.'); return; }
      if (!data.ok || !data.id) { setError(data.error ?? "بيانات الدخول غير صحيحة"); return; }
      const session: TraineeSession = { id:data.id, name:data.name!, rank:data.rank, unit:data.unit };
      setSession(session);
      fetch("/api/track",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ type:"login", userId:data.id, traineeName:data.name }) }).catch(()=>{});
      onLogin(session);
    } catch { setError("خطأ في الاتصال"); } finally { setLoading(false); }
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
            }}>+ تسجيل متدرب جديد</button>
            <button onClick={()=>setMode("login")} style={{
              width:"100%",padding:"14px 0",
              background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,cursor:"pointer",
              color:"rgba(255,255,255,0.5)",fontFamily:"Inter",fontSize:12,letterSpacing:"0.1em",
            }}>دخول متدرب مسجّل</button>
          </div>
        )}

        {/* REGISTER FORM */}
        {mode==="register" && (
          <form onSubmit={doRegister} style={cardStyle}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:20 }}>
              <button type="button" onClick={()=>{setMode("pick");setError("");}}
                style={{ background:"none",border:"none",color:C.cyan,cursor:"pointer",padding:4,fontSize:18 }}>←</button>
              <div className="font-orbitron" style={{ fontSize:11,color:C.cyan,letterSpacing:"0.15em" }}>طلب تسجيل جديد</div>
            </div>

            <div style={{ fontSize:10,color:"rgba(0,174,239,0.6)",fontFamily:"Inter",marginBottom:16,lineHeight:1.6,padding:"10px 12px",background:"rgba(0,174,239,0.06)",borderRadius:8,border:"1px solid rgba(0,174,239,0.15)" }}>
              سيُراجَع طلبك من قبل المدرب قبل تفعيل حسابك
            </div>

            {[
              { label:"الاسم الكامل *", val:name, set:setName, ph:"مثال: محمد العتيبي", type:"text" },
              { label:"الرتبة العسكرية", val:rank, set:setRank, ph:"مثال: رقيب، ملازم، نقيب", type:"text" },
              { label:"الوحدة / القسم", val:unit, set:setUnit, ph:"مثال: Ground Radar", type:"text" },
              { label:"القاعدة الجوية", val:airBase, set:setAirBase, ph:"مثال: قاعدة الملك عبدالعزيز", type:"text" },
              { label:"سنوات الخدمة", val:years, set:setYears, ph:"مثال: 5", type:"number" },
              { label:"رمز الدخول (4-8 أرقام) *", val:pin, set:setPin, ph:"أدخل رمز الدخول", type:"password" },
              { label:"تأكيد رمز الدخول *", val:confirmPin, set:setConfirmPin, ph:"أعد إدخال رمز الدخول", type:"password" },
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
              {loading?"جاري الإرسال...":"إرسال طلب التسجيل"}
            </button>
          </form>
        )}

        {/* PENDING SCREEN */}
        {mode==="pending" && (
          <div style={{ ...cardStyle, textAlign:"center", animation:"fadeUp 0.4s ease" }}>
            <div style={{ fontSize:52,marginBottom:16 }}>🕐</div>
            <div className="font-orbitron" style={{ fontSize:13,color:C.cyan,letterSpacing:"0.15em",marginBottom:12 }}>
              طلبك قيد المراجعة
            </div>
            <div style={{ fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.7,marginBottom:20 }}>
              أُرسل طلب تسجيلك باسم <strong style={{ color:"#fff" }}>{pendingName}</strong><br/>
              سيراجعه المدرب ويُفعّل حسابك قريباً.<br/>
              بعد الموافقة يمكنك الدخول من زر <em>"دخول متدرب مسجّل"</em>
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
            }}>عودة للرئيسية</button>
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

            <div style={{ fontSize:9,fontFamily:"Inter",color:C.cyan,letterSpacing:"0.1em",marginBottom:6 }}>اختر اسمك</div>
            {trainees.length===0 ? (
              <div style={{ color:"rgba(255,255,255,0.3)",fontSize:12,textAlign:"center",padding:"16px 0",marginBottom:14 }}>
                لا يوجد متدربين مسجّلين بعد
              </div>
            ) : (
              <div style={{ marginBottom:14,maxHeight:200,overflowY:"auto" }}>
                {trainees.map(t=>(
                  <div key={t.id} onClick={()=>setSelectedId(t.id)} style={{
                    padding:"10px 12px",marginBottom:6,borderRadius:8,
                    border:selectedId===t.id?"1px solid #00AEEF":"1px solid rgba(255,255,255,0.08)",
                    background:selectedId===t.id?"rgba(0,174,239,0.12)":"rgba(255,255,255,0.03)",
                    cursor:"pointer",display:"flex",alignItems:"center",gap:10,
                  }}>
                    <div style={{
                      width:32,height:32,borderRadius:"50%",flexShrink:0,
                      background:"linear-gradient(135deg,#00AEEF,#35D4FF)",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontFamily:"Inter",fontSize:11,fontWeight:700,color:"#fff",
                    }}>
                      {(t.name||"?").split(" ").map((w:string)=>w[0]).slice(0,2).join("")}
                    </div>
                    <div>
                      <div style={{ fontSize:13,fontWeight:600,color:"var(--text-primary)" }}>{t.name}</div>
                      {(t.rank||t.unit)&&<div style={{ fontSize:10,color:"var(--text-muted)" }}>{[t.rank,t.unit].filter(Boolean).join(" · ")}</div>}
                    </div>
                    {selectedId===t.id&&<div style={{ marginLeft:"auto",color:"#00AEEF",fontSize:16 }}>✓</div>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:9,fontFamily:"Inter",color:C.cyan,letterSpacing:"0.1em",marginBottom:6 }}>رمز الدخول</div>
              <input type="password" value={loginPin} onChange={e=>setLoginPin(e.target.value)}
                placeholder="أدخل رمز الدخول" inputMode="numeric" style={inputStyle} />
            </div>

            {error && <div style={{ color:"#FF4D4D",fontSize:12,marginBottom:12,textAlign:"center",lineHeight:1.5 }}>{error}</div>}

            <button type="submit" disabled={loading||!selectedId} style={{
              width:"100%",padding:"14px 0",
              background:(!selectedId||loading)?"rgba(0,174,239,0.15)":"linear-gradient(135deg,#00AEEF,#35D4FF)",
              border:"none",borderRadius:10,cursor:(!selectedId||loading)?"not-allowed":"pointer",
              color:(!selectedId||loading)?"rgba(255,255,255,0.35)":"#fff",
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

function HomePage({ session, onLogout }: { session: TraineeSession; onLogout: () => void }) {
  const [modules, setModules]   = useState<Module[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [streak, setStreak]     = useState<Streak>({ currentStreak: 0, longestStreak: 0, totalXp: 0 });
  const [, navigate] = useLocation();
  const clock = useLiveClock();
  const { t } = useLanguage();

  const quickActions = [
    { labelKey: "nav_modules" as const,  icon: "📡", path: "/modules",  color: "#00AEEF" },
    { labelKey: "nav_quiz" as const,     icon: "🎯", path: "/quiz",     color: "#00D26A" },
    { labelKey: "manuals" as const,      icon: "📋", path: "/manuals",  color: "#C9A66B" },
    { labelKey: "live_status" as const,  icon: "📶", path: "/status",   color: "#FFD166" },
    { labelKey: "chat" as const,         icon: "💬", path: "/chat",     color: "#35D4FF" },
  ];

  useEffect(() => {
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

  const totalMods = 9;
  const completedMods = progress.filter(p => p.completed === 1).length;
  const overallPct = progress.length === 0
    ? 0
    : Math.round(progress.reduce((sum, p) => sum + p.progress, 0) / totalMods);

  const getModProgress = (moduleId: number) => progress.find(p => p.moduleId === moduleId)?.progress ?? 0;
  const displayMods = modules.slice(0, 4);

  const statusCards = [
    { label: t("streak"),   value: `${streak.currentStreak}d`, color: "#FFD166", pulse: streak.currentStreak > 0 },
    { label: t("xp"),       value: streak.totalXp > 999 ? `${(streak.totalXp/1000).toFixed(1)}k` : String(streak.totalXp), color: "#35D4FF", pulse: false },
    { label: t("modules"),  value: `${completedMods}/${totalMods}`, color: "#00AEEF", pulse: false },
    { label: t("progress"), value: `${overallPct}%`, color: "#00AEEF", pulse: overallPct > 0 },
  ];

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

      {/* ── STATS CARDS ── */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {statusCards.map(s => (
            <div key={s.label} className="glass-card" style={{
              padding: "12px 8px",
              textAlign: "center",
              border: `1px solid ${s.color}28`,
              position: "relative", overflow: "hidden",
              height: 68,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            }}>
              {s.pulse && (
                <div style={{
                  position: "absolute", top: 6, right: 6,
                  width: 5, height: 5, borderRadius: "50%",
                  background: s.color, boxShadow: `0 0 6px ${s.color}`,
                  animation: "pulse-glow 1.5s ease infinite",
                }} />
              )}
              <div style={{
                position: "absolute", inset: 0,
                background: `radial-gradient(circle at 50% 0%, ${s.color}10, transparent 65%)`,
                pointerEvents: "none",
              }} />
              <div style={{
                fontFamily: "Inter", fontSize: 16, fontWeight: 700,
                color: s.color, lineHeight: 1, position: "relative",
              }}>{s.value}</div>
              <div style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 9, color: "var(--text-muted)",
                marginTop: 4, letterSpacing: "0.08em", position: "relative",
              }}>{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTINUE TRAINING CTA ── */}
      {(() => {
        const inProgress = progress.find(p => p.progress > 0 && p.completed !== 1);
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
                }}>CONTINUE TRAINING</div>
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
        <div style={{
          fontFamily: "Inter", fontSize: 9, letterSpacing: "0.22em",
          color: "var(--text-muted)", marginBottom: 10,
        }}>SYSTEM INTRODUCTION</div>
        <div style={{
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid rgba(0,174,239,0.2)",
          background: "#000",
          boxShadow: "0 0 24px rgba(0,174,239,0.08)",
        }}>
          <video
            src="/tls-intro.webm"
            controls
            autoPlay
            muted
            playsInline
            preload="auto"
            style={{ width: "100%", height: "100%", display: "block", objectFit: "cover", aspectRatio: "16/9" }}
          />
        </div>
      </div>

      {/* ── RECENT ACTIVITY ── */}
      <div style={{ padding: "0 16px 40px" }}>
        <div style={{
          fontFamily: "Inter", fontSize: 9, letterSpacing: "0.22em",
          color: "var(--text-muted)", marginBottom: 12,
        }}>{t("recent_activity")}</div>
        <div className="glass-card" style={{ padding: "4px 0", border: "1px solid rgba(0,174,239,0.1)" }}>
          {progress.length > 0 ? (
            progress.sort((a,b) => b.progress - a.progress).slice(0, 3).map((p, i, arr) => {
              const mod = modules.find(m => m.id === p.moduleId);
              const color = COLORS[(p.moduleId - 1) % COLORS.length];
              return (
                <div key={p.moduleId} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px",
                  borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${color}14`, border: `1px solid ${color}28`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  }}>
                    {p.completed ? "✅" : "📖"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 13, color: "var(--text-secondary)",
                    }}>
                      {p.completed ? "Completed" : "In Progress"} — {mod?.title ?? `Module ${p.moduleId}`}
                    </div>
                    <div style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 11, color: "var(--text-muted)", marginTop: 2,
                    }}>{Math.round(p.progress)}% done</div>
                  </div>
                </div>
              );
            })
          ) : (
            [
              { icon: "🚀", text: "Start your first module to begin training", time: "Get started", color: "#00AEEF" },
              { icon: "🎯", text: "Complete quizzes to earn XP and streaks", time: "Tip", color: "#35D4FF" },
              { icon: "📋", text: "Browse TLS manuals in the library", time: "Explore", color: "#C9A66B" },
            ].map((item, i, arr) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px",
                borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: `${item.color}14`, border: `1px solid ${item.color}28`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                }}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "var(--text-secondary)" }}>{item.text}</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.time}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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

/* ─────────────────────────────────────────────────────────────────────────────
   ROOT EXPORT — gates login vs home
───────────────────────────────────────────────────────────────────────────── */

export default function Index() {
  const [session, setSessionState] = useState<TraineeSession | null>(() => getSession());

  const handleLogin = (s: TraineeSession) => {
    setSession(s);
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

  return <HomePage session={session} onLogout={handleLogout} />;
}
