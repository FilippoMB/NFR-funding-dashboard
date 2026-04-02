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
  buildEfficiencyCountySeries,
  buildEfficiencyCountySeriesFromAggregate,
  buildEfficiencyInstitutionRankings,
  buildEfficiencyInstitutionRankingsFromAggregate,
  buildEfficiencyKpis,
  buildEfficiencyKpisFromSummary,
  buildEfficiencyTimeseries,
  buildFundingKpisFromSummary,
  buildImpactCountySeries,
  buildImpactCountySeriesFromAggregate,
  buildImpactInstitutionRankings,
  buildImpactInstitutionRankingsFromAggregate,
  buildImpactKpis,
  buildImpactKpisFromSummary,
  buildImpactTimeseries,
  buildInstitutionRankings,
  buildKpis,
  buildTimeseries,
  buildTopMetricRanking,
  filterCubeRecords,
  isDefaultFilter
} from "./lib/dashboard";
import {
  formatCompactCurrency,
  formatDecimal,
  formatNumber
} from "./lib/formatters";

const AllocationPieChart = lazy(() => import("./components/charts/AllocationPieChart"));

const MODE_FUNDING = "funding";
const MODE_IMPACT = "impact";
const MODE_EFFICIENCY = "efficiency";

const FILTER_CONFIGS = {
  [MODE_FUNDING]: [
    { key: "countyId", label: "County", optionsKey: "counties" },
    { key: "schemeId", label: "Funding Scheme", optionsKey: "schemes" },
    { key: "subjectId", label: "Subject Field", optionsKey: "subjects" }
  ],
  [MODE_IMPACT]: [{ key: "countyId", label: "County", optionsKey: "counties" }],
  [MODE_EFFICIENCY]: [{ key: "countyId", label: "County", optionsKey: "counties" }]
};

const DEFAULT_FILTERS = {
  year: ALL_FILTER_VALUE,
  countyId: ALL_FILTER_VALUE,
  schemeId: ALL_FILTER_VALUE,
  subjectId: ALL_FILTER_VALUE
};

function buildDataUrl(path) {
  return `${import.meta.env.BASE_URL}${path}`;
}

function normalizeFiltersForMode(filters, mode) {
  if (mode === MODE_IMPACT || mode === MODE_EFFICIENCY) {
    return {
      ...filters,
      schemeId: ALL_FILTER_VALUE,
      subjectId: ALL_FILTER_VALUE
    };
  }

  return filters;
}

function buildFundingHighlights({
  activeCountyId,
  countySeries,
  institutionCubeStatus,
  rankings,
  selectedCounty,
  timeseries
}) {
  const leadCounty = countySeries.find((item) => item.totalFundingNok > 0) ?? null;
  const peakYear =
    timeseries.length > 0
      ? timeseries.reduce((best, current) =>
          current.totalFundingNok > best.totalFundingNok ? current : best
        )
      : null;
  const leadInstitution = rankings.institutions[0] ?? null;

  return [
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
        institutionCubeStatus === "loading"
          ? "Loading…"
          : leadInstitution?.label ?? "No data",
      meta:
        institutionCubeStatus === "loading"
          ? "Fetching institution slices"
          : leadInstitution
            ? `${leadInstitution.projectCount} projects`
            : "No institution ranking"
    }
  ];
}

function buildImpactHighlights({
  activeCountyId,
  countySeries,
  rankings,
  selectedCounty,
  timeseries
}) {
  const leadCounty = countySeries.find((item) => item.paperCount > 0) ?? null;
  const peakYear =
    timeseries.length > 0
      ? timeseries.reduce((best, current) =>
          current.paperCount > best.paperCount ? current : best
        )
      : null;
  const leadInstitution = rankings.institutions[0] ?? null;

  return [
    {
      label: activeCountyId ? "Selected county" : "Most active county",
      value: (selectedCounty ?? leadCounty)?.countyName ?? "No data",
      meta:
        selectedCounty ?? leadCounty
          ? `${formatNumber((selectedCounty ?? leadCounty).paperCount)} papers`
          : "No publication activity"
    },
    {
      label: "Peak publication year",
      value: peakYear ? String(peakYear.year) : "No data",
      meta: peakYear ? `${formatNumber(peakYear.citationCount)} citations` : "No annual series"
    },
    {
      label: "Top institution",
      value: leadInstitution?.label ?? "No data",
      meta: leadInstitution
        ? `${formatNumber(leadInstitution.citationCount)} citations`
        : "No institution ranking"
    }
  ];
}

