import { Router } from "express";
import { saveInvalidData, saveNormalizedTelemetry } from "../services/telemetryService.js";
import { saveAlarm } from "../services/alarms.js";
import { createCommand } from "../services/commands.js";
import { saveRuleError, saveRuleExecution } from "../services/rules.js";

export function createPlatformRouter(dependencies = {}) {
  const {
    saveNormalizedTelemetry: saveNormalized = saveNormalizedTelemetry,
    saveInvalidData: saveInvalid = saveInvalidData,
    saveRuleExecution: saveExecution = saveRuleExecution,
    saveAlarm: saveAlarmRecord = saveAlarm,
    createCommand: createCommandRecord = createCommand,
    saveRuleError: saveError = saveRuleError
  } = dependencies;
  const router = Router();

  const save = (handler) => async (req, res, next) => {
    try {
      await handler(req.body);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  };

  router.post("/telemetry/normalized", save(saveNormalized));
  router.post("/invalid-data", save(saveInvalid));
  router.post("/rule-executions", save(saveExecution));
  router.post("/alarms", save(saveAlarmRecord));
  router.post("/commands", save(createCommandRecord));
  router.post("/rule-errors", save(saveError));

  return router;
}

export default createPlatformRouter();
