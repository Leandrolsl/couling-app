import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { RTCView } from "react-native-webrtc";
import { colors, fonts, spacing } from "@/src/theme";
import Avatar from "@/src/components/Avatar";
import { CallManager } from "./CallManager";
import { updateCallStatus } from "@/src/api/supa";
import { supabase } from "@/src/lib/supabase";

type Phase = "incoming" | "connecting" | "connected" | "ended";

export default function CallStage() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string; type: "voice" | "video"; name?: string; emoji?: string; incoming?: string;
  }>();
  const callId = String(params.id);
  const isVideo = params.type === "video";
  const isIncoming = params.incoming === "1";

  const [phase, setPhase] = useState<Phase>(isIncoming ? "incoming" : "connecting");
  const [local, setLocal] = useState<any>(null);
  const [remote, setRemote] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [front, setFront] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const mgr = useRef<CallManager | null>(null);
  const endedRef = useRef(false);

  const begin = async (isCaller: boolean) => {
    setPhase("connecting");
    const m = new CallManager(callId, isCaller, isVideo, {
      onLocalStream: (s) => setLocal(s),
      onRemoteStream: (s) => { setRemote(s); setPhase("connected"); },
      onState: (st) => { if (st === "unsupported") { /* web */ } },
      onEnded: () => end(false),
    });
    mgr.current = m;
    try { await m.start(); } catch (e) { end(true); }
  };

  const end = (updateRow: boolean) => {
    if (endedRef.current) return;
    endedRef.current = true;
    try { mgr.current?.hangup(); } catch {}
    if (updateRow) updateCallStatus(callId, "ended").catch(() => {});
    setPhase("ended");
    router.back();
  };

  const accept = async () => {
    try { await updateCallStatus(callId, "accepted"); } catch {}
    begin(false);
  };
  const decline = async () => {
    try { await updateCallStatus(callId, "declined"); } catch {}
    router.back();
  };

  // Outgoing: auto-start as caller
  useEffect(() => {
    if (!isIncoming) begin(true);
    return () => { try { mgr.current?.hangup(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Caller: detect decline / remote end via calls row status
  useEffect(() => {
    if (isIncoming) return;
    const ch = supabase
      .channel(`call-status:${callId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` },
        (p: any) => {
          const st = p.new?.status;
          if (st === "declined" || st === "ended") end(false);
        })
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Duration timer
  useEffect(() => {
    if (phase !== "connected") return;
    const i = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [phase]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const onMute = () => setMuted(mgr.current?.toggleMute() ?? false);
  const onVideo = () => setVideoOff(mgr.current?.toggleVideo() ?? false);
  const onFlip = () => { mgr.current?.switchCamera(); setFront((f) => !f); };

  const showRemoteVideo = isVideo && remote && phase === "connected";
  const showLocalVideo = isVideo && local && !videoOff;

  return (
    <View style={styles.root} testID="call-screen">
      {showRemoteVideo ? (
        <RTCView streamURL={remote.toURL()} objectFit="cover" style={StyleSheet.absoluteFill} />
      ) : (
        <LinearGradient
          colors={["rgba(212,164,55,0.18)", "rgba(13,13,13,0.4)", "#0D0D0D"]}
          style={StyleSheet.absoluteFill}
        />
      )}

      <View style={styles.top}>
        <Text style={styles.eyebrow}>
          {(isVideo ? "VIDEO" : "VOICE") + " CALL · ENCRYPTED"}
        </Text>
        <Text style={styles.name}>{params.name || "Couling User"}</Text>
        <Text style={styles.status}>
          {phase === "incoming" ? "Incoming call…"
            : phase === "connected" ? fmt(seconds)
            : "Ringing…"}
        </Text>
      </View>

      {!showRemoteVideo && (
        <View style={styles.center}>
          <View style={styles.avatarWrap}>
            <Avatar name={params.name || "?"} emoji={params.emoji} size={140} />
          </View>
        </View>
      )}

      {showLocalVideo && (
        <View style={styles.selfTile}>
          <RTCView streamURL={local.toURL()} objectFit="cover" mirror={front} style={{ flex: 1, borderRadius: 16 }} />
        </View>
      )}

      {phase === "incoming" ? (
        <View style={styles.incomingRow}>
          <TouchableOpacity testID="decline-call-btn" onPress={decline} style={[styles.roundBtn, styles.declineBtn]}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity testID="accept-call-btn" onPress={accept} style={[styles.roundBtn, styles.acceptBtn]}>
            <Ionicons name={isVideo ? "videocam" : "call"} size={28} color="#0D0D0D" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.controls}>
          <ControlBtn testID="mute-btn" icon={muted ? "mic-off" : "mic"} active={muted} onPress={onMute} />
          {isVideo && (
            <ControlBtn testID="video-toggle-btn" icon={videoOff ? "videocam-off" : "videocam"} active={videoOff} onPress={onVideo} />
          )}
          {isVideo && (
            <ControlBtn testID="switch-camera-btn" icon="camera-reverse" active={false} onPress={onFlip} />
          )}
          <TouchableOpacity testID="end-call-btn" onPress={() => end(true)} style={styles.endBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function ControlBtn({ icon, active, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.7}
      style={[styles.ctrlBtn, active && styles.ctrlBtnActive]}>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarWrap: {
    width: 160, height: 160, borderRadius: 80, backgroundColor: colors.surface1,
    borderWidth: 2, borderColor: colors.gold, alignItems: "center", justifyContent: "center",
  },
  selfTile: {
    position: "absolute", top: 70, right: 20, width: 110, height: 150,
    borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.surface1,
  },
  controls: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    gap: 14, paddingBottom: 64, paddingTop: 16,
  },
  incomingRow: {
    flexDirection: "row", justifyContent: "space-evenly", alignItems: "center",
    paddingBottom: 72, paddingTop: 16,
  },
  roundBtn: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  acceptBtn: { backgroundColor: colors.gold },
  declineBtn: { backgroundColor: colors.error },
  ctrlBtn: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  ctrlBtnActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  endBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.error,
    alignItems: "center", justifyContent: "center",
  },
});
