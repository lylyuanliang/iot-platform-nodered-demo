import { useApi } from "../api/client.js";
import { DataTable } from "../components/DataTable.jsx";
import { PageFrame, QueryState } from "../components/PageFrame.jsx";

const flows = [
  ["09-MQTT接入扩展", "MQTT In 接入设备消息，并写入 iot.telemetry.raw"],
  ["02-Kafka原始遥测消费", "Node-RED Kafka Consumer 消费 raw topic"],
  ["03-数据解析与标准化", "Function 节点解析原始消息并生成标准物模型事件"],
  ["04-规则-阈值与无效数据", "高温阈值规则、告警和规则日志"],
  ["06-规则-场景联动", "自动生成 turnOnAlarm 设备指令"],
  ["10-错误捕获与执行日志", "Catch 节点统一写回平台错误日志"]
];

export default function RulesNodeRed() {
  const { data, loading, error } = useApi("/api/rules/executions");
  return <PageFrame title="规则与 Node-RED">
    <div className="integration-panel">
      <div className="integration-card">
        <h2>平台内规则编排入口</h2>
        <p>Node-RED 在当前 demo 中属于物联网平台端的规则编排运行时。设备消息进入 Kafka 后，由 Node-RED 消费、解析、判断规则，再通过 Kafka 和平台 HTTP 回调写回结果。</p>
        <div className="action-row">
          <a className="link-button" href="http://127.0.0.1:1880" target="_blank" rel="noreferrer">打开 Node-RED 编辑器</a>
          <a className="link-button secondary" href="http://127.0.0.1:3000/api/health" target="_blank" rel="noreferrer">检查平台 API</a>
        </div>
      </div>
      <div className="integration-card">
        <h2>建议观察顺序</h2>
        <ul className="flow-list">
          {flows.map(([name, description]) => <li key={name}><strong>{name}</strong><span>{description}</span></li>)}
        </ul>
      </div>
    </div>
    <h2>规则执行记录</h2>
    <QueryState loading={loading} error={error}><DataTable rows={data} /></QueryState>
  </PageFrame>;
}
