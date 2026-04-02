import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber
} from "../lib/formatters";

function formatKpi(item) {
  if (item.variant === "currency") {
    return item.value >= 1_000_000
      ? formatCompactCurrency(item.value)
      : formatCurrency(item.value);
  }

  return formatNumber(item.value);
}

export default function KpiStrip({ items }) {
  return (
    <section className="kpi-strip" aria-label="Selected KPIs">
      {items.map((item) => (
        <article className="kpi-item" key={item.label}>
          <p>{item.label}</p>
          <strong>{formatKpi(item)}</strong>
        </article>
      ))}
    </section>
  );
}
