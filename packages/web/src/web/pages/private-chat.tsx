import { useState, useRef, useEffect, useCallback } from "react";
import BackButton from "../components/BackButton";
import { getSession } from "../hooks/useTelegramTrack";

const C = {
  cyan:  "#00AEEF",
  blue:  "#35D4FF",
  green: "#00D26A",
  gold:  "#FFD166",
};

type Msg = {
  id: number;
  sender_role: "admin" | "trainee";
  text: string;
  read: number;
  ts: number;
};

function getTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function StatusTick({ read }: { read: number }) {
  const color = read ? C.blue : "rgba(255,255,255,0.45)";
  return <span style={{ marginLeft: 4, fontSize: 10, color }}>{read ? "✓✓" : "✓"}</span>;
}

function MsgBubble({ msg, onDelete }: { msg: Msg; onDelete?: () => void }) {
  const isMe = msg.sender_role === "trainee";
  const [showMenu, setShowMenu] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPress = () => {
    if (!isMe || !onDelete) return;
    timerRef.current = setTimeout(() => setShowMenu(true), 480);
  };
  const cancelPress = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  return (
    <div
      style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 10 }}
      onClick={() => { if (showMenu) setShowMenu(false); }}
    >
      {!isMe && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
          background: `linear-gradient(135deg, ${C.cyan}40, #071426)`,
          border: `1.5px solid ${C.cyan}50`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "Inter", fontSize: 11, fontWeight: 700, color: C.cyan,
          marginRight: 8, marginTop: 2,
        }}>A</div>
      )}
      <div style={{ maxWidth: "74%", position: "relative" }}>
        {/* Context menu on long-press */}
        {showMenu && isMe && onDelete && (
          <div style={{
            position: "absolute", right: 0, bottom: "calc(100% + 4px)",
            background: "#0d1117", border: "1px solid rgba(255,68,68,0.35)",
            borderRadius: 10, zIndex: 200, boxShadow: "0 6px 24px rgba(0,0,0,0.6)",
            overflow: "hidden", minWidth: 140,
          }}>
            <button
              onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setShowMenu(false); onDelete(); }}
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDelete(); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 16px", background: "none", border: "none",
                color: "#FF4D4D", cursor: "pointer", fontSize: 13,
                fontFamily: "Inter", width: "100%", whiteSpace: "nowrap",
              }}
            >
              <span>🗑</span> Delete
            </button>
          </div>
        )}
        {/* Message bubble */}
        <div
          onTouchStart={startPress}
          onTouchEnd={cancelPress}
          onTouchMove={cancelPress}
          onMouseDown={startPress}
          onMouseUp={cancelPress}
          onMouseLeave={cancelPress}
          style={{
            padding: "10px 13px",
            borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            background: isMe
              ? `linear-gradient(135deg, ${C.cyan}, #0057b8)`
              : "rgba(255,255,255,0.06)",
            border: isMe ? "none" : `1px solid ${C.cyan}20`,
            fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6,
            direction: "auto" as any,
            boxShadow: isMe ? `0 4px 16px ${C.cyan}30` : "none",
            userSelect: "none",
            WebkitUserSelect: "none",
            cursor: isMe && onDelete ? "pointer" : "default",
            outline: showMenu ? `2px solid rgba(255,68,68,0.4)` : "none",
            transition: "outline 0.15s",
          }}
        >
          {msg.text}
        </div>
        <div style={{
          fontSize: 9, color: "var(--text-muted)", marginTop: 3,
          textAlign: isMe ? "right" : "left",
          display: "flex", justifyContent: isMe ? "flex-end" : "flex-start",
          alignItems: "center", gap: 2,
        }}>
          {getTime(msg.ts)}
          {isMe && <StatusTick read={msg.read} />}
        </div>
      </div>
    </div>
  );
}

