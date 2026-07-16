import { Router } from "express";
import { getDashboardSummary } from "../services/dashboard.js";

const router = Router();

router.get("/summary", async (req, res, next) => {
  try {
    res.json({ data: await getDashboardSummary() });
  } catch (error) {
    next(error);
  }
});

export default router;
