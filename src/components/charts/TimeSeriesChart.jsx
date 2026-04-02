import { scaleLinear } from "d3-scale";
import { formatCompactCurrency, formatNumber } from "../../lib/formatters";

const WIDTH = 760;
const HEIGHT = 300;
const MARGIN = { top: 24, right: 18, bottom: 36, left: 62 };

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

export default function TimeSeriesChart({ data }) {
  if (!data.length) {
    return (
      <section className="chart-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Funding trend</p>
            <h2>Yearly allocation profile</h2>
          </div>
        </div>
        <div className="empty-panel">
          No annual series is available for the current filter combination.
        </div>
      </section>
    );
  }

  const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const years = data.map((item) => item.year);
  const maxValue = Math.max(...data.map((item) => item.totalFundingNok), 1);
  const xScale = scaleLinear()
    .domain([Math.min(...years), Math.max(...years)])
    .range([MARGIN.left, MARGIN.left + innerWidth]);
  const yScale = scaleLinear()
    .domain([0, maxValue])
    .range([MARGIN.top + innerHeight, MARGIN.top]);
  const points = data.map((item) => ({
    ...item,
    x: xScale(item.year),
    y: yScale(item.totalFundingNok)
  }));

  return (
    <section className="chart-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Funding trend</p>
          <h2>Yearly allocation profile</h2>
        </div>
        <p className="panel-copy">
          The curve tracks allocated NOK across the selected slice.
        </p>
      </div>
      <svg
        aria-label="Funding by year"
        className="timeseries-chart"
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
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
              {point.year}: {formatCompactCurrency(point.totalFundingNok)} and{" "}
              {formatNumber(point.projectCount)} projects
            </title>
          </g>
        ))}
        {data.map((item) => (
          <text
            className="chart-axis-label"
            key={item.year}
            x={xScale(item.year)}
            y={HEIGHT - 10}
          >
            {item.year}
          </text>
        ))}
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
              <text className="chart-axis-label is-left" x="8" y={y + 4}>
                {formatCompactCurrency(value)}
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
    </section>
  );
}
