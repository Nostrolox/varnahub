import { StyleSheet, Text, View } from "react-native";
import { colors, statusMeta } from "../styles/colors";

export default function Legend({ summary }) {
  return (
    <View style={styles.container}>
      {Object.entries(statusMeta).map(([key, meta]) => (
        <View key={key} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: meta.color }]} />
          <Text style={styles.text}>
            {meta.label} {summary ? summary[key] : ""}
          </Text>
        </View>
      ))}
      <View style={styles.item}>
        <View style={[styles.swatch, { borderColor: colors.blueZoneStroke, backgroundColor: colors.blueZone }]} />
        <Text style={styles.text}>Blue Zone</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 12
  },
  dot: {
    borderRadius: 5,
    height: 10,
    width: 10
  },
  item: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  swatch: {
    borderRadius: 3,
    borderWidth: 2,
    height: 11,
    width: 14
  },
  text: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800"
  }
});
