import { Link, useLocation } from "wouter";
import { useEffect, useState, useRef, useCallback } from "react";
import { getSession, setSession, clearSession } from "../hooks/useTelegramTrack";
import type { TraineeSession } from "../hooks/useTelegramTrack";
import { unlockAudio, playAlertTone, vibrate, showToast } from "../lib/audio";
import { useLanguage } from "../hooks/useLanguage";
import WelcomeScreen, { shouldShowWelcome, resetWelcome } from "../components/WelcomeScreen";
import {
  BookOpen, Star, FileText, Info, Target, Trophy, MessageSquare, BarChart2,
  Eye, Lock, LogIn, UserPlus, Clock, AlertTriangle,
  Wifi, Gauge, Zap, Antenna, Wrench, Plane, Shield, Bell,
  Play, ArrowLeft, ChevronRight,
} from "lucide-react";

type Module = { id: number; title: string; order: number };
type ProgressRow = { moduleId: number; progress: number; completed: number };
type Streak = { currentStreak: number; longestStreak: number; totalXp: number };
type TraineeListItem = { id: string; name: string; rank: string | null; unit: string | null; created_at: number };
type Notification = { id: number; message?: string; text?: string; alert_type?: string; sender_role?: string; read: number; ts: number };

const COLORS = ["#00AEEF","#35D4FF","#00D26A","#FFD166","#00AEEF","#35D4FF","#C9A66B","#00D26A","#FF4D4D"];

