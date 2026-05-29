import { useState, useRef, useEffect } from "react";
import BackButton from "../components/BackButton";

const C = {
  cyan: "#00AEEF",
  blue: "#35D4FF",
  green: "#00D26A",
  yellow: "#FFD166",
};

type Msg = {
  id: number;
  text: string;
  sender: "user" | "instructor";
  time: string;
  arabic?: boolean;
  status?: "sent" | "delivered" | "read";
  deleted?: boolean;
  pinned?: boolean;
};

type Contact = {
  id: string;
  name: string;
  nameAr: string;
  rank: string;
  online: boolean;
  lastSeen?: string;
  avatar: string;
};

const CONTACTS: Contact[] = [
  { id: "instructor", name: "Instructor",       nameAr: "المدرب",       rank: "MAJ",  online: true,  avatar: "M" },
  { id: "c2",         name: "Ahmad Al-Rashidi", nameAr: "أحمد الرشيدي", rank: "CPT",  online: true,  avatar: "A" },
  { id: "c3",         name: "Sultan Al-Ghamdi", nameAr: "سلطان الغامدي", rank: "MAJ", online: false, lastSeen: "2h ago", avatar: "S" },
  { id: "c4",         name: "Khalid Al-Hamdan", nameAr: "خالد الحمدان", rank: "1LT", online: false, lastSeen: "1d ago", avatar: "K" },
];

const initialMessages: Msg[] = [
  { id: 1, sender: "instructor", text: "مرحباً — هذه قناتك الخاصة الآمنة. أي سؤال أو ملاحظة حول وحدات التدريب، أنا هنا.", time: "09:15", arabic: true },
  { id: 2, sender: "instructor", text: "Welcome — this is your private secure channel. Any questions about the TLS training modules, I'm here.", time: "09:15", status: "read" },
];

const quickReplies = [
  "What's covered in Module 4?",
  "Quiz me on calibration",
  "Explain glide path alignment",
  "How do I reset the LGS?",
];

function isAdminSession(): boolean {
  return sessionStorage.getItem("tls_admin_verified") !== null;
}

function StatusTick({ status }: { status?: "sent" | "delivered" | "read" }) {
  if (!status) return null;
  const color = status === "read" ? C.blue : "rgba(255,255,255,0.5)";
  return (
    <span style={{ marginLeft: 4, fontSize: 10, color }}>
      {status === "sent" && "✓"}
      {status === "delivered" && "✓✓"}
      {status === "read" && "✓✓"}
    </span>
  );
}

