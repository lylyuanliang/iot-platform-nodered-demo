import { useState } from "react";
import { apiPost, useApi } from "../api/client.js";
import { PageFrame, QueryState } from "../components/PageFrame.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";

export default function BusinessAlarmHandle() {
  const [reloadKey, setReloadKey] = useState(0);
  const [message, setMessage] = useState("");
  const { data, loading, error } = useApi(`/api/business/alarms?reload=${reloadKey}`);

  async function confirm(alarmId) {
    try {
      await apiPost(`/api/business/alarms/${alarmId}/confirm`, {});
      setMessage(`告警 ${alarmId} 已确认`);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setMessage(`确认失败：${error.message}`);
    }
  }

  async function handle(alarmId, action) {
    try {
      const result = await apiPost(`/api/business/alarms/${alarmId}/handle`, { action });
      setMessage(`已生成指令：${result.command.commandId}`);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setMessage(`处理失败：${error.message}`);
    }
  }

  return <PageFrame title="业务告警处理">
    {message && <p>{message}</p>}
    <QueryState loading={loading} error={error}>
      {!data?.length ? <div className="empty-state">暂无待处理告警</div> : <div className="table-wrap"><table><thead><tr>
        <th>告警 ID</th><th>设备</th><th>类型</th><th>级别</th><th>状态</th><th>标题</th><th>操作</th>
      </tr></thead><tbody>
        {data.map((alarm) => <tr key={alarm.alarm_id}>
          <td>{alarm.alarm_id}</td>
          <td>{alarm.device_id}</td>
          <td>{alarm.alarm_type}</td>
          <td><StatusBadge value={alarm.alarm_level} /></td>
          <td><StatusBadge value={alarm.status} /></td>
          <td>{alarm.title}</td>
          <td>
            <button type="button" onClick={() => confirm(alarm.alarm_id)}>确认</button>{" "}
            <button type="button" onClick={() => handle(alarm.alarm_id, "stopMachine")}>停机处理</button>{" "}
            <button type="button" onClick={() => handle(alarm.alarm_id, "playVoice")}>播放语音</button>
          </td>
        </tr>)}
      </tbody></table></div>}
    </QueryState>
  </PageFrame>;
}
