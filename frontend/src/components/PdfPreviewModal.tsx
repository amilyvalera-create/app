import { useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { Button } from "@/src/components/ui";
import { colors, spacing, radius, fonts, type } from "@/src/theme/tokens";

export function PdfPreviewModal({
  visible,
  onClose,
  title,
  html,
  dialogTitle,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  html: string | null;
  dialogTitle: string;
}) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (!html) return;
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (Platform.OS === "web") {
        window.open(uri, "_blank");
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle });
      }
    } catch {
      /* silent */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.root, { paddingTop: insets.top }]} testID="pdf-preview-modal">
        <View style={styles.headerRow}>
          <Pressable onPress={onClose} hitSlop={10} testID="pdf-preview-close" style={styles.iconBtn}>
            <Ionicons name="close" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={styles.iconBtn} />
        </View>

        <View style={styles.previewWrap}>
          {html ? (
            Platform.OS === "web" ? (
              // @ts-expect-error web-only iframe for reliable HTML preview
              <iframe srcDoc={html} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} title="preview" />
            ) : (
              <WebView
                originWhitelist={["*"]}
                source={{ html }}
                style={styles.webview}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.loading}>
                    <ActivityIndicator color={colors.brandSecondary} />
                  </View>
                )}
              />
            )
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.brandSecondary} />
              <Text style={styles.loadingText}>Preparando vista previa…</Text>
            </View>
          )}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            label={Platform.OS === "web" ? "Descargar / Abrir PDF" : "Compartir / Descargar"}
            icon="share-outline"
            onPress={share}
            loading={busy}
            fullWidth
            testID="pdf-preview-share"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: type.xl, color: colors.onSurface, letterSpacing: 0.5 },
  previewWrap: { flex: 1, backgroundColor: "#FFFFFF", margin: spacing.md, borderRadius: radius.md, overflow: "hidden" },
  webview: { flex: 1, backgroundColor: "#FFFFFF" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  loadingText: { fontFamily: fonts.body, fontSize: type.base, color: colors.onSurfaceTertiary },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
});
