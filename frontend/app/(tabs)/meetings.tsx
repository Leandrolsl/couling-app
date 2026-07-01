import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius, ASSETS } from "@/src/theme";
import Screen from "@/src/components/Screen";
import GoldButton from "@/src/components/GoldButton";
import {
  listMeetings,
  createMeeting,
  joinMeeting,
} from "@/src/api/supa";

export default function MeetingsTab() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [title, setTitle] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listMeetings();
      setItems(data);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onCreate = async () => {
    if (!title.trim()) return Alert.alert("Couling", "Add a title");
    setLoading(true);
    try {
      const meeting = await createMeeting(title.trim());
      setShowCreate(false);
      setTitle("");
      router.push({ pathname: "/meeting/[id]", params: { id: meeting.id } });
    } catch (err: any) {
      Alert.alert("Couling", err.message);
    } finally {
      setLoading(false);
    }
  };

  const onJoin = async () => {
    if (!joinCode.trim()) return Alert.alert("Couling", "Enter a meeting code");
    setLoading(true);
    try {
      const meeting = await joinMeeting(joinCode.trim().toUpperCase());
      setShowJoin(false);
      setJoinCode("");
      router.push({ pathname: "/meeting/[id]", params: { id: meeting.id } });
    } catch (err: any) {
      Alert.alert("Couling", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>GROUP CONVENE</Text>
          <Text style={styles.title}>Meetings</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          testID="create-meeting-btn"
          style={[styles.actionCard, styles.actionCardPrimary]}
          onPress={() => setShowCreate(true)}
        >
          <View style={styles.actionIconPrimary}>
            <Ionicons name="add" size={24} color="#0D0D0D" />
          </View>
          <Text style={styles.actionTitlePrimary}>Host meeting</Text>
          <Text style={styles.actionSubPrimary}>Become organizer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="join-meeting-btn"
          style={styles.actionCard}
          onPress={() => setShowJoin(true)}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="enter-outline" size={22} color={colors.gold} />
          </View>
          <Text style={styles.actionTitle}>Join by code</Text>
          <Text style={styles.actionSub}>e.g. ABC-XYZ-123</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.eyebrow, { paddingHorizontal: spacing.lg, marginTop: spacing.lg }]}>
        RECENT
      </Text>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />
        }
        ListEmptyComponent={
          <View style={styles.empty} testID="empty-meetings">
            <Image source={{ uri: ASSETS.emptyMeetings }} style={styles.emptyImg} resizeMode="contain" />
            <Text style={styles.emptyTitle}>The room awaits</Text>
            <Text style={styles.emptySub}>
              Host a private gathering or join with a code. Numbers stay sealed.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`meeting-row-${item.id}`}
            style={styles.meetCard}
            onPress={() => router.push({ pathname: "/meeting/[id]", params: { id: item.id } })}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.metaRow}>
                <View style={[styles.statusDot, { backgroundColor: item.status === "live" ? colors.success : colors.textDim }]} />
                <Text style={styles.metaSm}>
                  {item.status === "live" ? "LIVE" : "ENDED"} · {item.participants.length} {item.participants.length === 1 ? "guest" : "guests"}
                </Text>
              </View>
              <Text style={styles.meetTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.meetCode}>{item.code}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </TouchableOpacity>
        )}
      />

      {/* Create Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalEyebrow}>HOST A MEETING</Text>
            <Text style={styles.modalTitle}>Name your gathering</Text>
            <View style={styles.inputWrap}>
              <TextInput
                testID="meeting-title-input"
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Founders Roundtable"
                placeholderTextColor={colors.textDim}
                style={styles.input}
                maxLength={48}
              />
            </View>
            <GoldButton
              testID="confirm-create-meeting-btn"
              label="Create & Open Room"
              onPress={onCreate}
              loading={loading}
              style={{ marginTop: spacing.lg }}
            />
            <TouchableOpacity onPress={() => setShowCreate(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Join Modal */}
      <Modal visible={showJoin} transparent animationType="slide" onRequestClose={() => setShowJoin(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalEyebrow}>JOIN A MEETING</Text>
            <Text style={styles.modalTitle}>Enter the code</Text>
            <View style={styles.inputWrap}>
              <TextInput
                testID="join-code-input"
                value={joinCode}
                onChangeText={(t) => setJoinCode(t.toUpperCase())}
                placeholder="ABC-XYZ-123"
                placeholderTextColor={colors.textDim}
                style={[styles.input, { letterSpacing: 4, textAlign: "center", fontSize: 22 }]}
                maxLength={11}
                autoCapitalize="characters"
              />
            </View>
            <GoldButton
              testID="confirm-join-meeting-btn"
              label="Join Room"
              onPress={onJoin}
              loading={loading}
              style={{ marginTop: spacing.lg }}
            />
            <TouchableOpacity onPress={() => setShowJoin(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
  },
  eyebrow: { fontFamily: fonts.bodyMed, fontSize: 11, color: colors.gold, letterSpacing: 2 },
  title: { fontFamily: fonts.serifBold, fontSize: 36, color: colors.text, letterSpacing: -1, marginTop: 4 },
  actions: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg },
  actionCard: {
    flex: 1, height: 140, borderRadius: radius.lg,
    padding: spacing.md, backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.border, justifyContent: "space-between",
  },
  actionCardPrimary: { backgroundColor: colors.gold, borderColor: colors.gold },
  actionIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.goldDim, alignItems: "center", justifyContent: "center",
  },
  actionIconPrimary: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.15)", alignItems: "center", justifyContent: "center",
  },
  actionTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text },
  actionTitlePrimary: { fontFamily: fonts.bodyBold, fontSize: 17, color: "#0D0D0D" },
  actionSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  actionSubPrimary: { fontFamily: fonts.body, fontSize: 13, color: "rgba(0,0,0,0.6)" },
  meetCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface1, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  metaSm: { fontFamily: fonts.bodyMed, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5 },
  meetTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text, marginTop: 4 },
  meetCode: { fontFamily: fonts.bodyMed, fontSize: 12, color: colors.gold, letterSpacing: 2, marginTop: 2 },
  empty: { alignItems: "center", paddingTop: 24 },
  emptyImg: { width: 200, height: 200, marginBottom: spacing.md },
  emptyTitle: { fontFamily: fonts.serifBold, fontSize: 24, color: colors.text },
  emptySub: {
    fontFamily: fonts.body, fontSize: 14, color: colors.textMuted,
    textAlign: "center", marginTop: 8, lineHeight: 20, paddingHorizontal: 32,
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.surface1, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing.lg, paddingBottom: spacing.xxl,
    borderTopWidth: 1, borderColor: colors.goldDim,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.lg,
  },
  modalEyebrow: { fontFamily: fonts.bodyMed, fontSize: 11, color: colors.gold, letterSpacing: 2 },
  modalTitle: { fontFamily: fonts.serifBold, fontSize: 28, color: colors.text, marginTop: 4, marginBottom: spacing.lg },
  inputWrap: {
    backgroundColor: colors.surface2, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
    height: 60, justifyContent: "center",
  },
  input: { color: colors.text, fontFamily: fonts.bodyMed, fontSize: 18 },
  modalClose: { alignSelf: "center", marginTop: spacing.md, padding: 12 },
  modalCloseText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
});
