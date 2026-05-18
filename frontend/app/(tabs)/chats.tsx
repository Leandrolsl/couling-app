import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius, ASSETS } from "@/src/theme";
import Screen from "@/src/components/Screen";
import Avatar from "@/src/components/Avatar";
import { listChats } from "@/src/api/supa";

type Chat = {
  id: string;
  display_name: string;
  avatar: string;
  last_message: string;
  last_at: string;
};

export default function ChatsTab() {
  const router = useRouter();
  const [items, setItems] = useState<Chat[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listChats();
      setItems(data as any);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Screen edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PRIVATE LINE</Text>
          <Text style={styles.title}>Chats</Text>
        </View>
        <TouchableOpacity
          testID="new-chat-btn"
          onPress={() => router.push("/(tabs)/contacts")}
          style={styles.headerBtn}
        >
          <Ionicons name="create-outline" size={20} color={colors.gold} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
        ListEmptyComponent={
          <View style={styles.empty} testID="empty-chats">
            <Image source={{ uri: ASSETS.emptyChats }} style={styles.emptyImg} resizeMode="contain" />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySub}>
              Add someone from your Circle to begin a private, number-less chat.
            </Text>
            <TouchableOpacity
              testID="empty-go-contacts"
              onPress={() => router.push("/(tabs)/contacts")}
              style={styles.emptyCta}
            >
              <Text style={styles.emptyCtaText}>Open Circle</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.gold} />
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`chat-row-${item.id}`}
            onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id, name: item.display_name, emoji: item.avatar } })}
            style={styles.row}
            activeOpacity={0.7}
          >
            <Avatar name={item.display_name} emoji={item.avatar} size={52} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.name} numberOfLines={1}>{item.display_name}</Text>
              <Text style={styles.last} numberOfLines={1}>
                {item.last_message || "Start the conversation"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  eyebrow: {
    fontFamily: fonts.bodyMed, fontSize: 11,
    color: colors.gold, letterSpacing: 2,
  },
  title: {
    fontFamily: fonts.serifBold, fontSize: 36,
    color: colors.text, letterSpacing: -1, marginTop: 4,
  },
  headerBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.goldDim,
    alignItems: "center", justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  last: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, marginTop: 2 },
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
});
