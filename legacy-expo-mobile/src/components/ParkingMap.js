import { StyleSheet, View } from "react-native";
import MapView, { Circle, Polygon, UrlTile } from "react-native-maps";
import { colors } from "../styles/colors";
import SpotMarker from "./SpotMarker";

const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export default function ParkingMap({
  mapRef,
  initialRegion,
  location,
  spots,
  zones,
  restrictedAreas,
  onSpotPress
}) {
  return (
    <MapView
      ref={mapRef}
      initialRegion={initialRegion}
      mapType="none"
      rotateEnabled={false}
      showsCompass={false}
      showsMyLocationButton={false}
      style={styles.map}
    >
      {/* OSM raster tiles keep the app free from Google Maps API keys. */}
      <UrlTile maximumZ={19} tileSize={256} urlTemplate={OSM_TILE_URL} />

      {zones.map((zone) => (
        <Polygon
          key={zone.id}
          coordinates={zone.coordinates}
          fillColor={zone.kind === "restricted" ? colors.restricted : colors.blueZone}
          strokeColor={zone.kind === "restricted" ? colors.restrictedStroke : colors.blueZoneStroke}
          strokeWidth={2}
          tappable
        />
      ))}

      {restrictedAreas.map((area) => (
        <Polygon
          key={area.id}
          coordinates={area.coordinates}
          fillColor={colors.restricted}
          strokeColor={colors.restrictedStroke}
          strokeWidth={2}
        />
      ))}

      {spots.map((spot) => (
        <SpotMarker key={spot.id} spot={spot} onPress={onSpotPress} />
      ))}

      {location ? (
        <Circle
          center={location}
          fillColor="rgba(15, 118, 110, 0.16)"
          radius={location.isFallback ? 300 : Math.max(location.accuracy || 40, 35)}
          strokeColor="rgba(15, 118, 110, 0.65)"
          strokeWidth={2}
        />
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject
  }
});
