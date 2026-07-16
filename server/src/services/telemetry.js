import { pool } from "../db/pool.js";

export async function listRawTelemetry() {
  const [rows] = await pool.query("SELECT * FROM telemetry_raw_log ORDER BY received_at DESC, id DESC");
  return rows;
}

export async function listTelemetryEvents() {
  const [rows] = await pool.query("SELECT * FROM telemetry_event ORDER BY occurred_at DESC, id DESC");
  return rows;
}
