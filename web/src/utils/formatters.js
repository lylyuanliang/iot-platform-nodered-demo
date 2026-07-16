export function isDateField(field) {
  return /(^|_)(created|updated|received|occurred|executed|handled|sent|ack|last_report)_at$|At$/.test(field);
}

export function formatDateTime(value) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

export function formatDateFields(value, key = "") {
  if (Array.isArray(value)) return value.map((item) => formatDateFields(item));
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, formatDateFields(entryValue, entryKey)]));
  }
  if (isDateField(key)) return formatDateTime(value);
  return value;
}
