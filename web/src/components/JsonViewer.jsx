import { formatDateFields } from "../utils/formatters.js";

export function JsonViewer({ value }) {
  return <pre className="json-viewer">{JSON.stringify(formatDateFields(value), null, 2)}</pre>;
}
