import { STATUS_META } from "../services/parkingService";

export default function Legend({ summary }) {
  return (
    <div className="legend" aria-label="Map legend">
      {Object.entries(STATUS_META).map(([key, meta]) => (
        <div className="legend-item" key={key}>
          <span className="legend-dot" style={{ backgroundColor: meta.color }} />
          <span>{meta.label}</span>
          <strong>{summary[key]}</strong>
        </div>
      ))}
      <div className="legend-item">
        <span className="zone-swatch blue" />
        <span>Blue Zone</span>
      </div>
      <div className="legend-item">
        <span className="zone-swatch restricted" />
        <span>Restricted</span>
      </div>
    </div>
  );
}
