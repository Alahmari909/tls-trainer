export default function Simulator() {
  return (
    <iframe
      src="/simulator_tls.html"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        border: "none",
        zIndex: 9999,
      }}
      allow="fullscreen"
    />
  );
}
