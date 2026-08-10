import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { Button, StateBlock } from "@/src/components/ui";
import { api, ProductDetail } from "@/src/api/client";
import { formatPrice, isAvailable } from "@/src/utils/format";
import { colors, spacing, radius, fonts, type, CONTENT_WIDTH } from "@/src/theme/tokens";

export default function Result() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { sku } = useLocalSearchParams<{ sku: string }>();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sku) return;
    setLoading(true);
    setError(null);
    try {
      const p = await api.product(sku);
      setProduct(p);
      api.logHistory({ sku: p.sku, marca: p.marca, descripcion: p.descripcion }).catch(() => {});
    } catch {
      setError("No pudimos cargar este producto. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [sku]);

  useEffect(() => {
    load();
  }, [load]);

  const contentWidth = Math.min(width - spacing.lg * 2, CONTENT_WIDTH);
  const twoCol = contentWidth > 520;
  const tileWidth = twoCol ? (contentWidth - spacing.md) / 2 : contentWidth;

  return (
    <View style={styles.root}>
      <AppHeader title="Resultado" showBack onRefresh={load} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandSecondary} size="large" />
          <Text style={styles.loadingText}>Cargando precios...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <StateBlock icon="cloud-offline-outline" title="Algo salió mal" subtitle={error}>
            <Button label="Reintentar" icon="refresh" onPress={load} style={{ marginTop: spacing.lg }} testID="retry-button" />
          </StateBlock>
        </View>
      ) : product ? (
        <>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              {/* Product identity */}
              <View style={styles.identity} testID="product-identity">
                <View style={styles.identityTop}>
                  <View style={styles.rinBadge}>
                    <Text style={styles.rinNumber}>{product.rin}"</Text>
                    <Text style={styles.rinLabel}>RIN</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.marca}>{product.marca}</Text>
                    <Text style={styles.desc}>{product.descripcion}</Text>
                  </View>
                </View>
                <View style={styles.skuRow}>
                  <Ionicons name="pricetag-outline" size={14} color={colors.brandSecondary} />
                  <Text style={styles.skuText}>{product.sku}</Text>
                </View>
              </View>

              {/* Prices */}
              <View style={styles.priceHeader}>
                <Text style={styles.priceHeaderTitle}>Precios autorizados</Text>
                <Text style={styles.priceHeaderCount}>{product.prices.length}</Text>
              </View>

              {product.prices.length === 0 ? (
                <StateBlock
                  icon="lock-closed-outline"
                  title="Sin precios autorizados"
                  subtitle="Tu perfil no tiene precios asignados para este producto."
                  testID="no-prices"
                />
              ) : (
                <View style={styles.priceGrid}>
                  {product.prices.map((p) => {
                    const available = isAvailable(p.value);
                    return (
                      <View
                        key={p.key}
                        testID={`price-tile-${p.key}`}
                        style={[styles.priceTile, { width: tileWidth }]}
                      >
                        <View style={styles.priceTileTop}>
                          <Text style={styles.priceLabel} numberOfLines={1}>
                            {p.label}
                          </Text>
                          <View style={styles.posBadge}>
                            <Text style={styles.posBadgeText}>Precio {p.position}</Text>
                          </View>
                        </View>
                        {available ? (
                          <Text style={styles.priceValue}>{formatPrice(p.value, p.currency)}</Text>
                        ) : (
                          <Text style={styles.priceUnavailable}>No disponible</Text>
                        )}
                        <Text style={styles.priceCurrency}>
                          {p.currency === "Bs" ? "Bolívares" : "Dólares"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Sticky action bar */}
          <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.md }]} testID="result-actions">
            <View style={styles.actionInner}>
              <Button
                label="Buscar otro"
                icon="search"
                variant="outline"
                onPress={() => router.back()}
                testID="buscar-otro-button"
                style={{ flex: 1 }}
              />
              <Button
                label="Nueva consulta"
                icon="add"
                onPress={() => router.replace("/(app)/home")}
                testID="nueva-consulta-button"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loadingText: { color: colors.onSurfaceTertiary, fontFamily: fonts.body, marginTop: spacing.md },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  content: { width: "100%", maxWidth: CONTENT_WIDTH, alignSelf: "center" },
  identity: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
  },
  identityTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rinBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rinNumber: { fontFamily: fonts.display, fontSize: type.xxl, color: colors.onBrandTertiary },
  rinLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.onBrandTertiary, letterSpacing: 2, marginTop: -2 },
  marca: { fontFamily: fonts.display, fontSize: type.xxl, color: colors.onSurface, letterSpacing: 0.5 },
  desc: { fontFamily: fonts.body, fontSize: type.base, color: colors.onSurfaceSecondary, marginTop: 2 },
  skuRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  skuText: { fontFamily: fonts.body, fontSize: type.base, color: colors.brandSecondary, fontWeight: "700", letterSpacing: 0.5 },
  priceHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.md },
  priceHeaderTitle: { fontFamily: fonts.display, fontSize: type.xl, color: colors.onSurface, letterSpacing: 0.5 },
  priceHeaderCount: {
    fontFamily: fonts.body,
    fontSize: type.sm,
    color: colors.onBrandTertiary,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: "hidden",
    fontWeight: "700",
  },
  priceGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  priceTile: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  priceTileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  priceLabel: { fontFamily: fonts.body, fontSize: type.base, color: colors.onSurfaceSecondary, fontWeight: "600", flex: 1, marginRight: spacing.sm },
  posBadge: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  posBadgeText: { fontFamily: fonts.body, fontSize: 10, color: colors.onSurfaceTertiary, letterSpacing: 0.5, fontWeight: "700" },
  priceValue: { fontFamily: fonts.display, fontSize: type.xxxl, color: colors.onSurface, letterSpacing: 0.5 },
  priceUnavailable: { fontFamily: fonts.display, fontSize: type.xl, color: colors.onSurfaceTertiary, letterSpacing: 0.5 },
  priceCurrency: { fontFamily: fonts.body, fontSize: type.sm, color: colors.brandSecondary, marginTop: 2, fontWeight: "600" },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  actionInner: { flexDirection: "row", gap: spacing.md, width: "100%", maxWidth: CONTENT_WIDTH, alignSelf: "center" },
});
