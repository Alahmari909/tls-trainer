// Static lesson content for v2 UI — generated from module descriptions and seed data

export interface Lesson {
  id: number;
  title: string;
  duration: string;
  content: string;
  keyPoints: string[];
}

export interface ModuleData {
  id: number;
  order: number;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  lessons: Lesson[];
}

export const MODULES_DATA: ModuleData[] = [
  {
    id: 1, order: 1,
    title: "INTRODUCTION",
    subtitle: "TLS System Introduction",
    description: "Introduction to the Transponder Landing System — system overview, components, signal flow, power requirements, and safety protocols.",
    icon: "📖", color: "#1e90ff",
    lessons: [
      {
        id: 101, title: "What is TLS?",
        duration: "8 min",
        content: `The Transponder Landing System (TLS) is a precision approach aid that provides ILS-equivalent lateral and vertical guidance to aircraft equipped with Mode C or Mode S transponders. Unlike conventional ILS which requires fixed ground antennas for each runway, TLS uses the aircraft's existing transponder to measure its position and then transmits back computed ILS-format guidance signals.

TLS was developed by Sievert Larsen & Associates and is now part of the Frequentis group. It is widely used by military and civil aviation authorities worldwide for temporary or permanent precision approach operations.

The fundamental advantage of TLS is **portability** — the entire system can be transported in a container and deployed at any airfield within hours, providing CAT I precision approach capability without permanent infrastructure.`,
        keyPoints: [
          "TLS = Transponder Landing System",
          "Provides ILS-equivalent precision approach guidance",
          "Uses aircraft SSR transponder (Mode C/S) for position sensing",
          "Developed by Sievert Larsen, now Frequentis group",
          "Portable — can be deployed rapidly to forward locations",
          "Classified as precision approach aid (equivalent to ILS)"
        ]
      },
      {
        id: 102, title: "TLS vs Conventional ILS",
        duration: "10 min",
        content: `Conventional ILS (Instrument Landing System) requires two fixed ground transmitters: a Localizer antenna beyond the runway end (lateral guidance) and a Glide Slope antenna beside the touchdown zone (vertical guidance). These are permanent installations requiring extensive site preparation and civil works.

**TLS differs fundamentally:** Instead of transmitting guidance signals from fixed antennas in the approach path, TLS interrogates the approaching aircraft's transponder to determine its precise 3D position. The system then computes what guidance deviation the aircraft should display, and transmits those ILS-format signals directly to the aircraft.

From the pilot's perspective, TLS guidance appears identically on standard ILS instruments (CDI localizer needle and glide slope needle). The only operational difference is that pilots must squawk a specific code assigned by ATC for TLS tracking.

**Key comparison:**
- ILS: Fixed transmitters, permanent installation, no transponder needed
- TLS: Mobile system, transponder required, computed guidance, rapid deployment`,
        keyPoints: [
          "ILS uses fixed antennas; TLS is portable",
          "TLS interrogates aircraft transponder to determine position",
          "Both provide identical cockpit indications (CDI + GS needle)",
          "TLS pilots must squawk specific ATC-assigned code",
          "TLS meets CAT I approach minimums (200ft DH / 550m RVR)",
          "TLS governed by ICAO Annex 10, Volume I"
        ]
      },
      {
        id: 103, title: "Frequency Bands & Signals",
        duration: "12 min",
        content: `**SSR Transponder Frequencies:**
TLS operates using Secondary Surveillance Radar (SSR) principles:
- Interrogator transmits on **1030 MHz** (UHF)
- Aircraft transponders reply on **1090 MHz** (UHF)

**ILS Guidance Signals (transmitted back to aircraft):**
TLS generates and transmits standard ILS-format signals:
- Localizer (lateral): VHF band, **108.10–111.95 MHz** (odd decimal tenths)
- Glide Slope (vertical): UHF band, **329.15–335.00 MHz** (paired with localizer)
- Marker Beacons: **75 MHz** (outer: 400 Hz dashes/blue; middle: 1300 Hz dot-dash/amber)

**Modulation:**
ILS/TLS guidance uses **90 Hz and 150 Hz** tone modulation. The Difference in Depth of Modulation (DDM) between these tones indicates course deviation:
- DDM = 0.0 → on centerline / on glide path
- 90 Hz dominant → fly down / right of course
- 150 Hz dominant → fly up / left of course

**Transponder Modes:**
- Mode A: Aircraft identification (4-digit squawk)
- Mode C: Pressure altitude reporting (Gillham/Gray code)
- Mode S: Selective interrogation using unique 24-bit ICAO address — enables TLS to track multiple aircraft simultaneously`,
        keyPoints: [
          "Interrogator: 1030 MHz; Transponder reply: 1090 MHz",
          "Localizer: 108.10–111.95 MHz VHF",
          "Glide Slope: 329.15–335.00 MHz UHF",
          "Marker beacons: 75 MHz",
          "Guidance uses 90 Hz and 150 Hz modulation (DDM)",
          "Mode S allows selective multi-aircraft tracking"
        ]
      },
    ]
  },
  {
    id: 2, order: 2,
    title: "OVERVIEW",
    subtitle: "TLS System Overview",
    description: "Comprehensive overview of the TLS system — architecture, subsystems, operational concepts, and system capabilities.",
    icon: "📡", color: "#00d4ff",
    lessons: [
      {
        id: 201, title: "TLS Architecture & Subsystems",
        duration: "15 min",
        content: `The TLS system consists of several interconnected subsystems working together to provide precision approach guidance:

**ASA — Azimuth Sensor Array**
Receives transponder replies from approaching aircraft and measures azimuth (lateral) position. The ASA determines whether the aircraft is left or right of the extended runway centerline.

**ESA — Elevation Sensor Array**
Measures the elevation (vertical) angle of the approaching aircraft. The ESA determines whether the aircraft is above or below the desired glide path.

**ATA — Azimuth Tracking Antenna**
The primary interrogation antenna. Transmits the 1030 MHz interrogation signals toward approaching aircraft and works with the ASA for azimuth tracking.

**GTU — Ground Transponder Unit**
The central processing unit of TLS. Receives sensor data from ASA and ESA, calculates the aircraft's 3D position, and computes the ILS-equivalent DDM values. Generates and transmits the localizer and glide slope guidance signals.

**CALBIT — Calibration Bit**
A specialized unit used during ground calibration. Injects known test signals into the system to verify signal processing accuracy without requiring an aircraft.

**RCU — Remote Control Unit**
The operator interface. Displays real-time system status, allows parameter adjustment (glide angle, course alignment, frequency), and provides remote control of all TLS components.

**Interrogator**
Generates the 1030 MHz interrogation pulses at the required power level and timing to ensure reliable transponder replies from aircraft throughout the approach corridor.`,
        keyPoints: [
          "ASA: measures aircraft azimuth (lateral position)",
          "ESA: measures aircraft elevation (vertical angle)",
          "ATA: transmits 1030 MHz interrogation signals",
          "GTU: central processor — computes guidance signals",
          "CALBIT: ground calibration verification unit",
          "RCU: operator control and monitoring interface"
        ]
      },
      {
        id: 202, title: "Signal Flow & Guidance Computation",
        duration: "12 min",
        content: `**How TLS Computes Guidance:**

1. **Interrogation:** The TLS interrogator transmits Mode C/S interrogation pulses at 1030 MHz toward the approach corridor.

2. **Transponder Reply:** The aircraft's transponder responds at 1090 MHz with its identification and altitude.

3. **Position Measurement:** ASA measures the azimuth (horizontal angle) to the aircraft. ESA measures the elevation angle. Combined, this gives the aircraft's 3D position relative to the TLS antennas.

4. **Guidance Computation:** The GTU computes:
   - How far the aircraft deviates from the runway centerline (lateral DDM)
   - How far the aircraft deviates from the glide path (vertical DDM)

5. **Signal Transmission:** GTU generates ILS-format localizer and glide slope signals with the computed DDM values and transmits them toward the approaching aircraft.

6. **Cockpit Indication:** Aircraft receives standard VHF/UHF ILS signals. Cockpit instruments (CDI, GS needle) respond normally — pilot sees standard ILS indications.

**Update Rate:** TLS updates position and guidance at approximately 1 Hz (once per second), consistent with ILS requirements.

**Accuracy:** Modern TLS achieves sub-meter position accuracy, sufficient for CAT I precision approach operations.`,
        keyPoints: [
          "TLS interrogates → aircraft replies → position computed → guidance transmitted",
          "Position update rate: ~1 Hz",
          "Sub-meter position accuracy for CAT I ops",
          "DDM = 0.0 on centerline/on glidepath",
          "Full-scale localizer deflection = 0.175 DDM",
          "Glide slope full-scale = ±0.12 × nominal angle"
        ]
      },
      {
        id: 203, title: "ILS Standards & DDM",
        duration: "10 min",
        content: `TLS must meet the same performance standards as conventional ILS, as defined in **ICAO Annex 10, Volume I**.

**DDM (Difference in Depth of Modulation):**
The key parameter for ILS/TLS guidance accuracy. DDM = (90 Hz modulation %) - (150 Hz modulation %)

- **On centerline/glidepath:** DDM = 0.0
- **Full-scale localizer deflection:** DDM = ±0.155 (ICAO standard)
  - Note: some sources cite 0.175 DDM at full-scale
- **Full-scale glide slope deflection:** ±0.175 DDM (or ±0.12θ where θ is nominal angle)

**Course Width:**
Localizer course is set so full-scale deflection occurs at approximately ±350 ft (±107 m) from centerline at the runway threshold — typically about ±2° total angular width.

**Glide Path Angle:**
Standard glide path is **3°** above horizontal. Range: 2° to 4.5° depending on terrain and obstacles. ICAO allows ±10% tolerance from published nominal (so 3° path must stay 2.7°–3.3°).

**Approach Categories:**
- **CAT I:** Decision Height 200 ft, RVR 550 m
- **CAT II:** DH 100 ft, RVR 350 m  
- **CAT III:** DH <100 ft, reduced RVR

TLS typically provides CAT I equivalent performance.`,
        keyPoints: [
          "Governed by ICAO Annex 10, Volume I",
          "DDM = difference in 90Hz vs 150Hz modulation depth",
          "Standard glide path = 3° (range 2°–4.5°)",
          "Glide path tolerance: ±10% of nominal (±0.3° for 3° GS)",
          "CAT I: 200ft DH / 550m RVR",
          "TLS provides CAT I equivalent precision"
        ]
      },
    ]
  },
  {
    id: 3, order: 3,
    title: "INSTALLATION",
    subtitle: "Site & Equipment Installation",
    description: "Step-by-step installation procedures — site preparation, antenna setup, cable routing, power connections, and initial system checks.",
    icon: "🔩", color: "#0080ff",
    lessons: [
      {
        id: 301, title: "Site Selection & Survey",
        duration: "12 min",
        content: `Before any TLS installation or deployment, a thorough **site survey** must be conducted.

**Site Survey Requirements:**

**Runway Geometry:**
- Confirm runway orientation, length, and threshold location
- Determine optimal ASA/ESA placement positions relative to runway
- Verify approach corridor is clear of obstructions

**Terrain & Obstruction Analysis:**
- Check for hills, buildings, trees, towers within the signal cone
- Verify terrain clearances for the approach procedure
- Identify potential multipath reflection sources (metal buildings, water)

**Infrastructure:**
- Verify availability of adequate power supply (208–240V AC)
- Confirm communication paths between TLS units and ATC
- Check soil bearing capacity for equipment placement

**RF Environment:**
- Conduct RF interference survey for 1030/1090 MHz interference sources
- Verify no existing equipment conflicts with TLS frequencies
- Check for adjacent navigation aids that could cause interference

**Siting Criteria:**
- ASA must have clear line-of-sight to runway threshold and full approach corridor
- ESA placement must allow accurate elevation measurement geometry
- Minimum ground clearance per TLS deployment manual
- Antenna elements leveled precisely using spirit level and theodolite`,
        keyPoints: [
          "Survey runway geometry, terrain, obstructions, power, RF environment",
          "ASA needs clear LOS to threshold and full approach corridor",
          "RF interference survey required for 1030/1090 MHz",
          "Verify soil bearing capacity for antenna mounts",
          "Document all findings before proceeding with installation",
          "Consult TLS IMM and local ANPC regulations for tolerances"
        ]
      },
      {
        id: 302, title: "Physical Installation",
        duration: "15 min",
        content: `**Antenna Installation:**

1. **Leveling:** Use precision spirit level and theodolite to ensure all sensor elements are correctly leveled. TLS accuracy is highly sensitive to antenna tilt — even 0.1° of tilt can cause significant guidance errors.

2. **Alignment:** ASA and ESA must be precisely aligned to the extended runway centerline. Misalignment directly causes lateral and vertical course errors.

3. **Height:** Mount antenna elements at the height specified in the TLS deployment manual, sufficient to maintain clear signal path to approaching aircraft and avoid multipath.

**Cable Installation:**
- Route all cables in protective conduit
- Maintain manufacturer's specified minimum bend radius
- Secure cables at regular intervals
- Label all cables at both ends with unit identification
- Use specified cable type: **50-ohm coaxial (RG-214)** for RF distribution
- Seal all outdoor connectors against moisture

**Power Installation:**
- Connect to 208–240V AC supply per specifications
- Install UPS backup for continuous operation during power fluctuations
- Verify proper grounding for lightning protection
- Test UPS switchover before commissioning

**Post-Installation Checks:**
- Verify all cable connections using continuity tester
- Check RF cable impedance and SWR with spectrum analyzer
- Confirm all units power up correctly with no BITE alarms`,
        keyPoints: [
          "Level antennas using precision spirit level and theodolite",
          "Align ASA/ESA precisely to runway centerline extended",
          "Use 50-ohm coaxial (RG-214) for RF cables",
          "Route cables in conduit, label at both ends",
          "Install UPS for power continuity",
          "Verify all connections before power-up"
        ]
      },
      {
        id: 303, title: "System Power-On & Initial Checks",
        duration: "10 min",
        content: `**Startup Sequence:**
The TLS startup sequence must follow the order specified in the Operations Manual — never power up components in random order.

Typical sequence:
1. **UPS** — verify battery charged, switch to mains + UPS mode
2. **GTU (processor)** — allows processor to initialize before RF is active
3. **RCU** — verify control console connectivity to GTU
4. **Sensors (ASA/ESA)** — enable sensor receivers
5. **Interrogator/Transmitters** — enable RF transmission last
6. **BITE verification** — run Built-In Test Equipment check on all units

**Post-Installation Test Sequence:**
1. Individual unit bench test (verify each box works standalone)
2. System power-on self-test (POST) — confirms all units communicate
3. CALBIT checks — verify signal processing chain accuracy
4. RF parameter verification — power levels, SWR, frequencies
5. RCU parameter confirmation — glide angle, course alignment, frequency
6. Ground functional check — confirm correct signal output before any flight check

**First Article Testing:**
Before flight inspection, coordinate with ANPC/GACA for required authorization. Flight inspection by ANPC-authorized crews is mandatory before first live approach service.`,
        keyPoints: [
          "Follow exact startup sequence per Operations Manual",
          "Typical order: UPS → GTU → RCU → Sensors → RF transmitters",
          "Run BITE check on all units after power-up",
          "CALBIT check verifies signal processing accuracy",
          "Flight inspection by ANPC-authorized crew mandatory before service",
          "Document all checks in maintenance log"
        ]
      },
    ]
  },
  {
    id: 4, order: 4,
    title: "OPERATION",
    subtitle: "System Operation Procedures",
    description: "Operational procedures — startup sequences, normal operations, monitoring, ATC integration, and emergency handling.",
    icon: "🎮", color: "#1e90ff",
    lessons: [
      {
        id: 401, title: "Normal Operations",
        duration: "12 min",
        content: `**Daily Startup Procedure:**

1. Power up system following the Operations Manual sequence (UPS → GTU → Sensors → RF)
2. Verify all BITE checks pass on RCU display
3. Confirm system parameters match authorized values:
   - Glide path angle (e.g., 3.00°)
   - Course alignment offset
   - Operating frequency pair (localizer + glide slope)
   - Transmit power levels
4. Log system startup in maintenance record
5. Notify ATC that TLS is operational and ready for use

**Approach Coordination with ATC:**
- ATC assigns a discrete squawk code to each aircraft cleared for TLS approach
- ATC includes "TLS approach" in clearance (not "ILS approach")
- ATC provides runway, frequency, squawk, and weather minima
- TLS operator confirms system tracking and status to ATC
- ATC issues: "[Callsign], cleared TLS approach runway [XX], squawk [code]"

**During Active Approach:**
- Operator monitors all system parameters on RCU continuously
- Verify aircraft transponder is being tracked (position readout on RCU)
- Monitor DDM values — should match expected for aircraft on approach path
- Any anomaly → immediately notify ATC
- Be ready to suspend service at any time

**Maximum Operating Range:**
TLS typically provides guidance to 20 NM, with transponder detection capability to 30+ NM.`,
        keyPoints: [
          "Follow Operations Manual startup sequence daily",
          "Verify all BITE checks before declaring operational",
          "ATC must assign discrete squawk for each TLS approach",
          "Phraseology: 'cleared TLS approach' (not ILS)",
          "Operator monitors RCU continuously during all approaches",
          "TLS guidance range: typically 20 NM"
        ]
      },
      {
        id: 402, title: "SSR Transponder Modes",
        duration: "10 min",
        content: `TLS relies entirely on aircraft SSR transponders. Understanding transponder modes is essential for TLS operators.

**Mode A — Identification:**
- Aircraft transmits 4-digit octal squawk code (e.g., 7351)
- Assigned by ATC for traffic separation and identification
- TLS uses Mode A code to distinguish the specific aircraft on approach

**Mode C — Altitude:**
- Automatically transmits pressure altitude in Gillham (Gray) code
- Reports altitude in 100 ft increments
- Required for all aircraft conducting instrument approaches
- TLS uses Mode C altitude data as cross-check for elevation measurement

**Mode S — Selective:**
- Uses unique 24-bit ICAO address (hex code) for each aircraft
- Allows individual aircraft interrogation without triggering others
- Supports data exchange (ADS-B, TCAS, etc.)
- Enables TLS to simultaneously provide guidance to multiple aircraft
- TLS selectively interrogates each Mode S aircraft by its ICAO address

**Transponder Frequencies:**
- Interrogator transmits: **1030 MHz**
- Aircraft replies: **1090 MHz**

**For TLS Approaches:**
Aircraft must have at minimum Mode C transponder operating. Mode S preferred for enhanced capabilities.`,
        keyPoints: [
          "Mode A: 4-digit ID squawk (ATC assigned)",
          "Mode C: pressure altitude in Gillham code",
          "Mode S: unique 24-bit ICAO address per aircraft",
          "Interrogator: 1030 MHz; Aircraft reply: 1090 MHz",
          "Mode S enables simultaneous multi-aircraft guidance",
          "Minimum: Mode C required for TLS approach"
        ]
      },
      {
        id: 403, title: "Fault Management & Emergency Procedures",
        duration: "12 min",
        content: `**Integrity Monitoring:**
TLS has built-in integrity monitoring that continuously verifies all system parameters are within tolerance. ICAO requires the system to alarm and shut down within 10 seconds if limits are exceeded.

**BITE (Built-In Test Equipment):**
- Continuously monitors all subsystems
- Displays fault codes on RCU when anomaly detected
- Fault codes identify the specific subsystem with the problem

**Actions on BITE Alarm:**
1. Note the fault code displayed on RCU
2. Assess severity — is the alarm safety-critical?
3. If safety-critical: **immediately notify ATC, suspend approach service**
4. ATC issues go-around to any aircraft inside final approach
5. Isolate faulty unit per Fault Isolation Procedure (FIP) in IMM
6. Do not attempt to resume service until fault is corrected

**Guidance Loss Protocol:**
If TLS guidance integrity is lost during an active approach:
- Aircraft must execute **missed approach immediately**
- ATC must advise the pilot immediately
- ATC must offer alternative approach or diversion
- Do not wait to see if system recovers

**NORDO (No Radio):**
If communication with aircraft is lost:
- Use standard light signals for communication
- Continue monitoring aircraft position on TLS
- Coordinate with ATC for alternative procedures

**Lightning Strike:**
If TLS equipment is struck by lightning:
- Suspend all operations immediately
- Conduct full inspection of surge protection, cables, electronics
- Do not resume service until comprehensive check complete`,
        keyPoints: [
          "Integrity monitoring: alarm + shutdown within 10 seconds",
          "BITE provides fault codes identifying problem subsystem",
          "Any safety-critical alarm: notify ATC immediately, suspend service",
          "Guidance loss = mandatory missed approach",
          "Log all fault events with timestamp in maintenance record",
          "Lightning strike requires full inspection before resuming"
        ]
      },
    ]
  },
  {
    id: 5, order: 5,
    title: "CALIBRATION",
    subtitle: "System Calibration",
    description: "Calibration procedures — signal alignment, frequency calibration, flight inspection requirements, and performance verification.",
    icon: "📐", color: "#00bfff",
    lessons: [
      {
        id: 501, title: "Ground Calibration",
        duration: "12 min",
        content: `Ground calibration is performed before flight inspection and after any maintenance affecting RF components or antenna alignment.

**CALBIT (Calibration Bit) Procedure:**
The CALBIT unit injects known test signals into the TLS signal chain, allowing technicians to verify processing accuracy without an aircraft:

1. Connect CALBIT to specified test points per procedure
2. Inject test signals at known DDM values
3. Verify GTU computes and outputs correct guidance signals
4. Check all DDM points: centerline (0.0), full-scale + (0.155), full-scale - (0.155)
5. Verify integrity monitor triggers correctly at out-of-tolerance values

**RCU Parameter Verification:**
Before any flight check, verify all parameters on RCU:
- Glide path angle (matches published approach plate)
- Course alignment (centered on runway heading extended)
- Localizer frequency and glide slope frequency (correct paired channel)
- Transmit power levels within specifications
- Monitor alarm thresholds correctly set

**Sector Alignment:**
The computed TLS guidance path must be precisely aligned:
- Lateral: centered exactly on runway centerline extended
- Vertical: glide path angle matches published procedure (typically 3.00°)
- Both aligned simultaneously using survey measurements and RCU adjustments

**Pre-Flight Check Sequence:**
1. Verify physical installation integrity (no damage, loose mounts)
2. Run system self-test — all BITE checks pass
3. CALBIT signal processing verification
4. RF parameter check (power, SWR, frequencies)
5. Coordinate with ANPC for flight inspection scheduling`,
        keyPoints: [
          "CALBIT injects test signals to verify processing without aircraft",
          "Verify all DDM points: 0.0, +0.155, -0.155",
          "Integrity monitor must trigger correctly at tolerance limits",
          "RCU parameters: angle, alignment, frequency, power",
          "Sector alignment must match published approach procedure",
          "Complete ground calibration before requesting flight inspection"
        ]
      },
      {
        id: 502, title: "Flight Inspection",
        duration: "15 min",
        content: `Flight inspection is mandatory before TLS can be used for live approach service, and periodically thereafter to verify continued compliance.

**Authorization:**
- Must be performed by ANPC-authorized flight inspection crews
- Requires specially equipped inspection aircraft with calibrated receivers
- In Saudi Arabia: GACA/ANPC coordinates flight inspection schedules
- Physical movement or realignment of TLS antennas voids previous calibration

**Inspection Frequency:**
- Initial: before first operational use
- Periodic: as required by national authority (typically every 90 days for primary systems, or annually depending on authority)
- After: any antenna movement, significant maintenance, or signal anomaly

**Parameters Checked During Flight Inspection:**

*Localizer:*
- Course alignment (must be on runway centerline)
- Course width (full-scale deflection at ±350 ft at threshold)
- Course structure (bends — short-period deviations must be within ICAO limits)
- Clearance signals (coverage to ±35° from centerline)
- False course check (no spurious guidance signals)

*Glide Slope:*
- Glide path angle (within ±10% of published nominal)
- Angular displacement sensitivity
- Course structure (bends/scalloping from multipath)
- Reference datum crossing height (15 m above threshold centerline)

**Bends/Scalloping:**
Multipath reflections from terrain, buildings, or wet ground can cause the ILS/TLS course to deviate in short-period oscillations (bends). These must be within ICAO limits or the system cannot be used for approaches.`,
        keyPoints: [
          "Flight inspection mandatory before first use and periodically",
          "Only ANPC-authorized crews with calibrated aircraft",
          "Any antenna movement requires new flight inspection",
          "Checks: alignment, width, course structure, clearance, false courses",
          "Glide path tolerance: ±10% of nominal (±0.3° for 3° GS)",
          "Bends/scalloping from multipath must be within ICAO limits"
        ]
      },
      {
        id: 503, title: "Calibration Tolerances & Standards",
        duration: "10 min",
        content: `**ICAO Annex 10 Tolerances for TLS/ILS:**

**Localizer:**
- Course alignment: Within ±10.5 m of runway centerline at reference datum (CAT I)
- Full-scale deflection: 0.155–0.175 DDM at course boundary
- Course structure (bends): See ICAO Annex 10 Table — max permitted deviations
- False course: No spurious guidance signals within ±35° of front course

**Glide Slope:**
- Nominal angle: 3° (range 2°–4.5°)
- Tolerance: ±10% of nominal angle (e.g., 2.7°–3.3° for 3° nominal)
  - Note: Fine structure tolerance = ±0.075θ (e.g., ±0.225° for 3° GS)
- Reference datum: 15 m above runway centerline at threshold
- Displacement sensitivity: DDM change per angular degree of displacement

**Integrity / Monitor:**
- Alarm and shutdown within 10 seconds of parameter exceedance
- All monitors verified during ground calibration and flight inspection

**SWR (Standing Wave Ratio):**
- Acceptable SWR: typically ≤1.5:1 for TLS RF cables/antennas
- High SWR indicates impedance mismatch — investigate connector, cable, or antenna damage

**Maintenance Record Requirements:**
All calibration results must be documented with:
- Date and crew identification
- All measured parameters vs. tolerance
- Any deviations and corrective actions
- Signatures of technician and supervisor`,
        keyPoints: [
          "CAT I localizer: within ±10.5 m at reference datum",
          "Glide slope angle tolerance: ±10% (or ±0.075θ for fine structure)",
          "Integrity: alarm + shutdown within 10 seconds",
          "SWR ≤1.5:1 for RF cables and antennas",
          "All calibration results must be documented in logbook",
          "ICAO Annex 10 is the governing standard"
        ]
      },
    ]
  },
  {
    id: 6, order: 6,
    title: "MAINTENANCE",
    subtitle: "Maintenance Procedures",
    description: "Maintenance schedules, fault diagnosis, BITE systems, component replacement, and preventive maintenance procedures.",
    icon: "🔧", color: "#0066cc",
    lessons: [
      {
        id: 601, title: "Preventive Maintenance",
        duration: "12 min",
        content: `**Preventive Maintenance Philosophy:**
Scheduled maintenance prevents failures before they occur, extends equipment life, and maintains performance standards. For navigation aids like TLS, preventive maintenance is not optional — it is required for regulatory compliance and aviation safety.

**Daily Checks:**
- System power-up and BITE verification
- Verify all parameters within specification
- Log system status in maintenance record

**Weekly/Monthly Checks:**
- Inspect all RF connectors for corrosion and tightness
- Check cable routing for damage or pinching
- Verify antenna element alignment (visual check)
- Test UPS battery function and switchover
- Clean antenna elements — dust/sand accumulation causes signal attenuation
- Inspect all ground connections for corrosion

**Quarterly Checks:**
- Full connector inspection with torque verification
- Cable continuity and SWR testing
- CALBIT calibration verification
- Coordinate flight inspection per authority schedule
- Inspect antenna mounts and leveling jacks for corrosion/wear

**Annual Checks:**
- Full system disassembly inspection per IMM schedule
- Replace any scheduled replacement items (filters, batteries, connectors)
- Verify all documentation current

**Saudi Arabia Environment:**
Sand and dust accumulation is the primary environmental threat. Regular cleaning and protection of antenna elements and connectors is essential. Inspect for sand infiltration in all ventilation paths and connectors.`,
        keyPoints: [
          "Daily: BITE check and parameter verification",
          "Weekly/Monthly: connectors, cables, antenna cleaning",
          "Quarterly: full calibration verification, flight inspection",
          "Sand/dust = primary environmental threat in Saudi Arabia",
          "All maintenance actions logged with date and signature",
          "Document deviations and corrective actions"
        ]
      },
      {
        id: 602, title: "BITE & Fault Isolation",
        duration: "12 min",
        content: `**BITE — Built-In Test Equipment:**
TLS subsystems include self-diagnostic circuits that continuously monitor equipment health. When a fault is detected, BITE triggers an alarm on the RCU with a specific fault code identifying the affected subsystem.

**Fault Isolation Procedure (FIP):**
When a BITE fault code is displayed:

1. **Note the fault code** — look up in IMM fault code table
2. **Assess severity** — is this safety-critical? Can service continue?
3. **Follow FIP** — the IMM provides step-by-step isolation for each code
4. **Isolate to LRU** — Line Replaceable Unit (the field-replaceable box)
5. **Verify** — after replacement, run BITE again to confirm fault cleared

**Common Fault Categories:**
- **Power Supply:** Low voltage, ripple, switchover failure → check UPS, PSU
- **RF Chain:** High SWR, low power → check cables, connectors, antenna
- **Signal Processing:** Incorrect DDM values → CALBIT check, GTU
- **Communications:** RCU ↔ GTU link failure → check cables, network config

**VSWR (Voltage Standing Wave Ratio):**
High SWR indicates RF impedance mismatch:
- Ideal: 1:1 (perfect match)
- Acceptable: typically ≤1.5:1
- Causes: damaged connector, kinked cable, antenna damage, moisture
- Diagnosis: use SWR meter or spectrum analyzer

**ESD Handling:**
TLS electronics are sensitive to electrostatic discharge:
- Always wear grounded wrist strap
- Use ESD-rated work mat
- Keep components in anti-static bags until installation
- Never work on PCBs without proper ESD protection`,
        keyPoints: [
          "BITE provides fault codes identifying affected subsystem",
          "Follow Fault Isolation Procedure (FIP) in IMM for each code",
          "Isolate to LRU (Line Replaceable Unit) level",
          "VSWR >1.5:1 indicates RF impedance problem",
          "ESD protection mandatory when handling electronics",
          "Verify fault cleared with BITE after replacement"
        ]
      },
      {
        id: 603, title: "Component Replacement & Records",
        duration: "10 min",
        content: `**Component Replacement Procedure:**
All component replacements must follow the IMM (Installation and Maintenance Manual) procedure:

1. Obtain replacement component (verify NSN/part number match)
2. Follow IMM procedure for disassembly
3. Install replacement per procedure — correct torque values, connector orientations
4. Perform system self-test (BITE)
5. Verify RF parameters (SWR, power levels)
6. CALBIT calibration check if RF components replaced
7. Ground functional check — confirm correct signal output
8. Update maintenance log with component replaced, date, technician

**Hot Standby Redundancy:**
Some TLS installations include hot standby redundancy:
- Backup unit fully powered and synchronized with primary
- Automatic switchover in <1 second on primary failure
- Eliminates service interruption during component failures

**MTBF & MTTR:**
- **MTBF (Mean Time Between Failures):** Modern TLS typically >2000 hours
- **MTTR (Mean Time To Repair):** Average time to diagnose and restore after failure. Low MTTR = high availability

**NSN (National Stock Number):**
All TLS components have NSN identifiers — standardized identification enabling NATO logistics and inventory management. Always use correct NSN when ordering replacement parts.

**Maintenance Documentation:**
Navigation aid logbooks must document:
- All maintenance actions with date, time, technician
- All calibration results vs. tolerances
- All faults, corrective actions, and component replacements
- Signatures of technician and supervisor for each entry`,
        keyPoints: [
          "Always follow IMM procedure for component replacement",
          "Verify NSN/part number before installing replacement",
          "Run BITE + CALBIT after any RF component replacement",
          "Hot standby redundancy: auto-switchover <1 second",
          "MTBF >2000 hours for modern TLS",
          "All actions documented in logbook with signatures"
        ]
      },
    ]
  },
  {
    id: 7, order: 7,
    title: "CONTAINER & DEPLOYMENT",
    subtitle: "Transport & Deployment",
    description: "Container specifications, deployment procedures, site survey requirements, rapid setup for field operations.",
    icon: "📦", color: "#0080ff",
    lessons: [
      {
        id: 701, title: "Containerized TLS System",
        duration: "10 min",
        content: `**Containerized TLS:**
The primary advantage of a containerized TLS system is **rapid deployment to forward or temporary locations** without permanent infrastructure.

All TLS components are packed in a standard ISO container (or military equivalent) that can be:
- Transported by flatbed truck or military HEMTT (Heavy Expanded Mobility Tactical Truck)
- Airlifted by cargo aircraft
- Ship-transported

**Container Contents:**
- GTU processing rack
- RCU operator console
- ASA antenna assembly (disassembled for transport)
- ESA antenna assembly (disassembled for transport)
- ATA interrogation antenna
- CALBIT calibration unit
- All RF cables and connectors
- Power distribution unit and UPS
- Leveling jacks and antenna mounts
- Tools and test equipment
- Documentation and maintenance kit

**Pre-Deployment Inspection:**
Before deploying, verify:
- All components serviceable (BITE-checked in garrison)
- Packing list complete — no components missing
- All documentation current and available
- All tools and test equipment present
- Transport vehicle has adequate load rating`,
        keyPoints: [
          "Primary advantage: rapid deployment without permanent infrastructure",
          "Transport: flatbed truck, HEMTT, airlift, or ship",
          "Pre-deployment: verify all components serviceable and complete",
          "Container includes all equipment, cables, tools, documentation",
          "Verify transport vehicle load rating for container weight",
          "Acclimatize equipment before operation in new environment"
        ]
      },
      {
        id: 702, title: "Deployment Procedure",
        duration: "15 min",
        content: `**Field Deployment Sequence:**

**Phase 1: Site Preparation**
1. Conduct full site survey (terrain, obstructions, power, RF)
2. Identify antenna positions meeting TLS siting criteria
3. Verify power availability or arrange generator
4. Clear any obstacles from approach corridor

**Phase 2: Equipment Offload & Setup**
1. Position transport vehicle at site
2. Offload container using crane or forklift (verify ground bearing)
3. Position and secure container or individual equipment
4. Deploy leveling jacks — level all antenna mounts
5. Assemble ASA and ESA antennas

**Phase 3: Alignment**
1. Use theodolite to align ASA/ESA to runway centerline extended
2. Verify antenna leveling with precision spirit level
3. Connect all RF cables — verify correct routing and termination
4. Connect power — verify correct voltage and grounding

**Phase 4: System Startup & Commissioning**
1. Power up per startup sequence (UPS → GTU → Sensors → RF)
2. Run BITE check on all units
3. CALBIT calibration verification
4. Verify all parameters on RCU
5. Coordinate with ATC and ANPC for authorization

**Typical Timeline:**
- Mechanical setup (trained crew): 4–8 hours
- Full commissioning including calibration: additional time
- Flight inspection (ANPC): separate coordination

**Environmental Considerations:**
- Allow equipment to acclimatize (30–60 min) when moving from cold storage to hot environment — prevents condensation damage
- Multiple factors affect performance: precipitation, wet ground multipath, temperature extremes, wind loading on antennas`,
        keyPoints: [
          "4 phases: site prep → equipment setup → alignment → commissioning",
          "Trained crew mechanical setup: 4–8 hours",
          "Align ASA/ESA to runway centerline with theodolite",
          "Allow acclimatization when temperature changes significantly",
          "ANPC coordination required before first live approach",
          "Environmental factors: precipitation, temperature, wind, multipath"
        ]
      },
    ]
  },
  {
    id: 8, order: 8,
    title: "PACKING INSTRUCTIONS",
    subtitle: "Packing & Storage",
    description: "Packing procedures, storage requirements, transport configurations, and equipment protection protocols.",
    icon: "🗃️", color: "#1e90ff",
    lessons: [
      {
        id: 801, title: "Packing Procedures",
        duration: "10 min",
        content: `**Purpose of Proper Packing:**
Proper packing protects sensitive TLS components from damage during transport, storage, and handling. Improper packing is a leading cause of field equipment failures.

**RF-Sensitive Components:**
TLS RF components and antenna elements are sensitive to:
- **ESD (Electrostatic Discharge):** Pack in anti-static bags
- **Physical shock:** Use rigid cases with foam cutouts sized to each component
- **Moisture:** Include desiccant packs, seal all connectors

**Packing Sequence:**
1. Clean all components thoroughly
2. Apply corrosion protection to all metal surfaces (connectors, antenna elements)
3. Seal all connector ports with protective dust caps
4. Place RF components in anti-static bags
5. Place in rigid shipping cases with foam cutouts
6. Add desiccant packs to absorb residual moisture
7. Seal cases — verify shock/vibration indicators are fitted
8. Label cases with contents, orientation arrows, and handling instructions

**Cable Packing:**
- Coil loosely to manufacturer's specified minimum bend radius
- Secure with Velcro ties — NOT cable ties (which crush the jacket)
- Never wrap cables tightly — damages internal conductor and shielding

**Antenna Orientation:**
- Follow orientation arrows/labels on shipping crate
- Incorrect orientation causes antenna elements to contact crate walls → damage
- Typically: horizontal with fragile elements protected by foam`,
        keyPoints: [
          "RF components: anti-static bags + rigid cases with foam cutouts",
          "Include desiccant packs to prevent moisture damage",
          "Clean + apply corrosion protection before packing",
          "Cables: coil loosely with Velcro ties, never tight cable ties",
          "Follow orientation arrows on shipping crates",
          "Shock/vibration indicators show transport mishandling"
        ]
      },
      {
        id: 802, title: "Storage Requirements",
        duration: "8 min",
        content: `**Storage Environment:**
TLS equipment requires controlled storage to prevent degradation:

- **Temperature:** 10–35°C (50–95°F) — avoid temperature extremes
- **Humidity:** <60% RH — excess humidity causes corrosion and condensation
- **Cleanliness:** Free from dust, sand, chemical contamination
- **Vibration:** No mechanical vibration — damages sensitive electronics
- **Power:** Consider periodic power-on cycles for long storage (check IMM)

**Pre-Storage Preparation:**
1. Inspect all components — document any pre-existing damage
2. Clean all surfaces thoroughly
3. Apply corrosion inhibitor to metal surfaces (especially connectors)
4. Seal all ports with protective caps
5. Pack per packing procedures
6. Update maintenance logbook (last service date, condition, storage date)

**Shock/Vibration Indicators:**
Shipping containers should be fitted with shock/vibration indicators. Upon receipt or after transport:
- Check indicators before opening
- If indicator shows excessive shock: conduct full inspection before use
- Do not assume equipment is serviceable without inspection after transport mishandling

**Special Requirements:**
- **Power supplies/batteries:** HAZMAT regulations apply. Batteries require specific orientation, temperature limits, and transport documentation
- **Long-term storage:** Some components may require periodic energization per IMM schedule to prevent capacitor degradation

**NSN for Logistics:**
All TLS replacement parts and consumables (desiccant, dust caps, connector protectors) have NSN identifiers for NATO logistics management.`,
        keyPoints: [
          "Storage: 10–35°C, <60% RH, clean, vibration-free",
          "Pre-storage: inspect, clean, corrosion protect, seal, log",
          "Check shock indicators before using equipment after transport",
          "Batteries: HAZMAT regulations apply",
          "Update logbook with storage date and equipment condition",
          "NSN identifiers for all components and consumables"
        ]
      },
    ]
  },
  {
    id: 9, order: 9,
    title: "ATC QUICK GUIDE",
    subtitle: "ATC Operating Guide",
    description: "Quick reference guide for Air Traffic Controllers — TLS operating procedures, phraseology, and coordination requirements.",
    icon: "🛫", color: "#ffaa00",
    lessons: [
      {
        id: 901, title: "ATC Procedures for TLS",
        duration: "12 min",
        content: `**TLS Approach Clearance — What ATC Must Include:**

When clearing an aircraft for a TLS approach, ATC must provide:
1. Aircraft callsign
2. **"Cleared TLS approach"** (not ILS — must specify TLS)
3. Runway number
4. Assigned discrete transponder squawk code
5. TLS ILS-equivalent frequency to tune
6. Current altimeter setting
7. Weather/RVR information
8. Relevant NOTAMs

**Standard Phraseology:**
> "[Callsign], cleared TLS approach runway [XX], squawk [code], report [fix]"

**Pre-Approach Information to Pilot:**
- TLS system in use (not ILS)
- RVR/weather conditions
- Altimeter setting
- ATIS information
- Relevant NOTAMs affecting TLS operation

**Separation Minima:**
TLS uses the same separation standards as ILS, per **ICAO PANS-ATM (Doc 4444)**. Apply standard precision approach separation — no additional spacing required.

**Approach Categories:**
- CAT I: DH 200 ft, RVR 550 m
- CAT II: DH 100 ft, RVR 350 m
- CAT III: DH <100 ft, reduced RVR
TLS typically provides CAT I equivalent.

**GACA/ANPC in Saudi Arabia:**
GACA (General Authority of Civil Aviation) oversees ANPC certification standards. All TLS approach procedures must be approved by GACA/ANPC.`,
        keyPoints: [
          "Phraseology: '[Callsign], cleared TLS approach runway [XX], squawk [code]'",
          "Must specify 'TLS approach' — not ILS",
          "Provide: runway, squawk code, frequency, altimeter, RVR, NOTAMs",
          "Same separation minima as ILS (ICAO Doc 4444)",
          "GACA oversees ANPC certification in Saudi Arabia",
          "TLS typically provides CAT I equivalent minimums"
        ]
      },
      {
        id: 902, title: "TLS Alarm Response & Coordination",
        duration: "10 min",
        content: `**ATC Action on TLS Monitor Alarm:**

If the TLS operator notifies ATC of a system alarm or service suspension:

1. **Immediately** advise any aircraft on TLS approach
2. Issue go-around instruction to aircraft inside final approach or decision altitude
3. Offer alternative approach (ILS on another runway, VOR, visual) or diversion
4. Suspend TLS approach clearances until system status confirmed
5. Issue NOTAM if outage will be extended

**Controller Coordination with TLS Operator:**
- ATC informs TLS operator of each approach clearance (callsign, squawk)
- TLS operator confirms tracking and system status to ATC
- TLS operator immediately notifies ATC of ANY anomaly
- Continuous two-way coordination during all approaches

**Critical vs. Sensitive Areas:**
- **Critical Area:** Always protected — prevents interference with ILS/TLS signals in all weather conditions
- **Sensitive Area:** Additional protection required in low visibility (CAT II/III ops)
Ensure no aircraft, vehicles, or equipment in critical areas during TLS approaches.

**NOTAM Requirements:**
A NOTAM is required whenever TLS availability is affected:
- System out of service
- Service degraded
- Frequency or approach procedure changes
- Return to service after outage

**Runway Incursion Prevention:**
During TLS approaches, strictly enforce critical area protection. Unauthorized presence on the active runway or taxiways within the ILS/TLS signal protection zone is a runway incursion — a critical safety hazard.`,
        keyPoints: [
          "TLS alarm: immediately advise aircraft, issue go-around if needed",
          "Suspend TLS clearances until operator confirms system OK",
          "ATC and TLS operator: continuous two-way coordination",
          "Critical areas: always protected; Sensitive areas: extra protection in low vis",
          "Issue NOTAM for any extended TLS outage or degradation",
          "Strictly enforce critical/sensitive areas to prevent runway incursion"
        ]
      },
    ]
  },
];

