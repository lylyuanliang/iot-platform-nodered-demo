export function StatusBadge({ value }) {
  const text = value ?? "-";
  const tone = /online|success|closed|confirmed/i.test(text) ? "good" : /warning|processing|sent|running/i.test(text) ? "warn" : /critical|failed|fault|offline/i.test(text) ? "bad" : "neutral";
  return <span className={`status ${tone}`}>{text}</span>;
}
