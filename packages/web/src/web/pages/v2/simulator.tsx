import V2Layout from "./layout";

export default function V2Simulator() {
  return (
    <V2Layout role="trainee">
      <div style={{ margin: "-1.5rem", borderRadius: 12, overflow: "hidden", height: "calc(100vh - 80px)" }}>
        <iframe
          src="/simulator.html"
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          title="TLS PAR Simulator"
          allow="autoplay"
        />
      </div>
    </V2Layout>
  );
}
