import React, { useEffect, useRef, useState } from "react";
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "@/src/theme";
import GoldButton from "@/src/components/GoldButton";
import Screen from "@/src/components/Screen";
import { auth } from "@/src/api/client";
import { signInDemo, getCurrentProfile } from "@/src/api/supa";

export default function OtpVerify() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputs = useRef<Array<TextInput | null>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const setDigit = (i: number, v: string) => {
    const val = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) inputs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: any) => {
    if (e.nativeEvent.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const onVerify = async () => {
    const code = digits.join("");
    if (code.length < 6) {
      Alert.alert("Couling", "Enter the 6-digit code");
      return;
    }
    if (code !== "123456") {
      Alert.alert("Couling", "Invalid code. Demo OTP is 123456.");
      return;
    }
    setLoading(true);
    try {
      await signInDemo(phone as string);
      const profile = await getCurrentProfile();
      if (!profile?.name) router.replace("/auth/profile");
      else router.replace("/(tabs)/chats");
    } catch (e: any) {
      Alert.alert("Couling", e.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    try {
      await auth.sendOtp(phone as string);
      Alert.alert("Couling", "New code sent. (Demo: 123456)");
    } catch (e: any) {
      Alert.alert("Couling", e.message);
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
          <Text style={styles.eyebrow}>STEP 2 · VERIFY</Text>
          <Text style={styles.title}>Six digits.{"\n"}One private door.</Text>
          <Text style={styles.subtitle}>
            We sent a code to <Text style={{ color: colors.gold }}>{phone}</Text>.
            {"\n"}Demo code: <Text style={{ color: colors.gold }}>123456</Text>
          </Text>

          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <View
                key={i}
                style={[
                  styles.otpBox,
                  d ? styles.otpBoxFilled : null,
                ]}
              >
                <TextInput
                  testID={`otp-input-${i}`}
                  ref={(r) => {
                    inputs.current[i] = r;
                  }}
                  value={d}
                  onChangeText={(v) => setDigit(i, v)}
                  onKeyPress={(e) => onKey(i, e)}
                  keyboardType="number-pad"
                  maxLength={1}
                  style={styles.otpInput}
                />
              </View>
            ))}
          </View>

          <TouchableOpacity onPress={onResend} testID="resend-otp-btn" style={styles.resend}>
            <Text style={styles.resendText}>
              Didn't get it? <Text style={{ color: colors.gold }}>Resend code</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <GoldButton
            testID="verify-otp-btn"
            label="Verify & Continue"
            onPress={onVerify}
            loading={loading}
          />
        </View>
      </KeyboardAvoidingView>
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
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  eyebrow: {
    fontFamily: fonts.bodyMed, fontSize: 11, color: colors.gold,
    letterSpacing: 2, marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.serifBold, fontSize: 40, color: colors.text,
    letterSpacing: -1, lineHeight: 44,
  },
  subtitle: {
    fontFamily: fonts.body, fontSize: 15, color: colors.textMuted,
    lineHeight: 22, marginTop: spacing.md,
  },
  otpRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.xxl,
    justifyContent: "space-between",
  },
  otpBox: {
    flex: 1,
    height: 64,
    borderBottomWidth: 2,
    borderBottomColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  otpBoxFilled: { borderBottomColor: colors.gold },
  otpInput: {
    color: colors.text,
    fontSize: 32,
    fontFamily: fonts.bodyMed,
    textAlign: "center",
    width: "100%",
    height: "100%",
  },
  resend: { marginTop: spacing.lg, alignSelf: "center" },
  resendText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
  footer: { padding: spacing.lg },
});
