import { ALL_FILTER_VALUE } from "../lib/dashboard";

const FILTER_CONFIG = [
  { key: "year", label: "Year", optionsKey: "years" },
  { key: "countyId", label: "County", optionsKey: "counties" },
  { key: "institutionId", label: "Institution", optionsKey: "institutions" },
  { key: "schemeId", label: "Funding scheme", optionsKey: "schemes" },
  { key: "subjectId", label: "Subject field", optionsKey: "subjects" }
];

function renderOptions(options, key) {
  if (key === "year") {
    return options.map((year) => (
      <option key={year} value={String(year)}>
        {year}
      </option>
    ));
  }

  return options.map((option) => (
    <option key={option.id} value={option.id}>
      {option.label}
    </option>
  ));
}

export default function FilterBar({
  activeFilters,
  availableFilters,
  onFilterChange,
  onReset
}) {
  return (
    <section className="filter-bar" aria-label="Dashboard filters">
      {FILTER_CONFIG.map(({ key, label, optionsKey }) => (
        <label className="filter-field" key={key}>
          <span>{label}</span>
          <select
            name={key}
            onChange={(event) => onFilterChange(key, event.target.value)}
            value={activeFilters[key]}
          >
            <option value={ALL_FILTER_VALUE}>All</option>
            {renderOptions(availableFilters[optionsKey], key)}
          </select>
        </label>
      ))}
      <button className="ghost-button" onClick={onReset} type="button">
        Reset filters
      </button>
    </section>
  );
}
