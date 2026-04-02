export const ALL_FILTER_VALUE = "all";

function buildOptionLabelMap(options) {
  return Object.fromEntries(options.map((option) => [option.id, option.label]));
}

function sumBy(records, selector) {
  let total = 0;

  for (const record of records) {
    total += selector(record);
  }

  return total;
}

export function isDefaultFilter(filters) {
  return Object.values(filters).every((value) => value === ALL_FILTER_VALUE);
}

export function filterCubeRecords(records, filters) {
  return records.filter((record) => {
    if (filters.year !== ALL_FILTER_VALUE && String(record.year) !== filters.year) {
      return false;
    }

    if (
      filters.countyId !== ALL_FILTER_VALUE &&
      record.countyId !== filters.countyId
    ) {
      return false;
    }

    if (
      filters.schemeId !== ALL_FILTER_VALUE &&
      record.schemeId !== filters.schemeId
    ) {
      return false;
    }

    if (
      filters.subjectId !== ALL_FILTER_VALUE &&
      record.subjectId !== filters.subjectId
    ) {
      return false;
    }

    return true;
  });
}

export function buildKpis(records) {
  const totalFundingNok = sumBy(records, (record) => record.totalFundingNok);
  const projectCount = sumBy(records, (record) => record.projectCount);
  const countiesCovered = new Set(records.map((record) => record.countyId)).size;
  const averageGrantNok = projectCount > 0 ? totalFundingNok / projectCount : 0;

  return [
    {
      label: "Allocated funding",
      value: totalFundingNok,
      variant: "currency"
    },
    {
      label: "Funded projects",
      value: projectCount,
      variant: "number"
    },
    {
      label: "Counties in view",
      value: countiesCovered,
      variant: "number"
    },
    {
      label: "Average grant",
      value: averageGrantNok,
      variant: "currency"
    }
  ];
}

export function buildFundingKpisFromSummary(summary) {
  const totalFundingNok = summary?.totalFundingNok ?? 0;
  const projectCount = summary?.projectCount ?? 0;
  const countiesCovered = summary?.filters?.counties?.length ?? 0;
  const averageGrantNok = projectCount > 0 ? totalFundingNok / projectCount : 0;

  return [
    {
      label: "Allocated funding",
      value: totalFundingNok,
      variant: "currency"
    },
    {
      label: "Funded projects",
      value: projectCount,
      variant: "number"
    },
    {
      label: "Counties in view",
      value: countiesCovered,
      variant: "number"
    },
    {
      label: "Average grant",
      value: averageGrantNok,
      variant: "currency"
    }
  ];
}

export function buildCountySeries(records, countyOptions) {
  const countyLabelMap = buildOptionLabelMap(countyOptions);
  const countyMap = new Map(
    countyOptions.map((county) => [
      county.id,
      {
        countyId: county.id,
        countyName: county.label,
        projectCount: 0,
        totalFundingNok: 0
      }
    ])
  );

  for (const record of records) {
    const current = countyMap.get(record.countyId) ?? {
      countyId: record.countyId,
      countyName: countyLabelMap[record.countyId] ?? record.countyId,
      projectCount: 0,
      totalFundingNok: 0
    };

    current.projectCount += record.projectCount;
    current.totalFundingNok += record.totalFundingNok;
    countyMap.set(record.countyId, current);
  }

  return [...countyMap.values()].sort(
    (left, right) => right.totalFundingNok - left.totalFundingNok
  );
}

export function buildCountySeriesFromAggregate(aggregates, countyOptions) {
  const merged = buildCountySeries([], countyOptions);
  const mergedMap = new Map(merged.map((item) => [item.countyId, item]));

  for (const item of aggregates) {
    const current = mergedMap.get(item.countyId);

    if (!current) {
      continue;
    }

    current.projectCount = item.projectCount;
    current.totalFundingNok = item.totalFundingNok;
  }

  return [...mergedMap.values()].sort(
    (left, right) => right.totalFundingNok - left.totalFundingNok
  );
}

