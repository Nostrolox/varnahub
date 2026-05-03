const filters = [
  { key: "free", label: "Free", color: "#16a34a" },
  { key: "paid", label: "Paid", color: "#2563eb" },
  { key: "restricted", label: "Restricted", color: "#dc2626" }
];

export default function FilterBar({ value, onChange }) {
  return (
    <div className="filter-bar" aria-label="Parking filters">
      {filters.map((filter) => (
        <button
          className={`filter-chip ${value[filter.key] ? "is-active" : ""}`}
          key={filter.key}
          onClick={() => onChange(filter.key)}
          type="button"
        >
          <span className="chip-dot" style={{ backgroundColor: filter.color }} />
          {filter.label}
        </button>
      ))}
    </div>
  );
}
