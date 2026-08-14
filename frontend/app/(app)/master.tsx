import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { Button, Card, StateBlock } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { formatTimestamp } from "@/src/utils/format";
import { colors, spacing, radius, fonts, type, CONTENT_WIDTH } from "@/src/theme/tokens";

type Dashboard = Awaited<ReturnType<typeof api.adminDashboard>>;

export default function Master() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.adminDashboard();
      setData(d);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSync = async () => {
    setSyncing(true);
    try {
      await api.adminSync();
      await load();
    } catch {
      /* silent */
    } finally {
      setSyncing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <AppHeader title="Panel Admin" showBack />
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandSecondary} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader title="Panel Admin" showBack onRefresh={onRefresh} refreshing={refreshing} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandSecondary} />
        }
      >
        <View style={styles.content}>
          {/* Setup pending notice */}
          {data && !data.connection_ready ? (
            <View style={styles.notice} testID="setup-notice">
              <Ionicons name="cloud-offline-outline" size={20} color={colors.onWarning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>
                  {data.credentials_set ? "Revisa la conexión de Zoho WorkDrive" : "Conexión de datos pendiente"}
                </Text>
                <Text style={styles.noticeBody}>
                  {data.last_error
                    ? data.last_error
                    : "Mostrando datos de referencia. Conecta el enlace de Zoho WorkDrive con descarga habilitada para leer la hoja “Precios Actual” en vivo."}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Sync hero */}
          <Card style={styles.syncCard} testID="sync-card">
            <Text style={styles.syncLabel}>ÚLTIMA SINCRONIZACIÓN</Text>
            <Text style={styles.syncTime}>{formatTimestamp(data?.last_sync ?? null)}</Text>
            <View style={styles.syncMetaRow}>
              <Ionicons name="document-text-outline" size={14} color={colors.onSurfaceTertiary} />
              <Text style={styles.syncMeta}>
                Hoja {data?.worksheet} · Fuente: {data?.source === "mock" ? "Referencia" : "Zoho WorkDrive"}
              </Text>
            </View>
            <Button
              label={syncing ? "Sincronizando..." : "Actualizar datos"}
              icon="sync"
              variant="secondary"
              onPress={onSync}
              loading={syncing}
              fullWidth
              testID="sync-button"
              style={{ marginTop: spacing.lg }}
            />
          </Card>

          {/* Stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard} testID="stat-products">
              <Ionicons name="cube" size={20} color={colors.brandSecondary} />
              <Text style={styles.statValue}>{data?.product_count ?? 0}</Text>
              <Text style={styles.statLabel}>Productos</Text>
            </View>
            <View style={styles.statCard} testID="stat-users">
              <Ionicons name="people" size={20} color={colors.brandSecondary} />
              <Text style={styles.statValue}>{data?.total_users ?? 0}</Text>
              <Text style={styles.statLabel}>Usuarios</Text>
            </View>
            <View style={styles.statCard} testID="stat-connection">
              <Ionicons
                name={data?.connection_ready ? "checkmark-circle" : "ellipse-outline"}
                size={20}
                color={data?.connection_ready ? colors.onSuccess : colors.onSurfaceTertiary}
              />
              <Text style={styles.statValue}>{data?.connection_ready ? "Activa" : "Demo"}</Text>
              <Text style={styles.statLabel}>Conexión</Text>
            </View>
          </View>

          {/* Global recent searches */}
          <Text style={styles.sectionTitle}>Últimas 6 búsquedas globales</Text>
          {data && data.recent_global_searches.length > 0 ? (
            <View style={styles.list} testID="global-searches">
              {data.recent_global_searches.map((h, i) => (
                <View key={`${h.sku}-${i}`} style={styles.listItem}>
                  <View style={styles.userChip}>
                    <Text style={styles.userChipText}>{(h.username ?? "?").slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.listMarca} numberOfLines={1}>
                      {h.marca} · {h.descripcion}
                    </Text>
                    <Text style={styles.listMeta}>
                      {h.sku} · {h.username} · {formatTimestamp(h.at)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Card>
              <StateBlock icon="pulse-outline" title="Sin actividad" subtitle="Las consultas de los usuarios aparecerán aquí." />
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  content: { width: "100%", maxWidth: CONTENT_WIDTH, alignSelf: "center" },
  notice: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: "flex-start",
  },
  noticeTitle: { fontFamily: fonts.body, fontSize: type.base, color: colors.onWarning, fontWeight: "700" },
  noticeBody: { fontFamily: fonts.body, fontSize: type.sm, color: colors.onWarning, marginTop: 2, lineHeight: 18 },
  syncCard: { borderColor: colors.borderStrong },
  syncLabel: { fontFamily: fonts.body, fontSize: type.sm, color: colors.brandSecondary, letterSpacing: 2, fontWeight: "700" },
  syncTime: { fontFamily: fonts.display, fontSize: type.xxl, color: colors.onSurface, letterSpacing: 0.5, marginTop: spacing.xs },
  syncMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xs },
  syncMeta: { fontFamily: fonts.body, fontSize: type.sm, color: colors.onSurfaceTertiary },
  statsGrid: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  statValue: { fontFamily: fonts.display, fontSize: type.xxl, color: colors.onSurface, letterSpacing: 0.5 },
  statLabel: { fontFamily: fonts.body, fontSize: type.sm, color: colors.onSurfaceTertiary },
  sectionTitle: { fontFamily: fonts.display, fontSize: type.xl, color: colors.onSurface, letterSpacing: 0.5, marginTop: spacing.xl, marginBottom: spacing.md },
  list: { gap: spacing.sm },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  userChip: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  userChipText: { fontFamily: fonts.body, fontSize: type.sm, color: colors.onBrandTertiary, fontWeight: "700" },
  listMarca: { fontFamily: fonts.body, fontSize: type.base, color: colors.onSurface, fontWeight: "600" },
  listMeta: { fontFamily: fonts.body, fontSize: type.sm, color: colors.onSurfaceTertiary, marginTop: 1 },
});