export function buildTimeseries(records, years) {
  const yearMap = new Map(
    years.map((year) => [
      year,
      {
        year,
        projectCount: 0,
        totalFundingNok: 0
      }
    ])
  );

  for (const record of records) {
    const current = yearMap.get(record.year);

    if (!current) {
      continue;
    }

    current.projectCount += record.projectCount;
    current.totalFundingNok += record.totalFundingNok;
  }

  return [...yearMap.values()].sort((left, right) => left.year - right.year);
}

export function buildDimensionRankings(records, filters) {
  const config = [
    {
      dimension: "schemes",
      filterKey: "schemeId",
      labelMap: buildOptionLabelMap(filters.schemes)
    },
    {
      dimension: "subjects",
      filterKey: "subjectId",
      labelMap: buildOptionLabelMap(filters.subjects)
    }
  ];

  return Object.fromEntries(
    config.map(({ dimension, filterKey, labelMap }) => {
      const buckets = new Map();

      for (const record of records) {
        const bucketId = record[filterKey];
        const current = buckets.get(bucketId) ?? {
          id: bucketId,
          label: labelMap[bucketId] ?? bucketId,
          projectCount: 0,
          totalFundingNok: 0
        };

        current.projectCount += record.projectCount;
        current.totalFundingNok += record.totalFundingNok;
        buckets.set(bucketId, current);
      }

      return [
        dimension,
        [...buckets.values()]
          .sort((left, right) => right.totalFundingNok - left.totalFundingNok)
          .slice(0, 6)
      ];
    })
  );
}

export function buildDimensionRankingsFromAggregate(aggregates) {
  return {
    institutions: [...aggregates.institutions],
    schemes: [...aggregates.schemes],
    subjects: [...aggregates.subjects]
  };
}

export function buildInstitutionRankings(records) {
  const buckets = new Map();

  for (const record of records) {
    const current = buckets.get(record.institutionId) ?? {
      id: record.institutionId,
      label: record.institutionName,
      projectCount: 0,
      totalFundingNok: 0
    };

    current.projectCount += record.projectCount;
    current.totalFundingNok += record.totalFundingNok;
    buckets.set(record.institutionId, current);
  }

  return [...buckets.values()]
    .sort((left, right) => right.totalFundingNok - left.totalFundingNok)
    .slice(0, 6);
}

export function buildImpactKpis(records) {
  const paperCount = sumBy(records, (record) => record.paperCount);
  const citationCount = sumBy(records, (record) => record.citationCount);
  const countiesCovered = new Set(
    records.map((record) => record.countyId).filter(Boolean)
  ).size;
  const citationsPerPaper = paperCount > 0 ? citationCount / paperCount : 0;

  return [
    {
      label: "Published papers",
      value: paperCount,
      variant: "number"
    },
    {
      label: "Citations",
      value: citationCount,
      variant: "number"
    },
    {
      label: "Counties in view",
      value: countiesCovered,
      variant: "number"
    },
    {
      label: "Citations per paper",
      value: citationsPerPaper,
      variant: "decimal"
    }
  ];
}

export function buildImpactKpisFromSummary(summary) {
  const paperCount = summary?.paperCount ?? 0;
  const citationCount = summary?.citationCount ?? 0;
  const countiesCovered = summary?.filters?.counties?.length ?? 0;
  const citationsPerPaper = paperCount > 0 ? citationCount / paperCount : 0;

  return [
    {
      label: "Published papers",
      value: paperCount,
      variant: "number"
    },
    {
      label: "Citations",
      value: citationCount,
      variant: "number"
    },
    {
      label: "Mapped institutions",
      value: summary?.institutionCountMapped ?? 0,
      variant: "number"
    },
    {
      label: "Citations per paper",
      value: citationsPerPaper,
      variant: "decimal"
    }
  ];
}

