import { Router } from "express";
import { listRawTelemetry, listTelemetryEvents } from "../services/telemetry.js";

const router = Router();

router.get("/raw", async (req, res, next) => {
  try {
    res.json({ data: await listRawTelemetry() });
  } catch (error) {
    next(error);
  }
});

router.get("/events", async (req, res, next) => {
  try {
    res.json({ data: await listTelemetryEvents() });
  } catch (error) {
    next(error);
  }
});

export default router;
