# IoT platform Node-RED demo

Language: [中文](README.md) | English

This demo shows a small IoT sensing platform with a Node.js server, React web UI, MySQL persistence, Kafka topics, and Node-RED flows. The current delivery focuses on how the closed loop runs: raw telemetry enters Kafka, Node-RED normalizes it, rules create alarms and commands, and the server stores callback results for the web UI.

## Install and run

Clone on a new machine:

```powershell
git clone git@github.com:lylyuanliang/iot-platform-nodered-demo.git
cd iot-platform-nodered-demo
```

Then install and run:

```powershell
pnpm install
pnpm server:dev
pnpm web:dev
```

The server defaults to `http://127.0.0.1:3000`. The web dev server defaults to `http://127.0.0.1:5173`. The platform landing route is `http://127.0.0.1:5173/#/platform/dashboard`.

## MySQL schema and seed

Create the schema and seed demo products, devices, thing models, and initial records:

```powershell
pnpm --filter demo-server db:schema
pnpm --filter demo-server db:seed
```

The SQL files are:

- `server/src/db/schema.sql`
- `server/src/db/seed.sql`

## Kafka topics

The demo uses these topics:

- `iot.telemetry.raw`
- `iot.telemetry.normalized`
- `iot.invalid.data`
- `iot.rule.matched`
- `iot.alarm.created`
- `iot.command.downlink`
- `iot.command.ack`

## Node-RED import

```powershell
cd node-red
pnpm install
pnpm exec node-red --userDir .
```

Open `http://127.0.0.1:1880`, import `node-red/flows.json`, check the `Kafka broker` config node, and deploy. The HTTP callback nodes point to `http://127.0.0.1:3000`.

The committed Node-RED flow sample is `node-red/flows.json`.

These local runtime or credential files are intentionally not committed:

- `node-red/flows_cred.json`
- `node-red/.config*.json`
- `node-red/*.backup`

If credentials are added later, configure them again in the new local Node-RED environment.

## EMQX MQTT Broker

MQTT uses EMQX for the local demo. The compose file is recorded in note_cloud:

```text
D:\file_save\workspace\note_cloud\笔记\学习记录\docker\1.docker-compose文件样例\compose\emqx\docker-compose.yml
```

Start it from that directory:

```powershell
docker compose up -d
```

Endpoints:

- MQTT: `127.0.0.1:1883`
- Dashboard: `http://127.0.0.1:18083/`

## Main demo script

1. Start MySQL, Kafka, the server, the web UI, and Node-RED.
2. Import `flows.json` and deploy the active tabs.
3. Send raw telemetry to `iot.telemetry.raw`.
4. Show the main closed loop: raw telemetry -> normalized telemetry -> rule match -> alarm -> command -> web UI query.
5. Trigger `05-规则-连续异常窗口` with three high-temperature reports for the same device.
6. Trigger `07-规则-定时离线巡检` by letting `last_report_at` become older than 60 seconds, then show the `DEVICE_OFFLINE` alarm.
7. Publish an MQTT report to `devices/TEMP-SENSOR-001/property/report` and show `MQTT -> Node-RED -> iot.telemetry.raw -> existing rule flow`.
8. Compare automatic actions from Node-RED with manual confirmation actions in the web UI.

## HTTP, MQTT, and Kafka

HTTP, MQTT, and Kafka are peer input/output integration components:

- HTTP: platform callback APIs and query APIs.
- Kafka: internal event stream for telemetry, rule, alarm, and command messages.
- MQTT: device access path through EMQX.

`09-MQTT接入扩展` in `flows.json` is enabled after EMQX deployment. It subscribes to `devices/+/property/report`, parses JSON, and publishes raw messages to `iot.telemetry.raw`. The existing Kafka raw consumer then sends those raw messages into the standardization and rule flows.

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

## Documentation

- Node-RED details: `node-red/README.md`
- Technical share outline: `docs/技术分享提纲.md`
- Demo usage guide: `docs/当前Demo使用教程.md`
- Node-RED detailed guide: `docs/Node-RED详细说明.md`
