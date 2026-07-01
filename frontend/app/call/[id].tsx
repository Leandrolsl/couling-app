import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, spacing } from "@/src/theme";
import Avatar from "@/src/components/Avatar";

export default function CallScreen() {
  const router = useRouter();
  const { type, name, emoji } = useLocalSearchParams<{
    id: string;
    type: "voice" | "video";
    name?: string;
    emoji?: string;
  }>();

  const isVideo = type === "video";
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(isVideo);
  const [videoOff, setVideoOff] = useState(false);
  const [connected, setConnected] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Connect after 2.5s
    const t = setTimeout(() => setConnected(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!connected) return;
    const i = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [connected]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const onEnd = () => router.back();

  return (
    <View style={styles.root} testID="call-screen">
      <LinearGradient
        colors={["rgba(212,164,55,0.18)", "rgba(13,13,13,0.4)", "#0D0D0D"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.top}>
        <Text style={styles.eyebrow}>{isVideo ? "VIDEO CALL" : "VOICE CALL"} · ENCRYPTED</Text>
        <Text style={styles.name}>{name || "Couling User"}</Text>
        <Text style={styles.status}>
          {connected ? fmt(seconds) : "Ringing…"}
        </Text>
        <View style={styles.lockRow}>
          <Ionicons name="lock-closed" size={11} color={colors.gold} />
          <Text style={styles.lockText}>Number hidden · E2E</Text>
        </View>
      </View>

      <View style={styles.center}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.pulseRing,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.05] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
            },
          ]}
        />
        <View style={styles.avatarWrap}>
          <Avatar name={name || "?"} emoji={emoji} size={140} />
        </View>
        {isVideo && !videoOff && (
          <View style={styles.selfTile}>
            <Ionicons name="person" size={36} color={colors.gold} />
            <Text style={styles.selfText}>You</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <ControlBtn
          testID="mute-btn"
          icon={muted ? "mic-off" : "mic"}
          active={muted}
          onPress={() => setMuted(!muted)}
        />
        {isVideo && (
          <ControlBtn
            testID="video-toggle-btn"
            icon={videoOff ? "videocam-off" : "videocam"}
            active={videoOff}
            onPress={() => setVideoOff(!videoOff)}
          />
        )}
        <ControlBtn
          testID="speaker-btn"
          icon={speaker ? "volume-high" : "volume-low"}
          active={speaker}
          onPress={() => setSpeaker(!speaker)}
        />
        <TouchableOpacity
          testID="end-call-btn"
          onPress={onEnd}
          style={styles.endBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ControlBtn({ icon, active, onPress, testID }: any) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.ctrlBtn, active && styles.ctrlBtnActive]}
    >
      <Ionicons name={icon} size={22} color={active ? "#0D0D0D" : colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: "space-between" },
  top: { paddingTop: 80, paddingHorizontal: spacing.lg, alignItems: "center" },
  eyebrow: { fontFamily: fonts.bodyMed, fontSize: 11, color: colors.gold, letterSpacing: 2 },
  name: { fontFamily: fonts.serifBold, fontSize: 36, color: colors.text, marginTop: 8, letterSpacing: -0.5 },
  status: { fontFamily: fonts.body, fontSize: 18, color: colors.textMuted, marginTop: 6 },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  lockText: { color: colors.gold, fontFamily: fonts.bodyMed, fontSize: 11, letterSpacing: 1.5 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  pulseRing: {
    position: "absolute",
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 2, borderColor: colors.gold,
  },
  avatarWrap: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: colors.surface1,
    borderWidth: 2, borderColor: colors.gold,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 30, elevation: 12,
  },
  selfTile: {
    position: "absolute", top: 20, right: 20,
    width: 100, height: 130, borderRadius: 16,
    backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.gold,
    alignItems: "center", justifyContent: "center",
  },
  selfText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  controls: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    gap: 14, paddingBottom: 64, paddingTop: 16,
  },
  ctrlBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  ctrlBtnActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  endBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.error, alignItems: "center", justifyContent: "center",
    shadowColor: colors.error, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 20, elevation: 10,
  },
});
