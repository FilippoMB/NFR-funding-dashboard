import {
  formatCompactCurrency,
  formatDecimal,
  formatNumber
} from "../../lib/formatters";

function formatMetricValue(value, variant) {
  if (variant === "currency") {
    return formatCompactCurrency(value);
  }

  if (variant === "decimal") {
    return formatDecimal(value);
  }

  return formatNumber(value);
}

function RankingItem({
  index,
  item,
  maxValue,
  metaRenderer,
  valueKey,
  valueVariant
}) {
  const width = maxValue > 0 ? ((item[valueKey] ?? 0) / maxValue) * 100 : 0;

  return (
    <li className="ranking-item">
      <span className="rank-index">{String(index + 1).padStart(2, "0")}</span>
      <div className="ranking-labels">
        <strong>{item.label}</strong>
        <span>{formatMetricValue(item[valueKey] ?? 0, valueVariant)}</span>
      </div>
      <div className="ranking-track" aria-hidden="true">
        <div className="ranking-fill" style={{ width: `${width}%` }} />
      </div>
      <p>{metaRenderer(item)}</p>
    </li>
  );
}

export default function RankingBars({
  items,
  subtitle,
  title,
  valueKey = "totalFundingNok",
  valueVariant = "currency",
  metaRenderer = (item) => `${formatNumber(item.projectCount)} projects in the selected slice`,
  emptyLabel = "No ranked values are available for the current filter combination."
}) {
  if (!items.length) {
    return (
      <section className="ranking-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Ranked allocation</p>
            <h2>{title}</h2>
          </div>
          <p className="panel-copy">{subtitle}</p>
        </div>
        <div className="empty-panel">{emptyLabel}</div>
      </section>
    );
  }

  const maxValue = Math.max(...items.map((item) => item[valueKey] ?? 0), 1);

  return (
    <section className="ranking-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Ranked allocation</p>
          <h2>{title}</h2>
        </div>
        <p className="panel-copy">{subtitle}</p>
      </div>
      <ol className="ranking-list">
        {items.map((item, index) => (
          <RankingItem
            index={index}
            item={item}
            key={item.id}
            maxValue={maxValue}
            metaRenderer={metaRenderer}
            valueKey={valueKey}
            valueVariant={valueVariant}
          />
        ))}
      </ol>
    </section>
  );
}
