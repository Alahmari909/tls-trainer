export default function SimulatorPage() {
  return (
    <div style={{ width: '100%', height: '100vh', background: '#050a05', overflow: 'hidden' }}>
      <iframe
        src="/simulator.html"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="TLS PAR Simulator Pro"
        allow="autoplay; microphone"
      />
    </div>
  );
}
