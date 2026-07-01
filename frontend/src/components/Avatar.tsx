import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "@/src/theme";

type Props = {
  name: string;
  size?: number;
  emoji?: string;
};

export default function Avatar({ name, size = 48, emoji }: Props) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.42 }]}>{emoji || initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.goldDim,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: colors.gold,
    fontFamily: fonts.serifBold,
  },
});
