import { useMemo, useState } from "react";
import { apiPost } from "../api/client.js";
import { PageFrame } from "../components/PageFrame.jsx";
import { JsonViewer } from "../components/JsonViewer.jsx";

export default function MqttDeviceSimulator() {
  const [deviceId, setDeviceId] = useState("TEMP-SENSOR-001");
  const [temperature, setTemperature] = useState("86.5");
  const [humidity, setHumidity] = useState("62");
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState("");
  const [lastResult, setLastResult] = useState(null);

  const payload = useMemo(() => ({
    deviceId,
    payload: {
      temp: Number(temperature),
      hum: Number(humidity),
      online
    }
  }), [deviceId, humidity, online, temperature]);

  async function publish(nextTemperature = temperature) {
    const requestBody = {
      deviceId,
      payload: {
        temp: Number(nextTemperature),
        hum: Number(humidity),
        online
      }
    };
    try {
      const result = await apiPost("/api/device/mqtt-report", requestBody);
      setLastResult(result);
      setMessage(`MQTT 上报已发布：${result.eventId}`);
    } catch (error) {
      setLastResult(null);
      setMessage(`MQTT 上报失败：${error.message}`);
    }
  }

  return <PageFrame title="MQTT 上报模拟">
    <h2>MQTT 设备属性上报</h2>
    <label>设备 <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
      <option value="TEMP-SENSOR-001">TEMP-SENSOR-001</option>
    </select></label>{" "}
    <label>温度 <input type="number" value={temperature} onChange={(event) => setTemperature(event.target.value)} /></label>{" "}
    <label>湿度 <input type="number" value={humidity} onChange={(event) => setHumidity(event.target.value)} /></label>{" "}
    <label>在线 <input type="checkbox" checked={online} onChange={(event) => setOnline(event.target.checked)} /></label>
    <div className="action-row">
      <button type="button" onClick={() => publish("25.5")}>发布普通 MQTT 上报</button>
      <button type="button" onClick={() => publish("86.5")}>发布高温 MQTT 上报</button>
      <button type="button" onClick={() => publish()}>发布当前表单</button>
    </div>
    {message && <p>{message}</p>}
    <h2>发布目标</h2>
    <div className="table-wrap"><table><tbody>
      <tr><th>Broker</th><td>127.0.0.1:1883</td></tr>
      <tr><th>Topic</th><td>{`devices/${deviceId}/property/report`}</td></tr>
      <tr><th>入口 Flow</th><td>{"09-MQTT接入扩展 -> 发布原始遥测消息 -> 02-Kafka原始遥测消费"}</td></tr>
    </tbody></table></div>
    <h2>Payload 预览</h2>
    <JsonViewer value={payload} />
    {lastResult && <>
      <h2>最近发布结果</h2>
      <JsonViewer value={lastResult} />
    </>}
  </PageFrame>;
}
