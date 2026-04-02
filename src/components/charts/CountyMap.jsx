import { max } from "d3-array";
import { geoMercator, geoPath } from "d3-geo";
import { scaleLinear } from "d3-scale";
import { formatCompactCurrency, formatNumber } from "../../lib/formatters";

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
    countyId: normalizeCountyId(countyName),
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

export default function CountyMap({
  activeCountyId,
  data,
  geojson,
  onSelectCounty
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
        [44, 34],
        [VIEWBOX_WIDTH - 44, VIEWBOX_HEIGHT - 34]
      ],
      rewoundGeojson
    );
  const countyLookup = buildCountyLookup(data);
  const pathBuilder = geoPath(projection);
  const maxFunding = max(data, (item) => item.totalFundingNok) ?? 0;
  const colorScale = scaleLinear()
    .domain([0, Math.max(maxFunding, 1)])
    .range(["#f7efe5", "#cc6439"]);
  const features = rewoundGeojson.features.map((feature) => {
    const meta = getFeatureMeta(feature);
    const county = countyLookup[meta.countyId] ?? {
      countyId: meta.countyId,
      countyName: meta.countyName,
      projectCount: 0,
      totalFundingNok: 0
    };

    return {
      county,
      feature,
      meta
    };
  });
  const focusCounty =
    (activeCountyId ? countyLookup[activeCountyId] : null) ??
    data.find((item) => item.totalFundingNok > 0) ??
    null;
  const countiesWithFunding = data.filter((item) => item.totalFundingNok > 0).length;
  const labelledCountyIds = new Set(
    [
      activeCountyId,
      ...data
        .filter((item) => item.totalFundingNok > 0)
        .slice(0, 4)
        .map((item) => item.countyId)
    ].filter(Boolean)
  );
  const topCounties = data.filter((item) => item.totalFundingNok > 0).slice(0, 5);

  return (
    <section className="map-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">County funding map</p>
          <h2>Real county boundary choropleth</h2>
        </div>
        <p className="panel-copy">
          Click a county to filter the trend and ranking views.
        </p>
      </div>
      <div className="map-layout">
        <div className="map-stage">
          <svg
            aria-label="County-level choropleth of Norwegian funding allocations"
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
                    county.totalFundingNok === 0 ? " is-empty" : ""
                  }`}
                  d={pathBuilder(feature)}
                  fill={colorScale(county.totalFundingNok)}
                  key={countyId}
                  onClick={() => onSelectCounty(countyId)}
                  strokeWidth={isActive ? 3.2 : 1.15}
                >
                  <title>
                    {county.countyName}: {formatCompactCurrency(county.totalFundingNok)}
                    , {formatNumber(county.projectCount)} projects
                  </title>
                </path>
              );
            })}

            {features
              .filter(({ meta, county }) =>
                labelledCountyIds.has(meta.countyId) && county.totalFundingNok > 0
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
        </div>
        <div className="map-sidecar">
          <div className="focus-card">
            <p className="eyebrow">
              {activeCountyId ? "Selected county" : "Leading county"}
            </p>
            <h3>{focusCounty?.countyName ?? "No county selected"}</h3>
            <div className="focus-metrics">
              <div>
                <span>Funding</span>
                <strong>
                  {focusCounty
                    ? formatCompactCurrency(focusCounty.totalFundingNok)
                    : "NOK 0"}
                </strong>
              </div>
              <div>
                <span>Projects</span>
                <strong>
                  {focusCounty ? formatNumber(focusCounty.projectCount) : "0"}
                </strong>
              </div>
            </div>
          </div>

          <div className="map-legend">
            <p>Funding scale</p>
            <div className="legend-ramp" aria-hidden="true" />
            <div className="legend-scale">
              <span>NOK 0</span>
              <span>{formatCompactCurrency(maxFunding)}</span>
            </div>
            <p className="legend-note">
              {formatNumber(countiesWithFunding)} counties currently carry visible
              allocation in the selected slice.
            </p>
          </div>

          <div className="top-counties-card">
            <p className="eyebrow">Top counties</p>
            <ol className="top-counties-list">
              {topCounties.map((county) => (
                <li key={county.countyId}>
                  <span>{county.countyName}</span>
                  <strong>{formatCompactCurrency(county.totalFundingNok)}</strong>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
