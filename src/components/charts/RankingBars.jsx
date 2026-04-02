import { useState } from "react";
import {
  formatCompactCurrency,
  formatDecimal,
  formatNumber
} from "../../lib/formatters";

const DISPLAY_TOP = "top";
const DISPLAY_BOTTOM = "bottom";
const DISPLAY_ALL = "all";
const DEFAULT_SLICE_SIZE = 6;

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
  displayRank,
  item,
  maxValue,
  metaRenderer,
  valueKey,
  valueVariant
}) {
  const width = maxValue > 0 ? ((item[valueKey] ?? 0) / maxValue) * 100 : 0;

  return (
    <li className="ranking-item">
      <span className="rank-index">{String(displayRank).padStart(2, "0")}</span>
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
  titles = null,
  subtitles = null,
  valueKey = "totalFundingNok",
  valueVariant = "currency",
  metaRenderer = (item) => `${formatNumber(item.projectCount)} projects in the selected slice`,
  emptyLabel = "No ranked values are available for the current filter combination."
}) {
  const [displayMode, setDisplayMode] = useState(DISPLAY_TOP);

  const displayItems = (() => {
    if (!items.length) {
      return [];
    }

    if (displayMode === DISPLAY_ALL) {
      return items.map((item, index) => ({
        ...item,
        displayRank: index + 1
      }));
    }

    if (displayMode === DISPLAY_BOTTOM) {
      return items
        .slice(-DEFAULT_SLICE_SIZE)
        .reverse()
        .map((item, index) => ({
          ...item,
          displayRank: items.length - index
        }));
    }

    return items.slice(0, DEFAULT_SLICE_SIZE).map((item, index) => ({
      ...item,
      displayRank: index + 1
    }));
  })();

  const activeTitle =
    typeof title === "string" ? title : titles?.[displayMode] ?? titles?.[DISPLAY_TOP];
  const activeSubtitle =
    typeof subtitle === "string"
      ? subtitle
      : subtitles?.[displayMode] ?? subtitles?.[DISPLAY_TOP] ?? "";

  if (!items.length) {
    return (
      <section className="ranking-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Ranked allocation</p>
            <h2>{activeTitle}</h2>
          </div>
          <p className="panel-copy">{activeSubtitle}</p>
        </div>
        <div className="empty-panel">{emptyLabel}</div>
      </section>
    );
  }

  const maxValue = Math.max(...displayItems.map((item) => item[valueKey] ?? 0), 1);

  return (
    <section className="ranking-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Ranked allocation</p>
          <h2>{activeTitle}</h2>
        </div>
        <p className="panel-copy">{activeSubtitle}</p>
      </div>
      <ol className="ranking-list">
        {displayItems.map((item) => (
          <RankingItem
            displayRank={item.displayRank}
            item={item}
            key={item.id}
            maxValue={maxValue}
            metaRenderer={metaRenderer}
            valueKey={valueKey}
            valueVariant={valueVariant}
          />
        ))}
      </ol>
      <div className="ranking-footer">
        <p className="ranking-count">
          Showing {displayItems.length} of {items.length} institutions
        </p>
        <div className="ranking-actions" role="group" aria-label="Ranking view mode">
          <button
            className={`ranking-action${displayMode === DISPLAY_TOP ? " is-active" : ""}`}
            onClick={() => setDisplayMode(DISPLAY_TOP)}
            type="button"
          >
            Show top
          </button>
          <button
            className={`ranking-action${displayMode === DISPLAY_BOTTOM ? " is-active" : ""}`}
            onClick={() => setDisplayMode(DISPLAY_BOTTOM)}
            type="button"
          >
            Show bottom
          </button>
          <button
            className={`ranking-action${displayMode === DISPLAY_ALL ? " is-active" : ""}`}
            onClick={() => setDisplayMode(DISPLAY_ALL)}
            type="button"
          >
            Show all
          </button>
        </div>
      </div>
    </section>
  );
}
