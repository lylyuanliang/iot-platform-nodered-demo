import { useApi } from "../api/client.js";
import { DataTable } from "../components/DataTable.jsx";
import { JsonViewer } from "../components/JsonViewer.jsx";
import { PageFrame, QueryState } from "../components/PageFrame.jsx";

export default function DeviceState() {
  const devices = useApi("/api/devices");
  const deviceId = devices.data?.[0]?.device_id;
  const state = useApi(deviceId ? `/api/devices/${deviceId}/state` : "/api/devices/TEMP-SENSOR-001/state");
  return <PageFrame title="设备实例与状态"><QueryState loading={devices.loading} error={devices.error}><DataTable rows={devices.data} /></QueryState><h2>最新设备状态</h2><QueryState loading={state.loading} error={state.error}>{state.data ? <JsonViewer value={state.data} /> : <div className="empty-state">该设备尚未上报最新状态</div>}</QueryState></PageFrame>;
}
