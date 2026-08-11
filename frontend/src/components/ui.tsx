import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, fonts, type, brandGradient } from "@/src/theme/tokens";

const LOGO_FULL = require("@/assets/images/venege-transparent.png");
const LOGO_MARK = require("@/assets/images/venege-mark.png");

// -------------------------------------------------------------------- Logo
export function VenegeLogo({ width = 180 }: { width?: number }) {
  return (
    <Image
      source={LOGO_FULL}
      style={{ width, height: width * 1.058 }}
      contentFit="contain"
      transition={200}
    />
  );
}

// Clean transparent V-arrow monogram — no boxed container.
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      testID="brand-mark"
      source={LOGO_MARK}
      style={{ width: size * 1.13, height: size }}
      contentFit="contain"
      transition={150}
    />
  );
}

// ------------------------------------------------------------------ Button
type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  fullWidth,
  style,
  testID,
}: ButtonProps) {
  const isFilled = variant === "primary" || variant === "secondary";
  const gradient =
    variant === "primary"
      ? brandGradient
      : ([colors.brandSecondary, "#C7431F"] as const);
  const textColor = isFilled
    ? "#fff"
    : variant === "outline"
      ? colors.onSurface
      : colors.onSurfaceTertiary;

  const content = (
    <View style={styles.btnInner}>
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={textColor} style={{ marginRight: spacing.sm }} />}
          <Text style={[styles.btnLabel, { color: textColor }]}>{label}</Text>
        </>
      )}
    </View>
  );

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btnBase,
        fullWidth && { alignSelf: "stretch" },
        variant === "outline" && styles.btnOutline,
        variant === "ghost" && styles.btnGhost,
        (disabled || loading) && { opacity: 0.55 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {isFilled ? (
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnFill}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}

// ----------------------------------------------------------------- Surfaces
export function Card({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- Empty state
export function StateBlock({
  icon,
  title,
  subtitle,
  testID,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  testID?: string;
  children?: React.ReactNode;
}) {
  return (
    <View testID={testID} style={styles.state}>
      <View style={styles.stateIcon}>
        <Ionicons name={icon} size={30} color={colors.onSurfaceTertiary} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      {subtitle ? <Text style={styles.stateSub}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  btnBase: {
    height: 52,
    borderRadius: radius.md,
    overflow: "hidden",
    justifyContent: "center",
  },
  btnFill: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.lg },
  btnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  btnLabel: { fontFamily: fonts.body, fontSize: type.lg, fontWeight: "700", letterSpacing: 0.3 },
  btnOutline: { borderWidth: 1.5, borderColor: colors.borderStrong },
  btnGhost: { backgroundColor: colors.surfaceTertiary },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  state: { alignItems: "center", paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  stateIcon: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  stateTitle: {
    fontFamily: fonts.display,
    fontSize: type.xxl,
    color: colors.onSurface,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  stateSub: {
    fontFamily: fonts.body,
    fontSize: type.base,
    color: colors.onSurfaceTertiary,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 320,
    lineHeight: 20,
  },
});
