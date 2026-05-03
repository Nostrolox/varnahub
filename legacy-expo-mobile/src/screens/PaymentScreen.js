import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AppButton from "../components/AppButton";
import { colors } from "../styles/colors";

const HOURS = [1, 2, 3];

export default function PaymentScreen({ spot, zone, onCancel, onConfirm }) {
  const [plate, setPlate] = useState("");
  const [hours, setHours] = useState(1);
  const [confirmed, setConfirmed] = useState(false);

  const total = useMemo(() => {
    const price = Number.parseFloat(zone?.priceLabel) || 1;
    return price * hours;
  }, [hours, zone?.priceLabel]);

  function handleConfirm() {
    setConfirmed(true);
  }

  if (confirmed) {
    return (
      <View style={styles.screen}>
        <View style={styles.confirmationCard}>
          <Text style={styles.confirmationIcon}>P</Text>
          <Text style={styles.title}>Parking Confirmed</Text>
          <Text style={styles.copy}>
            Simulated payment for {plate.trim().toUpperCase() || "your vehicle"} at {spot.name} is active for {hours} hour
            {hours > 1 ? "s" : ""}.
          </Text>
          <AppButton onPress={onConfirm}>Back to Map</AppButton>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Payment Simulation</Text>
        <Text style={styles.title}>{spot.name}</Text>
        <Text style={styles.copy}>{zone?.priceLabel || "1 BGN / hour"} | No real payment will be charged.</Text>

        <Text style={styles.label}>Vehicle plate</Text>
        <TextInput
          autoCapitalize="characters"
          onChangeText={setPlate}
          placeholder="B 1234 AB"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={plate}
        />

        <Text style={styles.label}>Duration</Text>
        <View style={styles.segmented}>
          {HOURS.map((option) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: hours === option }}
              key={option}
              onPress={() => setHours(option)}
              style={[styles.segment, hours === option && styles.segmentActive]}
            >
              <Text style={[styles.segmentLabel, hours === option && styles.segmentLabelActive]}>{option}h</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{total.toFixed(2)} BGN</Text>
        </View>

        <View style={styles.actions}>
          <AppButton variant="secondary" onPress={onCancel} style={styles.actionButton}>
            Cancel
          </AppButton>
          <AppButton disabled={!plate.trim()} onPress={handleConfirm} style={styles.actionButton}>
            Confirm
          </AppButton>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    flex: 1
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 24,
    padding: 20,
    width: "100%"
  },
  confirmationCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: 24,
    gap: 16,
    padding: 24,
    width: "100%"
  },
  confirmationIcon: {
    backgroundColor: "#ccfbf1",
    borderRadius: 28,
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: "900",
    height: 56,
    lineHeight: 56,
    overflow: "hidden",
    textAlign: "center",
    width: 56
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    marginTop: 6
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 8,
    textTransform: "uppercase"
  },
  input: {
    backgroundColor: "#f8fafc",
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    minHeight: 50,
    paddingHorizontal: 14
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 8,
    marginTop: 18
  },
  screen: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: 18
  },
  segment: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    minHeight: 44,
    justifyContent: "center"
  },
  segmentActive: {
    backgroundColor: colors.text
  },
  segmentLabel: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "900"
  },
  segmentLabelActive: {
    color: "#ffffff"
  },
  segmented: {
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    flexDirection: "row",
    gap: 6,
    padding: 5
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900"
  },
  totalLabel: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "800"
  },
  totalRow: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 22,
    paddingTop: 18
  },
  totalValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  }
});
