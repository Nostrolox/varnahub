import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../styles/colors";

export default function AppButton({ children, onPress, variant = "primary", disabled = false, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.secondary,
        variant === "danger" && styles.danger,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
    >
      <Text style={[styles.label, variant === "secondary" && styles.secondaryLabel]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 18
  },
  danger: {
    backgroundColor: colors.full
  },
  disabled: {
    opacity: 0.45
  },
  label: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800"
  },
  pressed: {
    transform: [{ scale: 0.98 }]
  },
  secondary: {
    backgroundColor: "#e2e8f0"
  },
  secondaryLabel: {
    color: colors.text
  }
});
