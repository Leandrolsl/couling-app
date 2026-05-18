import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
} from "react-native";
import { colors, fonts, radius } from "@/src/theme";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  style?: StyleProp<ViewStyle>;
  testID?: string;
  icon?: React.ReactNode;
};

export default function GoldButton({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  style,
  testID,
  icon,
}: Props) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        isPrimary && styles.primary,
        variant === "ghost" && styles.ghost,
        isDanger && styles.danger,
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? "#000" : colors.gold} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.label,
              isPrimary && { color: "#0D0D0D" },
              variant === "ghost" && { color: colors.gold },
              isDanger && { color: "#fff" },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: radius.pill,
    paddingHorizontal: 28,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.gold },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.gold,
  },
  danger: { backgroundColor: colors.error },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
