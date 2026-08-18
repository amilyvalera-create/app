import { useRef, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, Platform, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

import { Button } from "@/src/components/ui";
import { colors, spacing, radius, fonts, type } from "@/src/theme/tokens";

function safeFileName(title: string): string {
  const base = (title || "documento").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
  return `${base || "documento"}.pdf`;
}

const PDF_OPTS = (filename: string) => ({
  margin: 0,
  filename,
  image: { type: "jpeg", quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true, backgroundColor: "#FFFFFF" },
  jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  pagebreak: { mode: ["css", "legacy"] },
});

export function PdfPreviewModal({
  visible,
  onClose,
  title,
  html,
  dialogTitle,
  vector = false,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  html: string | null;
  dialogTitle: string;
  /** When true, the preview HTML self-generates a true vector PDF (jsPDF/autotable). */
  vector?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const iframeRef = useRef<any>(null);
  const webviewRef = useRef<WebView>(null);
  const base64Resolver = useRef<((v: string) => void) | null>(null);

  const fileName = safeFileName(dialogTitle);

  // ---------- WEB helpers (html2pdf path — quotes / html mode) ----------
  const webElement = () => iframeRef.current?.contentDocument?.body ?? null;

  const webBlobHtml2Pdf = async (): Promise<Blob | null> => {
    const el = webElement();
    if (!el) return null;
    const html2pdf = (await import("html2pdf.js")).default;
    return await html2pdf().set(PDF_OPTS(fileName)).from(el).outputPdf("blob");
  };

  // ---------- WEB helpers (vector path — catalog) ----------
  const waitWebReady = async () => {
    for (let i = 0; i < 100; i++) {
      const w = iframeRef.current?.contentWindow;
      if (w && w.__ready && typeof w.__download === "function") return w;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  };

  const downloadWebVector = async () => {
    const w = await waitWebReady();
    if (w) w.__download();
  };

  const shareWebVector = async () => {
    const w = await waitWebReady();
    if (!w) return;
    const blob: Blob = w.__blob();
    const file = new File([blob], fileName, { type: "application/pdf" });
    const nav: any = navigator;
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: dialogTitle });
        return;
      } catch {
        /* cancelled -> fall through */
      }
    }
    w.__download();
  };

  // ---------- WEB helpers (html mode direct blob download) ----------
  const downloadWebHtml = async () => {
    const blob = await webBlobHtml2Pdf();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const shareWebHtml = async () => {
    const blob = await webBlobHtml2Pdf();
    if (!blob) return;
    const file = new File([blob], fileName, { type: "application/pdf" });
    const nav: any = navigator;
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: dialogTitle });
        return;
      } catch {
        /* cancelled */
      }
    }
    await downloadWebHtml();
  };

  // ---------- NATIVE helpers ----------
  const nativeShareHtml = async () => {
    if (!html) return;
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle, UTI: "com.adobe.pdf" });
    } else {
      Alert.alert("PDF generado", "El PDF se generó pero no hay una app para compartir disponible.");
    }
  };

  const nativeGetBase64 = () =>
    new Promise<string>((resolve, reject) => {
      base64Resolver.current = resolve;
      const js = `(function(){function go(){ if(window.__ready){ try{ window.ReactNativeWebView.postMessage('PDF:'+window.__base64()); }catch(e){ window.ReactNativeWebView.postMessage('ERR:'+(e&&e.message)); } } else { setTimeout(go,150);} } go(); })(); true;`;
      webviewRef.current?.injectJavaScript(js);
      setTimeout(() => {
        if (base64Resolver.current) {
          base64Resolver.current = null;
          reject(new Error("timeout"));
        }
      }, 20000);
    });

  const nativeSaveVector = async () => {
    const b64 = await nativeGetBase64();
    const uri = (FileSystem.cacheDirectory ?? "") + fileName;
    await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle, UTI: "com.adobe.pdf" });
    } else {
      Alert.alert("PDF generado", "El PDF se generó pero no hay una app para compartir disponible.");
    }
  };

  // ---------- Actions ----------
  const onDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (Platform.OS === "web") {
        if (vector) await downloadWebVector();
        else await downloadWebHtml();
      } else {
        if (vector) await nativeSaveVector();
        else await nativeShareHtml();
      }
    } catch {
      Alert.alert("Error", "No pudimos generar el PDF.");
    } finally {
      setBusy(false);
    }
  };

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (Platform.OS === "web") {
        if (vector) await shareWebVector();
        else await shareWebHtml();
      } else {
        if (vector) await nativeSaveVector();
        else await nativeShareHtml();
      }
    } catch {
      /* silent */
    } finally {
      setBusy(false);
    }
  };

  const onWebViewMessage = (e: { nativeEvent: { data: string } }) => {
    const d = e.nativeEvent.data || "";
    if (d.startsWith("PDF:") && base64Resolver.current) {
      const r = base64Resolver.current;
      base64Resolver.current = null;
      r(d.slice(4));
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
              // @ts-expect-error web-only iframe for reliable HTML preview + capture source
              <iframe ref={iframeRef} srcDoc={html} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} title="preview" />
            ) : (
              <WebView
                ref={webviewRef}
                originWhitelist={["*"]}
                source={{ html }}
                style={styles.webview}
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="always"
                onMessage={onWebViewMessage}
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
            label="Descargar PDF"
            icon="download-outline"
            onPress={onDownload}
            loading={busy}
            fullWidth
            testID="pdf-preview-download"
          />
          <View style={styles.secondaryRow}>
            <Button
              label="Compartir"
              icon="share-social-outline"
              variant="outline"
              onPress={onShare}
              testID="pdf-preview-share"
              style={{ flex: 1 }}
            />
            <Button
              label="Cerrar"
              variant="ghost"
              onPress={onClose}
              testID="pdf-preview-close-bottom"
              style={{ flex: 1 }}
            />
          </View>
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
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  secondaryRow: { flexDirection: "row", gap: spacing.sm },
});
