import { useApi } from "../api/client.js";
import { DataTable } from "../components/DataTable.jsx";
import { PageFrame, QueryState } from "../components/PageFrame.jsx";

export default function CommandsAck() {
  const { data, loading, error } = useApi("/api/commands");
  return <PageFrame title="设备指令与回执"><QueryState loading={loading} error={error}><DataTable rows={data} /></QueryState></PageFrame>;
}