// Documents list
export const DOCUMENTS = [
  { id: 1, title: "TLS System Overview", filename: "020-00071_RevE.pdf", category: "Technical", description: "Complete TLS system technical overview and architecture", pages: 45 },
  { id: 2, title: "TLS Installation Manual", filename: "020-00072_RevF.pdf", category: "Installation", description: "Full installation procedures and site requirements", pages: 78 },
  { id: 3, title: "TLS Operations Manual", filename: "020-00073_RevF.pdf", category: "Operations", description: "Operating procedures, startup, shutdown, emergency", pages: 62 },
  { id: 4, title: "TLS Maintenance Manual", filename: "020-00074_RevG.pdf", category: "Maintenance", description: "Preventive and corrective maintenance procedures", pages: 94 },
  { id: 5, title: "TLS Parts Catalog", filename: "020-00076_RevD.pdf", category: "Logistics", description: "Illustrated parts breakdown with NSN numbers", pages: 120 },
  { id: 6, title: "TLS Calibration Manual", filename: "020-00077_RevC.pdf", category: "Calibration", description: "Calibration procedures and tolerance tables", pages: 55 },
  { id: 7, title: "ATC Quick Guide", filename: "ATC_quick_guide_TLS.pdf", category: "ATC", description: "Quick reference for Air Traffic Controllers", pages: 12 },
  { id: 8, title: "ANPC English Standards", filename: "TLS_ANPC_English.pdf", category: "Regulatory", description: "ANPC/GACA TLS regulatory standards (English)", pages: 38 },
  { id: 9, title: "TLS Training KSA 2021", filename: "TLS_Training_June_2021_KSA.pdf", category: "Training", description: "Saudi Arabia TLS training course materials June 2021", pages: 110 },
];
