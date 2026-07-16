import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "root",
    database: process.env.MYSQL_DATABASE || "iot_nodered_demo"
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "127.0.0.1:9092").split(",")
  },
  mqtt: {
    host: process.env.MQTT_HOST || "127.0.0.1",
    port: Number(process.env.MQTT_PORT || 1883)
  },
  nodeRedUrl: process.env.NODE_RED_URL || "http://127.0.0.1:1880"
};
