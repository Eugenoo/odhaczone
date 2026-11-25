import {
  Inter_300Light,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { Celebration } from '@/components/celebration';
import { Welcome } from '@/components/welcome';
import { Colors, Layout } from '@/constants/theme';
import { initAuth } from '@/store/auth-store';
import { useTodoStore } from '@/store/todo-store';
import { useUiStore } from '@/store/ui-store';

SplashScreen.preventAutoHideAsync();
initAuth(); // restores the saved login and starts cloud sync if the user is signed in

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  // Saved data loads asynchronously; wait for it so returning users never see a flash of the welcome screen.
  const [hydrated, setHydrated] = useState(() => useTodoStore.persist.hasHydrated());
  useEffect(() => useTodoStore.persist.onFinishHydration(() => setHydrated(true)), []);
  const welcomed = useTodoStore((s) => s.welcomed);
  const celebrating = useUiStore((s) => s.celebrating);
  const celebrationId = useUiStore((s) => s.celebrationId);
  const celebrationMessage = useUiStore((s) => s.celebrationMessage);
  const endCelebration = useUiStore((s) => s.endCelebration);
  const ready = (fontsLoaded || !!fontError) && hydrated;

  // Daily housekeeping: tasks finished more than 30 days ago are deleted. Runs at launch and when the app returns.
  useEffect(() => {
    if (!hydrated) return;
    const run = () => useTodoStore.getState().purgeOldCompleted();
    run();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && run());
    return () => sub.remove();
  }, [hydrated]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    // On wide screens (desktop browser, tablet) the app is a centered phone-width column.
    <View style={styles.backdrop}>
      <View style={styles.column}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="list/[id]" />
          <Stack.Screen name="login" />
        </Stack>
        {celebrating && <Celebration key={celebrationId} message={celebrationMessage} onDone={endCelebration} />}
        {!welcomed && <Welcome />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.desktopBackdrop,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: Layout.maxWidth,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
});
