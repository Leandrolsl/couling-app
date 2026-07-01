import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Pressable,
  Animated as RNAnimated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { colors, fonts, spacing, radius } from "@/src/theme";
import Screen from "@/src/components/Screen";
import Avatar from "@/src/components/Avatar";
import HiddenNumberBadge from "@/src/components/HiddenNumberBadge";
import ConfirmDialog, { ConfirmAction } from "@/src/components/ConfirmDialog";
import {
  getMessages,
  sendMessage,
  deleteMessage as supaDeleteMessage,
  clearChat,
  setDisappearing as supaSetDisappearing,
  subscribeChatMessages,
  subscribePresence,
  getCurrentProfile,
} from "@/src/api/supa";
import { supabase } from "@/src/lib/supabase";

type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  text: string;
  created_at: string;
  hidden_for?: string[];
  deleted_for_all?: boolean;
  deleted_at?: string | null;
};

const TIMER_PRESETS = [
  { label: "Off", seconds: null as number | null, sub: "Keep messages forever" },
  { label: "24 hours", seconds: 86400, sub: "Auto-delete after a day" },
  { label: "7 days", seconds: 604800, sub: "Auto-delete after a week" },
  { label: "30 days", seconds: 2592000, sub: "Auto-delete after a month" },
];

function formatTimer(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.round(seconds / 86400)}d`;
  return `${Math.round(seconds / 604800)}w`;
}

export default function ChatScreen() {
  const router = useRouter();
  const { id, name, emoji } = useLocalSearchParams<{
    id: string;
    name?: string;
    emoji?: string;
  }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<any>(null);
  const [text, setText] = useState("");
  const [chatMeta, setChatMeta] = useState<any>(null);
  const [peerOnline, setPeerOnline] = useState(false);
  const [selected, setSelected] = useState<Message | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showTimerSheet, setShowTimerSheet] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [confirm, setConfirm] = useState<{
    title: string;
    message?: string;
    actions: ConfirmAction[];
  } | null>(null);
  const listRef = useRef<FlatList>(null);
  const swipeRefs = useRef<Map<string, Swipeable>>(new Map());

  const closeAllSwipes = useCallback(() => {
    swipeRefs.current.forEach((r) => r?.close());
  }, []);

  const load = async () => {
    try {
      const [profile, msgData] = await Promise.all([
        getCurrentProfile(),
        getMessages(id as string),
      ]);
      setMe(profile);
      setMessages(msgData.messages || []);
      setChatMeta(msgData.chat || null);
    } catch (e: any) {
      Alert.alert("Couling", e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Realtime: subscribe to message inserts/updates
  useEffect(() => {
    if (!id) return;
    const ch = subscribeChatMessages(
      id as string,
      (m) => {
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          // Replace optimistic temp message if text matches & sender is me
          const tempIdx = prev.findIndex(
            (x) => x.id.startsWith("temp_") && x.sender_id === m.sender_id && x.text === m.text,
          );
          if (tempIdx >= 0) {
            const next = prev.slice();
            next[tempIdx] = m;
            return next;
          }
          return [...prev, m];
        });
      },
      (m) => {
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
      },
    );
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id]);

  // Presence: track peer online status via realtime channel
  useEffect(() => {
    if (!id || !me?.id) return;
    const ch = subscribePresence(
      id as string,
      { user_id: me.id, display_name: me.name || "Guest" },
      (state) => {
        const otherKeys = Object.keys(state).filter((k) => k !== me.id);
        setPeerOnline(otherKeys.length > 0);
      },
    );
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, me?.id]);

  const onSend = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    const tempId = `temp_${Date.now()}`;
    const optim: Message = {
      id: tempId,
      chat_id: id as string,
      sender_id: me?.id || "",
      text: t,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optim]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const sent = await sendMessage(id as string, t);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? sent : m)));
    } catch (e: any) {
      Alert.alert("Couling", e.message);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const deleteForMe = async (msg: Message) => {
    setSelected(null);
    closeAllSwipes();
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    if (msg.id.startsWith("temp_")) return;
    try {
      await supaDeleteMessage(id as string, msg.id, "me");
    } catch (e: any) {
      Alert.alert("Couling", e.message);
      load();
    }
  };

  const deleteForEveryone = async (msg: Message) => {
    setSelected(null);
    closeAllSwipes();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, deleted_for_all: true, text: "" } : m,
      ),
    );
    if (msg.id.startsWith("temp_")) return;
    try {
      await supaDeleteMessage(id as string, msg.id, "everyone");
    } catch (e: any) {
      Alert.alert("Couling", e.message);
      load();
    }
  };

  const copyText = async (msg: Message) => {
    setSelected(null);
    try {
      await Clipboard.setStringAsync(msg.text || "");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {}
  };

  const onClearChat = async () => {
    setShowHeaderMenu(false);
    setConfirm({
      title: "Clear conversation?",
      message:
        "All messages will be removed from your side. The other person still sees their copy unless they also clear.",
      actions: [
        {
          label: "Clear for me",
          style: "destructive",
          testID: "confirm-clear-yes",
          onPress: async () => {
            setConfirm(null);
            try {
              await clearChat(id as string);
              setMessages([]);
            } catch (e: any) {
              Alert.alert("Couling", e.message);
            }
          },
        },
        { label: "Cancel", style: "cancel", testID: "confirm-clear-no", onPress: () => setConfirm(null) },
      ],
    });
  };

  const setDisappearing = async (secs: number | null) => {
    try {
      await supaSetDisappearing(id as string, secs);
      setChatMeta((c: any) => ({ ...(c || {}), disappearing_seconds: secs }));
      setShowTimerSheet(false);
      setCustomMinutes("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (e: any) {
      Alert.alert("Couling", e.message);
    }
  };

  const applyCustomTimer = () => {
    const mins = parseInt(customMinutes, 10);
    if (!mins || mins < 1) {
      Alert.alert("Couling", "Enter minutes (1 or more)");
      return;
    }
    setDisappearing(mins * 60);
  };

  const onLongPress = (msg: Message) => {
    if (msg.deleted_for_all) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelected(msg);
  };

  const renderRightActions = (_msg: Message) => (progress: any) => {
    const scale = progress.interpolate({
      inputRange: [0, 1], outputRange: [0.6, 1], extrapolate: "clamp",
    });
    return (
      <RNAnimated.View style={[styles.swipeAction, { transform: [{ scale }] }]}>
        <View style={styles.swipeActionInner}>
          <Ionicons name="trash" size={20} color="#fff" />
          <Text style={styles.swipeActionText}>Delete</Text>
        </View>
      </RNAnimated.View>
    );
  };

  const timerLabel = formatTimer(chatMeta?.disappearing_seconds);
  const canDeleteForEveryone = (m: Message) => m.sender_id === me?.id && !m.deleted_for_all;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Avatar name={name || "?"} emoji={emoji} size={42} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.headerName} numberOfLines={1}>{name || "Couling User"}</Text>
              {peerOnline && (
                <View testID="peer-online-dot" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
              )}
            </View>
            <View style={styles.headerSubRow}>
              <HiddenNumberBadge />
              {timerLabel && (
                <View style={styles.timerChip} testID="header-timer-chip">
                  <Ionicons name="timer-outline" size={10} color={colors.gold} />
                  <Text style={styles.timerChipText}>{timerLabel}</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            testID="header-menu-btn"
            onPress={() => setShowHeaderMenu(true)}
            style={styles.iconBtn}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.gold} />
          </TouchableOpacity>
        </View>

        <View style={styles.privacyBar}>
          <Ionicons name="shield-checkmark" size={12} color={colors.gold} />
          <Text style={styles.privacyText}>
            {timerLabel
              ? `Messages disappear after ${timerLabel} · End-to-end secured`
              : "End-to-end secured. Number hidden."}
          </Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.lg }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="lock-closed" size={28} color={colors.gold} />
              <Text style={styles.emptyText}>
                Say hello.{"\n"}This conversation is private and secured.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === me?.id;
            const isDeleted = !!item.deleted_for_all;
            return (
              <Swipeable
                ref={(r) => {
                  if (r) swipeRefs.current.set(item.id, r);
                  else swipeRefs.current.delete(item.id);
                }}
                renderRightActions={isDeleted ? undefined : renderRightActions(item)}
                onSwipeableOpen={() => {
                  const actions: ConfirmAction[] = mine
                    ? [
                        {
                          label: "Delete for everyone",
                          style: "destructive",
                          testID: "confirm-swipe-everyone",
                          onPress: () => {
                            setConfirm(null);
                            deleteForEveryone(item);
                          },
                        },
                        {
                          label: "Delete for me",
                          testID: "confirm-swipe-me",
                          onPress: () => {
                            setConfirm(null);
                            deleteForMe(item);
                          },
                        },
                        {
                          label: "Cancel",
                          style: "cancel",
                          testID: "confirm-swipe-cancel",
                          onPress: () => {
                            setConfirm(null);
                            closeAllSwipes();
                          },
                        },
                      ]
                    : [
                        {
                          label: "Delete for me",
                          style: "destructive",
                          testID: "confirm-swipe-me",
                          onPress: () => {
                            setConfirm(null);
                            deleteForMe(item);
                          },
                        },
                        {
                          label: "Cancel",
                          style: "cancel",
                          testID: "confirm-swipe-cancel",
                          onPress: () => {
                            setConfirm(null);
                            closeAllSwipes();
                          },
                        },
                      ];
                  setConfirm({
                    title: "Delete message?",
                    message: mine
                      ? "Choose how to delete this message."
                      : "Delete this message from your view?",
                    actions,
                  });
                }}
                friction={2}
                rightThreshold={48}
                overshootRight={false}
              >
                <Pressable
                  testID={`message-${item.id}`}
                  onLongPress={() => onLongPress(item)}
                  delayLongPress={280}
                  style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}
                >
                  <View
                    style={[
                      styles.bubble,
                      mine ? styles.bubbleMine : styles.bubbleTheirs,
                      isDeleted && styles.bubbleDeleted,
                    ]}
                  >
                    {isDeleted ? (
                      <View style={styles.deletedRow}>
                        <Ionicons name="ban" size={13} color={colors.textDim} />
                        <Text style={styles.deletedText}>This message was deleted</Text>
                      </View>
                    ) : (
                      <Text style={styles.bubbleText}>{item.text}</Text>
                    )}
                  </View>
                </Pressable>
              </Swipeable>
            );
          }}
        />

        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <TextInput
              testID="message-input"
              value={text}
              onChangeText={setText}
              placeholder={
                timerLabel
                  ? `Disappearing in ${timerLabel}…`
                  : "Whisper something private..."
              }
              placeholderTextColor={colors.textDim}
              style={styles.input}
              multiline
              maxLength={2000}
            />
          </View>
          <TouchableOpacity
            testID="send-btn"
            style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]}
            onPress={onSend}
            disabled={!text.trim()}
          >
            <Ionicons name="send" size={18} color="#0D0D0D" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Long-press action sheet */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.actionBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.actionSheet} onPress={() => {}}>
            <View style={styles.actionHandle} />
            <Text style={styles.actionEyebrow}>MESSAGE ACTIONS</Text>
            <ActionItem
              testID="action-copy"
              icon="copy-outline"
              label="Copy text"
              onPress={() => selected && copyText(selected)}
            />
            <ActionItem
              testID="action-delete-me"
              icon="trash-outline"
              label="Delete for me"
              danger
              onPress={() => selected && deleteForMe(selected)}
            />
            {selected && canDeleteForEveryone(selected) && (
              <ActionItem
                testID="action-delete-everyone"
                icon="flame-outline"
                label="Delete for everyone"
                danger
                onPress={() => deleteForEveryone(selected)}
              />
            )}
            <TouchableOpacity onPress={() => setSelected(null)} style={styles.actionCancel}>
              <Text style={styles.actionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Header dropdown menu */}
      <Modal
        visible={showHeaderMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHeaderMenu(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setShowHeaderMenu(false)}>
          <View style={styles.menuCard}>
            <MenuItem
              testID="menu-disappearing"
              icon="timer-outline"
              label="Disappearing messages"
              hint={timerLabel ? `Currently ${timerLabel}` : "Off"}
              onPress={() => {
                setShowHeaderMenu(false);
                setShowTimerSheet(true);
              }}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              testID="menu-clear"
              icon="trash-bin-outline"
              label="Clear conversation"
              hint="Remove all messages from your side"
              danger
              onPress={onClearChat}
            />
          </View>
        </Pressable>
      </Modal>

      {/* Disappearing-timer bottom sheet */}
      <Modal
        visible={showTimerSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTimerSheet(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalEyebrow}>EPHEMERAL MODE</Text>
            <Text style={styles.modalTitle}>Disappearing messages</Text>
            <Text style={styles.modalNote}>
              Messages will be auto-deleted from this conversation after the timer expires —
              for everyone.
            </Text>

            {TIMER_PRESETS.map((p) => {
              const active = (chatMeta?.disappearing_seconds || null) === p.seconds;
              return (
                <TouchableOpacity
                  key={p.label}
                  testID={`timer-${p.seconds || "off"}`}
                  style={[styles.timerRow, active && styles.timerRowActive]}
                  onPress={() => setDisappearing(p.seconds)}
                >
                  <View
                    style={[
                      styles.radio,
                      active && { borderColor: colors.gold, backgroundColor: colors.gold },
                    ]}
                  >
                    {active && <Ionicons name="checkmark" size={12} color="#0D0D0D" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.timerLabel, active && { color: colors.gold }]}>
                      {p.label}
                    </Text>
                    <Text style={styles.timerSub}>{p.sub}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={styles.customRow}>
              <Text style={styles.customLabel}>Custom</Text>
              <View style={styles.customInputWrap}>
                <TextInput
                  testID="custom-minutes-input"
                  value={customMinutes}
                  onChangeText={(v) => setCustomMinutes(v.replace(/\D/g, ""))}
                  placeholder="0"
                  placeholderTextColor={colors.textDim}
                  keyboardType="number-pad"
                  style={styles.customInput}
                  maxLength={6}
                />
                <Text style={styles.customUnit}>minutes</Text>
              </View>
              <TouchableOpacity
                testID="apply-custom-timer"
                style={[styles.applyBtn, !customMinutes && { opacity: 0.5 }]}
                onPress={applyCustomTimer}
                disabled={!customMinutes}
              >
                <Text style={styles.applyBtnText}>Set</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setShowTimerSheet(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.title || ""}
        message={confirm?.message}
        actions={confirm?.actions || []}
        onClose={() => {
          setConfirm(null);
          closeAllSwipes();
        }}
      />
    </Screen>
  );
}

function ActionItem({ icon, label, onPress, danger, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={styles.actionItem} onPress={onPress}>
      <View style={[styles.actionIcon, danger && { backgroundColor: "rgba(255,77,77,0.12)" }]}>
        <Ionicons name={icon} size={18} color={danger ? colors.error : colors.gold} />
      </View>
      <Text style={[styles.actionLabel, danger && { color: colors.error }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function MenuItem({ icon, label, hint, onPress, danger, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon} size={18} color={danger ? colors.error : colors.gold} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, danger && { color: colors.error }]}>{label}</Text>
        {hint && <Text style={styles.menuHint}>{hint}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  headerName: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  headerSubRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  timerChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: colors.goldDim, paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 10, borderWidth: 1, borderColor: colors.gold,
  },
  timerChipText: {
    color: colors.gold, fontFamily: fonts.bodyMed,
    fontSize: 10, letterSpacing: 0.5,
  },
  privacyBar: {
    flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center",
    paddingVertical: 8, backgroundColor: colors.goldDim,
  },
  privacyText: { fontFamily: fonts.body, fontSize: 11, color: colors.gold, letterSpacing: 0.5 },
  bubbleRow: { flexDirection: "row", marginVertical: 4 },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  bubble: { maxWidth: "78%", padding: 12 },
  bubbleMine: {
    backgroundColor: colors.goldDim,
    borderWidth: 1, borderColor: colors.gold,
    borderTopRightRadius: 4, borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  bubbleTheirs: {
    backgroundColor: colors.surface1,
    borderTopLeftRadius: 4, borderTopRightRadius: 20,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  bubbleDeleted: {
    backgroundColor: "transparent",
    borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
  },
  bubbleText: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  deletedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  deletedText: {
    color: colors.textDim, fontFamily: fonts.body, fontSize: 13,
    fontStyle: "italic" as const,
  },
  swipeAction: {
    justifyContent: "center", alignItems: "flex-end",
    paddingHorizontal: spacing.md, marginVertical: 4,
  },
  swipeActionInner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.error,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16,
  },
  swipeActionText: { color: "#fff", fontFamily: fonts.bodyMed, fontSize: 13 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: {
    fontFamily: fonts.body, fontSize: 14, color: colors.textMuted,
    textAlign: "center", lineHeight: 20,
  },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    padding: spacing.md, paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  inputWrap: {
    flex: 1, backgroundColor: colors.surface1, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
    paddingVertical: 10, minHeight: 44, maxHeight: 120, justifyContent: "center",
  },
  input: { color: colors.text, fontFamily: fonts.body, fontSize: 15 },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.gold, alignItems: "center", justifyContent: "center",
  },
  actionBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  actionSheet: {
    backgroundColor: colors.surface1, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing.lg, paddingBottom: 36,
    borderTopWidth: 1, borderColor: colors.goldDim,
  },
  actionHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.md,
  },
  actionEyebrow: {
    fontFamily: fonts.bodyMed, fontSize: 11, color: colors.gold,
    letterSpacing: 2, marginBottom: spacing.md,
  },
  actionItem: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  actionIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.goldDim,
    alignItems: "center", justifyContent: "center",
  },
  actionLabel: { fontFamily: fonts.bodyMed, fontSize: 15, color: colors.text },
  actionCancel: { alignSelf: "center", padding: 14, marginTop: spacing.sm },
  actionCancelText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  menuCard: {
    position: "absolute", top: 90, right: 16,
    backgroundColor: colors.surface1, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.goldDim,
    minWidth: 260, paddingVertical: 6,
  },
  menuItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  menuLabel: { fontFamily: fonts.bodyMed, fontSize: 14, color: colors.text },
  menuHint: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: spacing.md },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
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
  modalTitle: { fontFamily: fonts.serifBold, fontSize: 26, color: colors.text, marginTop: 4 },
  modalNote: {
    fontFamily: fonts.body, fontSize: 13, color: colors.textMuted,
    marginTop: 6, marginBottom: spacing.md, lineHeight: 18,
  },
  timerRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginVertical: 4,
  },
  timerRowActive: { borderColor: colors.gold, backgroundColor: colors.goldDim },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.borderStrong,
    alignItems: "center", justifyContent: "center",
  },
  timerLabel: { fontFamily: fonts.bodyMed, fontSize: 15, color: colors.text },
  timerSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  customRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.md,
    paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  customLabel: { fontFamily: fonts.bodyMed, fontSize: 13, color: colors.textMuted, width: 60 },
  customInputWrap: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.surface2, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, height: 44,
  },
  customInput: {
    flex: 1, color: colors.text, fontFamily: fonts.bodyMed, fontSize: 16,
  },
  customUnit: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  applyBtn: {
    backgroundColor: colors.gold, paddingHorizontal: 16, height: 44,
    borderRadius: radius.md, alignItems: "center", justifyContent: "center",
  },
  applyBtnText: { color: "#0D0D0D", fontFamily: fonts.bodyBold, fontSize: 13 },
  modalClose: { alignSelf: "center", marginTop: spacing.md, padding: 12 },
  modalCloseText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
});
