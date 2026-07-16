import { useApi } from "../api/client.js";
import { DataTable } from "../components/DataTable.jsx";
import { PageFrame, QueryState } from "../components/PageFrame.jsx";

export default function TelemetryLogs() {
  const raw = useApi("/api/telemetry/raw");
  const events = useApi("/api/telemetry/events");
  return <PageFrame title="数据事件与消息日志"><h2>原始上报</h2><QueryState loading={raw.loading} error={raw.error}><DataTable rows={raw.data} /></QueryState><h2>标准化事件</h2><QueryState loading={events.loading} error={events.error}><DataTable rows={events.data} /></QueryState></PageFrame>;
}
