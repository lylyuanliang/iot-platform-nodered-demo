import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.NODE_ENV = "test";
const { createApp } = await import("../src/index.js");

const calls = {
  confirmed: [],
  processing: [],
  instanceLookups: [],
  commands: [],
  published: []
};

const alarms = [
  { alarm_id: "ALARM-OPEN-001", device_id: "TEMP-SENSOR-001", status: "created", title: "High temperature" },
  { alarm_id: "ALARM-CLOSED-001", device_id: "TEMP-SENSOR-001", status: "closed", title: "Closed alarm" }
];

const app = createApp({
  businessDependencies: {
    async listOpenAlarms() {
      return alarms.filter((alarm) => alarm.status !== "closed");
    },
    async updateAlarmStatus(alarmId, status) {
      if (status === "confirmed") calls.confirmed.push(alarmId);
      if (status === "processing") calls.processing.push(alarmId);
    },
    async getDeviceState(deviceId) {
      if (deviceId === "CNC-001") return null;
      return { device_id: deviceId, status: "offline" };
    },
    async getDeviceInstance(deviceId) {
      calls.instanceLookups.push(deviceId);
      return { device_id: deviceId, status: deviceId === "CNC-001" ? "online" : "offline" };
    },
    async createCommand(command) {
      calls.commands.push(command);
    },
    async publishJson(topic, payload, key) {
      calls.published.push({ topic, payload, key });
    }
  }
});

test("GET /api/business/alarms returns non-closed alarms", async () => {
  const response = await request(app).get("/api/business/alarms");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.map((alarm) => alarm.alarm_id), ["ALARM-OPEN-001"]);
});

test("POST /api/business/alarms/:alarmId/confirm marks an alarm confirmed", async () => {
  const response = await request(app).post("/api/business/alarms/ALARM-OPEN-001/confirm").send();

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, alarmId: "ALARM-OPEN-001", status: "confirmed" });
  assert.equal(calls.confirmed.at(-1), "ALARM-OPEN-001");
});

test("POST /api/business/alarms/:alarmId/handle sends an online target command when latest state is missing", async () => {
  const response = await request(app)
    .post("/api/business/alarms/ALARM-OPEN-001/handle")
    .send({ action: "stopMachine" });

  assert.equal(response.status, 200);
  assert.equal(response.body.command.deviceId, "CNC-001");
  assert.equal(response.body.command.status, "sent");
  assert.equal(response.body.command.serviceCode, "stopMachine");
  assert.equal(calls.processing.at(-1), "ALARM-OPEN-001");
  assert.equal(calls.instanceLookups.at(-1), "CNC-001");
  assert.equal(calls.commands.at(-1).commandSource, "business");
  assert.equal(calls.commands.at(-1).sourceAlarmId, "ALARM-OPEN-001");
  assert.equal(calls.published.at(-1).topic, "iot.command.downlink");
  assert.equal(calls.published.at(-1).key, response.body.command.commandId);
});

test("POST /api/business/alarms/:alarmId/handle queues an offline target command", async () => {
  const response = await request(app)
    .post("/api/business/alarms/ALARM-OPEN-001/handle")
    .send({ action: "playVoice" });

  assert.equal(response.status, 200);
  assert.equal(response.body.command.deviceId, "VOICE-SPEAKER-001");
  assert.equal(response.body.command.status, "queued");
  assert.equal(calls.published.at(-1).payload.serviceCode, "stopMachine");
});

test("POST /api/business/alarms/:alarmId/handle rejects unknown actions", async () => {
  const response = await request(app)
    .post("/api/business/alarms/ALARM-OPEN-001/handle")
    .send({ action: "restartMachine" });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "unsupported business action");
});
