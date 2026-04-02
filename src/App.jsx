import { startTransition, useDeferredValue, useEffect, useState } from "react";
import FilterBar from "./components/FilterBar";
import KpiStrip from "./components/KpiStrip";
import CountyMap from "./components/charts/CountyMap";
import RankingBars from "./components/charts/RankingBars";
import TimeSeriesChart from "./components/charts/TimeSeriesChart";
import {
  ALL_FILTER_VALUE,
  buildCountySeries,
  buildCountySeriesFromAggregate,
  buildDimensionRankings,
  buildDimensionRankingsFromAggregate,
  buildKpis,
  buildTimeseries,
  filterCubeRecords,
  isDefaultFilter
} from "./lib/dashboard";

const DEFAULT_FILTERS = {
  year: ALL_FILTER_VALUE,
  countyId: ALL_FILTER_VALUE,
  institutionId: ALL_FILTER_VALUE,
  schemeId: ALL_FILTER_VALUE,
  subjectId: ALL_FILTER_VALUE
};

function buildDataUrl(path) {
  return `${import.meta.env.BASE_URL}${path}`;
}

function resolveOptionLabel(options, value, emptyLabel) {
  if (value === ALL_FILTER_VALUE) {
    return emptyLabel;
  }

  if (!Array.isArray(options)) {
    return value;
  }

  const match = options.find((option) =>
    typeof option === "number" ? String(option) === value : option.id === value
  );

  if (!match) {
    return value;
  }

  return typeof match === "number" ? String(match) : match.label;
}

