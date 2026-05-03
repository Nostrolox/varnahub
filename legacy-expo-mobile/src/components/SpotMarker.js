import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import { colors, statusMeta } from "../styles/colors";

export default function SpotMarker({ spot, onPress }) {
  const meta = statusMeta[spot.status] || statusMeta.unknown;

  return (
    <Marker
      coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
      onPress={() => onPress(spot)}
      title={spot.name}
      description={`${meta.label} parking`}
    >
      <View style={[styles.marker, { borderColor: meta.color }]}>
        <View style={[styles.inner, { backgroundColor: meta.color }]}>
          <Text style={styles.markerText}>{spot.type === "restricted" ? "!" : "P"}</Text>
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  inner: {
    alignItems: "center",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  marker: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 3,
    padding: 3,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5
  },
  markerText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  }
});
