import { useState } from "react";
import { apiGet, apiPost } from "../api/client.js";
import { PageFrame } from "../components/PageFrame.jsx";

const commandDevices = ["ALARM-LIGHT-001", "CNC-001", "VOICE-SPEAKER-001"];

export default function DeviceSimulator() {
  const [temperature, setTemperature] = useState("86.5");
  const [humidity, setHumidity] = useState("62");
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState("");
  const [commands, setCommands] = useState([]);

  async function report() {
    try {
      const result = await apiPost("/api/device/report", {
        deviceId: "TEMP-SENSOR-001",
        payload: { temp: Number(temperature), hum: Number(humidity), online }
      });
      setMessage(`上报已接受：${result.eventId}`);
    } catch (error) {
      setMessage(`上报失败：${error.message}`);
    }
  }

  async function pollCommands() {
    try {
      const results = await Promise.all(commandDevices.map(async (deviceId) => (await apiGet(`/api/device/${deviceId}/commands`)).data));
      setCommands(results.flat());
      setMessage("已轮询三台执行设备的待处理指令");
    } catch (error) {
      setMessage(`轮询失败：${error.message}`);
    }
  }

  async function acknowledge(command, status) {
    try {
      await apiPost("/api/device/command-ack", {
        commandId: command.command_id,
        deviceId: command.device_id,
        status,
        ackPayload: { result: status },
        errorMessage: status === "success" ? null : `simulated ${status}`
      });
      setCommands((current) => current.filter((item) => item.command_id !== command.command_id));
      setMessage(`指令 ${command.command_id} 已回执：${status}`);
    } catch (error) {
      setMessage(`回执失败：${error.message}`);
    }
  }

  return <PageFrame title="设备模拟器">
    <h2>温湿度传感器</h2>
    <label>设备 <select value="TEMP-SENSOR-001" disabled><option>TEMP-SENSOR-001</option></select></label>{" "}
    <label>温度 <input type="number" value={temperature} onChange={(event) => setTemperature(event.target.value)} /></label>{" "}
    <label>湿度 <input type="number" value={humidity} onChange={(event) => setHumidity(event.target.value)} /></label>{" "}
    <label>在线 <input type="checkbox" checked={online} onChange={(event) => setOnline(event.target.checked)} /></label>{" "}
    <button type="button" onClick={report}>上报</button>
    <h2>执行设备指令</h2>
    <button type="button" onClick={pollCommands}>轮询待执行指令</button>
    {message && <p>{message}</p>}
    {commands.length > 0 && <div className="table-wrap"><table><thead><tr><th>命令 ID</th><th>设备 ID</th><th>服务</th><th>状态</th><th>操作</th></tr></thead><tbody>
      {commands.map((command) => <tr key={command.command_id}><td>{command.command_id}</td><td>{command.device_id}</td><td>{command.service_code}</td><td>{command.status}</td><td><div className="action-row compact"><button type="button" onClick={() => acknowledge(command, "success")}>成功</button><button type="button" onClick={() => acknowledge(command, "failed")}>失败</button><button type="button" onClick={() => acknowledge(command, "timeout")}>超时</button></div></td></tr>)}
    </tbody></table></div>}
  </PageFrame>;
}
