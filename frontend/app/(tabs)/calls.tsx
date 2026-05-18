import React, { useCallback, useState } from "react";
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
import { calls } from "@/src/api/client";

type Call = {
  id: string;
  type: "voice" | "video";
  direction: "outgoing" | "incoming";
  display_name: string;
  avatar: string;
  created_at: string;
};

export default function CallsTab() {
  const router = useRouter();
  const [items, setItems] = useState<Call[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data: any = await calls.list();
      setItems(data.calls || []);
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
          <Text style={styles.title}>Calls</Text>
        </View>
        <TouchableOpacity
          testID="new-call-btn"
          onPress={() => router.push("/(tabs)/contacts")}
          style={styles.headerBtn}
        >
          <Ionicons name="call-outline" size={20} color={colors.gold} />
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
          <View style={styles.empty} testID="empty-calls">
            <View style={styles.emptyIconWrap}>
              <Ionicons name="call" size={40} color={colors.gold} />
            </View>
            <Text style={styles.emptyTitle}>No calls yet</Text>
            <Text style={styles.emptySub}>
              Voice and video calls placed through Couling never reveal phone numbers.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isVideo = item.type === "video";
          const isMissed = false;
          return (
            <View style={styles.row}>
              <Avatar name={item.display_name} emoji={item.avatar} size={48} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.name}>{item.display_name}</Text>
                <View style={styles.metaRow}>
                  <Ionicons
                    name={item.direction === "outgoing" ? "arrow-up-outline" : "arrow-down-outline"}
                    size={12}
                    color={isMissed ? colors.error : colors.gold}
                  />
                  <Text style={styles.meta}>
                    {item.direction === "outgoing" ? "Outgoing" : "Incoming"} · {isVideo ? "Video" : "Voice"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                testID={`callback-${item.id}`}
                style={styles.callBtn}
                onPress={() => router.push({
                  pathname: "/call/[id]",
                  params: { id: item.id, type: item.type, name: item.display_name, emoji: item.avatar },
                })}
              >
                <Ionicons name={isVideo ? "videocam" : "call"} size={18} color={colors.gold} />
              </TouchableOpacity>
            </View>
          );
        }}
      />
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
  row: {
    flexDirection: "row", alignItems: "center", paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  callBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.goldDim, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.gold,
  },
  empty: { alignItems: "center", paddingTop: 64 },
  emptyIconWrap: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.goldDim,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  emptyTitle: { fontFamily: fonts.serifBold, fontSize: 24, color: colors.text },
  emptySub: {
    fontFamily: fonts.body, fontSize: 14, color: colors.textMuted,
    textAlign: "center", marginTop: 8, lineHeight: 20, paddingHorizontal: 32,
  },
});
