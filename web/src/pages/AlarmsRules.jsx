import { useApi } from "../api/client.js";
import { DataTable } from "../components/DataTable.jsx";
import { PageFrame, QueryState } from "../components/PageFrame.jsx";

export default function AlarmsRules() {
  const { data, loading, error } = useApi("/api/alarms");
  return <PageFrame title="告警与规则命中"><QueryState loading={loading} error={error}><DataTable rows={data} /></QueryState></PageFrame>;
}
