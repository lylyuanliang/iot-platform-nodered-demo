import { pool } from "../db/pool.js";

export async function getDashboardSummary() {
  const [rows] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM device_instance) AS deviceCount,
      (SELECT COUNT(*) FROM device_instance WHERE status = 'online') AS onlineDeviceCount,
      (SELECT COUNT(*) FROM telemetry_raw_log WHERE DATE(received_at) = CURDATE()) AS todayMessageCount,
      (SELECT COUNT(*) FROM alarm_record WHERE status <> 'closed') AS activeAlarmCount,
      (SELECT COUNT(*) FROM command_record WHERE status = 'success') AS commandSuccessCount,
      (SELECT COUNT(*) FROM command_record WHERE status = 'failed') AS commandFailedCount
  `);
  return rows[0];
}
