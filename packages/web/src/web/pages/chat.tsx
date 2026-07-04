import { useState, useRef, useEffect, useCallback, memo } from "react";
import BackButton from "../components/BackButton";

const C = "#00AEEF";

// ─── Types ────────────────────────────────────────────────────────────────────
type AttachmentMeta = {
  id: number;
  file_type: "image" | "pdf" | "audio" | "doc";
  file_name: string;
  mime_type: string;
  size: number;
};

type ChatMsg = {
  id: number;
  room: string;
  sender_id: string;
  sender_name: string;
  sender_role: "trainee" | "admin";
  text: string | null;
  attachment_id: number | null;
  attachment?: AttachmentMeta | null;
  pinned: number;
  pinned_by: string | null;
  pinned_at: number | null;
  important: number;
  deleted: number;
  deleted_by: string | null;
  ts: number;
};

type TraineeInfo = { id: string; name: string; rank?: string; unit?: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1048576).toFixed(1)} MB`;
}
function getTrainee(): TraineeInfo {
  try { const s = localStorage.getItem("tls_trainee"); if (s) return JSON.parse(s); } catch {}
  return { id: "anonymous", name: "Trainee" };
}
function isAdminSession() { return sessionStorage.getItem("tls_admin_verified") !== null; }
function getAdminPw()     { return sessionStorage.getItem("tls_admin_verified") ?? ""; }
function adminHeaders(): HeadersInit {
  return { "Content-Type": "application/json", "x-admin-password": getAdminPw() };
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, role }: { name: string; role: "trainee"|"admin" }) {
  const initials = name.split(" ").map(w=>w[0]??"").slice(0,2).join("").toUpperCase();
  return (
    <div style={{
      width:32,height:32,borderRadius:"50%",flexShrink:0,
      background: role==="admin" ? "linear-gradient(135deg,#FF9500,#FF6B00)" : `linear-gradient(135deg,${C}40,#071426)`,
      border: role==="admin" ? "1px solid #FF950050" : `1px solid ${C}50`,
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:11,fontWeight:700,color:role==="admin"?"#020810":C,fontFamily:"Inter",
    }}>
      {role==="admin" ? "⚡" : initials||"T"}
    </div>
  );
}

// ─── Pinned banner ────────────────────────────────────────────────────────────
function PinnedBanner({ msg, onUnpin, isAdmin }: { msg:ChatMsg; onUnpin:()=>void; isAdmin:boolean }) {
  return (
    <div style={{ margin:"0 0 4px",padding:"8px 12px",background:`rgba(0,174,239,0.08)`,border:`1px solid ${C}30`,borderRadius:8,display:"flex",alignItems:"flex-start",gap:8,flexShrink:0 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C} strokeWidth="2" style={{flexShrink:0,marginTop:2}}>
        <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
      </svg>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:9,color:C,fontFamily:"Inter",letterSpacing:"0.05em",marginBottom:2}}>PINNED MESSAGE</div>
        <div style={{fontSize:12,color:"var(--text-secondary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {msg.text ?? `[${msg.attachment?.file_type??"attachment"}]`}
        </div>
      </div>
      {isAdmin && <button onClick={onUnpin} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:16,lineHeight:1,flexShrink:0,padding:"0 2px"}}>×</button>}
    </div>
  );
}

// ─── Attachments ──────────────────────────────────────────────────────────────
function ImageAttachment({ id, fileName, onView }: { id:number; fileName:string; onView:(id:number,name:string)=>void }) {
  return (
    <div onClick={()=>onView(id,fileName)} style={{marginTop:6,borderRadius:10,overflow:"hidden",maxWidth:220,cursor:"pointer",border:`1px solid ${C}30`}}>
      <img src={`/api/chat/attachment/${id}`} alt={fileName} style={{display:"block",width:"100%",maxHeight:160,objectFit:"cover"}} loading="lazy"/>
    </div>
  );
}
function AudioAttachment({ id, fileName }: { id:number; fileName:string }) {
  return (
    <div style={{marginTop:6,padding:"8px 12px",background:`rgba(0,174,239,0.06)`,borderRadius:10,border:`1px solid ${C}20`,maxWidth:260}}>
      <div style={{fontSize:10,color:"var(--text-muted)",marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C} strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        {fileName}
      </div>
      <audio controls src={`/api/chat/attachment/${id}`} style={{width:"100%",height:32,outline:"none"}}/>
    </div>
  );
}
function FileAttachment({ id, fileName, fileType, size }: { id:number; fileName:string; fileType:string; size:number }) {
  return (
    <a href={`/api/chat/attachment/${id}`} target="_blank" rel="noreferrer" style={{marginTop:6,display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:`rgba(0,174,239,0.06)`,borderRadius:10,border:`1px solid ${C}20`,textDecoration:"none",maxWidth:260}}>
      <span style={{fontSize:18}}>{fileType==="pdf"?"📄":"📎"}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,color:"var(--text-secondary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fileName}</div>
        <div style={{fontSize:10,color:"var(--text-muted)"}}>{fmtSize(size)}</div>
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C} strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    </a>
  );
}

// ─── Admin menu — bottom sheet (mobile) / popover (desktop) ──────────────────
type MenuState = { msgId:number; senderId:string; senderName:string; deleted:boolean; pinned:boolean; x:number; y:number };

