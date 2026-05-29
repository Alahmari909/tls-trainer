import { useState } from "react";

type Section = {
  id: string;
  title: string;
  color: string;
  icon: string;
  items: { title: string; content: string; severity?: "warn" | "critical" | "info" }[];
};

const SECTIONS: Section[] = [
  {
    id: "calibration",
    title: "Calibration Procedures",
    color: "#00AEEF",
    icon: "⚙️",
    items: [
      {
        title: "Pre-Calibration Checklist",
        content: "1. Verify all TLS components are powered on and initialized.\n2. Confirm ASA, ESA, and ATA sensor assemblies are aligned per field manual.\n3. Check CAL/BIT unit status indicator — must show GREEN.\n4. Ensure the GTU is transmitting on correct frequencies (1030/1090 MHz).\n5. Clear all active system alarms before proceeding.",
        severity: "info",
      },
      {
        title: "Phase Calibration",
        content: "Perform phase calibration using the CAL/BIT reference signal.\n1. Set RCU to CAL mode.\n2. Allow system to capture 10 baseline samples.\n3. Compare Phase Jitter readings — must be < 0.5°.\n4. If jitter exceeds limit, check cable connections and sensor alignment.\n5. Log calibration results in the maintenance record.",
        severity: "info",
      },
      {
        title: "Amplitude Calibration",
        content: "Verify signal amplitude levels across all sensor elements.\n1. ASA HIGH / LOW / REF — check amplitude balance.\n2. ESA HIGH / MED / LOW / REF — ensure symmetrical levels.\n3. Adjust GTU output power if amplitude deviation > ±2 dB.\n4. Re-run CAL/BIT self-test to confirm corrections.",
        severity: "info",
      },
    ],
  },
  {
    id: "alarms",
    title: "Alarm Analysis",
    color: "#FF4D4D",
    icon: "🚨",
    items: [
      {
        title: "ESA Limits Exceeded",
        content: "Triggered when ESA elevation reading exceeds defined limits.\nSymptoms: Glide slope deviation alarm on RCU display.\nCauses: ESA misalignment, cable fault, signal interference.\nAction: Check ESA physical alignment → verify cable continuity → re-run CAL/BIT → if fault persists, replace ESA sensor element.",
        severity: "critical",
      },
      {
        title: "ASA / ATA Fault",
        content: "Triggered when azimuth sensor data is invalid or missing.\nSymptoms: LOC deviation alarm, tracking loss on RCU.\nCauses: ASA/ATA antenna obstruction, connector fault, power issue.\nAction: Inspect antenna array for obstructions → check RF cable connections → verify BEU power supply → restart sensor subsystem.",
        severity: "critical",
      },
      {
        title: "Communication Fault",
        content: "Loss of communication between TLS subsystems.\nSymptoms: RCU shows 'COMM FAIL', GTU data dropout.\nCauses: LAN cable disconnected, IP conflict, software crash.\nAction: Check LAN cable integrity → verify IP addressing → restart affected subsystem → check event log on RCU.",
        severity: "warn",
      },
      {
        title: "Phase Jitter Alarm",
        content: "Excessive phase variation detected in sensor signals.\nThreshold: > 0.5° triggers alarm.\nCauses: Cable damage, ground interference, loose connector.\nAction: Inspect all RF cables → check grounding → run phase calibration → replace cable if jitter remains high.",
        severity: "warn",
      },
    ],
  },
  {
    id: "monitoring",
    title: "Phase / Amplitude Monitoring",
    color: "#35D4FF",
    icon: "📊",
    items: [
      {
        title: "Real-Time Monitoring",
        content: "The RCU provides real-time phase and amplitude monitoring for all sensor elements.\nKey parameters:\n• ASA Phase Balance: ±0.5° max deviation\n• ESA Amplitude Symmetry: ±2 dB max\n• GTU Output Power: Monitor for ±1 dB stability\n• Interrogator Reply Rate: Should exceed 95% for all tracked aircraft",
        severity: "info",
      },
      {
        title: "Amplitude Limits",
        content: "ASA Elements: -40 to -20 dBm nominal.\nESA Elements: -45 to -15 dBm nominal.\nAny reading outside these limits triggers an automatic system alarm and should be investigated immediately.",
        severity: "warn",
      },
    ],
  },
  {
    id: "maintenance",
    title: "Maintenance Mode",
    color: "#FFD166",
    icon: "🔧",
    items: [
      {
        title: "Entering Maintenance Mode",
        content: "1. Notify ATC that TLS will be taken offline.\n2. On RCU: Navigate to System → Maintenance Mode → Confirm.\n3. System will broadcast NOTAM automatically if configured.\n4. All guidance transmissions halt — GTU outputs suspended.\n5. Proceed with inspection or repair.",
        severity: "warn",
      },
      {
        title: "Maintenance Checklist",
        content: "• Inspect ASA / ESA / ATA for physical damage\n• Check all RF cable connections and weatherproofing\n• Verify CAL/BIT reference antenna is clean and unobstructed\n• Check GTU cooling fans and internal temperature\n• Test RCU display and keyboard functionality\n• Verify UPS battery health and backup duration\n• Log all findings in the maintenance record",
        severity: "info",
      },
    ],
  },
  {
    id: "initialization",
    title: "Initialization & Startup",
    color: "#00D26A",
    icon: "🟢",
    items: [
      {
        title: "System Startup Sequence",
        content: "1. Power on UPS and verify battery backup is charged.\n2. Power on GTU — wait for READY status (approx. 90 seconds).\n3. Power on RCU workstation — wait for software to load.\n4. Power on Interrogator — verify 1030/1090 MHz operation.\n5. Power on ASA / ESA / ATA BEU units.\n6. Run CAL/BIT self-test — verify GREEN status.\n7. Confirm all alarms are clear on RCU.\n8. Notify ATC — TLS is operational.",
        severity: "info",
      },
      {
        title: "Initialization Fault",
        content: "If system fails to initialize:\n• Check power supply to each subsystem\n• Verify network connectivity between all units\n• Review error log on RCU for specific fault codes\n• Common fault: GTU fails to sync — restart GTU and retry\n• If issue persists after 3 attempts, contact technical support",
        severity: "warn",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    color: "#C9A66B",
    icon: "🔍",
    items: [
      {
        title: "No Aircraft Tracking",
        content: "Symptom: RCU shows no tracks despite aircraft in range.\nCheck: Interrogator power and antenna → verify 1030 MHz transmit → confirm aircraft transponder is active (Mode C/S) → check Interrogator reply rate → inspect RF cable from Interrogator to RCU.",
        severity: "warn",
      },
      {
        title: "LOC / GS Signal Missing",
        content: "Symptom: Aircraft reports no LOC or GS indication.\nCheck: GTU is in operational mode → verify correct frequency output → check GTU transmitter cards → confirm LOC/GS antennas are connected → run GTU self-test.",
        severity: "critical",
      },
      {
        title: "DME / ILS Relation Issues",
        content: "TLS replicates ILS signals. If DME integration is required:\n• Confirm DME transponder is set to paired ILS frequency\n• Verify DME slant range matches expected values for approach\n• Check ILS receiver compatibility on aircraft\n• TLS provides LOC and GS only — DME must be provided by separate DME ground station",
        severity: "info",
      },
    ],
  },
];

const severityColor = { critical: "#FF4D4D", warn: "#FFD166", info: "#00AEEF" };
const severityLabel = { critical: "CRITICAL", warn: "WARNING", info: "INFO" };

export default function Advanced() {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);

  return (
    <div className="page" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="radar-grid" style={{
        background: "linear-gradient(180deg, #071426 0%, #050a12 100%)",
        padding: "24px 20px 20px",
        borderBottom: "1px solid rgba(255,77,77,0.2)",
        position: "relative", overflow: "hidden",
      }}>
        <div className="scan-line" />
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          width: 300, height: 300,
          background: "radial-gradient(circle, rgba(255,77,77,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div className="font-orbitron" style={{ fontSize: 10, letterSpacing: "0.25em", color: "#FF4D4D", marginBottom: 6 }}>
          TECHNICAL REFERENCE
        </div>
        <div className="font-orbitron" style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
          TLS ADVANCED
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          Calibration · Alarms · Maintenance · Troubleshooting
        </div>
      </div>

      <div style={{ padding: "16px 16px 40px" }}>
        {SECTIONS.map((section) => {
          const isOpen = openSection === section.id;
          return (
            <div key={section.id} className="fade-in" style={{ marginBottom: 10 }}>
              {/* Section header */}
              <div
                onClick={() => {
                  setOpenSection(isOpen ? null : section.id);
                  setOpenItem(null);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px",
                  background: isOpen
                    ? `linear-gradient(90deg, ${section.color}18 0%, transparent 100%)`
                    : "rgba(28,38,51,0.6)",
                  border: `1px solid ${isOpen ? section.color + "50" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: isOpen ? "10px 10px 0 0" : 10,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 18 }}>{section.icon}</span>
                <span className="font-orbitron" style={{ flex: 1, fontSize: 12, fontWeight: 700, color: isOpen ? section.color : "var(--text-primary)" }}>
                  {section.title}
                </span>
                <span style={{
                  fontSize: 10, color: section.color, fontFamily: "Orbitron",
                  background: `${section.color}15`, border: `1px solid ${section.color}40`,
                  borderRadius: 4, padding: "2px 7px",
                }}>
                  {section.items.length}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={section.color} strokeWidth="2"
                  style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>

              {/* Items */}
              {isOpen && (
                <div style={{
                  border: `1px solid ${section.color}30`,
                  borderTop: "none",
                  borderRadius: "0 0 10px 10px",
                  overflow: "hidden",
                  background: "rgba(7,20,38,0.7)",
                }}>
                  {section.items.map((item, i) => {
                    const itemKey = `${section.id}-${i}`;
                    const isItemOpen = openItem === itemKey;
                    const sev = item.severity ?? "info";
                    const sevColor = severityColor[sev];
                    return (
                      <div key={i}>
                        {/* Item header */}
                        <div
                          onClick={() => setOpenItem(isItemOpen ? null : itemKey)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "12px 16px",
                            cursor: "pointer",
                            background: isItemOpen ? `${section.color}0a` : "transparent",
                            transition: "background 0.15s",
                            borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                          }}
                        >
                          <div style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: sevColor, flexShrink: 0,
                            boxShadow: `0 0 6px ${sevColor}`,
                          }} />
                          <span style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                            {item.title}
                          </span>
                          <span style={{
                            fontSize: 8, color: sevColor, fontFamily: "Orbitron",
                            letterSpacing: "0.1em",
                            background: `${sevColor}15`, border: `1px solid ${sevColor}35`,
                            borderRadius: 3, padding: "1px 5px",
                          }}>
                            {severityLabel[sev]}
                          </span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                            style={{ transform: isItemOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                            <path d="M9 18l6-6-6-6"/>
                          </svg>
                        </div>

                        {/* Item content */}
                        {isItemOpen && (
                          <div style={{
                            padding: "12px 20px 16px",
                            borderTop: `1px solid ${section.color}20`,
                            background: `${section.color}05`,
                          }}>
                            {item.content.split("\n").map((line, li) => (
                              <div key={li} style={{
                                fontSize: 12, color: "var(--text-muted)", lineHeight: 1.8,
                                marginBottom: line === "" ? 6 : 0,
                              }}>
                                {line || <br />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
