import { Kafka } from "kafkajs";
import { config } from "../config.js";

export const kafka = new Kafka({
  clientId: "iot-platform-nodered-demo",
  brokers: config.kafka.brokers
});
