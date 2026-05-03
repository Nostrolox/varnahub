import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, View } from "react-native";
import AppButton from "../components/AppButton";
import FilterBar from "../components/FilterBar";
import Legend from "../components/Legend";
import ParkingMap from "../components/ParkingMap";
import SpotDetailsSheet from "../components/SpotDetailsSheet";
import {
  DEFAULT_FILTERS,
  filterSpots,
  findNearestAvailableSpot,
  getCityConfig,
  getParkingSpots,
  getParkingZones,
  getRestrictedAreas,
  summarizeAvailability
} from "../services/parkingService";
import { getFallbackLocation, requestUserLocation, watchUserLocation } from "../services/locationService";
import { colors } from "../styles/colors";
import { withDistance } from "../utils/geo";
import PaymentScreen from "./PaymentScreen";

export default function MapScreen() {
  const mapRef = useRef(null);
  const city = getCityConfig();
  const zones = getParkingZones();
  const restrictedAreas = getRestrictedAreas();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [location, setLocation] = useState(getFallbackLocation());
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [paymentSpot, setPaymentSpot] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    let subscription;

    async function startLocation() {
      setIsLocating(true);
      const current = await requestUserLocation();
      setLocation(current);
      setIsLocating(false);

      subscription = await watchUserLocation((nextLocation) => {
        setLocation(nextLocation);
      });
    }

    startLocation();

    return () => {
      subscription?.remove();
    };
  }, []);

  const allSpots = useMemo(() => withDistance(getParkingSpots(), location), [location]);
  const visibleSpots = useMemo(() => filterSpots(allSpots, filters), [allSpots, filters]);
  const summary = useMemo(() => summarizeAvailability(visibleSpots), [visibleSpots]);
  const selectedZone = zones.find((zone) => zone.id === selectedSpot?.zoneId);
  const paymentZone = zones.find((zone) => zone.id === paymentSpot?.zoneId);

  function toggleFilter(key) {
    setFilters((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  async function centerOnUser() {
    setIsLocating(true);
    const current = await requestUserLocation();
    setLocation(current);
    setIsLocating(false);
    mapRef.current?.animateToRegion({ ...current, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 500);
  }

  function findNearestParking() {
    const nearest = findNearestAvailableSpot(visibleSpots, location);

    if (!nearest) {
      Alert.alert("No parking found", "Try enabling more filters or moving the map around Varna.");
      return;
    }

    setSelectedSpot(nearest);
    mapRef.current?.animateToRegion(
      {
        latitude: nearest.latitude,
        longitude: nearest.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012
      },
      650
    );
  }

  if (paymentSpot) {
    return (
      <PaymentScreen
        spot={paymentSpot}
        zone={paymentZone}
        onCancel={() => setPaymentSpot(null)}
        onConfirm={() => {
          setPaymentSpot(null);
          setSelectedSpot(null);
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ParkingMap
        initialRegion={city.center}
        location={location}
        mapRef={mapRef}
        onSpotPress={setSelectedSpot}
        restrictedAreas={restrictedAreas}
        spots={visibleSpots}
        zones={zones}
      />

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Varna Parking</Text>
            <Text style={styles.subtitle}>OpenStreetMap parking zones for Varna only</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{location.isFallback ? "Varna" : "GPS"}</Text>
          </View>
        </View>

        <View style={styles.topPanel}>
          <FilterBar filters={filters} onToggle={toggleFilter} />
          <Legend summary={summary} />
        </View>

        <View style={styles.actions}>
          <AppButton variant="secondary" onPress={centerOnUser} style={styles.actionButton}>
            {isLocating ? "Locating..." : "My Location"}
          </AppButton>
          <AppButton onPress={findNearestParking} style={styles.actionButton}>
            Find Nearest Parking
          </AppButton>
        </View>
      </SafeAreaView>

      <SpotDetailsSheet
        onClose={() => setSelectedSpot(null)}
        onPay={setPaymentSpot}
        spot={selectedSpot}
        zone={selectedZone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    flex: 1
  },
  actions: {
    bottom: 24,
    flexDirection: "row",
    gap: 10,
    left: 16,
    position: "absolute",
    right: 16
  },
  badge: {
    backgroundColor: "#ccfbf1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  badgeText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900"
  },
  header: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 14,
    marginTop: 10,
    padding: 14
  },
  overlay: {
    ...StyleSheet.absoluteFillObject
  },
  root: {
    backgroundColor: colors.background,
    flex: 1
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  topPanel: {
    gap: 10,
    marginHorizontal: 14,
    marginTop: 10
  }
});
