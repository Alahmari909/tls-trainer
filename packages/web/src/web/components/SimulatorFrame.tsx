interface SimulatorFrameProps {
  scenario?: string;
  difficulty?: string;
}

export function SimulatorFrame({ scenario = 'free', difficulty = 'easy' }: SimulatorFrameProps) {
  const params = new URLSearchParams();
  params.set('scenario', scenario);
  params.set('difficulty', difficulty);
  const src = `/simulator.html?${params.toString()}`;

  return (
    <div style={{ width: '100%', height: '100%', background: '#050505', overflow: 'hidden' }}>
      <iframe
        src={src}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="TLS PAR Simulator"
        allow="autoplay; microphone"
      />
    </div>
  );
}
