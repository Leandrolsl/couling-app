import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { colors, fonts, spacing, radius } from "@/src/theme";
import Avatar from "@/src/components/Avatar";

import {
  getMeeting,
  muteAll,
  unmuteAll,
  startPrivateTalk,
  endPrivateTalk,
  endMeeting,
  leaveMeeting,
  subscribeMeeting,
} from "@/src/api/supa";
import { supabase } from "@/src/lib/supabase";

export default function MeetingRoom() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meeting, setMeeting] = useState<any>(null);
  const [showPrivateTalk, setShowPrivateTalk] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const load = async () => {
    try {
      const data = await getMeeting(id as string);
      setMeeting(data);
    } catch (e: any) {
      Alert.alert("Couling", e.message);
      router.back();
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [id]));

  // Realtime: refetch when meeting row changes
  useEffect(() => {
    if (!id) return;
    const ch = subscribeMeeting(id as string, () => {
      load();
    });
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  if (!meeting) {
    return <View style={styles.root} />;
  }

  const isOrganizer = meeting.is_organizer;

  const toggleSelect = (uid: string) => {
    setSelected((s) =>
      s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid]
    );
  };

  const onMuteAll = async () => {
    try {
      if (meeting.all_muted) await unmuteAll(meeting.id);
      else await muteAll(meeting.id);
      await load();
    } catch (e: any) {
      Alert.alert("Couling", e.message);
    }
  };

  const onStartPrivateTalk = async () => {
    if (selected.length === 0) return Alert.alert("Couling", "Select at least one participant");
    try {
      await startPrivateTalk(meeting.id, selected);
      setShowPrivateTalk(false);
      setSelected([]);
      await load();
    } catch (e: any) {
      Alert.alert("Couling", e.message);
    }
  };

  const onEndPrivateTalk = async () => {
    try {
      await endPrivateTalk(meeting.id);
      await load();
    } catch {}
  };

  const onLeave = async () => {
    Alert.alert(
      isOrganizer ? "End meeting?" : "Leave meeting?",
      isOrganizer ? "Ending will close the room for everyone." : "You can rejoin with the code.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isOrganizer ? "End" : "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              if (isOrganizer) await endMeeting(meeting.id);
              else await leaveMeeting(meeting.id);
            } catch {}
            router.back();
          },
        },
      ]
    );
  };

  const inPrivateTalk = meeting.private_talk?.members?.length > 0;
  const tiles = meeting.participants_detail || [];

  return (
    <View style={styles.root} testID="meeting-screen">
      <LinearGradient
        colors={["rgba(212,164,55,0.12)", "rgba(13,13,13,0.6)", "#0D0D0D"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <BlurView intensity={50} tint="dark" style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.liveDot} />
          <Text style={styles.headerEyebrow}>
            {meeting.status === "live" ? "LIVE" : "ENDED"} · {isOrganizer ? "YOU HOST" : "GUEST"}
          </Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{meeting.title}</Text>
          <Text style={styles.headerCode}>{meeting.code}</Text>
        </View>
        <View style={styles.countPill}>
          <Ionicons name="people" size={14} color={colors.gold} />
          <Text style={styles.countText}>{tiles.length}</Text>
        </View>
      </BlurView>

      {inPrivateTalk && (
        <View style={styles.privateBanner}>
          <Ionicons name="lock-closed" size={14} color={colors.gold} />
          <Text style={styles.privateBannerText}>
            Private Talk active · {meeting.private_talk.members.length} member(s)
          </Text>
          {isOrganizer && (
            <TouchableOpacity testID="end-private-talk-btn" onPress={onEndPrivateTalk}>
              <Text style={styles.privateBannerLink}>End</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Grid */}
      <ScrollView contentContainerStyle={styles.grid}>
        {tiles.map((p: any) => {
          const inPrivate = meeting.private_talk?.members?.includes(p.user_id);
          return (
            <View
              key={p.user_id}
              style={[
                styles.tile,
                p.is_organizer && styles.tileOrganizer,
                inPrivate && styles.tilePrivate,
              ]}
              testID={`tile-${p.user_id}`}
            >
              <Avatar name={p.display_name} emoji={p.avatar} size={72} />
              <Text style={styles.tileName} numberOfLines={1}>
                {p.display_name}
              </Text>
              <View style={styles.tileMetaRow}>
                {p.is_organizer && (
                  <View style={styles.organizerBadge}>
                    <Ionicons name="star" size={10} color="#0D0D0D" />
                    <Text style={styles.organizerBadgeText}>HOST</Text>
                  </View>
                )}
                <View style={[styles.micBadge, p.muted && styles.micBadgeMuted]}>
                  <Ionicons name={p.muted ? "mic-off" : "mic"} size={11} color={p.muted ? colors.error : colors.success} />
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Organizer controls */}
      {isOrganizer && (
        <BlurView intensity={60} tint="dark" style={styles.organizerBar}>
          <Text style={styles.organizerBarLabel}>ORGANIZER CONTROLS</Text>
          <View style={styles.organizerActions}>
            <TouchableOpacity
              testID="mute-all-btn"
              style={styles.orgBtn}
              onPress={onMuteAll}
            >
              <Ionicons
                name={meeting.all_muted ? "mic" : "mic-off"}
                size={18}
                color={meeting.all_muted ? colors.success : colors.error}
              />
              <Text style={styles.orgBtnText}>
                {meeting.all_muted ? "Unmute All" : "Mute All"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="private-talk-btn"
              style={styles.orgBtn}
              onPress={() => setShowPrivateTalk(true)}
            >
              <Ionicons name="people-circle" size={18} color={colors.gold} />
              <Text style={styles.orgBtnText}>Private Talk</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      )}

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          testID="leave-meeting-btn"
          style={styles.endBtn}
          onPress={onLeave}
        >
          <Ionicons name="exit-outline" size={22} color="#fff" />
          <Text style={styles.endBtnText}>{isOrganizer ? "End" : "Leave"}</Text>
        </TouchableOpacity>
      </View>

      {/* Private talk modal */}
      <Modal
        visible={showPrivateTalk}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPrivateTalk(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalEyebrow}>HOST ONLY · PRIVATE TALK</Text>
            <Text style={styles.modalTitle}>Pull aside for a side-bar</Text>
            <Text style={styles.modalNote}>
              Selected members will hear only each other. Others remain in the main room.
            </Text>

            <ScrollView style={{ maxHeight: 260, marginTop: spacing.md }}>
              {tiles
                .filter((t: any) => !t.is_organizer)
                .map((p: any) => {
                  const sel = selected.includes(p.user_id);
                  return (
                    <TouchableOpacity
                      key={p.user_id}
                      testID={`select-${p.user_id}`}
                      style={[styles.selectRow, sel && styles.selectRowActive]}
                      onPress={() => toggleSelect(p.user_id)}
                    >
                      <Avatar name={p.display_name} emoji={p.avatar} size={40} />
                      <Text style={[styles.selectName, sel && { color: colors.gold }]}>
                        {p.display_name}
                      </Text>
                      {sel && <Ionicons name="checkmark-circle" size={20} color={colors.gold} />}
                    </TouchableOpacity>
                  );
                })}
              {tiles.filter((t: any) => !t.is_organizer).length === 0 && (
                <Text style={styles.modalNote}>No other participants yet.</Text>
              )}
            </ScrollView>

            <TouchableOpacity
              testID="confirm-private-talk-btn"
              style={[styles.primaryBtn, selected.length === 0 && { opacity: 0.5 }]}
              onPress={onStartPrivateTalk}
              disabled={selected.length === 0}
            >
              <Text style={styles.primaryBtnText}>Start Private Talk</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPrivateTalk(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    paddingTop: 60, paddingBottom: 16,
    paddingHorizontal: spacing.lg,
    alignItems: "center", gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  liveDot: {
    position: "absolute", top: 56, right: 24,
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success,
  },
  headerEyebrow: { fontFamily: fonts.bodyMed, fontSize: 10, color: colors.gold, letterSpacing: 2 },
  headerTitle: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.text, marginTop: 2 },
  headerCode: { fontFamily: fonts.bodyMed, fontSize: 12, color: colors.textMuted, letterSpacing: 2, marginTop: 2 },
  countPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.goldDim, borderColor: colors.gold, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  countText: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 13 },
  privateBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.goldDim, padding: 10, marginHorizontal: spacing.md, marginTop: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold,
  },
  privateBannerText: { flex: 1, color: colors.text, fontFamily: fonts.bodyMed, fontSize: 12 },
  privateBannerLink: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 12 },
  grid: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
    padding: spacing.md, justifyContent: "center",
  },
  tile: {
    width: 150, height: 180, borderRadius: radius.lg,
    backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", padding: 12, gap: 8,
  },
  tileOrganizer: { borderColor: colors.gold },
  tilePrivate: {
    borderColor: colors.gold,
    backgroundColor: colors.goldDim,
  },
  tileName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text, marginTop: 4 },
  tileMetaRow: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 2 },
  organizerBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  organizerBadgeText: { fontFamily: fonts.bodyBold, fontSize: 9, color: "#0D0D0D", letterSpacing: 0.5 },
  micBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(50,205,50,0.15)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.success,
  },
  micBadgeMuted: { backgroundColor: "rgba(255,77,77,0.15)", borderColor: colors.error },
  organizerBar: {
    margin: spacing.md, padding: spacing.md,
    borderRadius: 999, backgroundColor: "rgba(26,26,26,0.8)",
    borderWidth: 1, borderColor: colors.goldDim,
  },
  organizerBarLabel: {
    fontFamily: fonts.bodyMed, fontSize: 10, color: colors.gold,
    letterSpacing: 2, textAlign: "center", marginBottom: 8,
  },
  organizerActions: { flexDirection: "row", gap: 8, justifyContent: "center" },
  orgBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.surface2,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border,
  },
  orgBtnText: { color: colors.text, fontFamily: fonts.bodyMed, fontSize: 13 },
  bottomBar: { paddingHorizontal: spacing.lg, paddingBottom: 36, paddingTop: 8, alignItems: "center" },
  endBtn: {
    flexDirection: "row", gap: 8, alignItems: "center",
    backgroundColor: colors.error,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999,
  },
  endBtnText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.surface1, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing.lg, paddingBottom: 36,
    borderTopWidth: 1, borderColor: colors.goldDim,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.md,
  },
  modalEyebrow: { fontFamily: fonts.bodyMed, fontSize: 11, color: colors.gold, letterSpacing: 2 },
  modalTitle: { fontFamily: fonts.serifBold, fontSize: 24, color: colors.text, marginTop: 4 },
  modalNote: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 18 },
  selectRow: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 10,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginVertical: 4,
  },
  selectRowActive: { borderColor: colors.gold, backgroundColor: colors.goldDim },
  selectName: { flex: 1, fontFamily: fonts.bodyMed, fontSize: 15, color: colors.text },
  primaryBtn: {
    backgroundColor: colors.gold, paddingVertical: 16, borderRadius: 999,
    alignItems: "center", marginTop: spacing.md,
  },
  primaryBtnText: { color: "#0D0D0D", fontFamily: fonts.bodyBold, fontSize: 15 },
  modalClose: { alignSelf: "center", marginTop: 12, padding: 8 },
  modalCloseText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
});
