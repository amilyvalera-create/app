import { useState } from "react";
import { StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { Button, VenegeLogo } from "@/src/components/ui";
import { ApiError } from "@/src/api/client";
import { colors, spacing, radius, fonts, type } from "@/src/theme/tokens";

const HERO =
  "https://images.pexels.com/photos/10673700/pexels-photo-10673700.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function Login() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const onSubmit = async () => {
    if (!username.trim() || !password) {
      setError("Ingresa tu usuario y contraseña.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No pudimos iniciar sesión. Intenta de nuevo.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(12,12,16,0.55)", "rgba(12,12,16,0.9)", colors.surface]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.brandRow}>
            <VenegeLogo width={190} />
          </View>
          <Text style={styles.kicker}>LISTA DE PRECIOS</Text>
          <Text style={styles.headline}>Consulta premium de{"\n"}precios en segundos</Text>

          <View style={styles.card} testID="login-card">
            <Text style={styles.cardTitle}>Iniciar sesión</Text>
            <Text style={styles.cardSub}>Accede con tu usuario autorizado</Text>

            {error ? (
              <View style={styles.errorBanner} testID="login-error">
                <Ionicons name="alert-circle" size={18} color={colors.onError} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Usuario</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={colors.onSurfaceTertiary} />
              <TextInput
                testID="username-input"
                value={username}
                onChangeText={setUsername}
                placeholder="Tu usuario"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                returnKeyType="next"
              />
            </View>

            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.onSurfaceTertiary} />
              <TextInput
                testID="password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="Tu contraseña"
                placeholderTextColor={colors.onSurfaceTertiary}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                style={styles.input}
                returnKeyType="go"
                onSubmitEditing={onSubmit}
              />
              <Pressable onPress={() => setShowPass((v) => !v)} testID="toggle-password" hitSlop={10}>
                <Ionicons
                  name={showPass ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.onSurfaceTertiary}
                />
              </Pressable>
            </View>

            <Button
              label="Ingresar"
              icon="log-in-outline"
              onPress={onSubmit}
              loading={loading}
              fullWidth
              testID="login-submit-button"
              style={{ marginTop: spacing.lg }}
            />
          </View>

          <Text style={styles.footer}>Acceso privado · Uso exclusivo del personal autorizado</Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.xl },
  content: { width: "100%", maxWidth: 420, alignSelf: "center" },
  brandRow: { alignItems: "flex-start", marginBottom: spacing.xl },
  kicker: {
    fontFamily: fonts.body,
    fontSize: type.sm,
    letterSpacing: 3,
    color: colors.brandSecondary,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 40,
    color: colors.onSurface,
    letterSpacing: 0.5,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: "rgba(21,22,28,0.92)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  cardTitle: { fontFamily: fonts.display, fontSize: type.xxl, color: colors.onSurface, letterSpacing: 0.5 },
  cardSub: { fontFamily: fonts.body, fontSize: type.base, color: colors.onSurfaceTertiary, marginTop: 2, marginBottom: spacing.lg },
  label: {
    fontFamily: fonts.body,
    fontSize: type.sm,
    color: colors.onSurfaceSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    letterSpacing: 0.3,
    fontWeight: "600",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 54,
  },
  input: { flex: 1, color: colors.onSurface, fontFamily: fonts.body, fontSize: type.lg, height: "100%" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: { color: colors.onError, fontFamily: fonts.body, fontSize: type.base, flex: 1 },
  footer: {
    textAlign: "center",
    color: colors.onSurfaceTertiary,
    fontFamily: fonts.body,
    fontSize: type.sm,
    marginTop: spacing.xl,
  },
});
