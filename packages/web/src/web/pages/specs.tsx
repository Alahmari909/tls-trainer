import { useLocation } from "wouter";

const C  = "#00AEEF";
const C2 = "#35D4FF";
const GOLD = "#C9A66B";
const GRN  = "#00D26A";

/* ─── tiny helpers ─── */
function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{
      fontFamily: "'Rajdhani', sans-serif", fontSize: 17,
      fontWeight: 700, letterSpacing: "0.16em", color: GOLD,
      textTransform: "uppercase", marginBottom: 12, marginTop: 28,
      paddingBottom: 8, borderBottom: `2px solid ${GOLD}40`,
      textShadow: `0 0 14px ${GOLD}55`,
    }}>{children}</div>
  );
}

function SubHeader({ children }: { children: string }) {
  return (
    <div style={{
      background: `linear-gradient(90deg, ${C}28 0%, transparent 100%)`,
      borderLeft: `4px solid ${C}`,
      padding: "10px 14px", marginBottom: 2,
      fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: 15,
      color: C2, letterSpacing: "0.06em", textTransform: "uppercase",
    }}>{children}</div>
  );
}

function Row({ label, sub, value }: { label: string; sub?: string; value: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      padding: "9px 12px",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      <div>
        <div style={{ fontFamily: "Inter", fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{label}</div>
        {sub && <div style={{ fontFamily: "Inter", fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{
        fontFamily: "Inter, monospace", fontSize: 13, fontWeight: 600,
        color: "rgba(255,255,255,0.92)", textAlign: "right", maxWidth: "52%",
      }}>{value}</div>
    </div>
  );
}

function DualRow({ label, sub, loc, gs }: { label: string; sub?: string; loc: string; gs?: string }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      padding: "9px 12px",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      gap: 4, alignItems: "start",
    }}>
      <div>
        <div style={{ fontFamily: "Inter", fontSize: 12, color: "rgba(255,255,255,0.70)" }}>{label}</div>
        {sub && <div style={{ fontFamily: "Inter", fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontFamily: "Inter, monospace", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.90)", textAlign: "center" }}>{loc}</div>
      <div style={{ fontFamily: "Inter, monospace", fontSize: 12, fontWeight: 600, color: gs ? GRN : "transparent", textAlign: "right" }}>{gs ?? "—"}</div>
    </div>
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      padding: "7px 12px 5px", gap: 4,
      background: "rgba(0,174,239,0.06)",
      borderBottom: "1px solid rgba(0,174,239,0.15)",
    }}>
      <div />
      <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 700, color: C, textAlign: "center", letterSpacing: "0.04em" }}>{label.split("/")[0]}</div>
      <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 700, color: GRN, textAlign: "right", letterSpacing: "0.04em" }}>{label.split("/")[1]}</div>
    </div>
  );
}

function SectionBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      border: "1px solid rgba(0,174,239,0.14)",
      background: "rgba(0,10,25,0.55)",
      marginBottom: 4,
    }}>{children}</div>
  );
}

