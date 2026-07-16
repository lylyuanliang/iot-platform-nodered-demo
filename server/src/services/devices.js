import { pool } from "../db/pool.js";

export async function listDevices() {
  const [rows] = await pool.query("SELECT * FROM device_instance ORDER BY id");
  return rows;
}

export async function getDeviceState(deviceId) {
  const [rows] = await pool.query(
    "SELECT * FROM device_latest_state WHERE device_id = ?",
    [deviceId]
  );
  return rows[0] ?? null;
}

export async function getDeviceInstance(deviceId) {
  const [rows] = await pool.query(
    "SELECT * FROM device_instance WHERE device_id = ?",
    [deviceId]
  );
  return rows[0] ?? null;
}