export default function PrivateChat() {
  const session = getSession();
  const traineeId = session?.id ?? "";
  const traineeName = session?.name ?? "Trainee";

  const [msgs, setMsgs]       = useState<Msg[]>([]);
  const [input, setInput]     = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState("");
  const bottomRef             = useRef<HTMLDivElement>(null);
  const [inputBarBottom, setInputBarBottom] = useState(0);

  // iPhone keyboard fix
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setInputBarBottom(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => { vv.removeEventListener("resize", onResize); vv.removeEventListener("scroll", onResize); };
  }, []);

  const load = useCallback(async () => {
    if (!traineeId) return;
    try {
      const res = await fetch(`/api/trainee/messages/${traineeId}`);
      if (!res.ok) return;
      const data = await res.json() as Msg[];
      setMsgs(data);
    } catch { /* non-fatal */ }
  }, [traineeId]);

  // Initial load + mark read
  useEffect(() => {
    load();
    if (traineeId) {
      fetch("/api/trainee/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traineeId }),
      }).catch(() => {});
    }
  }, [load, traineeId]);

  // Poll every 5s
  useEffect(() => {
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !traineeId) return;
    setSending(true);
    setError("");
    const optimistic: Msg = { id: Date.now(), sender_role: "trainee", text, read: 0, ts: Date.now() };
    setMsgs(prev => [...prev, optimistic]);
    setInput("");
    try {
      const res = await fetch("/api/trainee/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traineeId, text }),
      });
      if (!res.ok) {
        setError("Failed to send. Try again.");
        setMsgs(prev => prev.filter(m => m.id !== optimistic.id));
        setInput(text);
      } else {
        setTimeout(load, 600);
      }
    } catch {
      setError("Network error.");
      setMsgs(prev => prev.filter(m => m.id !== optimistic.id));
      setInput(text);
    }
    setSending(false);
  };

  // Delete trainee's own message
  const deleteMsg = useCallback(async (msgId: number) => {
    if (!traineeId) return;
    setMsgs(prev => prev.filter(m => m.id !== msgId));
    await fetch("/api/trainee/notifications/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traineeId, id: msgId, kind: "message" }),
    }).catch(() => {});
  }, [traineeId]);

  if (!traineeId) {
    return (
      <div className="page" style={{ background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh" }}>
        <div style={{ textAlign: "center", color: "var(--text-muted)", fontFamily: "Inter", fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
          Please log in to access private chat.
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{
      background: "var(--bg-primary)",
      display: "flex", flexDirection: "column",
      height: "100dvh", paddingBottom: 0,
    }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:0.2} 50%{opacity:1} }
        @keyframes slideUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "10px 14px",
        background: "rgba(5,10,18,0.98)",
        borderBottom: `1px solid ${C.cyan}18`,
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <BackButton to="/" style={{ flexShrink: 0 }} />
        <div style={{
          width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
          background: `linear-gradient(135deg, ${C.cyan}40, #071426)`,
          border: `2px solid ${C.green}`,
          boxShadow: `0 0 10px ${C.green}50`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "Inter", fontSize: 14, fontWeight: 700, color: C.cyan,
        }}>A</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-orbitron" style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
            INSTRUCTOR
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 5px ${C.green}`, display: "inline-block" }} />
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Secure Channel</span>
          </div>
        </div>

        <div style={{ padding: "4px 8px", border: `1px solid ${C.cyan}30`, borderRadius: 5, fontSize: 8, color: C.cyan, fontFamily: "Inter", letterSpacing: "0.1em" }}>
          🔒 PRIVATE
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {msgs.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)", fontFamily: "Inter", fontSize: 12, lineHeight: 1.8 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
            <div style={{ color: C.cyan, fontFamily: "Inter", fontSize: 11, letterSpacing: "0.08em", marginBottom: 6 }}>PRIVATE CHANNEL</div>
            No messages yet. Send a message to your instructor.
          </div>
        )}
        {msgs.map(msg => (
          <MsgBubble
            key={msg.id}
            msg={msg}
            onDelete={msg.sender_role === "trainee" ? () => deleteMsg(msg.id) : undefined}
          />
        ))}
        {error && (
          <div style={{ textAlign: "center", fontSize: 11, color: "#FF4D4D", fontFamily: "Inter", padding: "4px 0" }}>{error}</div>
        )}
        <div ref={bottomRef} />
      </div>

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
          dir="auto"
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Message your instructor..."
          disabled={sending}
          style={{
            flex: 1, background: "rgba(255,255,255,0.04)",
            border: `1px solid ${C.cyan}25`, borderRadius: 24,
            padding: "10px 16px", color: "var(--text-primary)",
            fontSize: 13, outline: "none", fontFamily: "Inter, sans-serif",
            opacity: sending ? 0.7 : 1,
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          style={{
            width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
            background: input.trim() && !sending ? `linear-gradient(135deg, ${C.cyan}, #0057b8)` : `${C.cyan}15`,
            border: "none", cursor: input.trim() && !sending ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
            boxShadow: input.trim() && !sending ? `0 0 14px ${C.cyan}50` : "none",
          }}
        >
          {sending
            ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${C.cyan}40`, borderTopColor: C.cyan, animation: "spin 0.7s linear infinite" }} />
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
          }
        </button>
      </div>
    </div>
  );
}
