import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.NODE_ENV = "test";
const { createApp } = await import("../src/index.js");

const calls = {
  normalized: [],
  invalid: [],
  executions: [],
  alarms: [],
  commands: [],
  errors: []
};

const app = createApp({
  platformDependencies: {
    async saveNormalizedTelemetry(payload) {
      calls.normalized.push(payload);
    },
    async saveInvalidData(payload) {
      calls.invalid.push(payload);
    },
    async saveRuleExecution(payload) {
      calls.executions.push(payload);
    },
    async saveAlarm(payload) {
      calls.alarms.push(payload);
    },
    async createCommand(payload) {
      calls.commands.push(payload);
    },
    async saveRuleError(payload) {
      calls.errors.push(payload);
    }
  }
});

for (const [path, callKey, payload] of [
  ["/api/platform/telemetry/normalized", "normalized", { eventId: "NORM-001", temperature: 86.5 }],
  ["/api/platform/alarms", "alarms", { alarmId: "ALARM-001", alarmType: "HIGH_TEMPERATURE" }],
  ["/api/platform/rule-executions", "executions", { ruleCode: "HIGH_TEMP_AUTO_ALARM", matched: true }],
  ["/api/platform/commands", "commands", { commandId: "CMD-001", commandSource: "rule" }],
  ["/api/platform/rule-errors", "errors", { message: "node failed" }],
  ["/api/platform/invalid-data", "invalid", { rawEventId: "RAW-001", errorMessage: "temperature is required" }]
]) {
  test(`POST ${path} saves the Node-RED result`, async () => {
    const response = await request(app).post(path).send(payload);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true });
    assert.deepEqual(calls[callKey].at(-1), payload);
  });
}
