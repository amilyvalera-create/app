import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/context/AuthContext";
import { colors } from "@/src/theme/tokens";
import { BrandMark } from "@/src/components/ui";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/(app)/home" : "/login");
  }, [user, loading, router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <BrandMark size={64} />
      <ActivityIndicator color={colors.brandSecondary} style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
});