// ─── Admin bottom-sheet menu ──────────────────────────────────────────────────
function AdminSheet({
  msg,
  contactName,
  onClose,
  onDelete,
  onPin,
}: {
  msg: Msg;
  contactName: string;
  onClose: () => void;
  onDelete: (id: number) => void;
  onPin: (id: number) => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const handler = (e: MouseEvent | TouchEvent) => {
        if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) onClose();
      };
      document.addEventListener("mousedown", handler);
      document.addEventListener("touchstart", handler, { passive: true });
      return () => {
        document.removeEventListener("mousedown", handler);
        document.removeEventListener("touchstart", handler);
      };
    }, 50);
    return () => clearTimeout(t);
  }, [onClose]);

  const isMobile = window.innerWidth <= 640;

  const items = [
    !msg.deleted && { label: "🗑  Delete Message", danger: true, action: () => { onDelete(msg.id); onClose(); } },
    !msg.pinned  && { label: "📌  Pin Message", action: () => { onPin(msg.id); onClose(); } },
    msg.pinned   && { label: "📌  Unpin Message", action: () => { onPin(msg.id); onClose(); } },
  ].filter(Boolean) as { label: string; danger?: boolean; action: () => void }[];

  if (isMobile) {
    return (
      <>
        <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1999, background: "rgba(0,0,0,0.5)" }} />
        <div ref={sheetRef} style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 2000,
          background: "rgba(4,9,18,0.99)",
          borderTop: "1px solid rgba(0,174,239,0.2)",
          borderRadius: "18px 18px 0 0",
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.7)",
          animation: "slideUp 0.22s cubic-bezier(0.25,0.46,0.45,0.94)",
        }}>
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 4 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
          </div>
          <div style={{ padding: "6px 20px 12px", fontSize: 10, color: "rgba(0,174,239,0.7)", fontFamily: "Inter", letterSpacing: "0.1em", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            MESSAGE — {contactName.toUpperCase()}
          </div>
          {items.map(item => (
            <button key={item.label}
              onTouchEnd={e => { e.preventDefault(); item.action(); }}
              onClick={item.action}
              style={{
                display: "flex", alignItems: "center", width: "100%", textAlign: "left",
                background: "none", border: "none", cursor: "pointer",
                padding: "15px 22px", fontSize: 15,
                fontFamily: "Inter, sans-serif", fontWeight: 600,
                color: item.danger ? "#FF4D4D" : "var(--text-primary)",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                WebkitTapHighlightColor: "transparent",
              }}
            >{item.label}</button>
          ))}
          <button
            onTouchEnd={e => { e.preventDefault(); onClose(); }}
            onClick={onClose}
            style={{
              display: "block", width: "calc(100% - 32px)", margin: "10px 16px 8px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, padding: "13px", color: "var(--text-secondary)",
              fontSize: 14, fontFamily: "Inter, sans-serif", fontWeight: 600,
              cursor: "pointer", WebkitTapHighlightColor: "transparent",
            }}
          >Cancel</button>
        </div>
      </>
    );
  }

  // Desktop popover (centred near click)
  return (
    <div ref={sheetRef} style={{
      position: "fixed", top: "40%", left: "50%", transform: "translate(-50%,-50%)",
      zIndex: 2000, background: "rgba(4,9,18,0.98)",
      border: "1px solid rgba(0,174,239,0.2)", borderRadius: 10,
      padding: "4px 0", minWidth: 190,
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    }}>
      {items.map(item => (
        <button key={item.label} onClick={item.action} style={{
          display: "block", width: "100%", textAlign: "left",
          background: "none", border: "none", cursor: "pointer",
          padding: "9px 14px", fontSize: 12, fontFamily: "Inter, sans-serif",
          color: item.danger ? "#FF4D4D" : "var(--text-secondary)",
        }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,174,239,0.08)")}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}
        >{item.label}</button>
      ))}
    </div>
  );
}

// ─── Private message bubble ───────────────────────────────────────────────────
const LONG_PRESS_MS = 500;
const SWIPE_THRESHOLD = 72;
const SWIPE_MAX_VERTICAL = 30;

