import { type ComponentRef, type ReactNode, useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Layout } from '@/constants/theme';

type ScreenProps = {
  /** Small grey line above the title ("Today", "Organize", …). */
  label: string;
  title: string;
  /** Rendered at the right of the header (e.g. the progress ring). */
  headerRight?: ReactNode;
  /** Space between the header and the content. */
  contentGap?: number;
  /** When set, tapping any empty part of the screen calls this (used to cancel an open inline editor). */
  onBackgroundPress?: () => void;
  /** Overrides the space below the content (e.g. to keep it clear of a keyboard + docked bar) and scrolls to the end. */
  bottomPadding?: number;
  children: ReactNode;
};

export function Screen({ label, title, headerRight, contentGap = 20, onBackgroundPress, bottomPadding, children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 34 : insets.top + 16;
  const navClearance = Layout.navBarHeight + Math.max(insets.bottom, Layout.navBarBottomInset) + Layout.navBarLift + 48;
  const bottom = bottomPadding ?? navClearance;

  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    if (bottomPadding === undefined) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [bottomPadding]);

  const body = (
    <>
      <View style={[styles.header, { marginBottom: contentGap }]}>
        <View style={styles.headerText}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {headerRight}
      </View>
      <View style={styles.content}>{children}</View>
    </>
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={[{ paddingTop: top, paddingBottom: bottom }, onBackgroundPress && styles.grow]}
      keyboardShouldPersistTaps="handled">
      {onBackgroundPress ? (
        <Pressable style={styles.grow} onPress={onBackgroundPress} accessible={false}>
          {body}
        </Pressable>
      ) : (
        body
      )}
    </ScrollView>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function CountBadge({ count, size = 'md' }: { count: number; size?: 'md' | 'sm' }) {
  return (
    <View style={styles.badge}>
      <Text style={[styles.badgeText, size === 'sm' && styles.badgeTextSm]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: {
    flexGrow: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.screenPadding,
  },
  headerText: {
    flexShrink: 1,
    gap: 5,
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.textSecondary,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 32,
    color: Colors.text,
  },
  content: {
    paddingHorizontal: Layout.screenPadding,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.textSecondary,
  },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: Fonts.light,
    fontSize: 16,
    color: Colors.text,
  },
  badgeTextSm: {
    fontSize: 15,
  },
});