function buildEfficiencyHighlights({
  activeCountyId,
  countySeries,
  rankings,
  selectedCounty,
  timeseries
}) {
  const leadCounty = countySeries.find((item) => item.papersPerMnok > 0) ?? null;
  const peakYear =
    timeseries.length > 0
      ? timeseries.reduce((best, current) =>
          current.papersPerMnok > best.papersPerMnok ? current : best
        )
      : null;
  const leadInstitution = rankings.institutions[0] ?? null;

  return [
    {
      label: activeCountyId ? "Selected county" : "Most efficient county",
      value: (selectedCounty ?? leadCounty)?.countyName ?? "No data",
      meta:
        selectedCounty ?? leadCounty
          ? `${formatDecimal((selectedCounty ?? leadCounty).papersPerMnok)} papers per MNOK`
          : "No efficiency value"
    },
    {
      label: "Peak efficiency year",
      value: peakYear ? String(peakYear.year) : "No data",
      meta: peakYear ? `${formatDecimal(peakYear.papersPerMnok)} papers per MNOK` : "No annual series"
    },
    {
      label: "Top institution",
      value: leadInstitution?.label ?? "No data",
      meta: leadInstitution
        ? `${formatDecimal(leadInstitution.papersPerMnok)} papers per MNOK`
        : "No institution ranking"
    }
  ];
}

