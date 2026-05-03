import { useEffect, useMemo } from "react";
import L from "leaflet";
import { GeoJSON, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { STATUS_META } from "../services/parkingService";
import { formatDistance } from "../utils/geo";

function createParkingIcon(status, type) {
  const color = STATUS_META[status]?.color || STATUS_META.unknown.color;
  const label = type === "restricted" ? "!" : "P";

  return L.divIcon({
    className: "parking-marker",
    html: `<span style="border-color:${color}"><b style="background:${color}">${label}</b></span>`,
    iconAnchor: [18, 18],
    iconSize: [36, 36],
    popupAnchor: [0, -18]
  });
}

function MapController({ target }) {
  const map = useMap();

  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], 17, { duration: 0.75 });
    }
  }, [map, target]);

  return null;
}

export default function ParkingMap({ city, spots, zones, selectedSpot, userLocation, onSelectSpot }) {
  const zoneStyle = (feature) => {
    const restricted = feature.properties.kind === "restricted";

    return {
      color: restricted ? "#dc2626" : "#2563eb",
      fillColor: restricted ? "#dc2626" : "#2563eb",
      fillOpacity: restricted ? 0.18 : 0.16,
      weight: 2
    };
  };

  const userIcon = useMemo(
    () =>
      L.divIcon({
        className: "user-marker",
        html: "<span></span>",
        iconAnchor: [10, 10],
        iconSize: [20, 20]
      }),
    []
  );

  return (
    <MapContainer center={city.center} className="map" scrollWheelZoom zoom={city.zoom}>
      {/* Public OSM tiles keep the app free from Google Maps API keys. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON data={zones} key={JSON.stringify(zones.features.map((feature) => feature.properties.id))} style={zoneStyle} />

      {spots.map((spot) => (
        <Marker
          eventHandlers={{ click: () => onSelectSpot(spot) }}
          icon={createParkingIcon(spot.status, spot.type)}
          key={spot.id}
          position={[spot.lat, spot.lng]}
        >
          <Popup>
            <strong>{spot.name}</strong>
            <br />
            {STATUS_META[spot.status]?.label || "Unknown"} | {spot.type}
            <br />
            {formatDistance(spot.distanceKm)}
          </Popup>
        </Marker>
      ))}

      {userLocation ? (
        <Marker icon={userIcon} position={[userLocation.lat, userLocation.lng]}>
          <Popup>{userLocation.isFallback ? "Varna center fallback" : "Your location"}</Popup>
        </Marker>
      ) : null}

      <MapController target={selectedSpot} />
    </MapContainer>
  );
}
