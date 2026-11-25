import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Colors, Fonts, Layout, ListColors } from '@/constants/theme';

const native = Platform.OS !== 'web';
const DURATION = 3600; // confetti fall
const LIFETIME = 4300; // card shown, then everything unmounts
const PIECES = 70;
const COLORS = [Colors.accent, ListColors.purple.strong, ListColors.orange.strong, ListColors.blue.strong, ListColors.pink.strong, '#FFD166'];

const MESSAGES: [title: string, subtitle: string][] = [
  ['Congratulations!', 'You finished everything on today’s list.'],
  ['You did it!', 'Every task for today is done. Well deserved break!'],
  ['All done!', 'Today’s list is clear. Great work.'],
  ['Nailed it!', 'Nothing left for today. Enjoy the rest of your day.'],
];

type Piece = {
  color: string;
  w: number;
  h: number;
  round: boolean;
  x0: number; // start x (px)
  sway: number; // side-to-side swing (px)
  drift: number; // net horizontal travel (px)
  spin: number; // total rotation (deg)
  delay: number; // 0..1 of the animation before this piece starts falling
  flutter: number; // how many times it flips edge-on
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Confetti shower plus a congratulations card. Doesn't block touches; removes itself after a few seconds. */
/** Message for finishing every task of one list. */
export function listMessage(listName: string): [string, string] {
  const options: [string, string][] = [
    [`${listName} is done!`, 'You finished every task in this list.'],
    [`${listName}: cleared!`, 'Nothing left here. Nicely done.'],
    ['List complete!', `Every task in “${listName}” is checked off.`],
  ];
  return options[Math.floor(Math.random() * options.length)];
}

export function Celebration({ onDone, message: custom }: { onDone: () => void; message?: [string, string] | null }) {
  const { width: windowWidth, height } = useWindowDimensions();
  const width = Math.min(windowWidth, Layout.maxWidth);

  const [t] = useState(() => new Animated.Value(0)); // 0 -> 1 across the whole shower
  const [card] = useState(() => new Animated.Value(0)); // 0 hidden, 1 shown
  const [message] = useState(() => custom ?? MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: PIECES }, () => {
      const size = rand(7, 12);
      return {
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        w: size,
        h: Math.random() < 0.5 ? size : size * rand(0.45, 0.7),
        round: Math.random() < 0.25,
        x0: rand(0, width),
        sway: rand(10, 34),
        drift: rand(-50, 50),
        spin: (Math.random() < 0.5 ? -1 : 1) * rand(360, 1000),
        delay: Math.random() * 0.35,
        flutter: Math.floor(rand(2, 5)),
      };
    }),
  );

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      setReduceMotion(reduce);
      if (!reduce) {
        // Linear: confetti falls at a steady terminal speed instead of bunching up at the bottom.
        Animated.timing(t, { toValue: 1, duration: DURATION, easing: Easing.linear, useNativeDriver: native }).start();
      }
    });
    Animated.sequence([
      Animated.spring(card, { toValue: 1, friction: 6, tension: 90, useNativeDriver: native }),
      Animated.delay(LIFETIME - 1300),
      Animated.timing(card, { toValue: 0, duration: 450, useNativeDriver: native }),
    ]).start();
    const done = setTimeout(onDone, LIFETIME);
    return () => {
      cancelled = true;
      clearTimeout(done);
    };
  }, [t, card, onDone]);

  const cardScale = card.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const cardRise = card.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <View pointerEvents="none" style={styles.root}>
      {!reduceMotion &&
        pieces.map((p, i) => {
          const d = p.delay;
          const span = 1 - d;
          const translateY = t.interpolate({ inputRange: [0, d, 1], outputRange: [-30, -30, height + 40] });
          const translateX = t.interpolate({
            inputRange: [0, d, d + span * 0.25, d + span * 0.5, d + span * 0.75, 1],
            outputRange: [p.x0, p.x0, p.x0 + p.sway, p.x0, p.x0 - p.sway, p.x0 + p.drift],
          });
          const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] });
          const flipStops = p.flutter * 2 + 1;
          const scaleY = t.interpolate({
            inputRange: Array.from({ length: flipStops }, (_, k) => k / (flipStops - 1)),
            outputRange: Array.from({ length: flipStops }, (_, k) => (k % 2 === 0 ? 1 : 0.15)),
          });
          const opacity = t.interpolate({ inputRange: [0, d, d + 0.01, 0.82, 1], outputRange: [0, 0, 1, 1, 0] });
          return (
            <Animated.View
              key={i}
              style={[
                styles.piece,
                {
                  width: p.w,
                  height: p.h,
                  borderRadius: p.round ? p.w / 2 : 2,
                  backgroundColor: p.color,
                  opacity,
                  transform: [{ translateX }, { translateY }, { rotate }, { scaleY }],
                },
              ]}
            />
          );
        })}

      <Animated.View style={[styles.card, { opacity: card, transform: [{ translateY: cardRise }, { scale: cardScale }] }]}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>{message[0]}</Text>
        <Text style={styles.subtitle}>{message[1]}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 60,
    alignItems: 'center',
    overflow: 'hidden',
  },
  piece: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  card: {
    marginTop: '32%',
    maxWidth: 320,
    paddingVertical: 24,
    paddingHorizontal: 28,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    gap: 6,
    boxShadow: '0px 12px 32px rgba(0, 0, 0, 0.18)',
  },
  emoji: {
    fontSize: 44,
    lineHeight: 54,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 28,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.light,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
