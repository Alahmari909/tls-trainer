import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from "hono/cors";
import * as XLSX from 'xlsx';
import { eq, and, desc } from "drizzle-orm";
// AI SDK import removed — using direct Anthropic fetch instead
import { sendTelegram, getTelegramConfig, setTelegramConfig } from "./telegram";
import { db } from "./database";
import * as fflate from 'fflate';
import * as fs from 'fs';
import * as path from 'path';
import {
  modules, questions, achievements, userAchievements,
  moduleProgress, streaks, messages, users, sessions, quizAnswers,
} from "./database/schema";

// ── Raw SQL client (libsql) ───────────────────────────────────────────────────
const client = (db as any).$client as {
  execute(query: string | { sql: string; args: unknown[] }): Promise<{ rows: Record<string, unknown>[]; rowsAffected: number; lastInsertRowid?: unknown }>;
};

async function sql(query: string, args: unknown[] = []): Promise<Record<string, unknown>[]> {
  const r = await client.execute({ sql: query, args });
  return r.rows as Record<string, unknown>[];
}

async function sqlRun(query: string, args: unknown[] = []): Promise<void> {
  await client.execute({ sql: query, args });
}

async function logAudit(action: string, detail = '') {
  await sqlRun('INSERT INTO audit_log (action, detail, ts) VALUES (?, ?, ?)', [action, detail, Date.now()]).catch(() => {});
}

// One-time, resumable, idempotent migration: move base64 file_data out of the
// documents table into document_files, so list/metadata queries never traverse
// the blob's overflow-page chain (root cause of the documents 502 timeout).
async function migrateDocumentBlobs() {
  // id-only read (no blob/trailing-column access): docs whose blob isn't copied yet.
  const pending = await sql(
    `SELECT d.id AS id FROM documents d
     LEFT JOIN document_files f ON f.document_id = d.id
     WHERE f.document_id IS NULL`
  );
  let copied = 0;
  for (const r of pending as any[]) {
    const id = (r as any).id;
    try {
      await client.execute({
        sql: `INSERT OR IGNORE INTO document_files (document_id, file_data)
              SELECT id, file_data FROM documents WHERE id=?`,
        args: [id],
      });
      await client.execute({ sql: `UPDATE documents SET file_data='' WHERE id=?`, args: [id] });
      copied++;
      console.log(`[documents:migration] moved blob for id ${id}`);
    } catch (e) {
      console.error(`[documents:migration] failed id ${id}:`, e);
    }
  }
  // Crash-recovery: clear documents.file_data for any doc already copied (no blob read).
  try {
    await client.execute({
      sql: `UPDATE documents SET file_data='' WHERE id IN (SELECT document_id FROM document_files)`,
    });
  } catch (e) {
    console.error('[documents:migration] cleanup pass failed:', e);
  }
  if (copied) console.log(`[documents:migration] done: moved ${copied} document blob(s)`);
}

