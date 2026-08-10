import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/context/AuthContext";
import { BrandMark } from "@/src/components/ui";
import { colors, spacing, radius, fonts, type } from "@/src/theme/tokens";

type Props = {
  title?: string;
  showBack?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function AppHeader({ title, showBack, onRefresh, refreshing }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          {showBack ? (
            <Pressable
              testID="header-back"
              onPress={() => router.back()}
              style={styles.iconBtn}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
            </Pressable>
          ) : (
            <BrandMark size={38} />
          )}
          <View style={{ marginLeft: spacing.md }}>
            <Text style={styles.title} numberOfLines={1}>
              {title ?? "VENEGE"}
            </Text>
            {user ? (
              <View style={styles.roleChip}>
                <View style={styles.dot} />
                <Text style={styles.roleText} numberOfLines={1}>
                  {user.role_label}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.actions}>
          {onRefresh ? (
            <Pressable
              testID="header-refresh"
              onPress={onRefresh}
              disabled={refreshing}
              style={styles.iconBtn}
              hitSlop={8}
            >
              <Ionicons
                name="refresh"
                size={20}
                color={refreshing ? colors.onSurfaceTertiary : colors.onSurface}
              />
            </Pressable>
          ) : null}
          <Pressable testID="header-logout" onPress={logout} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="log-out-outline" size={20} color={colors.onSurface} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.display, fontSize: type.xl, color: colors.onSurface, letterSpacing: 0.5 },
  roleChip: { flexDirection: "row", alignItems: "center", marginTop: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandSecondary, marginRight: 6 },
  roleText: { fontFamily: fonts.body, fontSize: type.sm, color: colors.onSurfaceTertiary, fontWeight: "600" },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
