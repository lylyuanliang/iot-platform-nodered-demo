import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.NODE_ENV = "test";
const { createApp } = await import("../src/index.js");

const calls = { saved: [], published: [], mqttPublished: [], acknowledged: [], markedRunning: [] };
const app = createApp({
  deviceDependencies: {
    async saveRawTelemetry(record) {
      calls.saved.push(record);
    },
    async listPendingCommands(deviceId) {
      return [{ command_id: "CMD-TEST-001", device_id: deviceId, status: "sent" }];
    },
    async markCommandsRunning(commandIds) {
      calls.markedRunning.push(commandIds);
    },
    async acknowledgeCommand(acknowledgement) {
      calls.acknowledged.push(acknowledgement);
    },
    async publishJson(topic, payload, key) {
      calls.published.push({ topic, payload, key });
    },
    async publishMqtt({ topic, payload }) {
      calls.mqttPublished.push({ topic, payload });
    }
  }
});

test("POST /api/device/report saves and publishes a raw telemetry event", async () => {
  const response = await request(app)
    .post("/api/device/report")
    .send({
      deviceId: "TEMP-SENSOR-001",
      payload: { temp: 86.5, hum: 62, online: true }
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.accepted, true);
  assert.match(response.body.eventId, /^RAW-\d+$/);
  assert.equal(calls.saved.at(-1).deviceId, "TEMP-SENSOR-001");
  assert.equal(calls.saved.at(-1).rawPayload.eventId, response.body.eventId);
  assert.equal(calls.published.at(-1).payload.eventId, response.body.eventId);
  assert.equal(calls.published.at(-1).key, "TEMP-SENSOR-001");
  assert.equal(calls.published.at(-1).topic, "iot.telemetry.raw");
});

test("POST /api/device/mqtt-report publishes a device property report to EMQX", async () => {
  const response = await request(app)
    .post("/api/device/mqtt-report")
    .send({
      deviceId: "TEMP-SENSOR-001",
      payload: { temp: 86.5, hum: 62, online: true }
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.accepted, true);
  assert.match(response.body.eventId, /^MQTT-WEB-\d+$/);
  assert.equal(response.body.topic, "devices/TEMP-SENSOR-001/property/report");
  assert.equal(calls.mqttPublished.at(-1).topic, "devices/TEMP-SENSOR-001/property/report");
  assert.equal(calls.mqttPublished.at(-1).payload.deviceId, "TEMP-SENSOR-001");
  assert.equal(calls.mqttPublished.at(-1).payload.eventId, response.body.eventId);
  assert.deepEqual(calls.mqttPublished.at(-1).payload.payload, { temp: 86.5, hum: 62, online: true });
});

test("GET /api/device/:deviceId/commands returns pending commands", async () => {
  const response = await request(app).get("/api/device/ALARM-LIGHT-001/commands");

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.data));
  assert.equal(response.body.data[0].status, "running");
  assert.deepEqual(calls.markedRunning.at(-1), ["CMD-TEST-001"]);
});

test("POST /api/device/command-ack records an acknowledgement", async () => {
  const response = await request(app)
    .post("/api/device/command-ack")
    .send({
      commandId: "CMD-TEST-001",
      status: "success",
      ackPayload: { result: "ok" }
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.accepted, true);
  assert.equal(calls.acknowledged.at(-1).commandId, "CMD-TEST-001");
  assert.deepEqual(calls.acknowledged.at(-1).ackPayload, { result: "ok" });
  assert.equal(calls.published.at(-1).topic, "iot.command.ack");
  assert.deepEqual(calls.published.at(-1).payload, calls.acknowledged.at(-1));
  assert.equal(calls.published.at(-1).key, "CMD-TEST-001");
});
