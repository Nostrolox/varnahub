import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/colors";

const FILTERS = [
  { key: "free", label: "Free", color: colors.free },
  { key: "paid", label: "Paid", color: colors.paid },
  { key: "restricted", label: "Restricted", color: colors.full }
];

export default function FilterBar({ filters, onToggle }) {
  return (
    <View style={styles.container}>
      {FILTERS.map((filter) => {
        const active = filters[filter.key];
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={filter.key}
            onPress={() => onToggle(filter.key)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <View style={[styles.dot, { backgroundColor: filter.color }]} />
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{filter.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    minHeight: 38,
    paddingHorizontal: 12
  },
  chipActive: {
    backgroundColor: colors.text
  },
  chipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  chipTextActive: {
    color: "#ffffff"
  },
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  dot: {
    borderRadius: 5,
    height: 10,
    width: 10
  }
});
