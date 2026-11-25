import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { cloudConfigured } from '@/lib/supabase';
import { useTodoStore } from '@/store/todo-store';

const native = Platform.OS !== 'web';

/** First-launch welcome: a waving hand, a greeting and a way in. Shown once per device. */
export function Welcome() {
  const insets = useSafeAreaInsets();
  const setWelcomed = useTodoStore((s) => s.setWelcomed);

  const [intro] = useState(() => new Animated.Value(0)); // 0 -> 1: everything fades and slides in
  const [wave] = useState(() => new Animated.Value(0)); // 0 -> 1: one wave of the hand

  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();

    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return; // respect "Reduce Motion": the hand just stays still
      loop = Animated.loop(
        Animated.sequence([
          Animated.delay(500),
          Animated.timing(wave, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
          Animated.delay(900),
          Animated.timing(wave, { toValue: 0, duration: 0, useNativeDriver: native }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [intro, wave]);

  // Hand swings from the wrist (bottom-right of the emoji), a few quick waves, then rests.
  const rotate = wave.interpolate({
    inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1],
    outputRange: ['0deg', '22deg', '-10deg', '22deg', '-6deg', '14deg', '0deg'],
  });
  const pop = intro.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const rise = intro.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  const start = () => setWelcomed();
  const signIn = () => {
    setWelcomed();
    router.push('/login');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
      <View style={styles.center}>
        <Animated.View style={{ opacity: intro, transform: [{ scale: pop }] }}>
          <Animated.Text
            accessibilityLabel="Waving hand"
            style={[styles.hand, { transformOrigin: '70% 85%', transform: [{ rotate }] }]}>
            👋
          </Animated.Text>
        </Animated.View>

        <Animated.View style={[styles.texts, { opacity: intro, transform: [{ translateY: rise }] }]}>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>Plan your day, tick things off, and keep your tasks in sync everywhere.</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.actions, { opacity: intro }]}>
        <Pressable style={styles.primary} onPress={start} accessibilityRole="button">
          <Text style={styles.primaryText}>Get started</Text>
        </Pressable>
        {cloudConfigured && (
          <Pressable onPress={signIn} hitSlop={10} accessibilityRole="button">
            <Text style={styles.secondaryText}>I already have an account</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    backgroundColor: Colors.background,
    paddingHorizontal: 28,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  hand: {
    fontSize: 110,
    lineHeight: 130,
    textAlign: 'center',
  },
  texts: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 36,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: Fonts.light,
    fontSize: 17,
    lineHeight: 24,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
  actions: {
    alignItems: 'center',
    gap: 18,
  },
  primary: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: Fonts.regular,
    fontSize: 20,
    color: Colors.surface,
  },
  secondaryText: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: Colors.text,
  },
});
