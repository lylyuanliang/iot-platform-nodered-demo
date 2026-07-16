import { pool } from "../db/pool.js";

export async function saveRawTelemetry({ eventId, deviceId, sourceType, topic, rawPayload }) {
  await pool.query(
    `INSERT INTO telemetry_raw_log
     (event_id, device_id, source_type, topic, raw_payload, received_at, parse_status)
     VALUES (?, ?, ?, ?, CAST(? AS JSON), NOW(), 'pending')`,
    [eventId, deviceId, sourceType, topic, JSON.stringify(rawPayload)]
  );
}

export async function saveNormalizedTelemetry({
  eventId,
  rawEventId = null,
  deviceId,
  productKey,
  eventType,
  properties = {},
  occurredAt,
  sourceType = "nodered",
  status = "online"
}) {
  await pool.query(
    `INSERT INTO telemetry_event
     (event_id, raw_event_id, device_id, product_key, event_type, properties_json, occurred_at, source_type)
     VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?)`,
    [eventId, rawEventId, deviceId, productKey, eventType, JSON.stringify(properties), occurredAt, sourceType]
  );
  await pool.query(
    `INSERT INTO device_latest_state
     (device_id, product_key, status, properties_json, last_event_id, last_report_at)
     VALUES (?, ?, ?, CAST(? AS JSON), ?, ?)
     ON DUPLICATE KEY UPDATE product_key = VALUES(product_key), status = VALUES(status),
       properties_json = VALUES(properties_json), last_event_id = VALUES(last_event_id),
       last_report_at = VALUES(last_report_at)`,
    [deviceId, productKey, status, JSON.stringify(properties), eventId, occurredAt]
  );
  await pool.query(
    "UPDATE device_instance SET status = ?, last_report_at = ? WHERE device_id = ?",
    [status, occurredAt, deviceId]
  );

  if (rawEventId) {
    await pool.query("UPDATE telemetry_raw_log SET parse_status = 'success', error_message = NULL WHERE event_id = ?", [rawEventId]);
  }
}

export async function saveInvalidData({ rawEventId, errorMessage = "Invalid telemetry data" }) {
  if (!rawEventId) return;

  await pool.query(
    "UPDATE telemetry_raw_log SET parse_status = 'failed', error_message = ? WHERE event_id = ?",
    [errorMessage, rawEventId]
  );
}