// ── Ensure new tables exist ───────────────────────────────────────────────────
async function ensureTables() {
  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS trainees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rank TEXT,
      unit TEXT,
      pin TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      last_login_at INTEGER DEFAULT 0,
      login_count INTEGER NOT NULL DEFAULT 0,
      is_online INTEGER NOT NULL DEFAULT 0,
      last_page TEXT DEFAULT '/',
      last_active_at INTEGER DEFAULT 0
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      event TEXT NOT NULL,
      detail TEXT,
      page TEXT,
      ts INTEGER NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      module_id INTEGER NOT NULL,
      module_name TEXT,
      score INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      correct INTEGER NOT NULL DEFAULT 0,
      wrong INTEGER NOT NULL DEFAULT 0,
      pct REAL NOT NULL DEFAULT 0,
      passed INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS instructor_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      note TEXT NOT NULL,
      author_id TEXT NOT NULL DEFAULT 'admin',
      ts INTEGER NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS trainee_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      sender_role TEXT NOT NULL DEFAULT 'admin',
      text TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS trainee_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      message TEXT NOT NULL,
      alert_type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS trainee_module_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      module_id INTEGER NOT NULL,
      module_name TEXT,
      progress REAL NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      assigned_by_admin INTEGER NOT NULL DEFAULT 0,
      last_accessed_at INTEGER NOT NULL DEFAULT 0
    )`);
    // Moderation: add status column if not exists (live data — ALTER only)
    await client.execute(`ALTER TABLE trainees ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`).catch(() => {});

    // ── Evaluation table ──
    await client.execute(`CREATE TABLE IF NOT EXISTS trainee_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL UNIQUE,
      rating TEXT NOT NULL DEFAULT 'pending',
      recommendation TEXT,
      technical_observations TEXT,
      admin_id TEXT NOT NULL DEFAULT 'admin',
      updated_at INTEGER NOT NULL DEFAULT 0
    )`);

    // ── Module time log (time spent per module) ──
    await client.execute(`CREATE TABLE IF NOT EXISTS module_time_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      module_id INTEGER NOT NULL,
      module_name TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL
    )`);

    // ── Manual view log ──
    await client.execute(`CREATE TABLE IF NOT EXISTS manual_view_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      manual_name TEXT NOT NULL,
      file_name TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL
    )`);

    // Add xp/level columns to trainees if missing
    await client.execute(`ALTER TABLE trainees ADD COLUMN xp INTEGER NOT NULL DEFAULT 0`).catch(() => {});
    await client.execute(`ALTER TABLE trainees ADD COLUMN level INTEGER NOT NULL DEFAULT 1`).catch(() => {});
    await client.execute(`ALTER TABLE trainees ADD COLUMN years_of_service INTEGER`).catch(() => {});
    await client.execute(`CREATE TABLE IF NOT EXISTS registration_requests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rank TEXT,
      unit TEXT,
      air_base TEXT,
      years_of_service INTEGER,
      pin TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      review_note TEXT,
      ts INTEGER NOT NULL,
      reviewed_at INTEGER
    )`).catch(() => {});
    await client.execute(`ALTER TABLE trainees ADD COLUMN air_base TEXT`).catch(() => {});
    await client.execute(`ALTER TABLE trainees ADD COLUMN avatar TEXT`).catch(() => {});
    await client.execute(`ALTER TABLE trainees ADD COLUMN avatar_pending TEXT`).catch(() => {});
    // Notification pin/delete support
    await client.execute(`ALTER TABLE trainee_alerts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`).catch(() => {});
    await client.execute(`ALTER TABLE trainee_alerts ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`).catch(() => {});
    await client.execute(`ALTER TABLE trainee_messages ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`).catch(() => {});
    await client.execute(`ALTER TABLE trainee_messages ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`).catch(() => {});
    await client.execute(`CREATE TABLE IF NOT EXISTS moderation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT,
      admin_id TEXT NOT NULL DEFAULT 'admin',
      ts INTEGER NOT NULL
    )`);
    // ── Group chat tables ──
    await client.execute(`CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room TEXT NOT NULL DEFAULT 'general',
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL DEFAULT 'trainee',
      text TEXT,
      attachment_id INTEGER,
      deleted INTEGER NOT NULL DEFAULT 0,
      deleted_by TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      pinned_by TEXT,
      pinned_at INTEGER,
      important INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS chat_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER,
      file_type TEXT NOT NULL DEFAULT 'file',
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL,
      ts INTEGER NOT NULL
    )`);
    // ── Backup table ──
    await client.execute(`CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      table_counts TEXT NOT NULL DEFAULT '{}',
      data TEXT NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS common_faults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      cause TEXT NOT NULL,
      solution TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS fault_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fault_id INTEGER NOT NULL,
      media_data TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      filename TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (fault_id) REFERENCES common_faults(id) ON DELETE CASCADE
    )`);
    // ── Error Codes table (TLS Maintenance Manual Table 3-7) ─────────────────
    await client.execute(`CREATE TABLE IF NOT EXISTS error_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      error_code TEXT NOT NULL,
      software_id TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      possible_reason TEXT NOT NULL DEFAULT '',
      solution TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    )`);
    // Seed error codes if empty
    const ecCount = await sql('SELECT COUNT(*) as n FROM error_codes');
    if ((ecCount[0] as any).n === 0) {
      const now = Date.now();
      const seed = [
        ['100','LM_ID_BAD_DATA_FILES','A settings file (approach, cal, limits, settings, or tilt data) has a checksum error','The .dat file generation was interrupted, or the base was not connected to the MIU','Ensure the configuration process is followed all the way to completion. Run Network Diagnostics and repair dropped connections. Reinstall .dat files from the archive. See 3.20.4 Base Computer Hardware/Software Fault Isolation'],
        ['101','LM_ID_DIFF_DATA_FILES','Checksum differs between CPU1 and CPU2 for a data file (approach, cal, survey, settings, monitor limits, or tilt)','The .dat file generation was interrupted, or the base was not connected to the MIU','Ensure configuration process is followed to completion. Run Network Diagnostics and repair dropped connections. Reinstall .dat files from archive. See 3.20.4 Base Computer Hardware/Software Fault Isolation'],
        ['102','LM_ID_BAD_HOSTS_FILE','A hosts file was not found on the computer','A host file was deleted, or the folder containing the host file changed','Ensure the path to the host file is correct. Reinstall hosts file. See SW installation instruction'],
        ['103','LM_ID_BAD_SERVICES_FILE','A services file was not found on the computer','The file was deleted, or the folder containing the services file changed','Ensure the path to the services file is correct. Reinstall services file. See SW installation instruction'],
        ['110','LM_ID_FAILED_INIT','Indicates a process initialization error','The network connection to the sensors may not be operating','Power on the ESA and ASA electronics. Ping the ESA and ASA. See 3.20.8 Measurement Sensor Fault Isolation'],
        ['111','LM_ID_REGISTER_CONTROL_PROCESS','There was a Process Registration error — possible problem with the operating system','Developmental message used by ANPC for troubleshooting','See 3.20.4.1 General Troubleshooting for Base1. See 3.20.4.2 General Troubleshooting for Base2'],
        ['112','LM_ID_CREATE_TIMER','System timer fault — possible problem with the operating system','Developmental message used by ANPC for troubleshooting','Contact ANPC for assistance. See 3.20.4.1 General Troubleshooting for Base1. See 3.20.4.2 General Troubleshooting for Base2'],
        ['120','LM_ID_CREATE_DIR','Directory creation error','The permissions to a folder may have been changed to read-only','Change the folder permissions to allow writing'],
        ['130','LM_ID_UNKNOWN_MESSAGE','A message was sent to a process that was unknown','Unknown cause — developmental message used by ANPC for troubleshooting','This message does not result in an alert or alarm, and no action is necessary to resolve this message'],
        ['140','LM_ID_VERSION_MISMATCH','The version of the software did not match','When the software boots, firmware revisions are checked on all devices and must match or continued operation is not possible','Install the same version of software on all devices. See SW installation instruction'],
        ['1001','LM_ID_HIGH_PHASE','CAL/BIT signal at the AOA sensor has phase measurement error exceeding tolerance for the indicated resolution','Change to ground surface conditions (grass height, snow accumulation); Change to antenna alignment; Change to AOA sensor electronics','Cut the grass / remove excess snow — See 3.5 C-3. Restore the antenna alignment — See 3.20.11 ESA Antenna Re-alignment. Replace the sensor electronics — See 3.21 LRU Replacement'],
        ['1002','LM_ID_MED_PHASE','CAL/BIT signal at the AOA sensor has medium phase measurement error exceeding tolerance','Change to ground surface conditions; Change to antenna alignment; Change to AOA sensor electronics','Cut the grass / remove excess snow — See 3.5 C-3. Restore the antenna alignment — See 3.20.11 ESA Antenna Re-alignment. Replace the sensor electronics — See 3.21 LRU Replacement'],
        ['1003','LM_ID_MED_PHASE_C','CAL/BIT signal at the AOA sensor has medium-C phase measurement error exceeding tolerance','Change to ground surface conditions; Change to antenna alignment; Change to AOA sensor electronics','Cut the grass / remove excess snow — See 3.5 C-3. Restore the antenna alignment — See 3.20.11 ESA Antenna Re-alignment. Replace the sensor electronics — See 3.21 LRU Replacement'],
        ['1004','LM_ID_LOW_PHASE','CAL/BIT signal at the AOA sensor has low phase measurement error exceeding tolerance','Change to ground surface conditions; Change to antenna alignment; Change to AOA sensor electronics','Cut the grass / remove excess snow — See 3.5 C-3. Restore the antenna alignment — See 3.20.11 ESA Antenna Re-alignment. Replace the sensor electronics — See 3.21 LRU Replacement'],
        ['1010','LM_ID_CHANA_FREQ','CAL/BIT signal has a frequency measurement that exceeds tolerance','An AOA sensor has a frequency measurement exceeding tolerance','If both AOA sensors have frequency alarm, replace the CAL/BIT. If one AOA sensor has a frequency alarm, replace the AOA sensor — See 3.21 LRU Replacement'],
        ['1020','LM_ID_AOA_LOW_PWR','CAL/BIT signal at an AOA sensor has an amplitude error (Low channel)','Change to ground surface conditions; Degraded cable attachment; Damaged antenna or water inside the antenna','Cut grass / remove excess snow — See 3.5.4 C-3. Repair or replace cable — See 3.14 C-12. Repair the antenna, drain water, repair mounting bracket — See 3.10 C-8 Antenna Maintenance'],
        ['1021','LM_ID_AOA_MED_PWR','CAL/BIT signal at an AOA sensor has an amplitude error (Medium channel)','Change to ground surface conditions; Degraded cable attachment; Damaged antenna or water inside the antenna','Cut grass / remove excess snow — See 3.5.4 C-3. Repair or replace cable — See 3.14 C-12. Repair the antenna — See 3.10 C-8 Antenna Maintenance'],
        ['1022','LM_ID_AOA_HIGH_PWR','CAL/BIT signal at an AOA sensor has an amplitude error (High channel)','Change to ground surface conditions; Degraded cable attachment; Damaged antenna or water inside the antenna','Cut grass / remove excess snow — See 3.5.4 C-3. Repair or replace cable — See 3.14 C-12. Repair the antenna — See 3.10 C-8 Antenna Maintenance'],
        ['1023','LM_ID_AOA_REF_PWR','CAL/BIT signal at an AOA sensor has an amplitude error (Reference channel)','Change to ground surface conditions; Degraded cable attachment; Damaged antenna or water inside the antenna','Cut grass / remove excess snow — See 3.5.4 C-3. Repair or replace cable — See 3.14 C-12. Repair the antenna — See 3.10 C-8 Antenna Maintenance'],
        ['1030','LM_ID_AOA_LOW_PWR_JTR','CAL/BIT signal at an AOA sensor has an amplitude jitter exceeding tolerance (Low channel)','There could be a reflective object in the critical area','Remove the reflector from the critical area — See 3.5.4 C-3 Maintenance of Critical Area'],
        ['1031','LM_ID_AOA_MED_PWR_JTR','CAL/BIT signal at an AOA sensor has an amplitude jitter exceeding tolerance (Medium channel)','There could be a reflective object in the critical area','Remove the reflector from the critical area — See 3.5.4 C-3 Maintenance of Critical Area'],
        ['1032','LM_ID_AOA_HIGH_PWR_JTR','CAL/BIT signal at an AOA sensor has an amplitude jitter exceeding tolerance (High channel)','There could be a reflective object in the critical area','Remove the reflector from the critical area — See 3.5.4 C-3 Maintenance of Critical Area'],
        ['1033','LM_ID_AOA_REF_PWR_JTR','CAL/BIT signal at an AOA sensor has an amplitude jitter exceeding tolerance (Reference channel)','There could be a reflective object in the critical area','Remove the reflector from the critical area — See 3.5.4 C-3 Maintenance of Critical Area'],
        ['1040','LM_ID_AOA_NOISE','AOA sensor noise level exceeds tolerance on the indicated channel','There could be a reflective object in the critical area','Remove the reflector from the critical area — See 3.5.4 C-3 Maintenance of Critical Area'],
        ['1050','LM_ID_AOA_LOW_PH_JTR','CAL/BIT signal at an AOA sensor has phase measurement jitter exceeding tolerance (Low channel)','There could be a reflective object in the critical area; vegetation on the edges of the critical area; AOA sensor electronics LRU failing','Remove the object / cut vegetation from the critical area — See 3.5.4 C-3. Replace the AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['1051','LM_ID_AOA_MED_PH_JTR','CAL/BIT signal at an AOA sensor has phase measurement jitter exceeding tolerance (Medium channel)','There could be a reflective object in the critical area; vegetation on the edges; AOA sensor electronics LRU failing','Remove the object / cut vegetation from the critical area — See 3.5.4 C-3. Replace the AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['1052','LM_ID_AOA_HIGH_PH_JTR','CAL/BIT signal at an AOA sensor has phase measurement jitter exceeding tolerance (High channel)','There could be a reflective object in the critical area; AOA sensor electronics LRU failing','Remove the object from the critical area — See 3.5.4 C-3. Replace the AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['1060','LM_ID_TOA_NEAR','CAL/BIT signal at an AOA sensor has a Near TOA value that exceeds tolerance','There could be a reflective object in the critical area','Remove the reflector from the critical area — See 3.5.4 C-3 Maintenance of Critical Area'],
        ['1061','LM_ID_TOA_FAR','CAL/BIT signal at an AOA sensor has a Far TOA value that exceeds tolerance','There could be a reflective object in the critical area','Remove the reflector from the critical area — See 3.5.4 C-3 Maintenance of Critical Area. Cut the vegetation that may be reflecting the signal'],
        ['1062','LM_ID_TOA_JTR','CAL/BIT signal at an AOA sensor has a TOA jitter value that exceeds tolerance','The F1 trigger pulse needs adjustment; there may be a reflective object in the critical area; AOA sensor electronics LRU may have failed','Adjust the F1 trigger pulse to the lowest TOA jitter value — See F1 Tuning. Remove the object from the critical area. Replace AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['1101','LM_ID_DEL_PH_HIGH','CAL/BIT signal at the AOA sensor has phase measurement difference between channels exceeding tolerance (High)','The sensor electronics has failed','Replace the sensor electronics — See 3.21 LRU Replacement'],
        ['1102','LM_ID_DEL_PH_MED','CAL/BIT signal at the AOA sensor has phase measurement difference between channels exceeding tolerance (Medium)','The sensor electronics has failed','Replace the sensor electronics — See 3.21 LRU Replacement'],
        ['1103','LM_ID_DEL_PH_LOW','CAL/BIT signal at the AOA sensor has phase measurement difference between channels exceeding tolerance (Low)','The sensor electronics has failed','Replace the sensor electronics — See 3.21 LRU Replacement'],
        ['1301','LM_ID_AOA_TEMP','An AOA sensor temperature has exceeded the tolerance','The AOA sensor cooling is off','Turn on the sensor cooling heat exchanger or A/C as appropriate'],
        ['1302','LM_ID_AOA_12V','An AOA sensor 12V power supply has failed','The power supply has reached the end of life','No action required unless a key performance parameter (TOA or Phase) fails. If a key parameter fails, replace the AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['1303','LM_ID_AOA_18V','An AOA sensor 18V power supply has failed','The power supply has reached the end of life','No action required unless a key performance parameter (TOA or Phase) fails. If a key parameter fails, replace the AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['1304','LM_ID_AOA_5V','An AOA sensor 5V power supply has failed','The power supply has reached the end of life','No action required unless a key performance parameter (TOA or Phase) fails. If a key parameter fails, replace the AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['1305','LM_ID_AOA_MINUS12V','An AOA sensor -12V power supply has failed','The power supply has reached the end of life','No action required unless a key performance parameter fails. Replace the AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['1306','LM_ID_AOA_MINUS5V','An AOA sensor -5V power supply has failed','The power supply has reached the end of life','No action required unless a key performance parameter fails. Replace the AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['1307','LM_ID_AOA_15VRF','An AOA sensor 15V RF power supply has failed','The power supply has reached the end of life','No action required unless a key performance parameter fails. Replace the AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['1308','LM_ID_AOA_5VRF','An AOA sensor 5V RF power supply has failed','The power supply has reached the end of life','No action required unless a key performance parameter fails. Replace the AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['1309','LM_ID_2PP3V','An AOA sensor 2.3V power supply has failed','The power supply has reached the end of life','No action required unless a key performance parameter fails. Replace the AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['1310','LM_ID_2V','An AOA sensor 2V power supply has failed','The power supply has reached the end of life','No action required unless a key performance parameter fails. Replace the AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['1350','LM_ID_TILT_PARA','The tilt sensor detected a parallel shift in the ESA tower position','The ESA tilt has changed due to anchor settling or changes to guy wire tension','Return the tower to original install condition by tensioning the guy wires — See 3.8 C-6 Check and adjust pay wire tension. Verify tilt sensors are operating normally'],
        ['1351','LM_ID_TILT_PERPEN','The tilt sensor detected a perpendicular shift in the ESA tower position','The ESA tilt has changed due to anchor settling or changes to guy wire tension','Return the tower to original install condition by tensioning the guy wires — See 3.8 C-6. Verify tilt sensors are operating normally'],
        ['1352','LM_ID_TILT_SELF_PARA','A tilt sensor self-test detected an error in the parallel sensor','The tilt sensor may be failing','Check cables for damage — See 3.14 C-12 Cable repair and waterproofing. Replace the tilt sensor with a spare — See 3.20.12 Tilt Sensor Fault Isolation'],
        ['1353','LM_ID_TILT_SELF_PERPEN','A tilt sensor self-test detected an error in the perpendicular sensor','The tilt sensor may be failing','Check cables for damage — See 3.14 C-12. Replace the tilt sensor with a spare — See 3.20.12 Tilt Sensor Fault Isolation'],
        ['1354','LM_ID_TILT_TEMP','A tilt sensor temperature is beyond limits','The tilt sensor cable may be damaged','Check cables for damage. This is not a critical failure — the system can continue to operate'],
        ['2001','LM_ID_TRK_AZ_UPDATE','Not enough azimuth measurement updates on the track','Aircraft transponder is off; lost line-of-sight to aircraft; transponder low gain/power output; synchronous garble interfered with transponder plot extraction','Ask the pilot to turn on the transponder. Ensure approach plate includes accurate notes about signal coverage. Verify the interrogator output is sufficient. Schedule a maintenance appointment for the aircraft. Enable side lobe suppression P2'],
        ['2002','LM_ID_TRK_EL_UPDATE','Not enough elevation measurement updates on the track','Aircraft transponder is off; lost line-of-sight; transponder low gain/power; synchronous garble interfered with plot extraction','Ask the pilot to turn on the transponder. Verify interrogator output is sufficient. Schedule maintenance appointment for the aircraft'],
        ['2003','LM_ID_TRK_RANGE_UPDATE','Not enough range measurement updates on the track','Aircraft transponder is off; lost line-of-sight to aircraft','Ask the pilot to turn on the transponder. Verify the interrogator output is sufficient'],
        ['2010','LM_ID_TRK_HYP_COMPARE','Track Hyperbolic measurement comparison failed','The calibration process has not been performed','Complete calibration process — See 020-00071'],
        ['2011','LM_ID_TRK_LOW_LOC_COMP','Error in the comparison to the Localizer low accuracy measurement','The calibration process has not been performed','Complete calibration process — See 020-00071'],
        ['2012','LM_ID_TRK_LOW_GS_COMP','Error in the comparison to the Glideslope low accuracy measurement','The calibration process has not been performed','Complete calibration process — See 020-00071'],
        ['2013','LM_ID_TRK_MEDIUM_HIGH','Structure jitter between medium and high accuracy measurements','The calibration process has not been performed','Complete calibration process — See 020-00071'],
        ['2020','LM_ID_TRK_AZ_ACC','Azimuth acceleration error — track jumped in azimuth','The calibration process has not been performed','Complete calibration process — See 020-00071'],
        ['2021','LM_ID_TRK_EL_ACC','Elevation acceleration error — track jumped in elevation','The calibration process has not been performed','Complete calibration process — See 020-00071'],
        ['2022','LM_ID_TRK_RANGE_ACC','Range acceleration error — track jumped in range','The calibration process has not been performed','Complete calibration process — See 020-00071'],
        ['2023','LM_ID_TRK_AZ_STRUCT','Structure jitter in the azimuth track exceeds tolerances','The calibration process has not been performed','Complete calibration process — See 020-00071'],
        ['2024','LM_ID_TRK_EL_STRUCT','Structure jitter in the elevation track exceeds tolerances','The calibration process has not been performed','Complete calibration process — See 020-00071'],
        ['2030','LM_ID_TRK_AZ_VOL','Azimuth volume alarm — aircraft flew out of azimuth service volume','The aircraft departed the service volume','This is an informational message; no corrective action is needed. The aircraft has departed the service volume'],
        ['2031','LM_ID_TRK_EL_VOL','Elevation volume alarm — aircraft flew out of elevation service volume','The aircraft departed the service volume','This is an informational message; no corrective action is needed'],
        ['2042','LM_ID_TRK_UPDATE_TIME','Time out on the update rate','The track consumed more time than the allowed interval','This is an informational message; no corrective action is needed'],
        ['2045','LM_ID_TRK_CAPACITY','System is at capacity for the number of tracks it can handle','More than 100 aircraft have been detected; the system will only track the closest 100 aircraft','This is an informational message; no corrective action is needed'],
        ['2046','LM_ID_MHT_CONFIDENCE','Software track process has low confidence level on the track','The calibration process has not been performed','Complete calibration process — See 020-00071'],
        ['2047','LM_ID_TRK_MISSED_AGREE','Mismatch on the differential TOA compare','The calibration process has not been performed','Complete calibration process — See 020-00071'],
        ['2048','LM_ID_TRK_PP_DROP','Pulse Processing track was dropped; algorithm could not associate more replies to the track','There were no updates for the track for more than the allowed interval','This is informational. The aircraft departed the service volume'],
        ['2049','LM_ID_TRK_COAST','Track count limit exceeded; no updates to the track for more than the allowed interval','The aircraft is no longer line-of-sight','No corrective action — the track count limit is a common information message in the base log'],
        ['2010','LM_ID_RCU_COMPARE (RCU)','The RCU integrity test of PAR track position failed','Integrity test failed due to a failed RCU','Replace the RCU — See 3.4.2 RCU Troubleshooting Procedures'],
        ['2011','LM_ID_RCU_TIMEOUT (RCU)','Lost the network connection to the RCU','The network path to the RCU was interrupted; the RCU may be counterfeited','Turn on the RCU. Reassign wireless link antenna — See RCU troubleshooting 3.20.13.1'],
        ['3010','LM_ID_ULBIT_DDM','GTU BIT DDM compare failed','The DDM difference between the transmitted value and the monitor value exceeded the tolerance','Complete the GTU calibration process — See 020-00071 4.13 GTU verification'],
        ['3011','LM_ID_ULBIT_SDM','GTU BIT SDM is out of range','The SDM has drifted and exceeds tolerance; this is a hardware fault','Replace the GTU — See 3.21 LRU Replacement'],
        ['3012','LM_ID_ULBIT_CARRIER','GTU BIT power is out of range','GTU power feedback loop recorded an increase or decrease in amplitude; cables may be loose or contain moisture','Clean and waterproof the cable connections. Replace the damaged cable — See 3.14 C-12 cable repair. See 3.11 C-9 GTU Fault Isolation'],
        ['3013','LM_ID_ULBIT_REFL_POWER','GTU BIT reflected power out of range','Cable connections may be loose or contain moisture; there may be damage to the antenna','Verify cable connections are clean, dry, and secured. Verify no physical damage to antenna. See 3.20.5 Guidance Transmitter Unit (GTU) Fault Isolation'],
        ['3020','LM_ID_ULBIT_TONE_DB','GTU BIT tone modulation out of range','The tone modulation hardware has drifted and cannot be repaired in the field','Replace the GTU'],
        ['3021','LM_ID_ULBIT_T0_Period','GTU BIT did not detect a T0 period; synch pulse failure','The T-Zero cable is disconnected or damaged','Connect or replace the T-Zero BSC cable to the GTU. See 3.20.5 GTU Fault Isolation'],
        ['3022','LM_ID_ULBIT_CPU_UPDATE','Self-test failure; GTU BIT did not detect a CPU update','The test of the dual dissimilar CPU integrity monitor failed','Verify all GTU cable connections are correct. See 3.20.5 GTU Fault Isolation'],
        ['3023','LM_ID_ULBIT_DDM_COMPARE','Self-test failure; GTU BIT did not detect a DDM compare failure','The test of the dual dissimilar CPU DDM compare failed','Verify all GTU cable connections are correct. See 3.20.5 GTU Fault Isolation'],
        ['3030','LM_ID_ULBIT_TEMP_INIT','GTU BIT internal temperature is out of range','The GTU temperature exceeded the monitor limit because shelter temperature is not controlled','Repair the ECU A/C or heater to return shelter temperature to normal operating ranges'],
        ['3031','LM_ID_ULBIT_TEMP_EXT','Temperature from the pressure sensor is beyond tolerance','The shelter environmental control unit (ECU) has failed; the pressure sensor has a faulty temperature sensor','Repair the heating or cooling units. Ensure all temperature mitigations are implemented. If ECU is within spec and temperature is minimal — replace the base unit. See 3.20.5 GTU Fault Isolation'],
        ['3040','LM_ID_ULBIT_5V','GTU 5V power supply out of range','The power supply has reached the end of life','If a key performance parameter (SDM, DDM, or output power) is in alarm, replace the GTU — See 3.21 LRU Replacement'],
        ['3041','LM_ID_ULBIT_15V','GTU 15V power supply out of range','The power supply has reached the end of life','If a key performance parameter is in alarm, replace the GTU — See 3.21 LRU Replacement'],
        ['3042','LM_ID_ULBIT_MINUS15V','GTU -15V power supply out of range','The power supply has reached the end of life','If a key performance parameter is in alarm, replace the GTU — See 3.21 LRU Replacement'],
        ['3043','LM_ID_ULBIT_LOC_24V','GTU Localizer 24V power supply out of range','The power supply has reached the end of life','If a key performance parameter is in alarm, replace the GTU — See 3.21 LRU Replacement'],
        ['3044','LM_ID_ULBIT_GS_24V','GTU Glide Slope 24V power supply out of range','The power supply has reached the end of life','If a key performance parameter is in alarm, replace the GTU — See 3.21 LRU Replacement'],
        ['3045','LM_ID_ULBIT_SUPPLY_BITS','Hardware failure; LRU needs service','The GTU has failed','Replace the GTU — See 3.21 LRU Replacement'],
        ['3050','LM_ID_ULBIT_TONE_CODE','GTU BIT tone output does not match commanded value','The GTU has failed','Replace the GTU — See 3.21 LRU Replacement'],
        ['3051','LM_ID_ULBIT_TONE_ON007','GTU BIT tone control BIT mismatch','The self-test of the GTU tone has failed','Replace the GTU — See 3.21 LRU Replacement'],
        ['3052','LM_ID_UPLINK_T0','T-zero synchronization signal failed at the GTU','T-zero cannot be detected on the GTU','Check the BIT T-zero connection. See 3.20.4.3 Base1 Timing Signal Fault Isolation'],
        ['3053','LM_ID_UPLINK_SWR','Too much signal reflected back from the antenna (standing wave ratio)','The antenna may be damaged; the cable may be damaged','Check for cable path damage. Replace or re-route cable. Replace the antenna'],
        ['3054','LM_ID_UPLINK_GTU_ID','ID mismatch; cannot distinguish the GTU ID','Communications fault with Base1 or Base2','Verify rack cable connections — See 3.20 Fault Isolation LRU Inspection'],
        ['3055','LM_ID_UPLINK_NO_DDM','One of the host computers did not provide a DDM value','Communications fault with Base1 or Base2','Verify rack cable connections. See 3.20 Fault Isolation LRU Inspection'],
        ['3056','LM_ID_UPLINK_DDM_NOMAT','The DDM value between the two CPUs did not match','Communications fault with Base1 or Base2','Verify rack cable connections. See 3.20 Fault Isolation LRU Inspection'],
        ['3057','LM_ID_UPLINK_FAILURE','The uplink software cannot determine why the glideslope is failing','Communications fault with Base1 or Base2','Verify rack cable connections. See 3.20 Fault Isolation LRU Inspection'],
        ['3060','LM_ID_UPLINK_NT_IO_ERR','Windows OS could not establish a communication port to the GTU','Communications fault with Base1 or Base2','Verify rack cable connections. See 3.20 Fault Isolation LRU Inspection'],
        ['3062','LM_ID_UPLINK_MORSECODE','A non-alphanumeric Morse code identifier was requested','Incorrect Morse code configuration — one or more characters cannot be broadcast using Morse code','Change the Morse code to a series of characters that can be broadcast using Morse code'],
        ['3070','LM_ID_ULMON_SDM','GTU Monitor SDM is out of range','Communications fault with Base1 or Base2','Replace the GTU — See 3.21 LRU Replacement'],
        ['3071','LM_ID_ULMON_DDM','GTU Monitor DDM compare failed','Communications fault with Base1 or Base2','Verify rack cable connections — See 3.20 Fault Isolation LRU Inspection'],
        ['3073','LM_ID_ULMON_DDM_VOLUME','GTU Monitor DDM volume edge not met','The GTU has not been calibrated or the calibration could be improved','Calibrate the GTU using a PIR — See 3.113 C-11 GTU verification'],
        ['4032','LM_ID_PHASE_SHIFT','A failure occurred in the Sensor PRM Phase discriminator','This is a BIT check of the PRM and is not field repairable','Replace the AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['4033','LM_ID_PHASE_STUCK_BIT','An RF channel on the AOA is not returning an expected value','This is a BIT check of the PRM and is not field repairable','Replace the AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['4034','LM_ID_PHASE_FIFO','A stuck bit was detected in the HW phase FIFO on the REV-A sensor','This is a BIT check of the PRM on the REV-A sensor and is not field repairable','Replace the AOA sensor electronics LRU — See 3.21 LRU Replacement'],
        ['5010','LM_ID_INT_P_WIDTH','Interrogator pulse width out of range','Interrogator self-test of pulse width is out of tolerance; hardware is failing (not adjustable in field)','Perform the interrogation control card test to isolate the cause to either the ICC or the interrogator — See 3.12 C-10 Interrogation transmitter check'],
        ['5011','LM_ID_P2_AMP','Interrogator P2 amplitude out of range','Interrogator self-test of amplitude for P2 is out of tolerance; hardware is failing','Perform the interrogation control card test — See 3.12 C-10 Interrogation transmitter check'],
        ['5020','LM_ID_INT_PIP2_SPACE','Interrogator P1/P2 spacing out of range','Interrogator self-test of P1/P2 spacing is out of tolerance; hardware is failing','Perform the interrogation control card test — See 3.12 C-10'],
        ['5021','LM_ID_INT_PIP3_SPACE','Interrogator P1/P3 spacing out of range','Interrogator self-test of P1/P3 spacing is out of tolerance; hardware is failing','Perform the interrogation control card test — See 3.12 C-10'],
        ['5030','LM_ID_INT_P1_P3_AMP','Interrogator P1/P3 amplitude out of range','Interrogator self-test of amplitude for P1 and P3 is out of tolerance; hardware is failing','Perform the interrogation control card test — See 3.12 C-10'],
        ['5032','LM_ID_INT_STATUS','Interrogator status bits indicate a failure','The interrogation control card is not properly installed or has failed','Replace or reseat the ICC card in Base1 — See 3.20.4.3 Base1 Timing Signal Fault Isolation'],
        ['5073','LM_ID_SENSOR_DATA_CHECKSUM','Corrupted data — the checksum at the base does not match what was sent from the sensor','A GTU file was changed intentionally or unintentionally; the checksum does not match','Retrieve the last good archive from the MIU. If a GTU file was changed intentionally and verified, run the checksum tool on the EU tool set to send to base to install the file'],
        ['6010','LM_ID_PRESSURE','General failure error on the pressure sensor','The pressure sensor communication cable is not connected; the pressure sensor power supply is not connected','Verify cables are connected. Verify the pressure sensor with a spare — See 3.21 LRU Replacement'],
        ['7001','LM_ID_UPS_SHUTDOWN','Software is shut down due to low battery minutes remaining on the UPS','The utility power is disconnected','Leave the system off until utility power is restored'],
        ['7010','LM_ID_RACK_SWITCH_STATUS','General failure error on the rack switch','The Rack Switch is powered off; Rack Switch cables are not connected; Rack Switch has failed','Power on the Rack Switch. Connect all cables to the Rack Switch. Replace the rack switch — See 3.22 Rackswitch troubleshooting'],
        ['8000','LM_ID_LRU_LINK_DOWN','Reports an RCU link failure','The RCU is not powered on; the RCU link is not powered on; the RCU cables are not connected','Power on the RCU. Power on the link for the RCU. Connect the RCU cables. See RCU troubleshooting 3.20.13.1'],
        ['8010','LM_ID_CPU_DISK_SPACE','CPU hard drive is full','Archives have filled up the drive; RAM collection was turned on and capturing too many files','Remove old archives or delete unused archives — See 3.1 C-1 Archive of data files. Turn off RAM collection in the MI settings. Remove non-TLS files'],
        ['8011','LM_ID_BASE_TEMPERATURE','The base temperature is out of tolerance','The shelter ECU has failed','Repair the heating or cooling units. Ensure temperature mitigations are implemented. If ECU is within spec and temperature is minimal — replace the base unit'],
        ['9001','LM_ID_NO_RECEIVER','No network receiver for the message','Developmental message used by ANPC for troubleshooting','This message does not result in an alert or alarm, and no action is necessary'],
        ['9002','LM_ID_NETWORK_MSG_ERR','Network message error','Developmental message used by ANPC for troubleshooting','This message does not result in an alert or alarm, and no action is necessary'],
        ['9003','LM_ID_BASE_TIME','Base Station time differs from a sensor','The clocks may not be synchronized','Use the SW tool Sync_clocks to synchronize the clocks — 020-00073 4.13 System software CPU clock synchronization'],
        ['9004','LM_ID_MULTIPLE_REPLIES','The sensor received multiple replies to an interrogation','More than one transponder is set to the code that was entered at the RCU','Ask the pilot to set a unique transponder code'],
        ['9005','LM_ID_INTERROG_TIMEOUT','An interrogation timeout occurred','Network cables are not connected properly','Verify all TLS components are powered on and can ping. Verify correct network cable connections. See 3.20.4.3 Base1 Timing Signal Fault Isolation LRU Inspection'],
        ['9006','LM_ID_INTERROG_TIMEOUT_NET','Network connection errors between LRUs','Network cables are not connected properly','Verify all TLS components are powered on and can ping. Verify network cable connections. See 3.20 Fault Isolation LRU Inspection'],
        ['9007','LM_ID_INTERROG_TIMEOUT_ESA','Interrogation timeout at the ESA','The fiber optic cable transmitting the T-zero pulse to the ESA is not connected','Verify connectivity of the T-zero fiber cable by tracing from the output of the ICC to the rack switch, to the interface panel, and finally at the sensor — See 3.20.4.3 Base1 Timing Signal Fault Isolation'],
        ['9008','LM_ID_INTERROG_TIMEOUT_LAOA','Interrogation timeout at the ASA','The fiber optic cable transmitting the T-zero pulse to the ASA is not connected','Verify connectivity of the T-zero fiber cable — See 3.20.4.3 Base1 Timing Signal Fault Isolation'],
        ['9009','LM_ID_INTERROG_TIMEOUT_INTERROG','Interrogation timeout at the Interrogator','The interrogation control card (ICC) is in the wrong slot; the RCC cables are not connected to the interrogator','Re-install the ICC in the correct slot. Verify connection of cables from the ICC to the interrogator — See 3.20.4.3 Base1 Timing Signal Fault Isolation'],
        ['9010','LM_ID_INTERROG_TIMEOUT_RETRY','Retrying the interrogation after a timeout','Network cables may not be connected properly','Verify all TLS components are powered on. Verify correct network cable connections'],
        ['9011','LM_ID_UNEXPECTED_MSG','An unexpected message was received by the base software','Unknown cause — developmental message used by ANPC for troubleshooting','This message does not result in an alert or alarm, and no action is necessary'],
      ];
      for (const [ec, sw, desc, reason, sol] of seed) {
        await sqlRun('INSERT INTO error_codes (error_code, software_id, description, possible_reason, solution, created_at) VALUES (?,?,?,?,?,?)',
          [ec, sw, desc, reason, sol, now]);
      }
    }
    // ── Simulator tables ──────────────────────────────────────────────────────
    await client.execute(`CREATE TABLE IF NOT EXISTS simulator_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS simulator_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      trainee_name TEXT,
      mode TEXT NOT NULL DEFAULT 'PAR',
      scenario_id INTEGER,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      duration_ms INTEGER,
      score INTEGER,
      passed INTEGER DEFAULT 0
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS simulator_scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      aircraft_count INTEGER NOT NULL DEFAULT 3,
      speed_multiplier REAL NOT NULL DEFAULT 1.0,
      weather TEXT NOT NULL DEFAULT 'clear',
      wind_speed INTEGER NOT NULL DEFAULT 0,
      wind_direction INTEGER NOT NULL DEFAULT 0,
      difficulty TEXT NOT NULL DEFAULT 'medium',
      pass_score INTEGER NOT NULL DEFAULT 70,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS simulator_aircraft_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      trainee_id TEXT,
      callsign TEXT,
      altitude_ft INTEGER,
      heading_deg INTEGER,
      event_type TEXT NOT NULL,
      ts INTEGER NOT NULL
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS simulator_broadcast (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      created_by TEXT NOT NULL DEFAULT 'admin',
      created_at INTEGER NOT NULL,
      expires_at INTEGER
    )`);
    await client.execute(`CREATE TABLE IF NOT EXISTS nav_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      href TEXT NOT NULL,
      icon TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_visible INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT 0
    )`);
    // Seed default nav items if empty
    const navRows = await sql(`SELECT id FROM nav_items LIMIT 1`);
    if (navRows.length === 0) {
      const defaults = [
        ['TLS Basic',      '/basics',       'BookOpen',      1],
        ['TLS Advanced',   '/advanced',     'Zap',           2],
        ['Quiz',           '/quiz',         'Crosshair',     3],
        ['Manuals',        '/manuals',      'FileText',      4],
        ['AI Instructor',  '/chat',         'MessageSquare', 5],
        ['Comms',          '/private-chat', 'MessageCircle', 6],
        ['RCU Simulator',  '/simulator',    'Monitor',       7],
        ['Common Faults',  '/faults',       'ShieldAlert',   8],
        ['Achievements',   '/achievements', 'Trophy',        9],
        ['Leaderboard',    '/leaderboard',  'BarChart',      10],
        ['Notifications',  '/notifications','Bell',          11],
        ['Settings',       '/settings',     'Settings',      12],
      ];
      for (const [label, href, icon, order] of defaults) {
        await sqlRun(`INSERT INTO nav_items (label, href, icon, sort_order, is_visible, created_at) VALUES (?,?,?,?,1,?)`,
          [label, href, icon, order, Date.now()]);
      }
    }
    // ── Error Code Media table ──────────────────────────────────────────────────
    await client.execute(`CREATE TABLE IF NOT EXISTS error_code_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      error_code_id INTEGER NOT NULL,
      media_data TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      filename TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (error_code_id) REFERENCES error_codes(id) ON DELETE CASCADE
    )`);
    // ── AI Conversations table ─────────────────────────────────────────────────
    await client.execute(`CREATE TABLE IF NOT EXISTS ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainee_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      ts INTEGER NOT NULL
    )`);

    // Ensure Error Codes nav item exists (added post-seed)
    const ecNavRow = await sql(`SELECT id FROM nav_items WHERE href='/error-codes' LIMIT 1`);
    if (ecNavRow.length === 0) {
      const maxOrd = await sql(`SELECT MAX(sort_order) as m FROM nav_items`);
      const nextOrd = ((maxOrd[0] as any)?.m ?? 12) + 1;
      await sqlRun(`INSERT INTO nav_items (label, href, icon, sort_order, is_visible, created_at) VALUES (?,?,?,?,1,?)`,
        ['Error Codes', '/error-codes', 'Search', nextOrd, Date.now()]);
    }
    // Default simulator config if not exists
    const cfgRows = await sql(`SELECT key FROM simulator_config WHERE key='enabled'`);
    if (cfgRows.length === 0) {
      const defaults = [
        ['enabled', 'true'],
        ['default_mode', 'PAR'],
        ['aircraft_count', '3'],
        ['speed_multiplier', '1.0'],
        ['weather', 'clear'],
        ['wind_speed', '0'],
        ['wind_direction', '0'],
        ['pass_score', '70'],
        ['difficulty', 'medium'],
      ];
      for (const [k, v] of defaults) {
        await sqlRun(`INSERT OR IGNORE INTO simulator_config (key, value) VALUES (?,?)`, [k, v]);
      }
    }
    await client.execute(`CREATE TABLE IF NOT EXISTS ai_doc_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      dir_name TEXT NOT NULL DEFAULT '',
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      indexed_at INTEGER NOT NULL
    )`).catch(() => {});
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_ai_chunks_fn ON ai_doc_chunks(filename)`).catch(() => {});
    // ── Documents table ──────────────────────────────────────────────────────
    await client.execute(`CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Technical',
      description TEXT NOT NULL DEFAULT '',
      pages INTEGER NOT NULL DEFAULT 0,
      file_data TEXT NOT NULL DEFAULT '',
      mime_type TEXT NOT NULL DEFAULT 'application/pdf',
      size INTEGER NOT NULL DEFAULT 0,
      share_mode TEXT NOT NULL DEFAULT 'all',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`).catch(() => {});
    // document_shares: per-trainee sharing when share_mode='specific'
    await client.execute(`CREATE TABLE IF NOT EXISTS document_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      trainee_id TEXT NOT NULL,
      UNIQUE(document_id, trainee_id)
    )`).catch(() => {});
    // document_files: blob storage separated from documents metadata so list
    // queries never scan giant base64 PDFs (see migrateDocumentBlobs).
    await client.execute(`CREATE TABLE IF NOT EXISTS document_files (
      document_id INTEGER PRIMARY KEY,
      file_data TEXT NOT NULL DEFAULT ''
    )`).catch(() => {});
    // Index on created_at so ORDER BY is fast without touching blob overflow pages
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC)`).catch(() => {});
    await client.execute(`CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      detail TEXT DEFAULT '',
      ts INTEGER NOT NULL
    )`).catch(() => {});
    console.log('[ensureTables] All tables ready');
    // Background, non-blocking: move existing blobs out of documents (idempotent).
    migrateDocumentBlobs().catch((e) => console.error('[documents:migration] error:', e));
    // Reset all is_online flags on startup — in-memory heartbeats are the source of truth
    await sqlRun(`UPDATE trainees SET is_online=0`);
    console.log('[startup] Cleared stale is_online flags');
    // Run scheduled auto-backups
    scheduleAutoBackups();
    scheduleOnlineSweep();
  } catch (e) {
    console.error("[ensureTables] error:", e);
  }
}
ensureTables();

// ── RAG helpers ───────────────────────────────────────────────────────────────
async function searchKnowledgeChunks(query: string, limit = 8): Promise<string[]> {
  const stopWords = new Set(['what','that','this','with','from','have','will','your','they','their',
    'ماهو','ماهي','كيف','ماذا','لماذا','هل','في','من','على','إلى','عن','مع']);
  const words = query.toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 6);
  if (words.length === 0) return [];
  const conditions = words.map(() => 'content LIKE ?').join(' OR ');
  const params = [...words.map(w => `%${w}%`), limit];
  return sql(`SELECT content FROM ai_doc_chunks WHERE ${conditions} LIMIT ?`, params)
    .then(rows => rows.map((r: any) => r.content as string))
    .catch(() => []);
}

function splitIntoChunks(text: string, size = 700, overlap = 120): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const chunk = cleaned.slice(start, start + size).trim();
    if (chunk.length > 60) chunks.push(chunk);
    start += size - overlap;
  }
  return chunks;
}


// ── Backup Engine ─────────────────────────────────────────────────────────────

// All tables to include in a full backup (excludes the backups table itself)
const BACKUP_TABLES = [
  'trainees', 'activity_log', 'quiz_attempts', 'instructor_notes',
  'trainee_messages', 'trainee_alerts', 'trainee_module_progress',
  'moderation_log', 'chat_messages', 'chat_attachments',
  'modules', 'questions', 'module_progress',
  'users', 'profiles', 'streaks', 'achievements', 'user_achievements',
  'sessions', 'messages',
];

async function dumpAllTables(): Promise<{ dump: Record<string, unknown[]>; counts: Record<string, number>; sizeBytes: number }> {
  const dump: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const table of BACKUP_TABLES) {
    try {
      const rows = await sql(`SELECT * FROM ${table}`);
      dump[table] = rows;
      counts[table] = rows.length;
    } catch {
      dump[table] = [];
      counts[table] = 0;
    }
  }
  const json = JSON.stringify(dump);
  return { dump, counts, sizeBytes: Buffer.byteLength(json, 'utf8') };
}

async function createBackup(label: string, note?: string): Promise<{ id: string; sizeBytes: number; counts: Record<string, number> }> {
  const { dump, counts, sizeBytes } = await dumpAllTables();
  const id = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  await sqlRun(
    `INSERT INTO backups (id, label, note, created_at, size_bytes, table_counts, data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, label, note ?? null, now, sizeBytes, JSON.stringify(counts), JSON.stringify(dump)]
  );
  console.log(`[backup] Created ${label} backup: ${id} (${(sizeBytes / 1024).toFixed(1)} KB)`);
  return { id, sizeBytes, counts };
}

async function pruneOldBackups() {
  // Keep last 7 daily, last 4 weekly, all manual + pre-restore
  for (const label of ['daily', 'weekly']) {
    const limit = label === 'daily' ? 7 : 4;
    const rows = await sql(`SELECT id FROM backups WHERE label=? ORDER BY created_at DESC`, [label]);
    const toDelete = rows.slice(limit);
    for (const r of toDelete) {
      await sqlRun(`DELETE FROM backups WHERE id=?`, [r.id]);
    }
  }
}

async function restoreFromBackup(backupId: string): Promise<{ ok: boolean; error?: string; tablesRestored: number }> {
  const [row] = await sql(`SELECT data, label FROM backups WHERE id=?`, [backupId]);
  if (!row) return { ok: false, error: 'Backup not found', tablesRestored: 0 };

  let dump: Record<string, unknown[]>;
  try { dump = JSON.parse(row.data as string); }
  catch { return { ok: false, error: 'Corrupt backup data', tablesRestored: 0 }; }

  // Create a pre-restore snapshot first
  await createBackup('pre-restore', `Auto-snapshot before restoring backup: ${backupId}`).catch(() => {});

  let tablesRestored = 0;
  for (const table of BACKUP_TABLES) {
    const rows = dump[table];
    if (!Array.isArray(rows)) continue;
    try {
      // Clear table (skip tables with FK constraints carefully)
      await sqlRun(`DELETE FROM ${table}`);
      // Re-insert all rows
      for (const r of rows) {
        const keys = Object.keys(r);
        if (!keys.length) continue;
        const cols = keys.join(', ');
        const placeholders = keys.map(() => '?').join(', ');
        const vals = keys.map(k => r[k]);
        await sqlRun(`INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`, vals);
      }
      tablesRestored++;
    } catch (e: any) {
      console.error(`[restore] Failed table ${table}:`, e?.message);
    }
  }
  // Reset online flags after restore
  await sqlRun(`UPDATE trainees SET is_online=0`).catch(() => {});
  return { ok: true, tablesRestored };
}

