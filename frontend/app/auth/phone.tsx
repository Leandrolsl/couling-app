// Placeholder for future Phone/SMS OTP login.
// Today, users authenticate via /auth/email. We keep this route to make the
// upcoming Twilio (or Supabase phone auth) integration a drop-in.
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "@/src/theme";
import Screen from "@/src/components/Screen";
import GoldButton from "@/src/components/GoldButton";

export default function PhoneAuthSoon() {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity
          testID="back-btn"
          onPress={() => router.back()}
          style={styles.iconBtn}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.body}>
        <View style={styles.iconBig}>
          <Ionicons name="time-outline" size={32} color={colors.gold} />
        </View>
        <Text style={styles.eyebrow}>COMING SOON</Text>
        <Text style={styles.title}>Phone & SMS{"\n"}login is on the way.</Text>
        <Text style={styles.subtitle}>
          For now, please use your email to enter the Circle. We'll bring back
          one-tap SMS verification in the next release.
        </Text>
        <View style={{ height: spacing.xl }} />
        <GoldButton
          testID="goto-email-btn"
          label="Continue with Email"
          onPress={() => router.replace("/auth/email")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, flexDirection: "row" },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface1, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, alignItems: "center" },
  iconBig: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.gold,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  eyebrow: { fontFamily: fonts.bodyMed, fontSize: 11, color: colors.gold, letterSpacing: 2 },
  title: {
    fontFamily: fonts.serifBold, fontSize: 36, color: colors.text,
    letterSpacing: -1, textAlign: "center", marginTop: spacing.sm, lineHeight: 40,
  },
  subtitle: {
    fontFamily: fonts.body, fontSize: 15, color: colors.textMuted,
    lineHeight: 22, marginTop: spacing.md, textAlign: "center",
  },
});
