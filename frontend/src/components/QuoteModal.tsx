import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, TextInput, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/src/components/ui";
import { PdfPreviewModal } from "@/src/components/PdfPreviewModal";
import { api, ProductDetail, PriceTile, ProductSuggestion } from "@/src/api/client";
import { buildQuoteHTML, QuoteItem } from "@/src/utils/quote";
import { formatPrice, isAvailable } from "@/src/utils/format";
import { colors, spacing, radius, fonts, type } from "@/src/theme/tokens";

type LineItem = {
  sku: string;
  marca: string;
  descripcion: string;
  rin: number | string;
  prices: PriceTile[];
  selected: string; // price key
  qty: number;
};

function toLine(p: ProductDetail, keys: string[]): LineItem | null {
  const avail = p.prices.filter((x) => isAvailable(x.value) && keys.includes(x.key));
  if (avail.length === 0) return null;
  return { sku: p.sku, marca: p.marca, descripcion: p.descripcion, rin: p.rin, prices: avail, selected: avail[0].key, qty: 1 };
}

export function QuoteModal({
  visible,
  onClose,
  product,
  sellerName,
  allowedKeys,
}: {
  visible: boolean;
  onClose: () => void;
  product: ProductDetail | null;
  sellerName: string;
  allowedKeys: string[];
}) {
  const insets = useSafeAreaInsets();
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [sugg, setSugg] = useState<ProductSuggestion[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      const li = product ? toLine(product, allowedKeys) : null;
      setItems(li ? [li] : []);
      setRecipient("");
      setPhone("");
      setQ("");
      setSugg([]);
    }
  }, [visible, product, allowedKeys]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setSugg([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await api.search(q.trim());
        setSugg(r.results.slice(0, 5));
      } catch {
        setSugg([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const addItem = async (sku: string) => {
    if (items.some((i) => i.sku === sku)) {
      setQ("");
      setSugg([]);
      return;
    }
    try {
      const p = await api.product(sku);
      const li = toLine(p, allowedKeys);
      if (li) setItems((prev) => [...prev, li]);
    } catch {
      /* ignore */
    }
    setQ("");
    setSugg([]);
  };

  const setQty = (sku: string, delta: number) =>
    setItems((prev) => prev.map((i) => (i.sku === sku ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  const setPrice = (sku: string, key: string) =>
    setItems((prev) => prev.map((i) => (i.sku === sku ? { ...i, selected: key } : i)));
  const removeItem = (sku: string) => setItems((prev) => prev.filter((i) => i.sku !== sku));

  const generate = async () => {
    if (items.length === 0) return;
    setBusy(true);
    try {
      const quoteItems: QuoteItem[] = items.map((i) => {
        const pt = i.prices.find((p) => p.key === i.selected)!;
        return {
          sku: i.sku,
          marca: i.marca,
          descripcion: i.descripcion,
          rin: i.rin,
          priceLabel: pt.label,
          value: pt.value as number,
          currency: pt.currency,
          qty: i.qty,
        };
      });
      const html = buildQuoteHTML({ recipient, sellerName, sellerPhone: phone, items: quoteItems });
      setPreviewHtml(html);
      setPreviewOpen(true);
    } catch {
      /* silent */
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} testID="quote-modal">
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Cotizar</Text>
            <Pressable onPress={onClose} hitSlop={10} testID="quote-close">
              <Ionicons name="close" size={24} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <KeyboardAwareScrollView bottomOffset={20} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Cliente</Text>
            <TextInput
              testID="quote-recipient"
              value={recipient}
              onChangeText={setRecipient}
              placeholder="Nombre del cliente"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.input}
            />
            <Text style={styles.label}>Teléfono del vendedor</Text>
            <TextInput
              testID="quote-phone"
              value={phone}
              onChangeText={setPhone}
              placeholder="Ej. 0414-1234567"
              placeholderTextColor={colors.onSurfaceTertiary}
              keyboardType="phone-pad"
              style={styles.input}
            />

            <Text style={styles.label}>Productos</Text>
            {items.map((i) => {
              const pt = i.prices.find((p) => p.key === i.selected)!;
              return (
                <View key={i.sku} style={styles.item} testID={`quote-item-${i.sku}`}>
                  <View style={styles.itemTop}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.itemMarca} numberOfLines={1}>{i.marca}</Text>
                      <Text style={styles.itemDesc} numberOfLines={2}>{i.descripcion}</Text>
                    </View>
                    <Pressable onPress={() => removeItem(i.sku)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={colors.onSurfaceTertiary} />
                    </Pressable>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.priceRow}>
                    {i.prices.map((p) => (
                      <Pressable
                        key={p.key}
                        onPress={() => setPrice(i.sku, p.key)}
                        style={[styles.priceChip, i.selected === p.key && styles.priceChipActive]}
                      >
                        <Text style={[styles.priceChipText, i.selected === p.key && { color: colors.onBrandTertiary }]} numberOfLines={1}>
                          {p.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <View style={styles.itemBottom}>
                    <Text style={styles.itemPrice}>{formatPrice(pt.value, pt.currency)}</Text>
                    <View style={styles.qty}>
                      <Pressable onPress={() => setQty(i.sku, -1)} style={styles.qtyBtn} hitSlop={6}><Ionicons name="remove" size={16} color={colors.onSurface} /></Pressable>
                      <Text style={styles.qtyVal}>{i.qty}</Text>
                      <Pressable onPress={() => setQty(i.sku, 1)} style={styles.qtyBtn} hitSlop={6}><Ionicons name="add" size={16} color={colors.onSurface} /></Pressable>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Add more */}
            <View style={styles.addWrap}>
              <Ionicons name="add-circle-outline" size={18} color={colors.onSurfaceTertiary} />
              <TextInput
                testID="quote-add-search"
                value={q}
                onChangeText={setQ}
                placeholder="Agregar otro producto…"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.addInput}
                autoCapitalize="none"
              />
            </View>
            {sugg.map((s) => (
              <Pressable key={s.sku} onPress={() => addItem(s.sku)} style={styles.suggItem} testID={`quote-sugg-${s.sku}`}>
                <Text style={styles.suggText} numberOfLines={1}>{s.marca} · {s.descripcion}</Text>
                <Ionicons name="add" size={18} color={colors.brandSecondary} />
              </Pressable>
            ))}

            <Button label="Generar cotización PDF" icon="document-text-outline" onPress={generate} loading={busy} fullWidth testID="quote-generate" style={{ marginTop: spacing.lg }} />
            <Pressable style={styles.orderBtn} disabled testID="add-to-order-placeholder">
              <Ionicons name="cart-outline" size={18} color={colors.onSurfaceTertiary} />
              <Text style={styles.orderText}>Agregar a pedido · próximamente</Text>
            </Pressable>
            <Button label="Cerrar" variant="ghost" onPress={onClose} fullWidth testID="quote-close-bottom" style={{ marginTop: spacing.sm }} />
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>

    <PdfPreviewModal
      visible={previewOpen}
      onClose={() => setPreviewOpen(false)}
      title="Cotización"
      html={previewHtml}
      dialogTitle="Cotización VENEGE"
    />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, maxHeight: "92%", borderTopWidth: 1, borderColor: colors.border },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  title: { fontFamily: fonts.display, fontSize: type.xxl, color: colors.onSurface, letterSpacing: 0.5 },
  label: { fontFamily: fonts.body, fontSize: type.sm, color: colors.onSurfaceSecondary, fontWeight: "600", marginTop: spacing.md, marginBottom: spacing.sm, letterSpacing: 0.3 },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 50, color: colors.onSurface, fontFamily: fonts.body, fontSize: type.lg },
  item: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  itemTop: { flexDirection: "row", gap: spacing.sm },
  itemMarca: { fontFamily: fonts.display, fontSize: type.lg, color: colors.onSurface, letterSpacing: 0.3 },
  itemDesc: { fontFamily: fonts.body, fontSize: type.sm, color: colors.onSurfaceSecondary, lineHeight: 17 },
  priceRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  priceChip: { flexShrink: 0, height: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  priceChipActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary },
  priceChipText: { fontFamily: fonts.body, fontSize: type.sm, color: colors.onSurfaceSecondary, fontWeight: "600" },
  itemBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  itemPrice: { fontFamily: fonts.display, fontSize: type.xl, color: colors.onSurface },
  qty: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  qtyBtn: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  qtyVal: { fontFamily: fonts.body, fontSize: type.lg, color: colors.onSurface, fontWeight: "700", minWidth: 20, textAlign: "center" },
  addWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 48, marginTop: spacing.sm },
  addInput: { flex: 1, color: colors.onSurface, fontFamily: fonts.body, fontSize: type.base, height: "100%" },
  suggItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  suggText: { fontFamily: fonts.body, fontSize: type.base, color: colors.onSurfaceSecondary, flex: 1, marginRight: spacing.sm },
  orderBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", opacity: 0.6 },
  orderText: { fontFamily: fonts.body, fontSize: type.base, color: colors.onSurfaceTertiary, fontWeight: "600" },
});
