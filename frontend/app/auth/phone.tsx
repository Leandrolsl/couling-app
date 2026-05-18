import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "@/src/theme";
import GoldButton from "@/src/components/GoldButton";
import Screen from "@/src/components/Screen";
import { auth } from "@/src/api/client";

export default function PhoneEntry() {
  const router = useRouter();
  const [country, setCountry] = useState("+1");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const fullPhone = `${country}${phone.replace(/\D/g, "")}`;

  const onContinue = async () => {
    if (phone.replace(/\D/g, "").length < 6) {
      Alert.alert("Couling", "Enter a valid phone number.");
      return;
    }
    setLoading(true);
    try {
      await auth.sendOtp(fullPhone);
      router.push({ pathname: "/auth/otp", params: { phone: fullPhone } });
    } catch (e: any) {
      Alert.alert("Couling", e.message || "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
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
          <Text style={styles.eyebrow}>STEP 1 · IDENTIFY</Text>
          <Text style={styles.title}>Your number{"\n"}stays a secret.</Text>
          <Text style={styles.subtitle}>
            We only use it to verify it's truly you. Once verified, it's hidden from
            everyone you meet on Couling.
          </Text>

          <View style={{ height: spacing.xl }} />

          <View style={styles.row}>
            <View style={styles.countryBox}>
              <TextInput
                testID="country-code-input"
                style={styles.countryInput}
                value={country}
                onChangeText={(t) => setCountry(t.startsWith("+") ? t : "+" + t.replace(/\D/g, ""))}
                keyboardType="phone-pad"
                maxLength={5}
                placeholderTextColor={colors.textDim}
              />
            </View>
            <View style={styles.phoneBox}>
              <TextInput
                testID="phone-input"
                style={styles.phoneInput}
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, ""))}
                keyboardType="phone-pad"
                placeholder="000 000 0000"
                placeholderTextColor={colors.textDim}
                maxLength={15}
                autoFocus
              />
            </View>
          </View>

          <View style={styles.notice}>
            <Ionicons name="shield-checkmark" size={14} color={colors.gold} />
            <Text style={styles.noticeText}>
              End-to-end secured. Number never shared with anyone.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <GoldButton
            testID="send-otp-btn"
            label="Send Verification Code"
            onPress={onContinue}
            loading={loading}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    flexDirection: "row",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  eyebrow: {
    fontFamily: fonts.bodyMed,
    fontSize: 11,
    color: colors.gold,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 40,
    color: colors.text,
    letterSpacing: -1,
    lineHeight: 44,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  row: { flexDirection: "row", gap: spacing.sm },
  countryBox: {
    width: 96,
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    height: 64,
  },
  countryInput: {
    color: colors.text,
    fontFamily: fonts.bodyMed,
    fontSize: 18,
    textAlign: "center",
  },
  phoneBox: {
    flex: 1,
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 64,
    justifyContent: "center",
  },
  phoneInput: {
    color: colors.text,
    fontFamily: fonts.bodyMed,
    fontSize: 20,
    letterSpacing: 1.2,
  },
  notice: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  noticeText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  footer: { padding: spacing.lg },
});
