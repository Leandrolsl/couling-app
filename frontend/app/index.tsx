import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, spacing, ASSETS } from "@/src/theme";
import GoldButton from "@/src/components/GoldButton";
import { supabase } from "@/src/lib/supabase";
import { getCurrentProfile } from "@/src/api/supa";

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const done = () => { if (!cancelled) setChecking(false); };
    // Hard ceiling: never let the session probe block the UI for >2.5s.
    const fallback = setTimeout(done, 2500);

    (async () => {
      try {
        const sessionProbe = supabase.auth.getSession();
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
        const result: any = await Promise.race([sessionProbe, timeout]);
        const session = result?.data?.session ?? null;
        if (!session) return;
        const profile = await getCurrentProfile();
        if (cancelled) return;
        if (profile?.name) router.replace("/(tabs)/chats");
        else router.replace("/auth/profile");
      } catch (e) {
        console.log("[Couling] session probe error", String(e));
      } finally {
        clearTimeout(fallback);
        done();
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, []);

  if (checking) {
    return (
      <View style={[styles.root, { justifyContent: "center" }]}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root} testID="splash-screen">
      <Image source={{ uri: ASSETS.splashHero }} style={styles.hero} resizeMode="cover" />
      <LinearGradient
        colors={["rgba(13,13,13,0)", "rgba(13,13,13,0.7)", "#0D0D0D"]}
        style={styles.gradient}
      />
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.dot} />
          <Text style={styles.eyebrow}>EST. 2026  ·  PRIVATE PROTOCOL</Text>
        </View>
        <Text style={styles.brand}>Couling</Text>
        <Text style={styles.tagline}>
          The discreet way to converse, call & convene{"\n"}
          <Text style={{ color: colors.gold }}>without revealing your number.</Text>
        </Text>
        <View style={{ height: spacing.xxl }} />
        <GoldButton
          testID="get-started-btn"
          label="Enter the Circle"
          onPress={() => router.push("/auth/email")}
        />
        <Text style={styles.legal}>
          By continuing you accept Couling's privacy-first terms.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { ...StyleSheet.absoluteFillObject, opacity: 0.55 },
  gradient: { ...StyleSheet.absoluteFillObject },
  content: {
    flex: 1, justifyContent: "flex-end",
    paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold },
  eyebrow: { fontFamily: fonts.bodyMed, fontSize: 11, color: colors.gold, letterSpacing: 2 },
  brand: {
    fontFamily: fonts.serifBold, fontSize: 72, color: colors.text,
    letterSpacing: -2, lineHeight: 76,
  },
  tagline: {
    fontFamily: fonts.body, fontSize: 17, color: colors.textMuted,
    lineHeight: 26, marginTop: spacing.md,
  },
  legal: {
    textAlign: "center", color: colors.textDim,
    fontFamily: fonts.body, fontSize: 12, marginTop: spacing.md,
  },
});