// ── Project Source ZIP Export ─────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(process.cwd(), '../..');

// Files/dirs to EXCLUDE from source export
const SOURCE_EXCLUDE = new Set([
  'node_modules', '.git', 'dist', '.turbo', 'dist-electron',
  '.DS_Store', 'bun.lock', '.env', // .env excluded — user must re-configure
]);

function shouldExclude(relativePath: string): boolean {
  const parts = relativePath.split('/');
  return parts.some(p => SOURCE_EXCLUDE.has(p));
}

async function buildProjectZip(): Promise<Uint8Array> {
  const files: fflate.AsyncZippable = {};

  function walkDir(dir: string, base: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (shouldExclude(rel)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(full, rel);
      } else if (entry.isFile()) {
        try {
          const data = fs.readFileSync(full);
          // Skip files > 50MB (e.g. huge PDFs) to keep ZIP sane
          if (data.length < 50 * 1024 * 1024) {
            files[`tls-trainer/${rel}`] = [data, { level: 1 }];
          }
        } catch { /* skip unreadable */ }
      }
    }
  }

  walkDir(PROJECT_ROOT, '');

  // Add .env.template as a reminder (not the actual .env)
  const envTemplate = `# TLS Trainer Environment — fill in your values
NODE_ENV=production
DATABASE_URL=
DATABASE_AUTH_TOKEN=
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
AI_GATEWAY_BASE_URL=
AI_GATEWAY_API_KEY=
ANTHROPIC_API_KEY=
BETTER_AUTH_SECRET=
ADMIN_PASSWORD=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_ENABLED=false
WEBSITE_URL=
`;
  files['tls-trainer/.env.example'] = [Buffer.from(envTemplate), { level: 1 }];

  return new Promise((resolve, reject) => {
    fflate.zip(files, { comment: `TLS-Trainer project export — ${new Date().toISOString()}` }, (err, data) => {
      if (err) reject(err); else resolve(data);
    });
  });
}

// ── Migration Package (DB + Source + Manifest) ────────────────────────────────

async function buildMigrationPackage(): Promise<Uint8Array> {
  const files: fflate.AsyncZippable = {};
  const now = new Date().toISOString();

  // 1. Full DB dump as JSON
  const { dump, counts, sizeBytes } = await dumpAllTables();
  const dbDump = JSON.stringify({
    meta: { exported_at: Date.now(), version: 'TLS-Trainer-v1', table_counts: counts, db_size_bytes: sizeBytes },
    data: dump,
  }, null, 2);
  files['migration/database/tls-database.json'] = [Buffer.from(dbDump), { level: 6 }];

  // 2. SQL insert dump
  const sqlLines: string[] = [
    '-- TLS Trainer Database Migration SQL',
    `-- Exported: ${now}`,
    `-- Version: TLS-Trainer-v1`,
    `-- Run against a fresh SQLite/libSQL instance after applying schema migrations`,
    '',
  ];
  for (const [table, rows] of Object.entries(dump)) {
    sqlLines.push(`-- Table: ${table} (${(rows as unknown[]).length} rows)`);
    sqlLines.push(`DELETE FROM "${table}";`);
    for (const row of rows as Record<string, unknown>[]) {
      const keys = Object.keys(row);
      if (!keys.length) continue;
      const cols = keys.map(k => `"${k}"`).join(', ');
      const vals = keys.map(k => {
        const v = row[k];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
      }).join(', ');
      sqlLines.push(`INSERT OR REPLACE INTO "${table}" (${cols}) VALUES (${vals});`);
    }
    sqlLines.push('');
  }
  files['migration/database/tls-database.sql'] = [Buffer.from(sqlLines.join('\n')), { level: 6 }];

  // 3. Chat attachments manifest (base64 files embedded in DB; list them)
  const attachments = dump['chat_attachments'] ?? [];
  const attachManifest = (attachments as Record<string,unknown>[]).map(a => ({
    id: a.id, file_name: a.file_name, mime_type: a.mime_type,
    file_type: a.file_type, size: a.size, ts: a.ts,
    note: 'File data embedded in tls-database.json → chat_attachments.data (base64)',
  }));
  files['migration/files/attachments-manifest.json'] = [Buffer.from(JSON.stringify(attachManifest, null, 2)), { level: 6 }];

  // 4. Source code (same as project zip)
  function walkDir(dir: string, base: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (shouldExclude(rel)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(full, rel);
      } else if (entry.isFile()) {
        try {
          const data = fs.readFileSync(full);
          if (data.length < 50 * 1024 * 1024) {
            files[`migration/source/${rel}`] = [data, { level: 1 }];
          }
        } catch { /* skip */ }
      }
    }
  }
  walkDir(PROJECT_ROOT, '');

  // 5. Migration README
  const readme = `# TLS Trainer Migration Package
Generated: ${now}

## Contents
- \`database/tls-database.json\`  — Full DB dump (all tables, JSON format)
- \`database/tls-database.sql\`   — SQL INSERT statements for all tables
- \`files/attachments-manifest.json\` — List of uploaded files (data in DB)
- \`source/\`                     — Full project source code (no node_modules)

## How to Restore

### Database (Turso / libSQL)
1. Create a new Turso database
2. Apply schema: \`cd packages/web && bun run db:push\`
3. Import data via the Admin Panel → Backup → "Import from File"
   OR run the SQL file against your database

### Source Code
1. \`cd migration/source && bun install\`
2. Copy \`.env.example\` to \`.env\` and fill in your credentials
3. \`bun run dev\`

### Files (Chat Attachments)
All file data is embedded as base64 in \`tls-database.json\` under \`chat_attachments.data\`.
They will be automatically restored when you import the database.

## Version Info
- Project: TLS Trainer
- DB Version: TLS-Trainer-v1
- Tables: ${Object.keys(counts).join(', ')}
- Total rows: ${Object.values(counts).reduce((a, b) => a + b, 0)}
`;
  files['migration/README.md'] = [Buffer.from(readme), { level: 6 }];

  return new Promise((resolve, reject) => {
    fflate.zip(files, { comment: `TLS-Trainer migration package — ${now}` }, (err, data) => {
      if (err) reject(err); else resolve(data);
    });
  });
}

// ── Restore from uploaded file ─────────────────────────────────────────────────

async function restoreFromJSON(jsonData: string): Promise<{ ok: boolean; error?: string; tablesRestored: number }> {
  let bundle: { meta?: unknown; data: Record<string, unknown[]> };
  try {
    bundle = JSON.parse(jsonData);
  } catch {
    return { ok: false, error: 'Invalid JSON', tablesRestored: 0 };
  }

  const dump = bundle.data;
  if (!dump || typeof dump !== 'object') {
    return { ok: false, error: 'Missing data field in backup JSON', tablesRestored: 0 };
  }

  // Auto-snapshot before restore
  await createBackup('pre-restore', `Auto-snapshot before file import restore`).catch(() => {});

  let tablesRestored = 0;
  for (const table of BACKUP_TABLES) {
    const rows = dump[table];
    if (!Array.isArray(rows)) continue;
    try {
      await sqlRun(`DELETE FROM "${table}"`);
      for (const r of rows) {
        const keys = Object.keys(r);
        if (!keys.length) continue;
        const cols = keys.map(k => `"${k}"`).join(', ');
        const placeholders = keys.map(() => '?').join(', ');
        await sqlRun(`INSERT OR REPLACE INTO "${table}" (${cols}) VALUES (${placeholders})`, keys.map(k => r[k]));
      }
      tablesRestored++;
    } catch (e: any) {
      console.error(`[restore-file] Failed table ${table}:`, e?.message);
    }
  }
  await sqlRun(`UPDATE trainees SET is_online=0`).catch(() => {});
  return { ok: true, tablesRestored };
}

// ── Auto-backup scheduler ─────────────────────────────────────────────────────
function scheduleAutoBackups() {
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY  = 24 * ONE_HOUR;
  const ONE_WEEK = 7 * ONE_DAY;

  // Daily backup — run after 1 min delay on startup, then every 24h
  setTimeout(async () => {
    await createBackup('daily', 'Automatic daily backup').catch(e => console.error('[auto-backup] daily failed:', e));
    await pruneOldBackups().catch(() => {});
    setInterval(async () => {
      await createBackup('daily', 'Automatic daily backup').catch(e => console.error('[auto-backup] daily failed:', e));
      await pruneOldBackups().catch(() => {});
    }, ONE_DAY);
  }, 60_000);

  // Weekly backup — run after 2 min delay, then every 7 days
  setTimeout(async () => {
    await createBackup('weekly', 'Automatic weekly backup').catch(e => console.error('[auto-backup] weekly failed:', e));
    setInterval(async () => {
      await createBackup('weekly', 'Automatic weekly backup').catch(e => console.error('[auto-backup] weekly failed:', e));
    }, ONE_WEEK);
  }, 120_000);

  console.log('[backup] Auto-backup scheduler started');
}

