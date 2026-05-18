import React from "react";
import { AppState } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { colors, fonts } from "@/src/theme";
import { heartbeat } from "@/src/api/supa";

function TabBg() {
  return (
    <BlurView
      intensity={Platform.OS === "ios" ? 50 : 80}
      tint="dark"
      style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(13,13,13,0.85)" }]}
    />
  );
}

export default function TabsLayout() {
  // Online/offline heartbeat — updates profiles.is_online + last_seen as user
  // foregrounds/backgrounds the app.
  React.useEffect(() => {
    heartbeat(true).catch(() => {});
    const sub = AppState.addEventListener("change", (s) => {
      heartbeat(s === "active").catch(() => {});
    });
    const tick = setInterval(() => heartbeat(true).catch(() => {}), 45_000);
    return () => {
      sub.remove();
      clearInterval(tick);
      heartbeat(false).catch(() => {});
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarBackground: () => <TabBg />,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopColor: "rgba(255,255,255,0.05)",
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodyMed, fontSize: 11, letterSpacing: 0.5 },
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="chatbubbles" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: "Calls",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="call" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: "Meetings",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="people" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: "Circle",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="lock-closed" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="person" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ icon, color, focused }: any) {
  return (
    <View style={{ alignItems: "center" }}>
      <Ionicons name={icon} size={22} color={color} />
      {focused && (
        <View
          style={{
            width: 4, height: 4, borderRadius: 2,
            backgroundColor: colors.gold, marginTop: 2,
          }}
        />
      )}
    </View>
  );
}
