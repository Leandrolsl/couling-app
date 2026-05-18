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
import Avatar from "@/src/components/Avatar";
import GoldButton from "@/src/components/GoldButton";
import HiddenNumberBadge from "@/src/components/HiddenNumberBadge";
import { contacts as cAPI, chats as chAPI, calls as callAPI } from "@/src/api/client";
import { listContacts as supaListContacts, addContactByPhone, startChatWithContact } from "@/src/api/supa";

export default function ContactsTab() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [phone, setPhone] = useState("+1");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await supaListContacts();
      setItems(list);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onAdd = async () => {
    if (!phone.trim() || phone.replace(/\D/g, "").length < 6) return Alert.alert("Couling", "Enter a valid phone");
    if (!displayName.trim()) return Alert.alert("Couling", "Give them a display name");
    setLoading(true);
    try {
      await addContactByPhone(phone.trim(), displayName.trim());
      setShowAdd(false);
      setPhone("+1"); setDisplayName("");
      load();
    } catch (e: any) {
      Alert.alert("Couling", e.message);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (item: any) => {
    try {
      const chatId = await startChatWithContact(item.id);
      router.push({ pathname: "/chat/[id]", params: { id: chatId, name: item.display_name, emoji: item.avatar } });
    } catch (e: any) {
      Alert.alert("Couling", e.message);
    }
  };

  const startCall = async (item: any, type: "voice" | "video") => {
    try {
      const data: any = await callAPI.initiate(item.id, type);
      router.push({
        pathname: "/call/[id]",
        params: { id: data.call_id, type, name: item.display_name, emoji: item.avatar },
      });
    } catch (e: any) {
      Alert.alert("Couling", e.message);
    }
  };

  return (
    <Screen edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>YOUR CIRCLE</Text>
          <Text style={styles.title}>Contacts</Text>
        </View>
        <TouchableOpacity
          testID="add-contact-btn"
          onPress={() => setShowAdd(true)}
          style={styles.headerBtn}
        >
          <Ionicons name="person-add-outline" size={20} color={colors.gold} />
        </TouchableOpacity>
      </View>

      <View style={styles.privacyCard}>
        <Ionicons name="lock-closed" size={16} color={colors.gold} />
        <Text style={styles.privacyText}>
          Phone numbers are <Text style={{ color: colors.gold }}>never shown</Text> in your Circle. You only see display names.
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />
        }
        ListEmptyComponent={
          <View style={styles.empty} testID="empty-contacts">
            <Image source={{ uri: ASSETS.emptyContacts }} style={styles.emptyImg} resizeMode="contain" />
            <Text style={styles.emptyTitle}>Your Circle is empty</Text>
            <Text style={styles.emptySub}>
              Add someone by their phone number — once added, the number disappears forever.
            </Text>
            <TouchableOpacity
              testID="empty-add-btn"
              style={styles.emptyCta}
              onPress={() => setShowAdd(true)}
            >
              <Ionicons name="add" size={18} color={colors.gold} />
              <Text style={styles.emptyCtaText}>Add first contact</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row} testID={`contact-row-${item.id}`}>
            <View style={{ position: "relative" }}>
              <Avatar name={item.display_name} emoji={item.avatar} size={52} />
              {item.is_online && (
                <View style={styles.onlineDot} testID={`online-dot-${item.id}`} />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.name}>{item.display_name}</Text>
              <View style={{ marginTop: 4 }}>
                <HiddenNumberBadge />
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                testID={`message-${item.id}`}
                style={styles.iconBtn}
                onPress={() => startChat(item)}
              >
                <Ionicons name="chatbubble" size={16} color={colors.gold} />
              </TouchableOpacity>
              <TouchableOpacity
                testID={`voice-call-${item.id}`}
                style={styles.iconBtn}
                onPress={() => startCall(item, "voice")}
              >
                <Ionicons name="call" size={16} color={colors.gold} />
              </TouchableOpacity>
              <TouchableOpacity
                testID={`video-call-${item.id}`}
                style={styles.iconBtn}
                onPress={() => startCall(item, "video")}
              >
                <Ionicons name="videocam" size={16} color={colors.gold} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalEyebrow}>EXPAND CIRCLE</Text>
            <Text style={styles.modalTitle}>Add by phone number</Text>
            <Text style={styles.modalNote}>
              The number disappears the moment they're added. From then on, only their display name exists.
            </Text>

            <Text style={styles.label}>Phone</Text>
            <View style={styles.inputWrap}>
              <TextInput
                testID="add-phone-input"
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 000 000 0000"
                placeholderTextColor={colors.textDim}
                style={styles.input}
                keyboardType="phone-pad"
              />
            </View>

            <Text style={styles.label}>Display Name</Text>
            <View style={styles.inputWrap}>
              <TextInput
                testID="add-displayname-input"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="How you'll see them"
                placeholderTextColor={colors.textDim}
                style={styles.input}
                maxLength={32}
              />
            </View>

            <GoldButton
              testID="confirm-add-contact-btn"
              label="Add to Circle"
              onPress={onAdd}
              loading={loading}
              style={{ marginTop: spacing.lg }}
            />
            <TouchableOpacity onPress={() => setShowAdd(false)} style={styles.modalClose}>
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
  headerBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.goldDim,
    alignItems: "center", justifyContent: "center",
  },
  privacyCard: {
    flexDirection: "row", gap: 8, alignItems: "center",
    backgroundColor: colors.goldDim, marginHorizontal: spacing.lg,
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.gold,
  },
  privacyText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  row: {
    flexDirection: "row", alignItems: "center", paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  actions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.goldDim,
    alignItems: "center", justifyContent: "center",
  },
  empty: { alignItems: "center", paddingTop: 32 },
  emptyImg: { width: 200, height: 200, marginBottom: spacing.lg },
  emptyTitle: { fontFamily: fonts.serifBold, fontSize: 24, color: colors.text },
  emptySub: {
    fontFamily: fonts.body, fontSize: 14, color: colors.textMuted,
    textAlign: "center", marginTop: 8, lineHeight: 20, paddingHorizontal: 24,
  },
  emptyCta: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.goldDim, paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: radius.pill, marginTop: spacing.lg,
    borderWidth: 1, borderColor: colors.gold,
  },
  emptyCtaText: { color: colors.gold, fontFamily: fonts.bodyMed, fontSize: 14 },
  onlineDot: {
    position: "absolute",
    bottom: 0, right: 0,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2, borderColor: colors.bg,
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
  modalTitle: { fontFamily: fonts.serifBold, fontSize: 28, color: colors.text, marginTop: 4 },
  modalNote: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 18 },
  label: {
    fontFamily: fonts.bodyMed, fontSize: 11, color: colors.textMuted,
    letterSpacing: 1.5, textTransform: "uppercase", marginTop: spacing.lg, marginBottom: spacing.xs,
  },
  inputWrap: {
    backgroundColor: colors.surface2, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
    height: 56, justifyContent: "center",
  },
  input: { color: colors.text, fontFamily: fonts.bodyMed, fontSize: 16 },
  modalClose: { alignSelf: "center", marginTop: spacing.md, padding: 12 },
  modalCloseText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
});
