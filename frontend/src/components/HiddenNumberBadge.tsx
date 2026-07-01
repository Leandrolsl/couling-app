import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/src/theme";

export default function HiddenNumberBadge() {
  return (
    <View style={styles.wrap}>
      <Ionicons name="lock-closed" size={10} color={colors.gold} />
      <Text style={styles.text}>Hidden</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.goldDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  text: {
    color: colors.gold,
    fontSize: 10,
    fontFamily: fonts.bodyMed,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
