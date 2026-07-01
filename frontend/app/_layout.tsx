import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import {
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from "@expo-google-fonts/cormorant-garamond";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
} from "@expo-google-fonts/outfit";
import { colors } from "@/src/theme";

// Best-effort: hide splash quickly so user never sees a blank screen.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // NON-BLOCKING font load. The app renders immediately with system fonts;
  // custom fonts swap in once Google CDN delivers them. This prevents the
  // "stuck on Expo loading screen" symptom on real devices / Expo Go.
  // We bundle the Ionicons glyph font in the same call so the icon set is
  // preloaded and we never hit the "Font file for ionicons is empty" runtime
  // error that crashes the JS bundle on first render.
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    ...Ionicons.font,
  });
  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    if (splashHidden) return;
    // Hide native splash as soon as fonts resolve, OR after a 1500ms hard
    // ceiling, so we never get stuck.
    const hide = async () => {
      try { await SplashScreen.hideAsync(); } catch {}
      setSplashHidden(true);
    };
    if (fontsLoaded || fontError) {
      hide();
      return;
    }
    const t = setTimeout(hide, 1500);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError, splashHidden]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: "none",
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
