import { Router } from "express";
import { listCommands } from "../services/commands.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    res.json({ data: await listCommands() });
  } catch (error) {
    next(error);
  }
});

export default router;
