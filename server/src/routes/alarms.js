import { Router } from "express";
import { listAlarms } from "../services/alarms.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    res.json({ data: await listAlarms() });
  } catch (error) {
    next(error);
  }
});

export default router;
