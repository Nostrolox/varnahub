const DEFAULT_VARNA_LOCATION = {
  latitude: 43.2141,
  longitude: 27.9147,
  accuracy: 0,
  isFallback: true,
};

const PRECISE_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

function toLocation(position) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Number(position.coords.accuracy ?? Number.POSITIVE_INFINITY),
    timestamp: position.timestamp || Date.now(),
    isFallback: false,
  };
}

async function getNativeGeolocation() {
  const nativeModules = await Promise.all([
    import("@capacitor/core"),
    import("@capacitor/geolocation"),
  ]).catch(() => null);

  if (!nativeModules) return null;

  const [{ Capacitor }, { Geolocation }] = nativeModules;
  return Capacitor.isNativePlatform() ? Geolocation : null;
}

function permissionGranted(status) {
  return status === "granted" || status === "limited";
}

export function defaultVarnaLocation() {
  return { ...DEFAULT_VARNA_LOCATION };
}

export async function requestPreciseLocation() {
  const nativeGeolocation = await getNativeGeolocation();

  if (nativeGeolocation) {
    const permissions = await nativeGeolocation.checkPermissions().catch(() => null);
    if (!permissions || !permissionGranted(permissions.location)) {
      const requested = await nativeGeolocation.requestPermissions({ permissions: ["location"] });
      if (!permissionGranted(requested.location)) {
        throw new Error("Location permission was denied.");
      }
    }

    const position = await nativeGeolocation.getCurrentPosition(PRECISE_OPTIONS);
    return toLocation(position);
  }

  if (!navigator.geolocation) {
    throw new Error("This device does not expose GPS location.");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toLocation(position)),
      reject,
      PRECISE_OPTIONS,
    );
  });
}
