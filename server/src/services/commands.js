import { pool } from "../db/pool.js";

export async function listCommands() {
  const [rows] = await pool.query("SELECT * FROM command_record ORDER BY created_at DESC, id DESC");
  return rows;
}

export async function createCommand({
  commandId,
  deviceId,
  productKey,
  serviceCode,
  commandSource,
  sourceAlarmId = null,
  requestPayload = {},
  status = commandSource === "rule" ? "sent" : "created"
}) {
  const sentAt = status === "sent" ? "NOW()" : "NULL";
  await pool.query(
    `INSERT INTO command_record
     (command_id, device_id, product_key, service_code, command_source, source_alarm_id, request_payload, status, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ${sentAt})`,
    [commandId, deviceId, productKey, serviceCode, commandSource, sourceAlarmId, JSON.stringify(requestPayload), status]
  );
  return { commandId, deviceId, productKey, serviceCode, commandSource, sourceAlarmId, requestPayload, status };
}

export async function listPendingCommands(deviceId) {
  const [rows] = await pool.query(
    `SELECT * FROM command_record
     WHERE device_id = ? AND status IN ('created', 'queued', 'sent')
     ORDER BY id`,
    [deviceId]
  );
  return rows;
}

export async function markCommandsRunning(commandIds) {
  if (commandIds.length === 0) return;

  await pool.query(
    `UPDATE command_record
     SET status = 'running', sent_at = COALESCE(sent_at, NOW())
     WHERE command_id IN (?) AND status IN ('created', 'queued', 'sent')`,
    [commandIds]
  );
}

export async function markCommandRunning(commandId) {
  await markCommandsRunning([commandId]);
}

export async function acknowledgeCommand({ commandId, deviceId = null, status, message = null, ackPayload, errorMessage = null }) {
  const finalErrorMessage = errorMessage ?? message;
  await pool.query(
    `UPDATE command_record
     SET status = ?, ack_payload = CAST(? AS JSON), ack_at = NOW(), error_message = ?
     WHERE command_id = ? AND (? IS NULL OR device_id = ?) AND status = 'running'`,
    [status, JSON.stringify(ackPayload ?? {}), finalErrorMessage, commandId, deviceId, deviceId]
  );

  if (status === "success") {
    await pool.query(
      `UPDATE alarm_record a
       JOIN command_record c ON c.source_alarm_id = a.alarm_id
       SET a.status = 'closed', a.handled_at = COALESCE(a.handled_at, NOW())
       WHERE c.command_id = ? AND c.command_source = 'business' AND c.source_alarm_id IS NOT NULL`,
      [commandId]
    );
  }
}
