import { startTransition, useDeferredValue, useEffect, useState } from "react";
import FilterBar from "./components/FilterBar";
import KpiStrip from "./components/KpiStrip";
import CountyMap from "./components/charts/CountyMap";
import RankingBars from "./components/charts/RankingBars";
import TimeSeriesChart from "./components/charts/TimeSeriesChart";
import AllocationPieChart from "./components/charts/AllocationPieChart";
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
    <main className="app-shell sidebar-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>NFR Funding</h1>
          <p>Norwegian research statistics</p>
        </div>
        <FilterBar
          activeFilters={filters}
          availableFilters={availableFilters}
          onFilterChange={updateFilter}
          onReset={resetFilters}
        />
        <div className="sidebar-footer">
          <p>Data: JSON Mock Build</p>
          <p>Latest year: {dashboardData?.summary?.latestYear ?? "..."}</p>
        </div>
      </aside>

      <section className="workspace-main">
        {status.type === "error" ? (
          <section className="status-panel is-error">
            <h2>Data Load Failed</h2>
            <p>{status.message}</p>
          </section>
        ) : null}

        {status.type === "loading" ? (
          <section className="status-panel">
            <h2>Loading Dashboard Assets...</h2>
            <p>Fetching JSON bundles and county geometry</p>
          </section>
        ) : null}

        {status.type === "ready" ? (
          <>
            <section className="top-visuals layout-split">
              <div className="map-panel map-tall">
                <div className="panel-heading">
                  <h2>Funding by region</h2>
                  <p className="panel-copy">
                    Click a county to filter the trend and ranking views.
                  </p>
                </div>
                <div className="map-stage map-enlarged">
                  <CountyMap
                    activeCountyId={activeCountyId}
                    data={countySeries}
                    geojson={dashboardData.countyGeojson}
                    onSelectCounty={selectCounty}
                  />
                </div>
              </div>
              
              <div className="right-panels" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div className="chart-panel">
                  <div className="panel-heading">
                    <h2>Annual funding movement</h2>
                    <p className="panel-copy">
                      The curve tracks allocated NOK across the selected slice.
                    </p>
                  </div>
                  <TimeSeriesChart data={timeseries} />
                </div>

                <div className="pie-panels" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                  <div className="ranking-panel">
                    <div className="panel-heading" style={{marginBottom: "8px"}}>
                      <h3>Funding Schemes</h3>
                    </div>
                    <AllocationPieChart items={rankings.schemes} />
                  </div>
                  <div className="ranking-panel">
                    <div className="panel-heading" style={{marginBottom: "8px"}}>
                      <h3>Subject Fields</h3>
                    </div>
                    <AllocationPieChart items={rankings.subjects} />
                  </div>
                </div>
              </div>
            </section>

            <section className="kpi-strip u-margin-top">
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
                <h2>No Matching Records</h2>
                <p>Try adjusting or resetting your filters.</p>
              </section>
            ) : null}

            <div className="panel-heading u-margin-top">
              <h2>Allocation Breakdowns</h2>
            </div>
            
            <section className="ranking-grid single-row">
              <div className="ranking-panel">
                <RankingBars
                  items={rankings.institutions}
                  title="Top Institutions"
                />
              </div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