export function buildImpactCountySeries(records, countyOptions) {
  const countyLabelMap = buildOptionLabelMap(countyOptions);
  const countyMap = new Map(
    countyOptions.map((county) => [
      county.id,
      {
        citationCount: 0,
        citationsPerPaper: 0,
        countyId: county.id,
        countyName: county.label,
        institutionCount: 0,
        paperCount: 0
      }
    ])
  );

  const countyInstitutionSets = new Map(
    countyOptions.map((county) => [county.id, new Set()])
  );

  for (const record of records) {
    const current = countyMap.get(record.countyId) ?? {
      citationCount: 0,
      citationsPerPaper: 0,
      countyId: record.countyId,
      countyName: countyLabelMap[record.countyId] ?? record.countyId,
      institutionCount: 0,
      paperCount: 0
    };

    current.paperCount += record.paperCount ?? 0;
    current.citationCount += record.citationCount ?? 0;
    countyMap.set(record.countyId, current);

    if (record.countyId && record.institutionId) {
      const institutionSet = countyInstitutionSets.get(record.countyId) ?? new Set();
      institutionSet.add(record.institutionId);
      countyInstitutionSets.set(record.countyId, institutionSet);
    }
  }

  return [...countyMap.values()]
    .map((item) => ({
      ...item,
      citationsPerPaper:
        item.paperCount > 0 ? item.citationCount / item.paperCount : 0,
      institutionCount: countyInstitutionSets.get(item.countyId)?.size ?? 0
    }))
    .sort((left, right) => right.paperCount - left.paperCount);
}

export function buildImpactCountySeriesFromAggregate(aggregates, countyOptions) {
  const merged = buildImpactCountySeries([], countyOptions);
  const mergedMap = new Map(merged.map((item) => [item.countyId, item]));

  for (const item of aggregates) {
    const current = mergedMap.get(item.countyId);

    if (!current) {
      continue;
    }

    current.citationCount = item.citationCount;
    current.citationsPerPaper = item.citationsPerPaper;
    current.institutionCount = item.institutionCount;
    current.paperCount = item.paperCount;
  }

  return [...mergedMap.values()].sort((left, right) => right.paperCount - left.paperCount);
}

export function buildImpactTimeseries(records, years) {
  const yearMap = new Map(
    years.map((year) => [
      year,
      {
        citationCount: 0,
        citationsPerPaper: 0,
        paperCount: 0,
        year
      }
    ])
  );

  for (const record of records) {
    const current = yearMap.get(record.year);

    if (!current) {
      continue;
    }

    current.paperCount += record.paperCount ?? 0;
    current.citationCount += record.citationCount ?? 0;
  }

  return [...yearMap.values()]
    .map((item) => ({
      ...item,
      citationsPerPaper:
        item.paperCount > 0 ? item.citationCount / item.paperCount : 0
    }))
    .sort((left, right) => left.year - right.year);
}

export function buildImpactInstitutionRankings(records) {
  const buckets = new Map();

  for (const record of records) {
    const current = buckets.get(record.institutionId) ?? {
      citationCount: 0,
      citationsPerPaper: 0,
      countyId: record.countyId,
      countyName: record.countyName,
      id: record.institutionId,
      label: record.institutionName,
      paperCount: 0
    };

    current.paperCount += record.paperCount ?? 0;
    current.citationCount += record.citationCount ?? 0;
    current.citationsPerPaper =
      current.paperCount > 0 ? current.citationCount / current.paperCount : 0;
    buckets.set(record.institutionId, current);
  }

  return [...buckets.values()]
    .sort((left, right) => right.paperCount - left.paperCount)
    .slice(0, 6);
}

export function buildImpactInstitutionRankingsFromAggregate(aggregates) {
  return [...aggregates]
    .sort((left, right) => right.paperCount - left.paperCount)
    .slice(0, 6);
}

export function buildTopMetricRanking(items, metricKey, topN = 6) {
  return [...items]
    .sort((left, right) => (right[metricKey] ?? 0) - (left[metricKey] ?? 0))
    .slice(0, topN)
    .map((item) => ({
      ...item,
      id: item.id ?? item.countyId,
      label: item.label ?? item.countyName
    }));
}
