import { Image } from 'expo-image';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { navBarPath, NAV_SHAPE_HEIGHT } from '@/components/nav-shapes';
import { Colors, Layout } from '@/constants/theme';

export const TABS = [
  { name: 'today', href: '/', label: 'Today', icon: require('@/assets/figma/icon-check.png') },
  { name: 'upcoming', href: '/upcoming', label: 'Upcoming', icon: require('@/assets/figma/icon-calendar.png') },
  { name: 'lists', href: '/lists', label: 'Lists', icon: require('@/assets/figma/icon-list.png') },
  { name: 'profile', href: '/profile', label: 'Profile', icon: require('@/assets/figma/icon-user.png') },
] as const;

/** Icon x positions inside the 385px-wide Figma bar; the right pair is anchored to the right edge. */
const ICON_X = [28, 91, -122, -59];
const ICON_TOP = 13;
const ICON_SIZE = 25;

type BottomNavProps = {
  width: number;
  bottom: number;
};

/** "Bottom Nav Bar" from Figma. The + button is rendered separately so it can sit above the Add Task overlay. */
export function BottomNav({ width, bottom }: BottomNavProps) {
  return (
    <View style={[styles.bar, { width, bottom }]}>
      <Svg width={width} height={NAV_SHAPE_HEIGHT} style={StyleSheet.absoluteFill}>
        <Path d={navBarPath(width)} fill={Colors.surface} />
      </Svg>
      {TABS.map((tab, i) => {
        const x = ICON_X[i];
        return (
          <TabTrigger key={tab.name} name={tab.name} asChild>
            <NavButton icon={tab.icon} label={tab.label} left={x >= 0 ? x : width + x} />
          </TabTrigger>
        );
      })}
    </View>
  );
}

type NavButtonProps = Omit<TabTriggerSlotProps, 'ref'> & {
  icon: number;
  label: string;
  left: number;
};

function NavButton({ icon, label, left, isFocused, ...props }: NavButtonProps) {
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      hitSlop={10}
      style={[styles.button, { left }]}>
      <Image source={icon} style={styles.icon} contentFit="contain" />
      {isFocused && (
        <Image source={require('@/assets/figma/active-tab.svg')} style={styles.activeDot} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    alignSelf: 'center',
    height: Layout.navBarHeight,
  },
  button: {
    position: 'absolute',
    top: ICON_TOP,
    width: ICON_SIZE,
    height: ICON_SIZE + 13,
    alignItems: 'center',
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  activeDot: {
    marginTop: 3,
    width: 5,
    height: 5,
  },
});