// ── Ghost-user sweep ──────────────────────────────────────────────────────────
// Every 2 minutes, remove stale heartbeats and clear is_online in DB.
// Prevents ghost "online" users after crash/disconnect/reload without logout.
function scheduleOnlineSweep() {
  setInterval(async () => {
    const now = Date.now();
    const staleIds: string[] = [];
    for (const [id, ts] of onlineHeartbeats.entries()) {
      if (now - ts > ONLINE_THRESHOLD_MS) {
        onlineHeartbeats.delete(id);
        staleIds.push(id);
      }
    }
    if (staleIds.length) {
      for (const id of staleIds) {
        await sqlRun(`UPDATE trainees SET is_online=0 WHERE id=?`, [id]).catch(() => {});
      }
      console.log(`[online-sweep] Cleared ${staleIds.length} stale user(s): ${staleIds.join(', ')}`);
    }
  }, 2 * 60 * 1000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

async function logActivity(traineeId: string, event: string, detail?: object, page?: string) {
  try {
    await sqlRun(
      `INSERT INTO activity_log (trainee_id, event, detail, page, ts) VALUES (?, ?, ?, ?, ?)`,
      [traineeId, event, detail ? JSON.stringify(detail) : null, page ?? null, Date.now()]
    );
    await sqlRun(`UPDATE trainees SET last_active_at=?, last_page=? WHERE id=?`,
      [Date.now(), page ?? null, traineeId]);
  } catch { /* non-fatal */ }
}

// ── In-memory online tracker ──────────────────────────────────────────────────
// Source of truth for "is this user currently active in this server process"
const onlineHeartbeats = new Map<string, number>();

// How long without a heartbeat before we consider someone offline
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;  // 5 minutes

// ── Telegram cooldown ─────────────────────────────────────────────────────────
// Prevents re-sending login/online alerts within the cooldown window.
// This is the PRIMARY guard against spam — covers app-switch, refresh, reconnect.
const telegramCooldowns = new Map<string, number>();
const TELEGRAM_LOGIN_COOLDOWN_MS  = 15 * 60 * 1000; // 15 min — real login
const TELEGRAM_ONLINE_COOLDOWN_MS = 10 * 60 * 1000; // 10 min — came back online

function canSendTelegram(userId: string, eventType: string): boolean {
  if (userId === "unknown") return true;
  const key = `${userId}:${eventType}`;
  const last = telegramCooldowns.get(key);
  const threshold = eventType === "status_change_online"
    ? TELEGRAM_ONLINE_COOLDOWN_MS
    : TELEGRAM_LOGIN_COOLDOWN_MS;
  return last === undefined || Date.now() - last > threshold;
}

function markTelegramSent(userId: string, ...eventTypes: string[]) {
  const now = Date.now();
  for (const t of eventTypes) {
    telegramCooldowns.set(`${userId}:${t}`, now);
  }
}

function isOnline(id: string): boolean {
  const last = onlineHeartbeats.get(id);
  return last !== undefined && Date.now() - last < ONLINE_THRESHOLD_MS;
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "TLS319522";

// ── Rate Limiter ──────────────────────────────────────────────────────────────
// In-memory store: ip -> { count, resetAt }
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitRule {
  windowMs: number;   // time window in ms
  max: number;        // max requests per window
  message?: string;
}

function getClientIp(c: any): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

function rateLimit(rule: RateLimitRule) {
  return async (c: any, next: () => Promise<void>) => {
    const ip = getClientIp(c);
    const key = `${ip}:${c.req.path}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + rule.windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > rule.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return c.json(
        { error: rule.message ?? "Too many requests — try again later", retryAfter },
        429
      );
    }

    return next();
  };
}

// Clean up old entries every 10 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitStore.entries()) {
    if (now > val.resetAt) rateLimitStore.delete(key);
  }
}, 10 * 60 * 1000);

// ── App ───────────────────────────────────────────────────────────────────────
const app = new Hono()
  .basePath('api')
  // ── Layer 3: CORS — restrict to allowed origins only ──────────────────────
  .use(cors({
    origin: (origin) => {
      const ALLOWED_ORIGINS = [
        "https://templateweb-production-16cb.up.railway.app",
        "http://localhost:4200",
        "http://localhost:3000",
      ];
      return ALLOWED_ORIGINS.includes(origin ?? "") ? origin : ALLOWED_ORIGINS[0];
    },
    credentials: true,
    exposeHeaders: ["set-auth-token"],
  }))
  // ─────────────────────────────────────────────────────────────────────────
  // Global rate limit: 300 requests / minute per IP (anti-DDoS)
  .use(rateLimit({ windowMs: 60 * 1000, max: 300, message: "Rate limit exceeded — slow down" }))
  .get('/ping', (c) => c.json({ message: `Pong! ${Date.now()}` }, 200))
  
  .get('/health', (c) => c.json({ status: 'ok' }, 200))
  .get("/health/db", async (c) => {
    try {
      const t0 = Date.now();
      await sql('SELECT 1', []);
      return c.json({ ok: true, latency: Date.now() - t0 }, 200);
    } catch {
      return c.json({ ok: false, latency: null }, 500);
    }
  })

  // ══════════════════════════════════════════════════════════════════════════
  // TRAINEE AUTH
  // ══════════════════════════════════════════════════════════════════════════

  // POST /trainee/register — saves as pending request, requires admin approval
  .post('/trainee/register', async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      name?: string; rank?: string; unit?: string; air_base?: string; years_of_service?: number; pin?: string;
    };
    if (!body.name?.trim()) return c.json({ error: 'Name required' }, 400);
    if (!body.pin?.trim()) return c.json({ error: 'PIN required' }, 400);
    const id = uuid();
    const now = Date.now();
    await sqlRun(
      `INSERT INTO registration_requests (id, name, rank, unit, air_base, years_of_service, pin, status, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [id, body.name.trim(), body.rank ?? null, body.unit ?? null, body.air_base ?? null, body.years_of_service ?? null, body.pin.trim(), now]
    );
    sendTelegram({ type: "admin_alert", message: `📋 طلب تسجيل جديد: ${body.name.trim()} — بانتظار موافقة الأدمن` });
    return c.json({ ok: true, pending: true, requestId: id }, 200);
  })

  // POST /trainee/login — Rate limited: 10 attempts / 5 min per IP
  .post('/trainee/login', rateLimit({ windowMs: 5 * 60 * 1000, max: 10, message: "Too many login attempts — wait 5 minutes" }), async (c) => {
    const body = await c.req.json().catch(() => ({})) as { id?: string; name?: string; pin?: string };

    type TraineeRow = { id: string; name: string; rank: string | null; unit: string | null; pin: string | null; login_count: number; status: string | null };

    let rows: TraineeRow[];
    if (body.id) {
      rows = await sql(
        `SELECT id, name, rank, unit, pin, login_count, status FROM trainees WHERE id=?`, [body.id]
      ) as TraineeRow[];
    } else if (body.name && body.name.trim()) {
      rows = await sql(
        `SELECT id, name, rank, unit, pin, login_count, status FROM trainees WHERE LOWER(TRIM(name))=LOWER(TRIM(?))`, [body.name.trim()]
      ) as TraineeRow[];
    } else {
      return c.json({ error: 'الاسم مطلوب' }, 400);
    }
    if (!rows.length) return c.json({ error: 'الاسم أو رمز الدخول غير صحيح' }, 404);

    // If several trainees share the same name, disambiguate by PIN
    let t: TraineeRow;
    if (rows.length === 1) {
      t = rows[0];
    } else {
      const match = rows.find(r => r.pin && r.pin === body.pin);
      if (!match) return c.json({ error: 'الاسم أو رمز الدخول غير صحيح' }, 401);
      t = match;
    }

    // Block gate — blocked trainees cannot log in
    if (t.status === 'blocked') return c.json({ error: 'blocked', message: 'تم إيقاف حسابك. تواصل مع المدرب.' }, 403);
    if (t.status === 'suspended') return c.json({ error: 'suspended', message: 'حسابك معلّق مؤقتاً. تواصل مع المدرب.' }, 403);

    // PIN check only if PIN was set
    if (t.pin && body.pin !== t.pin) return c.json({ error: 'رمز الدخول غير صحيح' }, 401);

    const now = Date.now();
    await sqlRun(
      `UPDATE trainees SET last_login_at=?, login_count=login_count+1, is_online=1, last_active_at=? WHERE id=?`,
      [now, now, t.id]
    );
    onlineHeartbeats.set(t.id, now);
    await logActivity(t.id, 'login');
    if (canSendTelegram(t.id, "login")) {
      markTelegramSent(t.id, "login");
      markTelegramSent(t.id, "site_open"); // reset site_open cooldown too on real login
      markTelegramSent(t.id, "status_change_online");
      sendTelegram({ type: "login", traineeId: t.id, traineeName: t.name });
    }

    return c.json({ ok: true, id: t.id, name: t.name, rank: t.rank, unit: t.unit }, 200);
  })

  // POST /trainee/update — trainee updates their own display name/rank/unit
  .post('/trainee/update', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { id?: string; name?: string; rank?: string; unit?: string; years_of_service?: number; air_base?: string };
    if (!body.id) return c.json({ error: 'id required' }, 400);
    const rows = await sql(`SELECT id FROM trainees WHERE id=?`, [body.id]);
    if (!rows.length) return c.json({ error: 'Not found' }, 404);
    const name = body.name?.trim() || undefined;
    const rank = body.rank?.trim() ?? null;
    const unit = body.unit?.trim() ?? null;
    const years_of_service = body.years_of_service ?? null;
    const air_base = body.air_base?.trim() ?? null;
    if (name) {
      await sqlRun(`UPDATE trainees SET name=?, rank=?, unit=?, years_of_service=?, air_base=? WHERE id=?`, [name, rank, unit, years_of_service, air_base, body.id]);
    } else {
      await sqlRun(`UPDATE trainees SET rank=?, unit=?, years_of_service=?, air_base=? WHERE id=?`, [rank, unit, years_of_service, air_base, body.id]);
    }
    return c.json({ ok: true }, 200);
  })

  // POST /trainee/avatar — trainee uploads profile picture (stores as pending)
  .post('/trainee/avatar', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { id?: string; image?: string };
    if (!body.id || !body.image) return c.json({ error: 'id + image required' }, 400);
    if (body.image.length > 500000) return c.json({ error: 'Image too large (max ~375KB)' }, 413);
    await sqlRun(`UPDATE trainees SET avatar_pending=? WHERE id=?`, [body.image, body.id]);
    await logActivity(body.id, 'avatar_uploaded', { status: 'pending' });
    return c.json({ ok: true, status: 'pending' }, 200);
  })

  // POST /trainee/logout
  .post('/trainee/logout', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { id?: string };
    if (!body.id) return c.json({ error: 'id required' }, 400);

    await sqlRun(`UPDATE trainees SET is_online=0 WHERE id=?`, [body.id]);
    onlineHeartbeats.delete(body.id);
    await logActivity(body.id, 'logout');

    const rows = await sql(`SELECT name FROM trainees WHERE id=?`, [body.id]);
    const name = (rows[0]?.name as string) ?? body.id;
    sendTelegram({ type: "logout", traineeId: body.id, traineeName: name });

    return c.json({ ok: true }, 200);
  })

  // GET /trainee/me/:id
  .get('/trainee/me/:id', async (c) => {
    const id = c.req.param('id');
    const rows = await sql(
      `SELECT id, name, rank, unit, login_count, last_login_at, is_online, last_page, last_active_at, created_at, status, xp, level, years_of_service, air_base, avatar, avatar_pending FROM trainees WHERE id=?`, [id]
    );
    if (!rows.length) return c.json({ error: 'Not found' }, 404);
    return c.json(rows[0], 200);
  })

  // GET /trainee/list
  .get('/trainee/list', async (c) => {
    const rows = await sql(
      `SELECT id, name, rank, unit, created_at FROM trainees ORDER BY created_at DESC`
    );
    return c.json(rows, 200);
  })

  // ══════════════════════════════════════════════════════════════════════════
  // ACTIVITY & TRACKING
  // ══════════════════════════════════════════════════════════════════════════

  // POST /activity
  .post('/activity', async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      traineeId?: string; event?: string; detail?: object; page?: string;
    };
    if (!body.traineeId || !body.event) return c.json({ error: 'traineeId + event required' }, 400);
    await logActivity(body.traineeId, body.event, body.detail, body.page);
    return c.json({ ok: true }, 200);
  })

  // POST /heartbeat
  // Only updates last_active_at. Never triggers new login/online notifications
  // unless the trainee was truly absent for longer than ONLINE_THRESHOLD_MS.
  // Uses DB last_active_at as fallback when server restarted (in-memory map lost).
  .post('/heartbeat', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const userId = body.userId as string | undefined;
    const page = body.page as string | undefined;
    if (!userId) return c.json({ error: 'userId required' }, 400);

    const now = Date.now();
    const memOnline = isOnline(userId); // in-memory check

    // If not in memory, check DB last_active_at — covers server restarts
    let dbLastActive = 0;
    if (!memOnline) {
      const rows = await sql(`SELECT last_active_at FROM trainees WHERE id=?`, [userId]).catch(() => []);
      dbLastActive = (rows[0]?.last_active_at as number) ?? 0;
    }

    // Consider "was online" if either memory or DB shows activity within threshold
    const wasOnline = memOnline || (dbLastActive > 0 && now - dbLastActive < ONLINE_THRESHOLD_MS);

    // Always update the heartbeat map and DB
    onlineHeartbeats.set(userId, now);
    await sqlRun(
      `UPDATE trainees SET is_online=1, last_active_at=?, last_page=? WHERE id=?`,
      [now, page ?? null, userId]
    ).catch(() => {});

    // Fetch current status for force-logout enforcement
    const statusRow = await sql(`SELECT name, status FROM trainees WHERE id=?`, [userId]).catch(() => []);
    const currentStatus = (statusRow[0]?.status as string) ?? 'active';
    const traineeName = (statusRow[0]?.name as string) ?? userId;

    // Force-logout if blocked
    if (currentStatus === 'blocked') {
      // Mark offline immediately
      await sqlRun(`UPDATE trainees SET is_online=0 WHERE id=?`, [userId]).catch(() => {});
      onlineHeartbeats.delete(userId);
      return c.json({ ok: false, forceLogout: true, reason: 'blocked', message: 'Your account has been blocked. Contact your instructor.' }, 200);
    }

    // Only send "came back online" Telegram if:
    // 1. Was truly offline (no activity for >ONLINE_THRESHOLD_MS)
    // 2. Cooldown has passed (prevents spam)
    if (!wasOnline && canSendTelegram(userId, "status_change_online")) {
      markTelegramSent(userId, "status_change_online", "site_open");
      sendTelegram({ type: "status_change", traineeId: userId, traineeName, status: "online" });
    }
    return c.json({ ok: true, status: currentStatus }, 200);
  })

  // POST /track
  .post('/track', async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      type: string; userId?: string; traineeName?: string;
      moduleName?: string; score?: number; total?: number; preview?: string; page?: string;
    };
    const { type, userId = "unknown", traineeName = "Unknown",
      moduleName = "", score = 0, total = 0, preview = "", page = "" } = body;

    if (userId !== "unknown") {
      await logActivity(userId, type, { moduleName, score, total, preview }, page).catch(() => {});
    }

    switch (type) {
      case "site_open":
        if (canSendTelegram(userId, "site_open")) {
          markTelegramSent(userId, "site_open");
          sendTelegram({ type: "site_open", traineeId: userId, traineeName });
        }
        break;
      case "login":
        if (canSendTelegram(userId, "login")) {
          markTelegramSent(userId, "login");
          markTelegramSent(userId, "site_open");
          markTelegramSent(userId, "status_change_online");
          sendTelegram({ type: "login", traineeId: userId, traineeName });
        }
        break;
      case "logout":           sendTelegram({ type: "logout", traineeId: userId, traineeName }); break;
      case "inactive":         sendTelegram({ type: "inactive", traineeId: userId, traineeName }); break;
      case "module_open":      sendTelegram({ type: "module_open", traineeId: userId, traineeName, moduleName }); break;
      case "quiz_start":       sendTelegram({ type: "quiz_start", traineeId: userId, traineeName, moduleName }); break;
      case "quiz_finish":      sendTelegram({ type: "quiz_finish", traineeId: userId, traineeName, moduleName, score, total }); break;
      case "module_complete":  sendTelegram({ type: "module_complete", traineeId: userId, traineeName, moduleName }); break;
      case "chat_message":     sendTelegram({ type: "chat_message", traineeId: userId, traineeName, preview }); break;
      case "status_change_offline":
        await sqlRun(`UPDATE trainees SET is_online=0 WHERE id=?`, [userId]).catch(() => {});
        onlineHeartbeats.delete(userId);
        sendTelegram({ type: "status_change", traineeId: userId, traineeName, status: "offline" }); break;
      case "manual_view":      sendTelegram({ type: "module_open", traineeId: userId, traineeName, moduleName: `[MANUAL] ${moduleName}` }); break;
      case "system_warning":   sendTelegram({ type: "system_warning", message: preview }); break;
    }
    return c.json({ ok: true }, 200);
  })

  // ══════════════════════════════════════════════════════════════════════════
  // QUIZ ATTEMPTS
  // ══════════════════════════════════════════════════════════════════════════

  .post('/quiz/attempt', async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      traineeId?: string; moduleId?: number; moduleName?: string;
      score?: number; total?: number;
    };
    if (!body.traineeId || body.moduleId == null) return c.json({ error: 'traineeId+moduleId required' }, 400);
    const { traineeId, moduleId, moduleName = "", score = 0, total = 0 } = body;
    // Suspension gate
    const [statusRow] = await sql(`SELECT status FROM trainees WHERE id=?`, [traineeId]).catch(() => []);
    if (statusRow?.status === 'suspended') return c.json({ error: 'suspended', message: 'Your account is suspended. Quiz submissions are disabled.' }, 403);
    const correct = score;
    const wrong = total - score;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = pct >= 70 ? 1 : 0;
    const now = Date.now();

    await sqlRun(
      `INSERT INTO quiz_attempts (trainee_id, module_id, module_name, score, total, correct, wrong, pct, passed, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [traineeId, moduleId, moduleName, score, total, correct, wrong, pct, passed, now]
    );

    // Get the inserted attempt ID
    const [lastAttempt] = await sql(`SELECT id FROM quiz_attempts WHERE trainee_id=? AND module_id=? AND ts=?`, [traineeId, moduleId, now]);
    const attemptId = (lastAttempt as any)?.id ?? null;

    const existing = await sql(
      `SELECT id, progress, completed FROM trainee_module_progress WHERE trainee_id=? AND module_id=?`,
      [traineeId, moduleId]
    );
    if (existing.length > 0) {
      const row = existing[0] as { id: number; progress: number; completed: number };
      const newPct = Math.max(row.progress, pct);
      const newCompleted = row.completed === 1 || passed === 1 ? 1 : 0;
      await sqlRun(
        `UPDATE trainee_module_progress SET progress=?, completed=?, last_accessed_at=? WHERE id=?`,
        [newPct, newCompleted, now, row.id]
      );
    } else {
      await sqlRun(
        `INSERT INTO trainee_module_progress (trainee_id, module_id, module_name, progress, completed, last_accessed_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [traineeId, moduleId, moduleName, pct, passed, now]
      );
    }

    await logActivity(traineeId, 'quiz_finish', { moduleId, moduleName, score, total, pct, passed });

    // Telegram quiz pass/fail alert
    const [nameRow] = await sql(`SELECT name FROM trainees WHERE id=?`, [traineeId]).catch(() => []);
    const traineeName = (nameRow as any)?.name ?? traineeId;
    if (passed === 1) {
      sendTelegram({ type: 'quiz_finish', traineeId, traineeName, moduleName, score, total });
    } else {
      // Send fail via quiz_finish (telegram.ts will show FAIL ❌ based on pct)
      sendTelegram({ type: 'quiz_finish', traineeId, traineeName, moduleName, score, total });
    }

    // Module milestone: check total completed modules
    const completedRows = await sql(
      `SELECT COUNT(*) as cnt FROM trainee_module_progress WHERE trainee_id=? AND completed=1`,
      [traineeId]
    ).catch(() => []);
    const totalCompleted = (completedRows[0] as any)?.cnt ?? 0;
    if ([3, 6, 9, 12].includes(Number(totalCompleted))) {
      sendTelegram({
        type: 'system_warning',
        message: `🏆 MILESTONE: ${traineeName} completed ${totalCompleted} modules!`,
      });
    }

    return c.json({ ok: true, pct, passed: passed === 1, attemptId }, 200);
  })

  // ══════════════════════════════════════════════════════════════════════════
  // TRAINEE NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════════════════

  .get('/trainee/notifications/:id', async (c) => {
    const id = c.req.param('id');
    const alerts = await sql(
      `SELECT id, message, alert_type, read, ts, COALESCE(pinned,0) as pinned FROM trainee_alerts WHERE trainee_id=? AND COALESCE(deleted,0)=0 ORDER BY pinned DESC, ts DESC LIMIT 50`, [id]
    );
    const msgs = await sql(
      `SELECT id, sender_role, text, read, ts, COALESCE(pinned,0) as pinned FROM trainee_messages WHERE trainee_id=? AND sender_role='admin' AND COALESCE(deleted,0)=0 ORDER BY pinned DESC, ts DESC LIMIT 50`, [id]
    );
    return c.json({ alerts, messages: msgs }, 200);
  })

  .post('/trainee/notifications/read', async (c) => {
    const { traineeId } = await c.req.json().catch(() => ({})) as { traineeId?: string };
    if (!traineeId) return c.json({ error: 'traineeId required' }, 400);
    await sqlRun(`UPDATE trainee_alerts SET read=1 WHERE trainee_id=?`, [traineeId]);
    await sqlRun(`UPDATE trainee_messages SET read=1 WHERE trainee_id=? AND sender_role='admin'`, [traineeId]);
    return c.json({ ok: true }, 200);
  })

  // DELETE single notification
  .post('/trainee/notifications/delete', async (c) => {
    const { traineeId, id, kind } = await c.req.json().catch(() => ({})) as { traineeId?: string; id?: number; kind?: string };
    if (!traineeId || !id || !kind) return c.json({ error: 'traineeId, id, kind required' }, 400);
    if (kind === 'alert') {
      await sqlRun(`UPDATE trainee_alerts SET deleted=1 WHERE id=? AND trainee_id=?`, [id, traineeId]);
    } else {
      await sqlRun(`UPDATE trainee_messages SET deleted=1 WHERE id=? AND trainee_id=?`, [id, traineeId]);
    }
    return c.json({ ok: true }, 200);
  })

  // TOGGLE PIN single notification
  .post('/trainee/notifications/pin', async (c) => {
    const { traineeId, id, kind, pinned } = await c.req.json().catch(() => ({})) as { traineeId?: string; id?: number; kind?: string; pinned?: number };
    if (!traineeId || !id || !kind) return c.json({ error: 'traineeId, id, kind required' }, 400);
    const val = pinned ? 1 : 0;
    if (kind === 'alert') {
      await sqlRun(`UPDATE trainee_alerts SET pinned=? WHERE id=? AND trainee_id=?`, [val, id, traineeId]);
    } else {
      await sqlRun(`UPDATE trainee_messages SET pinned=? WHERE id=? AND trainee_id=?`, [val, id, traineeId]);
    }
    return c.json({ ok: true }, 200);
  })

  // GET /trainee/messages/:id — full conversation thread for the trainee
  .get('/trainee/messages/:id', async (c) => {
    const id = c.req.param('id');
    const rows = await sql(
      `SELECT id, sender_role, text, read, ts FROM trainee_messages WHERE trainee_id=? AND COALESCE(deleted,0)=0 ORDER BY ts ASC LIMIT 100`, [id]
    );
    return c.json(rows, 200);
  })

  // POST /trainee/message — trainee sends a message to admin
  .post('/trainee/message', async (c) => {
    const { traineeId, text } = await c.req.json().catch(() => ({})) as { traineeId?: string; text?: string };
    if (!traineeId || !text?.trim()) return c.json({ error: 'traineeId + text required' }, 400);
    await sqlRun(
      `INSERT INTO trainee_messages (trainee_id, sender_role, text, read, ts) VALUES (?, 'trainee', ?, 0, ?)`,
      [traineeId, text.trim(), Date.now()]
    );
    const [tr] = await sql(`SELECT name FROM trainees WHERE id=?`, [traineeId]);
    const tName = (tr?.name as string) ?? traineeId;
    sendTelegram({ type: 'chat_message', traineeId, traineeName: tName, preview: text.trim().slice(0, 80) });
    return c.json({ ok: true }, 200);
  })

  // ══════════════════════════════════════════════════════════════════════════
  // LEGACY ENDPOINTS
  // ══════════════════════════════════════════════════════════════════════════

  .get('/modules', async (c) => {
    const rows = await sql(`SELECT id, title, subtitle, description, icon, color, "order", lesson_count as lessonCount, is_published as isPublished FROM modules WHERE is_published=1 ORDER BY "order" ASC`, []);
    return c.json(rows, 200);
  })
  .get('/modules/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const [mod] = await sql(`SELECT id, title, subtitle, description, icon, color, "order", lesson_count as lessonCount, is_published as isPublished FROM modules WHERE id=?`, [id]);
    if (!mod) return c.json({ error: 'Not found' }, 404);
    return c.json(mod, 200);
  })
  .get('/modules/:id/questions', async (c) => {
    const moduleId = Number(c.req.param('id'));
    const rows = await sql(`SELECT id, module_id as moduleId, question, option_a as optionA, option_b as optionB, option_c as optionC, option_d as optionD, correct_option as correctOption, explanation, "order" FROM questions WHERE module_id=? ORDER BY "order" ASC`, [moduleId]);
    return c.json(rows, 200);
  })
  .get('/modules/:id/lessons', async (c) => {
    const moduleId = Number(c.req.param('id'));
    const rows = await sql(`SELECT id, module_id as moduleId, title, content, video_url as videoUrl, duration, "order" FROM lessons WHERE module_id=? ORDER BY "order" ASC`, [moduleId]);
    return c.json(rows, 200);
  })
  .get('/achievements', async (c) => {
    const rows = await sql(`SELECT id, key, name, description, icon, color, xp_reward as xpReward FROM achievements ORDER BY id`, []);
    return c.json(rows, 200);
  })
  .get('/achievements/user/:userId', async (c) => {
    const userId = c.req.param('userId');
    const allBadges = await sql(`SELECT id, key, name, description, icon, color, xp_reward as xpReward FROM achievements ORDER BY id`, []);
    const earned = await sql(`SELECT achievement_id, earned_at FROM user_achievements WHERE user_id=?`, [userId]);
    const earnedMap = new Map(earned.map(e => [e.achievement_id, e.earned_at]));
    const result = allBadges.map(b => ({
      ...b, earned: earnedMap.has(b.id),
      earnedAt: earnedMap.get(b.id) ?? null,
    }));
    return c.json(result, 200);
  })
  .get('/progress/:userId', async (c) => {
    const userId = c.req.param('userId');
    const rows = await sql(`SELECT id, user_id as userId, module_id as moduleId, progress, completed, last_accessed_at as lastAccessedAt FROM module_progress WHERE user_id=?`, [userId]);
    return c.json(rows, 200);
  })
  .post('/progress', async (c) => {
    const body = await c.req.json();
    const { userId, moduleId, progress, completed } = body;
    const now = Date.now();
    const existing = await sql(`SELECT id FROM module_progress WHERE user_id=? AND module_id=?`, [userId, moduleId]);
    if (existing.length > 0) {
      await sqlRun(`UPDATE module_progress SET progress=?, completed=?, last_accessed_at=? WHERE user_id=? AND module_id=?`, [progress, completed ? 1 : 0, now, userId, moduleId]);
    } else {
      await sqlRun(`INSERT INTO module_progress (user_id, module_id, progress, completed, last_accessed_at) VALUES (?, ?, ?, ?, ?)`, [userId, moduleId, progress, completed ? 1 : 0, now]);
    }
    return c.json({ ok: true }, 200);
  })
  .get('/ensure-user/:userId', async (c) => {
    const userId = c.req.param('userId');
    try {
      const existing = await sql(`SELECT id FROM users WHERE id=?`, [userId]);
      if (existing.length === 0) {
        await sqlRun(`INSERT OR IGNORE INTO users (id, name, email, role, created_at) VALUES (?, 'Trainee', ?, 'student', ?)`, [userId, `${userId}@tls-trainer.local`, Date.now()]);
      }
    } catch { /* users table may not exist, non-fatal */ }
    return c.json({ ok: true }, 200);
  })
  .post('/quiz/submit', async (c) => {
    const body = await c.req.json();
    const { userId, moduleId, score, total, answers } = body as {
      userId: string; moduleId: number; score: number; total: number;
      answers?: { questionId: number; questionText: string; selectedOption: string; correctOption: string; isCorrect: boolean }[];
    };
    const [statusRow] = await sql(`SELECT status FROM trainees WHERE id=?`, [userId]).catch(() => [null]);
    if (statusRow?.status === 'suspended') return c.json({ error: 'suspended', message: 'Your account is suspended. Quiz submissions are disabled.' }, 403);
    if (statusRow?.status === 'blocked') return c.json({ error: 'blocked', message: 'Your account has been blocked.' }, 403);
    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = pct >= 70;
    const xpEarned = score * 10;

    const existingProg = await sql(`SELECT id, progress, completed FROM module_progress WHERE user_id=? AND module_id=?`, [userId, moduleId]);
    if (existingProg.length > 0) {
      const prev = existingProg[0] as any;
      await sqlRun(`UPDATE module_progress SET progress=?, completed=?, last_accessed_at=? WHERE user_id=? AND module_id=?`,
        [Math.max(prev.progress, pct), prev.completed === 1 || passed ? 1 : 0, now, userId, moduleId]);
    } else {
      await sqlRun(`INSERT INTO module_progress (user_id, module_id, progress, completed, last_accessed_at) VALUES (?,?,?,?,?)`,
        [userId, moduleId, pct, passed ? 1 : 0, now]);
    }

    const [streakRow] = await sql(`SELECT current_streak, longest_streak, last_activity_date, total_xp FROM streaks WHERE user_id=?`, [userId]) as any[];
    let newStreak = 1, longestStreak = 1;
    if (streakRow) {
      const last = streakRow.last_activity_date;
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      newStreak = last === todayStr ? streakRow.current_streak : last === yesterday ? streakRow.current_streak + 1 : 1;
      longestStreak = Math.max(streakRow.longest_streak, newStreak);
      await sqlRun(`UPDATE streaks SET current_streak=?, longest_streak=?, last_activity_date=?, total_xp=? WHERE user_id=?`,
        [newStreak, longestStreak, todayStr, (streakRow.total_xp ?? 0) + xpEarned, userId]);
    } else {
      await sqlRun(`INSERT INTO streaks (user_id, current_streak, longest_streak, last_activity_date, total_xp) VALUES (?,1,1,?,?)`,
        [userId, todayStr, xpEarned]);
    }

    const allBadges = await sql(`SELECT id, key, name, icon, xp_reward as xpReward FROM achievements`, []) as any[];
    const alreadyEarned = await sql(`SELECT achievement_id FROM user_achievements WHERE user_id=?`, [userId]) as any[];
    const earnedIds = new Set(alreadyEarned.map((e: any) => e.achievement_id));
    const newlyUnlocked: { key: string; name: string; icon: string; xpReward: number }[] = [];
    const unlock = async (key: string) => {
      const badge = allBadges.find((b: any) => b.key === key);
      if (!badge || earnedIds.has(badge.id)) return;
      await sqlRun(`INSERT INTO user_achievements (user_id, achievement_id, earned_at) VALUES (?,?,?)`, [userId, badge.id, now]);
      newlyUnlocked.push({ key: badge.key, name: badge.name, icon: badge.icon ?? '🏅', xpReward: badge.xpReward });
    };
    await unlock('first_lesson');
    if (passed) {
      await unlock(`module_${moduleId}_complete`);
      const allProg = await sql(`SELECT completed FROM module_progress WHERE user_id=?`, [userId]) as any[];
      if (allProg.filter((p: any) => p.completed === 1).length >= 9) await unlock('all_modules');
    }
    if (pct === 100) await unlock('quiz_perfect');
    const finalStreak = streakRow ? Math.max(streakRow.current_streak, newStreak) : 1;
    if (finalStreak >= 7) await unlock('streak_7');
    if (finalStreak >= 30) await unlock('streak_30');

    return c.json({ ok: true, xpEarned, pct, newlyUnlocked }, 200);
  })
  // Save individual question answers
  .post('/quiz/answers', async (c) => {
    const body = await c.req.json();
    const { attemptId, traineeId, moduleId, answers } = body as {
      attemptId: number;
      traineeId: string;
      moduleId: number;
      answers: { questionId: number; questionText: string; selectedOption: string; correctOption: string; isCorrect: boolean }[];
    };
    if (!answers?.length) return c.json({ ok: true }, 200);
    const now = Date.now();
    // Create quiz_answers table if not exists
    await sql(`CREATE TABLE IF NOT EXISTS quiz_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      trainee_id TEXT NOT NULL,
      module_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      selected_option TEXT NOT NULL,
      correct_option TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL
    )`, []);
    for (const a of answers) {
      await sql(`INSERT INTO quiz_answers (attempt_id, trainee_id, module_id, question_id, question_text, selected_option, correct_option, is_correct, ts) VALUES (?,?,?,?,?,?,?,?,?)`,
        [attemptId, traineeId, moduleId, a.questionId, a.questionText, a.selectedOption, a.correctOption, a.isCorrect ? 1 : 0, now]);
    }
    return c.json({ ok: true }, 200);
  })
  .get('/streaks/:userId', async (c) => {
    const userId = c.req.param('userId');
    const [row] = await sql(`SELECT current_streak as currentStreak, longest_streak as longestStreak, total_xp as totalXp FROM streaks WHERE user_id=?`, [userId]) as any[];
    return c.json(row ?? { currentStreak: 0, longestStreak: 0, totalXp: 0 }, 200);
  })
  .get('/leaderboard', async (c) => {
    // Join trainees with streaks and quiz stats
    const rows = await sql(`
      SELECT 
        t.id,
        t.name,
        t.rank,
        t.unit,
        t.training_level,
        COALESCE(s.total_xp, 0) as total_xp,
        COALESCE(s.current_streak, 0) as current_streak,
        COALESCE(s.longest_streak, 0) as longest_streak,
        COUNT(DISTINCT qa.id) as quiz_count,
        COALESCE(AVG(CASE WHEN qa.passed = 1 THEN qa.pct ELSE NULL END), 0) as avg_passed_pct,
        SUM(CASE WHEN qa.passed = 1 THEN 1 ELSE 0 END) as quizzes_passed
      FROM trainees t
      LEFT JOIN streaks s ON s.user_id = t.id
      LEFT JOIN quiz_attempts qa ON qa.trainee_id = t.id
      GROUP BY t.id
      ORDER BY total_xp DESC
      LIMIT 50
    `, []);
    return c.json(rows, 200);
  })
  .get('/quiz-attempts/:userId', async (c) => {
    const userId = c.req.param('userId');
    const rows = await sql(`SELECT id, module_id, module_name, score, total, pct, passed, ts FROM quiz_attempts WHERE trainee_id=? ORDER BY ts DESC`, [userId]);
    return c.json(rows, 200);
  })
  // ── AI access-control helpers ────────────────────────────────────────────
  // GET /ai/status/:userId
  .get('/ai/status/:userId', async (c) => {
    const userId = c.req.param('userId');
    const window24h = Date.now() - 24 * 60 * 60 * 1000;
    // usage in last 24h
    const usageRows = await sql(
      `SELECT ts FROM activity_log WHERE trainee_id=? AND event='ai_question' AND ts>=? ORDER BY ts ASC`,
      [userId, window24h]
    );
    const questionsUsed = usageRows.length;
    const questionsRemaining = Math.max(0, 50 - questionsUsed);
    return c.json({ qualified: true, questionsUsed, questionsRemaining, resetsIn: 'tomorrow' }, 200);
  })
  // GET /ai/history/:traineeId — load saved AI conversation for a trainee
  .get('/ai/history/:traineeId', async (c) => {
    const id = c.req.param('traineeId');
    const rows = await sql(
      `SELECT role, content, ts FROM ai_conversations WHERE trainee_id=? ORDER BY ts ASC LIMIT 100`,
      [id]
    );
    return c.json(rows, 200);
  })

  .post('/chat/ai', async (c) => {
    const body = await c.req.json();
    const { message, history = [], userId, fileData, fileType, fileName } = body as {
      message: string; userId?: string;
      history: { role: 'user' | 'assistant'; content: string }[];
      fileData?: string; fileType?: string; fileName?: string;
    };

    // ── Rate limit: 50 questions per 24h ────────────────────────────────────
    if (userId) {
      const window24h = Date.now() - 24 * 60 * 60 * 1000;
      const usageRows = await sql(
        `SELECT ts FROM activity_log WHERE trainee_id=? AND event='ai_question' AND ts>=?`,
        [userId, window24h]
      );
      if (usageRows.length >= 50) {
        return c.json({ error: 'limit', message: 'وصلت للحد اليومي (50 سؤال). يتجدد غداً.\nDaily limit reached (50 questions). Resets tomorrow.' }, 200);
      }
      await sqlRun(`INSERT INTO activity_log (trainee_id, event, detail, page, ts) VALUES (?, 'ai_question', ?, 'ai_chat', ?)`,
        [userId, message.slice(0, 120), Date.now()]);
    }

    // ── Load conversation history from DB ───────────────────────────────────
    let dbHistory: { role: 'user' | 'assistant'; content: string }[] = [];
    if (userId) {
      const dbRows = await sql(
        `SELECT role, content FROM ai_conversations WHERE trainee_id=? ORDER BY ts DESC LIMIT 20`,
        [userId]
      );
      dbHistory = (dbRows as any[]).reverse();
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return c.json({ reply: 'عذراً، مفتاح API غير مضبوط.\nSorry, AI API key is not configured.' }, 200);
    }

    // ── Build RAG context ────────────────────────────────────────────────────
    const [dbQuestions, dbLessons, pdfChunks] = await Promise.all([
      sql(`SELECT question, correct_option, option_a, option_b, option_c, option_d, explanation
           FROM questions ORDER BY module_id, "order" LIMIT 150`).catch(() => []),
      sql(`SELECT title, content FROM lessons ORDER BY module_id, "order" LIMIT 25`).catch(() => []),
      searchKnowledgeChunks(message),
    ]);

    let qaContext = '';
    for (const q of dbQuestions as any[]) {
      const opts: Record<string, string> = { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d };
      const answer = opts[q.correct_option] ?? q.option_a ?? '';
      qaContext += `س: ${q.question}\nج: ${answer}. ${q.explanation ?? ''}\n`;
    }

    let lessonContext = '';
    for (const l of dbLessons as any[]) {
      const preview = (l.content as string || '')
        .replace(/#+\s*/g, '').replace(/\*+/g, '').replace(/\n+/g, ' ')
        .slice(0, 320).trim();
      if (preview) lessonContext += `[${l.title}]: ${preview}\n`;
    }

    const pdfContext = [...new Set(pdfChunks)].join('\n—\n');
    const hasRagContent = qaContext.length > 0 || lessonContext.length > 0 || pdfContext.length > 0;

    const systemPrompt = `أنت مدرب خبير في منظومة TLS التابعة لسلاح الجو الملكي السعودي — وحدة الرادار الأرضي ANPC جدة.

قواعد صارمة:
1. أجب بنفس لغة السؤال — عربي إذا السؤال عربي، إنجليزي إذا إنجليزي.
2. الإجابة مختصرة ودقيقة — 3-5 جمل أو نقاط.
3. ابدأ بالإجابة المباشرة أولاً ثم الشرح.
4. أسلوب مدرب عسكري: مختصر، دقيق، مباشر.
5. استخدم المصطلحات التقنية الصحيحة (TLS, ILS, DDM, LOC, GP, VSWR, ESA...).
6. تخصصك حصراً في TLS/ILS وأنظمة الملاحة الجوية وصيانة الرادار. إذا كان السؤال خارج هذا النطاق تماماً (مثل الطبخ، الرياضة، السياسة...)، أجب بـ: "هذا السؤال خارج نطاق تخصصي في منظومة TLS. يسعدني مساعدتك في أي سؤال تقني يتعلق بـ TLS أو ILS أو أنظمة الملاحة الجوية."
${hasRagContent ? `
=== قاعدة المعرفة ===
${qaContext ? `[أسئلة وإجابات]:\n${qaContext.slice(0, 6000)}` : ''}
${lessonContext ? `[دروس]:\n${lessonContext.slice(0, 3000)}` : ''}
${pdfContext ? `[مستندات تقنية]:\n${pdfContext.slice(0, 3000)}` : ''}
` : ''}`;

    try {
      const contextHistory = userId ? dbHistory : history.slice(-10);
      // Build user content — plain text or multi-part (text + image/pdf)
      const userContent: any = fileData
        ? [
            ...(fileType === 'application/pdf'
              ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } }]
              : [{ type: 'image', source: { type: 'base64', media_type: fileType ?? 'image/jpeg', data: fileData } }]
            ),
            { type: 'text', text: message },
          ]
        : message;
      const msgs = [
        ...contextHistory.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: userContent },
      ];
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: fileData ? 1200 : 800,
          system: systemPrompt,
          messages: msgs,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('[AI] Anthropic error:', res.status, err);
        // Try fallback model if primary fails
        
        return c.json({ reply: `عذراً، خطأ من خدمة الذكاء الاصطناعي (${res.status}).\nSorry, AI service error (${res.status}).` }, 200);
      }
      const data = await res.json() as any;
      const text = data?.content?.[0]?.text ?? 'لا توجد إجابة.\nNo reply received.';
      // ── Save conversation to DB ──────────────────────────────────────────────
      if (userId) {
        const now = Date.now();
        const savedUserContent = fileData && fileName ? `[📎 ${fileName}]\n${message}` : message;
        await sqlRun(`INSERT INTO ai_conversations (trainee_id, role, content, ts) VALUES (?,?,?,?)`,
          [userId, 'user', savedUserContent, now - 1]);
        await sqlRun(`INSERT INTO ai_conversations (trainee_id, role, content, ts) VALUES (?,?,?,?)`,
          [userId, 'assistant', text, now]);
      }
      return c.json({ reply: text }, 200);
    } catch (e: any) {
      console.error('[AI] fetch error:', e?.message);
      return c.json({ reply: 'عذراً، تعذر الاتصال بخدمة الذكاء الاصطناعي.\nSorry, could not reach the AI service.' }, 200);
    }
  })
  .get('/messages', async (c) => {
    const rows = await db.select().from(messages).orderBy(messages.createdAt);
    return c.json(rows, 200);
  })
  .post('/messages', async (c) => {
    const body = await c.req.json();
    const { userId, text, senderRole } = body;
    // Moderation gates (skip for admin messages)
    if (senderRole !== 'admin' && userId) {
      const [statusRow] = await sql(`SELECT status FROM trainees WHERE id=?`, [userId]).catch(() => []);
      if (statusRow?.status === 'suspended') return c.json({ error: 'suspended', message: 'Your account is suspended. Chat is disabled.' }, 403);
      if (statusRow?.status === 'muted') return c.json({ error: 'muted', message: 'You have been muted. You cannot send messages.' }, 403);
    }
    await db.insert(messages).values({ userId, text, senderRole: senderRole ?? 'student', createdAt: Date.now() });
    if (senderRole !== 'admin') {
      const [u] = await db.select().from(users).where(eq(users.id, userId)).catch(() => [undefined]);
      sendTelegram({ type: "chat_message", traineeId: userId, traineeName: u?.name ?? userId, preview: text ?? "" });
    }
    return c.json({ ok: true }, 200);
  })

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP CHAT (real-time, moderated)
  // ══════════════════════════════════════════════════════════════════════════

  // GET /chat/messages?room=general&since=0&limit=50
  .get('/chat/messages', async (c) => {
    const room  = c.req.query('room')  ?? 'general';
    const since = Number(c.req.query('since') ?? 0);
    const limit = Math.min(Number(c.req.query('limit') ?? 80), 200);
    const rows = await sql(
      `SELECT cm.id, cm.room, cm.sender_id, cm.sender_name, cm.sender_role,
              cm.text, cm.deleted, cm.deleted_by, cm.pinned, cm.pinned_by, cm.pinned_at,
              cm.important, cm.ts, cm.attachment_id,
              ca.file_type, ca.file_name, ca.mime_type, ca.size, ca.data as attachment_data
       FROM chat_messages cm
       LEFT JOIN chat_attachments ca ON ca.id = cm.attachment_id
       WHERE cm.room=? AND cm.ts > ?
       ORDER BY cm.ts ASC LIMIT ?`,
      [room, since, limit]
    );
    // Get pinned messages (not deleted)
    const pinned = await sql(
      `SELECT cm.id, cm.room, cm.sender_id, cm.sender_name, cm.sender_role,
              cm.text, cm.deleted, cm.pinned, cm.pinned_by, cm.pinned_at, cm.important, cm.ts,
              ca.file_type, ca.file_name, ca.mime_type, ca.size
       FROM chat_messages cm
       LEFT JOIN chat_attachments ca ON ca.id = cm.attachment_id
       WHERE cm.room=? AND cm.pinned=1 AND cm.deleted=0
       ORDER BY cm.pinned_at DESC LIMIT 3`,
      [room]
    );
    return c.json({ messages: rows, pinned }, 200);
  })

  // POST /chat/send
  .post('/chat/send', async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      senderId?: string; senderName?: string; senderRole?: string;
      text?: string; room?: string; attachmentId?: number;
    };
    const { senderId, senderName, senderRole = 'trainee', text, room = 'general', attachmentId } = body;
    if (!senderId || !senderName) return c.json({ error: 'senderId + senderName required' }, 400);
    if (!text?.trim() && !attachmentId) return c.json({ error: 'text or attachment required' }, 400);

    // Moderation gates
    if (senderRole !== 'admin') {
      const [sr] = await sql(`SELECT status FROM trainees WHERE id=?`, [senderId]).catch(() => []);
      if (sr?.status === 'suspended') return c.json({ error: 'suspended', message: 'Your account is suspended. Chat is disabled.' }, 403);
      if (sr?.status === 'muted') return c.json({ error: 'muted', message: 'You have been muted. You cannot send messages.' }, 403);
    }

    const now = Date.now();
    await sqlRun(
      `INSERT INTO chat_messages (room, sender_id, sender_name, sender_role, text, attachment_id, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [room, senderId, senderName, senderRole, text?.trim() ?? null, attachmentId ?? null, now]
    );
    const [row] = await sql(`SELECT id FROM chat_messages WHERE rowid=last_insert_rowid()`);
    const msgId = row?.id as number;

    // Telegram for trainee messages
    if (senderRole !== 'admin') {
      sendTelegram({ type: "chat_message", traineeId: senderId, traineeName: senderName, preview: text?.slice(0, 80) ?? '[attachment]' });
    }
    return c.json({ ok: true, id: msgId }, 200);
  })

  // POST /chat/delete — admin only
  .post('/chat/delete', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { messageId, room = 'general' } = await c.req.json().catch(() => ({})) as { messageId?: number; room?: string };
    if (!messageId) return c.json({ error: 'messageId required' }, 400);
    await sqlRun(`UPDATE chat_messages SET deleted=1, deleted_by='admin' WHERE id=? AND room=?`, [messageId, room]);
    sendTelegram({ type: "admin_alert", message: `🗑️ Admin deleted message #${messageId} in room: ${room}` });
    return c.json({ ok: true }, 200);
  })

  // POST /chat/pin — admin only
  .post('/chat/pin', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { messageId, room = 'general', pin = true } = await c.req.json().catch(() => ({})) as { messageId?: number; room?: string; pin?: boolean };
    if (!messageId) return c.json({ error: 'messageId required' }, 400);
    if (pin) {
      await sqlRun(`UPDATE chat_messages SET pinned=1, pinned_by='admin', pinned_at=? WHERE id=?`, [Date.now(), messageId]);
      sendTelegram({ type: "admin_alert", message: `📌 Admin pinned message #${messageId}` });
    } else {
      await sqlRun(`UPDATE chat_messages SET pinned=0, pinned_by=NULL, pinned_at=NULL WHERE id=?`, [messageId]);
    }
    return c.json({ ok: true }, 200);
  })

  // POST /chat/important — admin only
  .post('/chat/important', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { messageId, important = true } = await c.req.json().catch(() => ({})) as { messageId?: number; important?: boolean };
    if (!messageId) return c.json({ error: 'messageId required' }, 400);
    await sqlRun(`UPDATE chat_messages SET important=? WHERE id=?`, [important ? 1 : 0, messageId]);
    if (important) sendTelegram({ type: "admin_alert", message: `⚠️ Admin marked message #${messageId} as important` });
    return c.json({ ok: true }, 200);
  })

  // POST /chat/warn — admin warns a trainee via chat (inserts a system message + alert)
  .post('/chat/warn', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, traineeName, reason, room = 'general' } = await c.req.json().catch(() => ({})) as {
      traineeId?: string; traineeName?: string; reason?: string; room?: string;
    };
    if (!traineeId) return c.json({ error: 'traineeId required' }, 400);
    const warnText = `⚠️ WARNING to ${traineeName ?? traineeId}: ${reason ?? 'Please follow chat rules.'}`;
    const now = Date.now();
    await sqlRun(
      `INSERT INTO chat_messages (room, sender_id, sender_name, sender_role, text, important, ts) VALUES (?, 'admin', 'Admin', 'admin', ?, 1, ?)`,
      [room, warnText, now]
    );
    // Also send private alert
    await sqlRun(`INSERT INTO trainee_alerts (trainee_id, message, alert_type, read, ts) VALUES (?, ?, 'warning', 0, ?)`,
      [traineeId, warnText, now]);
    sendTelegram({ type: "admin_alert", message: `⚠️ Admin warned ${traineeName ?? traineeId}: ${reason ?? ''}` });
    return c.json({ ok: true }, 200);
  })

  // POST /chat/upload — multipart file upload
  .post('/chat/upload', async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return c.json({ error: 'No file provided' }, 400);
      if (file.size > 10 * 1024 * 1024) return c.json({ error: 'File too large (max 10MB)' }, 400);

      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
        'video/webm', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ];
      if (!allowedTypes.includes(file.type)) return c.json({ error: 'File type not allowed' }, 400);

      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      const fileType = file.type.startsWith('image/') ? 'image'
        : file.type.startsWith('audio/') ? 'audio'
        : file.type === 'application/pdf' ? 'pdf'
        : 'file';

      const now = Date.now();
      await sqlRun(
        `INSERT INTO chat_attachments (file_type, file_name, mime_type, size, data, ts) VALUES (?, ?, ?, ?, ?, ?)`,
        [fileType, file.name, file.type, file.size, base64, now]
      );
      const [row] = await sql(`SELECT id FROM chat_attachments WHERE rowid=last_insert_rowid()`);
      return c.json({ ok: true, id: row?.id, fileType, fileName: file.name, mimeType: file.type, size: file.size }, 200);
    } catch (e) {
      return c.json({ error: 'Upload failed' }, 500);
    }
  })

  // GET /chat/attachment/:id — serve attachment
  .get('/chat/attachment/:id', async (c) => {
    const id = c.req.param('id');
    const [row] = await sql(`SELECT file_name, mime_type, data FROM chat_attachments WHERE id=?`, [id]);
    if (!row) return c.json({ error: 'Not found' }, 404);
    const buf = Buffer.from(row.data as string, 'base64');
    return new Response(buf, {
      headers: {
        'Content-Type': row.mime_type as string,
        'Content-Disposition': `inline; filename="${row.file_name}"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  })

  // GET /chat/stream — SSE for real-time updates
  .get('/chat/stream', (c) => {
    const room = c.req.query('room') ?? 'general';
    let lastTs = Number(c.req.query('since') ?? Date.now() - 60000);

    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        const send = (data: unknown) => {
          try { controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
        };

        // Send initial heartbeat
        send({ type: 'connected', room, ts: Date.now() });

        const poll = async () => {
          try {
            const rows = await sql(
              `SELECT cm.id, cm.sender_id, cm.sender_name, cm.sender_role, cm.text,
                      cm.deleted, cm.deleted_by, cm.pinned, cm.pinned_by, cm.pinned_at,
                      cm.important, cm.ts, cm.attachment_id,
                      ca.file_type, ca.file_name, ca.mime_type, ca.size
               FROM chat_messages cm
               LEFT JOIN chat_attachments ca ON ca.id = cm.attachment_id
               WHERE cm.room=? AND cm.ts > ?
               ORDER BY cm.ts ASC LIMIT 50`,
              [room, lastTs]
            );
            if (rows.length > 0) {
              lastTs = rows[rows.length - 1].ts as number;
              send({ type: 'messages', messages: rows });
            }
            // Also send any updated (deleted/pinned/important) messages
            const updated = await sql(
              `SELECT id, deleted, pinned, pinned_at, important FROM chat_messages WHERE room=? AND ts > ? - 5000`,
              [room, lastTs]
            );
            if (updated.length > 0) send({ type: 'updates', updates: updated });
          } catch {}
        };

        const interval = setInterval(poll, 2000);

        // Cleanup on disconnect
        c.req.raw.signal.addEventListener('abort', () => {
          clearInterval(interval);
          try { controller.close(); } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  })

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN ENDPOINTS
  // ══════════════════════════════════════════════════════════════════════════

  // POST /admin/verify — Rate limited: 5 attempts / 15 min per IP
  .post('/admin/verify', rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: "Too many admin login attempts — wait 15 minutes" }), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { password } = body as { password?: string };
    return c.json(password === ADMIN_PASSWORD ? { ok: true } : { ok: false, error: 'Invalid password' },
      password === ADMIN_PASSWORD ? 200 : 401);
  })

  // GET /admin/trainees — summary list
  .get('/admin/trainees', async (c) => {
    const pw = c.req.header('x-admin-password') ?? c.req.query('pw');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);

    const allTrainees = await sql(
      `SELECT id, name, rank, unit, created_at, last_login_at, login_count, is_online, last_page, last_active_at, status, xp, level FROM trainees ORDER BY last_active_at DESC`
    );

    const allProgress = await sql(`SELECT trainee_id, completed FROM trainee_module_progress`);
    const allAttempts = await sql(`SELECT trainee_id, pct FROM quiz_attempts`);
    const allModules = await db.select().from(modules);
    const totalMods = allModules.length;

    // Fetch streak and badge data for all trainees
    const allStreaks = await sql(`SELECT user_id, current_streak, longest_streak FROM streaks`).catch(() => []);
    const allBadges  = await sql(`SELECT user_id, COUNT(*) as badge_count FROM user_achievements GROUP BY user_id`).catch(() => []);

    const result = allTrainees.map(t => {
      const id = t.id as string;
      const progress = allProgress.filter(p => p.trainee_id === id);
      const completedModules = progress.filter(p => p.completed === 1).length;
      const attempts = allAttempts.filter(a => a.trainee_id === id);
      const avgScore = attempts.length > 0
        ? Math.round(attempts.reduce((s, a) => s + (a.pct as number), 0) / attempts.length)
        : 0;

      const streakRow = allStreaks.find((s: any) => s.user_id === id);
      const badgeRow  = allBadges.find((b: any) => b.user_id === id);

      return {
        id,
        name: t.name,
        rank: t.rank,
        unit: t.unit,
        email: '',
        createdAt: t.created_at,
        lastLoginAt: t.last_login_at,
        loginCount: t.login_count,
        online: isOnline(id),
        lastPage: t.last_page,
        lastActiveAt: t.last_active_at,
        lastActive: (t.last_active_at as number) ?? 0,
        completedModules,
        totalModules: totalMods,
        quizAttempts: attempts.length,
        avgScore,
        status: (t.status as string) ?? 'active',
        xp:            (t.xp as number)  ?? 0,
        level:         (t.level as number) ?? 1,
        currentStreak: (streakRow?.current_streak  as number) ?? 0,
        longestStreak: (streakRow?.longest_streak  as number) ?? 0,
        earnedBadges:  (badgeRow?.badge_count      as number) ?? 0,
        trainingLevel: 'basic',
      };
    });

    return c.json(result, 200);
  })


  // GET /admin/conversations — list trainees who have private messages
  .get('/admin/conversations', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const rows = await sql(`
      SELECT t.id, t.name,
        SUM(CASE WHEN tm.sender_role='trainee' AND COALESCE(tm.read,0)=0 AND COALESCE(tm.deleted,0)=0 THEN 1 ELSE 0 END) as unread,
        MAX(CASE WHEN COALESCE(tm.deleted,0)=0 THEN tm.ts ELSE NULL END) as lastTs,
        (SELECT tm2.text FROM trainee_messages tm2 WHERE tm2.trainee_id=t.id AND COALESCE(tm2.deleted,0)=0 ORDER BY tm2.ts DESC LIMIT 1) as lastMsg
      FROM trainees t
      JOIN trainee_messages tm ON tm.trainee_id = t.id
      GROUP BY t.id
      ORDER BY lastTs DESC
    `, []);
    return c.json(rows, 200);
  })

  // GET /admin/conversation/:traineeId — full conversation thread (admin view)
  .get('/admin/conversation/:traineeId', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('traineeId');
    // Mark trainee messages as read
    await sqlRun(`UPDATE trainee_messages SET read=1 WHERE trainee_id=? AND sender_role='trainee'`, [id]);
    const rows = await sql(
      `SELECT id, sender_role, text, read, ts, COALESCE(deleted,0) as deleted FROM trainee_messages WHERE trainee_id=? ORDER BY ts ASC LIMIT 200`,
      [id]
    );
    return c.json(rows, 200);
  })

  // DELETE /admin/message/private/:id — admin soft-deletes any private message
  .delete('/admin/message/private/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const msgId = c.req.param('id');
    await sqlRun(`UPDATE trainee_messages SET deleted=1 WHERE id=?`, [msgId]);
    return c.json({ ok: true }, 200);
  })

  // GET /admin/export/trainees — Excel report: trainee summary + quiz history sheets
  .get('/admin/export/trainees', async (c) => {
    const pw = c.req.header('x-admin-password') ?? c.req.query('pw');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);

    const date = new Date().toISOString().slice(0, 10);

    // ── Fetch all data ──────────────────────────────────────────────────────
    const [allTrainees, allProgress, allAttempts, allModulesRows, allStreaks, allBadges] =
      await Promise.all([
        sql(`SELECT id, name, rank, unit, status, xp, level, login_count,
                     last_login_at, last_active_at, created_at FROM trainees ORDER BY name`),
        sql(`SELECT trainee_id, completed FROM trainee_module_progress`),
        sql(`SELECT trainee_id, module_name, score, total, pct, passed, ts FROM quiz_attempts ORDER BY ts DESC`),
        db.select().from(modules),
        sql(`SELECT user_id, current_streak, longest_streak FROM streaks`).catch(() => []),
        sql(`SELECT user_id, COUNT(*) as cnt FROM user_achievements GROUP BY user_id`).catch(() => []),
      ]);

    const totalMods = allModulesRows.length;

    function fmtDate(ts: unknown) {
      if (!ts || ts === 0) return '—';
      return new Date(ts as number).toLocaleDateString('en-US',
        { year: 'numeric', month: 'short', day: '2-digit' });
    }
    function timeAgoStr(ts: unknown) {
      if (!ts || ts === 0) return 'Never';
      const diff = Date.now() - (ts as number);
      const min = Math.floor(diff / 60000);
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(diff / 3600000);
      if (hr < 24) return `${hr}h ago`;
      const d = Math.floor(diff / 86400000);
      return `${d}d ago`;
    }

    // ── Sheet 1: Trainee Summary ────────────────────────────────────────────
    const summaryRows = allTrainees.map((t, i) => {
      const id = t.id as string;
      const progress   = allProgress.filter(p => p.trainee_id === id);
      const completed  = progress.filter(p => p.completed === 1).length;
      const attempts   = allAttempts.filter(a => a.trainee_id === id);
      const passed     = attempts.filter(a => a.passed === 1).length;
      const avgScore   = attempts.length > 0
        ? Math.round(attempts.reduce((s, a) => s + (a.pct as number), 0) / attempts.length) : 0;
      const bestScore  = attempts.length > 0
        ? Math.max(...attempts.map(a => a.pct as number)) : 0;
      const streak     = allStreaks.find((s: any) => s.user_id === id);
      const badges     = allBadges.find((b: any) => b.user_id === id);

      return {
        '#':               i + 1,
        'Name':            t.name,
        'Rank':            t.rank ?? '—',
        'Unit':            t.unit ?? '—',
        'Status':          String(t.status || 'active').toUpperCase(),
        'XP':              t.xp,
        'Level':           t.level,
        'Modules Done':    `${completed}/${totalMods}`,
        'Quiz Attempts':   attempts.length,
        'Quizzes Passed':  passed,
        'Avg Score (%)':   avgScore,
        'Best Score (%)':  bestScore,
        'Current Streak':  (streak as any)?.current_streak ?? 0,
        'Badges Earned':   (badges as any)?.cnt ?? 0,
        'Logins':          t.login_count,
        'Last Active':     timeAgoStr(t.last_active_at),
        'Joined':          fmtDate(t.created_at),
      };
    });

    // ── Sheet 2: Quiz History ───────────────────────────────────────────────
    const traineeMap = Object.fromEntries(allTrainees.map(t => [t.id as string, t.name]));
    const quizRows = allAttempts.map((a, i) => ({
      '#':             i + 1,
      'Trainee':       traineeMap[a.trainee_id as string] ?? a.trainee_id,
      'Module':        a.module_name,
      'Score':         `${a.score}/${a.total}`,
      'Percentage (%)': Math.round(a.pct as number),
      'Result':        a.passed === 1 ? 'PASSED' : 'FAILED',
      'Date':          new Date(a.ts as number).toLocaleDateString('en-US',
                         { year: 'numeric', month: 'short', day: '2-digit' }),
    }));

    // ── Build workbook ──────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    // Column widths for readability
    (wsSummary as any)['!cols'] = [
      {wch:4},{wch:22},{wch:14},{wch:16},{wch:16},{wch:10},
      {wch:8},{wch:7},{wch:13},{wch:13},{wch:14},{wch:13},
      {wch:13},{wch:13},{wch:13},{wch:8},{wch:14},{wch:14},
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Trainee Summary');

    const wsQuiz = XLSX.utils.json_to_sheet(quizRows);
    (wsQuiz as any)['!cols'] = [{wch:4},{wch:22},{wch:20},{wch:8},{wch:14},{wch:8},{wch:16}];
    XLSX.utils.book_append_sheet(wb, wsQuiz, 'Quiz History');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const filename = `TLS-Trainees-Report-${date}.xlsx`;

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  })

  // GET /admin/trainee/:id — full detail
  .get('/admin/trainee/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');

    const traineesRows = await sql(
      `SELECT id, name, rank, unit, created_at, last_login_at, login_count, is_online, last_page, last_active_at, status, xp, level FROM trainees WHERE id=?`, [id]
    );
    if (!traineesRows.length) return c.json({ error: 'Not found' }, 404);
    const t = traineesRows[0];

    const actLogs = await sql(
      `SELECT id, event, detail, page, ts FROM activity_log WHERE trainee_id=? ORDER BY ts DESC LIMIT 200`, [id]
    );
    const attempts = await sql(
      `SELECT id, module_id, module_name, score, total, correct, wrong, pct, passed, ts FROM quiz_attempts WHERE trainee_id=? ORDER BY ts DESC`, [id]
    );
    const progress = await sql(
      `SELECT id, module_id, module_name, progress, completed, assigned_by_admin, last_accessed_at FROM trainee_module_progress WHERE trainee_id=? ORDER BY module_id`, [id]
    );
    const notes = await sql(
      `SELECT id, note, author_id, ts FROM instructor_notes WHERE trainee_id=? ORDER BY ts DESC`, [id]
    );
    const msgs = await sql(
      `SELECT id, sender_role, text, read, ts FROM trainee_messages WHERE trainee_id=? ORDER BY ts DESC LIMIT 50`, [id]
    );
    const alerts = await sql(
      `SELECT id, message, alert_type, read, ts FROM trainee_alerts WHERE trainee_id=? ORDER BY ts DESC LIMIT 50`, [id]
    );
    const evaluation = await sql(
      `SELECT rating, recommendation, technical_observations, updated_at FROM trainee_evaluations WHERE trainee_id=?`, [id]
    );
    const timeLogs = await sql(
      `SELECT module_id, module_name, SUM(duration_ms) as total_ms FROM module_time_log WHERE trainee_id=? GROUP BY module_id`, [id]
    );
    const manualLogs = await sql(
      `SELECT manual_name, file_name, COUNT(*) as view_count, SUM(duration_ms) as total_ms FROM manual_view_log WHERE trainee_id=? GROUP BY file_name`, [id]
    );

    const totalAttempts = attempts.length;
    const passedAttempts = attempts.filter(a => a.passed === 1).length;
    const failedAttempts = totalAttempts - passedAttempts;
    const totalCorrect = attempts.reduce((s, a) => s + (a.correct as number), 0);
    const totalWrong = attempts.reduce((s, a) => s + (a.wrong as number), 0);
    const bestScore = attempts.length > 0 ? Math.max(...attempts.map(a => a.pct as number)) : 0;
    const avgScore = attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + (a.pct as number), 0) / attempts.length) : 0;
    const completedModules = progress.filter(p => p.completed === 1).length;
    const assignedModules = progress.filter(p => p.assigned_by_admin === 1).length;
    const manualViews = manualLogs.reduce((s, m) => s + (m.view_count as number), 0);
    const totalTrainingMs = timeLogs.reduce((s, t) => s + (t.total_ms as number), 0);
    const trainingHours = Math.round((totalTrainingMs / 3600000) * 10) / 10;

    return c.json({
      trainee: { ...t, online: isOnline(id) },
      stats: {
        totalAttempts, passedAttempts, failedAttempts,
        totalCorrect, totalWrong, bestScore, avgScore,
        completedModules, assignedModules, manualViews, trainingHours,
      },
      activityLog: actLogs,
      quizAttempts: attempts,
      moduleProgress: progress,
      instructorNotes: notes,
      messages: msgs,
      alerts,
      evaluation: evaluation[0] ?? null,
      timeLogs,
      manualLogs,
    }, 200);
  })

  // GET /admin/quiz-answers/:traineeId — per-question answers for a trainee
  .get('/admin/quiz-answers/:traineeId', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const traineeId = c.req.param('traineeId');
    const rows = await sql(`
      SELECT qa.*, qat.module_name, qat.pct, qat.passed
      FROM quiz_answers qa
      LEFT JOIN quiz_attempts qat ON qat.id = qa.attempt_id
      WHERE qa.trainee_id = ?
      ORDER BY qa.ts DESC
    `, [traineeId]).catch(() => []);
    return c.json(rows, 200);
  })
  // GET /admin/missed-questions — most missed questions across all trainees
  .get('/admin/missed-questions', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const rows = await sql(`
      SELECT 
        question_id,
        question_text,
        module_id,
        COUNT(*) as total_attempts,
        SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) as wrong_count,
        ROUND(SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as wrong_pct
      FROM quiz_answers
      GROUP BY question_id
      HAVING total_attempts >= 1
      ORDER BY wrong_pct DESC
      LIMIT 20
    `, []).catch(() => []);
    return c.json(rows, 200);
  })


  // POST /admin/message
  .post('/admin/message', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, text } = await c.req.json().catch(() => ({})) as { traineeId?: string; text?: string };
    if (!traineeId || !text?.trim()) return c.json({ error: 'traineeId + text required' }, 400);
    await sqlRun(`INSERT INTO trainee_messages (trainee_id, sender_role, text, read, ts) VALUES (?, 'admin', ?, 0, ?)`,
      [traineeId, text.trim(), Date.now()]);
    // Notify Telegram that admin sent a message
    const [tr] = await sql(`SELECT name FROM trainees WHERE id=?`, [traineeId]);
    const tName = (tr?.name as string) ?? traineeId;
    sendTelegram({ type: "admin_alert", message: `💬 Message sent to ${tName}: "${text.trim().slice(0, 80)}"` });
    return c.json({ ok: true }, 200);
  })

  // POST /admin/alert
  .post('/admin/alert', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, message, alertType = 'info' } = await c.req.json().catch(() => ({})) as {
      traineeId?: string; message?: string; alertType?: string;
    };
    if (!traineeId || !message?.trim()) return c.json({ error: 'traineeId + message required' }, 400);
    await sqlRun(`INSERT INTO trainee_alerts (trainee_id, message, alert_type, read, ts) VALUES (?, ?, ?, 0, ?)`,
      [traineeId, message.trim(), alertType, Date.now()]);
    // Notify Telegram that admin sent an alert
    const [tr2] = await sql(`SELECT name FROM trainees WHERE id=?`, [traineeId]);
    const tName2 = (tr2?.name as string) ?? traineeId;
    sendTelegram({ type: "admin_alert", message: `[${alertType.toUpperCase()}] Alert sent to ${tName2}: "${message.trim().slice(0, 80)}"` });
    return c.json({ ok: true }, 200);
  })

  // POST /admin/alert-all — broadcast to every active trainee at once
  .post('/admin/alert-all', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { message, alertType = 'info' } = await c.req.json().catch(() => ({})) as {
      message?: string; alertType?: string;
    };
    if (!message?.trim()) return c.json({ error: 'message required' }, 400);
    const now = Date.now();
    const trainees = await sql(`SELECT id FROM trainees WHERE status='active'`);
    for (const tr of trainees) {
      await sqlRun(`INSERT INTO trainee_alerts (trainee_id, message, alert_type, read, ts) VALUES (?, ?, ?, 0, ?)`,
        [tr.id, message.trim(), alertType, now]);
    }
    sendTelegram({ type: "admin_alert", message: `📢 Broadcast [${(alertType).toUpperCase()}] to ${trainees.length} trainees: "${message.trim().slice(0, 60)}"` });
    return c.json({ ok: true, count: trainees.length }, 200);
  })

  // POST /admin/note
  .post('/admin/note', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, note } = await c.req.json().catch(() => ({})) as { traineeId?: string; note?: string };
    if (!traineeId || !note?.trim()) return c.json({ error: 'traineeId + note required' }, 400);
    await sqlRun(`INSERT INTO instructor_notes (trainee_id, note, author_id, ts) VALUES (?, ?, 'admin', ?)`,
      [traineeId, note.trim(), Date.now()]);
    return c.json({ ok: true }, 200);
  })

  // POST /admin/assign-module
  .post('/admin/assign-module', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, moduleId, moduleName = "" } = await c.req.json().catch(() => ({})) as {
      traineeId?: string; moduleId?: number; moduleName?: string;
    };
    if (!traineeId || moduleId == null) return c.json({ error: 'traineeId + moduleId required' }, 400);
    const existing = await sql(`SELECT id FROM trainee_module_progress WHERE trainee_id=? AND module_id=?`, [traineeId, moduleId]);
    if (existing.length > 0) {
      await sqlRun(`UPDATE trainee_module_progress SET assigned_by_admin=1 WHERE trainee_id=? AND module_id=?`, [traineeId, moduleId]);
    } else {
      await sqlRun(
        `INSERT INTO trainee_module_progress (trainee_id, module_id, module_name, progress, completed, assigned_by_admin, last_accessed_at) VALUES (?, ?, ?, 0, 0, 1, ?)`,
        [traineeId, moduleId, moduleName, Date.now()]
      );
    }
    await logActivity(traineeId, 'module_assigned', { moduleId, moduleName, by: 'admin' });
    return c.json({ ok: true }, 200);
  })

  // POST /admin/reset-quiz
  .post('/admin/reset-quiz', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, moduleId } = await c.req.json().catch(() => ({})) as { traineeId?: string; moduleId?: number };
    if (!traineeId || moduleId == null) return c.json({ error: 'traineeId + moduleId required' }, 400);
    await sqlRun(`DELETE FROM quiz_attempts WHERE trainee_id=? AND module_id=?`, [traineeId, moduleId]);
    await sqlRun(`UPDATE trainee_module_progress SET progress=0, completed=0 WHERE trainee_id=? AND module_id=?`, [traineeId, moduleId]);
    await logActivity(traineeId, 'quiz_reset', { moduleId, by: 'admin' });
    return c.json({ ok: true }, 200);
  })

  // POST /admin/complete-module
  .post('/admin/complete-module', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, moduleId, moduleName = "" } = await c.req.json().catch(() => ({})) as {
      traineeId?: string; moduleId?: number; moduleName?: string;
    };
    if (!traineeId || moduleId == null) return c.json({ error: 'traineeId + moduleId required' }, 400);
    const existing = await sql(`SELECT id FROM trainee_module_progress WHERE trainee_id=? AND module_id=?`, [traineeId, moduleId]);
    if (existing.length > 0) {
      await sqlRun(`UPDATE trainee_module_progress SET completed=1, progress=100 WHERE trainee_id=? AND module_id=?`, [traineeId, moduleId]);
    } else {
      await sqlRun(
        `INSERT INTO trainee_module_progress (trainee_id, module_id, module_name, progress, completed, last_accessed_at) VALUES (?, ?, ?, 100, 1, ?)`,
        [traineeId, moduleId, moduleName, Date.now()]
      );
    }
    await logActivity(traineeId, 'module_completed_by_admin', { moduleId, moduleName, by: 'admin' });
    return c.json({ ok: true }, 200);
  })

  // GET /admin/registration-requests
  .get('/admin/registration-requests', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const rows = await sql(`SELECT * FROM registration_requests ORDER BY ts DESC`);
    return c.json(rows, 200);
  })

  // POST /admin/registration/approve/:id
  .post('/admin/registration/approve/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const reqId = c.req.param('id');
    const [req] = await sql(`SELECT * FROM registration_requests WHERE id=?`, [reqId]);
    if (!req) return c.json({ error: 'Request not found' }, 404);
    if (req.status === 'approved') return c.json({ error: 'Already approved' }, 400);
    const now = Date.now();
    // Create trainee account
    await sqlRun(
      `INSERT OR IGNORE INTO trainees (id, name, rank, unit, air_base, years_of_service, pin, created_at, last_login_at, login_count, is_online, last_page, last_active_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '/', ?, 'active')`,
      [reqId, req.name, req.rank, req.unit, req.air_base, req.years_of_service, req.pin, now, now, now]
    );
    await db.insert(users).values({ id: reqId, name: req.name as string, email: `${reqId}@tls-trainer.local`, role: "student", createdAt: now }).catch(() => {});
    await sqlRun(`UPDATE registration_requests SET status='approved', reviewed_at=? WHERE id=?`, [now, reqId]);
    await sqlRun(`INSERT INTO trainee_alerts (trainee_id, message, alert_type, read, ts) VALUES (?, ?, 'info', 0, ?)`,
      [reqId, 'تمت الموافقة على تسجيلك. يمكنك الدخول الآن.', now]).catch(() => {});
    sendTelegram({ type: 'admin_alert', message: `✅ تمت الموافقة على تسجيل: ${req.name}` });
    return c.json({ ok: true }, 200);
  })

  // POST /admin/registration/reject/:id
  .post('/admin/registration/reject/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const reqId = c.req.param('id');
    const { note } = await c.req.json().catch(() => ({})) as { note?: string };
    const now = Date.now();
    await sqlRun(`UPDATE registration_requests SET status='rejected', review_note=?, reviewed_at=? WHERE id=?`, [note ?? null, now, reqId]);
    sendTelegram({ type: 'admin_alert', message: `❌ تم رفض طلب تسجيل` });
    return c.json({ ok: true }, 200);
  })

  // POST /admin/registration/suspend/:id
  .post('/admin/registration/suspend/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const reqId = c.req.param('id');
    const now = Date.now();
    await sqlRun(`UPDATE registration_requests SET status='suspended', reviewed_at=? WHERE id=?`, [now, reqId]);
    return c.json({ ok: true }, 200);
  })

  // GET /admin/ai/index-status
  .get('/admin/ai/index-status', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const [chunkCount, docCount] = await Promise.all([
      sql('SELECT COUNT(*) as cnt FROM ai_doc_chunks').then((r: any[]) => r[0]?.cnt ?? 0),
      sql('SELECT COUNT(DISTINCT filename) as cnt FROM ai_doc_chunks').then((r: any[]) => r[0]?.cnt ?? 0),
    ]);
    const docs = await sql('SELECT DISTINCT filename, dir_name, COUNT(*) as chunks, MAX(indexed_at) as last_indexed FROM ai_doc_chunks GROUP BY filename ORDER BY last_indexed DESC');
    return c.json({ chunkCount, docCount, docs }, 200);
  })

  // POST /admin/ai/index-pdfs
  .post('/admin/ai/index-pdfs', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json().catch(() => ({})) as { reindex?: boolean };
    const reindex = !!body.reindex;

    // Lazy-load spawnSync and dirs to avoid any top-level module issues
    let spawnSyncFn: typeof import('child_process').spawnSync | null = null;
    try { spawnSyncFn = (await import('child_process')).spawnSync; } catch {}

    const STATIC_PDF_DIRS = (() => {
      try {
        return [
          path.join(import.meta.dir, '..', '..', 'static', 'admin-docs'),
          path.join(import.meta.dir, '..', '..', 'static', 'pdfs'),
        ];
      } catch { return []; }
    })();

    const indexed: string[] = [], skipped: string[] = [], errors: { file: string; err: string }[] = [];
    const now = Date.now();

    for (const dir of STATIC_PDF_DIRS) {
      if (!fs.existsSync(dir)) continue;
      const dirName = path.basename(dir);
      const allFiles = fs.readdirSync(dir).filter((f: string) => f.toLowerCase().endsWith('.pdf'));

      for (const file of allFiles) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.size > 30 * 1024 * 1024) {
          skipped.push(`${file} (too large: ${Math.round(stat.size / 1024 / 1024)}MB)`);
          continue;
        }

        const docId = `${file}::${stat.mtimeMs}`;
        if (!reindex) {
          const exists = await sql('SELECT id FROM ai_doc_chunks WHERE doc_id=? LIMIT 1', [docId]).catch(() => []);
          if ((exists as any[]).length > 0) { skipped.push(file); continue; }
        }

        try {
          if (!spawnSyncFn) {
            errors.push({ file, err: 'pdftotext not available on this server' });
            continue;
          }
          const result = spawnSyncFn('pdftotext', ['-enc', 'UTF-8', '-q', filePath, '-'], {
            encoding: 'utf8',
            maxBuffer: 30 * 1024 * 1024,
          });
          const text = (result.status === 0 && result.stdout) ? result.stdout : '';

          if (!text || text.trim().length < 50) {
            errors.push({ file, err: result.error ? 'pdftotext not installed on server' : 'No text extracted (PDF may be image-based or encrypted)' });
            continue;
          }

          const chunks = splitIntoChunks(text);
          await sqlRun('DELETE FROM ai_doc_chunks WHERE filename=?', [file]);
          for (let i = 0; i < chunks.length; i++) {
            await sqlRun(
              'INSERT INTO ai_doc_chunks (doc_id,filename,dir_name,chunk_index,content,indexed_at) VALUES (?,?,?,?,?,?)',
              [docId, file, dirName, i, chunks[i], now]
            );
          }
          indexed.push(`${file} (${chunks.length} chunks)`);
        } catch (e: any) {
          errors.push({ file, err: e?.message?.slice(0, 100) ?? 'unknown error' });
        }
      }
    }

    return c.json({ ok: true, indexed, skipped, errors }, 200);
  })

    // GET /admin/pending-avatars
  .get('/admin/pending-avatars', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const rows = await sql(`SELECT id, name, rank, unit, avatar_pending FROM trainees WHERE avatar_pending IS NOT NULL AND avatar_pending != '' ORDER BY id`);
    return c.json(rows, 200);
  })

  // POST /admin/avatar/approve/:id
  .post('/admin/avatar/approve/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    await sqlRun(`UPDATE trainees SET avatar=avatar_pending, avatar_pending=NULL WHERE id=?`, [id]);
    await logActivity(id, 'avatar_approved', { by: 'admin' });
    const [t] = await sql(`SELECT name FROM trainees WHERE id=?`, [id]);
    sendTelegram({ type: 'admin_alert', message: `✅ Avatar approved for ${(t?.name as string) ?? id}` });
    return c.json({ ok: true }, 200);
  })

  // POST /admin/avatar/reject/:id
  .post('/admin/avatar/reject/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    await sqlRun(`UPDATE trainees SET avatar_pending=NULL WHERE id=?`, [id]);
    await logActivity(id, 'avatar_rejected', { by: 'admin' });
    return c.json({ ok: true }, 200);
  })

  // POST /admin/moderate — block/unblock/suspend/restore/mute/unmute
  .post('/admin/moderate', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { traineeId, action, reason } = await c.req.json().catch(() => ({})) as {
      traineeId?: string; action?: string; reason?: string;
    };
    if (!traineeId || !action) return c.json({ error: 'traineeId + action required' }, 400);

    const validActions = ['block', 'unblock', 'suspend', 'restore', 'mute', 'unmute'];
    if (!validActions.includes(action)) return c.json({ error: 'Invalid action' }, 400);

    const actionToStatus: Record<string, string> = {
      block: 'blocked', unblock: 'active', suspend: 'suspended', restore: 'active', mute: 'muted', unmute: 'active',
    };
    const newStatus = actionToStatus[action];

    const [tr] = await sql(`SELECT name, status FROM trainees WHERE id=?`, [traineeId]);
    if (!tr) return c.json({ error: 'Trainee not found' }, 404);
    const traineeName = (tr.name as string) ?? traineeId;
    const prevStatus = (tr.status as string) ?? 'active';

    await sqlRun(`UPDATE trainees SET status=? WHERE id=?`, [newStatus, traineeId]);
    await sqlRun(`INSERT INTO moderation_log (trainee_id, action, reason, admin_id, ts) VALUES (?, ?, ?, 'admin', ?)`,
      [traineeId, action, reason ?? null, Date.now()]);
    await logActivity(traineeId, `admin_${action}`, { reason, by: 'admin', prevStatus, newStatus });

    // Telegram notifications for significant actions
    const telegramMessages: Record<string, string> = {
      block:   `🚫 BLOCKED: ${traineeName} — ${reason ?? 'No reason given'}`,
      unblock: `✅ UNBLOCKED: ${traineeName}`,
      suspend: `⏸️ SUSPENDED: ${traineeName} — ${reason ?? 'No reason given'}`,
      restore: `▶️ RESTORED: ${traineeName}`,
      mute:    `🔇 MUTED: ${traineeName} — ${reason ?? 'No reason given'}`,
      unmute:  `🔊 UNMUTED: ${traineeName}`,
    };
    sendTelegram({ type: "admin_alert", message: telegramMessages[action] });

    return c.json({ ok: true, newStatus }, 200);
  })

  // DELETE /admin/trainee/:id — permanently remove a trainee and all their data
  .delete('/admin/trainee/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const rows = await sql(`SELECT name FROM trainees WHERE id=?`, [id]);
    if (!rows.length) return c.json({ error: 'Not found' }, 404);
    const name = rows[0].name as string;

    // Remove all associated data
    await sqlRun(`DELETE FROM activity_log WHERE trainee_id=?`, [id]).catch(() => {});
    await sqlRun(`DELETE FROM quiz_attempts WHERE trainee_id=?`, [id]).catch(() => {});
    await sqlRun(`DELETE FROM trainee_module_progress WHERE trainee_id=?`, [id]).catch(() => {});
    await sqlRun(`DELETE FROM moderation_log WHERE trainee_id=?`, [id]).catch(() => {});
    await sqlRun(`DELETE FROM chat_messages WHERE sender_id=?`, [id]).catch(() => {});
    await sqlRun(`DELETE FROM trainees WHERE id=?`, [id]);
    onlineHeartbeats.delete(id);

    sendTelegram({ type: "admin_alert", message: `🗑️ Admin deleted trainee account: ${name} (${id})` });
    return c.json({ ok: true, deleted: name }, 200);
  })

  // GET /admin/moderation-log/:id
  .get('/admin/moderation-log/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const rows = await sql(`SELECT id, action, reason, admin_id, ts FROM moderation_log WHERE trainee_id=? ORDER BY ts DESC LIMIT 50`, [id]);
    return c.json(rows, 200);
  })

  // ── Backup endpoints ──────────────────────────────────────────────────────

  // POST /admin/backup/create


  // AI key diagnostic (admin only)
  .get('/admin/ai/test-key', async (c) => {
    const pw = c.req.header('x-admin-password') ?? '';
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
    if (!apiKey) return c.json({ ok: false, error: 'ANTHROPIC_API_KEY not set' });
    const keyPreview = apiKey.slice(0, 12) + '...' + apiKey.slice(-4);
    const keyFormat = apiKey.startsWith('sk-ant-') ? 'valid-format' : 'INVALID-format';
    const results: any = { keyPreview, keyFormat, models: {} };
    // Test models list endpoint
    try {
      const mRes = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      });
      const mBody = await mRes.text();
      results.modelsEndpoint = { status: mRes.status, body: mBody.slice(0, 500) };
    } catch (e: any) { results.modelsEndpoint = { error: e?.message }; }
    // Test multiple models
    for (const model of ['claude-3-haiku-20240307', 'claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-opus-4-5']) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
        });
        const body = await res.text();
        results.models[model] = { status: res.status, ok: res.ok, snippet: body.slice(0, 120) };
      } catch (e: any) { results.models[model] = { error: e?.message }; }
    }
    return c.json(results);
  })

  // Retake requests list
  .get('/admin/retake-requests', async (c) => {
    const pw = c.req.header('x-admin-password') ?? '';
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    try {
      const rows = db.prepare(
        `SELECT rr.id, rr.trainee_id, t.name as trainee_name, rr.module_id, 
                m.title as module_name, rr.ts, rr.reason
         FROM retake_requests rr
         JOIN trainees t ON t.id = rr.trainee_id
         JOIN modules m ON m.id = rr.module_id
         WHERE rr.status = 'pending'
         ORDER BY rr.ts DESC`
      ).all() as any[];
      return c.json(rows, 200);
    } catch {
      return c.json([], 200);
    }
  })

  // Approve retake request
  .post('/admin/retake-request/:id/approve', async (c) => {
    const pw = c.req.header('x-admin-password') ?? '';
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    try {
      db.prepare("UPDATE retake_requests SET status='approved' WHERE id=?").run(id);
      return c.json({ ok: true }, 200);
    } catch {
      return c.json({ ok: false, error: 'Not found' }, 404);
    }
  })

  // Deny retake request
  .post('/admin/retake-request/:id/deny', async (c) => {
    const pw = c.req.header('x-admin-password') ?? '';
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    try {
      db.prepare("UPDATE retake_requests SET status='denied' WHERE id=?").run(id);
      return c.json({ ok: true }, 200);
    } catch {
      return c.json({ ok: false, error: 'Not found' }, 404);
    }
  })

  // Change admin password
  .post('/admin/change-password', async (c) => {
    const pw = c.req.header('x-admin-password') ?? '';
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    return c.json({ ok: false, error: 'Password must be changed via Railway environment variables (ADMIN_PASSWORD)' }, 400);
  })

  // Update trainee training level
  .post('/admin/trainee/:id/training-level', async (c) => {
    const pw = c.req.header('x-admin-password') ?? '';
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const body = await c.req.json() as { level?: string };
    const validLevels = ['basic', 'intermediate', 'advanced'];
    if (!body.level || !validLevels.includes(body.level)) {
      return c.json({ error: 'Invalid level. Must be: basic, intermediate, advanced' }, 400);
    }
    try {
      db.prepare("UPDATE trainees SET training_level=? WHERE id=?").run(body.level, id);
      return c.json({ ok: true, level: body.level }, 200);
    } catch {
      return c.json({ ok: false, error: 'Trainee not found' }, 404);
    }
  })

  .post('/admin/backup/create', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json().catch(() => ({})) as { note?: string };
    try {
      const result = await createBackup('manual', body.note ?? 'Manual backup');
      return c.json({ ok: true, ...result }, 200);
    } catch (e: any) {
      return c.json({ ok: false, error: e?.message ?? 'Backup failed' }, 500);
    }
  })

  // GET /admin/backup/list
  .get('/admin/backup/list', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const rows = await sql(`SELECT id, label, note, created_at, size_bytes, table_counts FROM backups ORDER BY created_at DESC`);
    return c.json(rows, 200);
  })

  // GET /admin/backup/:id/download — returns zip as base64 JSON (browser downloads it)
  .get('/admin/backup/:id/download', async (c) => {
    const pw = c.req.header('x-admin-password') ?? c.req.query('pw');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const [row] = await sql(`SELECT id, label, note, created_at, size_bytes, data FROM backups WHERE id=?`, [id]);
    if (!row) return c.json({ error: 'Not found' }, 404);

    // Build a zip-like bundle: JSON with metadata + data
    const bundle = {
      meta: {
        id: row.id, label: row.label, note: row.note,
        created_at: row.created_at,
        exported_at: Date.now(),
        version: 'TLS-Trainer-v1',
        size_bytes: row.size_bytes,
      },
      data: JSON.parse(row.data as string),
    };
    const json = JSON.stringify(bundle, null, 2);
    const buf = Buffer.from(json, 'utf8');
    const filename = `TLS-backup-${row.label}-${new Date(row.created_at as number).toISOString().slice(0,10)}-${(row.id as string).slice(-5)}.json`;
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'x-admin-only': 'true',
      },
    });
  })

  // POST /admin/backup/:id/restore
  .post('/admin/backup/:id/restore', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const result = await restoreFromBackup(id);
    if (!result.ok) return c.json(result, 400);
    sendTelegram({ type: 'admin_alert', message: `♻️ Admin restored database from backup: ${id}` });
    return c.json(result, 200);
  })

  // DELETE /admin/backup/:id
  .delete('/admin/backup/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const [row] = await sql(`SELECT id FROM backups WHERE id=?`, [id]);
    if (!row) return c.json({ error: 'Not found' }, 404);
    await sqlRun(`DELETE FROM backups WHERE id=?`, [id]);
    return c.json({ ok: true }, 200);
  })

  // GET /admin/backup/export/json — full data export as JSON (no backup stored)
  .get('/admin/backup/export/json', async (c) => {
    const pw = c.req.header('x-admin-password') ?? c.req.query('pw');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { dump, counts } = await dumpAllTables();
    const bundle = {
      meta: { exported_at: Date.now(), version: 'TLS-Trainer-v1', table_counts: counts },
      data: dump,
    };
    const json = JSON.stringify(bundle, null, 2);
    const filename = `TLS-export-${new Date().toISOString().slice(0,10)}.json`;
    return new Response(Buffer.from(json, 'utf8'), {
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${filename}"` },
    });
  })

  // GET /admin/backup/export/sql — SQL INSERT dump
  .get('/admin/backup/export/sql', async (c) => {
    const pw = c.req.header('x-admin-password') ?? c.req.query('pw');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const { dump } = await dumpAllTables();
    const lines: string[] = [
      '-- TLS Trainer Database Export',
      `-- Exported: ${new Date().toISOString()}`,
      `-- Version: TLS-Trainer-v1`,
      '',
    ];
    for (const [table, rows] of Object.entries(dump)) {
      lines.push(`-- Table: ${table} (${(rows as unknown[]).length} rows)`);
      lines.push(`DELETE FROM ${table};`);
      for (const row of rows as Record<string, unknown>[]) {
        const keys = Object.keys(row);
        if (!keys.length) continue;
        const cols = keys.map(k => `"${k}"`).join(', ');
        const vals = keys.map(k => {
          const v = row[k];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return String(v);
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');
        lines.push(`INSERT OR REPLACE INTO "${table}" (${cols}) VALUES (${vals});`);
      }
      lines.push('');
    }
    const sql_text = lines.join('\n');
    const filename = `TLS-export-${new Date().toISOString().slice(0,10)}.sql`;
    return new Response(Buffer.from(sql_text, 'utf8'), {
      headers: { 'Content-Type': 'text/plain', 'Content-Disposition': `attachment; filename="${filename}"` },
    });
  })

  // GET /admin/backup/export/project — download full project source as ZIP
  .get('/admin/backup/export/project', async (c) => {
    const pw = c.req.header('x-admin-password') ?? c.req.query('pw');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    try {
      const zipData = await buildProjectZip();
      const filename = `TLS-Trainer-source-${new Date().toISOString().slice(0,10)}.zip`;
      return new Response(zipData, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (e: any) {
      return c.json({ error: e?.message ?? 'Export failed' }, 500);
    }
  })

  // GET /admin/backup/export/migration — full migration package (source + DB + files)
  .get('/admin/backup/export/migration', async (c) => {
    const pw = c.req.header('x-admin-password') ?? c.req.query('pw');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    try {
      const zipData = await buildMigrationPackage();
      const filename = `TLS-Trainer-migration-${new Date().toISOString().slice(0,10)}.zip`;
      return new Response(zipData, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (e: any) {
      return c.json({ error: e?.message ?? 'Migration export failed' }, 500);
    }
  })

  // POST /admin/backup/import — restore from uploaded JSON backup file
  .post('/admin/backup/import', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return c.json({ error: 'No file provided' }, 400);
      if (file.size > 200 * 1024 * 1024) return c.json({ error: 'File too large (max 200MB)' }, 400);
      const text = await file.text();
      const result = await restoreFromJSON(text);
      if (!result.ok) return c.json(result, 400);
      sendTelegram({ type: 'admin_alert', message: `♻️ Admin restored database from uploaded file (${file.name})` });
      return c.json({ ok: true, tablesRestored: result.tablesRestored }, 200);
    } catch (e: any) {
      return c.json({ error: e?.message ?? 'Import failed' }, 500);
    }
  })

  // GET /admin/backup/stats — storage usage + last backup info
  .get('/admin/backup/stats', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const rows = await sql(`SELECT label, created_at, size_bytes FROM backups ORDER BY created_at DESC`);
    const totalBytes = (rows as { size_bytes: number }[]).reduce((s, r) => s + (r.size_bytes || 0), 0);
    const lastBackup = rows[0] ?? null;
    const counts = { manual: 0, daily: 0, weekly: 0, 'pre-restore': 0 } as Record<string, number>;
    for (const r of rows) counts[(r.label as string)] = (counts[(r.label as string)] ?? 0) + 1;
    return c.json({ totalBytes, totalBackups: rows.length, lastBackup, counts }, 200);
  })

  // GET/POST /admin/telegram
  .get('/admin/telegram', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    return c.json(getTelegramConfig(), 200);
  })
  .post('/admin/telegram', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json().catch(() => ({})) as { botToken?: string; chatId?: string; enabled?: boolean };
    const patch: Record<string, unknown> = {};
    if (body.chatId !== undefined) patch.chatId = body.chatId;
    if (body.enabled !== undefined) patch.enabled = body.enabled;
    if (body.botToken && body.botToken.trim() !== "" && !body.botToken.includes("•")) patch.botToken = body.botToken.trim();
    setTelegramConfig(patch as any);
    return c.json({ ok: true }, 200);
  })
  .post('/admin/telegram/test', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const result = await sendTelegram({ type: "test" });
    return c.json(result, result.ok ? 200 : 400);
  })

  // ── Telegram Webhook (bot receives messages) ───────────────────────────────
  // POST /api/telegram/webhook — called by Telegram servers
  .post('/telegram/webhook', async (c) => {
    // Validate secret token if set
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret) {
      const header = c.req.header('x-telegram-bot-api-secret-token');
      if (header !== secret) return c.json({ ok: false }, 403);
    }
    try {
      const update = await c.req.json() as {
        update_id: number;
        message?: {
          message_id: number;
          from?: { id: number; first_name?: string; username?: string };
          chat: { id: number; type: string };
          text?: string;
          date: number;
        };
        callback_query?: {
          id: string;
          from: { id: number; first_name?: string };
          message?: { chat: { id: number } };
          data?: string;
        };
      };

      const cfg = getTelegramConfig();
      const botToken = (process.env.TELEGRAM_BOT_TOKEN ?? "");

      // Handle text messages
      if (update.message?.text && botToken) {
        const msg = update.message;
        const chatId = msg.chat.id;
        const text = msg.text.trim();
        const from = msg.from?.first_name ?? "User";

        let reply = "";

        if (text === "/start" || text === "/help") {
          reply =
            `👋 *TLS Trainer Bot*\n\n` +
            `Available commands:\n` +
            `/status — system status\n` +
            `/trainees — active trainee count\n` +
            `/test — send test notification\n` +
            `/help — this message`;
        } else if (text === "/status") {
          reply = `✅ *TLS Trainer is online*\n⏱ ${new Date().toLocaleString("en-SA", { timeZone: "Asia/Riyadh" })}`;
        } else if (text === "/trainees") {
          try {
            const rows = await sql(`SELECT COUNT(*) as cnt FROM trainees WHERE status='active'`, []);
            const cnt = (rows[0] as any)?.cnt ?? 0;
            reply = `👥 *Active Trainees:* ${cnt}`;
          } catch {
            reply = `❌ Could not fetch trainee count.`;
          }
        } else if (text === "/test") {
          await sendTelegram({ type: "test" });
          reply = `🔔 Test notification sent!`;
        } else {
          reply = `❓ Unknown command. Type /help for available commands.`;
        }

        if (reply) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: reply,
              parse_mode: "Markdown",
            }),
          });
        }
      }

      return c.json({ ok: true }, 200);
    } catch (e: any) {
      console.error("Telegram webhook error:", e?.message);
      return c.json({ ok: false, error: e?.message }, 200); // always 200 to Telegram
    }
  })

  // ── Evaluation endpoints ───────────────────────────────────────────────────
  // GET /admin/evaluation/:id — get trainee evaluation
  .get('/admin/evaluation/:id', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const rows = await sql(`SELECT rating, recommendation, technical_observations, updated_at FROM trainee_evaluations WHERE trainee_id=?`, [id]);
    return c.json(rows[0] ?? null, 200);
  })

  // POST /admin/evaluation — upsert trainee evaluation
  .post('/admin/evaluation', async (c) => {
    const pw = c.req.header('x-admin-password');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json().catch(() => ({})) as {
      traineeId?: string; rating?: string; recommendation?: string; technical_observations?: string;
    };
    if (!body.traineeId) return c.json({ error: 'traineeId required' }, 400);
    const { traineeId, rating = 'pending', recommendation = '', technical_observations = '' } = body;
    const validRatings = ['pending', 'excellent', 'good', 'weak', 'needs_review'];
    if (!validRatings.includes(rating)) return c.json({ error: 'Invalid rating' }, 400);
    const now = Date.now();
    const existing = await sql(`SELECT id FROM trainee_evaluations WHERE trainee_id=?`, [traineeId]);
    if (existing.length > 0) {
      await sqlRun(`UPDATE trainee_evaluations SET rating=?, recommendation=?, technical_observations=?, updated_at=? WHERE trainee_id=?`,
        [rating, recommendation, technical_observations, now, traineeId]);
    } else {
      await sqlRun(`INSERT INTO trainee_evaluations (trainee_id, rating, recommendation, technical_observations, admin_id, updated_at) VALUES (?, ?, ?, ?, 'admin', ?)`,
        [traineeId, rating, recommendation, technical_observations, now]);
    }
    const [tr] = await sql(`SELECT name FROM trainees WHERE id=?`, [traineeId]);
    const tName = (tr?.name as string) ?? traineeId;
    const ratingLabel = rating === 'excellent' ? '⭐⭐⭐ Excellent' : rating === 'good' ? '⭐⭐ Good' : rating === 'weak' ? '⚠️ Weak' : rating === 'needs_review' ? '🔍 Needs Review' : 'Pending';
    sendTelegram({ type: 'admin_alert', message: `📋 Evaluation updated for ${tName}: ${ratingLabel}` });
    return c.json({ ok: true }, 200);
  })

  // ── Trainee self-report endpoint ───────────────────────────────────────────
  // GET /trainee/report/:id — trainee views their own report (session-gated)
  .get('/trainee/report/:id', async (c) => {
    const id = c.req.param('id');
    // Verify session matches requested ID
    const sessionHeader = c.req.header('x-trainee-id');
    if (sessionHeader !== id) return c.json({ error: 'Unauthorized' }, 401);

    const traineesRows = await sql(
      `SELECT id, name, rank, unit, created_at, last_login_at, login_count, last_active_at, status, xp, level FROM trainees WHERE id=?`, [id]
    );
    if (!traineesRows.length) return c.json({ error: 'Not found' }, 404);
    const t = traineesRows[0];

    const attempts = await sql(`SELECT module_id, module_name, pct, passed, ts FROM quiz_attempts WHERE trainee_id=? ORDER BY ts DESC`, [id]);
    const progress = await sql(`SELECT module_id, module_name, progress, completed, last_accessed_at FROM trainee_module_progress WHERE trainee_id=? ORDER BY module_id`, [id]);
    const evaluation = await sql(`SELECT rating, recommendation, technical_observations, updated_at FROM trainee_evaluations WHERE trainee_id=?`, [id]);
    const timeLogs = await sql(`SELECT module_id, module_name, SUM(duration_ms) as total_ms FROM module_time_log WHERE trainee_id=? GROUP BY module_id`, [id]);
    const manualLogs = await sql(`SELECT manual_name, COUNT(*) as view_count FROM manual_view_log WHERE trainee_id=? GROUP BY manual_name`, [id]);

    const totalAttempts = attempts.length;
    const passedAttempts = attempts.filter((a: Record<string, unknown>) => a.passed === 1).length;
    const avgScore = attempts.length > 0 ? Math.round(attempts.reduce((s: number, a: Record<string, unknown>) => s + (a.pct as number), 0) / attempts.length) : 0;
    const completedModules = progress.filter((p: Record<string, unknown>) => p.completed === 1).length;
    const totalTrainingMs = timeLogs.reduce((s: number, t: Record<string, unknown>) => s + (t.total_ms as number), 0);
    const trainingHours = Math.round((totalTrainingMs / 3600000) * 10) / 10;

    return c.json({
      trainee: t,
      stats: { totalAttempts, passedAttempts, failedAttempts: totalAttempts - passedAttempts, avgScore, completedModules, trainingHours },
      quizAttempts: attempts,
      moduleProgress: progress,
      evaluation: evaluation[0] ?? null,
      manualLogs,
    }, 200);
  })

  // ── Time tracking endpoints ────────────────────────────────────────────────
  // POST /trainee/time — log time spent in a module
  .post('/trainee/time', async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      traineeId?: string; moduleId?: number; moduleName?: string; durationMs?: number;
    };
    if (!body.traineeId || body.moduleId == null || !body.durationMs) return c.json({ ok: false }, 200);
    if (body.durationMs < 3000) return c.json({ ok: false }, 200); // ignore < 3s
    await sqlRun(
      `INSERT INTO module_time_log (trainee_id, module_id, module_name, duration_ms, ts) VALUES (?, ?, ?, ?, ?)`,
      [body.traineeId, body.moduleId, body.moduleName ?? '', body.durationMs, Date.now()]
    );
    // Check total time milestone → Telegram
    const totalRows = await sql(`SELECT SUM(duration_ms) as total FROM module_time_log WHERE trainee_id=?`, [body.traineeId]);
    const totalMs = (totalRows[0]?.total as number) ?? 0;
    const totalHours = totalMs / 3600000;
    const [tr] = await sql(`SELECT name FROM trainees WHERE id=?`, [body.traineeId]);
    const tName = (tr?.name as string) ?? body.traineeId;
    // Send milestone alerts at 1h, 5h, 10h
    for (const milestone of [1, 5, 10]) {
      const prevMs = totalMs - body.durationMs;
      if (prevMs / 3600000 < milestone && totalHours >= milestone) {
        sendTelegram({ type: 'admin_alert', message: `⏱️ Training milestone: ${tName} reached ${milestone} hour${milestone > 1 ? 's' : ''} of training` });
      }
    }
    return c.json({ ok: true }, 200);
  })

  // POST /trainee/manual-view — log manual/PDF view
  .post('/trainee/manual-view', async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      traineeId?: string; manualName?: string; fileName?: string; durationMs?: number;
    };
    if (!body.traineeId || !body.manualName) return c.json({ ok: false }, 200);
    await sqlRun(
      `INSERT INTO manual_view_log (trainee_id, manual_name, file_name, duration_ms, ts) VALUES (?, ?, ?, ?, ?)`,
      [body.traineeId, body.manualName, body.fileName ?? '', body.durationMs ?? 0, Date.now()]
    );
    // Also log as activity_log event
    await logActivity(body.traineeId, 'manual_view', { manualName: body.manualName, fileName: body.fileName });
    const [tr] = await sql(`SELECT name FROM trainees WHERE id=?`, [body.traineeId]);
    const tName = (tr?.name as string) ?? body.traineeId;
    sendTelegram({ type: 'admin_alert', message: `📖 ${tName} viewed manual: ${body.manualName}` });
    return c.json({ ok: true }, 200);
  })

  // ── Admin full report data endpoint ────────────────────────────────────────
  // GET /admin/report/:id — full report JSON for PDF generation
  .get('/admin/report/:id', async (c) => {
    const pw = c.req.header('x-admin-password') ?? c.req.query('pw');
    if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');

    const traineesRows = await sql(
      `SELECT id, name, rank, unit, created_at, last_login_at, login_count, last_active_at, status, xp, level FROM trainees WHERE id=?`, [id]
    );
    if (!traineesRows.length) return c.json({ error: 'Not found' }, 404);
    const t = traineesRows[0];

    const attempts = await sql(`SELECT module_id, module_name, score, total, pct, passed, ts FROM quiz_attempts WHERE trainee_id=? ORDER BY ts DESC`, [id]);
    const progress = await sql(`SELECT module_id, module_name, progress, completed, last_accessed_at FROM trainee_module_progress WHERE trainee_id=? ORDER BY module_id`, [id]);
    const notes = await sql(`SELECT note, ts FROM instructor_notes WHERE trainee_id=? ORDER BY ts DESC LIMIT 10`, [id]);
    const evaluation = await sql(`SELECT rating, recommendation, technical_observations, updated_at FROM trainee_evaluations WHERE trainee_id=?`, [id]);
    const timeLogs = await sql(`SELECT module_id, module_name, SUM(duration_ms) as total_ms FROM module_time_log WHERE trainee_id=? GROUP BY module_id`, [id]);
    const manualLogs = await sql(`SELECT manual_name, COUNT(*) as view_count, SUM(duration_ms) as total_ms FROM manual_view_log WHERE trainee_id=? GROUP BY manual_name`, [id]);
    const totalMods = await sql(`SELECT COUNT(*) as cnt FROM modules WHERE is_published=1`);

    const totalAttempts = attempts.length;
    const passedAttempts = attempts.filter((a: Record<string, unknown>) => a.passed === 1).length;
    const failedAttempts = totalAttempts - passedAttempts;
    const avgScore = attempts.length > 0 ? Math.round(attempts.reduce((s: number, a: Record<string, unknown>) => s + (a.pct as number), 0) / attempts.length) : 0;
    const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a: Record<string, unknown>) => a.pct as number)) : 0;
    const completedModules = progress.filter((p: Record<string, unknown>) => p.completed === 1).length;
    const totalModuleCount = (totalMods[0]?.cnt as number) ?? 0;
    const totalTrainingMs = timeLogs.reduce((s: number, tl: Record<string, unknown>) => s + (tl.total_ms as number), 0);
    const trainingHours = Math.round((totalTrainingMs / 3600000) * 10) / 10;

    return c.json({
      trainee: { ...t, online: isOnline(id) },
      stats: {
        totalAttempts, passedAttempts, failedAttempts, avgScore, bestScore,
        completedModules, totalModuleCount, trainingHours,
      },
      quizAttempts: attempts,
      moduleProgress: progress,
      notes,
      evaluation: evaluation[0] ?? null,
      timeLogs,
      manualLogs,
      generatedAt: Date.now(),
    }, 200);
  });

