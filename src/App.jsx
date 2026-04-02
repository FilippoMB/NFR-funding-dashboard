import {
  Suspense,
  lazy,
  startTransition,
  useDeferredValue,
  useEffect,
  useState
} from "react";
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
  buildInstitutionRankings,
  buildKpis,
  buildTimeseries,
  filterCubeRecords,
  isDefaultFilter
} from "./lib/dashboard";

const AllocationPieChart = lazy(() => import("./components/charts/AllocationPieChart"));

const DEFAULT_FILTERS = {
  year: ALL_FILTER_VALUE,
  countyId: ALL_FILTER_VALUE,
  schemeId: ALL_FILTER_VALUE,
  subjectId: ALL_FILTER_VALUE
};

function buildDataUrl(path) {
  return `${import.meta.env.BASE_URL}${path}`;
}

export default function App() {
  const [dashboardData, setDashboardData] = useState(null);
  const [institutionCubeStatus, setInstitutionCubeStatus] = useState("idle");
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
          institutionCube: null,
          summary,
          timeseries
        });
        setInstitutionCubeStatus("idle");
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
    schemes: [],
    subjects: [],
    years: []
  };
  const filteredCube = dashboardData
    ? filterCubeRecords(dashboardData.cube, deferredFilters)
    : [];
  const usingDefaultFilters = isDefaultFilter(deferredFilters);

  useEffect(() => {
    if (
      !dashboardData ||
      dashboardData.institutionCube ||
      institutionCubeStatus === "loading" ||
      institutionCubeStatus === "ready"
    ) {
      return;
    }

    async function loadInstitutionCube() {
      try {
        setInstitutionCubeStatus("loading");
        const response = await fetch(buildDataUrl("data/funding_institution_cube.json"));

        if (!response.ok) {
          throw new Error(`Static asset load failed with ${response.status}.`);
        }

        const institutionCube = await response.json();

        setDashboardData((current) =>
          current ? { ...current, institutionCube } : current
        );
        setInstitutionCubeStatus("ready");
      } catch (error) {
        setInstitutionCubeStatus("error");
        console.error("Institution ranking data could not be loaded.", error);
      }
    }

    void loadInstitutionCube();
  }, [dashboardData, institutionCubeStatus]);

  const kpis = buildKpis(filteredCube);
  const countySeries = dashboardData
    ? usingDefaultFilters
      ? buildCountySeriesFromAggregate(
          dashboardData.byCounty,
          availableFilters.counties
        )
      : buildCountySeries(filteredCube, availableFilters.counties)
    : [];
  const yearAgnosticFilters = { ...deferredFilters, year: ALL_FILTER_VALUE };
  const yearAgnosticCube = dashboardData
    ? filterCubeRecords(dashboardData.cube, yearAgnosticFilters)
    : [];
  const yearAgnosticTimeseries = dashboardData
    ? isDefaultFilter(yearAgnosticFilters)
      ? dashboardData.timeseries
      : buildTimeseries(yearAgnosticCube, availableFilters.years)
    : [];
  const timeseries = dashboardData
    ? usingDefaultFilters
      ? dashboardData.timeseries
      : buildTimeseries(filteredCube, availableFilters.years)
    : [];      
  const contextualMax = Math.max(
    ...yearAgnosticTimeseries.map((item) => item.totalFundingNok),
    1
  );

  const defaultRankings = dashboardData
    ? buildDimensionRankingsFromAggregate(dashboardData.byDimension)
    : { institutions: [], schemes: [], subjects: [] };
  const dimensionRankings = dashboardData
    ? usingDefaultFilters
      ? defaultRankings
      : buildDimensionRankings(filteredCube, availableFilters)
    : { institutions: [], schemes: [], subjects: [] };
  const institutionRankings = dashboardData
    ? usingDefaultFilters
      ? defaultRankings.institutions
      : dashboardData.institutionCube
        ? buildInstitutionRankings(
            filterCubeRecords(dashboardData.institutionCube, deferredFilters)
          )
        : []
    : [];
  const rankingsResolved = {
    ...dimensionRankings,
    institutions: institutionRankings
  };
  const activeCountyId =
    deferredFilters.countyId === ALL_FILTER_VALUE
      ? null
      : deferredFilters.countyId;
  const selectedCounty =
    (activeCountyId
      ? countySeries.find((item) => item.countyId === activeCountyId)
      : null) ?? null;
  const leadCounty = countySeries.find((item) => item.totalFundingNok > 0);
  const peakYear =
    timeseries.length > 0
      ? timeseries.reduce((best, current) =>
          current.totalFundingNok > best.totalFundingNok ? current : best
        )
      : null;
  const leadInstitution = rankingsResolved.institutions[0] ?? null;
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
      value:
        !usingDefaultFilters && institutionCubeStatus === "loading"
          ? "Loading…"
          : leadInstitution?.label ?? "No data",
      meta:
        !usingDefaultFilters && institutionCubeStatus === "loading"
          ? "Fetching institution slices"
          : leadInstitution
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
          <p>{dashboardData?.summary?.source?.label ?? "Forskningsrådet open data"}</p>
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
                  <TimeSeriesChart 
                    data={timeseries} 
                    globalMax={contextualMax}
                  />
                </div>

                <div className="pie-panels" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                  <div className="ranking-panel">
                    <div className="panel-heading" style={{marginBottom: "8px"}}>
                      <h3>Funding Schemes</h3>
                    </div>
                    <Suspense fallback={<div className="empty-panel">Loading chart…</div>}>
                      <AllocationPieChart items={rankingsResolved.schemes} />
                    </Suspense>
                  </div>
                  <div className="ranking-panel">
                    <div className="panel-heading" style={{marginBottom: "8px"}}>
                      <h3>Subject Fields</h3>
                    </div>
                    <Suspense fallback={<div className="empty-panel">Loading chart…</div>}>
                      <AllocationPieChart items={rankingsResolved.subjects} />
                    </Suspense>
                  </div>
                </div>
              </div>
            </section>

            <section className="kpi-strip" style={{ marginTop: "-8px" }}>
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

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>              
              <section className="ranking-grid single-row">
                <div className="ranking-panel">
                  {!usingDefaultFilters && institutionCubeStatus === "loading" ? (
                    <section className="ranking-panel">
                      <div className="panel-heading">
                        <div>
                          <p className="eyebrow">Ranked allocation</p>
                          <h2>Top Institutions</h2>
                        </div>
                      </div>
                      <div className="empty-panel">
                        Loading institution ranking for the selected slice.
                      </div>
                    </section>
                  ) : (
                    <RankingBars
                      items={rankingsResolved.institutions}
                      title="Top Institutions"
                    />
                  )}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