export default function TLSSpecs() {
  const [, navigate] = useLocation();

  return (
    <div style={{ background: "#03080f", minHeight: "100vh", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{
        padding: "20px 16px 16px",
        background: "linear-gradient(180deg, rgba(0,174,239,0.08) 0%, transparent 100%)",
        borderBottom: "1px solid rgba(0,174,239,0.12)",
        position: "sticky", top: 0, zIndex: 10,
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "rgba(0,174,239,0.08)", border: "1px solid rgba(0,174,239,0.2)",
              borderRadius: 8, width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: C, fontSize: 16, cursor: "pointer",
            }}>‹</button>
          <div>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: 14, fontWeight: 700, color: C, letterSpacing: "0.12em" }}>
              TLS SPECIFICATIONS
            </div>
            <div style={{ fontFamily: "Inter", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em", marginTop: 2 }}>
              TECHNICAL CHARACTERISTICS
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>

        {/* ── 1. SURVEILLANCE ── */}
        <SectionTitle>📡 Surveillance Technical Characteristics</SectionTitle>
        <SubHeader>TLS provides multilateration surveillance</SubHeader>
        <SectionBox>
          <Row label="Aircraft capacity" value="Max 100" />
          <Row label="Probability of detection" value=">99%" />
          <Row label="False targets" value="<0.1%" />
          <Row label="Service volume" sub="Range" value="60 NM" />
          <Row label="Accuracy" sub="100 meter footprint" value="2 deg azimuth" />
          <Row label="Altitude" value="Mode C" />
        </SectionBox>

        {/* ── 2. PAR ── */}
        <SectionTitle>🎯 Precision Approach Radar Technical Characteristics</SectionTitle>
        <SubHeader>TLS provides a PAR display</SubHeader>
        <SectionBox>
          <Row label="Aircraft capacity" value="Max 4 — independent consoles" />
          <Row label="Probability of detection" value=">99.99%" />
          <Row label="False targets" value="<1×10⁻⁷" />
          <Row label="Service volume" sub="Range" value="60 NM" />
          <Row label="" sub="Azimuth" value="70° — runway centerline" />
          <Row label="Accuracy" sub="Elevation" value="0.02 deg" />
          <Row label="" sub="Azimuth" value="0.02 deg" />
          <Row label="Frequency" value="1030 MHz Interrog. / 1090 MHz Reply" />
        </SectionBox>

        {/* ── 3. ILS ── */}
        <SectionTitle>✈️ ILS Technical Characteristics</SectionTitle>
        <SubHeader>TLS provides ILS localizer and glide slope</SubHeader>

        {/* Coverage */}
        <SectionBox>
          <GroupHeader label="Localizer/Glide Slope" />
          <DualRow label="Coverage" sub="Course"     loc="25 NM / ±10°"    gs="12 NM / ±8° az" />
          <DualRow label=""         sub="Clearance"  loc="17 NM / ±35°"    gs="" />
          <DualRow label="Course width"              loc="2° to 6° adjustable" />
          <DualRow label="Glide angle"               loc="2° to 4° adjustable" />
          <DualRow label="Tx frequency" sub="Range"  loc="108 – 112 MHz"   gs="328 – 336 MHz" />
          <DualRow label="Nom. CSB output" sub="Course"    loc="15 W ±4%"  gs="3 W ±4%" />
          <DualRow label=""                sub="Clearance" loc="7.5 W ±4%" gs="0.3 W ±4%" />
        </SectionBox>

        {/* Monitoring */}
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: "0.04em", textTransform: "uppercase", margin: "18px 0 8px 2px", borderLeft: "3px solid rgba(0,174,239,0.45)", paddingLeft: 8 }}>Monitoring</div>
        <SectionBox>
          <GroupHeader label="Localizer/Glide Slope" />
          <DualRow label="RF-level stability"      loc="±2.0%"       gs="±2.00%" />
          <DualRow label="DDM accuracy"             loc="±0.002 DDM"  gs="±0.003 DDM" />
          <DualRow label="SDM accuracy"             loc="±1.0%"       gs="±2.0%" />
        </SectionBox>

        {/* Environmental */}
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: "0.04em", textTransform: "uppercase", margin: "18px 0 8px 2px", borderLeft: "3px solid rgba(0,174,239,0.45)", paddingLeft: 8 }}>Environmental Conditions</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 4 }}>
          {/* Indoor */}
          <div style={{ borderRadius: 12, border: "1px solid rgba(0,174,239,0.14)", background: "rgba(0,10,25,0.55)", overflow: "hidden" }}>
            <div style={{ background: "rgba(0,174,239,0.08)", padding: "7px 12px", fontFamily: "Inter", fontSize: 10, fontWeight: 700, color: C, letterSpacing: "0.06em" }}>INDOOR</div>
            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <div style={{ fontFamily: "Inter", fontSize: 10, color: "var(--text-muted)" }}>Ambient temp.</div>
                <div style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>-10°C to 55°C</div>
              </div>
              <div>
                <div style={{ fontFamily: "Inter", fontSize: 10, color: "var(--text-muted)" }}>Rel. humidity</div>
                <div style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>Max 90%</div>
              </div>
            </div>
          </div>
          {/* Outdoor */}
          <div style={{ borderRadius: 12, border: "1px solid rgba(0,210,106,0.14)", background: "rgba(0,10,25,0.55)", overflow: "hidden" }}>
            <div style={{ background: "rgba(0,210,106,0.08)", padding: "7px 12px", fontFamily: "Inter", fontSize: 10, fontWeight: 700, color: GRN, letterSpacing: "0.06em" }}>OUTDOOR</div>
            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <div style={{ fontFamily: "Inter", fontSize: 10, color: "var(--text-muted)" }}>Ambient temp.</div>
                <div style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>-50°C to +70°C</div>
              </div>
              <div>
                <div style={{ fontFamily: "Inter", fontSize: 10, color: "var(--text-muted)" }}>Rel. humidity</div>
                <div style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>Max 100%</div>
              </div>
              <div>
                <div style={{ fontFamily: "Inter", fontSize: 10, color: "var(--text-muted)" }}>Wind — Operational</div>
                <div style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>160 km/h</div>
              </div>
              <div>
                <div style={{ fontFamily: "Inter", fontSize: 10, color: "var(--text-muted)" }}>Wind — Survivability</div>
                <div style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>200 km/h</div>
              </div>
              <div>
                <div style={{ fontFamily: "Inter", fontSize: 10, color: "var(--text-muted)" }}>Ice</div>
                <div style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>Up to 1.25 cm</div>
              </div>
            </div>
          </div>
        </div>

        {/* Power supply */}
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: "0.04em", textTransform: "uppercase", margin: "18px 0 8px 2px", borderLeft: "3px solid rgba(0,174,239,0.45)", paddingLeft: 8 }}>Power Supply</div>
        <SectionBox>
          <Row label="Input voltage"       value="85–265 VAC, 47–63 Hz" />
          <Row label="Power consumption"   value="3 kW" />
          <Row label="Battery voltage"     value="24 V" />
        </SectionBox>

        {/* Safety */}
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: "0.04em", textTransform: "uppercase", margin: "18px 0 8px 2px", borderLeft: "3px solid rgba(0,174,239,0.45)", paddingLeft: 8 }}>Safety</div>
        <SectionBox>
          <GroupHeader label="Localizer/Glide Slope" />
          <DualRow label="Mean time between outage" loc="9,000 hrs"  gs="9,000 hrs" />
          <DualRow label="Integrity"                loc="1×10⁻⁸"    gs="1×10⁻⁸" />
          <DualRow label="Continuity of service"    loc="2.5×10⁻⁷"  gs="2.5×10⁻⁷" />
          <DualRow label="Availability"             loc="99.999%"   gs="99.999%" />
        </SectionBox>

      </div>
    </div>
  );
}
