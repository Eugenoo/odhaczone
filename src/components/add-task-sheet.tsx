import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { NAV_SHAPE_HEIGHT, sheetNotchPath } from '@/components/nav-shapes';
import { Colors, Fonts, ListColors } from '@/constants/theme';
import { addDays, formatChipDate, formatTime, todayKey } from '@/lib/dates';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useTodoStore } from '@/store/todo-store';

const DAYS_AHEAD = 14;
const TIMES = Array.from({ length: 36 }, (_, i) => {
  const minutes = 6 * 60 + i * 30; // 06:00 … 23:30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

type AddTaskSheetProps = {
  width: number;
  /** Distance from the bottom of the screen to the bottom of the notch. */
  bottom: number;
  onClose: () => void;
};

/** "Add Task" component from Figma: a card that rises out of the + button. */
export function AddTaskSheet({ width, bottom, onClose }: AddTaskSheetProps) {
  const lists = useTodoStore((s) => s.lists);
  const addTask = useTodoStore((s) => s.addTask);

  const [title, setTitle] = useState('');
  const [listId, setListId] = useState(lists[0]?.id ?? '');
  const [listOpen, setListOpen] = useState(false);
  const [date, setDate] = useState(todayKey);
  const [time, setTime] = useState<string | undefined>();

  const insets = useSafeAreaInsets();

  // The sheet stays docked above the nav bar; when the keyboard opens it slides up just enough to sit on top of it.
  const keyboardHeight = useKeyboardHeight();
  const [lift] = useState(() => new Animated.Value(0)); // px the sheet is raised
  const [areaHeight, setAreaHeight] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const maxLift = Math.max(0, areaHeight - bottom - sheetHeight - (insets.top + 8)); // never past the top edge
  const wantedLift = keyboardHeight > 0 ? Math.max(0, keyboardHeight + 8 - NAV_SHAPE_HEIGHT - bottom) : 0; // card (not the notch) rests on the keyboard
  const liftTarget = Math.min(wantedLift, maxLift);
  const translateY = Animated.multiply(lift, -1);
  const notchOpacity = lift.interpolate({ inputRange: [0, 20], outputRange: [1, 0], extrapolate: 'clamp' });

  useEffect(() => {
    Animated.timing(lift, {
      toValue: liftTarget,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [lift, liftTarget]);

  const selectedList = lists.find((l) => l.id === listId);
  const canAdd = title.trim().length > 0 && !!selectedList;
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(todayKey(), i));

  const submit = () => {
    if (!canAdd) return;
    addTask({ title: title.trim(), listId, date, time });
    onClose();
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View
        style={[styles.avoider, { paddingBottom: bottom }]}
        pointerEvents="box-none"
        onLayout={(e) => setAreaHeight(e.nativeEvent.layout.height)}>
        <Animated.View
          style={{ width, transform: [{ translateY }] }}
          onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}>
          <View style={styles.card}>
            <TextInput
              style={styles.pill}
              placeholder="Task name"
              placeholderTextColor={Colors.textSecondary}
              value={title}
              onChangeText={setTitle}
              onSubmitEditing={submit}
              returnKeyType="done"
              autoFocus
            />

            <Pressable style={styles.pill} onPress={() => setListOpen((o) => !o)}>
              {selectedList ? (
                <View style={styles.pillRow}>
                  <View style={[styles.dot, { backgroundColor: ListColors[selectedList.color].strong }]} />
                  <Text style={styles.pillText}>{selectedList.name}</Text>
                </View>
              ) : (
                <Text style={styles.placeholder}>list</Text>
              )}
            </Pressable>
            {listOpen && (
              <ChipRow>
                {lists.map((l) => (
                  <Chip
                    key={l.id}
                    label={l.name}
                    color={ListColors[l.color].light}
                    selected={l.id === listId}
                    onPress={() => {
                      setListId(l.id);
                      setListOpen(false);
                    }}
                  />
                ))}
              </ChipRow>
            )}

            <Text style={styles.label}>date</Text>
            <ChipRow>
              {days.map((d) => (
                <Chip key={d} label={formatChipDate(d)} selected={d === date} onPress={() => setDate(d)} />
              ))}
            </ChipRow>
            <ChipRow>
              <Chip label="No time" selected={!time} onPress={() => setTime(undefined)} />
              {TIMES.map((t) => (
                <Chip key={t} label={formatTime(t)} selected={t === time} onPress={() => setTime(t)} />
              ))}
            </ChipRow>

            <Pressable
              style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
              onPress={submit}
              disabled={!canAdd}
              accessibilityRole="button">
              <Text style={styles.addText}>add</Text>
            </Pressable>
          </View>
          <Animated.View style={{ opacity: notchOpacity }}>
            <Svg
              width={width}
              height={NAV_SHAPE_HEIGHT}
              style={{ transform: [{ rotate: '180deg' }] }}>
              <Path d={sheetNotchPath(width)} fill={Colors.surface} />
            </Svg>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipScroll}
      contentContainerStyle={styles.chipRow}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

function Chip({
  label,
  selected,
  color,
  onPress,
}: {
  label: string;
  selected: boolean;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        color ? { backgroundColor: color } : null,
        selected && styles.chipSelected,
      ]}>
      <Text style={[styles.chipText, selected && !color && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  avoider: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingTop: 43,
    paddingBottom: 8,
    paddingHorizontal: 34,
    gap: 16,
    alignItems: 'stretch',
  },
  pill: {
    height: 40,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: Colors.text,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 20,
    color: Colors.text,
    paddingHorizontal: 16,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillText: {
    fontFamily: Fonts.regular,
    fontSize: 20,
    color: Colors.text,
  },
  placeholder: {
    fontFamily: Fonts.regular,
    fontSize: 20,
    color: Colors.textSecondary,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  label: {
    fontFamily: Fonts.regular,
    fontSize: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: -8,
  },
  chipScroll: {
    flexGrow: 0,
    marginHorizontal: -34,
  },
  chipRow: {
    gap: 8,
    paddingHorizontal: 34,
  },
  chip: {
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: Colors.checkboxFill,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: Colors.text,
  },
  chipText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.text,
  },
  chipTextSelected: {
    fontFamily: Fonts.semiBold,
  },
  addButton: {
    marginTop: 8,
    height: 40,
    borderRadius: 25,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.45,
  },
  addText: {
    fontFamily: Fonts.regular,
    fontSize: 20,
    color: Colors.surface,
  },
});
