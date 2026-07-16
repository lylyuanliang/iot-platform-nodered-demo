# Node-RED flows for the IoT platform demo

This directory contains the importable `flows.json` used by the demo. It is a Node-RED orchestration layer for telemetry parsing, rule matching, alarms, command downlink, and execution logs.

## Run Node-RED

From the repo root:

```powershell
pnpm install
cd node-red
pnpm install
pnpm exec node-red --userDir .
```

Open `http://127.0.0.1:1880`, then import `node-red/flows.json`. Configure the `Kafka broker` config node if Kafka is not on `127.0.0.1:9092`. The HTTP request nodes call the demo server at `http://127.0.0.1:3000`.

The MQTT flow uses local EMQX at `127.0.0.1:1883`. The compose file is stored at:

```text
D:\file_save\workspace\note_cloud\笔记\学习记录\docker\1.docker-compose文件样例\compose\emqx\docker-compose.yml
```

## Flow tabs

- `02-Kafka原始遥测消费`: consumes `iot.telemetry.raw` and sends messages to normalization.
- `03-数据解析与标准化`: parses raw telemetry, validates temperature, saves normalized events through HTTP callback, and publishes `iot.telemetry.normalized`.
- `04-规则-阈值与无效数据`: creates `HIGH_TEMPERATURE` alarms for temperature above 80.
- `05-规则-连续异常窗口`: counts high-temperature reports with `flow.get("highTempCount:<deviceId>")`; the third consecutive high value creates a `CONTINUOUS_HIGH_TEMPERATURE` alarm and a rule execution log.
- `06-规则-场景联动`: creates the automatic `turnOnAlarm` command for the alarm light.
- `07-规则-定时离线巡检`: every 30 seconds calls `GET /api/devices`; devices with `last_report_at` older than 60 seconds create `DEVICE_OFFLINE` alarms.
- `09-MQTT接入扩展`: subscribes to MQTT In `devices/+/property/report`, parses JSON, formats a raw telemetry message, and publishes to `iot.telemetry.raw`; the Kafka raw consumer then forwards it to the existing standardization flow.
- `10-错误捕获与执行日志`: shared catch path for normalization, rule, offline inspection, scene linkage, and MQTT ingest errors.

## Main demo script

1. Start MySQL, Kafka, server, web, and Node-RED.
2. Open the web page and check products, devices, thing model data, telemetry, alarms, commands, and rule logs.
3. Send normal temperature telemetry to show raw telemetry -> normalized telemetry with no alarm.
4. Send one high temperature report to show the threshold rule and alarm callback.
5. Send three consecutive high temperature reports for the same device to show `05-规则-连续异常窗口`.
6. Wait for stale `last_report_at` data or adjust seed/runtime data, then trigger `07-规则-定时离线巡检` to show `DEVICE_OFFLINE`.
7. Publish an MQTT message to `devices/TEMP-SENSOR-001/property/report` to show `MQTT -> Node-RED -> iot.telemetry.raw`.
8. Use the alarm/command screens to explain automatic action versus manual confirmation action.

## Input and output positioning

HTTP, MQTT, and Kafka are peer integration components in this demo:

- HTTP is used for platform callback APIs and query APIs.
- Kafka is used for telemetry/rule/alarm/command event topics.
- MQTT is the device access protocol path through EMQX and enters the same raw telemetry topic as other ingestion paths.

MQTT is not a lower-level part of Kafka or HTTP. In this demo it is enabled after EMQX deployment, writes to `iot.telemetry.raw`, and relies on the existing Kafka raw consumer to enter the standardization/rule flow.

Sample MQTT payload:

```json
{
  "deviceId": "TEMP-SENSOR-001",
  "payload": {
    "temp": 86.5,
    "hum": 62,
    "online": true
  }
}
```
