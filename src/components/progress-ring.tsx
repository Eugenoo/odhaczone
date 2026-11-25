import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Colors, Fonts } from '@/constants/theme';

const SIZE = 80;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** "Progress" component: share of today's tasks that are done. Glides to the new value when it changes. */
export function ProgressRing({ value }: { value: number }) {
  const target = Math.min(1, Math.max(0, value));

  const [anim] = useState(() => new Animated.Value(target));
  const [shown, setShown] = useState(target); // the value currently drawn, updated every animation frame
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(v));
    return () => anim.removeListener(id);
  }, [anim]);
  useEffect(() => {
    Animated.timing(anim, {
      toValue: target,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // drives SVG props / text through state, so it can't run on the native thread
    }).start();
  }, [anim, target]);

  return (
    <View style={styles.container} accessibilityLabel={`${Math.round(target * 100)}% done`}>
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill={Colors.checkboxFill} stroke={Colors.muted} strokeWidth={STROKE} />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={Colors.accent}
          strokeWidth={STROKE}
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={CIRCUMFERENCE * (1 - shown)}
          strokeLinecap={shown > 0.005 && shown < 0.995 ? 'round' : 'butt'}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <Text style={styles.label}>{Math.round(shown * 100)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.text,
  },
});
