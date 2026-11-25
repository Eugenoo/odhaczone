import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';

type NavFadeProps = {
  /** Total height from the bottom of the screen up to where the fade starts. */
  height: number;
  /** How tall the soft part of the fade is; below it the background is solid. */
  fade?: number;
};

/**
 * Background-coloured gradient behind the nav bar: content scrolling up fades out smoothly just above the
 * + button instead of sliding under the bar. Ignores touches, so the content stays scrollable.
 */
export function NavFade({ height, fade = 60 }: NavFadeProps) {
  const f = Math.min(1, fade / height); // gradient occupies the top `fade` px, solid below
  const bg = Colors.background;
  return (
    <View pointerEvents="none" style={[styles.root, { height }]}>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id="navFade" x1="0" y1="0" x2="0" y2="1">
            {/* Several eased stops so there is no visible hard edge where the fade starts. */}
            <Stop offset="0" stopColor={bg} stopOpacity="0" />
            <Stop offset={f * 0.25} stopColor={bg} stopOpacity="0.2" />
            <Stop offset={f * 0.55} stopColor={bg} stopOpacity="0.62" />
            <Stop offset={f * 0.8} stopColor={bg} stopOpacity="0.9" />
            <Stop offset={f} stopColor={bg} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} fill="url(#navFade)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
