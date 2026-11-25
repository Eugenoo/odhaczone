import { Image } from 'expo-image';
import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddTaskSheet } from '@/components/add-task-sheet';
import { BottomNav, TABS } from '@/components/bottom-nav';
import { Layout } from '@/constants/theme';
import { useUiStore } from '@/store/ui-store';

export default function TabsLayout() {
  const [adding, setAdding] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const columnWidth = Math.min(windowWidth, Layout.maxWidth);
  const navWidth = columnWidth - Layout.navBarSideInset * 2;
  const navBottom = Math.max(insets.bottom, Layout.navBarBottomInset) + Layout.navBarLift;
  const navTop = navBottom + Layout.navBarHeight;

  // Screens can slide the nav bar and + button down out of view (e.g. while creating a list).
  const navHidden = useUiStore((s) => s.navHidden);
  const [hide] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(hide, {
      toValue: navHidden ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [hide, navHidden]);
  const hideY = hide.interpolate({ inputRange: [0, 1], outputRange: [0, navTop + Layout.mainButtonSize] });
  const slideStyle = [StyleSheet.absoluteFill, { transform: [{ translateY: hideY }] }];
  const slidePointer = navHidden ? 'none' : 'box-none';

  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.slot} />

      {/* Route registration only; the visible bar is <BottomNav>. */}
      <TabList style={styles.hidden}>
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} />
        ))}
      </TabList>

      <Animated.View style={slideStyle} pointerEvents={slidePointer}>
        <BottomNav width={navWidth} bottom={navBottom} />
      </Animated.View>

      {adding && (
        <AddTaskSheet
          width={columnWidth - 20}
          bottom={navTop + 6}
          onClose={() => setAdding(false)}
        />
      )}

      <Animated.View style={slideStyle} pointerEvents={slidePointer}>
        <Pressable
          onPress={() => setAdding((a) => !a)}
          accessibilityRole="button"
          accessibilityLabel={adding ? 'Close add task' : 'Add task'}
          style={[styles.mainButton, { bottom: navTop - Layout.mainButtonSize / 2 }]}>
          <View style={adding && styles.rotated}>
            <Image source={require('@/assets/figma/main-button.svg')} style={styles.mainButtonImage} />
          </View>
        </Pressable>
      </Animated.View>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  slot: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
  mainButton: {
    position: 'absolute',
    alignSelf: 'center',
    width: Layout.mainButtonSize,
    height: Layout.mainButtonSize,
  },
  rotated: {
    transform: [{ rotate: '45deg' }],
  },
  mainButtonImage: {
    width: Layout.mainButtonSize,
    height: Layout.mainButtonSize,
  },
});
