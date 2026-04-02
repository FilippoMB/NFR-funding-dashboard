import { ALL_FILTER_VALUE } from "../lib/dashboard";

const FILTER_CONFIG = [
  { key: "countyId", label: "County", optionsKey: "counties" },
  { key: "schemeId", label: "Funding Scheme", optionsKey: "schemes" },
  { key: "subjectId", label: "Subject Field", optionsKey: "subjects" }
];

export default function FilterBar({
  activeFilters,
  availableFilters,
  onFilterChange,
  onReset
}) {
  const years = availableFilters.years || [];
  const isAllYears = activeFilters.year === ALL_FILTER_VALUE;
  
  return (
    <section className="filter-bar sidebar-filters" aria-label="Dashboard filters">
      <div className="filter-group">
        <div className="filter-label-row">
          <span className="filter-label">Year</span>
          <span className="filter-value-display">
            {isAllYears ? "All Years" : activeFilters.year}
          </span>
        </div>
        {years.length > 0 && (
          <div className="year-slider-container">
            <input
              type="range"
              min={0}
              max={years.length}
              step={1}
              value={isAllYears ? 0 : years.indexOf(Number(activeFilters.year)) + 1}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v === 0) onFilterChange("year", ALL_FILTER_VALUE);
                else onFilterChange("year", String(years[v - 1]));
              }}
              className="styled-slider"
            />
            <div className="slider-ticks">
              <span>All</span>
              <span>{years[years.length - 1]}</span>
            </div>
          </div>
        )}
      </div>

      {FILTER_CONFIG.map(({ key, label, optionsKey }) => {
        const options = availableFilters[optionsKey] || [];
        return (
          <div className="filter-group" key={key}>
            <label className="filter-label">{label}</label>
            <div className="select-wrapper">
              <select
                className="styled-select"
                value={activeFilters[key]}
                onChange={(e) => onFilterChange(key, e.target.value)}
              >
                <option value={ALL_FILTER_VALUE}>All</option>
                {options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}

      <button className="base-button reset-button" onClick={onReset} type="button">
        Reset Filters
      </button>
    </section>
  );
}
