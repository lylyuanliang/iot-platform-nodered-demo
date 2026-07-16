import { pool } from "../db/pool.js";

export async function listRuleExecutions() {
  const [rows] = await pool.query("SELECT * FROM rule_execution_log ORDER BY executed_at DESC, id DESC");
  return rows;
}

export async function saveRuleExecution({
  ruleCode,
  ruleName,
  flowName = null,
  nodeName = null,
  eventId = null,
  deviceId = null,
  matched = false,
  resultType,
  inputPayload = {},
  outputPayload = {},
  errorMessage = null,
  executedAt
}) {
  await pool.query(
    `INSERT INTO rule_execution_log
     (rule_code, rule_name, flow_name, node_name, event_id, device_id, matched, result_type,
      input_payload, output_payload, error_message, executed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?)`,
    [
      ruleCode,
      ruleName,
      flowName,
      nodeName,
      eventId,
      deviceId,
      matched,
      resultType,
      JSON.stringify(inputPayload),
      JSON.stringify(outputPayload),
      errorMessage,
      executedAt
    ]
  );
}

export async function saveRuleError({
  flowName = null,
  nodeName = null,
  eventId = null,
  deviceId = null,
  inputPayload = {},
  outputPayload = {},
  errorMessage,
  executedAt
}) {
  await saveRuleExecution({
    ruleCode: "NODE_RED_ERROR",
    ruleName: "Node-RED execution error",
    flowName,
    nodeName,
    eventId,
    deviceId,
    matched: false,
    resultType: "error",
    inputPayload,
    outputPayload,
    errorMessage,
    executedAt
  });
}
