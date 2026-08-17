import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { Button, Card, StateBlock } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { api, ProductSuggestion, HistoryItem } from "@/src/api/client";
import { formatTimestamp } from "@/src/utils/format";
import { colors, spacing, radius, fonts, type, CONTENT_WIDTH } from "@/src/theme/tokens";

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [favorites, setFavorites] = useState<HistoryItem[]>([]);
  const [rins, setRins] = useState<(number | string)[]>([]);
  const [marcas, setMarcas] = useState<string[]>([]);
  const [activeRin, setActiveRin] = useState<number | string | null>(null);
  const [activeMarca, setActiveMarca] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasFilter = activeRin !== null || activeMarca !== null;
  const showResults = query.trim().length > 0 || hasFilter;

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const firstName = (user?.name || "").split(" ")[0];
  const greeting = firstName ? `${greet}, ${firstName}` : greet;

  const loadSidebars = useCallback(async () => {
    try {
      const [h, f, s] = await Promise.all([api.history(), api.favorites(), api.status()]);
      setHistory(h.items);
      setFavorites(f.items);
      setLastSync(s.last_sync);
    } catch {
      /* silent */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSidebars();
    }, [loadSidebars]),
  );

  useEffect(() => {
    api
      .facets()
      .then((f) => {
        setRins(f.rins);
        setMarcas(f.marcas);
      })
      .catch(() => {});
  }, []);

  const runSearch = useCallback(
    async (q: string, rin: number | string | null, marca: string | null) => {
      setSearching(true);
      try {
        const res = await api.search(q, {
          rin: rin ?? undefined,
          marca: marca ?? undefined,
        });
        setResults(res.results);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!showResults) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(() => runSearch(query.trim(), activeRin, activeMarca), 220);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, activeRin, activeMarca, showResults, runSearch]);

  const openProduct = (sku: string) => {
    router.push({ pathname: "/(app)/result", params: { sku } });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refresh();
      await loadSidebars();
      if (showResults) await runSearch(query.trim(), activeRin, activeMarca);
    } catch {
      /* silent */
    } finally {
      setRefreshing(false);
    }
  };

  const newQuery = () => {
    setQuery("");
    setActiveRin(null);
    setActiveMarca(null);
    setResults([]);
  };

  const renderSuggestion = (r: ProductSuggestion) => (
    <Pressable
      key={r.sku}
      testID={`suggestion-${r.sku}`}
      onPress={() => openProduct(r.sku)}
      style={({ pressed }) => [styles.suggestionItem, pressed && { backgroundColor: colors.surfaceTertiary }]}
    >
      <View style={styles.skuBadge}>
        <Text style={styles.skuBadgeText}>{r.rin}"</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.suggMarca} numberOfLines={1}>
          {r.marca}
        </Text>
        <Text style={styles.suggDesc} numberOfLines={2}>
          {r.descripcion}
        </Text>
        <Text style={styles.suggSku}>{r.sku}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <AppHeader title={greeting} onRefresh={onRefresh} refreshing={refreshing} />

      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.hero}>¿Qué producto buscas hoy?</Text>
          <Text style={styles.heroSub}>Busca por SKU, marca o descripción</Text>
          {lastSync ? (
            <View style={styles.updatedRow} testID="last-updated">
              <Ionicons name="ellipse" size={7} color={colors.success} />
              <Text style={styles.updatedText}>Actualizado {formatTimestamp(lastSync)}</Text>
            </View>
          ) : null}

          <View style={styles.searchBar} testID="search-bar">
            <Ionicons name="search" size={22} color={colors.onSurfaceTertiary} />
            <TextInput
              testID="search-input"
              value={query}
              onChangeText={setQuery}
              placeholder="Ej. Bridgestone, 265/70R16, VNG-16..."
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 || hasFilter ? (
              <Pressable onPress={newQuery} hitSlop={8} testID="clear-search">
                <Ionicons name="close-circle" size={20} color={colors.onSurfaceTertiary} />
              </Pressable>
            ) : null}
          </View>

          {/* Quick filters */}
          {rins.length > 0 ? (
            <View style={styles.filterBlock}>
              <Text style={styles.filterLabel}>RIN</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRowContent}
                testID="rin-filter-row"
              >
                {rins.map((r) => {
                  const active = activeRin === r;
                  return (
                    <Pressable
                      key={String(r)}
                      testID={`rin-chip-${r}`}
                      onPress={() => setActiveRin(active ? null : r)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{r}"</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {marcas.length > 0 ? (
            <View style={styles.filterBlock}>
              <Text style={styles.filterLabel}>MARCA</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRowContent}
                testID="marca-filter-row"
              >
                {marcas.map((m) => {
                  const active = activeMarca === m;
                  return (
                    <Pressable
                      key={m}
                      testID={`marca-chip-${m}`}
                      onPress={() => setActiveMarca(active ? null : m)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{m}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {hasFilter ? (
            <Pressable onPress={newQuery} style={styles.clearFilters} testID="clear-filters">
              <Ionicons name="close" size={14} color={colors.brandSecondary} />
              <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
            </Pressable>
          ) : null}

          {/* Results OR sidebars */}
          {showResults ? (
            <View style={styles.suggestions} testID="suggestions">
              {searching ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.brandSecondary} />
                  <Text style={styles.loadingText}>Buscando...</Text>
                </View>
              ) : results.length === 0 ? (
                <StateBlock
                  icon="cube-outline"
                  title="Sin resultados"
                  subtitle="No encontramos productos que coincidan. Prueba con otra marca, RIN o SKU."
                  testID="no-results"
                />
              ) : (
                results.map(renderSuggestion)
              )}
            </View>
          ) : (
            <>
              {/* Favorites */}
              {favorites.length > 0 ? (
                <>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <Ionicons name="star" size={16} color={colors.brandSecondary} />
                      <Text style={styles.sectionTitle}>Favoritos</Text>
                    </View>
                  </View>
                  <View style={styles.historyList} testID="favorites-list">
                    {favorites.slice(0, 6).map((h) => (
                      <Pressable
                        key={h.sku}
                        testID={`favorite-${h.sku}`}
                        onPress={() => openProduct(h.sku)}
                        style={({ pressed }) => [styles.historyItem, pressed && { borderColor: colors.brandSecondary }]}
                      >
                        <Ionicons name="star" size={18} color={colors.brandSecondary} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.historyMarca} numberOfLines={1}>
                            {h.marca} · {h.descripcion}
                          </Text>
                          <Text style={styles.historySku}>{h.sku}</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={16} color={colors.onSurfaceTertiary} />
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              {/* Recent searches */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Últimas búsquedas</Text>
                <Text style={styles.sectionHint}>{history.length}/5</Text>
              </View>

              {history.length === 0 ? (
                <Card testID="history-empty">
                  <StateBlock
                    icon="time-outline"
                    title="Aún sin búsquedas"
                    subtitle="Tus últimas 5 consultas aparecerán aquí para reabrirlas al instante."
                  />
                </Card>
              ) : (
                <View style={styles.historyList} testID="history-list">
                  {history.map((h) => (
                    <Pressable
                      key={h.sku}
                      testID={`history-${h.sku}`}
                      onPress={() => openProduct(h.sku)}
                      style={({ pressed }) => [styles.historyItem, pressed && { borderColor: colors.brandSecondary }]}
                    >
                      <Ionicons name="time-outline" size={18} color={colors.brandSecondary} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.historyMarca} numberOfLines={1}>
                          {h.marca} · {h.descripcion}
                        </Text>
                        <Text style={styles.historySku}>{h.sku}</Text>
                      </View>
                      <Ionicons name="arrow-forward" size={16} color={colors.onSurfaceTertiary} />
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={styles.actionsRow}>
                <Button
                  label="Consultar inventario"
                  icon="cube-outline"
                  variant="ghost"
                  onPress={() => setShowInventory(true)}
                  testID="inventory-button"
                  style={{ flex: 1 }}
                />
              </View>

              {user?.is_master ? (
                <Pressable
                  testID="master-panel-link"
                  onPress={() => router.push("/(app)/master")}
                  style={({ pressed }) => [styles.masterCard, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.masterIcon}>
                    <Ionicons name="shield-checkmark" size={22} color={colors.onSurface} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.masterTitle}>Panel de Administrador</Text>
                    <Text style={styles.masterSub}>Sincronización, datos globales y actividad</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </KeyboardAwareScrollView>

      <Modal visible={showInventory} transparent animationType="fade" onRequestClose={() => setShowInventory(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowInventory(false)}>
          <Pressable style={styles.modalCard} testID="inventory-modal">
            <View style={styles.modalIcon}>
              <Ionicons name="cube-outline" size={28} color={colors.brandSecondary} />
            </View>
            <Text style={styles.modalTitle}>Inventario próximamente</Text>
            <Text style={styles.modalBody}>
              La consulta de inventario estará disponible muy pronto en la Fase 2. Por ahora puedes consultar
              precios autorizados.
            </Text>
            <Button label="Entendido" onPress={() => setShowInventory(false)} fullWidth testID="inventory-modal-close" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  content: { width: "100%", maxWidth: CONTENT_WIDTH, alignSelf: "center" },
  hero: { fontFamily: fonts.display, fontSize: type.xxxl, color: colors.onSurface, letterSpacing: 0.5 },
  heroSub: { fontFamily: fonts.body, fontSize: type.base, color: colors.onSurfaceTertiary, marginTop: 2, marginBottom: spacing.lg },
  updatedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -spacing.sm, marginBottom: spacing.lg },
  updatedText: { fontFamily: fonts.body, fontSize: type.sm, color: colors.onSurfaceTertiary },
  clearFilters: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: spacing.md, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  clearFiltersText: { fontFamily: fonts.body, fontSize: type.sm, color: colors.onBrandTertiary, fontWeight: "700" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    height: 60,
  },
  searchInput: { flex: 1, color: colors.onSurface, fontFamily: fonts.body, fontSize: type.xl, height: "100%" },
  filterBlock: { marginTop: spacing.lg },
  filterLabel: { fontFamily: fonts.body, fontSize: type.sm, color: colors.onSurfaceTertiary, letterSpacing: 2, fontWeight: "700", marginBottom: spacing.sm },
  chipRowContent: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary },
  chipText: { fontFamily: fonts.body, fontSize: type.base, color: colors.onSurfaceSecondary, fontWeight: "600" },
  chipTextActive: { color: colors.onBrandTertiary },
  suggestions: { marginTop: spacing.lg, gap: spacing.sm },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl, justifyContent: "center" },
  loadingText: { color: colors.onSurfaceTertiary, fontFamily: fonts.body, fontSize: type.base },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  skuBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  skuBadgeText: { fontFamily: fonts.display, fontSize: type.lg, color: colors.onBrandTertiary },
  suggMarca: { fontFamily: fonts.display, fontSize: type.lg, color: colors.onSurface, letterSpacing: 0.3 },
  suggDesc: { fontFamily: fonts.body, fontSize: type.base, color: colors.onSurfaceSecondary },
  suggSku: { fontFamily: fonts.body, fontSize: type.sm, color: colors.brandSecondary, marginTop: 2, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.display, fontSize: type.xl, color: colors.onSurface, letterSpacing: 0.5 },
  sectionHint: { fontFamily: fonts.body, fontSize: type.sm, color: colors.onSurfaceTertiary, fontWeight: "600" },
  historyList: { gap: spacing.sm },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  historyMarca: { fontFamily: fonts.body, fontSize: type.base, color: colors.onSurface, fontWeight: "600" },
  historySku: { fontFamily: fonts.body, fontSize: type.sm, color: colors.brandSecondary, marginTop: 1, fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  masterCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
  },
  masterIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  masterTitle: { fontFamily: fonts.display, fontSize: type.lg, color: colors.onSurface, letterSpacing: 0.4 },
  masterSub: { fontFamily: fonts.body, fontSize: type.sm, color: colors.onSurfaceTertiary },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  modalIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { fontFamily: fonts.display, fontSize: type.xxl, color: colors.onSurface, letterSpacing: 0.5 },
  modalBody: { fontFamily: fonts.body, fontSize: type.base, color: colors.onSurfaceTertiary, textAlign: "center", lineHeight: 20 },
});
