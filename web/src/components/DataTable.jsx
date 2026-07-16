import { StatusBadge } from "./StatusBadge.jsx";
import { formatDateTime, isDateField } from "../utils/formatters.js";

function formatValue(value, field) {
  if (value === null || value === undefined) return "-";
  if (isDateField(field)) return formatDateTime(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DataTable({ rows, columns }) {
  if (!rows?.length) return <div className="empty-state">暂无可展示的物联数据</div>;
  const fields = columns || Object.keys(rows[0]);
  return <div className="table-wrap"><table><thead><tr>{fields.map((field) => <th key={field}>{field}</th>)}</tr></thead><tbody>
    {rows.map((row, index) => <tr key={row.id || row.device_id || row.product_key || index}>{fields.map((field) => <td key={field}>{/(status|level)$/i.test(field) ? <StatusBadge value={row[field]} /> : formatValue(row[field], field)}</td>)}</tr>)}
  </tbody></table></div>;
}
