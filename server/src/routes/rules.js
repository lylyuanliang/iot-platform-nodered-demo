import { Router } from "express";
import { listRuleExecutions } from "../services/rules.js";

const router = Router();

router.get("/executions", async (req, res, next) => {
  try {
    res.json({ data: await listRuleExecutions() });
  } catch (error) {
    next(error);
  }
});

export default router;
