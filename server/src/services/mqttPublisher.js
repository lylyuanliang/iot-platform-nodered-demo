import net from "node:net";
import { config } from "../config.js";

function mqttString(value) {
  const buffer = Buffer.from(value);
  return Buffer.concat([Buffer.from([buffer.length >> 8, buffer.length & 255]), buffer]);
}

function encodeRemainingLength(length) {
  const bytes = [];
  let remaining = length;
  do {
    let digit = remaining % 128;
    remaining = Math.floor(remaining / 128);
    if (remaining > 0) digit |= 128;
    bytes.push(digit);
  } while (remaining > 0);
  return Buffer.from(bytes);
}

export function createMqttPublishPacket(topic, payload) {
  const topicBuffer = mqttString(topic);
  const payloadBuffer = Buffer.from(JSON.stringify(payload));
  return Buffer.concat([
    Buffer.from([0x30]),
    encodeRemainingLength(topicBuffer.length + payloadBuffer.length),
    topicBuffer,
    payloadBuffer
  ]);
}

export async function publishMqtt({ topic, payload, host = config.mqtt.host, port = config.mqtt.port }) {
  const clientId = `demo-web-publisher-${Date.now()}`;
  const connectVariable = Buffer.concat([mqttString("MQTT"), Buffer.from([4, 2, 0, 30]), mqttString(clientId)]);
  const connectPacket = Buffer.concat([
    Buffer.from([0x10]),
    encodeRemainingLength(connectVariable.length),
    connectVariable
  ]);
  const publishPacket = createMqttPublishPacket(topic, payload);

  await new Promise((resolve, reject) => {
    const socket = net.connect(port, host);
    let settled = false;
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`MQTT publish timeout: ${host}:${port}`));
    }, 5000);

    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    }

    socket.on("connect", () => socket.write(connectPacket));
    socket.on("data", () => {
      socket.write(publishPacket);
      setTimeout(() => socket.end(), 100);
    });
    socket.on("close", () => finish());
    socket.on("error", (error) => finish(error));
  });
}
