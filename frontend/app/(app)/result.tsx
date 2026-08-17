import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Linking,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { AppHeader } from "@/src/components/AppHeader";
import { Button, StateBlock } from "@/src/components/ui";
import { QuoteModal } from "@/src/components/QuoteModal";
import { useAuth } from "@/src/context/AuthContext";
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
  const [favorited, setFavorited] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const { user } = useAuth();

  const copyPrice = async (label: string, value: number, currency: string) => {
    try {
      await Clipboard.setStringAsync(formatPrice(value, currency));
      setCopied(label);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    }
  };

  const load = useCallback(async () => {
    if (!sku) return;
    setLoading(true);
    setError(null);
    try {
      const [p, favs] = await Promise.all([api.product(sku), api.favorites()]);
      setProduct(p);
      setFavorited(favs.items.some((f) => f.sku === p.sku));
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

  const toggleFavorite = async () => {
    if (!product) return;
    const next = !favorited;
    setFavorited(next);
    try {
      if (next) {
        await api.addFavorite({ sku: product.sku, marca: product.marca, descripcion: product.descripcion });
      } else {
        await api.removeFavorite(product.sku);
      }
    } catch {
      setFavorited(!next); // revert on failure
    }
  };

  const shareQuotation = async () => {
    if (!product) return;
    const lines = product.prices
      .map((p) => `• ${p.label}: ${isAvailable(p.value) ? formatPrice(p.value, p.currency) : "No disponible"}`)
      .join("\n");
    const message =
      `*VENEGE · Cotización*\n\n` +
      `*${product.marca}*\n${product.descripcion}\n` +
      `SKU: ${product.sku}  ·  RIN ${product.rin}"\n\n` +
      `${lines}\n\n` +
      `_Precios sujetos a cambio sin previo aviso._`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    try {
      if (Platform.OS === "web") {
        window.open(url, "_blank");
      } else {
        await Linking.openURL(url);
      }
    } catch {
      /* silent */
    }
  };

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

                {/* Favorite + Share actions */}
                <View style={styles.cardActions}>
                  <Pressable
                    testID="favorite-toggle"
                    onPress={toggleFavorite}
                    style={({ pressed }) => [styles.chipAction, favorited && styles.chipActionActive, pressed && { opacity: 0.85 }]}
                  >
                    <Ionicons
                      name={favorited ? "star" : "star-outline"}
                      size={18}
                      color={favorited ? colors.brandSecondary : colors.onSurfaceSecondary}
                    />
                    <Text style={[styles.chipActionText, favorited && { color: colors.brandSecondary }]}>
                      {favorited ? "Guardado" : "Favorito"}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID="share-quotation"
                    onPress={shareQuotation}
                    style={({ pressed }) => [styles.chipAction, pressed && { opacity: 0.85 }]}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color={colors.onSuccess} />
                    <Text style={styles.chipActionText}>Compartir</Text>
                  </Pressable>
                </View>
              </View>

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
                      <Pressable
                        key={p.key}
                        testID={`price-tile-${p.key}`}
                        onPress={available ? () => copyPrice(p.label, p.value as number, p.currency) : undefined}
                        style={({ pressed }) => [
                          styles.priceTile,
                          { width: tileWidth },
                          p.key === "BF_GOODRICH" && styles.priceTileBf,
                          pressed && available && { borderColor: colors.brandSecondary },
                        ]}
                      >
                        <View style={styles.priceTileTop}>
                          <Text style={styles.priceLabel} numberOfLines={1}>
                            {p.label}
                          </Text>
                          {available ? (
                            <Ionicons
                              name={copied === p.label ? "checkmark-circle" : "copy-outline"}
                              size={15}
                              color={copied === p.label ? colors.onSuccess : colors.onSurfaceTertiary}
                            />
                          ) : (
                            <View style={styles.posBadge}>
                              <Text style={styles.posBadgeText}>Precio {p.position}</Text>
                            </View>
                          )}
                        </View>
                        {available ? (
                          <Text style={styles.priceValue}>{formatPrice(p.value, p.currency)}</Text>
                        ) : (
                          <Text style={styles.priceUnavailable}>No disponible</Text>
                        )}
                        <Text style={styles.priceCurrency}>
                          {copied === p.label
                            ? "¡Copiado!"
                            : p.currency === "Bs"
                              ? "Bolívares · toca para copiar"
                              : "Dólares · toca para copiar"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Inventory placeholder (Phase 2 — disabled) */}
              <View style={styles.invBlock} testID="inventory-placeholder">
                <View style={styles.invHead}>
                  <Ionicons name="cube-outline" size={16} color={colors.onSurfaceTertiary} />
                  <Text style={styles.invTitle}>Inventario</Text>
                  <View style={styles.invSoon}><Text style={styles.invSoonText}>Próximamente</Text></View>
                </View>
                <View style={styles.invLights}>
                  <View style={[styles.light, { backgroundColor: "#7A2A2E" }]} />
                  <View style={[styles.light, { backgroundColor: "#7A5A1E" }]} />
                  <View style={[styles.light, { backgroundColor: "#2E5A32" }]} />
                  <Text style={styles.invHint}>Semáforo de disponibilidad (se activará pronto)</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Copy toast */}
          {copied ? (
            <View style={[styles.toast, { bottom: insets.bottom + 120 }]} testID="copy-toast">
              <Ionicons name="checkmark-circle" size={16} color={colors.onSuccess} />
              <Text style={styles.toastText}>Precio copiado</Text>
            </View>
          ) : null}

          <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.md }]} testID="result-actions">
            <View style={styles.actionInner}>
              <Button
                label="Cotizar"
                icon="document-text-outline"
                onPress={() => setQuoteOpen(true)}
                testID="cotizar-button"
                fullWidth
              />
            </View>
            <View style={[styles.actionInner, { marginTop: spacing.sm }]}>
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
                variant="ghost"
                onPress={() => router.replace("/(app)/home")}
                testID="nueva-consulta-button"
                style={{ flex: 1 }}
              />
            </View>
          </View>

          <QuoteModal
            visible={quoteOpen}
            onClose={() => setQuoteOpen(false)}
            product={product}
            sellerName={user?.name ?? ""}
          />
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
  cardActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  chipAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActionActive: { borderColor: colors.brandSecondary },
  chipActionText: { fontFamily: fonts.body, fontSize: type.base, color: colors.onSurfaceSecondary, fontWeight: "600" },
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
  priceTileBf: { borderColor: colors.brandSecondary, backgroundColor: "#1B1614" },
  invBlock: { marginTop: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, opacity: 0.8 },
  invHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  invTitle: { fontFamily: fonts.display, fontSize: type.lg, color: colors.onSurfaceSecondary, letterSpacing: 0.4, flex: 1 },
  invSoon: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  invSoonText: { fontFamily: fonts.body, fontSize: 10, color: colors.onSurfaceTertiary, fontWeight: "700", letterSpacing: 0.5 },
  invLights: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  light: { width: 14, height: 14, borderRadius: 7 },
  invHint: { fontFamily: fonts.body, fontSize: type.sm, color: colors.onSurfaceTertiary, marginLeft: spacing.sm, flex: 1 },
  toast: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.success, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  toastText: { fontFamily: fonts.body, fontSize: type.base, color: colors.onSuccess, fontWeight: "700" },
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
