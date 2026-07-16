import { useApi } from "../api/client.js";
import { DataTable } from "../components/DataTable.jsx";
import { PageFrame, QueryState } from "../components/PageFrame.jsx";

const labels = { deviceCount: "设备总数", onlineDeviceCount: "在线设备", todayMessageCount: "今日消息", activeAlarmCount: "活动告警", commandSuccessCount: "指令成功", commandFailedCount: "指令失败" };

export default function Dashboard() {
  const { data, loading, error } = useApi("/api/dashboard/summary");
  const rows = data ? Object.entries(labels).map(([key, label]) => ({ metric: label, value: data[key] })) : [];
  return <PageFrame title="平台仪表盘"><QueryState loading={loading} error={error}>{data && <DataTable rows={rows} columns={["metric", "value"]} />}</QueryState></PageFrame>;
}
