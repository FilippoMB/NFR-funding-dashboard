import { formatCompactCurrency, formatNumber } from "../../lib/formatters";

function RankingItem({ index, item, maxValue }) {
  const width = maxValue > 0 ? (item.totalFundingNok / maxValue) * 100 : 0;

  return (
    <li className="ranking-item">
      <span className="rank-index">{String(index + 1).padStart(2, "0")}</span>
      <div className="ranking-labels">
        <strong>{item.label}</strong>
        <span>{formatCompactCurrency(item.totalFundingNok)}</span>
      </div>
      <div className="ranking-track" aria-hidden="true">
        <div className="ranking-fill" style={{ width: `${width}%` }} />
      </div>
      <p>
        {formatNumber(item.projectCount)} projects in the selected slice
      </p>
    </li>
  );
}

export default function RankingBars({ items, subtitle, title }) {
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
        <div className="empty-panel">
          No ranked values are available for the current filter combination.
        </div>
      </section>
    );
  }

  const maxValue = Math.max(...items.map((item) => item.totalFundingNok), 1);

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
          />
        ))}
      </ol>
    </section>
  );
}
