import { max } from "d3-array";
import { geoMercator, geoPath } from "d3-geo";
import { scaleLinear } from "d3-scale";
import {
  formatCompactCurrency,
  formatDecimal,
  formatNumber
} from "../../lib/formatters";

const VIEWBOX_WIDTH = 560;
const VIEWBOX_HEIGHT = 860;

function normalizeCountyId(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getFeatureMeta(feature) {
  const countyName =
    feature.properties.name ??
    feature.properties.fylkesnavn?.split(" - ")[0] ??
    feature.properties.id;

  return {
    countyId:
      feature.properties.fylkesnummer ??
      feature.properties.id ??
      normalizeCountyId(countyName),
    countyName
  };
}

function buildCountyLookup(data) {
  return Object.fromEntries(data.map((item) => [item.countyId, item]));
}

function rewindGeometry(geometry) {
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring, index) =>
        index === 0 ? [...ring].reverse() : ring
      )
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring, index) => (index === 0 ? [...ring].reverse() : ring))
      )
    };
  }

  return geometry;
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

export default function CountyMap({
  activeCountyId,
  ariaLabel = "County-level choropleth",
  countKey = "projectCount",
  countLabel = "projects",
  data,
  geojson,
  onSelectCounty,
  secondaryKey = null,
  secondaryLabel = "",
  valueKey = "totalFundingNok",
  valueVariant = "currency"
}) {
  const rewoundGeojson = {
    ...geojson,
    features: geojson.features.map((feature) => ({
      ...feature,
      geometry: rewindGeometry(feature.geometry)
    }))
  };
  const projection = geoMercator()
    .fitExtent(
      [
        [10, 10],
        [VIEWBOX_WIDTH - 10, VIEWBOX_HEIGHT - 10]
      ],
      rewoundGeojson
    );
  const countyLookup = buildCountyLookup(data);
  const pathBuilder = geoPath(projection);
  const maxMetric = max(data, (item) => item[valueKey] ?? 0) ?? 0;
  const colorScale = scaleLinear()
    .domain([0, Math.max(maxMetric, 1)])
    .range(["#f7efe5", "#cc6439"]);
  const features = rewoundGeojson.features.map((feature) => {
    const meta = getFeatureMeta(feature);
    const county = countyLookup[meta.countyId] ?? {
      countyId: meta.countyId,
      countyName: meta.countyName,
      [countKey]: 0,
      ...(secondaryKey ? { [secondaryKey]: 0 } : {}),
      [valueKey]: 0
    };

    return {
      county,
      feature,
      meta
    };
  });

  const labelledCountyIds = new Set(
    [
      activeCountyId,
      ...data
        .filter((item) => (item[valueKey] ?? 0) > 0)
        .slice(0, 4)
        .map((item) => item.countyId)
    ].filter(Boolean)
  );

  return (
    <svg
      aria-label={ariaLabel}
      className="county-map"
      role="img"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
    >
      {features.map(({ county, feature, meta }) => {
        const countyId = meta.countyId;
        const isActive = activeCountyId === countyId;

        return (
          <path
            className={`county-shape${isActive ? " is-active" : ""}${
              (county[valueKey] ?? 0) === 0 ? " is-empty" : ""
            }`}
            d={pathBuilder(feature)}
            fill={colorScale(county[valueKey] ?? 0)}
            key={countyId}
            onClick={() => onSelectCounty(countyId)}
            strokeWidth={isActive ? 3.2 : 1.15}
          >
            <title>
              {county.countyName}: {formatMetricValue(county[valueKey] ?? 0, valueVariant)}
              {countKey ? `, ${formatNumber(county[countKey] ?? 0)} ${countLabel}` : ""}
              {secondaryKey
                ? `, ${formatNumber(county[secondaryKey] ?? 0)} ${secondaryLabel}`
                : ""}
            </title>
          </path>
        );
      })}

      {features
        .filter(({ meta, county }) =>
          labelledCountyIds.has(meta.countyId) && (county[valueKey] ?? 0) > 0
        )
        .map(({ feature, meta }) => {
          const [x, y] = pathBuilder.centroid(feature);
          const anchor = x > VIEWBOX_WIDTH * 0.58 ? "end" : "start";
          const direction = anchor === "end" ? -1 : 1;

          return (
            <g className="county-label" key={`${meta.countyId}-label`}>
              <circle cx={x} cy={y} r="4.5" />
              <line
                x1={x}
                x2={x + direction * 16}
                y1={y}
                y2={y - 8}
              />
              <text
                textAnchor={anchor}
                x={x + direction * 22}
                y={y - 11}
              >
                {meta.countyName}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