export default function App() {
  const [dashboardData, setDashboardData] = useState(null);
  const [status, setStatus] = useState({ type: "loading", message: "" });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const deferredFilters = useDeferredValue(filters);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        const responses = await Promise.all([
          fetch(buildDataUrl("data/summary.json")),
          fetch(buildDataUrl("data/funding_by_county.json")),
          fetch(buildDataUrl("data/funding_timeseries.json")),
          fetch(buildDataUrl("data/funding_by_dimension.json")),
          fetch(buildDataUrl("data/funding_cube.json")),
          fetch(buildDataUrl("geo/norway-counties.geojson"))
        ]);

        for (const response of responses) {
          if (!response.ok) {
            throw new Error(`Static asset load failed with ${response.status}.`);
          }
        }

        const [
          summary,
          byCounty,
          timeseries,
          byDimension,
          cube,
          countyGeojson
        ] = await Promise.all(responses.map((response) => response.json()));

        if (!isMounted) {
          return;
        }

        setDashboardData({
          byCounty,
          byDimension,
          countyGeojson,
          cube,
          summary,
          timeseries
        });
        setStatus({ type: "ready", message: "" });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatus({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "The dashboard data could not be loaded."
        });
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const availableFilters = dashboardData?.summary.filters ?? {
    counties: [],
    institutions: [],
    schemes: [],
    subjects: [],
    years: []
  };
  const filteredCube = dashboardData
    ? filterCubeRecords(dashboardData.cube, deferredFilters)
    : [];
  const usingDefaultFilters = isDefaultFilter(deferredFilters);
  const kpis = buildKpis(filteredCube);
  const countySeries = dashboardData
    ? usingDefaultFilters
      ? buildCountySeriesFromAggregate(
          dashboardData.byCounty,
          availableFilters.counties
        )
      : buildCountySeries(filteredCube, availableFilters.counties)
    : [];
  const timeseries = dashboardData
    ? usingDefaultFilters
      ? dashboardData.timeseries
      : buildTimeseries(filteredCube, availableFilters.years)
    : [];
  const rankings = dashboardData
    ? usingDefaultFilters
      ? buildDimensionRankingsFromAggregate(dashboardData.byDimension)
      : buildDimensionRankings(filteredCube, availableFilters)
    : { institutions: [], schemes: [], subjects: [] };
  const activeCountyId =
    deferredFilters.countyId === ALL_FILTER_VALUE
      ? null
      : deferredFilters.countyId;
  const selectedCounty =
    (activeCountyId
      ? countySeries.find((item) => item.countyId === activeCountyId)
      : null) ?? null;
  const activeScope = [
    {
      label: "Year",
      value: resolveOptionLabel(availableFilters.years, deferredFilters.year, "All years")
    },
    {
      label: "County",
      value: resolveOptionLabel(
        availableFilters.counties,
        deferredFilters.countyId,
        "All counties"
      )
    },
    {
      label: "Institution",
      value: resolveOptionLabel(
        availableFilters.institutions,
        deferredFilters.institutionId,
        "All institutions"
      )
    },
    {
      label: "Scheme",
      value: resolveOptionLabel(
        availableFilters.schemes,
        deferredFilters.schemeId,
        "All schemes"
      )
    },
    {
      label: "Subject",
      value: resolveOptionLabel(
        availableFilters.subjects,
        deferredFilters.subjectId,
        "All subjects"
      )
    }
  ];
  const leadCounty = countySeries.find((item) => item.totalFundingNok > 0);
  const peakYear =
    timeseries.length > 0
      ? timeseries.reduce((best, current) =>
          current.totalFundingNok > best.totalFundingNok ? current : best
        )
      : null;
  const leadInstitution = rankings.institutions[0] ?? null;
  const highlights = [
    {
      label: activeCountyId ? "Selected county" : "Leading county",
      value: (selectedCounty ?? leadCounty)?.countyName ?? "No data",
      meta:
        selectedCounty ?? leadCounty
          ? `${(selectedCounty ?? leadCounty).projectCount} projects`
          : "No allocation visible"
    },
    {
      label: "Peak year",
      value: peakYear ? String(peakYear.year) : "No data",
      meta: peakYear ? `${peakYear.projectCount} projects` : "No annual series"
    },
    {
      label: "Top institution",
      value: leadInstitution?.label ?? "No data",
      meta: leadInstitution
        ? `${leadInstitution.projectCount} projects`
        : "No institution ranking"
    }
  ];

  function updateFilter(key, value) {
    startTransition(() => {
      setFilters((current) => ({
        ...current,
        [key]: value
      }));
    });
  }

  function resetFilters() {
    startTransition(() => {
      setFilters(DEFAULT_FILTERS);
    });
  }

  function selectCounty(countyId) {
    updateFilter(
      "countyId",
      countyId === deferredFilters.countyId ? ALL_FILTER_VALUE : countyId
    );
  }

  return (
    <main className="app-shell">
      <aside className="control-rail">
        <section className="rail-brand">
          <p className="eyebrow">NFR Funding Stats</p>
          <h1>Norwegian research funding, shaped into a static decision surface.</h1>
          <p className="rail-copy">
            County-level geography, annual funding movement, and ranked allocation
            views designed for a GitHub Pages deployment.
          </p>
        </section>

        <section className="rail-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Scope controls</p>
              <h2>Slice the current view</h2>
            </div>
          </div>
          <FilterBar
            activeFilters={filters}
            availableFilters={availableFilters}
            onFilterChange={updateFilter}
            onReset={resetFilters}
          />
        </section>

        <section className="rail-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Current slice</p>
              <h2>Active scope</h2>
            </div>
          </div>
          <dl className="scope-list">
            {activeScope.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {dashboardData ? (
          <section className="rail-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Method notes</p>
                <h2>Interpretation boundaries</h2>
              </div>
            </div>
            <ul className="note-list">
              {dashboardData.summary.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
              <li>
                County geometry is based on Kartverket data via
                `robhop/fylker-og-kommuner` under CC BY 4.0.
              </li>
            </ul>
          </section>
        ) : null}
      </aside>

      <section className="workspace">
        <section className="workspace-header">
          <div>
            <p className="eyebrow">Analytics workspace</p>
            <h2>County choropleth, annual funding profile, and ranked allocation signals</h2>
          </div>
          <div className="header-meta">
            <p>Static JSON-backed interface</p>
            <p>Latest year: {dashboardData?.summary.latestYear ?? "Loading"}</p>
          </div>
        </section>

        {status.type === "error" ? (
          <section className="status-panel is-error">
            <h2>Data load failed</h2>
            <p>{status.message}</p>
          </section>
        ) : null}

        {status.type === "loading" ? (
          <section className="status-panel">
            <h2>Loading dashboard assets</h2>
            <p>Fetching static JSON bundles and county geometry.</p>
          </section>
        ) : null}

        {status.type === "ready" ? (
          <>
            <section className="signal-strip">
              {highlights.map((item) => (
                <article className="signal-item" key={item.label}>
                  <p>{item.label}</p>
                  <strong>{item.value}</strong>
                  <span>{item.meta}</span>
                </article>
              ))}
            </section>

            <KpiStrip items={kpis} />

            {!filteredCube.length ? (
              <section className="status-panel">
                <h2>No matching records</h2>
                <p>Reset one or more filters to bring data back into view.</p>
              </section>
            ) : null}

            <section className="workspace-grid">
              <CountyMap
                activeCountyId={activeCountyId}
                data={countySeries}
                geojson={dashboardData.countyGeojson}
                onSelectCounty={selectCounty}
              />
              <TimeSeriesChart data={timeseries} />
            </section>

            <section className="breakdown-header">
              <div>
                <p className="eyebrow">Allocation breakdowns</p>
                <h2>Who receives funding, through which scheme, and in what subject mix</h2>
              </div>
              <p className="panel-copy">
                These ranked views react to the same selected slice as the county map
                and annual trend.
              </p>
            </section>

            <section className="ranking-grid">
              <RankingBars
                items={rankings.institutions}
                subtitle="Institution totals reflect the registered project owner."
                title="Top institutions"
              />
              <RankingBars
                items={rankings.schemes}
                subtitle="Schemes are ranked by total allocated NOK."
                title="Top funding schemes"
              />
              <RankingBars
                items={rankings.subjects}
                subtitle="Subject totals should not be treated as additive across overlapping themes."
                title="Top subject fields"
              />
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
