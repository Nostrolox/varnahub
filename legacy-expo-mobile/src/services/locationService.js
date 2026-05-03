import * as Location from "expo-location";
import { getCityConfig } from "./parkingService";

export function getFallbackLocation() {
  const { center } = getCityConfig();
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    isFallback: true
  };
}

export async function requestUserLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    return getFallbackLocation();
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    isFallback: false
  };
}

export async function watchUserLocation(onLocation) {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") return null;

  // GPS tracking is intentionally foreground-only for this app.
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 25,
      timeInterval: 8000
    },
    (location) => {
      onLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        isFallback: false
      });
    }
  );
}
