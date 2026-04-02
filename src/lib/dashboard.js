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
      filters.institutionId !== ALL_FILTER_VALUE &&
      record.institutionId !== filters.institutionId
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
      dimension: "institutions",
      filterKey: "institutionId",
      labelMap: buildOptionLabelMap(filters.institutions)
    },
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
