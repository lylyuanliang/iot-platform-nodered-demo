import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.NODE_ENV = "test";
const { app } = await import("../src/index.js");

test("GET /api/health returns the IoT platform service status", async () => {
  const response = await request(app).get("/api/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    ok: true,
    service: "iot-platform-nodered-demo"
  });
});
