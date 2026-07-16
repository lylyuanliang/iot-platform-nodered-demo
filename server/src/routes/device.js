import { Router } from "express";
import { topics } from "../kafka/topics.js";
import { publishJson } from "../kafka/producer.js";
import { acknowledgeCommand, listPendingCommands, markCommandsRunning } from "../services/commands.js";
import { publishMqtt } from "../services/mqttPublisher.js";
import { saveRawTelemetry } from "../services/telemetryService.js";

export function createDeviceRouter(dependencies = {}) {
  const {
    saveRawTelemetry: saveRaw = saveRawTelemetry,
    listPendingCommands: listPending = listPendingCommands,
    markCommandsRunning: markRunning = markCommandsRunning,
    acknowledgeCommand: acknowledge = acknowledgeCommand,
    publishJson: publish = publishJson,
    publishMqtt: publishMqttMessage = publishMqtt
  } = dependencies;
  const router = Router();

  router.post("/report", async (req, res, next) => {
    try {
      const { deviceId, payload } = req.body;
      if (!deviceId || !payload || typeof payload !== "object") {
        return res.status(400).json({ error: "deviceId and payload are required" });
      }

      const eventId = `RAW-${Date.now()}`;
      const rawPayload = { eventId, deviceId, payload };
      await saveRaw({ eventId, deviceId, sourceType: "http", topic: topics.telemetryRaw, rawPayload });
      await publish(topics.telemetryRaw, rawPayload, deviceId);
      return res.json({ accepted: true, eventId });
    } catch (error) {
      next(error);
    }
  });

  router.post("/mqtt-report", async (req, res, next) => {
    try {
      const { deviceId, payload } = req.body;
      if (!deviceId || !payload || typeof payload !== "object") {
        return res.status(400).json({ error: "deviceId and payload are required" });
      }

      const eventId = `MQTT-WEB-${Date.now()}`;
      const topic = `devices/${deviceId}/property/report`;
      const mqttPayload = { eventId, deviceId, payload };
      await publishMqttMessage({ topic, payload: mqttPayload });
      return res.json({ accepted: true, eventId, topic });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:deviceId/commands", async (req, res, next) => {
    try {
      const commands = await listPending(req.params.deviceId);
      await markRunning(commands.map((command) => command.command_id));
      res.json({
        data: commands.map((command) =>
          ["created", "queued", "sent"].includes(command.status) ? { ...command, status: "running" } : command
        )
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/command-ack", async (req, res, next) => {
    try {
      const { commandId, deviceId = null, status, message = null, ackPayload = {}, errorMessage = null } = req.body;
      if (!commandId || !status) {
        return res.status(400).json({ error: "commandId and status are required" });
      }
      if (!["success", "failed", "timeout"].includes(status)) {
        return res.status(400).json({ error: "unsupported acknowledgement status" });
      }

      const acknowledgement = { commandId, deviceId, status, message, ackPayload, errorMessage };
      await acknowledge(acknowledgement);
      await publish(topics.commandAck, acknowledgement, commandId);
      return res.json({ accepted: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createDeviceRouter();
