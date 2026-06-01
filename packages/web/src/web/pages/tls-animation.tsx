import BackButton from "../components/BackButton";

export default function TLSAnimation() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0d1117" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: "rgba(10,14,26,0.95)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}>
        <BackButton />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e0e0e0", fontFamily: "Courier New, monospace", letterSpacing: 1 }}>
            TLS OPERATION
          </div>
          <div style={{ fontSize: 11, color: "#888", fontFamily: "Courier New, monospace" }}>
            ANIMATED TRAINING VISUALIZATION
          </div>
        </div>
      </div>

      <iframe
        src="/tls-animation.html"
        style={{
          flex: 1,
          border: "none",
          width: "100%",
          display: "block",
          background: "#0d1117",
        }}
        title="TLS Operation Animation"
        allow="autoplay"
      />
    </div>
  );
}
