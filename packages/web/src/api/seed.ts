import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { modules, questions, achievements } from "./database/schema";

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
const db = drizzle(client);

async function seed() {
  console.log("🌱 Seeding database...");

  // Clear existing modules & questions to re-seed with correct order
  await db.delete(questions);
  await db.delete(modules);

  // Modules — correct order matching PDF files
  await db.insert(modules).values([
    { id: 1, title: "INTRODUCTION", subtitle: "TLS System Introduction", description: "Introduction to the Transponder Landing System — system overview, components, signal flow, power requirements, and safety protocols.", icon: "📖", color: "#1e90ff", order: 1, lessonCount: 10 },
    { id: 2, title: "OVERVIEW", subtitle: "TLS System Overview", description: "Comprehensive overview of the TLS system — architecture, subsystems, operational concepts, and system capabilities.", icon: "📡", color: "#00d4ff", order: 2, lessonCount: 12 },
    { id: 3, title: "INSTALLATION", subtitle: "Site & Equipment Installation", description: "Step-by-step installation procedures — site preparation, antenna setup, cable routing, power connections, and initial system checks.", icon: "🔩", color: "#0080ff", order: 3, lessonCount: 14 },
    { id: 4, title: "OPERATION", subtitle: "System Operation Procedures", description: "Operational procedures — startup sequences, normal operations, monitoring, ATC integration, and emergency handling.", icon: "🎮", color: "#1e90ff", order: 4, lessonCount: 12 },
    { id: 5, title: "CALIBRATION", subtitle: "System Calibration", description: "Calibration procedures — signal alignment, frequency calibration, flight inspection requirements, and performance verification.", icon: "📐", color: "#00bfff", order: 5, lessonCount: 10 },
    { id: 6, title: "MAINTENANCE", subtitle: "Maintenance Procedures", description: "Maintenance schedules, fault diagnosis, BITE systems, component replacement, and preventive maintenance procedures.", icon: "🔧", color: "#0066cc", order: 6, lessonCount: 16 },
    { id: 7, title: "CONTAINER & DEPLOYMENT", subtitle: "Transport & Deployment", description: "Container specifications, deployment procedures, site survey requirements, rapid setup for field operations.", icon: "📦", color: "#0080ff", order: 7, lessonCount: 8 },
    { id: 8, title: "PACKING INSTRUCTIONS", subtitle: "Packing & Storage", description: "Packing procedures, storage requirements, transport configurations, and equipment protection protocols.", icon: "🗃️", color: "#1e90ff", order: 8, lessonCount: 6 },
    { id: 9, title: "ATC QUICK GUIDE", subtitle: "ATC Operating Guide", description: "Quick reference guide for Air Traffic Controllers — TLS operating procedures, phraseology, and coordination requirements.", icon: "🛫", color: "#ffaa00", order: 9, lessonCount: 6 },
  ]);

  // Questions — Module 1 (Introduction)
  await db.insert(questions).values([
    { moduleId: 1, question: "What does TLS stand for?", optionA: "Terminal Landing System", optionB: "Transponder Landing System", optionC: "Tactical Localizer System", optionD: "Track Landing Signal", correctOption: "b", explanation: "TLS stands for Transponder Landing System — a precision approach system that provides ILS-like guidance using the aircraft's transponder.", order: 1 },
    { moduleId: 1, question: "What is the primary purpose of the TLS system?", optionA: "Radar surveillance only", optionB: "Provide ILS-like precision approach guidance", optionC: "ATC communications", optionD: "Runway lighting control", correctOption: "b", explanation: "TLS provides ILS-equivalent lateral and vertical approach guidance to aircraft equipped with Mode C/S transponders.", order: 2 },
    { moduleId: 1, question: "What frequency band does TLS primarily operate in?", optionA: "HF (3–30 MHz)", optionB: "VHF (108–118 MHz)", optionC: "UHF (960–1215 MHz)", optionD: "SHF (3–30 GHz)", correctOption: "c", explanation: "TLS operates in the UHF band, using the aircraft's Mode C/S transponder for interrogation and response.", order: 3 },
    { moduleId: 1, question: "What is the primary advantage of TLS over conventional ILS?", optionA: "Lower cost of installation", optionB: "Portability and rapid deployment", optionC: "Higher signal frequency", optionD: "No need for FAA certification", correctOption: "b", explanation: "TLS can be rapidly deployed at airfields without permanent ILS infrastructure — a key advantage for military and temporary operations.", order: 4 },
    { moduleId: 1, question: "Which aircraft system does TLS interrogate?", optionA: "VOR receiver", optionB: "DME transponder", optionC: "SSR transponder (Mode C/S)", optionD: "TCAS unit", correctOption: "c", explanation: "TLS interrogates the aircraft's SSR transponder (Mode C or Mode S) to determine position and provide lateral/vertical guidance.", order: 5 },

    // Module 2 (Overview)
    { moduleId: 2, question: "What type of approach guidance does TLS provide?", optionA: "Lateral only (azimuth)", optionB: "Vertical only (elevation)", optionC: "Both lateral and vertical (full precision)", optionD: "Advisory only (non-precision)", correctOption: "c", explanation: "TLS provides full precision approach guidance — both lateral (localizer equivalent) and vertical (glide slope equivalent) guidance.", order: 1 },
    { moduleId: 2, question: "What is the ILS localizer frequency range?", optionA: "75 MHz", optionB: "108.1–111.95 MHz (odd decimals)", optionC: "329.15–335.00 MHz", optionD: "960–1215 MHz", correctOption: "b", explanation: "ILS localizer operates on VHF frequencies between 108.10 and 111.95 MHz, using channels with odd decimal tenths.", order: 2 },
    { moduleId: 2, question: "What is the ILS glide slope frequency range?", optionA: "108–112 MHz", optionB: "329.15–335.00 MHz", optionC: "75 MHz", optionD: "1030 MHz", correctOption: "b", explanation: "The ILS glide slope operates on UHF frequencies between 329.15 and 335.00 MHz, paired with localizer frequencies.", order: 3 },
    { moduleId: 2, question: "At what angle is a standard ILS glide slope set?", optionA: "2°", optionB: "3°", optionC: "5°", optionD: "7°", correctOption: "b", explanation: "Standard ILS glide slope angle is 3° above horizontal, though it can range from 2° to 4.5° depending on terrain and obstacles.", order: 4 },
    { moduleId: 2, question: "What frequency does the ILS outer marker operate on?", optionA: "110.0 MHz", optionB: "75 MHz", optionC: "330 MHz", optionD: "1090 MHz", correctOption: "b", explanation: "All ILS marker beacons (outer, middle, inner) operate on 75 MHz. They are distinguished by tone modulation frequency and light color.", order: 5 },

    // Module 3 (Installation)
    { moduleId: 3, question: "What DDM value defines the ILS glide path centerline?", optionA: "0.175 DDM", optionB: "0.0 DDM", optionC: "0.4 DDM", optionD: "0.25 DDM", correctOption: "b", explanation: "The glide path centerline is defined by 0.0 DDM (zero difference in depth of modulation between 90 Hz and 150 Hz signals).", order: 1 },
    { moduleId: 3, question: "The glide slope antenna is located:", optionA: "On the runway centerline at the threshold", optionB: "Offset from the runway, abeam the touchdown zone", optionC: "At the far end of the runway", optionD: "On top of the control tower", correctOption: "b", explanation: "The glide slope antenna is located beside the runway, typically 750–1250 feet from the threshold, offset laterally from centerline.", order: 2 },
    { moduleId: 3, question: "Which modulation frequency defines 'fly-up' on the glide slope?", optionA: "150 Hz dominates above path", optionB: "90 Hz dominates below path", optionC: "90 Hz dominates above path", optionD: "400 Hz carrier signal", correctOption: "c", explanation: "When 90 Hz dominates, the aircraft is above the glide path (fly-down). When 150 Hz dominates, the aircraft is below (fly-up).", order: 3 },

    // Module 4 (Operation)
    { moduleId: 4, question: "What is the SSR Mode A used for?", optionA: "Altitude reporting", optionB: "Aircraft identification", optionC: "Emergency only", optionD: "Traffic collision avoidance", correctOption: "b", explanation: "Mode A provides aircraft identification — a 4-digit octal squawk code assigned by ATC.", order: 1 },
    { moduleId: 4, question: "What is the SSR Mode C used for?", optionA: "Aircraft identification", optionB: "Pressure altitude reporting", optionC: "Emergency beacon", optionD: "Datalink communications", correctOption: "b", explanation: "Mode C provides pressure altitude information encoded in Gillham code, transmitted automatically.", order: 2 },
    { moduleId: 4, question: "What frequency does the SSR interrogator transmit on?", optionA: "1030 MHz", optionB: "1090 MHz", optionC: "960 MHz", optionD: "75 MHz", correctOption: "a", explanation: "SSR interrogators transmit on 1030 MHz. Aircraft transponders reply on 1090 MHz.", order: 3 },
    { moduleId: 4, question: "What is the transponder reply frequency?", optionA: "1030 MHz", optionB: "960 MHz", optionC: "1090 MHz", optionD: "1215 MHz", correctOption: "c", explanation: "All transponders (Mode A/C/S) reply on 1090 MHz regardless of the interrogation mode.", order: 4 },

    // Module 5 (Calibration)
    { moduleId: 5, question: "How often should a full ILS/TLS calibration flight be conducted?", optionA: "Daily", optionB: "Weekly", optionC: "Every 90 days (or per ANPC schedule)", optionD: "Only after major maintenance", correctOption: "c", explanation: "Full flight calibration is typically required every 90 days, or per the applicable ANPC/ICAO maintenance schedule.", order: 1 },
    { moduleId: 5, question: "What parameter is verified during ILS localizer calibration?", optionA: "Antenna height", optionB: "Course width and alignment", optionC: "Power supply voltage", optionD: "Transponder code", correctOption: "b", explanation: "Localizer calibration verifies course width, course alignment, and clearance signals to ICAO Annex 10 standards.", order: 2 },

    // Module 6 (Maintenance)
    { moduleId: 6, question: "What does BITE stand for in avionics maintenance?", optionA: "Basic Integrated Test Equipment", optionB: "Built-In Test Equipment", optionC: "Binary Input Terminal Engine", optionD: "Baseline Integrity Test Engine", correctOption: "b", explanation: "BITE stands for Built-In Test Equipment — self-diagnostic systems that continuously monitor equipment health.", order: 1 },
    { moduleId: 6, question: "What is the purpose of preventive maintenance?", optionA: "Fix faults after failure", optionB: "Prevent failures before they occur", optionC: "Reduce power consumption", optionD: "Upgrade software", correctOption: "b", explanation: "Preventive maintenance is scheduled work done to prevent failures, extend equipment life, and maintain performance standards.", order: 2 },

    // Module 7 (Container & Deployment)
    { moduleId: 7, question: "What is the primary advantage of a containerized TLS system?", optionA: "Lower power consumption", optionB: "Rapid deployment to forward locations", optionC: "Higher signal accuracy", optionD: "Reduced maintenance", correctOption: "b", explanation: "Containerized TLS systems can be rapidly transported and deployed to temporary or forward operating locations.", order: 1 },

    // Module 8 (Packing Instructions)
    { moduleId: 8, question: "What is the primary purpose of proper equipment packing?", optionA: "Reduce weight", optionB: "Protect equipment during transport and storage", optionC: "Improve signal performance", optionD: "Reduce cost", correctOption: "b", explanation: "Proper packing procedures protect sensitive TLS components from damage during transport, storage, and handling.", order: 1 },

    // Module 9 (ATC Quick Guide)
    { moduleId: 9, question: "ANPC stands for:", optionA: "Aviation Navigation Procedures Certification", optionB: "Air Navigation and Procedures Committee", optionC: "Advanced Navigation Precision Control", optionD: "Aviation and Navigation Procedures Commission", correctOption: "b", explanation: "ANPC stands for Air Navigation and Procedures Committee — the Saudi authority governing aviation navigation standards.", order: 1 },
    { moduleId: 9, question: "Who is responsible for ANPC certification in Saudi Arabia?", optionA: "GACA (General Authority of Civil Aviation)", optionB: "RSAF Technical Command", optionC: "Ministry of Transport", optionD: "ICAO directly", correctOption: "a", explanation: "GACA (General Authority of Civil Aviation) oversees ANPC certification standards in the Kingdom of Saudi Arabia.", order: 2 },
  ]);

  // Achievements
  await db.insert(achievements).values([
    { key: "first_lesson", name: "First Lesson", description: "Completed your first lesson", icon: "⚡", color: "#00ff88", xpReward: 50 },
    { key: "module_1_complete", name: "Introduction Complete", description: "Completed TLS Introduction", icon: "📖", color: "#1e90ff", xpReward: 200 },
    { key: "module_6_complete", name: "Maintenance Expert", description: "Completed Maintenance module", icon: "🔧", color: "#00d4ff", xpReward: 200 },
    { key: "module_9_complete", name: "ATC Ready", description: "Completed ATC Quick Guide", icon: "🛫", color: "#ffaa00", xpReward: 200 },
    { key: "all_modules", name: "Full Course", description: "Completed all 9 modules", icon: "🏆", color: "#ffaa00", xpReward: 500 },
    { key: "streak_7", name: "7-Day Streak", description: "Studied 7 days in a row", icon: "🔥", color: "#ff6b35", xpReward: 150 },
    { key: "streak_30", name: "30-Day Streak", description: "Studied 30 days in a row", icon: "💎", color: "#00d4ff", xpReward: 500 },
    { key: "anpc_certified", name: "ANPC Certified", description: "Aviation & Navigation Procedures", icon: "🏅", color: "#ffaa00", xpReward: 300 },
    { key: "ground_radar", name: "Ground Radar", description: "Ground Radar Systems Expert", icon: "🎯", color: "#00d4ff", xpReward: 250 },
    { key: "quiz_perfect", name: "Perfect Score", description: "100% on any quiz", icon: "⭐", color: "#ffaa00", xpReward: 100 },
  ]).onConflictDoNothing();

  console.log("✅ Seed complete!");
  console.log("   → 9 modules");
  console.log("   → 25 questions");
  console.log("   → 10 achievements");
}

seed().catch(console.error);
