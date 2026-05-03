import { formatDistance } from "../utils/geo";

export default function ParkingPanel({ selectedSpot, selectedZone, onPay }) {
  if (!selectedSpot) {
    return (
      <section className="parking-panel empty-panel" aria-label="Parking details">
        <h2>Choose a parking marker</h2>
        <p>Tap a marker on the Varna map to see zone, availability, distance, and payment options.</p>
      </section>
    );
  }

  const canPay = selectedSpot.type === "paid" && selectedSpot.status !== "occupied";

  return (
    <section className="parking-panel" aria-label="Parking details">
      <p className="eyebrow">{selectedSpot.type === "paid" ? "Blue Zone" : selectedSpot.type}</p>
      <h2>{selectedSpot.name}</h2>
      <div className="detail-grid">
        <span>Status</span>
        <strong>{selectedSpot.status}</strong>
        <span>Spaces</span>
        <strong>{selectedSpot.spaces ?? "Unknown"}</strong>
        <span>Distance</span>
        <strong>{formatDistance(selectedSpot.distanceKm)}</strong>
        <span>Zone</span>
        <strong>{selectedZone?.properties.name || "Outside Blue Zone"}</strong>
      </div>
      <button className="primary-button full" disabled={!canPay} onClick={() => onPay(selectedSpot)} type="button">
        Simulate Parking Payment
      </button>
    </section>
  );
}