// ── Common Faults ──────────────────────────────────────────────────────────────

// GET /faults — list all faults (no media data, just metadata)
app.get('/faults', async (c) => {
  const rows = await sql(`SELECT id, title, cause, solution, created_at FROM common_faults ORDER BY id DESC`);
  // attach media list per fault (id, mime_type, filename, sort_order — no data)
  const faultIds = (rows as any[]).map((r: any) => r.id);
  let mediaRows: any[] = [];
  if (faultIds.length > 0) {
    const placeholders = faultIds.map(() => '?').join(',');
    mediaRows = await sql(`SELECT id, fault_id, mime_type, filename, sort_order FROM fault_media WHERE fault_id IN (${placeholders}) ORDER BY sort_order ASC, id ASC`, faultIds);
  }
  const faults = (rows as any[]).map((f: any) => ({
    ...f,
    media: (mediaRows as any[]).filter((m: any) => m.fault_id === f.id),
  }));
  return c.json(faults, 200);
});

// GET /faults/:id/media/:mediaId — stream a single media file
app.get('/faults/:id/media/:mediaId', async (c) => {
  const mediaId = c.req.param('mediaId');
  const [row] = await sql(`SELECT media_data, mime_type, filename FROM fault_media WHERE id=?`, [mediaId]);
  if (!row) return c.json({ error: 'Not found' }, 404);
  const r = row as any;
  const buf = Buffer.from(r.media_data as string, 'base64');
  return new Response(buf, { headers: { 'Content-Type': r.mime_type, 'Cache-Control': 'public,max-age=86400' } });
});