function RadarRings() {
  return (
    <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:340,height:340,pointerEvents:"none" }}>
      {/* Outer glow ring */}
      <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:"1px solid rgba(0,174,239,0.06)",boxShadow:"0 0 40px rgba(0,174,239,0.08) inset",transform:"scale(1)" }} />
      {/* 5 concentric rings with varying opacity */}
      {[1,2,3,4,5].map(n=>(
        <div key={n} style={{
          position:"absolute",inset:0,borderRadius:"50%",
          border:`1px solid rgba(0,174,239,${0.22-n*0.03})`,
          animation:`radar-ring ${2.2+n*0.5}s ease-in-out infinite`,
          animationDelay:`${n*0.3}s`,
          transform:`scale(${0.18+n*0.16})`,
          boxShadow: n===1 ? "0 0 8px rgba(0,174,239,0.15) inset" : "none",
        }} />
      ))}
      {/* Sweep line with trailing glow */}
      <div style={{
        position:"absolute",top:"50%",left:"50%",
        width:"50%",height:2,
        transformOrigin:"0 50%",
        background:"linear-gradient(90deg,rgba(0,174,239,0.9),rgba(53,212,255,0.5),transparent)",
        animation:"radar-sweep 3s linear infinite",
        borderRadius:"0 2px 2px 0",
        boxShadow:"0 0 6px rgba(0,174,239,0.4)",
      }} />
      {/* Sweep cone (trailing fade) */}
      <div style={{
        position:"absolute",top:"50%",left:"50%",
        width:"50%",height:"50%",
        transformOrigin:"0% 0%",
        background:"conic-gradient(from 0deg, rgba(0,174,239,0.12) 0deg, transparent 60deg)",
        animation:"radar-sweep 3s linear infinite",
        borderRadius:"0 100% 0 0",
      }} />
      {/* Cross-hair lines */}
      <div style={{ position:"absolute",top:"50%",left:0,right:0,height:1,background:"rgba(0,174,239,0.08)",transform:"translateY(-50%)" }} />
      <div style={{ position:"absolute",left:"50%",top:0,bottom:0,width:1,background:"rgba(0,174,239,0.08)",transform:"translateX(-50%)" }} />
      {/* Blip dots at different positions */}
      {[{top:"28%",left:"62%"},{top:"65%",left:"38%"},{top:"42%",left:"30%"}].map((pos,i)=>(
        <div key={i} style={{
          position:"absolute",...pos,
          width:4,height:4,borderRadius:"50%",
          background:"#35D4FF",
          boxShadow:"0 0 6px #35D4FF,0 0 12px rgba(53,212,255,0.5)",
          animation:`radar-blip ${2+i*0.7}s ease-in-out infinite`,
          animationDelay:`${i*0.8}s`,
        }} />
      ))}
      {/* Center dot */}
      <div style={{
        position:"absolute",top:"50%",left:"50%",
        transform:"translate(-50%,-50%)",
        width:10,height:10,borderRadius:"50%",
        background:"radial-gradient(circle, #35D4FF, #00AEEF)",
        boxShadow:"0 0 12px #00AEEF,0 0 24px rgba(0,174,239,0.6),0 0 40px rgba(0,174,239,0.2)",
        animation:"pulse-glow 1.5s ease infinite",
      }} />
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
    if (!loginName.trim()) { setError("Full name is required"); return; }
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
            <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}><AlertTriangle size={14} strokeWidth={2} style={{ flexShrink:0 }} /> {forceLogoutMsg}</span>
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
              <Eye size={14} strokeWidth={1.8} style={{ flexShrink:0 }} /> BROWSE AS GUEST <span style={{fontSize:9,color:"rgba(255,215,0,0.3)"}}>(LIMITED)</span>
            </button>
          </div>
        )}

        {/* REGISTER FORM */}
        {mode==="register" && (
          <form onSubmit={doRegister} style={cardStyle}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:20 }}>
              <button type="button" onClick={()=>{setMode("pick");setError("");}}
                style={{ background:"none",border:"none",color:C.cyan,cursor:"pointer",padding:4,display:"flex",alignItems:"center" }}><ArrowLeft size={18} strokeWidth={2} /></button>
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
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16 }}><Clock size={52} strokeWidth={1} color="#00AEEF" /></div>
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
                style={{ background:"none",border:"none",color:C.cyan,cursor:"pointer",padding:4,display:"flex",alignItems:"center" }}><ArrowLeft size={18} strokeWidth={2} /></button>
              <div className="font-orbitron" style={{ fontSize:11,color:C.cyan,letterSpacing:"0.15em" }}>TRAINEE LOGIN</div>
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:9,fontFamily:"Inter",color:C.cyan,letterSpacing:"0.1em",marginBottom:6 }}>FULL NAME</div>
              <input type="text" value={loginName} onChange={e=>setLoginName(e.target.value)}
                placeholder="Enter your full name" autoComplete="off" style={inputStyle} />
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:9,fontFamily:"Inter",color:C.cyan,letterSpacing:"0.1em",marginBottom:6 }}>ACCESS PIN</div>
              <input type="password" value={loginPin} onChange={e=>setLoginPin(e.target.value)}
                placeholder="Enter access PIN" inputMode="numeric" style={inputStyle} />
            </div>

            {error && <div style={{ color:"#FF4D4D",fontSize:12,marginBottom:12,textAlign:"center",lineHeight:1.5 }}>{error}</div>}

            <button type="submit" disabled={loading||!loginName.trim()} style={{
              width:"100%",padding:"14px 0",
              background:(!loginName.trim()||loading)?"rgba(0,174,239,0.15)":"linear-gradient(135deg,#00AEEF,#35D4FF)",
              border:"none",borderRadius:10,cursor:(!loginName.trim()||loading)?"not-allowed":"pointer",
              color:(!loginName.trim()||loading)?"rgba(255,255,255,0.35)":"#fff",
              fontFamily:"Inter",fontSize:12,letterSpacing:"0.1em",fontWeight:700,
            }}>
              {loading ? "SIGNING IN..." : "SIGN IN"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}


