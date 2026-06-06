/**
 * Seed rich lesson content for TLS Trainer
 * Module IDs in production: 16-21
 * Run: cd /home/user/tls-trainer && source .env && bun run seed-lessons.ts
 */
import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN!,
});

const lessons: {
  module_id: number;
  title: string;
  content: string;
  order: number;
}[] = [
  // ── Module 16: Introduction to TLS ──────────────────────────────────────────
  {
    module_id: 16,
    title: "What is the TLS?",
    order: 1,
    content: `## What is the TLS?

The **Transmitter Location System (TLS)** is a ground-based passive radio frequency system designed to locate hostile transmitters by measuring the **Time Difference of Arrival (TDOA)** of signals at multiple sensor sites.

### Purpose
TLS is used to detect and geolocate **enemy radio emitters** such as radios, jammers, or radar systems operating in the battlefield. It is a **passive system** — it only listens and does not emit any signal itself, making it covert.

### Key Characteristics
- **Passive Operation**: No emissions from TLS sensors
- **Frequency Coverage**: Typically covers HF, VHF, and UHF bands
- **Accuracy**: Geolocates emitters to within tens of meters depending on geometry and frequency
- **Multi-site**: Requires at least 3 sensor sites (nodes) for a 2D fix; 4+ for redundancy

### Role in Electronic Warfare
TLS falls under **SIGINT (Signals Intelligence)** and **ESM (Electronic Support Measures)**. It provides real-time targeting data to:
- Artillery and fire support units
- Electronic attack systems
- Command posts

### Abbreviations
| Term | Meaning |
|------|---------|
| TLS | Transmitter Location System |
| TDOA | Time Difference of Arrival |
| TOA | Time of Arrival |
| SIGINT | Signals Intelligence |
| ESM | Electronic Support Measures |
| EW | Electronic Warfare |
| RF | Radio Frequency |`,
  },
  {
    module_id: 16,
    title: "System Overview and Architecture",
    order: 2,
    content: `## System Overview and Architecture

The TLS network consists of multiple geographically distributed **nodes** that work together to triangulate emitter positions.

### System Elements

**1. Sensor Nodes (Remote Units)**
Each node contains:
- A wideband antenna (omnidirectional or directional)
- A receiver/digitizer board
- GPS receiver for precise timing synchronization
- Communication link back to the processing center

**2. Central Processing Station (CPS)**
- Receives time-stamped signal captures from all nodes
- Computes TDOA between node pairs
- Generates hyperbolic lines of position (LOP)
- Finds the intersection = emitter location

**3. Operator Console**
- Displays emitter tracks on a digital map
- Allows operator to classify emitters
- Exports target coordinates to fire control systems

### Data Flow
\`\`\`
Emitter → [Node 1] ──┐
Emitter → [Node 2] ──┤──→ CPS → Target Location
Emitter → [Node 3] ──┘
\`\`\`

### Timing Requirements
All nodes must be **time-synchronized** to within nanoseconds. GPS provides the common time reference (UTC). A 1 nanosecond timing error translates to ~30 cm position error.

### Abbreviations
| Term | Meaning |
|------|---------|
| CPS | Central Processing Station |
| LOP | Line of Position |
| GPS | Global Positioning System |
| UTC | Coordinated Universal Time |
| HF | High Frequency (3–30 MHz) |
| VHF | Very High Frequency (30–300 MHz) |
| UHF | Ultra High Frequency (300–3000 MHz) |`,
  },
  {
    module_id: 16,
    title: "Operational Concept and Limitations",
    order: 3,
    content: `## Operational Concept and Limitations

### Deployment Concept
TLS is typically deployed as a **battalion or brigade level asset**. Nodes are positioned:
- At least **20–50 km apart** (baseline length) to provide adequate TDOA measurements
- With **line-of-sight** to the expected emitter area where possible
- On elevated terrain to maximize reception range

### Operational Strengths
- **Passive** — enemy cannot detect TLS operation
- **Fast** — geolocation in seconds for a sustained transmission
- **Accurate** — sub-100m CEP under good geometry
- **Wide-band** — captures any RF emitter in its coverage band

### Limitations
| Limitation | Impact |
|-----------|--------|
| Short transmissions (<50ms) | Poor fix quality or no fix |
| Multi-path reflections | Position errors |
| Frequency hopping emitters | Harder to correlate across nodes |
| Poor node geometry (collinear) | High GDOP, large position error |
| High-density RF environment | Signal association errors |

### Geometry and GDOP
**GDOP (Geometric Dilution of Precision)** measures how node geometry affects accuracy. Nodes forming a wide triangle around the emitter give low GDOP (good). Collinear nodes give high GDOP (bad).

### Minimum Requirements for a Fix
- At least **3 nodes** must receive the same signal within the correlation window
- Signal must be **long enough** for coherent cross-correlation
- Nodes must have **GPS lock** for valid time stamps

### Abbreviations
| Term | Meaning |
|------|---------|
| CEP | Circular Error Probable |
| GDOP | Geometric Dilution of Precision |
| LOS | Line of Sight |`,
  },

  // ── Module 17: TLS Components and Block Diagram ──────────────────────────────
  {
    module_id: 17,
    title: "Node Hardware Components",
    order: 1,
    content: `## Node Hardware Components

Each TLS sensor node contains the following hardware:

### 1. Antenna Subsystem
- **Wideband antenna**: Covers the full operational frequency range
- Types: Log-periodic, discone, or active monopole depending on band
- Often includes a **Low Noise Amplifier (LNA)** at the antenna to boost weak signals before cable losses

### 2. Receiver / Digitizer Unit
- **Wideband RF receiver**: Downconverts the RF signal to baseband or IF
- **ADC (Analog-to-Digital Converter)**: Samples the signal at high rate (e.g., 100 MSPS)
- **DDC (Digital Down Converter)**: Tunes to the frequency of interest and reduces sample rate

### 3. GPS Timing Module
- Provides **1PPS (one pulse per second)** reference to timestamp samples
- Disciplined oscillator locked to GPS for sub-nanosecond accuracy
- Critical — without GPS lock, node data is invalid

### 4. Processing Unit
- Embedded computer (DSP or FPGA-based)
- Runs signal capture, buffer management, and compression
- Sends data to CPS over the comms link

### 5. Communications Link
- Typically **encrypted IP over RF** or fiber/cable
- Latency must be low enough for real-time processing

### Block Diagram Summary
\`\`\`
Antenna → LNA → Receiver → ADC → DDC → DSP/FPGA → Comms → CPS
                                              ↑
                                         GPS 1PPS
\`\`\`

### Abbreviations
| Term | Meaning |
|------|---------|
| LNA | Low Noise Amplifier |
| ADC | Analog-to-Digital Converter |
| DDC | Digital Down Converter |
| DSP | Digital Signal Processor |
| FPGA | Field Programmable Gate Array |
| IF | Intermediate Frequency |
| MSPS | Mega-Samples Per Second |
| 1PPS | One Pulse Per Second |`,
  },
  {
    module_id: 17,
    title: "Central Processing Station (CPS) Architecture",
    order: 2,
    content: `## Central Processing Station Architecture

The CPS is the intelligence core of TLS. It aggregates data from all nodes and computes emitter locations.

### CPS Hardware
- High-performance server or workstation cluster
- High-speed network interfaces (to receive node data)
- Large storage for signal archives
- Operator display workstations

### CPS Software Modules

**1. Signal Collector**
- Receives timestamped I/Q data buffers from each node
- Queues data aligned by time tag

**2. TDOA Processor**
- Performs **cross-correlation** between node pairs to find TDOA
- Uses **GCC-PHAT** (Generalized Cross-Correlation with Phase Transform) for robustness
- Outputs TDOA values τ₁₂, τ₁₃, τ₂₃ (time differences in seconds)

**3. Geolocation Engine**
- Converts TDOAs into **hyperbolic LOPs**
- Each TDOA pair defines one hyperbola
- Intersection of ≥2 hyperbolas = emitter position
- Uses **MLAT (Multilateration)** or **Chan's algorithm** for fast solution

**4. Tracker**
- Associates fixes over time into emitter tracks
- Assigns track IDs, classifies by frequency/modulation

**5. Map Display / Reporting**
- Overlays tracks on digital terrain map
- Exports MGRS/UTM coordinates to C2 systems

### TDOA Cross-Correlation
\`\`\`
Node 1 signal: s₁(t)
Node 2 signal: s₂(t)
Cross-correlation: R₁₂(τ) = ∫ s₁(t) · s₂(t+τ) dt
Peak of R₁₂ at τ* = TDOA between nodes 1 and 2
\`\`\`

### Abbreviations
| Term | Meaning |
|------|---------|
| I/Q | In-phase / Quadrature (complex baseband signal) |
| GCC-PHAT | Generalized Cross-Correlation Phase Transform |
| MLAT | Multilateration |
| MGRS | Military Grid Reference System |
| UTM | Universal Transverse Mercator |
| C2 | Command and Control |`,
  },
  {
    module_id: 17,
    title: "Power, Communications and System Integration",
    order: 3,
    content: `## Power, Communications and System Integration

### Power Supply
Each remote node requires reliable power:
- **Primary**: Mains power (220V AC) when available
- **Backup**: Military generator (TG series or equivalent)
- **Battery**: UPS buffer to survive short outages and keep GPS lock
- Power consumption: Typically 50–200W per node depending on equipment

### Communications Architecture

**Node-to-CPS Links**
| Link Type | Bandwidth | Use Case |
|-----------|-----------|---------- |
| Fiber optic | 1 Gbps+ | Preferred — low latency, secure |
| Encrypted RF (COFDM) | 2–50 Mbps | Mobile deployments |
| VSAT satellite | 512 Kbps–5 Mbps | Extended range, high latency |
| Ethernet over microwave | 100 Mbps | Fixed installations |

**Latency Budget**
- TDOA processing requires node data within a few seconds of capture
- Total link latency must be < **processing window** (typically 5–30 seconds)

### System Integration with Fire Control
TLS outputs emitter coordinates as:
- **MGRS grid** (primary military format)
- **WGS84 lat/lon** for digital systems
- Formatted messages (ELINT reports, fire mission requests)

### Calibration Requirement
Before operations:
1. Each node must have **GPS lock** (≥4 satellites, PDOP < 3)
2. Known transmitter test: A reference transmitter at known location is used to verify system accuracy
3. Timing offsets measured and corrected in CPS

### Abbreviations
| Term | Meaning |
|------|---------|
| UPS | Uninterruptible Power Supply |
| COFDM | Coded Orthogonal Frequency Division Multiplex |
| VSAT | Very Small Aperture Terminal |
| WGS84 | World Geodetic System 1984 |
| PDOP | Position Dilution of Precision |
| ELINT | Electronic Intelligence |`,
  },

  // ── Module 18: Siting Criteria, Virtual Emanation, Transportable TLS ─────────
  {
    module_id: 18,
    title: "Node Siting Criteria",
    order: 1,
    content: `## Node Siting Criteria

Correct siting of TLS nodes is critical for accuracy and system performance. Poor siting is the most common cause of degraded TLS performance.

### Primary Siting Requirements

**1. Baseline Length**
- Nodes must be spaced **20–80 km** apart (optimal ~40 km for VHF targets)
- Too close: poor GDOP, large position errors
- Too far: signal may not be received at all remote nodes

**2. Line of Sight to Target Area**
- VHF/UHF propagation is quasi-line-of-sight
- Nodes should have **unobstructed view** toward the expected emitter area
- Hills and ridgelines can block signals — avoid placing nodes behind terrain obstacles

**3. Elevated Positions Preferred**
- Higher elevation = longer radio horizon
- Radio horizon: d (km) ≈ 4.12 × √h (m)
- A node at 100m elevation sees ~41 km to the radio horizon

**4. No Local RF Interference**
- Avoid proximity to own-force transmitters, generators, radar
- Site at least **500m from high-power RF sources**
- Mutual interference degrades cross-correlation

**5. GPS Sky View**
- Node must have clear view of sky for GPS reception
- Avoid dense tree canopy, buildings blocking sky
- Minimum 4 GPS satellites required

### Siting Table Example
| Site | Elevation | Distance to CPS | Notes |
|------|-----------|-----------------|-------|
| Node 1 (North) | 320m ASL | 45 km | Hill top, clear LOS |
| Node 2 (South) | 180m ASL | 38 km | Ridge, some tree masking |
| Node 3 (East) | 410m ASL | 52 km | Best elevation, fiber available |

### Prohibited Siting Areas
- Within 1 km of friendly HF/VHF transmitter sites
- Areas with known multi-path (dense buildings, metal structures)
- Flood plains or areas with standing water (antenna grounding issues)

### Abbreviations
| Term | Meaning |
|------|---------|
| ASL | Above Sea Level |
| LOS | Line of Sight |
| RF | Radio Frequency |
| GDOP | Geometric Dilution of Precision |`,
  },
  {
    module_id: 18,
    title: "Virtual Emanation Point (VEP)",
    order: 2,
    content: `## Virtual Emanation Point (VEP)

### What is VEP?
The **Virtual Emanation Point** is a technique used when the actual transmitter location is **not directly receivable** by the sensor network — for example, due to terrain masking or skip propagation.

### How VEP Works
When an HF signal propagates via **ionospheric reflection (skywave)**, the signal appears to come from a point above the ionosphere, not from the ground transmitter. TLS measures the apparent source position in space — the Virtual Emanation Point.

\`\`\`
Ground Transmitter
       ↓ (skywave propagation)
  [Ionosphere] → reflected signal appears from VEP location
       ↓
  TLS Nodes receive signal as if from VEP
\`\`\`

### Correction Process
1. **Ionospheric model** is applied to convert VEP coordinates back to ground position
2. Model uses: ionospheric height (hmF2), electron density, time of day, solar flux
3. **Back-propagation**: trace ray path from VEP through ionosphere to ground

### VEP Accuracy Factors
| Factor | Effect |
|--------|--------|
| Ionospheric stability | Stable = better correction |
| HF frequency used | Higher freq = less refraction |
| Distance to transmitter | Longer path = more uncertainty |
| Time of day | Day/night ionosphere differs |

### When VEP is Used
- HF band targets (3–30 MHz) at long ranges
- Targets beyond radio line-of-sight
- Not needed for VHF/UHF (groundwave propagation only)

### Abbreviations
| Term | Meaning |
|------|---------|
| VEP | Virtual Emanation Point |
| HF | High Frequency (3–30 MHz) |
| hmF2 | Height of F2 ionospheric layer maximum |
| IRI | International Reference Ionosphere (standard model) |`,
  },
  {
    module_id: 18,
    title: "Transportable TLS Configuration",
    order: 3,
    content: `## Transportable TLS Configuration

### What is Transportable TLS?
The transportable variant of TLS is designed for **rapid deployment** in the field. All equipment fits in **vehicle-mounted or man-portable configurations** and can be set up within 30–60 minutes.

### Transportable Node Equipment
Each deployable node contains:
- Ruggedized node electronics (MIL-SPEC case)
- Collapsible VHF/UHF wideband antenna (mast-mounted)
- Portable GPS receiver
- Battery pack + solar panel option
- Encrypted radio or satellite modem for comms
- Laptop or tablet as local HMI

### Vehicle Integration
- Typically mounted in a **4×4 or HMMWV**
- Antenna mast deploys from vehicle roof
- Generator or vehicle power feed
- Node can operate while vehicle is stationary (survey required first)

### Deployment Steps
1. Drive to pre-planned site (selected during mission planning)
2. Level vehicle, deploy antenna mast
3. Allow GPS to acquire lock (3–5 min typically)
4. Power up node electronics
5. Establish comms link with CPS
6. Confirm node is **aligned** in CPS software (green status)
7. Begin operations

### Limitations vs Fixed TLS
| Aspect | Fixed TLS | Transportable TLS |
|--------|-----------|-------------------|
| Setup time | Days/weeks | 30–60 minutes |
| Antenna height | Tall tower (20m+) | Short mast (5–8m) |
| Coverage range | Longer | Shorter |
| Power | Mains/generator | Vehicle/battery |
| Survivability | Hardened site | Must relocate under threat |

### Abbreviations
| Term | Meaning |
|------|---------|
| MIL-SPEC | Military Specification |
| HMI | Human Machine Interface |
| HMMWV | High Mobility Multipurpose Wheeled Vehicle |`,
  },

  // ── Module 19: TLS Theory — TOA, DTOA, Software Folder Structure ─────────────
  {
    module_id: 19,
    title: "Time of Arrival (TOA) and TDOA Theory",
    order: 1,
    content: `## Time of Arrival (TOA) and TDOA Theory

### Time of Arrival (TOA)
**TOA** is the absolute time at which a signal wavefront reaches a sensor node. Since the signal travels at the speed of light (c ≈ 3×10⁸ m/s), the TOA depends on:
- Time of transmission
- Distance from emitter to node

\`\`\`
TOA_node = T_transmit + (distance / c)
\`\`\`

The problem: we don't know T_transmit.

### Time Difference of Arrival (TDOA)
By taking the **difference** between TOA at two nodes, the unknown transmit time cancels:

\`\`\`
TDOA₁₂ = TOA₁ - TOA₂ = (d₁ - d₂) / c
\`\`\`

Where d₁, d₂ are distances from emitter to nodes 1 and 2.

This TDOA defines a **hyperbola** in 2D space: all points where the difference of distances to two foci equals a constant.

### From TDOAs to Position
With nodes at known positions (x₁,y₁), (x₂,y₂), (x₃,y₃):
- TDOA₁₂ → Hyperbola H₁₂
- TDOA₁₃ → Hyperbola H₁₃
- Intersection of H₁₂ and H₁₃ = emitter position (x_e, y_e)

Mathematically solved using **nonlinear least squares** or **closed-form algorithms** (e.g., Chan, Fang).

### Cross-Correlation for TDOA Measurement
The TDOA is measured by **cross-correlating** the received signals:

\`\`\`
R₁₂(τ) = ∫ s₁(t) · s₂*(t + τ) dt
\`\`\`

The lag τ* at the peak of R₁₂ is the measured TDOA₁₂.

**GCC-PHAT** pre-whitens the signals to sharpen the correlation peak:
\`\`\`
R_PHAT(τ) = ∫ [S₁(f)·S₂*(f) / |S₁(f)·S₂*(f)|] · e^(j2πfτ) df
\`\`\`

### Accuracy Formula
Position error is related to TDOA measurement error (σ_TDOA) and geometry:

\`\`\`
σ_position ≈ (c · σ_TDOA) / GDOP_factor
\`\`\`

A σ_TDOA of 10 ns at c=3×10⁸ m/s → 3 m range difference error

### Abbreviations
| Term | Meaning |
|------|---------|
| TOA | Time of Arrival |
| TDOA | Time Difference of Arrival |
| DTOA | Differential Time of Arrival (same as TDOA) |
| GCC-PHAT | Generalized Cross-Correlation Phase Transform |
| SNR | Signal-to-Noise Ratio |`,
  },
  {
    module_id: 19,
    title: "DTOA Computation and Hyperbolic Geometry",
    order: 2,
    content: `## DTOA Computation and Hyperbolic Geometry

### What is DTOA?
**DTOA (Differential Time of Arrival)** is the same concept as TDOA — the measured time difference between signal arrival at two nodes. The term "DTOA" is used more in the TLS documentation while "TDOA" is the broader academic term.

### Hyperbolic Lines of Position
Each DTOA measurement defines a **hyperbola**:

\`\`\`
H₁₂: |d₁ - d₂| = c · DTOA₁₂ = constant
\`\`\`

Properties of the hyperbola:
- Two foci = the two node positions
- All emitter positions on this curve produce the same DTOA₁₂
- The emitter is on one branch of the hyperbola (we pick the physically valid one)

### Two-Node Pair = One Hyperbola
For a 3-node system (nodes A, B, C):
| Pair | DTOA | Hyperbola |
|------|------|-----------|
| A-B | DTOA_AB | H_AB |
| A-C | DTOA_AC | H_AC |
| B-C | DTOA_BC | H_BC (redundant, for accuracy) |

The position fix comes from the intersection of **at least 2 hyperbolas**.

### Effect of Node Geometry
The intersection angle between hyperbolas affects accuracy:
- **Perpendicular intersection** (90°) → best accuracy
- **Shallow intersection** (<20°) → large position uncertainty
- This is why node geometry (triangle vs line) matters so much

### Iterative Solution Process
1. Initial estimate using closed-form (Chan's algorithm)
2. Refine using **Taylor-series linearization** + **weighted least squares**
3. Apply **altitude constraint** if terrain map available

### Confidence Ellipse
The output is not just a point — it includes an **error ellipse** (2D Gaussian):
- Semi-major axis = along worst geometry direction
- Semi-minor axis = along best geometry direction
- Reported as CEP (radius containing 50% of fixes)

### Abbreviations
| Term | Meaning |
|------|---------|
| DTOA | Differential Time of Arrival |
| CEP | Circular Error Probable |
| WLS | Weighted Least Squares |`,
  },
  {
    module_id: 19,
    title: "Software Folder Structure and File Organization",
    order: 3,
    content: `## Software Folder Structure and File Organization

### TLS Software Overview
The TLS software suite runs on the Central Processing Station and includes several interacting modules. Understanding the folder structure helps operators and maintainers locate configuration files, logs, and recorded data.

### Typical Folder Structure
\`\`\`
/TLS/
├── bin/           — Executable files (tls_cps, tls_collector, tls_geo)
├── config/        — System configuration files
│   ├── nodes.xml       — Node positions, comms settings
│   ├── system.xml      — Global parameters (correlation window, freq bands)
│   └── display.xml     — Map and display settings
├── data/          — Operational data
│   ├── iq/             — Raw I/Q captures (large files)
│   ├── tdoa/           — Computed TDOA results
│   └── tracks/         — Emitter track files
├── logs/          — System logs
│   ├── system.log      — Startup, errors, warnings
│   ├── gps.log         — GPS status per node
│   └── comms.log       — Node link status
├── maps/          — Digital terrain/map data
│   ├── dted/           — DTED elevation data
│   └── vector/         — Vector map layers
├── scripts/       — Maintenance and utility scripts
└── reports/       — Exported ELINT reports
\`\`\`

### Key Configuration Files

**nodes.xml** — Critical file. Defines each node:
\`\`\`xml
<node id="1" name="ALPHA">
  <lat>24.7136</lat>
  <lon>46.6752</lon>
  <alt>620</alt>
  <ip>192.168.1.101</ip>
  <port>5000</port>
</node>
\`\`\`

**system.xml** — Global processing parameters:
- Correlation window length
- Frequency band settings
- Minimum SNR threshold
- Alert thresholds

### Log File Interpretation
| Log Entry | Meaning |
|-----------|---------|
| NODE_CONNECTED | Node link established |
| GPS_LOCKED | GPS sync confirmed |
| GPS_LOST | GPS sync failed — data invalid |
| TDOA_COMPUTED | Successful TDOA pair computed |
| FIX_GENERATED | Emitter position computed |
| FIX_FAILED | Insufficient data for fix |

### Data Management
- I/Q data: Very large (GB/hour) — auto-purge after 72h by default
- Track files: Retained for 30 days
- Logs: Retained for 90 days, then archived

### Abbreviations
| Term | Meaning |
|------|---------|
| XML | Extensible Markup Language (config file format) |
| DTED | Digital Terrain Elevation Data |
| SNR | Signal-to-Noise Ratio |`,
  },

  // ── Module 20: Survey, Calibration and Integrity Monitor ─────────────────────
  {
    module_id: 20,
    title: "Node Survey and Position Accuracy",
    order: 1,
    content: `## Node Survey and Position Accuracy

### Why Node Position Accuracy Matters
The geolocation algorithm uses node positions as reference points. If node positions are wrong, all calculated emitter positions will be systematically wrong.

**Position error propagation**:
- 10m error in node position → ~10m error in emitter position (at short range)
- 100m error in node position → potentially hundreds of meters error in fix

### Survey Methods

**1. GPS Survey (Standard)**
- Use differential GPS or survey-grade GPS receiver
- Occupy site for minimum **30 minutes** to average out errors
- Achieves: ±1–3m horizontal accuracy
- Equipment: Trimble, Leica, or equivalent survey GPS

**2. Differential GPS (DGPS)**
- Uses a known reference station to correct GPS errors
- Achieves: ±0.5–1m horizontal accuracy
- Requires a base station within 50–100 km

**3. Total Station Survey**
- Optical/electronic theodolite from a known control point
- Used when GPS is unavailable (under canopy, in buildings)
- Achieves: ±0.1m accuracy
- Time-consuming but most accurate

**4. Map-Based (Fallback Only)**
- Read coordinates from digital map
- Accuracy: ±5–20m depending on map scale
- Acceptable only for initial deployment, must be replaced

### Survey Data Entry
After survey, node coordinates (lat, lon, alt) are entered into **nodes.xml**:
\`\`\`
Node 1: 24°42'48.96"N, 46°40'30.72"E, Alt: 620m
\`\`\`
The system re-calculates all geometric baselines after coordinate update.

### Survey Requirements Table
| Method | Accuracy | Time Required | Equipment |
|--------|----------|---------------|-----------|
| Standard GPS | ±3m | 5 min | Handheld GPS |
| Survey GPS | ±1m | 30 min | Survey GPS receiver |
| DGPS | ±0.5m | 30 min | Base station + rover |
| Total Station | ±0.1m | 2 hours | Theodolite |

### Abbreviations
| Term | Meaning |
|------|---------|
| DGPS | Differential GPS |
| WGS84 | World Geodetic System 1984 (coordinate datum) |
| MSL | Mean Sea Level |
| AMSL | Above Mean Sea Level |`,
  },
  {
    module_id: 20,
    title: "System Calibration Procedures",
    order: 2,
    content: `## System Calibration Procedures

### What is TLS Calibration?
Calibration is the process of **verifying and correcting** the system's measurement accuracy using a transmitter at a **known position**. It detects timing offsets, cable delays, and systematic errors.

### Pre-Calibration Checks
Before calibration:
- All nodes must have **GPS lock** (≥4 satellites, HDOP < 2)
- All node comms links green
- Software started and nodes showing **ONLINE** status
- Reference transmitter available at known surveyed position

### Calibration Transmitter (CAL TX)
- A radio transmitter placed at a precisely surveyed location
- Transmits a known waveform (e.g., CW tone or known modulation)
- The system measures DTOA and computes the apparent position
- Compares computed position vs known position

### Calibration Process Steps
1. Operator enters CAL TX position in software
2. CAL TX begins transmission on calibration frequency
3. System measures DTOAs for all node pairs
4. Geolocation engine computes CAL TX position
5. System compares: **computed vs known**
6. Offset is stored as **calibration correction** per node pair
7. Corrections applied to all subsequent measurements

### Calibration Corrections
\`\`\`
TDOA_corrected = TDOA_measured - offset_correction
\`\`\`

Typical calibration corrections arise from:
- **Cable delay differences** between nodes (each cable has unique delay)
- **Receiver group delay** differences
- **Clock drift** between node GPS receivers

### Calibration Validity
- Recalibrate after: node movement, cable replacement, receiver swap
- Periodic recalibration: every 24 hours during sustained operations
- Calibration is valid as long as node positions and hardware unchanged

### Calibration Result Interpretation
| Result | Meaning |
|--------|---------|
| Error < 50m | Excellent calibration |
| Error 50–150m | Acceptable |
| Error 150–300m | Investigate — recheck node positions |
| Error > 300m | System fault — do not use |

### Abbreviations
| Term | Meaning |
|------|---------|
| CAL TX | Calibration Transmitter |
| HDOP | Horizontal Dilution of Precision |
| CW | Continuous Wave |`,
  },
  {
    module_id: 20,
    title: "Integrity Monitor",
    order: 3,
    content: `## Integrity Monitor

### Purpose of Integrity Monitoring
The Integrity Monitor is a **continuous self-test** subsystem that verifies the system is operating correctly and alerts operators to faults before they degrade mission performance.

### What the Integrity Monitor Checks

**Node Health Checks** (per node, every 1–5 seconds):
| Parameter | Check | Alert Threshold |
|-----------|-------|----------------|
| GPS lock | Satellites tracked | < 4 satellites |
| GPS accuracy | HDOP value | HDOP > 3 |
| Comms link | Round-trip latency | > 100ms |
| Signal level | Noise floor | Noise > -90 dBm |
| Temperature | Receiver temp | > 70°C |
| Storage | Disk space | < 10% free |

**System-Level Checks**:
| Check | Description |
|-------|-------------|
| TDOA consistency | All pairs consistent (no outliers) |
| Fix rate | Number of fixes per hour vs expected |
| Position scatter | How much fixes cluster (spread = problem) |
| Clock sync | Time sync between all nodes < 10 ns |

### Integrity Monitor Status Levels
| Status | Color | Meaning |
|--------|-------|---------|
| OPERATIONAL | Green | All checks pass |
| DEGRADED | Yellow | One or more non-critical warnings |
| MARGINAL | Orange | Performance reduced, use with caution |
| FAILED | Red | System fault — data unreliable |

### Integrity Monitor Alerts
When a fault is detected:
1. Audio/visual alarm at operator console
2. Fault logged in system.log
3. Affected node/pair flagged in display
4. Geolocation engine excludes faulted node pairs automatically

### Built-in Test (BIT)
The system performs:
- **IBIT (Initiated BIT)**: Manual full-system test before operations
- **PBIT (Power-on BIT)**: Automatic test on startup
- **CBIT (Continuous BIT)**: Ongoing monitoring during operations

### Abbreviations
| Term | Meaning |
|------|---------|
| BIT | Built-In Test |
| IBIT | Initiated Built-In Test |
| PBIT | Power-On Built-In Test |
| CBIT | Continuous Built-In Test |
| dBm | Decibels relative to 1 milliwatt |`,
  },

  // ── Module 21: Operations, Maintenance and Spares ────────────────────────────
  {
    module_id: 21,
    title: "Standard Operating Procedures",
    order: 1,
    content: `## Standard Operating Procedures

### System Startup Sequence
Follow this sequence every time the TLS is powered up:

**Step 1: Pre-Power Checks**
- Visually inspect all nodes — no physical damage
- Check all cable connections (antenna, GPS, comms, power)
- Verify generator/power available at all node sites

**Step 2: Power Up Nodes** (remote sites first)
1. Apply power to each node
2. Verify GPS acquisition (wait 3–5 min)
3. Confirm comms link GREEN in CPS
4. Check noise floor on each node receiver

**Step 3: CPS Startup**
1. Start TLS software suite
2. Verify all nodes show ONLINE
3. Run IBIT (full self-test)
4. Enter operational frequency range

**Step 4: Calibration**
1. Transmit from known CAL TX position
2. Verify calibration error < 150m
3. If OK, system is **OPERATIONAL**

**Step 5: Handover to Operators**
- Brief operators on current node status
- Confirm all nodes operational
- Start patrol/watch log

### Steady-State Operations
During operations, operators should:
- Monitor node status panel every **15 minutes**
- Log all alerts and system events
- Check GPS lock on all nodes hourly
- Review fix quality (CEP values) periodically

### System Shutdown Sequence
1. Export and save all track data
2. Generate and save final ELINT report
3. Shut down TLS software
4. Power down nodes in sequence
5. Disconnect power to prevent battery drain
6. Secure all equipment and cables

### Watch Handover Checklist
| Item | Check |
|------|-------|
| All nodes online | ✓ |
| GPS locked at all nodes | ✓ |
| Calibration valid (< 24h old) | ✓ |
| No unresolved alerts | ✓ |
| Log book updated | ✓ |
| System operational (green) | ✓ |

### Abbreviations
| Term | Meaning |
|------|---------|
| SOP | Standard Operating Procedure |
| IBIT | Initiated Built-In Test |
| CAL | Calibration |
| CEP | Circular Error Probable |`,
  },
  {
    module_id: 21,
    title: "Maintenance Procedures and Fault Isolation",
    order: 2,
    content: `## Maintenance Procedures and Fault Isolation

### Maintenance Categories

**1. Operator-Level Maintenance (1st Line)**
Operators can perform:
- Clean antennas and connectors
- Check cable connections
- Restart node software
- Replace batteries/fuses
- Basic visual inspection

**2. Technician-Level Maintenance (2nd Line)**
Trained technicians perform:
- Replace line-replaceable units (LRUs)
- Calibrate receivers
- Software updates
- Antenna SWR checks
- GPS receiver replacement

**3. Depot/Factory Maintenance (3rd Line)**
- Repair circuit boards
- Realign RF components
- Full system overhaul

### Fault Isolation Procedure

When a node goes fault:

**Step 1: Check power** — Is node receiving correct voltage?

**Step 2: Check comms link** — Can CPS ping the node?
- If NO: fault is in comms (cable, modem, or node network card)
- If YES: proceed to step 3

**Step 3: Check GPS** — Does node have GPS lock?
- If NO: check antenna, cable, receiver
- If YES: proceed to step 4

**Step 4: Check receiver** — Is noise floor normal?
- Noise floor normal + no detections = possible antenna fault
- Noise floor too high = interference or receiver fault
- Noise floor too low = LNA or cable fault

**Step 5: Replace LRU and retest**

### Common Faults and Solutions
| Fault | Likely Cause | Fix |
|-------|-------------|-----|
| Node offline | Comms cable cut | Replace cable |
| GPS not locking | Antenna blocked | Clear obstruction / replace GPS ant |
| High noise floor | Local RF interference | Relocate node or add filter |
| No TDOA on pair | Node timing error | Resync GPS, recalibrate |
| Low sensitivity | LNA failed | Replace LNA |

### Preventive Maintenance Schedule
| Task | Frequency |
|------|-----------|
| Antenna visual inspection | Weekly |
| Connector cleaning (contact spray) | Monthly |
| GPS antenna cable check | Monthly |
| Full IBIT | Before each operation |
| Receiver sensitivity check | Quarterly |
| Software update check | Quarterly |

### Abbreviations
| Term | Meaning |
|------|---------|
| LRU | Line Replaceable Unit |
| SWR | Standing Wave Ratio |
| LNA | Low Noise Amplifier |
| PM | Preventive Maintenance |`,
  },
  {
    module_id: 21,
    title: "Spare Parts and Supply Management",
    order: 3,
    content: `## Spare Parts and Supply Management

### Spare Parts Philosophy
TLS spare parts are managed according to a **two-level supply chain**:
1. **Unit-Level Stocks**: Critical LRUs held at the operational unit
2. **Depot-Level Stocks**: Full range held at maintenance depot

### Recommended Unit-Level Spares

**High Criticality (must have)**
| Item | Qty | Notes |
|------|-----|-------|
| GPS antenna (active) | 2 per node | Most common failure |
| GPS receiver module | 1 per system | Critical for timing |
| LNA module | 2 per node | High failure rate in hot climates |
| Coaxial cable assemblies | 4 | Connectors corrode in field |
| Power supply unit | 1 per node | Protects against power fault |
| Ethernet switch (managed) | 1 | CPS comms redundancy |

**Medium Criticality**
| Item | Qty | Notes |
|------|-----|-------|
| UPS battery pack | 1 per node | Replace every 2 years |
| Encrypted radio modem | 1 spare | For wireless comms nodes |
| Laptop/tablet (operator) | 1 | Operator console backup |
| SD card / SSD (data storage) | 2 | High write-cycle wear |

### Shelf Life and Storage
| Component | Shelf Life | Storage Condition |
|-----------|-----------|-------------------|
| Electronic modules | 10+ years | Cool, dry, ESD-protected |
| Batteries (Li-Ion) | 2–3 years | 15–25°C, 40% charge |
| Coaxial cables | 10 years | Avoid UV, coil loosely |
| Connectors | 5 years | Sealed, anti-corrosion |

### Part Numbering Convention
TLS parts follow the **NSN (NATO Stock Number)** system:
\`\`\`
4040-01-234-5678
│    │  └── Serial number
│    └── Country code (01=USA)
└── FSC (Federal Supply Class)
\`\`\`

### Ordering Procedure
1. Identify failed LRU and its part number
2. Check unit-level stock
3. If not in stock: raise **MILSTRIP** requisition
4. Expected lead time: 7–30 days for common items

### Recycling and Disposal
- Electronics: Return to depot for disposal per environmental regulations
- Batteries: Special disposal — do NOT put in regular waste
- Cables with connectors: Can be refurbished if undamaged

### Abbreviations
| Term | Meaning |
|------|---------|
| LRU | Line Replaceable Unit |
| NSN | NATO Stock Number |
| FSC | Federal Supply Class |
| MILSTRIP | Military Standard Requisitioning and Issue Procedures |
| ESD | Electrostatic Discharge |
| UPS | Uninterruptible Power Supply |`,
  },
];

async function seed() {
  console.log("Deleting old lessons...");
  await db.execute("DELETE FROM lessons");

  console.log(`Inserting ${lessons.length} lessons...`);
  for (const lesson of lessons) {
    await db.execute({
      sql: `INSERT INTO lessons (module_id, title, content, "order") VALUES (?, ?, ?, ?)`,
      args: [lesson.module_id, lesson.title, lesson.content, lesson.order],
    });
  }

  // Update lesson_count on each module
  console.log("Updating lesson_count on modules...");
  const moduleIds = [16, 17, 18, 19, 20, 21];
  for (const modId of moduleIds) {
    const result = await db.execute({
      sql: "SELECT COUNT(*) as cnt FROM lessons WHERE module_id=?",
      args: [modId],
    });
    const cnt = (result.rows[0] as any).cnt as number;
    await db.execute({
      sql: "UPDATE modules SET lesson_count=? WHERE id=?",
      args: [cnt, modId],
    });
    console.log(`  Module ${modId}: ${cnt} lessons`);
  }

  console.log("Done!");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
