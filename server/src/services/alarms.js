import { pool } from "../db/pool.js";

export async function listAlarms() {
  const [rows] = await pool.query("SELECT * FROM alarm_record ORDER BY created_at DESC, id DESC");
  return rows;
}

export async function listOpenAlarms() {
  const [rows] = await pool.query(
    "SELECT * FROM alarm_record WHERE status <> 'closed' ORDER BY created_at DESC, id DESC"
  );
  return rows;
}

export async function saveAlarm({
  alarmId,
  deviceId,
  productKey,
  alarmType,
  alarmLevel,
  title,
  detail = null,
  sourceEventId = null,
  sourceRuleCode = null,
  status = "created"
}) {
  await pool.query(
    `INSERT INTO alarm_record
     (alarm_id, device_id, product_key, alarm_type, alarm_level, title, detail, source_event_id, source_rule_code, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [alarmId, deviceId, productKey, alarmType, alarmLevel, title, detail, sourceEventId, sourceRuleCode, status]
  );
}

export async function updateAlarmStatus(alarmId, status) {
  await pool.query(
    `UPDATE alarm_record
     SET status = ?, handled_at = CASE WHEN ? IN ('confirmed', 'processing', 'closed') THEN NOW() ELSE handled_at END
     WHERE alarm_id = ?`,
    [status, status, alarmId]
  );
}
