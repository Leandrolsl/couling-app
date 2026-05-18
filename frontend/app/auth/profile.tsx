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
import { colors, fonts, spacing, radius } from "@/src/theme";
import GoldButton from "@/src/components/GoldButton";
import Screen from "@/src/components/Screen";
import { updateProfile } from "@/src/api/supa";

const EMOJIS = ["🦊", "🦁", "🐺", "🐉", "🦅", "🦉", "🐝", "🦋", "💎", "👑", "🔱", "♟️"];

export default function ProfileSetup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🦊");
  const [loading, setLoading] = useState(false);

  const onContinue = async () => {
    if (!name.trim()) {
      Alert.alert("Couling", "Choose how others see you");
      return;
    }
    setLoading(true);
    try {
      await updateProfile(name.trim(), emoji);
      router.replace("/(tabs)/chats");
    } catch (e: any) {
      Alert.alert("Couling", e.message);
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
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>STEP 3 · APPEAR</Text>
          <Text style={styles.title}>Pick your{"\n"}private identity.</Text>
          <Text style={styles.subtitle}>
            Only this name is visible to the people you connect with.{"\n"}You can change it later.
          </Text>

          <View style={styles.avatarPreview}>
            <Text style={styles.avatarEmoji}>{emoji}</Text>
          </View>

          <Text style={styles.label}>Display Name</Text>
          <View style={styles.inputWrap}>
            <TextInput
              testID="display-name-input"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Midnight Fox"
              placeholderTextColor={colors.textDim}
              style={styles.input}
              maxLength={32}
            />
          </View>

          <Text style={[styles.label, { marginTop: spacing.lg }]}>Choose an emblem</Text>
          <View style={styles.emojiGrid}>
            {EMOJIS.map((e) => (
              <TouchableOpacity
                key={e}
                testID={`emoji-${e}`}
                onPress={() => setEmoji(e)}
                style={[styles.emojiCell, emoji === e && styles.emojiCellActive]}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: spacing.xl }} />
        </ScrollView>

        <View style={styles.footer}>
          <GoldButton
            testID="complete-profile-btn"
            label="Enter Couling"
            onPress={onContinue}
            loading={loading}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingTop: spacing.xl },
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
  avatarPreview: {
    alignSelf: "center",
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.surface1,
    borderWidth: 2, borderColor: colors.gold,
    alignItems: "center", justifyContent: "center",
    marginTop: spacing.xl,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 24,
    elevation: 8,
  },
  avatarEmoji: { fontSize: 60 },
  label: {
    fontFamily: fonts.bodyMed, fontSize: 12, color: colors.textMuted,
    letterSpacing: 1.5, textTransform: "uppercase", marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  inputWrap: {
    backgroundColor: colors.surface1, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
    height: 60, justifyContent: "center",
  },
  input: { color: colors.text, fontFamily: fonts.bodyMed, fontSize: 18 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  emojiCell: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: colors.surface1, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  emojiCellActive: { borderColor: colors.gold, backgroundColor: colors.goldDim },
  emojiText: { fontSize: 28 },
  footer: { padding: spacing.lg, paddingTop: 0 },
});