// POST /admin/faults — create fault (title, cause, solution)
app.post('/admin/faults', async (c) => {
  const pw = c.req.header('x-admin-pw') ?? '';
  if (pw !== (process.env.ADMIN_PASSWORD ?? 'TLS319522')) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  const { title, cause, solution } = body as any;
  if (!title || !cause || !solution) return c.json({ error: 'Missing fields' }, 400);
  const now = Date.now();
  await sqlRun(`INSERT INTO common_faults (title, cause, solution, created_at) VALUES (?,?,?,?)`, [title, cause, solution, now]);
  const [row] = await sql(`SELECT id FROM common_faults WHERE rowid=last_insert_rowid()`);
  return c.json({ id: (row as any).id }, 201);
});

// PATCH /admin/faults/:id — update title/cause/solution
app.patch('/admin/faults/:id', async (c) => {
  const pw = c.req.header('x-admin-pw') ?? '';
  if (pw !== (process.env.ADMIN_PASSWORD ?? 'TLS319522')) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const body = await c.req.json();
  const fields: string[] = [];
  const vals: any[] = [];
  if (body.title !== undefined) { fields.push('title=?'); vals.push(body.title); }
  if (body.cause !== undefined) { fields.push('cause=?'); vals.push(body.cause); }
  if (body.solution !== undefined) { fields.push('solution=?'); vals.push(body.solution); }
  if (fields.length === 0) return c.json({ error: 'Nothing to update' }, 400);
  vals.push(id);
  await sqlRun(`UPDATE common_faults SET ${fields.join(',')} WHERE id=?`, vals);
  return c.json({ ok: true }, 200);
});

