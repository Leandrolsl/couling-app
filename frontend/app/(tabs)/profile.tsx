import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "@/src/theme";
import Screen from "@/src/components/Screen";
import Avatar from "@/src/components/Avatar";
import HiddenNumberBadge from "@/src/components/HiddenNumberBadge";
import { getCurrentProfile, signOut } from "@/src/api/supa";

export default function ProfileTab() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [hideNumber, setHideNumber] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [encryptedMode, setEncryptedMode] = useState(true);

  const load = useCallback(async () => {
    try {
      const profile = await getCurrentProfile();
      setUser(profile);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onLogout = async () => {
    Alert.alert("Sign out", "Leave the Circle? Your account is preserved.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out", style: "destructive",
        onPress: async () => { await signOut(); router.replace("/"); },
      },
    ]);
  };

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>IDENTITY</Text>
          <Text style={styles.title}>Profile</Text>
        </View>

        <View style={styles.profileCard}>
          <Avatar name={user?.name || "?"} emoji={user?.avatar} size={84} />
          <Text style={styles.name}>{user?.name || "—"}</Text>
          <HiddenNumberBadge />
          <Text style={styles.phoneHint}>
            Your number is hidden from your Circle. Visible only to Couling for verification.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>PRIVACY</Text>
        <View style={styles.card}>
          <Row
            icon="eye-off-outline"
            title="Hide phone number"
            sub="Your number stays invisible to everyone"
            value={hideNumber}
            onValueChange={setHideNumber}
            disabled
          />
          <Divider />
          <Row
            icon="lock-closed-outline"
            title="Encrypted communication"
            sub="All chats & calls are encrypted in transit"
            value={encryptedMode}
            onValueChange={setEncryptedMode}
          />
          <Divider />
          <Row
            icon="checkmark-done-outline"
            title="Read receipts"
            sub="Let your Circle know you've read messages"
            value={readReceipts}
            onValueChange={setReadReceipts}
          />
        </View>

        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <InfoRow icon="diamond-outline" label="Member tier" value="Founding · Gold" />
          <Divider />
          <InfoRow icon="git-branch-outline" label="Build" value="Couling v1.0" />
        </View>

        <TouchableOpacity testID="logout-btn" onPress={onLogout} style={styles.logout}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

function Row({
  icon, title, sub, value, onValueChange, disabled,
}: any) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.surface2, true: colors.gold }}
        thumbColor="#0D0D0D"
      />
    </View>
  );
}

function InfoRow({ icon, label, value }: any) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowSub}>{label}</Text>
        <Text style={styles.rowTitle}>{value}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 56 }} />;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
  eyebrow: { fontFamily: fonts.bodyMed, fontSize: 11, color: colors.gold, letterSpacing: 2 },
  title: { fontFamily: fonts.serifBold, fontSize: 36, color: colors.text, letterSpacing: -1, marginTop: 4 },
  profileCard: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface1,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    gap: 8,
  },
  name: { fontFamily: fonts.serifBold, fontSize: 28, color: colors.text, marginTop: spacing.sm },
  phoneHint: {
    fontFamily: fonts.body, fontSize: 12, color: colors.textMuted,
    textAlign: "center", paddingHorizontal: 32, marginTop: 8, lineHeight: 18,
  },
  sectionLabel: {
    fontFamily: fonts.bodyMed, fontSize: 11, color: colors.textMuted,
    letterSpacing: 2, paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm,
  },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface1, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.goldDim, alignItems: "center", justifyContent: "center",
  },
  rowTitle: { fontFamily: fonts.bodyMed, fontSize: 15, color: colors.text },
  rowSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  logout: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: spacing.xl, marginHorizontal: spacing.lg,
    padding: spacing.md, borderRadius: radius.pill,
    backgroundColor: "rgba(255,77,77,0.1)", borderWidth: 1, borderColor: colors.error,
  },
  logoutText: { color: colors.error, fontFamily: fonts.bodyMed, fontSize: 15 },
});
