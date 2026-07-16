import test, { after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.NODE_ENV = "test";
const { app } = await import("../src/index.js");
const { pool } = await import("../src/db/pool.js");

after(async () => {
  await pool.end();
});

test("GET /api/products returns seeded IoT products", async () => {
  const response = await request(app).get("/api/products");

  assert.equal(response.status, 200);
  assert.ok(response.body.data.some((product) => product.product_key === "temperature-sensor"));
  assert.ok(response.body.data.some((product) => product.product_name === "温湿度传感器"));
});

test("GET /api/devices returns seeded device instances", async () => {
  const response = await request(app).get("/api/devices");

  assert.equal(response.status, 200);
  assert.ok(response.body.data.some((device) => device.device_id === "TEMP-SENSOR-001"));
});

test("GET /api/dashboard/summary returns numeric platform metrics", async () => {
  const response = await request(app).get("/api/dashboard/summary");

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.data.deviceCount, "number");
  assert.equal(typeof response.body.data.onlineDeviceCount, "number");
  assert.equal(typeof response.body.data.todayMessageCount, "number");
  assert.equal(typeof response.body.data.activeAlarmCount, "number");
  assert.equal(typeof response.body.data.commandSuccessCount, "number");
  assert.equal(typeof response.body.data.commandFailedCount, "number");
});

test("MySQL session uses Beijing timezone for NOW()", async () => {
  const [rows] = await pool.query("SELECT TIMESTAMPDIFF(HOUR, UTC_TIMESTAMP(), NOW()) AS offsetHours");

  assert.equal(rows[0].offsetHours, 8);
});

for (const path of [
  "/api/products/temperature-sensor/thing-model",
  "/api/devices/TEMP-SENSOR-001/state",
  "/api/telemetry/raw",
  "/api/telemetry/events",
  "/api/rules/executions",
  "/api/alarms",
  "/api/commands"
]) {
  test(`GET ${path} returns a data field`, async () => {
    const response = await request(app).get(path);

    assert.equal(response.status, 200);
    assert.ok(Object.hasOwn(response.body, "data"));
  });
}
