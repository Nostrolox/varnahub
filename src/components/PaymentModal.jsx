import { useMemo, useState } from "react";

const durations = [1, 2, 3];

export default function PaymentModal({ spot, zone, onClose }) {
  const [plate, setPlate] = useState("");
  const [hours, setHours] = useState(1);
  const [confirmed, setConfirmed] = useState(false);

  const total = useMemo(() => {
    const hourlyPrice = Number.parseFloat(zone?.properties.priceLabel) || 1;
    return hourlyPrice * hours;
  }, [hours, zone]);

  if (!spot) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="payment-modal">
        {confirmed ? (
          <>
            <div className="success-mark">P</div>
            <h2>Parking Confirmed</h2>
            <p>
              Simulated parking for <strong>{plate.trim().toUpperCase() || "your vehicle"}</strong> at{" "}
              <strong>{spot.name}</strong> is active for {hours} hour{hours > 1 ? "s" : ""}.
            </p>
            <button className="primary-button full" onClick={onClose} type="button">
              Back to Map
            </button>
          </>
        ) : (
          <>
            <p className="eyebrow">Payment simulation</p>
            <h2>{spot.name}</h2>
            <p className="muted">
              {zone?.properties.priceLabel || "1 BGN / hour"} in Varna Blue Zone. No real payment is charged.
            </p>

            <label className="field-label" htmlFor="plate">
              Vehicle plate
            </label>
            <input
              autoFocus
              id="plate"
              onChange={(event) => setPlate(event.target.value)}
              placeholder="B 1234 AB"
              value={plate}
            />

            <span className="field-label">Duration</span>
            <div className="duration-control">
              {durations.map((duration) => (
                <button
                  className={hours === duration ? "is-selected" : ""}
                  key={duration}
                  onClick={() => setHours(duration)}
                  type="button"
                >
                  {duration}h
                </button>
              ))}
            </div>

            <div className="total-row">
              <span>Total</span>
              <strong>{total.toFixed(2)} BGN</strong>
            </div>

            <div className="modal-actions">
              <button className="secondary-button" onClick={onClose} type="button">
                Cancel
              </button>
              <button className="primary-button" disabled={!plate.trim()} onClick={() => setConfirmed(true)} type="button">
                Confirm
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