// ── PRECISION APPROACH GUIDANCE ────────────────────────────────────────────
// Two fully separate blocks, stacked: the video frame on top (nothing drawn
// over it — no title, no caption, no buttons, no poster overlay), and an
// information panel underneath. Horizontal padding, border radius, border and
// glow are copied verbatim from the SYSTEM INTRODUCTION hero above so both
// video frames share exactly the same width and left/right alignment.
function PrecisionApproachSection() {
  const vidRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // True only when the browser refused to autoplay: we then show a centered
  // PLAY button over the poster until the user taps it.
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    const v = vidRef.current;
    if (!el || !v) return;

    // React only ever sets `muted` as a DOM *property*, never as the HTML
    // attribute. iOS Safari checks the real attribute before allowing inline
    // autoplay, so without this the video silently stays on its poster.
    v.defaultMuted = true;
    v.muted = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");

    let disposed = false;

    const tryPlay = () => {
      if (disposed) return;
      v.muted = true; // some browsers reset this after a source switch
      const p = v.play();
      if (p && typeof p.then === "function") {
        p.then(() => { if (!disposed) setBlocked(false); })
         .catch(() => { if (!disposed && v.paused) setBlocked(true); });
      }
    };

    // Attempt playback as soon as the element has anything to play, and again
    // whenever the section scrolls into view.
    v.addEventListener("loadedmetadata", tryPlay);
    v.addEventListener("canplay", tryPlay);
    // Real proof of movement: once frames advance, the poster is gone.
    const onPlaying = () => { if (!disposed) setBlocked(false); };
    v.addEventListener("playing", onPlaying);

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) tryPlay();
        else if (!v.paused) v.pause();
      },
      { threshold: 0.2 },
    );
    io.observe(el);

    // Kick it immediately too — the section may already be in view on load.
    tryPlay();

    return () => {
      disposed = true;
      io.disconnect();
      v.removeEventListener("loadedmetadata", tryPlay);
      v.removeEventListener("canplay", tryPlay);
      v.removeEventListener("playing", onPlaying);
    };
  }, []);

  const manualPlay = () => {
    const v = vidRef.current;
    if (!v) return;
    v.muted = true;
    void v.play().then(() => setBlocked(false)).catch(() => {});
  };

  return (
    <div ref={wrapRef} style={{ padding: "38px 16px 0" }}>
      {/* ── BLOCK 1: video only, completely unobstructed ── */}
      <div style={{
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid rgba(0,174,239,0.2)",
        background: "#03080f",
        boxShadow: "0 0 24px rgba(0,174,239,0.08)",
        lineHeight: 0,
      }}>
        <video
          ref={vidRef}
          poster="/tls-precision-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "contain",
            aspectRatio: "16 / 9",
            background: "#03080f",
          }}
        >
          {/* Phones / small tablets load the lighter file (~2 MB) */}
          <source src="/tls-precision-720p.mp4" type="video/mp4" media="(max-width: 768px)" />
          {/* Desktop / large screens load the full-resolution master */}
          <source src="/tls-precision-1080p.mp4" type="video/mp4" />
        </video>

        {/* Shown ONLY if the browser blocked autoplay. Disappears on first play. */}
        {blocked && (
          <button
            type="button"
            onClick={manualPlay}
            aria-label="Play Precision Approach video"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(3,8,15,0.35)",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <span style={{
              width: 76,
              height: 76,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,174,239,0.18)",
              border: "2px solid #00AEEF",
              boxShadow: "0 0 26px rgba(0,174,239,0.5)",
            }}>
              <Play size={34} color="#EAF7FF" fill="#EAF7FF" style={{ marginLeft: 4 }} />
            </span>
          </button>
        )}
      </div>

      {/* ── BLOCK 2: information panel, text only, below the video ── */}
      <div style={{
        marginTop: 16,
        borderRadius: 12,
        border: "1px solid rgba(0,174,239,0.2)",
        background: "linear-gradient(180deg, rgba(0,174,239,0.06), rgba(3,8,15,0.85))",
        boxShadow: "0 0 24px rgba(0,174,239,0.06)",
        padding: "26px 20px 28px",
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "Orbitron, Rajdhani, sans-serif",
          fontWeight: 900,
          fontSize: "clamp(24px, 6.4vw, 46px)",
          lineHeight: 1.18,
          letterSpacing: "0.02em",
          color: "#EAF7FF",
          textShadow: "0 0 22px rgba(0,174,239,0.35)",
        }}>
          PRECISION APPROACH GUIDANCE
        </div>
        <div style={{
          height: 2,
          width: 96,
          margin: "16px auto 18px",
          background: "linear-gradient(90deg, transparent, #00AEEF, transparent)",
        }} />
        <div style={{
          fontFamily: "Poppins, Inter, sans-serif",
          fontWeight: 700,
          fontSize: "clamp(17px, 4.4vw, 26px)",
          lineHeight: 1.75,
          color: "rgba(255,255,255,0.9)",
          maxWidth: 860,
          margin: "0 auto",
        }}>
          Keeping the aircraft on the correct approach path for a safe landing.
        </div>
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
        background: "linear-gradient(180deg, #03101e 0%, #020c18 50%, #010810 100%)",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6) inset",
      }}>
        <div className="scan-line" />
        <RadarRings />

        {/* Corner brackets */}
        {[{top:10,left:12},{top:10,right:12},{bottom:10,left:12},{bottom:10,right:12}].map((pos,i) => (
          <div key={i} style={{
            position:"absolute",...pos,width:22,height:22,
            borderTop:    i<2  ? "2px solid rgba(0,174,239,0.7)" : undefined,
            borderBottom: i>=2 ? "2px solid rgba(0,174,239,0.7)" : undefined,
            borderLeft:  (i===0||i===2) ? "2px solid rgba(0,174,239,0.7)" : undefined,
            borderRight: (i===1||i===3) ? "2px solid rgba(0,174,239,0.7)" : undefined,
            filter: "drop-shadow(0 0 4px rgba(0,174,239,0.5))",
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
            }}>SYSTEM ACTIVE</div>
          </div>

          {/* XP bar */}
          <div style={{ width: "100%", maxWidth: 300 }}>
            <XpBar xp={streak.totalXp} />
          </div>
        </div>
      </div>

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
                flexShrink: 0,
              }}><Play size={16} strokeWidth={2} color={color} /></div>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div className="sub-heading" style={{ marginBottom: 0 }}>SYSTEM INTRODUCTION</div>
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
            <span>AR</span>
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

      {/* ── PRECISION APPROACH GUIDANCE (separate section, below the hero) ── */}
      <PrecisionApproachSection />

      {/* ── LOGOUT (bottom) ── */}
      <div style={{ padding: "0 16px 32px", textAlign: "center" }}>
        <button onClick={handleLogout} style={{
          background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
          color: "var(--text-muted)", fontFamily: "Inter", fontSize: 9,
          letterSpacing: "0.1em", padding: "8px 20px", cursor: "pointer",
        }}>
          LOGOUT
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
    { label:"TLS BASICS",    sub:"Core TLS concepts",        path:"/basics",      color:"#00AEEF", available:true  },
    { label:"TLS ADVANCED",  sub:"Advanced procedures",      path:"/advanced",    color:"#FFD166", available:true  },
    { label:"MANUALS",       sub:"Reference documents",      path:"/manuals",     color:"#C9A66B", available:true  },
    { label:"ABOUT",         sub:"System information",       path:"/about",       color:"#35D4FF", available:true  },
    { label:"QUIZ",          sub:"Requires registration",    path:"/quiz-list",   color:"#00D26A", available:false },
    { label:"LEADERBOARD",   sub:"Requires registration",    path:"/leaderboard", color:"#FF4D4D", available:false },
    { label:"CHAT",          sub:"Requires registration",    path:"/chat",        color:"#FF9500", available:false },
    { label:"PROGRESS",      sub:"Requires registration",    path:"/",            color:"#AF52DE", available:false },
  ];
  const sectionIcons: Record<string, React.ReactNode> = {
    "TLS BASICS":   <BookOpen size={20} strokeWidth={1.6} />,
    "TLS ADVANCED": <Zap size={20} strokeWidth={1.6} />,
    "MANUALS":      <FileText size={20} strokeWidth={1.6} />,
    "ABOUT":        <Info size={20} strokeWidth={1.6} />,
    "QUIZ":         <Target size={20} strokeWidth={1.6} />,
    "LEADERBOARD":  <Trophy size={20} strokeWidth={1.6} />,
    "CHAT":         <MessageSquare size={20} strokeWidth={1.6} />,
    "PROGRESS":     <BarChart2 size={20} strokeWidth={1.6} />,
  };
  return (
    <div className="page" style={{ background:"var(--bg-primary)", minHeight:"100vh", paddingBottom:40 }}>
      {/* Guest banner */}
      <div style={{
        background:"linear-gradient(135deg,rgba(255,215,0,0.1),rgba(255,215,0,0.04))",
        border:"1px solid rgba(255,215,0,0.25)", padding:"12px 20px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <Eye size={18} strokeWidth={1.8} color="#FFD166" style={{ flexShrink:0 }} />
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
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <div className="sub-heading" style={{ color:"rgba(255,255,255,0.35)", marginBottom:0 }}>AVAILABLE SECTIONS</div>
          <div style={{ fontFamily:"Inter", fontSize:9, color:"rgba(255,255,255,0.2)", letterSpacing:"0.06em" }}>{sections.filter(s=>s.available).length}/{sections.length} UNLOCKED</div>
        </div>
        <div className="section-grid-2col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {sections.map((s)=>(
            <div
              key={s.label}
              className={`stagger-item section-card${s.available ? " section-card-available" : ""}`}
              onClick={()=>{ if(s.available) navigate(s.path); }}
              style={{
                padding:"18px 14px 16px",
                borderRadius:16,
                cursor:s.available?"pointer":"default",
                background: s.available
                  ? `linear-gradient(135deg, ${s.color}12 0%, ${s.color}06 100%)`
                  : "rgba(255,255,255,0.015)",
                border:`1px solid ${s.available ? s.color+"35" : "rgba(255,255,255,0.06)"}`,
                opacity: s.available ? 1 : 0.5,
                position:"relative",
                overflow:"hidden",
              }}
            >
              {/* Glow accent top-right */}
              {s.available && (
                <div style={{
                  position:"absolute", top:-20, right:-20,
                  width:60, height:60, borderRadius:"50%",
                  background:`radial-gradient(circle, ${s.color}20, transparent 70%)`,
                  pointerEvents:"none",
                }} />
              )}
              {/* Icon */}
              <div style={{
                marginBottom:12,
                color:s.available?s.color:"rgba(255,255,255,0.2)",
                display:"flex", alignItems:"center",
              }}>
                {sectionIcons[s.label]}
              </div>
              {/* Label */}
              <div style={{
                fontFamily:"Inter", fontSize:10, fontWeight:700,
                color:s.available?s.color:"rgba(255,255,255,0.22)",
                letterSpacing:"0.1em", marginBottom:5,
              }}>{s.label}</div>
              {/* Sub */}
              <div style={{
                fontFamily:"Inter", fontSize:10,
                color:s.available?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.2)",
                lineHeight:1.4,
              }}>{s.sub}</div>
              {/* Lock badge */}
              {!s.available && (
                <div style={{
                  display:"inline-flex", alignItems:"center", gap:4,
                  marginTop:8, padding:"3px 8px",
                  background:"rgba(255,255,255,0.05)",
                  border:"1px solid rgba(255,255,255,0.1)",
                  borderRadius:6,
                  fontFamily:"Inter", fontSize:8, color:"rgba(255,255,255,0.25)",
                  letterSpacing:"0.08em",
                }}>
                  <Lock size={8} strokeWidth={2} /> LOCKED
                </div>
              )}
              {/* Available arrow hint */}
              {s.available && (
                <div style={{
                  position:"absolute", bottom:12, right:12,
                  color:`${s.color}60`,
                }}>
                  <ChevronRight size={14} strokeWidth={2} />
                </div>
              )}
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
  // Pre-login entry screen — session-scoped only, never permanently suppressed
  const [showWelcome, setShowWelcome] = useState(() => !getSession() && shouldShowWelcome());

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
    resetWelcome();                                 // next visit shows the entry screen again
    setShowWelcome(true);
  };

  if (!session && showWelcome) {
    return <WelcomeScreen onContinue={() => setShowWelcome(false)} />;
  }

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (session.id === 'guest') {
    return <GuestHomePage onExit={() => { sessionStorage.removeItem('tls_guest_mode'); setSessionState(null); }} />;
  }

  return <HomePage session={session} onLogout={handleLogout} />;
}
