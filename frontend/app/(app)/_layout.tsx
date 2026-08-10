import { Stack } from "expo-router";

import { colors } from "@/src/theme/tokens";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
        animation: "fade",
      }}
    >
      <Stack.Screen name="home" />
      <Stack.Screen name="result" />
      <Stack.Screen name="master" />
    </Stack>
  );
}
