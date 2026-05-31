export default function SimulatorPage() {
  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: "#0a1628" }}>
      <iframe
        src="/simulator.html"
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          display: "block",
        }}
        title="TLS RCU Simulator"
        allowFullScreen
      />
    </div>
  );
}
