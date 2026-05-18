import React from "react";
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "@/src/theme";

export type ConfirmAction = {
  label: string;
  onPress: () => void;
  style?: "default" | "destructive" | "cancel";
  testID?: string;
};

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actions: ConfirmAction[];
  onClose: () => void;
};

export default function ConfirmDialog({
  visible,
  title,
  message,
  icon = "warning-outline",
  actions,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={24} color={colors.gold} />
          </View>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.actions}>
            {actions.map((a, i) => {
              const danger = a.style === "destructive";
              const cancel = a.style === "cancel";
              return (
                <TouchableOpacity
                  key={`${a.label}-${i}`}
                  testID={a.testID}
                  onPress={() => {
                    a.onPress();
                  }}
                  style={[
                    styles.btn,
                    danger && styles.btnDanger,
                    cancel && styles.btnCancel,
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.btnText,
                      danger && { color: "#fff" },
                      cancel && { color: colors.textMuted },
                    ]}
                  >
                    {a.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center", justifyContent: "center", padding: spacing.lg,
  },
  card: {
    width: "100%", maxWidth: 360,
    backgroundColor: colors.surface1, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.goldDim,
    padding: spacing.lg, alignItems: "center", gap: 8,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.gold,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.serifBold, fontSize: 22, color: colors.text,
    textAlign: "center", letterSpacing: -0.3,
  },
  message: {
    fontFamily: fonts.body, fontSize: 14, color: colors.textMuted,
    textAlign: "center", lineHeight: 20, marginTop: 4,
  },
  actions: {
    width: "100%", gap: 8, marginTop: spacing.md,
  },
  btn: {
    width: "100%", height: 50, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.gold,
  },
  btnDanger: { backgroundColor: colors.error },
  btnCancel: {
    backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border,
  },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 15, color: "#0D0D0D" },
});