function AdminMenu({
  menu, onClose, onDelete, onPin, onUnpin, onMarkImportant, onWarn, onMute, onBlock,
}: {
  menu: MenuState;
  onClose: ()=>void;
  onDelete: (id:number)=>void;
  onPin:    (id:number)=>void;
  onUnpin:  (id:number)=>void;
  onMarkImportant: (id:number)=>void;
  onWarn:  (id:string,name:string)=>void;
  onMute:  (id:string,name:string)=>void;
  onBlock: (id:string,name:string)=>void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = window.innerWidth <= 768;

  // Close on outside tap — delayed so triggering touch doesn't instantly close
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      if (!alive) return;
      const handler = (e: MouseEvent|TouchEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) onClose();
      };
      document.addEventListener("mousedown", handler);
      document.addEventListener("touchstart", handler, {passive:true});
      return () => {
        document.removeEventListener("mousedown", handler);
        document.removeEventListener("touchstart", handler);
      };
    }, 80);
    return () => { alive=false; clearTimeout(t); };
  }, [onClose]);

  const items = [
    !menu.deleted && { label:"🗑  Delete Message", danger:true,  fn:()=>{ onDelete(menu.msgId); onClose(); } },
    !menu.pinned  && { label:"📌  Pin Message",                   fn:()=>{ onPin(menu.msgId);   onClose(); } },
     menu.pinned  && { label:"📌  Unpin Message",                 fn:()=>{ onUnpin(menu.msgId); onClose(); } },
    !menu.deleted && { label:"⚠️  Mark Important",                fn:()=>{ onMarkImportant(menu.msgId); onClose(); } },
    menu.senderId!=="admin" && { label:"⚠️  Warn User",           fn:()=>{ onWarn(menu.senderId,menu.senderName);  onClose(); } },
    menu.senderId!=="admin" && { label:"🔇  Mute User",           fn:()=>{ onMute(menu.senderId,menu.senderName);  onClose(); } },
    menu.senderId!=="admin" && { label:"🚫  Block User", danger:true, fn:()=>{ onBlock(menu.senderId,menu.senderName); onClose(); } },
  ].filter(Boolean) as {label:string;danger?:boolean;fn:()=>void}[];

  /* ── Mobile bottom sheet ── */
  if (isMobile) return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1998,background:"rgba(0,0,0,0.55)"}}/>
      <div ref={ref} style={{
        position:"fixed",left:0,right:0,bottom:0,zIndex:1999,
        background:"#040912",
        borderTop:"1px solid rgba(0,174,239,0.25)",
        borderRadius:"20px 20px 0 0",
        paddingBottom:"max(env(safe-area-inset-bottom,0px),12px)",
        boxShadow:"0 -12px 48px rgba(0,0,0,0.8)",
        animation:"sheetUp 0.2s cubic-bezier(0.32,0.72,0,1)",
      }}>
        {/* drag handle */}
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0 8px"}}>
          <div style={{width:40,height:4,borderRadius:2,background:"rgba(255,255,255,0.18)"}}/>
        </div>
        <div style={{padding:"0 20px 10px",fontSize:10,color:`${C}88`,fontFamily:"Inter",letterSpacing:"0.1em",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          MESSAGE MODERATION
        </div>
        {items.map(item=>(
          <button key={item.label}
            onPointerUp={()=>item.fn()}
            style={{
              display:"block",width:"100%",textAlign:"left",background:"none",border:"none",
              padding:"16px 22px",fontSize:16,fontFamily:"Inter,sans-serif",fontWeight:600,
              color:item.danger?"#FF4D4D":"var(--text-primary)",
              borderBottom:"1px solid rgba(255,255,255,0.04)",
              cursor:"pointer",WebkitTapHighlightColor:"transparent",
            }}
          >{item.label}</button>
        ))}
        <button
          onPointerUp={onClose}
          style={{
            display:"block",width:"calc(100% - 32px)",margin:"10px 16px 6px",
            background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:14,padding:"14px",color:"var(--text-secondary)",
            fontSize:15,fontFamily:"Inter,sans-serif",fontWeight:600,
            cursor:"pointer",WebkitTapHighlightColor:"transparent",
          }}
        >Cancel</button>
      </div>
    </>
  );

  /* ── Desktop popover ── */
  return (
    <div ref={ref} style={{
      position:"fixed",top:menu.y,left:menu.x,zIndex:1999,
      background:"rgba(4,9,18,0.98)",border:"1px solid rgba(0,174,239,0.2)",
      borderRadius:10,padding:"4px 0",minWidth:190,
      boxShadow:"0 8px 32px rgba(0,0,0,0.6)",
    }}>
      {items.map(item=>(
        <button key={item.label} onClick={item.fn} style={{
          display:"block",width:"100%",textAlign:"left",background:"none",border:"none",
          cursor:"pointer",padding:"9px 14px",fontSize:12,fontFamily:"Inter,sans-serif",
          color:item.danger?"#FF4D4D":"var(--text-secondary)",transition:"background 0.1s",
        }}
          onMouseEnter={e=>(e.currentTarget.style.background="rgba(0,174,239,0.08)")}
          onMouseLeave={e=>(e.currentTarget.style.background="none")}
        >{item.label}</button>
      ))}
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ id, name, onClose }: { id:number; name:string; onClose:()=>void }) {
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{ if(e.key==="Escape") onClose(); };
    document.addEventListener("keydown",h);
    return ()=>document.removeEventListener("keydown",h);
  },[onClose]);
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <img src={`/api/chat/attachment/${id}`} alt={name} onClick={e=>e.stopPropagation()} style={{maxWidth:"100%",maxHeight:"90vh",borderRadius:8,boxShadow:`0 0 40px ${C}30`}}/>
      <button onClick={onClose} style={{position:"absolute",top:16,right:16,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:"50%",width:36,height:36,color:"white",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
// Wrapped in memo so it only re-renders when its own msg changes.
// Touch events use native listeners (not React synthetic) so we can call
// preventDefault() properly without passive-listener restrictions.

const LONG_MS  = 480;
const SWIPE_PX = 68;
const VERT_MAX = 28;

const MsgBubble = memo(function MsgBubble({
  msg, isMine, isAdmin, onMenuRequest, onViewImage,
}: {
  msg: ChatMsg;
  isMine: boolean;
  isAdmin: boolean;
  onMenuRequest: (msgId:number, x:number, y:number) => void;
  onViewImage: (id:number,name:string)=>void;
}) {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const lpTimer  = useRef<ReturnType<typeof setTimeout>|null>(null);
  const tx       = useRef(0);
  const ty       = useRef(0);
  const moved    = useRef(false);
  const gesture  = useRef<"idle"|"lp"|"swipe">("idle");
  const swipeX   = useRef(0);
  const [visualX, setVisualX]           = useState(0);
  const [swipeHint, setSwipeHint]       = useState<"delete"|"pin"|null>(null);

  const attach = msg.attachment;

  // Attach native touch listeners so we can call preventDefault() on move
  useEffect(()=>{
    if (!isAdmin || msg.deleted) return;
    const el = wrapRef.current;
    if (!el) return;

    function onStart(e: TouchEvent) {
      const t = e.touches[0];
      tx.current = t.clientX;
      ty.current = t.clientY;
      moved.current  = false;
      gesture.current= "idle";
      swipeX.current = 0;

      lpTimer.current = setTimeout(()=>{
        if (!moved.current && gesture.current==="idle") {
          gesture.current = "lp";
          if (navigator.vibrate) navigator.vibrate(45);
          const rect = el.getBoundingClientRect();
          onMenuRequest(msg.id, rect.left + rect.width/2, rect.top + rect.height/2);
        }
      }, LONG_MS);
    }

    function onMove(e: TouchEvent) {
      const t = e.touches[0];
      const dx = t.clientX - tx.current;
      const dy = Math.abs(t.clientY - ty.current);

      // Too much vertical → cancel and let scroll through
      if (dy > VERT_MAX && gesture.current !== "swipe") {
        if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current=null; }
        moved.current = true;
        return;
      }

      if (Math.abs(dx) > 6 && gesture.current==="idle") {
        moved.current = true;
        gesture.current = "swipe";
        if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current=null; }
      }

      if (gesture.current==="swipe") {
        e.preventDefault(); // safe here because listener is non-passive
        const clamped = Math.max(-SWIPE_PX*1.3, Math.min(SWIPE_PX*1.3, dx));
        swipeX.current = clamped;
        setVisualX(clamped);
        setSwipeHint(dx < -(SWIPE_PX/2) ? "delete" : dx > (SWIPE_PX/2) ? "pin" : null);
      }
    }

    function onEnd() {
      if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current=null; }

      if (gesture.current==="swipe") {
        if (swipeX.current < -SWIPE_PX) {
          if (navigator.vibrate) navigator.vibrate([15,8,15]);
          // dispatch delete via custom event so parent handles it without prop drilling re-render
          el.dispatchEvent(new CustomEvent("msg:delete", { bubbles:true, detail:{ id:msg.id } }));
        } else if (swipeX.current > SWIPE_PX) {
          if (navigator.vibrate) navigator.vibrate(30);
          el.dispatchEvent(new CustomEvent("msg:pin", { bubbles:true, detail:{ id:msg.id } }));
        }
      }

      // Snap back
      setVisualX(0);
      setSwipeHint(null);
      gesture.current = "idle";
      swipeX.current  = 0;
    }

    el.addEventListener("touchstart",  onStart, {passive:true});
    el.addEventListener("touchmove",   onMove,  {passive:false}); // non-passive = can preventDefault
    el.addEventListener("touchend",    onEnd,   {passive:true});
    el.addEventListener("touchcancel", onEnd,   {passive:true});
    return ()=>{
      el.removeEventListener("touchstart",  onStart);
      el.removeEventListener("touchmove",   onMove);
      el.removeEventListener("touchend",    onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, msg.id, msg.deleted]);

  // Deleted placeholder
  if (msg.deleted) {
    return (
      <div className="fade-in" style={{display:"flex",justifyContent:isMine?"flex-end":"flex-start",padding:"2px 0"}}>
        <div style={{fontSize:11,color:"var(--text-muted)",fontStyle:"italic",padding:"7px 12px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10}}>
          🚫 Message removed by administrator
        </div>
      </div>
    );
  }

  const isImportant = !!msg.important && msg.sender_id==="admin";

  if (isImportant) {
    return (
      <div className="fade-in" style={{display:"flex",justifyContent:"center",padding:"4px 0"}}>
        <div style={{padding:"8px 14px",borderRadius:10,maxWidth:"85%",background:"rgba(255,148,0,0.08)",border:"1px solid rgba(255,148,0,0.3)",fontSize:12,color:"#FFB830",textAlign:"center",boxShadow:"0 0 12px rgba(255,148,0,0.1)"}}>
          {msg.text}
        </div>
      </div>
    );
  }

  const swiping = visualX !== 0;

  return (
    <div
      ref={wrapRef}
      className="fade-in"
      style={{position:"relative",padding:"2px 0",userSelect:"none"}}
      onContextMenu={isAdmin ? e=>{ e.preventDefault(); onMenuRequest(msg.id,e.clientX,e.clientY); } : undefined}
    >
      {/* Swipe hint labels */}
      {swiping && (
        <>
          <div style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",gap:4,opacity:swipeHint==="delete"?1:0.25,pointerEvents:"none",transition:"opacity 0.1s"}}>
            <span style={{fontSize:16}}>🗑</span>
            <span style={{fontSize:9,color:"#FF4D4D",fontFamily:"Inter"}}>DELETE</span>
          </div>
          <div style={{position:"absolute",left:6,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",gap:4,opacity:swipeHint==="pin"?1:0.25,pointerEvents:"none",transition:"opacity 0.1s"}}>
            <span style={{fontSize:16}}>📌</span>
            <span style={{fontSize:9,color:C,fontFamily:"Inter"}}>PIN</span>
          </div>
        </>
      )}

      {/* Row */}
      <div
        ref={innerRef}
        style={{
          display:"flex",flexDirection:isMine?"row-reverse":"row",gap:8,alignItems:"flex-end",
          transform:`translateX(${visualX}px)`,
          transition:swiping?"none":"transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)",
          willChange:"transform",
        }}
      >
        {!isMine && <Avatar name={msg.sender_name} role={msg.sender_role}/>}

        <div style={{maxWidth:"76%",position:"relative"}}>
          {!isMine && (
            <div style={{fontSize:10,color:"var(--text-muted)",marginBottom:3,paddingLeft:2}}>
              <span style={{color:msg.sender_role==="admin"?"#FF9500":C,fontFamily:"Inter",fontSize:9}}>
                {msg.sender_role==="admin"?"⚡ ADMIN":msg.sender_name.toUpperCase()}
              </span>
            </div>
          )}
          <div style={{
            padding:"10px 13px",
            borderRadius:isMine?"16px 4px 16px 16px":"4px 16px 16px 16px",
            background:isMine?`linear-gradient(135deg,rgba(0,174,239,0.22),rgba(0,174,239,0.1))`:msg.sender_role==="admin"?"rgba(255,149,0,0.06)":"rgba(8,15,28,0.95)",
            border:isMine?`1px solid ${C}45`:msg.sender_role==="admin"?"1px solid rgba(255,149,0,0.2)":`1px solid ${C}18`,
            boxShadow:isMine?`0 0 12px ${C}18`:"0 2px 8px rgba(0,0,0,0.25)",
            outline: swipeHint==="delete"?"1.5px solid rgba(255,77,77,0.55)": swipeHint==="pin"?`1.5px solid ${C}55`:"none",
          }}>
            {msg.text && <div style={{fontSize:13,color:"var(--text-primary)",lineHeight:1.65,whiteSpace:"pre-wrap"}}>{msg.text}</div>}
            {attach?.file_type==="image" && <ImageAttachment id={attach.id} fileName={attach.file_name} onView={onViewImage}/>}
            {attach?.file_type==="audio" && <AudioAttachment id={attach.id} fileName={attach.file_name}/>}
            {(attach?.file_type==="pdf"||attach?.file_type==="doc") && <FileAttachment id={attach.id} fileName={attach.file_name} fileType={attach.file_type} size={attach.size}/>}
          </div>

          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3,justifyContent:isMine?"flex-end":"flex-start"}}>
            <span style={{fontSize:9,color:"var(--text-muted)",fontFamily:"Inter",letterSpacing:"0.04em"}}>{fmtTime(msg.ts)}</span>
            {!!msg.pinned && <span style={{fontSize:9,color:C}}>📌</span>}
            {!!msg.important && <span style={{fontSize:9,color:"#FFB830"}}>⚠</span>}
          </div>
        </div>

        {/* ⋮ button — desktop only trigger, visible on hover */}
        {isAdmin && (
          <button
            onClick={e=>{ e.stopPropagation(); onMenuRequest(msg.id,e.clientX,e.clientY); }}
            style={{
              alignSelf:"center",background:"none",border:"none",cursor:"pointer",
              color:"var(--text-muted)",fontSize:18,padding:"4px 6px",borderRadius:6,
              opacity:0.15,transition:"opacity 0.15s,background 0.15s",flexShrink:0,
              WebkitTapHighlightColor:"transparent",touchAction:"manipulation",
            }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="1"; (e.currentTarget as HTMLElement).style.background="rgba(0,174,239,0.1)";}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity="0.15"; (e.currentTarget as HTMLElement).style.background="none";}}
          >⋮</button>
        )}
      </div>
    </div>
  );
});

// ─── Upload progress ──────────────────────────────────────────────────────────
function UploadProgress({ percent, fileName, onCancel }: { percent:number; fileName:string; onCancel:()=>void }) {
  return (
    <div style={{margin:"0 0 6px",padding:"8px 12px",background:`rgba(0,174,239,0.06)`,border:`1px solid ${C}25`,borderRadius:8,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
      <div style={{flex:1}}>
        <div style={{fontSize:11,color:"var(--text-secondary)",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fileName}</div>
        <div style={{height:3,background:`rgba(0,174,239,0.12)`,borderRadius:2}}>
          <div style={{height:"100%",width:`${percent}%`,background:C,borderRadius:2,transition:"width 0.2s"}}/>
        </div>
      </div>
      <span style={{fontSize:10,color:C,fontFamily:"Inter",minWidth:36,textAlign:"right"}}>{percent}%</span>
      <button onClick={onCancel} style={{background:"none",border:"none",color:"var(--text-muted)",cursor:"pointer",fontSize:16,padding:"0 2px"}}>×</button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
// ─── AI Instructor ────────────────────────────────────────────────────────────
const PRESET_QUESTIONS = [
  "What is TLS and how does it work?",
  "Explain the main components of the TLS system",
  "What are the TLS critical and sensitive areas?",
  "Explain ILS Category I, II, and III differences",
  "What is DDM and how is it used in ILS/TLS?",
  "How does Mode C transponder encoding work?",
  "What is the TLS integrity monitor and why is it important?",
  "Explain the difference between localizer and glide slope",
  "What causes bends and scalloping in ILS signals?",
  "What is VSWR and why does it matter in TLS maintenance?",
  "Describe the TLS startup procedure",
  "What is the ILS reference datum?",
  "How do I interpret RCU alarm codes?",
  "What are common TLS calibration faults?",
  "Explain ESA alignment procedure",
];

type AiMsg = { role: "user" | "assistant"; content: string; attachName?: string; attachType?: string; attachPreview?: string; images?: { path: string; label: string }[] };

type TraineeSummary = {
  weakModules: { module_id: number; module_name: string; avg_pct: number; fail_count: number }[];
  missedQuestions: { question_id: number; question_text: string; module_id: number; times_wrong: number }[];
  latestAttempt: { module_id: number; module_name: string; pct: number; passed: number; ts: number } | null;
  overall: { total_attempts: number; overall_avg: number; total_passed: number };
};

function AIInstructor() {
  const [history,   setHistory]   = useState<AiMsg[]>([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [showAll,   setShowAll]   = useState(false);
  const [aiStatus,  setAiStatus]  = useState<{ qualified: boolean; questionsUsed: number; questionsRemaining: number; resetsIn: string } | null>(null);
  const [lockState, setLockState] = useState<"limit" | null>(null);
  const [limitMsg,  setLimitMsg]  = useState("");
  const [attachment, setAttachment] = useState<{ data: string; type: string; name: string; preview?: string } | null>(null);
  const [summary, setSummary] = useState<TraineeSummary | null>(null);
  const [smartGreeting, setSmartGreeting] = useState<string | null>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const trainee   = getTrainee();
  const isAdmin   = isAdminSession();

  const VISIBLE_PRESETS = showAll ? PRESET_QUESTIONS : PRESET_QUESTIONS.slice(0, 6);

  // Load conversation history from DB on mount
  useEffect(() => {
    if (isAdmin || !trainee.id || trainee.id === "anonymous") return;
    fetch(`/api/chat/ai/history/${encodeURIComponent(trainee.id)}`)
      .then(r => r.json())
      .then((rows: any[]) => {
        if (Array.isArray(rows) && rows.length > 0) {
          setHistory(rows.map(r => ({ role: r.role as "user" | "assistant", content: r.content })));
        }
      })
      .catch(() => {});
  }, []);

  // Auto-review: if navigated from quiz with ?review=ModuleName&pct=XX
  const reviewTriggeredRef = useRef(false);
  useEffect(() => {
    if (reviewTriggeredRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const reviewModule = params.get('review');
    const reviewPct = params.get('pct');
    if (reviewModule) {
      reviewTriggeredRef.current = true;
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Auto-ask for review after a short delay
      setTimeout(() => {
        ask(`خلصت كويز ${reviewModule} وحصلت ${reviewPct}%. راجع معي النقاط اللي أخطأت فيها واشرحلي الإجابات الصحيحة.`);
      }, 500);
    }
  }, []);

  // Load trainee performance summary for smart greeting
  useEffect(() => {
    if (isAdmin || !trainee.id || trainee.id === "anonymous") return;
    fetch(`/api/ai/trainee-summary/${encodeURIComponent(trainee.id)}`)
      .then(r => r.json())
      .then((data: TraineeSummary) => {
        setSummary(data);
        // Build smart greeting based on performance
        if (data.weakModules && data.weakModules.length > 0) {
          const weakest = data.weakModules[0];
          setSmartGreeting(
            `لاحظت إنك محتاج تراجع موضوع ${weakest.module_name ?? 'Module ' + weakest.module_id} (معدلك ${weakest.avg_pct}%). تبي نراجعه سوا؟`
          );
        } else if (data.latestAttempt && data.latestAttempt.passed === 0) {
          setSmartGreeting(
            `شفت إنك ما عديت كويز ${data.latestAttempt.module_name ?? ''} (حصلت ${data.latestAttempt.pct}%). خلني أساعدك تفهم النقاط اللي أخطأت فيها.`
          );
        } else if (data.overall && data.overall.total_attempts > 0) {
          setSmartGreeting(
            `أداؤك ممتاز! معدلك العام ${data.overall.overall_avg}%. هل تبي تتعمق في موضوع معين؟`
          );
        }
      })
      .catch(() => {});
  }, []);

  // Load AI status on mount (trainees only)
  useEffect(() => {
    if (isAdmin || !trainee.id || trainee.id === "anonymous") return;
    fetch(`/api/ai/status/${encodeURIComponent(trainee.id)}`)
      .then(r => r.json())
      .then((d: any) => {
        setAiStatus(d);
        if (d.questionsRemaining === 0) {
          setLockState("limit");
          setLimitMsg("Resets tomorrow.");
        }
      })
      .catch(() => {});
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("الملف كبير جداً. الحد الأقصى 5MB.\nFile too large. Max 5MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const base64 = result.split(',')[1];
      setAttachment({ data: base64, type: file.type, name: file.name, preview: file.type.startsWith('image/') ? result : undefined });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    const att = attachment;
    setAttachment(null);
    const userMsg: AiMsg = { role: "user", content: q, ...(att ? { attachName: att.name, attachType: att.type, attachPreview: att.preview } : {}) };
    setHistory(prev => [...prev, userMsg]);
    setLoading(true);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    try {
      const res = await fetch("/api/chat/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          history: history.slice(-10),
          userId: isAdmin ? undefined : trainee.id,
          ...(att ? { fileData: att.data, fileType: att.type, fileName: att.name } : {}),
        }),
      });
      const data = await res.json() as { reply?: string; error?: string; message?: string; images?: { path: string; label: string }[] };
      if (data.error === "limit") {
        setLockState("limit");
        setLimitMsg(data.message ?? "Resets tomorrow.");
        setHistory(prev => prev.slice(0, -1));
        return;
      }
      setHistory(prev => [...prev, { role: "assistant", content: data.reply ?? "عذراً، تعذر الاتصال.\nSorry, connection failed.", images: data.images }]);
      // update local question count
      setAiStatus(prev => prev ? { ...prev, questionsUsed: prev.questionsUsed + 1, questionsRemaining: Math.max(0, prev.questionsRemaining - 1) } : prev);
    } catch {
      setHistory(prev => [...prev, { role: "assistant", content: "عذراً، تعذر الاتصال.\nSorry, connection failed." }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  };

  // ── Limit reached screen ────────────────────────────────────────────────────
  if (lockState === "limit") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "32px 24px", textAlign: "center", gap: 16 }}>
        <div style={{ fontSize: 52 }}>⏳</div>
        <div className="font-orbitron" style={{ fontSize: 13, color: "#FF9500", letterSpacing: "0.08em" }}>DAILY LIMIT REACHED</div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, padding: "10px 20px",
          background: "rgba(255,149,0,0.08)", border: "1px solid rgba(255,149,0,0.3)",
          borderRadius: 12, fontSize: 15, fontWeight: 700, color: "#FF9500", fontFamily: "Orbitron,monospace",
        }}>
          50 / 50
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "Inter", lineHeight: 1.7, maxWidth: 260 }}>
          You've used all <strong style={{ color: "var(--text-primary)" }}>50 questions</strong> for today.
        </div>
        <div style={{ fontSize: 12, color: C, fontFamily: "Inter", padding: "8px 16px", background: `rgba(0,174,239,0.06)`, border: `1px solid ${C}25`, borderRadius: 10 }}>
          🕐 {limitMsg || "Resets tomorrow."}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Conversation */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12, scrollbarWidth: "none" }}>

        {/* Welcome */}
        {history.length === 0 && (
          <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🤖</div>
            <div className="font-orbitron" style={{ fontSize: 13, color: C, letterSpacing: "0.05em", marginBottom: 4 }}>AI INSTRUCTOR</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "Inter", lineHeight: 1.5 }}>
              Ask any question about TLS, ILS, aviation navigation, or radar systems.
            </div>
          </div>
        )}

        {/* Smart Greeting — personalized based on performance */}
        {history.length === 0 && smartGreeting && (
          <div style={{
            margin: "4px 0 8px", padding: "12px 14px",
            background: "rgba(0,174,239,0.06)", border: `1px solid ${C}30`,
            borderRadius: 14, borderLeft: `3px solid ${C}`,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontSize: 18, lineHeight: 1 }}>💡</div>
              <div>
                <div style={{ fontSize: 9, color: C, fontFamily: "Inter", letterSpacing: "0.1em", marginBottom: 4 }}>SMART RECOMMENDATION</div>
                <div style={{ fontSize: 12.5, color: "var(--text-primary)", fontFamily: "Inter", lineHeight: 1.6, direction: "rtl" }}>
                  {smartGreeting}
                </div>
              </div>
            </div>
            {summary && summary.weakModules.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {summary.weakModules.slice(0, 3).map(m => (
                  <button key={m.module_id}
                    onClick={() => ask(`راجع معي موضوع ${m.module_name ?? 'Module ' + m.module_id}`)}
                    style={{
                      padding: "6px 10px", borderRadius: 8,
                      background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.25)",
                      color: "#FF6B6B", fontSize: 11, fontFamily: "Inter", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                    <span style={{ fontSize: 8, opacity: 0.7 }}>⚠️</span>
                    {m.module_name ?? `Module ${m.module_id}`} ({m.avg_pct}%)
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Preset questions */}
        {history.length === 0 && (
          <div>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "Inter", letterSpacing: "0.1em", marginBottom: 8, textAlign: "center" }}>QUICK QUESTIONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {VISIBLE_PRESETS.map(q => (
                <button key={q} onClick={() => ask(q)} style={{
                  textAlign: "left", padding: "9px 13px",
                  background: `rgba(0,174,239,0.05)`, border: `1px solid ${C}25`,
                  borderRadius: 10, color: "var(--text-secondary)", fontSize: 12,
                  fontFamily: "Inter", cursor: "pointer", lineHeight: 1.4,
                  transition: "background 0.15s, border-color 0.15s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `rgba(0,174,239,0.12)`; (e.currentTarget as HTMLElement).style.borderColor = `${C}60`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `rgba(0,174,239,0.05)`; (e.currentTarget as HTMLElement).style.borderColor = `${C}25`; }}
                >
                  💬 {q}
                </button>
              ))}
              <button onClick={() => setShowAll(v => !v)} style={{
                textAlign: "center", padding: "7px", background: "none",
                border: `1px dashed ${C}20`, borderRadius: 10,
                color: "var(--text-muted)", fontSize: 11, fontFamily: "Inter", cursor: "pointer",
              }}>
                {showAll ? "▲ Show less" : `▼ Show ${PRESET_QUESTIONS.length - 6} more questions`}
              </button>
            </div>
          </div>
        )}

        {/* Chat history */}
        {history.map((msg, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "Inter", letterSpacing: "0.05em", paddingInline: 4 }}>
              {msg.role === "user" ? "YOU" : "🤖 AI INSTRUCTOR"}
            </div>
            <div style={{
              maxWidth: "82%", padding: "10px 13px",
              borderRadius: msg.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
              background: msg.role === "user"
                ? `linear-gradient(135deg,rgba(0,174,239,0.22),rgba(0,174,239,0.1))`
                : "rgba(8,15,28,0.95)",
              border: msg.role === "user" ? `1px solid ${C}45` : `1px solid ${C}18`,
              fontSize: 13, color: "var(--text-primary)", fontFamily: "Inter", lineHeight: 1.65,
              whiteSpace: "pre-wrap",
            }}>
              {/* Attachment preview inside bubble */}
              {msg.attachName && (
                <div style={{ marginBottom: msg.content ? 8 : 0 }}>
                  {msg.attachPreview
                    ? <img src={msg.attachPreview} alt={msg.attachName}
                        style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8, objectFit: "contain", display: "block" }} />
                    : <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "rgba(0,0,0,0.25)", borderRadius: 8 }}>
                        <span style={{ fontSize: 20 }}>📄</span>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "Inter", wordBreak: "break-all" }}>{msg.attachName}</span>
                      </div>
                  }
                </div>
              )}
              {msg.content}
              {/* Illustrative images from AI response */}
              {msg.role === "assistant" && msg.images && msg.images.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 9, color: C, letterSpacing: "0.08em", fontFamily: "Inter" }}>📷 REFERENCE IMAGES</div>
                  {msg.images.map((img, idx) => (
                    <div key={idx} style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${C}25` }}>
                      <img src={img.path} alt={img.label}
                        style={{ width: "100%", maxHeight: 200, objectFit: "contain", background: "rgba(0,0,0,0.3)", display: "block" }}
                        loading="lazy" />
                      <div style={{ padding: "5px 8px", background: "rgba(0,0,0,0.4)", fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter" }}>
                        {img.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "Inter", paddingTop: 2 }}>🤖 AI INSTRUCTOR</div>
            <div style={{ padding: "10px 14px", background: "rgba(8,15,28,0.95)", border: `1px solid ${C}18`, borderRadius: "4px 16px 16px 16px", display: "flex", gap: 5, alignItems: "center" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C, opacity: 0.5, animation: `blink 1s ${i * 0.2}s ease infinite` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Usage counter (trainees only) */}
      {!isAdmin && aiStatus && (
        <div style={{ flexShrink: 0, padding: "6px 14px 2px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(aiStatus.questionsUsed / 50) * 100}%`, background: aiStatus.questionsRemaining <= 5 ? "#FF9500" : C, borderRadius: 3, transition: "width 0.3s" }} />
          </div>
          <div style={{ fontSize: 10, color: aiStatus.questionsRemaining <= 5 ? "#FF9500" : "var(--text-muted)", fontFamily: "Inter", whiteSpace: "nowrap", minWidth: 80, textAlign: "right" }}>
            {aiStatus.questionsRemaining} / 50 remaining
          </div>
        </div>
      )}

      {/* Attachment preview bar */}
      {attachment && (
        <div style={{ borderTop: `1px solid ${C}18`, background: "rgba(3,8,15,0.97)", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          {attachment.preview
            ? <img src={attachment.preview} alt={attachment.name} style={{ width: 38, height: 38, objectFit: "cover", borderRadius: 7, flexShrink: 0 }} />
            : <div style={{ width: 38, height: 38, borderRadius: 7, background: `rgba(0,174,239,0.08)`, border: `1px solid ${C}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📄</div>
          }
          <span style={{ flex: 1, fontSize: 11, color: "var(--text-secondary)", fontFamily: "Inter", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {attachment.name}
          </span>
          <button onClick={() => setAttachment(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, padding: "0 4px", lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Input area — textarea + bottom toolbar */}
      <div style={{ borderTop: `1px solid ${C}15`, background: "rgba(3,8,15,0.97)", padding: "10px 12px 8px", flexShrink: 0 }}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />

        {/* Textarea — auto-grows */}
        <textarea
          ref={inputRef}
          value={input}
          dir="auto"
          rows={2}
          onChange={e => {
            setInput(e.target.value);
            // auto-grow: reset then set to scrollHeight
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
          }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
          placeholder="اكتب سؤالك عن TLS أو ILS أو أنظمة الملاحة…"
          disabled={loading}
          style={{
            width: "100%", boxSizing: "border-box",
            background: "rgba(8,15,28,0.95)", border: `1px solid ${C}28`,
            borderRadius: 14, padding: "12px 14px",
            color: "var(--text-primary)", fontSize: 13,
            outline: "none", fontFamily: "Inter,sans-serif",
            resize: "none", lineHeight: 1.6, minHeight: 52,
            opacity: loading ? 0.6 : 1, display: "block",
          }}
        />

        {/* Bottom toolbar */}
        <div style={{ display: "flex", alignItems: "center", marginTop: 8, gap: 8 }}>
          {/* + button → file picker */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            title="أرفق صورة أو PDF"
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: attachment ? `rgba(0,174,239,0.18)` : "rgba(255,255,255,0.05)",
              border: `1px solid ${attachment ? C : "rgba(255,255,255,0.12)"}`,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: attachment ? C : "rgba(255,255,255,0.5)",
              fontSize: 22, fontWeight: 300, lineHeight: 1,
              transition: "all 0.18s",
            }}
          >
            +
          </button>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Send button */}
          <button
            onClick={() => ask(input)}
            disabled={(!input.trim() && !attachment) || loading}
            style={{
              width: 42, height: 36, borderRadius: 11, flexShrink: 0,
              background: (input.trim() || attachment) && !loading ? `linear-gradient(135deg,${C},#35D4FF)` : `${C}0d`,
              border: `1px solid ${(input.trim() || attachment) && !loading ? C : `${C}20`}`,
              cursor: (input.trim() || attachment) && !loading ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
              boxShadow: (input.trim() || attachment) && !loading ? `0 0 14px ${C}40` : "none",
            }}
          >
            {loading
              ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${C}40`, borderTopColor: C, animation: "spin 0.7s linear infinite" }} />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={(input.trim() || attachment) ? "#020810" : C} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Chat wrapper with tab switcher ──────────────────────────────────────────
function GroupChat() {
  // This is the original Chat function body, renamed internally
  return <GroupChatInner />;
}

export default function Chat() {
  const [tab, setTab] = useState<"group" | "ai">("ai");
  return (
    <div style={{ background: "var(--bg-primary)", display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", background: "rgba(3,8,15,0.97)", borderBottom: `1px solid ${C}18`, flexShrink: 0 }}>
        {([["ai", "🤖 AI Instructor"], ["group", "📡 Group Chat"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: "12px 8px", background: "none", border: "none",
            borderBottom: tab === id ? `2px solid ${C}` : "2px solid transparent",
            color: tab === id ? C : "rgba(255,255,255,0.35)",
            fontFamily: "Inter", fontSize: 12, letterSpacing: "0.05em",
            cursor: "pointer", transition: "color 0.15s",
          }}>{label}</button>
        ))}
      </div>
      {tab === "ai"    && <AIInstructor />}
      {tab === "group" && <GroupChatInner />}
    </div>
  );
}

function GroupChatInner() {
  // ── state ──────────────────────────────────────────────────────────────────
  const [messages,       setMessages]       = useState<ChatMsg[]>([]);
  const [input,          setInput]          = useState("");
  const [sending,        setSending]        = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{percent:number;fileName:string}|null>(null);
  const [menu,           setMenu]           = useState<MenuState|null>(null);
  const [lightbox,       setLightbox]       = useState<{id:number;name:string}|null>(null);
  const [warnInput,      setWarnInput]      = useState<{id:string;name:string}|null>(null);
  const [warnText,       setWarnText]       = useState("");
  const [onlineCount,    setOnlineCount]    = useState(1);
  const [inputBarBottom, setInputBarBottom] = useState(0);
  const [connected,      setConnected]      = useState(false);
  const [error,          setError]          = useState<string|null>(null);

  // ── refs ───────────────────────────────────────────────────────────────────
  const bottomRef      = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const lastTsRef      = useRef<number>(0);        // last ts seen — never causes re-render
  const messagesRef    = useRef<ChatMsg[]>([]);     // mirror of messages state, ref so SSE closure stays fresh
  const pollRef        = useRef<ReturnType<typeof setInterval>|null>(null);
  const sseRef         = useRef<EventSource|null>(null);
  const uploadXhrRef   = useRef<XMLHttpRequest|null>(null);
  const msgAreaRef     = useRef<HTMLDivElement>(null);

  const isAdmin = isAdminSession();
  const trainee = getTrainee();
  const myId    = isAdmin ? "admin" : trainee.id;
  const myName  = isAdmin ? "Admin" : trainee.name;
  const myRole: "trainee"|"admin" = isAdmin ? "admin" : "trainee";

  const [accountStatus, setAccountStatus] = useState<string>(()=>{
    if (isAdmin) return "active";
    return sessionStorage.getItem("tls_account_status")??"active";
  });
  useEffect(()=>{
    if (isAdmin) return;
    const id = setInterval(()=>setAccountStatus(sessionStorage.getItem("tls_account_status")??"active"),15000);
    return ()=>clearInterval(id);
  },[isAdmin]);
  const canSend = isAdmin||(accountStatus!=="muted"&&accountStatus!=="suspended"&&accountStatus!=="blocked");

  // ── iOS keyboard fix ───────────────────────────────────────────────────────
  useEffect(()=>{
    const vv = window.visualViewport;
    if (!vv) return;
    const fn=()=>setInputBarBottom(Math.max(0,window.innerHeight-vv.height-vv.offsetTop));
    vv.addEventListener("resize",fn); vv.addEventListener("scroll",fn);
    return ()=>{ vv.removeEventListener("resize",fn); vv.removeEventListener("scroll",fn); };
  },[]);

  // ── Scroll ────────────────────────────────────────────────────────────────
  // Only auto-scroll when user is already near the bottom (within 120px)
  // Prevents jarring jumps when user scrolls up to read history
  const isNearBottom = useCallback(()=>{
    const el = msgAreaRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  },[]);

  const scrollBottom = useCallback((smooth=true, force=false)=>{
    if (!force && !isNearBottom()) return;
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:smooth?"smooth":"instant"}),50);
  },[isNearBottom]);

  // ── Merge incoming messages — NO full replace, only patch/append ──────────
  // This is the key fix for chat "reloading": we never replace the entire array.
  // We patch changed messages in-place and append new ones.
  const mergeMessages = useCallback((incoming: ChatMsg[], isFullLoad=false)=>{
    if (isFullLoad) {
      setMessages(incoming);
      messagesRef.current = incoming;
      if (incoming.length) lastTsRef.current = incoming[incoming.length-1].ts;
      scrollBottom(false, true); // full load — always scroll to bottom
      return;
    }
    if (!incoming.length) return;
    setMessages(prev=>{
      const idMap = new Map(prev.map(m=>[m.id,m]));
      let changed = false;
      for (const m of incoming) {
        const existing = idMap.get(m.id);
        if (!existing) { idMap.set(m.id,m); changed=true; }
        else if (existing.deleted!==m.deleted || existing.pinned!==m.pinned || existing.important!==m.important) {
          idMap.set(m.id,m); changed=true;
        }
      }
      if (!changed) return prev;
      const next = Array.from(idMap.values()).sort((a,b)=>a.ts-b.ts);
      messagesRef.current = next;
      return next;
    });
    const last = incoming[incoming.length-1];
    if (last.ts > lastTsRef.current) {
      lastTsRef.current = last.ts;
      scrollBottom();
    }
  },[scrollBottom]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  // Uses stable refs so this callback never changes identity → SSE effect runs once
  const fetchRef = useRef<(since?:number,full?:boolean)=>Promise<void>>(async ()=>{});
  useEffect(()=>{
    fetchRef.current = async (since=0, full=false)=>{
      try {
        const res = await fetch(`/api/chat/messages?room=general&since=${since}&limit=80`);
        if (!res.ok) return;
        const data = await res.json() as {messages:ChatMsg[]};
        if (data.messages?.length) mergeMessages(data.messages, full||since===0);
      } catch (err) { console.error("fetch",err); }
    };
  },[mergeMessages]);

  // ── SSE — stable effect, never re-runs ────────────────────────────────────
  useEffect(()=>{
    // Initial load
    fetchRef.current(0, true);

    let sseOk = false;
    function connect() {
      const es = new EventSource("/api/chat/stream?room=general");
      sseRef.current = es;
      es.onopen = ()=>{ sseOk=true; setConnected(true); };
      es.onmessage = e=>{
        try {
          const data = JSON.parse(e.data);
          if (data.type==="messages" && data.messages?.length) mergeMessages(data.messages);
          if (data.type==="online") setOnlineCount(data.count??1);
        } catch {}
      };
      es.onerror = ()=>{
        setConnected(false); es.close();
        if (!sseOk) {
          pollRef.current = setInterval(()=>fetchRef.current(lastTsRef.current), 3000);
        } else {
          setTimeout(connect, 3000);
        }
      };
    }
    connect();
    return ()=>{ sseRef.current?.close(); if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);  // intentionally empty — runs once

  // ── Custom event bus from MsgBubble (avoids prop callback re-renders) ─────
  useEffect(()=>{
    const area = msgAreaRef.current;
    if (!area) return;

    const onDelete = (e: Event)=>{
      const { id } = (e as CustomEvent).detail;
      // Optimistically mark deleted locally
      setMessages(prev=>{
        const next = prev.map(m=>m.id===id?{...m,deleted:1}:m);
        messagesRef.current=next; return next;
      });
      // Fire API
      fetch("/api/chat/delete",{ method:"POST", headers:adminHeaders(), body:JSON.stringify({messageId:id,room:"general"}) })
        .catch(()=>{});
    };

    const onPin = (e: Event)=>{
      const { id } = (e as CustomEvent).detail;
      const msg = messagesRef.current.find(m=>m.id===id);
      const pinVal = msg?.pinned ? 0 : 1;
      // Optimistic
      setMessages(prev=>{
        const next = prev.map(m=>m.id===id?{...m,pinned:pinVal}:{...m,pinned:0});
        messagesRef.current=next; return next;
      });
      fetch("/api/chat/pin",{ method:"POST", headers:adminHeaders(), body:JSON.stringify({messageId:id,room:"general",pin:!msg?.pinned}) })
        .catch(()=>{});
    };

    area.addEventListener("msg:delete", onDelete);
    area.addEventListener("msg:pin",    onPin);
    return ()=>{ area.removeEventListener("msg:delete",onDelete); area.removeEventListener("msg:pin",onPin); };
  },[]);

  const pinnedMsg = messages.find(m=>!!m.pinned&&!m.deleted);

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMessage = async (text?: string)=>{
    const msg = (text??input).trim();
    if (!msg||sending) return;
    setSending(true);
    setInput("");
    const optimistic: ChatMsg = {
      id:Date.now(),room:"general",sender_id:myId,sender_name:myName,sender_role:myRole,
      text:msg,attachment_id:null,attachment:null,
      pinned:0,pinned_by:null,pinned_at:null,important:0,deleted:0,deleted_by:null,ts:Date.now(),
    };
    setMessages(prev=>{const n=[...prev,optimistic]; messagesRef.current=n; return n;});
    scrollBottom(true, true); // user sent — always scroll
    try {
      await fetch("/api/chat/send",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({room:"general",senderId:myId,senderName:myName,senderRole:myRole,text:msg}),
      });
      setMessages(prev=>{const n=prev.filter(m=>m.id!==optimistic.id); messagesRef.current=n; return n;});
      fetchRef.current(lastTsRef.current);
    } catch {
      setError("Failed to send");
      setMessages(prev=>{const n=prev.filter(m=>m.id!==optimistic.id); messagesRef.current=n; return n;});
    } finally { setSending(false); }
  };

  // ── File upload ───────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>)=>{
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10*1048576) { setError("File too large (max 10 MB)"); return; }
    setUploadProgress({percent:0,fileName:file.name});
    const xhr = new XMLHttpRequest();
    uploadXhrRef.current = xhr;
    const fd = new FormData();
    fd.append("file",file); fd.append("senderId",myId); fd.append("senderName",myName);
    fd.append("senderRole",myRole); fd.append("room","general");
    xhr.upload.onprogress = ev=>{ if(ev.lengthComputable) setUploadProgress({percent:Math.round(ev.loaded/ev.total*100),fileName:file.name}); };
    xhr.onload = ()=>{
      setUploadProgress(null);
      if (xhr.status===200) { fetchRef.current(lastTsRef.current); scrollBottom(); }
      else setError("Upload failed");
    };
    xhr.onerror = ()=>{ setUploadProgress(null); setError("Upload failed"); };
    xhr.open("POST","/api/chat/upload"); xhr.send(fd);
    e.target.value="";
  };

  // ── Admin actions via menu ────────────────────────────────────────────────
  const openMenu = useCallback((msgId:number, x:number, y:number)=>{
    const msg = messagesRef.current.find(m=>m.id===msgId);
    if (!msg) return;
    setMenu({msgId,senderId:msg.sender_id,senderName:msg.sender_name,deleted:!!msg.deleted,pinned:!!msg.pinned,x,y});
  },[]);

  const menuDelete = (id:number)=>{
    setMessages(prev=>{const n=prev.map(m=>m.id===id?{...m,deleted:1}:m); messagesRef.current=n; return n;});
    setMenu(null);
    fetch("/api/chat/delete",{method:"POST",headers:adminHeaders(),body:JSON.stringify({messageId:id,room:"general"})}).catch(()=>{});
  };
  const menuPin = (id:number)=>{
    const msg=messagesRef.current.find(m=>m.id===id);
    const v=msg?.pinned?0:1;
    setMessages(prev=>{const n=prev.map(m=>m.id===id?{...m,pinned:v}:{...m,pinned:0}); messagesRef.current=n; return n;});
    setMenu(null);
    fetch("/api/chat/pin",{method:"POST",headers:adminHeaders(),body:JSON.stringify({messageId:id,room:"general",pin:!msg?.pinned})}).catch(()=>{});
  };
  const menuUnpin = (id:number)=>{
    setMessages(prev=>{const n=prev.map(m=>m.id===id?{...m,pinned:0}:m); messagesRef.current=n; return n;});
    setMenu(null);
    fetch("/api/chat/pin",{method:"POST",headers:adminHeaders(),body:JSON.stringify({messageId:id,room:"general",pin:false})}).catch(()=>{});
  };
  const menuImportant = (id:number)=>{
    setMessages(prev=>{const n=prev.map(m=>m.id===id?{...m,important:1}:m); messagesRef.current=n; return n;});
    setMenu(null);
    fetch("/api/chat/important",{method:"POST",headers:adminHeaders(),body:JSON.stringify({messageId:id,important:true})}).catch(()=>{});
  };
  const menuWarn  = (id:string,name:string)=>{ setMenu(null); setWarnInput({id,name}); };
  const menuMute  = (id:string,name:string)=>{
    setMenu(null);
    if (!confirm(`Mute ${name}?`)) return;
    fetch("/api/admin/moderate",{method:"POST",headers:adminHeaders(),body:JSON.stringify({traineeId:id,action:"mute",reason:"Chat moderation"})}).catch(()=>{});
  };
  const menuBlock = (id:string,name:string)=>{
    setMenu(null);
    if (!confirm(`Block ${name}?`)) return;
    fetch("/api/admin/moderate",{method:"POST",headers:adminHeaders(),body:JSON.stringify({traineeId:id,action:"block",reason:"Chat moderation"})}).catch(()=>{});
  };

  const submitWarn = ()=>{
    if (!warnInput) return;
    fetch("/api/chat/warn",{method:"POST",headers:adminHeaders(),body:JSON.stringify({traineeId:warnInput.id,traineeName:warnInput.name,reason:warnText||undefined})}).catch(()=>{});
    setWarnInput(null); setWarnText("");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{background:"var(--bg-primary)",display:"flex",flexDirection:"column",height:"100dvh",position:"relative",overflow:"hidden"}}>
      <style>{`
        @keyframes fadeIn  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes sheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .fade-in { animation:fadeIn 0.18s ease; }
      `}</style>

      {/* Header */}
      <div style={{padding:"10px 14px",background:"rgba(3,8,15,0.97)",borderBottom:`1px solid ${C}18`,display:"flex",alignItems:"center",gap:10,flexShrink:0,zIndex:10}}>
        <BackButton to="/" style={{flexShrink:0}}/>
        <div style={{width:38,height:38,borderRadius:"50%",flexShrink:0,background:`${C}15`,border:`1px solid ${C}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📡</div>
        <div style={{flex:1,minWidth:0}}>
          <div className="font-orbitron" style={{fontSize:11,fontWeight:700,color:"#e8f4fd",letterSpacing:"0.05em"}}>TLS GROUP CHANNEL</div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:connected?"#00D26A":"#888",boxShadow:connected?"0 0 5px #00D26A":"none"}}/>
            <span style={{fontSize:10,color:connected?"#00D26A":"var(--text-muted)"}}>{connected?`Live · ${onlineCount} online`:"Connecting…"}</span>
          </div>
        </div>
        {isAdmin && <div style={{padding:"4px 8px",background:"rgba(255,149,0,0.1)",border:"1px solid rgba(255,149,0,0.3)",borderRadius:6}}><span className="font-orbitron" style={{fontSize:9,color:"#FF9500",letterSpacing:"0.08em"}}>⚡ ADMIN</span></div>}
      </div>

      {/* Pinned */}
      {pinnedMsg && <div style={{flexShrink:0,padding:"0 12px"}}><PinnedBanner msg={pinnedMsg} isAdmin={isAdmin} onUnpin={()=>menuUnpin(pinnedMsg.id)}/></div>}

      {/* Admin gesture hint */}
      {isAdmin && (
        <div style={{flexShrink:0,padding:"3px 14px",background:`rgba(0,174,239,0.03)`,borderBottom:`1px solid ${C}0a`,textAlign:"center"}}>
          <span style={{fontSize:9,color:`${C}50`,fontFamily:"Inter",letterSpacing:"0.06em"}}>← SWIPE DELETE &nbsp;·&nbsp; HOLD MENU &nbsp;·&nbsp; SWIPE PIN →</span>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div onClick={()=>setError(null)} style={{position:"absolute",top:70,left:"50%",transform:"translateX(-50%)",zIndex:600,background:"rgba(255,77,77,0.15)",border:"1px solid rgba(255,77,77,0.4)",borderRadius:8,padding:"8px 16px",fontSize:12,color:"#FF6B6B",cursor:"pointer",maxWidth:"85%",textAlign:"center"}}>
          {error} ×
        </div>
      )}

      {/* Messages */}
      <div
        ref={msgAreaRef}
        style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:10,scrollbarWidth:"none",overscrollBehavior:"contain"}}
      >
        {messages.length===0 && (
          <div style={{textAlign:"center",color:"var(--text-muted)",fontSize:12,marginTop:40}}>
            <div style={{fontSize:32,marginBottom:10}}>📡</div>No messages yet.
          </div>
        )}
        {messages.map(msg=>(
          <MsgBubble
            key={msg.id}
            msg={msg}
            isMine={msg.sender_id===myId}
            isAdmin={isAdmin}
            onMenuRequest={openMenu}
            onViewImage={(id,name)=>setLightbox({id,name})}
          />
        ))}
        <div ref={bottomRef}/>
      </div>

      {/* Warn dialog */}
      {warnInput && (
        <div onClick={()=>setWarnInput(null)} style={{position:"fixed",inset:0,zIndex:2500,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"rgba(4,9,18,0.98)",border:`1px solid ${C}25`,borderRadius:14,padding:20,width:"100%",maxWidth:340,boxShadow:"0 8px 40px rgba(0,0,0,0.6)"}}>
            <div className="font-orbitron" style={{fontSize:12,color:"#FFB830",marginBottom:14}}>⚠️ WARN: {warnInput.name}</div>
            <input autoFocus value={warnText} onChange={e=>setWarnText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitWarn()} placeholder="Reason (optional)..."
              style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${C}25`,borderRadius:8,padding:"10px 12px",color:"var(--text-primary)",fontSize:13,outline:"none",fontFamily:"Inter,sans-serif",boxSizing:"border-box",marginBottom:12}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setWarnInput(null)} style={{flex:1,padding:"9px",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"var(--text-muted)",cursor:"pointer",fontSize:12}}>Cancel</button>
              <button onClick={submitWarn} style={{flex:1,padding:"9px",borderRadius:8,border:"1px solid rgba(255,148,0,0.4)",background:"rgba(255,148,0,0.1)",color:"#FFB830",cursor:"pointer",fontSize:12,fontFamily:"Inter"}}>SEND WARNING</button>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div style={{background:"rgba(3,8,15,0.97)",borderTop:`1px solid ${C}15`,flexShrink:0,paddingBottom:inputBarBottom?`${inputBarBottom}px`:"env(safe-area-inset-bottom,0px)",position:"relative",zIndex:10}}>
        {uploadProgress && <div style={{padding:"8px 12px 0"}}><UploadProgress percent={uploadProgress.percent} fileName={uploadProgress.fileName} onCancel={()=>{uploadXhrRef.current?.abort();setUploadProgress(null);}}/></div>}
        {!canSend && !isAdmin && (
          <div style={{padding:"10px 14px",background:accountStatus==="muted"?"rgba(201,166,107,0.1)":"rgba(255,77,77,0.08)",borderTop:`1px solid ${accountStatus==="muted"?"rgba(201,166,107,0.3)":"rgba(255,77,77,0.25)"}`,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:16}}>{accountStatus==="muted"?"🔇":accountStatus==="suspended"?"⏸️":"🚫"}</span>
            <span style={{fontSize:12,fontFamily:"Inter,sans-serif",color:accountStatus==="muted"?"#C9A66B":"#FF4D4D"}}>
              {accountStatus==="muted"?"You have been muted.":accountStatus==="suspended"?"Your participation is suspended.":"Your account is blocked."}
            </span>
          </div>
        )}
        {canSend && (
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px"}}>
            <button onClick={()=>fileInputRef.current?.click()} disabled={!!uploadProgress} style={{width:40,height:40,borderRadius:10,flexShrink:0,background:`${C}0a`,border:`1px solid ${C}25`,display:"flex",alignItems:"center",justifyContent:"center",cursor:uploadProgress?"not-allowed":"pointer",opacity:uploadProgress?0.5:1,transition:"all 0.15s"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C} strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.mp3,.wav,.m4a,.ogg" onChange={handleFileChange} style={{display:"none"}}/>
            <div style={{flex:1,display:"flex",alignItems:"center",background:"rgba(8,15,28,0.95)",border:`1px solid ${C}28`,borderRadius:12,padding:"0 12px"}}>
              <input
                ref={inputRef}
                value={input}
                dir="auto"
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }}
                placeholder="Message group channel..."
                style={{flex:1,background:"none",border:"none",outline:"none",color:"var(--text-primary)",fontSize:14,fontFamily:"Inter,sans-serif",padding:"11px 0"}}
              />
            </div>
            <button onClick={()=>sendMessage()} disabled={(!input.trim()&&!uploadProgress)||sending} style={{width:42,height:42,borderRadius:11,flexShrink:0,background:input.trim()&&!sending?`linear-gradient(135deg,${C},#35D4FF)`:`${C}0d`,border:`1px solid ${input.trim()&&!sending?C:`${C}20`}`,cursor:input.trim()&&!sending?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s",boxShadow:input.trim()&&!sending?`0 0 14px ${C}40`:"none"}}>
              {sending
                ? <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${C}40`,borderTopColor:C,animation:"spin 0.7s linear infinite"}}/>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim()?"#020810":C} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              }
            </button>
          </div>
        )}
      </div>

      {/* Admin menu */}
      {menu && isAdmin && (
        <AdminMenu
          menu={menu}
          onClose={()=>setMenu(null)}
          onDelete={menuDelete}
          onPin={menuPin}
          onUnpin={menuUnpin}
          onMarkImportant={menuImportant}
          onWarn={menuWarn}
          onMute={menuMute}
          onBlock={menuBlock}
        />
      )}

      {/* Lightbox */}
      {lightbox && <Lightbox id={lightbox.id} name={lightbox.name} onClose={()=>setLightbox(null)}/>}
    </div>
  );
}
