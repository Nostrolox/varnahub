import { StyleSheet, Text, View } from "react-native";
import AppButton from "./AppButton";
import { colors, statusMeta } from "../styles/colors";
import { formatDistance } from "../utils/geo";

export default function SpotDetailsSheet({ spot, zone, onClose, onPay }) {
  if (!spot) return null;

  const meta = statusMeta[spot.status] || statusMeta.unknown;
  const canPay = spot.type === "paid" && spot.status !== "full";

  return (
    <View style={styles.sheet}>
      <View style={styles.dragHandle} />
      <View style={styles.header}>
        <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{spot.name}</Text>
          <Text style={styles.subtitle}>
            {meta.label} availability | {spot.spaces ?? "?"} spaces | {formatDistance(spot.distanceKm)}
          </Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Type</Text>
        <Text style={styles.infoValue}>{spot.type === "paid" ? "Blue Zone paid parking" : spot.type}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Zone</Text>
        <Text style={styles.infoValue}>{zone?.name || "Outside paid zone"}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Updated</Text>
        <Text style={styles.infoValue}>{new Date(spot.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
      </View>

      <View style={styles.actions}>
        <AppButton variant="secondary" onPress={onClose} style={styles.actionButton}>
          Close
        </AppButton>
        <AppButton disabled={!canPay} onPress={() => onPay(spot)} style={styles.actionButton}>
          Pay Parking
        </AppButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    flex: 1
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18
  },
  dragHandle: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: 2,
    height: 4,
    marginBottom: 14,
    width: 42
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 18
  },
  headerText: {
    flex: 1
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  infoRow: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 11
  },
  infoValue: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right"
  },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    bottom: 0,
    elevation: 12,
    left: 0,
    padding: 18,
    paddingBottom: 28,
    position: "absolute",
    right: 0,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 18
  },
  statusDot: {
    borderRadius: 10,
    height: 20,
    width: 20
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900"
  }
});
