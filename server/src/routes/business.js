import { Router } from "express";
import { topics } from "../kafka/topics.js";
import { publishJson } from "../kafka/producer.js";
import { listOpenAlarms, updateAlarmStatus } from "../services/alarms.js";
import { createCommand } from "../services/commands.js";
import { getDeviceInstance, getDeviceState } from "../services/devices.js";

const businessActions = {
  stopMachine: {
    deviceId: "CNC-001",
    productKey: "cnc-machine",
    serviceCode: "stopMachine",
    requestPayload: { reason: "high temperature alarm business handling" }
  },
  playVoice: {
    deviceId: "VOICE-SPEAKER-001",
    productKey: "voice-speaker",
    serviceCode: "playVoice",
    requestPayload: { text: "设备高温告警，请现场确认", volume: 80 }
  }
};

function buildBusinessCommand(alarmId, action, target, online) {
  return {
    commandId: `CMD-BIZ-${action}-${Date.now()}`,
    deviceId: target.deviceId,
    productKey: target.productKey,
    serviceCode: target.serviceCode,
    commandSource: "business",
    sourceAlarmId: alarmId,
    requestPayload: target.requestPayload,
    status: online ? "sent" : "queued"
  };
}

export function createBusinessRouter(dependencies = {}) {
  const {
    listOpenAlarms: listOpen = listOpenAlarms,
    updateAlarmStatus: updateStatus = updateAlarmStatus,
    getDeviceState: getState = getDeviceState,
    getDeviceInstance: getInstance = getDeviceInstance,
    createCommand: createCommandRecord = createCommand,
    publishJson: publish = publishJson
  } = dependencies;
  const router = Router();

  router.get("/alarms", async (req, res, next) => {
    try {
      res.json({ data: await listOpen() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/alarms/:alarmId/confirm", async (req, res, next) => {
    try {
      await updateStatus(req.params.alarmId, "confirmed");
      res.json({ ok: true, alarmId: req.params.alarmId, status: "confirmed" });
    } catch (error) {
      next(error);
    }
  });

  router.post("/alarms/:alarmId/handle", async (req, res, next) => {
    try {
      const target = businessActions[req.body?.action];
      if (!target) {
        return res.status(400).json({ error: "unsupported business action" });
      }

      await updateStatus(req.params.alarmId, "processing");
      const state = await getState(target.deviceId);
      const device = state ?? (await getInstance(target.deviceId));
      const online = device?.status === "online";
      const command = buildBusinessCommand(req.params.alarmId, req.body.action, target, online);
      await createCommandRecord(command);

      if (command.status === "sent") {
        await publish(topics.commandDownlink, command, command.commandId);
      }

      return res.json({ ok: true, command });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createBusinessRouter();
