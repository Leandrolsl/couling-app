import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "@/src/theme";
import Avatar from "@/src/components/Avatar";

export default function CallStage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; emoji?: string; type?: string }>();
  return (
    <View style={styles.root} testID="call-screen">
      <View style={styles.avatarWrap}>
        <Avatar name={params.name || "?"} emoji={params.emoji} size={120} />
      </View>
      <Text style={styles.name}>{params.name || "Couling User"}</Text>
      <View style={styles.card}>
        <Ionicons name="phone-portrait-outline" size={20} color={colors.gold} />
        <Text style={styles.cardText}>
          Live {params.type === "video" ? "video" : "voice"} calls run in the Couling mobile app.
          Open Couling on your phone to answer or place calls.
        </Text>
      </View>
      <TouchableOpacity testID="end-call-btn" onPress={() => router.back()} style={styles.endBtn}>
        <Ionicons name="close" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  avatarWrap: {
    width: 140, height: 140, borderRadius: 70, backgroundColor: colors.surface1,
    borderWidth: 2, borderColor: colors.gold, alignItems: "center", justifyContent: "center",
  },
  name: { fontFamily: fonts.serifBold, fontSize: 32, color: colors.text, marginTop: spacing.lg },
  card: {
    flexDirection: "row", gap: 10, alignItems: "center", marginTop: spacing.xl,
    backgroundColor: colors.goldDim, padding: spacing.lg, borderRadius: 16,
    borderWidth: 1, borderColor: colors.gold, maxWidth: 420,
  },
  cardText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text, lineHeight: 20 },
  endBtn: {
    marginTop: spacing.xxl, width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.error, alignItems: "center", justifyContent: "center",
  },
});
