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
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "@/src/theme";
import GoldButton from "@/src/components/GoldButton";
import Screen from "@/src/components/Screen";
import { signInWithEmail, signUpWithEmail, getCurrentProfile } from "@/src/api/supa";

type Mode = "signin" | "signup";

export default function EmailAuth() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      Alert.alert("Couling", "Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Couling", "Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(e, password);
      } else {
        await signInWithEmail(e, password);
      }
      const profile = await getCurrentProfile();
      if (!profile?.name) router.replace("/auth/profile");
      else router.replace("/(tabs)/chats");
    } catch (err: any) {
      const msg = err?.message || "Authentication failed";
      Alert.alert("Couling", msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
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

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.eyebrow}>STEP 1 · IDENTIFY</Text>
          <Text style={styles.title}>
            {mode === "signup" ? "Claim your\nprivate door." : "Welcome back\nto the Circle."}
          </Text>
          <Text style={styles.subtitle}>
            {mode === "signup"
              ? "Sign up with email. We'll never share it. Phone/SMS login is coming soon."
              : "Sign in with the email you used to enter Couling."}
          </Text>

          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={colors.gold} />
            <TextInput
              testID="email-input"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="you@private.club"
              placeholderTextColor={colors.textDim}
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.gold} />
            <TextInput
              testID="password-input"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholder={mode === "signup" ? "Min 6 characters" : "Your password"}
              placeholderTextColor={colors.textDim}
            />
            <TouchableOpacity
              testID="toggle-password-visibility-btn"
              onPress={() => setShowPassword((s) => !s)}
              hitSlop={10}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.notice}>
            <Ionicons name="shield-checkmark" size={14} color={colors.gold} />
            <Text style={styles.noticeText}>
              End-to-end secured. Your email is never shown to your Circle.
            </Text>
          </View>

          <View style={{ marginTop: spacing.xl }}>
            <GoldButton
              testID={mode === "signup" ? "signup-btn" : "signin-btn"}
              label={mode === "signup" ? "Create Account" : "Sign In"}
              onPress={onSubmit}
              loading={loading}
            />
          </View>

          <TouchableOpacity
            testID="toggle-auth-mode-btn"
            onPress={toggleMode}
            style={styles.toggleRow}
          >
            <Text style={styles.toggleText}>
              {mode === "signup" ? (
                <>
                  Already inside?{" "}
                  <Text style={{ color: colors.gold }}>Sign in</Text>
                </>
              ) : (
                <>
                  New to Couling?{" "}
                  <Text style={{ color: colors.gold }}>Create account</Text>
                </>
              )}
            </Text>
          </TouchableOpacity>

          <View style={styles.futureCard}>
            <Ionicons name="time-outline" size={14} color={colors.gold} />
            <Text style={styles.futureText}>
              <Text style={{ color: colors.gold }}>Coming soon · </Text>
              Sign in with phone number (one-time SMS code).
            </Text>
          </View>
        </ScrollView>
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
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
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
  label: {
    fontFamily: fonts.bodyMed,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 60,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bodyMed,
    fontSize: 16,
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
    flex: 1,
  },
  toggleRow: {
    alignSelf: "center",
    marginTop: spacing.lg,
    padding: 8,
  },
  toggleText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  futureCard: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  futureText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
});
