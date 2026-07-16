import { Router } from "express";
import { getDeviceState, listDevices } from "../services/devices.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    res.json({ data: await listDevices() });
  } catch (error) {
    next(error);
  }
});

router.get("/:deviceId/state", async (req, res, next) => {
  try {
    res.json({ data: await getDeviceState(req.params.deviceId) });
  } catch (error) {
    next(error);
  }
});

export default router;
