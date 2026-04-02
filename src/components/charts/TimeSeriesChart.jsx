import { scaleLinear } from "d3-scale";
import {
  formatCompactCurrency,
  formatDecimal,
  formatNumber
} from "../../lib/formatters";

const WIDTH = 760;
const HEIGHT = 300;
const MARGIN = { top: 24, right: 36, bottom: 36, left: 120 };

function buildLinePath(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function buildAreaPath(points, baseline) {
  if (!points.length) {
    return "";
  }

  const linePath = buildLinePath(points);
  const lastPoint = points.at(-1);
  const firstPoint = points[0];

  return `${linePath} L ${lastPoint.x} ${baseline} L ${firstPoint.x} ${baseline} Z`;
}

function formatMetricValue(value, variant) {
  if (variant === "currency") {
    return formatCompactCurrency(value);
  }

  if (variant === "decimal") {
    return formatDecimal(value);
  }

  return formatNumber(value);
}

export default function TimeSeriesChart({
  data,
  globalMax,
  ariaLabel = "Funding by year",
  countKey = "projectCount",
  countLabel = "projects",
  secondaryKey = null,
  secondaryLabel = "",
  valueKey = "totalFundingNok",
  valueVariant = "currency"
}) {
  if (!data.length) {
    return (
      <div className="empty-panel">
        No annual series is available for the current filter combination.
      </div>
    );
  }

  const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const years = data.map((item) => item.year);
  const maxValue = globalMax || Math.max(...data.map((item) => item[valueKey] ?? 0), 1);
  const xScale = scaleLinear()
    .domain([Math.min(...years), Math.max(...years)])
    .range([MARGIN.left, MARGIN.left + innerWidth]);
  const yScale = scaleLinear()
    .domain([0, maxValue])
    .range([MARGIN.top + innerHeight, MARGIN.top]);
  const points = data.map((item) => ({
    ...item,
    x: xScale(item.year),
    y: yScale(item[valueKey] ?? 0)
  }));

  return (
    <svg
      aria-label={ariaLabel}
      className="timeseries-chart"
      role="img"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      overflow="visible"
    >
      <path
        d={buildAreaPath(points, MARGIN.top + innerHeight)}
        fill="url(#areaGradient)"
        opacity="0.28"
      />
      <path
        d={buildLinePath(points)}
        fill="none"
        stroke="#d1663b"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point) => (
        <g key={point.year}>
          <circle
            cx={point.x}
            cy={point.y}
            fill="#0d2336"
            r="5.5"
            stroke="#f8f1e8"
            strokeWidth="2"
          />
          <title>
            {point.year}: {formatMetricValue(point[valueKey] ?? 0, valueVariant)}
            {countKey ? ` and ${formatNumber(point[countKey] ?? 0)} ${countLabel}` : ""}
            {secondaryKey
              ? `, ${formatNumber(point[secondaryKey] ?? 0)} ${secondaryLabel}`
              : ""}
          </title>
        </g>
      ))}
      {data.map((item, index) => {
        const step = Math.max(1, Math.ceil(data.length / 8));
        if (index % step !== 0 && index !== data.length - 1) return null;

        return (
          <text
            className="chart-axis-label"
            key={item.year}
            x={xScale(item.year)}
            y={HEIGHT - 10}
          >
            {item.year}
          </text>
        );
      })}
      {[0, 0.5, 1].map((ratio) => {
        const value = Math.round(maxValue * ratio);
        const y = yScale(value);

        return (
          <g key={ratio}>
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={y}
              y2={y}
              className="chart-gridline"
            />
            <text className="chart-axis-label is-y-axis" x={MARGIN.left - 12} y={y + 4}>
              {formatMetricValue(value, valueVariant)}
            </text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#d1663b" />
          <stop offset="100%" stopColor="#d1663b" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
