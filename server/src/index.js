import express from "express";
import cors from "cors";
import { config } from "./config.js";
import dashboardRoutes from "./routes/dashboard.js";
import productRoutes from "./routes/products.js";
import deviceRoutes from "./routes/devices.js";
import telemetryRoutes from "./routes/telemetry.js";
import ruleRoutes from "./routes/rules.js";
import alarmRoutes from "./routes/alarms.js";
import commandRoutes from "./routes/commands.js";
import { createDeviceRouter } from "./routes/device.js";
import { createPlatformRouter } from "./routes/platform.js";
import { createBusinessRouter } from "./routes/business.js";

export function createApp({ deviceDependencies, platformDependencies, businessDependencies } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ ok: true, service: "iot-platform-nodered-demo" });
  });

  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/devices", deviceRoutes);
  app.use("/api/telemetry", telemetryRoutes);
  app.use("/api/rules", ruleRoutes);
  app.use("/api/alarms", alarmRoutes);
  app.use("/api/commands", commandRoutes);
  app.use("/api/device", createDeviceRouter(deviceDependencies));
  app.use("/api/platform", createPlatformRouter(platformDependencies));
  app.use("/api/business", createBusinessRouter(businessDependencies));

  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ error: error.message });
  });

  return app;
}

export const app = createApp();

if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    console.log(`demo server listening on http://localhost:${config.port}`);
  });
}