function PrivMsgBubble({
  msg,
  contactAvatar,
  isAdmin,
  onLongPress,
  onSwipeDelete,
  onSwipePin,
}: {
  msg: Msg;
  contactAvatar: string;
  isAdmin: boolean;
  onLongPress: (msg: Msg) => void;
  onSwipeDelete: (id: number) => void;
  onSwipePin: (id: number) => void;
}) {
  const isUser = msg.sender === "user";
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [swipeAction, setSwipeAction] = useState<"delete" | "pin" | null>(null);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);
  const gestureRef = useRef<"none" | "longpress" | "swipe">("none");

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isAdmin || msg.deleted) return;
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    touchMoved.current = false;
    gestureRef.current = "none";

    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) {
        gestureRef.current = "longpress";
        if (navigator.vibrate) navigator.vibrate(40);
        onLongPress(msg);
      }
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isAdmin) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = Math.abs(t.clientY - touchStartY.current);

    if (dy > SWIPE_MAX_VERTICAL) {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      touchMoved.current = true;
      return;
    }
    if (Math.abs(dx) > 8) {
      touchMoved.current = true;
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      if (gestureRef.current === "none") gestureRef.current = "swipe";
    }
    if (gestureRef.current === "swipe" && !msg.deleted) {
      const clamped = Math.max(-SWIPE_THRESHOLD * 1.2, Math.min(SWIPE_THRESHOLD * 1.2, dx));
      setSwipeX(clamped);
      setSwiping(true);
      if (dx < -SWIPE_THRESHOLD / 2) setSwipeAction("delete");
      else if (dx > SWIPE_THRESHOLD / 2) setSwipeAction("pin");
      else setSwipeAction(null);
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (gestureRef.current === "swipe" && isAdmin && !msg.deleted) {
      if (swipeX < -SWIPE_THRESHOLD) onSwipeDelete(msg.id);
      else if (swipeX > SWIPE_THRESHOLD) onSwipePin(msg.id);
    }
    setSwipeX(0); setSwiping(false); setSwipeAction(null);
    gestureRef.current = "none";
  };

  if (msg.deleted) {
    return (
      <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
        <div style={{
          fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic",
          padding: "7px 12px", background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10,
        }}>
          🚫 Message removed by administrator
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      {/* Swipe hint icons */}
      {swiping && (
        <>
          <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 4, opacity: swipeAction === "delete" ? 1 : 0.3, pointerEvents: "none" }}>
            <span style={{ fontSize: 16 }}>🗑</span>
            <span style={{ fontSize: 9, color: "#FF4D4D", fontFamily: "Inter" }}>DELETE</span>
          </div>
          <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 4, opacity: swipeAction === "pin" ? 1 : 0.3, pointerEvents: "none" }}>
            <span style={{ fontSize: 16 }}>📌</span>
            <span style={{ fontSize: 9, color: C.cyan, fontFamily: "Inter" }}>PIN</span>
          </div>
        </>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: isUser ? "flex-end" : "flex-start",
          transform: swiping ? `translateX(${swipeX}px)` : "translateX(0)",
          transition: swiping ? "none" : "transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)",
          willChange: "transform",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onContextMenu={isAdmin ? (e) => { e.preventDefault(); onLongPress(msg); } : undefined}
      >
        {!isUser && (
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: `linear-gradient(135deg, ${C.cyan}40, #071426)`,
            border: `1.5px solid ${C.cyan}50`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Inter", fontSize: 10, color: C.cyan,
            marginRight: 8, marginTop: 2,
          }}>{contactAvatar}</div>
        )}
        <div style={{ maxWidth: "74%" }}>
          {/* Pin indicator */}
          {msg.pinned && (
            <div style={{ fontSize: 9, color: C.cyan, fontFamily: "Inter", marginBottom: 3, paddingLeft: 4 }}>
              📌 PINNED
            </div>
          )}
          <div style={{
            padding: "10px 13px",
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            background: isUser
              ? `linear-gradient(135deg, ${C.cyan}, #0057b8)`
              : "rgba(255,255,255,0.05)",
            border: isUser ? "none" : `1px solid ${C.cyan}20`,
            fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6,
            direction: msg.arabic ? "rtl" : "ltr",
            textAlign: msg.arabic ? "right" : "left",
            boxShadow: isUser ? `0 4px 16px ${C.cyan}30` : "none",
            outline: swiping && swipeAction === "delete" ? "1.5px solid rgba(255,77,77,0.5)" : swiping && swipeAction === "pin" ? `1.5px solid ${C.cyan}60` : "none",
          }}>
            {msg.text}
          </div>
          <div style={{
            fontSize: 9, color: "var(--text-muted)", marginTop: 3,
            textAlign: isUser ? "right" : "left",
            paddingLeft: isUser ? 0 : 4, paddingRight: isUser ? 4 : 0,
            display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
            alignItems: "center", gap: 2,
          }}>
            {msg.time}
            {isUser && <StatusTick status={msg.status} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrivateChat() {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [activeContact, setActiveContact] = useState<Contact>(CONTACTS[0]);
  const [showContacts, setShowContacts] = useState(false);
  const [typing, setTyping] = useState(false);
  const [voiceReady] = useState(true);
  const [inputBarBottom, setInputBarBottom] = useState(0);
  const [modMenu, setModMenu] = useState<Msg | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAdmin = isAdminSession();

  // iPhone keyboard fix
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setInputBarBottom(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => { vv.removeEventListener("resize", onResize); vv.removeEventListener("scroll", onResize); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  const send = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    const time = getTime();
    const id = Date.now();
    setMessages(prev => [...prev, { id, sender: "user", text: msg, time, status: "sent" }]);
    setInput("");

    setTimeout(() => setMessages(prev => prev.map(m => m.id === id ? { ...m, status: "delivered" } : m)), 500);
    setTimeout(() => setTyping(true), 800);
    setTimeout(() => {
      setTyping(false);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: "read" } : m));
      const replies = [
        "Great question. Let me pull up the relevant section from the technical manual.",
        "That's covered in Module 4 — Operation. Check the PDF reference for full details.",
        "The glide path system (GGS) must be aligned to ±0.1° relative to the runway centerline.",
        "For LGS reset: power cycle via the RMS panel, then re-run the built-in self-test sequence.",
        "Noted. I'll add that to your training record.",
      ];
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: "instructor", text: replies[Math.floor(Math.random() * replies.length)], time: getTime(), status: "read" }]);
    }, 1600 + Math.random() * 800);
  };

  // Moderation actions (local — private chat is UI-only demo)
  const handleDelete = (id: number) => setMessages(prev => prev.map(m => m.id === id ? { ...m, deleted: true } : m));
  const handlePin    = (id: number) => setMessages(prev => {
    const isPinned = prev.find(m => m.id === id)?.pinned;
    return prev.map(m => m.id === id ? { ...m, pinned: !isPinned } : { ...m, pinned: false });
  });

  const handleSwipeDelete = (id: number) => {
    if (navigator.vibrate) navigator.vibrate([20, 10, 20]);
    handleDelete(id);
  };
  const handleSwipePin = (id: number) => {
    if (navigator.vibrate) navigator.vibrate(30);
    handlePin(id);
  };

  return (
    <div className="page" style={{
      background: "var(--bg-primary)",
      display: "flex", flexDirection: "column",
      height: "100dvh", paddingBottom: 0,
    }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:0.2} 50%{opacity:1} }
        @keyframes slideUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        .typing-dot { display:inline-block; width:5px; height:5px; border-radius:50%; background:#00AEEF; animation: blink 1.2s ease infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "10px 14px 10px",
        background: "rgba(5,10,18,0.98)",
        borderBottom: `1px solid ${C.cyan}18`,
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <BackButton to="/" style={{ flexShrink: 0 }} />
        <button onClick={() => setShowContacts(v => !v)} style={{
          width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
          background: `linear-gradient(135deg, ${C.cyan}40, #071426)`,
          border: `2px solid ${activeContact.online ? C.green : "rgba(255,255,255,0.15)"}`,
          boxShadow: activeContact.online ? `0 0 10px ${C.green}50` : "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontFamily: "Inter", fontSize: 14, fontWeight: 700, color: C.cyan, position: "relative",
        }}>
          {activeContact.avatar}
          <span style={{
            position: "absolute", bottom: 1, right: 1,
            width: 8, height: 8, borderRadius: "50%",
            background: activeContact.online ? C.green : "rgba(255,255,255,0.3)",
            boxShadow: activeContact.online ? `0 0 6px ${C.green}` : "none",
            border: "1.5px solid #050a12",
          }} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div className="font-orbitron" style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
              {activeContact.name.toUpperCase()}
            </div>
            <span style={{ fontSize: 8, color: C.cyan, fontFamily: "Inter", background: `${C.cyan}15`, padding: "1px 6px", borderRadius: 3 }}>
              {activeContact.rank}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            {typing ? (
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                <span style={{ fontSize: 10, color: C.cyan, marginLeft: 4 }}>typing...</span>
              </div>
            ) : (
              <>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: activeContact.online ? C.green : "rgba(255,255,255,0.25)", boxShadow: activeContact.online ? `0 0 5px ${C.green}` : "none", display: "inline-block" }} />
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {activeContact.online ? "Online · Secure Channel" : `Last seen ${activeContact.lastSeen}`}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Voice ready */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "5px 10px", border: `1px solid ${C.green}30`, borderRadius: 8, background: `${C.green}08` }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2" strokeLinecap="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
          </svg>
          <span style={{ fontSize: 7, color: C.green, fontFamily: "Inter", letterSpacing: "0.05em" }}>VOICE</span>
        </div>

        <div style={{ padding: "4px 8px", border: `1px solid ${C.cyan}30`, borderRadius: 5, fontSize: 8, color: C.cyan, fontFamily: "Inter", letterSpacing: "0.1em" }}>
          🔒 PRIVATE
        </div>
      </div>

      {/* Contacts drawer */}
      {showContacts && (
        <div style={{ background: "rgba(5,12,22,0.97)", borderBottom: `1px solid ${C.cyan}15`, padding: "8px 14px 10px", flexShrink: 0 }}>
          <div className="font-orbitron" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 8, letterSpacing: "0.2em" }}>SELECT CONTACT</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {CONTACTS.map(c => (
              <button key={c.id} onClick={() => { setActiveContact(c); setShowContacts(false); }} style={{
                flexShrink: 0, padding: "8px 12px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                border: activeContact.id === c.id ? `1px solid ${C.cyan}50` : "1px solid rgba(255,255,255,0.08)",
                background: activeContact.id === c.id ? `${C.cyan}10` : "rgba(255,255,255,0.03)",
              }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", margin: "0 auto 4px", background: `linear-gradient(135deg, ${C.cyan}40, #071426)`, border: `1.5px solid ${c.online ? C.green : "rgba(255,255,255,0.1)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter", fontSize: 12, color: C.cyan }}>
                  {c.avatar}
                </div>
                <div style={{ fontSize: 9, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{c.name.split(" ")[0]}</div>
                <div style={{ fontSize: 8, color: c.online ? C.green : "rgba(255,255,255,0.3)" }}>{c.online ? "●" : "○"} {c.rank}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Admin swipe hint */}
      {isAdmin && (
        <div style={{ flexShrink: 0, padding: "4px 14px", background: "rgba(0,174,239,0.04)", borderBottom: `1px solid ${C.cyan}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 9, color: "rgba(0,174,239,0.45)", fontFamily: "Inter", letterSpacing: "0.06em" }}>
            ← SWIPE DELETE &nbsp;·&nbsp; HOLD FOR MENU &nbsp;·&nbsp; SWIPE PIN →
          </span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" } as React.CSSProperties}>
        {messages.map(msg => (
          <PrivMsgBubble
            key={msg.id}
            msg={msg}
            contactAvatar={activeContact.avatar}
            isAdmin={isAdmin}
            onLongPress={(m) => setModMenu(m)}
            onSwipeDelete={handleSwipeDelete}
            onSwipePin={handleSwipePin}
          />
        ))}

        {typing && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${C.cyan}40, #071426)`, border: `1.5px solid ${C.cyan}50`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter", fontSize: 10, color: C.cyan, flexShrink: 0 }}>
              {activeContact.avatar}
            </div>
            <div style={{ padding: "10px 14px", borderRadius: "16px 16px 16px 4px", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.cyan}20`, display: "flex", gap: 4, alignItems: "center" }}>
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      <div style={{ padding: "6px 14px", display: "flex", gap: 7, overflowX: "auto", flexShrink: 0 }}>
        {quickReplies.map(r => (
          <button key={r} onClick={() => send(r)} style={{
            flexShrink: 0, padding: "5px 12px", borderRadius: 20,
            border: `1px solid ${C.cyan}30`, background: `${C.cyan}08`,
            color: C.cyan, fontSize: 10, cursor: "pointer", whiteSpace: "nowrap",
            fontFamily: "Inter, sans-serif",
          }}>{r}</button>
        ))}
      </div>

      {/* Voice banner */}
      {voiceReady && (
        <div style={{ margin: "0 14px 6px", padding: "7px 12px", borderRadius: 10, background: `${C.green}08`, border: `1px solid ${C.green}20`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
            {[3,5,7,5,3].map((h,i) => (
              <div key={i} style={{ width: 3, borderRadius: 2, height: h, background: C.green, animation: `blink ${0.6 + i * 0.1}s ease infinite`, opacity: 0.7 }} />
            ))}
          </div>
          <span style={{ fontSize: 10, color: C.green, fontFamily: "Inter", letterSpacing: "0.08em" }}>VOICE CHANNEL READY</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>End-to-end encrypted</span>
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: "8px 14px",
        paddingBottom: inputBarBottom ? `${inputBarBottom + 8}px` : "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        background: "rgba(5,10,18,0.98)",
        borderTop: `1px solid ${C.cyan}12`,
        display: "flex", gap: 8, alignItems: "center", flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Transmit message..."
          style={{
            flex: 1, background: "rgba(255,255,255,0.04)",
            border: `1px solid ${C.cyan}25`, borderRadius: 24,
            padding: "10px 16px", color: "var(--text-primary)",
            fontSize: 13, outline: "none", fontFamily: "Inter, sans-serif",
          }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim()}
          style={{
            width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
            background: input.trim() ? `linear-gradient(135deg, ${C.cyan}, #0057b8)` : `${C.cyan}15`,
            border: "none", cursor: input.trim() ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
            boxShadow: input.trim() ? `0 0 14px ${C.cyan}50` : "none",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

      {/* Moderation bottom sheet */}
      {modMenu && (
        <AdminSheet
          msg={modMenu}
          contactName={activeContact.name}
          onClose={() => setModMenu(null)}
          onDelete={handleDelete}
          onPin={handlePin}
        />
      )}
    </div>
  );
}
