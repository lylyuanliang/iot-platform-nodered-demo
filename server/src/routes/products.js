import { Router } from "express";
import { listProducts, listThingModel } from "../services/products.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    res.json({ data: await listProducts() });
  } catch (error) {
    next(error);
  }
});

router.get("/:productKey/thing-model", async (req, res, next) => {
  try {
    res.json({ data: await listThingModel(req.params.productKey) });
  } catch (error) {
    next(error);
  }
});

export default router;