// DELETE /admin/faults/:id — delete fault + cascade media
app.delete('/admin/faults/:id', async (c) => {
  const pw = c.req.header('x-admin-pw') ?? '';
  if (pw !== (process.env.ADMIN_PASSWORD ?? 'TLS319522')) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  await sqlRun(`DELETE FROM fault_media WHERE fault_id=?`, [id]);
  await sqlRun(`DELETE FROM common_faults WHERE id=?`, [id]);
  return c.json({ ok: true }, 200);
});

// POST /admin/faults/:id/media — add media to a fault (base64)
app.post('/admin/faults/:id/media', async (c) => {
  const pw = c.req.header('x-admin-pw') ?? '';
  if (pw !== (process.env.ADMIN_PASSWORD ?? 'TLS319522')) return c.json({ error: 'Unauthorized' }, 401);
  const faultId = c.req.param('id');
  const body = await c.req.json();
  const { media_data, mime_type, filename, sort_order } = body as any;
  if (!media_data || !mime_type) return c.json({ error: 'Missing fields' }, 400);
  const now = Date.now();
  await sqlRun(
    `INSERT INTO fault_media (fault_id, media_data, mime_type, filename, sort_order, created_at) VALUES (?,?,?,?,?,?)`,
    [faultId, media_data, mime_type, filename ?? '', sort_order ?? 0, now]
  );
  const [row] = await sql(`SELECT id FROM fault_media WHERE rowid=last_insert_rowid()`);
  return c.json({ id: (row as any).id }, 201);
});

// DELETE /admin/faults/media/:mediaId — remove one media item
app.delete('/admin/faults/media/:mediaId', async (c) => {
  const pw = c.req.header('x-admin-pw') ?? '';
  if (pw !== (process.env.ADMIN_PASSWORD ?? 'TLS319522')) return c.json({ error: 'Unauthorized' }, 401);
  const mediaId = c.req.param('mediaId');
  await sqlRun(`DELETE FROM fault_media WHERE id=?`, [mediaId]);
  return c.json({ ok: true }, 200);
});

// ══════════════════════════════════════════════════════════════════════════════
// SIMULATOR ADMIN ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

const simAuth = (c: any) => {
  const pw = c.req.header('x-admin-password') ?? c.req.header('x-admin-pw') ?? '';
  return pw === (process.env.ADMIN_PASSWORD ?? 'TLS319522');
};

// GET /api/simulator/config — public, read-only (used by simulator.html)
app.get('/simulator/config', async (c) => {
  const rows = await sql(`SELECT key, value FROM simulator_config`);
  const cfg: Record<string, string> = {};
  for (const r of rows as any[]) cfg[r.key] = r.value;
  return c.json(cfg, 200);
});

// GET /api/simulator/broadcast — latest active broadcast (used by simulator.html polling)
app.get('/simulator/broadcast', async (c) => {
  const now = Date.now();
  const rows = await sql(
    `SELECT id, message, type, created_at FROM simulator_broadcast
     WHERE (expires_at IS NULL OR expires_at > ?)
     ORDER BY created_at DESC LIMIT 1`,
    [now]
  );
  return c.json(rows[0] ?? null, 200);
});

// POST /api/simulator/session — trainee reports session start/end
app.post('/simulator/session', async (c) => {
  const body = await c.req.json().catch(() => ({})) as any;
  const { traineeId, traineeName, mode, scenarioId, action, score } = body;
  if (!traineeId) return c.json({ error: 'Missing traineeId' }, 400);
  const now = Date.now();
  if (action === 'start') {
    await sqlRun(
      `INSERT INTO simulator_sessions (trainee_id, trainee_name, mode, scenario_id, started_at) VALUES (?,?,?,?,?)`,
      [traineeId, traineeName ?? traineeId, mode ?? 'PAR', scenarioId ?? null, now]
    );
    const [row] = await sql(`SELECT id FROM simulator_sessions WHERE rowid=last_insert_rowid()`);
    return c.json({ ok: true, sessionId: (row as any).id }, 201);
  } else if (action === 'end') {
    const { sessionId, passed } = body;
    if (!sessionId) return c.json({ error: 'Missing sessionId' }, 400);
    const [sess] = await sql(`SELECT started_at FROM simulator_sessions WHERE id=?`, [sessionId]);
    const dur = sess ? now - (sess as any).started_at : 0;
    await sqlRun(
      `UPDATE simulator_sessions SET ended_at=?, duration_ms=?, score=?, passed=? WHERE id=?`,
      [now, dur, score ?? null, passed ? 1 : 0, sessionId]
    );
    return c.json({ ok: true }, 200);
  }
  return c.json({ error: 'Unknown action' }, 400);
});

