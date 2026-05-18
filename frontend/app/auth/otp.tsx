// Legacy OTP screen kept as a placeholder; users land here only if a stale link
// is followed. Phone/SMS verification will return in a future release.
import React from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";

export default function OtpDeprecated() {
  const router = useRouter();
  React.useEffect(() => {
    router.replace("/auth/email");
  }, [router]);
  return <View style={{ flex: 1, backgroundColor: "#0D0D0D" }} />;
}