export default function App() {
  const [mode, setMode] = useState(MODE_FUNDING);
  const [fundingData, setFundingData] = useState(null);
  const [impactData, setImpactData] = useState(null);
  const [efficiencyData, setEfficiencyData] = useState(null);
  const [fundingInstitutionCubeStatus, setFundingInstitutionCubeStatus] = useState("idle");
  const [impactInstitutionCubeStatus, setImpactInstitutionCubeStatus] = useState("idle");
  const [efficiencyInstitutionCubeStatus, setEfficiencyInstitutionCubeStatus] = useState("idle");
  const [fundingStatus, setFundingStatus] = useState({ type: "loading", message: "" });
  const [impactStatus, setImpactStatus] = useState({ type: "idle", message: "" });
  const [efficiencyStatus, setEfficiencyStatus] = useState({ type: "idle", message: "" });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const modeFilters = normalizeFiltersForMode(filters, mode);
  const deferredFilters = useDeferredValue(modeFilters);

  useEffect(() => {
    let isMounted = true;

    async function loadFundingData() {
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

        setFundingData({
          byCounty,
          byDimension,
          countyGeojson,
          cube,
          institutionCube: null,
          summary,
          timeseries
        });
        setFundingInstitutionCubeStatus("idle");
        setFundingStatus({ type: "ready", message: "" });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFundingStatus({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "The dashboard data could not be loaded."
        });
      }
    }

    loadFundingData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      !fundingData ||
      fundingData.institutionCube ||
      fundingInstitutionCubeStatus === "loading" ||
      fundingInstitutionCubeStatus === "ready"
    ) {
      return;
    }

    async function loadFundingInstitutionCube() {
      try {
        setFundingInstitutionCubeStatus("loading");
        const response = await fetch(buildDataUrl("data/funding_institution_cube.json"));

        if (!response.ok) {
          throw new Error(`Static asset load failed with ${response.status}.`);
        }

        const institutionCube = await response.json();

        setFundingData((current) =>
          current ? { ...current, institutionCube } : current
        );
        setFundingInstitutionCubeStatus("ready");
      } catch (error) {
        setFundingInstitutionCubeStatus("error");
        console.error("Institution ranking data could not be loaded.", error);
      }
    }

    void loadFundingInstitutionCube();
  }, [fundingData, fundingInstitutionCubeStatus]);

  useEffect(() => {
    if (mode !== MODE_IMPACT || impactData || impactStatus.type === "loading") {
      return;
    }

    async function loadImpactData() {
      try {
        setImpactStatus({ type: "loading", message: "" });
        const responses = await Promise.all([
          fetch(buildDataUrl("data/impact/summary.json")),
          fetch(buildDataUrl("data/impact/by_county.json")),
          fetch(buildDataUrl("data/impact/timeseries.json")),
          fetch(buildDataUrl("data/impact/by_institution.json"))
        ]);

        for (const response of responses) {
          if (!response.ok) {
            throw new Error(`Impact asset load failed with ${response.status}.`);
          }
        }

        const [summary, byCounty, timeseries, byInstitution] =
          await Promise.all(responses.map((response) => response.json()));

        setImpactData({
          byCounty,
          byInstitution,
          institutionCube: null,
          summary,
          timeseries
        });
        setImpactInstitutionCubeStatus("idle");
        setImpactStatus({ type: "ready", message: "" });
      } catch (error) {
        setImpactStatus({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "The impact dataset could not be loaded."
        });
      }
    }

    void loadImpactData();
  }, [impactData, impactStatus.type, mode]);

  useEffect(() => {
    if (
      mode !== MODE_IMPACT ||
      !impactData ||
      impactData.institutionCube ||
      impactInstitutionCubeStatus === "loading" ||
      impactInstitutionCubeStatus === "ready"
    ) {
      return;
    }

    async function loadImpactInstitutionCube() {
      try {
        setImpactInstitutionCubeStatus("loading");
        const response = await fetch(buildDataUrl("data/impact/institution_cube.json"));

        if (!response.ok) {
          throw new Error(`Impact asset load failed with ${response.status}.`);
        }

        const institutionCube = await response.json();

        setImpactData((current) =>
          current ? { ...current, institutionCube } : current
        );
        setImpactInstitutionCubeStatus("ready");
      } catch (error) {
        setImpactInstitutionCubeStatus("error");
        console.error("Impact institution cube could not be loaded.", error);
      }
    }

    void loadImpactInstitutionCube();
  }, [impactData, impactInstitutionCubeStatus, mode]);

  useEffect(() => {
    if (
      mode !== MODE_EFFICIENCY ||
      efficiencyData ||
      efficiencyStatus.type === "loading"
    ) {
      return;
    }

    async function loadEfficiencyData() {
      try {
        setEfficiencyStatus({ type: "loading", message: "" });
        const responses = await Promise.all([
          fetch(buildDataUrl("data/efficiency/summary.json")),
          fetch(buildDataUrl("data/efficiency/by_county.json")),
          fetch(buildDataUrl("data/efficiency/timeseries.json")),
          fetch(buildDataUrl("data/efficiency/by_institution.json"))
        ]);

        for (const response of responses) {
          if (!response.ok) {
            throw new Error(`Efficiency asset load failed with ${response.status}.`);
          }
        }

        const [summary, byCounty, timeseries, byInstitution] = await Promise.all(
          responses.map((response) => response.json())
        );

        setEfficiencyData({
          byCounty,
          byInstitution,
          institutionCube: null,
          summary,
          timeseries
        });
        setEfficiencyInstitutionCubeStatus("idle");
        setEfficiencyStatus({ type: "ready", message: "" });
      } catch (error) {
        setEfficiencyStatus({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "The efficiency dataset could not be loaded."
        });
      }
    }

    void loadEfficiencyData();
  }, [efficiencyData, efficiencyStatus.type, mode]);

  useEffect(() => {
    if (
      mode !== MODE_EFFICIENCY ||
      !efficiencyData ||
      efficiencyData.institutionCube ||
      efficiencyInstitutionCubeStatus === "loading" ||
      efficiencyInstitutionCubeStatus === "ready"
    ) {
      return;
    }

    async function loadEfficiencyInstitutionCube() {
      try {
        setEfficiencyInstitutionCubeStatus("loading");
        const response = await fetch(buildDataUrl("data/efficiency/institution_cube.json"));

        if (!response.ok) {
          throw new Error(`Efficiency asset load failed with ${response.status}.`);
        }

        const institutionCube = await response.json();

        setEfficiencyData((current) =>
          current ? { ...current, institutionCube } : current
        );
        setEfficiencyInstitutionCubeStatus("ready");
      } catch (error) {
        setEfficiencyInstitutionCubeStatus("error");
        console.error("Efficiency institution cube could not be loaded.", error);
      }
    }

    void loadEfficiencyInstitutionCube();
  }, [efficiencyData, efficiencyInstitutionCubeStatus, mode]);

  const currentData =
    mode === MODE_FUNDING
      ? fundingData
      : mode === MODE_IMPACT
        ? impactData
        : efficiencyData;
  const activeStatus =
    mode === MODE_FUNDING
      ? fundingStatus
      : mode === MODE_IMPACT
        ? impactStatus
        : efficiencyStatus;
  const availableFilters = currentData?.summary.filters ?? {
    counties: [],
    schemes: [],
    subjects: [],
    years: []
  };
  const usingDefaultFilters = isDefaultFilter(deferredFilters);
  const impactDetailReady =
    usingDefaultFilters ||
    !impactData ||
    !!impactData.institutionCube ||
    impactInstitutionCubeStatus === "ready";
  const efficiencyDetailReady =
    usingDefaultFilters ||
    !efficiencyData ||
    !!efficiencyData.institutionCube ||
    efficiencyInstitutionCubeStatus === "ready";

  const fundingFilteredCube = fundingData
    ? filterCubeRecords(fundingData.cube, deferredFilters)
    : [];
  const fundingYearAgnosticFilters = { ...deferredFilters, year: ALL_FILTER_VALUE };
  const fundingYearAgnosticCube = fundingData
    ? filterCubeRecords(fundingData.cube, fundingYearAgnosticFilters)
    : [];
  const fundingDefaultRankings = fundingData
    ? buildDimensionRankingsFromAggregate(fundingData.byDimension)
    : { institutions: [], schemes: [], subjects: [] };
  const fundingDimensionRankings = fundingData
    ? usingDefaultFilters
      ? fundingDefaultRankings
      : buildDimensionRankings(fundingFilteredCube, fundingData.summary.filters)
    : { institutions: [], schemes: [], subjects: [] };
  const fundingInstitutionRankings = fundingData
    ? usingDefaultFilters
      ? fundingData.institutionCube
        ? buildInstitutionRankings(fundingData.institutionCube)
        : fundingDefaultRankings.institutions
      : fundingData.institutionCube
        ? buildInstitutionRankings(
            filterCubeRecords(fundingData.institutionCube, deferredFilters)
          )
        : []
    : [];
  const fundingRankings = {
    ...fundingDimensionRankings,
    institutions: fundingInstitutionRankings
  };
  const fundingCountySeries = fundingData
    ? usingDefaultFilters
      ? buildCountySeriesFromAggregate(
          fundingData.byCounty,
          fundingData.summary.filters.counties
        )
      : buildCountySeries(fundingFilteredCube, fundingData.summary.filters.counties)
    : [];
  const fundingTimeseries = fundingData
    ? usingDefaultFilters
      ? fundingData.timeseries
      : buildTimeseries(fundingFilteredCube, fundingData.summary.filters.years)
    : [];
  const fundingYearAgnosticTimeseries = fundingData
    ? isDefaultFilter(fundingYearAgnosticFilters)
      ? fundingData.timeseries
      : buildTimeseries(
          fundingYearAgnosticCube,
          fundingData.summary.filters.years
        )
    : [];
  const fundingKpis = fundingData
    ? usingDefaultFilters
      ? buildFundingKpisFromSummary(fundingData.summary)
      : buildKpis(fundingFilteredCube)
    : [];

  const impactFilteredCube = impactData
    ? filterCubeRecords(impactData.institutionCube ?? [], deferredFilters)
    : [];
  const impactYearAgnosticFilters = { ...deferredFilters, year: ALL_FILTER_VALUE };
  const impactYearAgnosticCube = impactData
    ? filterCubeRecords(impactData.institutionCube ?? [], impactYearAgnosticFilters)
    : [];
  const impactCountySeries = impactData
    ? usingDefaultFilters
      ? buildImpactCountySeriesFromAggregate(
          impactData.byCounty,
          impactData.summary.filters.counties
        )
      : impactDetailReady
        ? buildImpactCountySeries(impactFilteredCube, impactData.summary.filters.counties)
        : buildImpactCountySeriesFromAggregate(
            impactData.byCounty,
            impactData.summary.filters.counties
          )
    : [];
  const impactTimeseries = impactData
    ? usingDefaultFilters
      ? impactData.timeseries
      : impactDetailReady
        ? buildImpactTimeseries(impactFilteredCube, impactData.summary.filters.years)
        : impactData.timeseries
    : [];
  const impactYearAgnosticTimeseries = impactData
    ? isDefaultFilter(impactYearAgnosticFilters)
      ? impactData.timeseries
      : buildImpactTimeseries(
          impactYearAgnosticCube,
          impactData.summary.filters.years
        )
    : [];
  const impactInstitutionRankings = impactData
    ? usingDefaultFilters
      ? buildImpactInstitutionRankingsFromAggregate(impactData.byInstitution)
      : impactDetailReady
        ? buildImpactInstitutionRankings(impactFilteredCube)
        : buildImpactInstitutionRankingsFromAggregate(impactData.byInstitution)
    : [];
  const impactKpis = impactData
    ? usingDefaultFilters
      ? buildImpactKpisFromSummary(impactData.summary)
      : impactDetailReady
        ? buildImpactKpis(impactFilteredCube)
        : buildImpactKpisFromSummary(impactData.summary)
    : [];

  const efficiencyFilteredCube = efficiencyData
    ? filterCubeRecords(efficiencyData.institutionCube ?? [], deferredFilters)
    : [];
  const efficiencyYearAgnosticFilters = { ...deferredFilters, year: ALL_FILTER_VALUE };
  const efficiencyYearAgnosticCube = efficiencyData
    ? filterCubeRecords(efficiencyData.institutionCube ?? [], efficiencyYearAgnosticFilters)
    : [];
  const efficiencyCountySeries = efficiencyData
    ? usingDefaultFilters
      ? buildEfficiencyCountySeriesFromAggregate(
          efficiencyData.byCounty,
          efficiencyData.summary.filters.counties
        )
      : efficiencyDetailReady
        ? buildEfficiencyCountySeries(
            efficiencyFilteredCube,
            efficiencyData.summary.filters.counties
          )
        : buildEfficiencyCountySeriesFromAggregate(
            efficiencyData.byCounty,
            efficiencyData.summary.filters.counties
          )
    : [];
  const efficiencyTimeseries = efficiencyData
    ? usingDefaultFilters
      ? efficiencyData.timeseries
      : efficiencyDetailReady
        ? buildEfficiencyTimeseries(
            efficiencyFilteredCube,
            efficiencyData.summary.filters.years
          )
        : efficiencyData.timeseries
    : [];
  const efficiencyYearAgnosticTimeseries = efficiencyData
    ? isDefaultFilter(efficiencyYearAgnosticFilters)
      ? efficiencyData.timeseries
      : buildEfficiencyTimeseries(
          efficiencyYearAgnosticCube,
          efficiencyData.summary.filters.years
        )
    : [];
  const efficiencyInstitutionRankings = efficiencyData
    ? usingDefaultFilters
      ? buildEfficiencyInstitutionRankingsFromAggregate(
          efficiencyData.byInstitution,
          efficiencyData.summary.minFundingNokForRanking,
          efficiencyData.summary.minPaperCountForRanking
        )
      : efficiencyDetailReady
        ? buildEfficiencyInstitutionRankings(
            efficiencyFilteredCube,
            efficiencyData.summary.minFundingNokForRanking,
            efficiencyData.summary.minPaperCountForRanking
          )
        : buildEfficiencyInstitutionRankingsFromAggregate(
            efficiencyData.byInstitution,
            efficiencyData.summary.minFundingNokForRanking,
            efficiencyData.summary.minPaperCountForRanking
          )
    : [];
  const efficiencyKpis = efficiencyData
    ? usingDefaultFilters
      ? buildEfficiencyKpisFromSummary(efficiencyData.summary)
      : efficiencyDetailReady
        ? buildEfficiencyKpis(
            efficiencyFilteredCube,
            efficiencyData.summary.minFundingNokForRanking,
            efficiencyData.summary.minPaperCountForRanking
          )
        : buildEfficiencyKpisFromSummary(efficiencyData.summary)
    : [];

  const activeCountyId =
    deferredFilters.countyId === ALL_FILTER_VALUE
      ? null
      : deferredFilters.countyId;

  const countySeries =
    mode === MODE_FUNDING
      ? fundingCountySeries
      : mode === MODE_IMPACT
        ? impactCountySeries
        : efficiencyCountySeries;
  const timeseries =
    mode === MODE_FUNDING
      ? fundingTimeseries
      : mode === MODE_IMPACT
        ? impactTimeseries
        : efficiencyTimeseries;
  const contextualMax =
    mode === MODE_FUNDING
      ? Math.max(
          ...fundingYearAgnosticTimeseries.map((item) => item.totalFundingNok),
          1
        )
      : mode === MODE_IMPACT
        ? Math.max(...impactYearAgnosticTimeseries.map((item) => item.paperCount), 1)
        : Math.max(...efficiencyYearAgnosticTimeseries.map((item) => item.papersPerMnok), 1);
  const kpis =
    mode === MODE_FUNDING
      ? fundingKpis
      : mode === MODE_IMPACT
        ? impactKpis
        : efficiencyKpis;
  const selectedCounty =
    (activeCountyId
      ? countySeries.find((item) => item.countyId === activeCountyId)
      : null) ?? null;
  const highlights =
    mode === MODE_FUNDING
      ? buildFundingHighlights({
          activeCountyId,
          countySeries: fundingCountySeries,
          institutionCubeStatus:
            !usingDefaultFilters && fundingInstitutionCubeStatus === "loading"
              ? "loading"
              : "ready",
          rankings: fundingRankings,
          selectedCounty,
          timeseries: fundingTimeseries
        })
      : mode === MODE_IMPACT
        ? buildImpactHighlights({
            activeCountyId,
            countySeries: impactCountySeries,
            rankings: { institutions: impactInstitutionRankings },
            selectedCounty,
            timeseries: impactTimeseries
          })
        : buildEfficiencyHighlights({
            activeCountyId,
            countySeries: efficiencyCountySeries,
            rankings: { institutions: efficiencyInstitutionRankings },
            selectedCounty,
            timeseries: efficiencyTimeseries
          });

  const topImpactCountiesByPapers = buildTopMetricRanking(impactCountySeries, "paperCount");
  const topImpactCountiesByCitations = buildTopMetricRanking(
    impactCountySeries,
    "citationCount"
  );

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

  function switchMode(nextMode) {
    startTransition(() => {
      setMode(nextMode);
    });
  }

  const currentRecords =
    mode === MODE_FUNDING
      ? fundingFilteredCube
      : mode === MODE_IMPACT
        ? impactFilteredCube
        : efficiencyFilteredCube;
  const detailSlicePending =
    activeStatus.type === "ready" &&
    !usingDefaultFilters &&
    ((mode === MODE_IMPACT &&
      !impactDetailReady &&
      impactInstitutionCubeStatus !== "error") ||
      (mode === MODE_EFFICIENCY &&
        !efficiencyDetailReady &&
        efficiencyInstitutionCubeStatus !== "error"));
  const showNoMatch =
    activeStatus.type === "ready" &&
    !detailSlicePending &&
    !usingDefaultFilters &&
    currentRecords.length === 0;

  const modeCopy = {
    [MODE_FUNDING]: {
      leadPanelCopy: "Click a county to filter the trend and ranking views.",
      leadPanelTitle: "Funding by region",
      pies: [
        {
          emptyLabel: "No scheme allocation visible",
          items: fundingRankings.schemes,
          title: "Funding Schemes",
          valueKey: "totalFundingNok",
          valueVariant: "currency"
        },
        {
          emptyLabel: "No subject allocation visible",
          items: fundingRankings.subjects,
          title: "Subject Fields",
          valueKey: "totalFundingNok",
          valueVariant: "currency"
        }
      ],
      ranking: {
        emptyLabel: "No institution funding is available for the current filter combination.",
        items: fundingRankings.institutions,
        metaRenderer: (item) => `${formatNumber(item.projectCount)} projects in the selected slice`,
        subtitles: {
          top: "Highest-funded project owners in the current funding slice.",
          bottom: "Lowest-funded project owners in the current funding slice.",
          all: "All project owners ranked by funding in the current slice."
        },
        titles: {
          top: "Top Institutions",
          bottom: "Bottom Institutions",
          all: "All Institutions"
        },
        valueKey: "totalFundingNok",
        valueVariant: "currency"
      },
      seriesCopy: "The curve tracks allocated NOK across the selected slice.",
      seriesTitle: "Annual funding movement",
      sourceLabel: fundingData?.summary?.source?.label ?? "Forskningsrådet open data"
    },
    [MODE_IMPACT]: {
      leadPanelCopy: "Click a county to focus publication output and citation activity.",
      leadPanelTitle: "Publication activity by county",
      pies: [
        {
          emptyLabel: "No publication activity visible",
          items: topImpactCountiesByPapers,
          title: "Top Counties by Papers",
          valueKey: "paperCount",
          valueVariant: "number"
        },
        {
          emptyLabel: "No citation activity visible",
          items: topImpactCountiesByCitations,
          title: "Top Counties by Citations",
          valueKey: "citationCount",
          valueVariant: "number"
        }
      ],
      ranking: {
        emptyLabel: "No institution impact values are available for the current filter combination.",
        items: impactInstitutionRankings,
        metaRenderer: (item) =>
          `${formatNumber(item.citationCount)} citations · ${formatDecimal(item.citationsPerPaper)} cites/paper`,
        subtitles: {
          top: "Most active institutions in the selected publication slice.",
          bottom: "Least active institutions in the selected publication slice.",
          all: "All institutions ranked by publication activity in the selected slice."
        },
        titles: {
          top: "Top Institutions",
          bottom: "Bottom Institutions",
          all: "All Institutions"
        },
        valueKey: "paperCount",
        valueVariant: "number"
      },
      seriesCopy: "The curve tracks papers published across the selected slice.",
      seriesTitle: "Annual publication activity",
      sourceLabel: impactData?.summary?.source?.label ?? "OpenAlex institutions API"
    },
    [MODE_EFFICIENCY]: {
      leadPanelCopy:
        `Efficiency is published papers per MNOK of NFR funding over the overlapping ${
          efficiencyData?.summary?.overlapYearStart ?? "2010"
        }-${efficiencyData?.summary?.latestYear ?? "2026"} window.`,
      leadPanelTitle: "Research efficiency by county",
      pies: [
        {
          emptyLabel: "No county efficiency visible",
          items: buildTopMetricRanking(efficiencyCountySeries, "papersPerMnok"),
          title: "Top Counties by Papers/MNOK",
          valueKey: "papersPerMnok",
          valueVariant: "decimal"
        },
        {
          emptyLabel: "No matched funding visible",
          items: buildTopMetricRanking(efficiencyCountySeries, "fundingNok"),
          title: "Counties with Largest Matched Funding",
          valueKey: "fundingNok",
          valueVariant: "currency"
        }
      ],
      ranking: {
        emptyLabel:
          "No institution efficiency values are available for the current filter combination.",
        items: efficiencyInstitutionRankings,
        metaRenderer: (item) =>
          `${formatNumber(item.paperCount)} papers · ${formatCompactCurrency(
            item.fundingNok
          )} matched funding`,
        subtitles: {
          top: `Institutions ranked by published papers per MNOK received. Rankings require at least ${
            efficiencyData?.summary?.minPaperCountForRanking ?? 10
          } papers and ${formatCompactCurrency(
            efficiencyData?.summary?.minFundingNokForRanking ?? 10_000_000
          )} in matched funding.`,
          bottom: `Institutions at the bottom of the papers-per-MNOK ranking. Rankings still require at least ${
            efficiencyData?.summary?.minPaperCountForRanking ?? 10
          } papers and ${formatCompactCurrency(
            efficiencyData?.summary?.minFundingNokForRanking ?? 10_000_000
          )} in matched funding.`,
          all: `All ranking-eligible institutions sorted by papers per MNOK. Rankings require at least ${
            efficiencyData?.summary?.minPaperCountForRanking ?? 10
          } papers and ${formatCompactCurrency(
            efficiencyData?.summary?.minFundingNokForRanking ?? 10_000_000
          )} in matched funding.`
        },
        titles: {
          top: "Most Efficient Institutions",
          bottom: "Least Efficient Institutions",
          all: "All Institutions by Efficiency"
        },
        valueKey: "papersPerMnok",
        valueVariant: "decimal"
      },
      seriesCopy: "The curve tracks published papers per MNOK across the selected slice.",
      seriesTitle: "Annual efficiency",
      sourceLabel:
        efficiencyData?.summary?.source?.label ?? "Joined funding + OpenAlex efficiency dataset"
    }
  }[mode];

  return (
    <main className="app-shell sidebar-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div>
            <h1>NFR Funding</h1>
            <p>Norwegian research statistics</p>
          </div>
          <button
            className="mobile-filter-toggle"
            onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
          >
            {isMobileFilterOpen ? "Hide Filters" : "Show Filters"}
          </button>
        </div>

        <div className={`sidebar-collapsible ${isMobileFilterOpen ? "is-open" : ""}`}>
          <div className="mode-toggle" role="tablist" aria-label="Dashboard mode">
            <button
              className={`mode-toggle-button${mode === MODE_FUNDING ? " is-active" : ""}`}
              onClick={() => switchMode(MODE_FUNDING)}
              type="button"
            >
              Funding
            </button>
          <button
            className={`mode-toggle-button${mode === MODE_IMPACT ? " is-active" : ""}`}
            onClick={() => switchMode(MODE_IMPACT)}
            type="button"
          >
            Impact
          </button>
          <button
            className={`mode-toggle-button${mode === MODE_EFFICIENCY ? " is-active" : ""}`}
            onClick={() => switchMode(MODE_EFFICIENCY)}
            type="button"
          >
            Efficiency
          </button>
        </div>

          <FilterBar
            activeFilters={deferredFilters}
            availableFilters={availableFilters}
            filterConfig={FILTER_CONFIGS[mode]}
            onFilterChange={updateFilter}
            onReset={resetFilters}
          />
          <div className="sidebar-footer">
            <p>{modeCopy.sourceLabel}</p>
            <p>Latest year: {currentData?.summary?.latestYear ?? "..."}</p>
          </div>
        </div>
      </aside>

      <section className="workspace-main">
        {activeStatus.type === "error" ? (
          <section className="status-panel is-error">
            <h2>Data Load Failed</h2>
            <p>{activeStatus.message}</p>
          </section>
        ) : null}

        {activeStatus.type === "loading" || activeStatus.type === "idle" ? (
              <section className="status-panel">
                <h2>Loading Dashboard Assets...</h2>
                <p>
                  {mode === MODE_FUNDING
                    ? "Fetching funding JSON bundles and county geometry"
                    : mode === MODE_IMPACT
                      ? "Fetching OpenAlex impact bundles"
                      : "Fetching joined efficiency bundles"}
                </p>
              </section>
        ) : null}

        {activeStatus.type === "ready" && detailSlicePending ? (
          <section className="status-panel">
            <h2>Applying Filters</h2>
            <p>
              Fetching institution-level records for the selected filters. The
              page stays visible using the overview bundle until the detailed{" "}
              {mode === MODE_EFFICIENCY ? "efficiency" : "impact"} slice is ready.
            </p>
          </section>
        ) : null}

        {activeStatus.type === "ready" ? (
          <>
            <section className="top-visuals layout-split">
              <div className="map-panel map-tall">
                <div className="panel-heading">
                  <h2>{modeCopy.leadPanelTitle}</h2>
                  <p className="panel-copy">{modeCopy.leadPanelCopy}</p>
                </div>
                <div className="map-stage map-enlarged">
                  <CountyMap
                    activeCountyId={activeCountyId}
                    ariaLabel={
                      mode === MODE_FUNDING
                        ? "County-level choropleth of Norwegian funding allocations"
                        : mode === MODE_IMPACT
                          ? "County-level choropleth of Norwegian publication activity"
                          : "County-level choropleth of Norwegian research efficiency"
                    }
                    countKey={
                      mode === MODE_FUNDING
                        ? "projectCount"
                        : mode === MODE_IMPACT
                          ? "citationCount"
                          : "paperCount"
                    }
                    countLabel={
                      mode === MODE_FUNDING
                        ? "projects"
                        : mode === MODE_IMPACT
                          ? "citations"
                          : "papers"
                    }
                    data={countySeries}
                    geojson={fundingData?.countyGeojson}
                    onSelectCounty={selectCounty}
                    secondaryKey={mode === MODE_EFFICIENCY ? "fundingNok" : null}
                    secondaryLabel={mode === MODE_EFFICIENCY ? "NOK funding" : ""}
                    secondaryVariant={mode === MODE_EFFICIENCY ? "currency" : "number"}
                    valueKey={
                      mode === MODE_FUNDING
                        ? "totalFundingNok"
                        : mode === MODE_IMPACT
                          ? "paperCount"
                          : "papersPerMnok"
                    }
                    valueVariant={
                      mode === MODE_FUNDING
                        ? "currency"
                        : mode === MODE_IMPACT
                          ? "number"
                          : "decimal"
                    }
                  />
                </div>
              </div>

              <div
                className="right-panels"
                style={{ display: "flex", flexDirection: "column", gap: "24px" }}
              >
                <div className="chart-panel">
                  <div className="panel-heading">
                    <h2>{modeCopy.seriesTitle}</h2>
                    <p className="panel-copy">{modeCopy.seriesCopy}</p>
                  </div>
                  <TimeSeriesChart
                    ariaLabel={
                      mode === MODE_FUNDING
                        ? "Funding by year"
                        : mode === MODE_IMPACT
                          ? "Publication activity by year"
                          : "Efficiency by year"
                    }
                    countKey={
                      mode === MODE_FUNDING
                        ? "projectCount"
                        : mode === MODE_IMPACT
                          ? "citationCount"
                          : "paperCount"
                    }
                    countLabel={
                      mode === MODE_FUNDING
                        ? "projects"
                        : mode === MODE_IMPACT
                          ? "citations"
                          : "papers"
                    }
                    data={timeseries}
                    globalMax={contextualMax}
                    secondaryKey={mode === MODE_EFFICIENCY ? "fundingNok" : null}
                    secondaryLabel={mode === MODE_EFFICIENCY ? "NOK funding" : ""}
                    secondaryVariant={mode === MODE_EFFICIENCY ? "currency" : "number"}
                    valueKey={
                      mode === MODE_FUNDING
                        ? "totalFundingNok"
                        : mode === MODE_IMPACT
                          ? "paperCount"
                          : "papersPerMnok"
                    }
                    valueVariant={
                      mode === MODE_FUNDING
                        ? "currency"
                        : mode === MODE_IMPACT
                          ? "number"
                          : "decimal"
                    }
                  />
                </div>

                <div
                  className="pie-panels"
                  style={{ display: "grid", gap: "24px" }}
                >
                  {modeCopy.pies.map((pie) => (
                    <div className="ranking-panel" key={pie.title}>
                      <div className="panel-heading" style={{ marginBottom: "8px" }}>
                        <h3>{pie.title}</h3>
                      </div>
                      <Suspense fallback={<div className="empty-panel">Loading chart…</div>}>
                        <AllocationPieChart
                          emptyLabel={pie.emptyLabel}
                          items={pie.items}
                          valueKey={pie.valueKey}
                          valueVariant={pie.valueVariant}
                        />
                      </Suspense>
                    </div>
                  ))}
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

            {showNoMatch ? (
              <section className="status-panel">
                <h2>No Matching Records</h2>
                <p>Try adjusting or resetting your filters.</p>
              </section>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="panel-heading">
                <h2>
                  {mode === MODE_FUNDING
                    ? "Allocation Breakdowns"
                    : mode === MODE_IMPACT
                      ? "Impact Breakdowns"
                      : "Efficiency Rankings"}
                </h2>
              </div>

              <section className="ranking-grid single-row">
                {(mode === MODE_FUNDING &&
                  !usingDefaultFilters &&
                  fundingInstitutionCubeStatus === "loading") ? (
                  <section className="ranking-panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">Ranked allocation</p>
                        <h2>{modeCopy.ranking.titles?.top ?? modeCopy.ranking.title}</h2>
                      </div>
                    </div>
                    <div className="empty-panel">
                      Loading institution ranking for the selected slice.
                    </div>
                  </section>
                ) : (
                  <RankingBars
                    emptyLabel={modeCopy.ranking.emptyLabel}
                    items={modeCopy.ranking.items}
                    metaRenderer={modeCopy.ranking.metaRenderer}
                    subtitles={modeCopy.ranking.subtitles}
                    titles={modeCopy.ranking.titles}
                    valueKey={modeCopy.ranking.valueKey}
                    valueVariant={modeCopy.ranking.valueVariant}
                  />
                )}
              </section>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