// ── Admin: config ─────────────────────────────────────────────────────────────
app.get('/admin/simulator/config', async (c) => {
  if (!simAuth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const rows = await sql(`SELECT key, value FROM simulator_config`);
  const cfg: Record<string, string> = {};
  for (const r of rows as any[]) cfg[r.key] = r.value;
  return c.json(cfg, 200);
});

app.post('/admin/simulator/config', async (c) => {
  if (!simAuth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => ({})) as Record<string, string>;
  for (const [k, v] of Object.entries(body)) {
    await sqlRun(`INSERT OR REPLACE INTO simulator_config (key, value) VALUES (?,?)`, [k, String(v)]);
  }
  return c.json({ ok: true }, 200);
});

// ── Admin: live users ─────────────────────────────────────────────────────────
app.get('/admin/simulator/live', async (c) => {
  if (!simAuth(c)) return c.json({ error: 'Unauthorized' }, 401);
  // Use heartbeat data — trainees currently online on a simulator page
  const rows = await sql(
    `SELECT id as trainee_id, name as trainee_name, last_page as mode, last_active_at as started_at, is_online
     FROM trainees
     WHERE is_online=1 AND (last_page LIKE '%simulator%' OR last_page LIKE '%/sim%')
     ORDER BY last_active_at DESC`
  );
  return c.json(rows, 200);
});

// ── Admin: statistics ─────────────────────────────────────────────────────────
app.get('/admin/simulator/stats', async (c) => {
  if (!simAuth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const [totals] = await sql(`SELECT COUNT(*) as total_sessions, AVG(duration_ms) as avg_duration, SUM(passed) as passed_count FROM simulator_sessions WHERE ended_at IS NOT NULL`);
  const byTrainee = await sql(
    `SELECT s.trainee_id, s.trainee_name, COUNT(*) as sessions, AVG(s.score) as avg_score,
            SUM(s.duration_ms) as total_ms, SUM(s.passed) as passed, MAX(s.started_at) as last_at
     FROM simulator_sessions s
     GROUP BY s.trainee_id ORDER BY last_at DESC LIMIT 100`
  );
  const byMode = await sql(
    `SELECT mode, COUNT(*) as cnt FROM simulator_sessions GROUP BY mode`
  );
  const recent = await sql(
    `SELECT s.id, s.trainee_name, s.mode, s.score, s.passed, s.started_at, s.duration_ms,
            sc.name as scenario_name
     FROM simulator_sessions s
     LEFT JOIN simulator_scenarios sc ON sc.id = s.scenario_id
     ORDER BY s.started_at DESC LIMIT 50`
  );
  return c.json({ totals, byTrainee, byMode, recent }, 200);
});

// ── Admin: scenarios ─────────────────────────────────────────────────────────
app.get('/admin/simulator/scenarios', async (c) => {
  if (!simAuth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const rows = await sql(`SELECT * FROM simulator_scenarios ORDER BY created_at DESC`);
  return c.json(rows, 200);
});

app.post('/admin/simulator/scenarios', async (c) => {
  if (!simAuth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => ({})) as any;
  const { name, description, aircraft_count, speed_multiplier, weather, wind_speed, wind_direction, difficulty, pass_score } = body;
  if (!name) return c.json({ error: 'Missing name' }, 400);
  const now = Date.now();
  await sqlRun(
    `INSERT INTO simulator_scenarios (name, description, aircraft_count, speed_multiplier, weather, wind_speed, wind_direction, difficulty, pass_score, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [name, description ?? '', aircraft_count ?? 3, speed_multiplier ?? 1.0, weather ?? 'clear', wind_speed ?? 0, wind_direction ?? 0, difficulty ?? 'medium', pass_score ?? 70, now]
  );
  const [row] = await sql(`SELECT id FROM simulator_scenarios WHERE rowid=last_insert_rowid()`);
  return c.json({ ok: true, id: (row as any).id }, 201);
});

app.put('/admin/simulator/scenarios/:id', async (c) => {
  if (!simAuth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({})) as any;
  const fields: string[] = [];
  const vals: any[] = [];
  const allowed = ['name','description','aircraft_count','speed_multiplier','weather','wind_speed','wind_direction','difficulty','pass_score','active'];
  for (const f of allowed) {
    if (body[f] !== undefined) { fields.push(`${f}=?`); vals.push(body[f]); }
  }
  if (!fields.length) return c.json({ error: 'Nothing to update' }, 400);
  vals.push(id);
  await sqlRun(`UPDATE simulator_scenarios SET ${fields.join(',')} WHERE id=?`, vals);
  return c.json({ ok: true }, 200);
});

app.delete('/admin/simulator/scenarios/:id', async (c) => {
  if (!simAuth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  await sqlRun(`DELETE FROM simulator_scenarios WHERE id=?`, [id]);
  return c.json({ ok: true }, 200);
});

// ── Admin: broadcast ─────────────────────────────────────────────────────────
app.get('/admin/simulator/broadcasts', async (c) => {
  if (!simAuth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const rows = await sql(`SELECT * FROM simulator_broadcast ORDER BY created_at DESC LIMIT 20`);
  return c.json(rows, 200);
});

app.post('/admin/simulator/broadcast', async (c) => {
  if (!simAuth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => ({})) as any;
  const { message, type, duration_minutes } = body;
  if (!message) return c.json({ error: 'Missing message' }, 400);
  const now = Date.now();
  const expires = duration_minutes ? now + duration_minutes * 60000 : null;
  await sqlRun(
    `INSERT INTO simulator_broadcast (message, type, created_by, created_at, expires_at) VALUES (?,?,?,?,?)`,
    [message, type ?? 'info', 'admin', now, expires]
  );
  return c.json({ ok: true }, 200);
});

app.delete('/admin/simulator/broadcast/:id', async (c) => {
  if (!simAuth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  await sqlRun(`DELETE FROM simulator_broadcast WHERE id=?`, [id]);
  return c.json({ ok: true }, 200);
});

// ── Simulator: aircraft event (called from Replit) ───────────────────────────
app.post('/simulator/aircraft-event', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const { trainee_id, session_id, callsign, altitude_ft, heading_deg, event_type, ts } = body;
  if (!event_type || !callsign) return c.json({ error: 'Missing fields' }, 400);
  const now = ts ?? Date.now();
  await sqlRun(
    `INSERT INTO simulator_aircraft_events (session_id, trainee_id, callsign, altitude_ft, heading_deg, event_type, ts)
     VALUES (?,?,?,?,?,?,?)`,
    [session_id ?? null, trainee_id ?? null, callsign, altitude_ft ?? null, heading_deg ?? null, event_type, now]
  );
  return c.json({ ok: true }, 200);
});

// ── Admin: export report (Excel) ─────────────────────────────────────────────
app.get('/admin/simulator/export', async (c) => {
  if (!simAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  const sessions = await sql(
    `SELECT s.id, s.trainee_id, s.trainee_name, s.mode, s.score, s.passed, s.started_at, s.ended_at, s.duration_ms,
            sc.name as scenario_name, sc.difficulty
     FROM simulator_sessions s
     LEFT JOIN simulator_scenarios sc ON sc.id = s.scenario_id
     ORDER BY s.started_at DESC`
  );

  // For each session, fetch aircraft events grouped by callsign
  const sessionRows: any[] = [];
  for (const s of sessions as any[]) {
    const events = await sql(
      `SELECT callsign, altitude_ft, heading_deg, event_type, ts
       FROM simulator_aircraft_events
       WHERE session_id=?
       ORDER BY ts ASC`,
      [s.id]
    ) as any[];

    // Group events by callsign
    const byCallsign: Record<string, any> = {};
    for (const ev of events) {
      if (!byCallsign[ev.callsign]) byCallsign[ev.callsign] = { callsign: ev.callsign };
      if (ev.event_type === 'localizer_entry') {
        byCallsign[ev.callsign].altitude_ft = ev.altitude_ft;
        byCallsign[ev.callsign].heading_deg = ev.heading_deg;
        byCallsign[ev.callsign].localizer_entry_time = ev.ts ? new Date(ev.ts).toISOString() : '';
      }
      if (ev.event_type === 'gs_entry') {
        byCallsign[ev.callsign].gs_entry_time = ev.ts ? new Date(ev.ts).toISOString() : '';
      }
      if (ev.event_type === 'touchdown') {
        byCallsign[ev.callsign].touchdown_time = ev.ts ? new Date(ev.ts).toISOString() : '';
      }
    }

    const aircraft = Object.values(byCallsign);
    if (aircraft.length === 0) {
      // Session with no aircraft data → one row still
      sessionRows.push({
        'Trainee ID': s.trainee_id,
        'Trainee Name': s.trainee_name ?? '',
        Mode: s.mode,
        Scenario: s.scenario_name ?? 'Free',
        Difficulty: s.difficulty ?? '-',
        Score: s.score ?? '-',
        Passed: s.passed ? 'YES' : 'NO',
        Started: s.started_at ? new Date(s.started_at).toISOString() : '',
        'Duration (min)': s.duration_ms ? (s.duration_ms / 60000).toFixed(1) : '',
        Callsign: '',
        'Altitude (ft)': '',
        'Heading (°)': '',
        'Localizer Entry': '',
        'GS Entry': '',
        Touchdown: '',
      });
    } else {
      for (const ac of aircraft) {
        sessionRows.push({
          'Trainee ID': s.trainee_id,
          'Trainee Name': s.trainee_name ?? '',
          Mode: s.mode,
          Scenario: s.scenario_name ?? 'Free',
          Difficulty: s.difficulty ?? '-',
          Score: s.score ?? '-',
          Passed: s.passed ? 'YES' : 'NO',
          Started: s.started_at ? new Date(s.started_at).toISOString() : '',
          'Duration (min)': s.duration_ms ? (s.duration_ms / 60000).toFixed(1) : '',
          Callsign: ac.callsign ?? '',
          'Altitude (ft)': ac.altitude_ft ?? '',
          'Heading (°)': ac.heading_deg ?? '',
          'Localizer Entry': ac.localizer_entry_time ?? '',
          'GS Entry': ac.gs_entry_time ?? '',
          Touchdown: ac.touchdown_time ?? '',
        });
      }
    }
  }

  const ws = XLSX.utils.json_to_sheet(sessionRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sessions');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="simulator-report.xlsx"',
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SIMULATOR MESSAGES — trainee ↔ instructor chat
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/simulator/messages?trainee_id=X — returns messages for a trainee (marks admin msgs read)
app.get('/simulator/messages', async (c) => {
  const traineeId = c.req.query('trainee_id');
  if (!traineeId) return c.json({ error: 'trainee_id required' }, 400);
  const rows = await sql(
    `SELECT id, sender_role, text, read, ts FROM trainee_messages WHERE trainee_id=? ORDER BY ts ASC LIMIT 100`,
    [traineeId]
  );
  // mark admin messages as read (trainee has seen them)
  await sqlRun(`UPDATE trainee_messages SET read=1 WHERE trainee_id=? AND sender_role='admin' AND read=0`, [traineeId]);
  return c.json(rows, 200);
});

// POST /api/simulator/messages — trainee sends a message to instructor
app.post('/simulator/messages', async (c) => {
  const { trainee_id, text, session_id } = await c.req.json().catch(() => ({})) as {
    trainee_id?: string; text?: string; session_id?: string;
  };
  if (!trainee_id || !text?.trim()) return c.json({ error: 'trainee_id + text required' }, 400);
  await sqlRun(
    `INSERT INTO trainee_messages (trainee_id, sender_role, text, read, ts) VALUES (?, 'trainee', ?, 0, ?)`,
    [trainee_id, text.trim(), Date.now()]
  );
  const [tr] = await sql(`SELECT name FROM trainees WHERE id=?`, [trainee_id]);
  const tName = (tr?.name as string) ?? trainee_id;
  sendTelegram({ type: 'chat_message', traineeId: trainee_id, traineeName: tName, preview: `[SIM] ${text.trim().slice(0, 80)}` });
  return c.json({ ok: true }, 200);
});

// POST /api/admin/simulator/messages — instructor replies to a trainee
app.post('/admin/simulator/messages', async (c) => {
  if (!simAuth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const { trainee_id, text } = await c.req.json().catch(() => ({})) as { trainee_id?: string; text?: string };
  if (!trainee_id || !text?.trim()) return c.json({ error: 'trainee_id + text required' }, 400);
  await sqlRun(
    `INSERT INTO trainee_messages (trainee_id, sender_role, text, read, ts) VALUES (?, 'admin', ?, 0, ?)`,
    [trainee_id, text.trim(), Date.now()]
  );
  return c.json({ ok: true }, 200);
});

export type AppType = typeof app;
// ── NAV ITEMS API ──────────────────────────────────────────────────────────────

// GET /api/nav-items — public, returns visible items for trainees
app.get('/nav-items', async (c) => {
  const items = await sql(`SELECT * FROM nav_items ORDER BY sort_order ASC`);
  return c.json(items.map((i: any) => ({
    id: i.id, label: i.label, href: i.href, icon: i.icon,
    order: i.sort_order, isVisible: i.is_visible === 1,
  })));
});

// GET /api/admin/nav-items — admin only, returns all items
app.get('/admin/nav-items', async (c) => {
  const pw = c.req.header('x-admin-pw') ?? c.req.query('pw') ?? '';
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  const items = await sql(`SELECT * FROM nav_items ORDER BY sort_order ASC`);
  return c.json(items.map((i: any) => ({
    id: i.id, label: i.label, href: i.href, icon: i.icon,
    order: i.sort_order, isVisible: i.is_visible === 1,
  })));
});

// PUT /api/admin/nav-items — bulk update (order, visibility, label, icon)
app.put('/admin/nav-items', async (c) => {
  const pw = c.req.header('x-admin-pw') ?? c.req.query('pw') ?? '';
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  const updates = await c.req.json().catch(() => []) as { id: number; isVisible?: boolean; order?: number; label?: string; icon?: string }[];
  if (!Array.isArray(updates)) return c.json({ error: 'Expected array' }, 400);
  for (const item of updates) {
    const { id, isVisible, order, label, icon } = item;
    if (!id) continue;
    await sqlRun(
      `UPDATE nav_items SET is_visible=COALESCE(?,is_visible), sort_order=COALESCE(?,sort_order), label=COALESCE(?,label), icon=COALESCE(?,icon) WHERE id=?`,
      [isVisible === undefined ? null : isVisible ? 1 : 0, order ?? null, label ?? null, icon ?? null, id]
    );
  }
  const items = await sql(`SELECT * FROM nav_items ORDER BY sort_order ASC`);
  return c.json(items.map((i: any) => ({ id: i.id, label: i.label, href: i.href, icon: i.icon, order: i.sort_order, isVisible: i.is_visible === 1 })));
});

// POST /api/admin/nav-items — add new item
app.post('/admin/nav-items', async (c) => {
  const pw = c.req.header('x-admin-pw') ?? c.req.query('pw') ?? '';
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  const { label, href, icon, order } = await c.req.json().catch(() => ({})) as any;
  if (!label || !href || !icon) return c.json({ error: 'label, href and icon required' }, 400);
  const maxOrder = await sql(`SELECT MAX(sort_order) as m FROM nav_items`);
  const nextOrder = order ?? ((maxOrder[0] as any)?.m ?? 0) + 1;
  await sqlRun(`INSERT INTO nav_items (label, href, icon, sort_order, is_visible, created_at) VALUES (?,?,?,?,1,?)`,
    [label, href, icon, nextOrder, Date.now()]);
  const row = await sql(`SELECT * FROM nav_items ORDER BY id DESC LIMIT 1`);
  const i = row[0] as any;
  return c.json({ id: i.id, label: i.label, href: i.href, icon: i.icon, order: i.sort_order, isVisible: true }, 201);
});

// DELETE /api/admin/nav-items/:id
app.delete('/admin/nav-items/:id', async (c) => {
  const pw = c.req.header('x-admin-pw') ?? c.req.query('pw') ?? '';
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  const id = parseInt(c.req.param('id'));
  await sqlRun(`DELETE FROM nav_items WHERE id=?`, [id]);
  return c.json({ ok: true });
});


// ── Error Code Media ─────────────────────────────────────────────────────────

// GET /api/error-codes/:id/media — list media metadata for one code
app.get('/error-codes/:id/media', async (c) => {
  const id = c.req.param('id');
  const rows = await sql(
    `SELECT id, mime_type, filename, sort_order FROM error_code_media WHERE error_code_id=? ORDER BY sort_order ASC, id ASC`,
    [id]
  );
  return c.json(rows, 200);
});

// GET /api/error-codes/:id/media/:mediaId — stream image data
app.get('/error-codes/:id/media/:mediaId', async (c) => {
  const mediaId = c.req.param('mediaId');
  const [row] = await sql(`SELECT media_data, mime_type, filename FROM error_code_media WHERE id=?`, [mediaId]);
  if (!row) return c.json({ error: 'Not found' }, 404);
  const r = row as any;
  const buf = Buffer.from(r.media_data as string, 'base64');
  return new Response(buf, { headers: { 'Content-Type': r.mime_type, 'Content-Disposition': `inline; filename="${r.filename ?? 'image'}"`, 'Cache-Control': 'public, max-age=31536000' } });
});

// POST /api/admin/error-codes/:id/media — upload image (base64)
app.post('/admin/error-codes/:id/media', async (c) => {
  const pw = c.req.header('x-admin-pw') ?? '';
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  const ecId = c.req.param('id');
  const body = await c.req.json();
  const { media_data, mime_type, filename, sort_order } = body as any;
  if (!media_data || !mime_type) return c.json({ error: 'Missing fields' }, 400);
  await sqlRun(
    `INSERT INTO error_code_media (error_code_id, media_data, mime_type, filename, sort_order, created_at) VALUES (?,?,?,?,?,?)`,
    [ecId, media_data, mime_type, filename ?? '', sort_order ?? 0, Date.now()]
  );
  const [row] = await sql(`SELECT id FROM error_code_media WHERE rowid=last_insert_rowid()`);
  return c.json({ id: (row as any).id }, 201);
});

// DELETE /api/admin/error-codes/media/:mediaId — delete one image
app.delete('/admin/error-codes/media/:mediaId', async (c) => {
  const pw = c.req.header('x-admin-pw') ?? '';
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  const mediaId = c.req.param('mediaId');
  await sqlRun(`DELETE FROM error_code_media WHERE id=?`, [mediaId]);
  return c.json({ ok: true }, 200);
});

// ── Error Codes ──────────────────────────────────────────────────────────────

// GET /api/error-codes?q=101  — search by code or keyword
app.get('/error-codes', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  if (!q) return c.json([], 200);
  const like = `%${q}%`;
  const rows = await sql(
    `SELECT id, error_code, software_id, description, possible_reason, solution FROM error_codes
     WHERE error_code LIKE ? OR software_id LIKE ? OR description LIKE ? OR possible_reason LIKE ? OR solution LIKE ?
     ORDER BY CAST(error_code AS INTEGER) ASC, error_code ASC LIMIT 50`,
    [like, like, like, like, like]
  );
  return c.json(rows, 200);
});

// GET /api/admin/error-codes — list all
app.get('/admin/error-codes', async (c) => {
  const pw = c.req.header('x-admin-pw') ?? c.req.query('pw') ?? '';
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  const rows = await sql(`SELECT id, error_code, software_id, description, possible_reason, solution, created_at FROM error_codes ORDER BY CAST(error_code AS INTEGER) ASC, error_code ASC`);
  return c.json(rows, 200);
});

// POST /api/admin/error-codes — create
app.post('/admin/error-codes', async (c) => {
  const pw = c.req.header('x-admin-pw') ?? c.req.query('pw') ?? '';
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  const { error_code, software_id, description, possible_reason, solution } = await c.req.json().catch(() => ({})) as any;
  if (!error_code || !description) return c.json({ error: 'error_code and description are required' }, 400);
  await sqlRun('INSERT INTO error_codes (error_code, software_id, description, possible_reason, solution, created_at) VALUES (?,?,?,?,?,?)',
    [String(error_code), software_id ?? '', description, possible_reason ?? '', solution ?? '', Date.now()]);
  const row = await sql('SELECT * FROM error_codes ORDER BY id DESC LIMIT 1');
  return c.json(row[0], 201);
});

// PUT /api/admin/error-codes/:id — update
app.put('/admin/error-codes/:id', async (c) => {
  const pw = c.req.header('x-admin-pw') ?? c.req.query('pw') ?? '';
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  const id = parseInt(c.req.param('id'));
  const { error_code, software_id, description, possible_reason, solution } = await c.req.json().catch(() => ({})) as any;
  await sqlRun('UPDATE error_codes SET error_code=?, software_id=?, description=?, possible_reason=?, solution=? WHERE id=?',
    [error_code, software_id ?? '', description, possible_reason ?? '', solution ?? '', id]);
  const row = await sql('SELECT * FROM error_codes WHERE id=?', [id]);
  return c.json(row[0] ?? {}, 200);
});

// DELETE /api/admin/error-codes/:id — delete
app.delete('/admin/error-codes/:id', async (c) => {
  const pw = c.req.header('x-admin-pw') ?? c.req.query('pw') ?? '';
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  const id = parseInt(c.req.param('id'));
  await sqlRun('DELETE FROM error_codes WHERE id=?', [id]);
  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/documents — trainee: list docs shared with them (all or specific)
app.get('/documents', async (c) => {
  const traineeId = c.req.query('trainee_id') ?? '';
  // Get all docs shared with 'all', plus docs specifically shared with this trainee
  const docs = await sql(`
    SELECT d.id, d.title, d.filename, d.category, d.description, d.pages, d.size, d.mime_type, d.share_mode, d.created_at
    FROM documents d
    WHERE d.share_mode = 'all'
       OR (d.share_mode = 'specific' AND EXISTS (
         SELECT 1 FROM document_shares ds WHERE ds.document_id = d.id AND ds.trainee_id = ?
       ))
    ORDER BY d.created_at DESC
  `, [traineeId]);
  return c.json(docs, 200);
});

// GET /api/documents/:id/file — serve the PDF file
app.get('/documents/:id/file', async (c) => {
  const id = c.req.param('id');
  const rows = await sql('SELECT mime_type, filename, file_data FROM documents WHERE id=?', [id]);
  if (!(rows as any[]).length) return c.json({ error: 'Not found' }, 404);
  const row = (rows as any[])[0];
  // Blob lives in document_files after migration; fall back to documents.file_data
  // for any not-yet-migrated row.
  const fileRows = await sql('SELECT file_data FROM document_files WHERE document_id=?', [id]);
  const b64 = ((fileRows as any[])[0]?.file_data) || row.file_data || '';
  const buf = Buffer.from(b64, 'base64');
  // Filenames may contain non-Latin1 characters (e.g. Arabic). A raw non-Latin1
  // value in an HTTP header throws (→ 500), so send an ASCII fallback plus an
  // RFC 5987 UTF-8 filename* for correct display.
  const rawName = row.filename || 'document.pdf';
  const asciiName = rawName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
  // RFC 5987: encodeURIComponent leaves ' ( ) * unescaped, which are not valid
  // attr-chars in a filename* value, so percent-encode them too.
  const utf8Name = encodeURIComponent(rawName).replace(/['()*]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase());
  return new Response(buf, {
    headers: {
      'Content-Type': row.mime_type || 'application/pdf',
      'Content-Disposition': `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

// GET /api/admin/stats — quick system overview for admin settings
app.get('/admin/stats', async (c) => {
  const pw = c.req.header('x-admin-password');
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  const [traineesRow, docsRow, msgsRow, onlineRow] = await Promise.all([
    sql('SELECT COUNT(*) as n FROM trainees'),
    sql('SELECT COUNT(*) as n FROM documents'),
    sql('SELECT COUNT(*) as n FROM messages WHERE created_at > ?', [Date.now() - 86400000]),
    sql('SELECT COUNT(*) as n FROM trainees WHERE is_online=1'),
  ]);
  return c.json({
    totalTrainees: Number((traineesRow[0] as any)?.n ?? 0),
    totalDocuments: Number((docsRow[0] as any)?.n ?? 0),
    messagesToday: Number((msgsRow[0] as any)?.n ?? 0),
    onlineNow: Number((onlineRow[0] as any)?.n ?? 0),
  });
});

// GET /api/admin/audit — last 60 audit entries
app.get('/admin/audit', async (c) => {
  const pw = c.req.header('x-admin-password');
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  const rows = await sql('SELECT action, detail, ts FROM audit_log ORDER BY ts DESC LIMIT 60');
  return c.json(rows);
});

// GET /api/admin/documents — admin: list all docs
app.get('/admin/documents', async (c) => {
  const pw = c.req.header('x-admin-password');
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  try {
    // 25-second timeout so the handler always responds even if Turso is slow
    const dbTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB_TIMEOUT')), 25000)
    );
    const docsPromise = sql(`
      SELECT d.id, d.title, d.filename, d.category, d.description, d.pages,
             d.size, d.mime_type, d.share_mode, d.created_at, d.updated_at
      FROM documents d ORDER BY d.created_at DESC
    `);
    const docs = await Promise.race([docsPromise, dbTimeout]);
    // Fetch ALL shares in one query (avoids N+1 round-trips to Turso), then group.
    const sharesRows = (await Promise.race([
      sql('SELECT document_id, trainee_id FROM document_shares'),
      dbTimeout,
    ])) as any[];
    const sharesByDoc = new Map<string, string[]>();
    for (const s of sharesRows) {
      const k = String(s.document_id);
      const arr = sharesByDoc.get(k);
      if (arr) arr.push(s.trainee_id);
      else sharesByDoc.set(k, [s.trainee_id]);
    }
    const result = (docs as any[]).map((doc) => ({
      ...doc,
      sharedWith: doc.share_mode === 'specific' ? (sharesByDoc.get(String(doc.id)) || []) : [],
    }));
    return c.json(result, 200);
  } catch (e: any) {
    const msg = e?.message === 'DB_TIMEOUT' ? 'Database timeout — please retry' : String(e?.message || e);
    return c.json({ error: msg }, 500);
  }
});

// POST /api/admin/documents — upload new document
app.post('/admin/documents', rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: "Too many upload attempts — wait an hour" }), bodyLimit({ maxSize: 25 * 1024 * 1024, onError: (c) => c.json({ error: 'File too large (max 25MB)' }, 413) }), async (c) => {
  const pw = c.req.header('x-admin-password');
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  const formData = await c.req.formData().catch(() => null);
  if (!formData) return c.json({ error: 'Invalid form data' }, 400);

  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string) || '';
  const category = (formData.get('category') as string) || 'Technical';
  const description = (formData.get('description') as string) || '';
  const pages = parseInt(formData.get('pages') as string) || 0;
  const share_mode = (formData.get('share_mode') as string) || 'all';
  const sharedWith = (formData.get('shared_with') as string) || '';

  if (!file || !title) return c.json({ error: 'file and title required' }, 400);

  const arrayBuf = await file.arrayBuffer();
  const fileData = Buffer.from(arrayBuf).toString('base64');
  const now = Date.now();

  // Store metadata in documents with file_data='' (keeps rows small so list
  // queries stay fast); the blob goes into document_files.
  const res = await client.execute({
    sql: 'INSERT INTO documents (title, filename, category, description, pages, file_data, mime_type, size, share_mode, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    args: [title, file.name, category, description, pages, '', file.type || 'application/pdf', file.size, share_mode, now, now],
  });
  const docId = Number(res.lastInsertRowid);
  try {
    await sqlRun('INSERT INTO document_files (document_id, file_data) VALUES (?,?)', [docId, fileData]);
  } catch (e: any) {
    // No transaction across libsql HTTP calls: if blob storage fails, remove the
    // orphan metadata row so it can't show up as a broken/empty document.
    await sqlRun('DELETE FROM documents WHERE id=?', [docId]).catch(() => {});
    return c.json({ error: 'Failed to store file: ' + String(e?.message || e) }, 500);
  }

  // Add per-trainee shares if specific
  if (share_mode === 'specific' && sharedWith) {
    const ids = sharedWith.split(',').map(s => s.trim()).filter(Boolean);
    for (const tid of ids) {
      await sqlRun('INSERT OR IGNORE INTO document_shares (document_id, trainee_id) VALUES (?,?)', [docId, tid]).catch(() => {});
    }
  }
  await logAudit('document_upload', `id=${docId} title="${title}" size=${file.size}`);
  return c.json({ ok: true, id: docId }, 201);
});

// PUT /api/admin/documents/:id — update metadata + sharing
app.put('/admin/documents/:id', rateLimit({ windowMs: 60 * 60 * 1000, max: 30, message: "Too many update attempts — wait an hour" }), async (c) => {
  const pw = c.req.header('x-admin-password');
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({})) as any;
  const now = Date.now();

  await sqlRun(
    'UPDATE documents SET title=?, category=?, description=?, pages=?, share_mode=?, updated_at=? WHERE id=?',
    [body.title, body.category, body.description, body.pages || 0, body.share_mode || 'all', now, id]
  );

  // Update shares
  await sqlRun('DELETE FROM document_shares WHERE document_id=?', [id]);
  if (body.share_mode === 'specific' && Array.isArray(body.sharedWith)) {
    for (const tid of body.sharedWith) {
      await sqlRun('INSERT OR IGNORE INTO document_shares (document_id, trainee_id) VALUES (?,?)', [id, tid]).catch(() => {});
    }
  }
  return c.json({ ok: true }, 200);
});

// DELETE /api/admin/documents/:id
app.delete('/admin/documents/:id', rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: "Too many delete attempts — wait an hour" }), async (c) => {
  const pw = c.req.header('x-admin-password');
  if (pw !== ADMIN_PASSWORD) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  await sqlRun('DELETE FROM document_shares WHERE document_id=?', [id]);
  await sqlRun('DELETE FROM document_files WHERE document_id=?', [id]);
  await sqlRun('DELETE FROM documents WHERE id=?', [id]);
  await logAudit('document_delete', `id=${id}`);
  return c.json({ ok: true }, 200);
});

export default app;
