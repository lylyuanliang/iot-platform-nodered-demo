import { Partitioners } from "kafkajs";
import { kafka } from "./client.js";

const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });
let connected = false;

export async function publishJson(topic, payload, key) {
  if (!connected) {
    await producer.connect();
    connected = true;
  }

  await producer.send({
    topic,
    messages: [{ key, value: JSON.stringify(payload) }]
  });
}
