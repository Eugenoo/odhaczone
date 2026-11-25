import { Image } from 'expo-image';
import { router } from 'expo-router';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Screen } from '@/components/screen';
import { Colors, Fonts, type ListColor, ListColors } from '@/constants/theme';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { type TodoList, useTodoStore } from '@/store/todo-store';
import { useUiStore } from '@/store/ui-store';

/** "List" frame: All Tasks, one card per list, and the dashed "New List" card. */
export default function ListsScreen() {
  const lists = useTodoStore((s) => s.lists);
  const tasks = useTodoStore((s) => s.tasks);

  const addList = useTodoStore((s) => s.addList);
  const setNavHidden = useUiStore((s) => s.setNavHidden);

  // While the "New List" card is open, tapping anything else just cancels it instead of navigating,
  // the nav bar slides away, and the colour picker docks above the keyboard.
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<ListColor>('orange');
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    setNavHidden(creating);
    return () => setNavHidden(false);
  }, [creating, setNavHidden]);

  const cancelCreating = () => {
    setCreating(false);
    setName('');
    setColor('orange');
  };
  const save = () => {
    if (name.trim()) addList(name.trim(), color);
    cancelCreating();
  };
  const guard = (action: () => void) => () => (creating ? cancelCreating() : action());

  return (
    <View style={styles.root}>
      <Screen
        label="Organize"
        title="Your List"
        contentGap={23}
        onBackgroundPress={creating ? cancelCreating : undefined}
        // Keep the content clear of the keyboard and the colour bar docked above it.
        bottomPadding={creating ? Math.max(keyboardHeight, insets.bottom + 12) + COLOR_BAR_HEIGHT + 16 : undefined}>
        <View style={styles.cards}>
          <Pressable style={styles.allTasks} onPress={guard(() => router.push('/list/all'))} accessibilityRole="button">
            <Image source={require('@/assets/figma/icon-stack.png')} style={styles.stackIcon} />
            <Text style={styles.allTasksText}>All Tasks</Text>
          </Pressable>

          {lists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              count={tasks.filter((t) => t.listId === list.id && !t.done).length}
              onPress={guard(() => router.push({ pathname: '/list/[id]', params: { id: list.id } }))}
            />
          ))}

          <NewListCard
            editing={creating}
            onStart={() => setCreating(true)}
            name={name}
            onNameChange={setName}
            color={color}
            inputRef={inputRef}
            onSubmit={save}
          />
        </View>
      </Screen>
      {creating && <ColorBar color={color} onColor={setColor} onSave={save} inputRef={inputRef} />}
    </View>
  );
}

function ListCard({ list, count, onPress }: { list: TodoList; count: number; onPress: () => void }) {
  const { strong, light } = ListColors[list.color];
  return (
    <Pressable
      style={[styles.card, { backgroundColor: light }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${list.name}, ${count} open tasks`}>
      <View style={[styles.cardDot, { backgroundColor: strong }]} />
      <Text style={[styles.cardTitle, { color: strong }]} numberOfLines={1}>
        {list.name}
      </Text>
      <Text style={[styles.cardCount, { color: strong }]}>{count}</Text>
      <Svg width={8} height={14} viewBox="0 0 8 14">
        <Path d="M1 1l6 6-6 6" stroke={strong} strokeWidth={2} fill="none" />
      </Svg>
    </Pressable>
  );
}

const COLOR_KEYS = Object.keys(ListColors) as ListColor[];
const COLOR_BAR_HEIGHT = 60;

type InputRef = React.RefObject<ComponentRef<typeof TextInput> | null>;

function NewListCard({
  editing,
  onStart,
  name,
  onNameChange,
  color,
  inputRef,
  onSubmit,
}: {
  editing: boolean;
  onStart: () => void;
  name: string;
  onNameChange: (name: string) => void;
  color: ListColor;
  inputRef: InputRef;
  onSubmit: () => void;
}) {
  if (!editing) {
    return (
      <Pressable style={[styles.card, styles.newCard]} onPress={onStart} accessibilityRole="button">
        <View style={[styles.cardDot, { backgroundColor: Colors.muted }]} />
        <Text style={[styles.cardTitle, { color: Colors.muted }]}>New List</Text>
      </Pressable>
    );
  }

  return (
    // A Pressable so taps inside the card are claimed here and don't reach the screen's "tap outside to cancel".
    <Pressable style={[styles.card, styles.newCard]} onPress={() => {}} accessible={false}>
      <View style={[styles.cardDot, { backgroundColor: ListColors[color].strong }]} />
      <TextInput
        ref={inputRef}
        style={[styles.cardTitle, styles.input, { color: ListColors[color].strong }]}
        placeholder="List name"
        placeholderTextColor={Colors.muted}
        value={name}
        onChangeText={onNameChange}
        onSubmitEditing={onSubmit}
        returnKeyType="done"
        autoFocus
      />
    </Pressable>
  );
}

/** Colour picker + save, docked right above the keyboard. */
function ColorBar({
  color,
  onColor,
  onSave,
  inputRef,
}: {
  color: ListColor;
  onColor: (color: ListColor) => void;
  onSave: () => void;
  inputRef: InputRef;
}) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const rowRef = useRef<ComponentRef<typeof View>>(null);

  // Rests near the bottom of the screen without a keyboard, and slides up to sit on the keyboard when it opens.
  const bottomTarget = keyboardHeight > 0 ? keyboardHeight : insets.bottom + 12;
  const [bottom] = useState(() => new Animated.Value(bottomTarget));
  useEffect(() => {
    Animated.timing(bottom, {
      toValue: bottomTarget,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [bottom, bottomTarget]);

  // Tapping a colour must not take focus from the name field, or the keyboard drops and pops back up.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = rowRef.current as unknown as HTMLElement | null;
    const keepFocus = (e: Event) => e.preventDefault();
    el?.addEventListener('mousedown', keepFocus);
    return () => el?.removeEventListener('mousedown', keepFocus);
  }, []);

  return (
    <Animated.View style={[styles.colorBar, { bottom }]}>
      <View ref={rowRef} style={styles.swatches}>
        {COLOR_KEYS.map((key) => (
          <Pressable
            key={key}
            onPress={() => {
              onColor(key);
              inputRef.current?.focus(); // fallback if the platform still moved focus away
            }}
            accessibilityLabel={key}
            style={[
              styles.swatch,
              { backgroundColor: ListColors[key].strong },
              key === color && styles.swatchSelected,
            ]}
          />
        ))}
        <Pressable onPress={onSave} style={styles.saveButton} accessibilityRole="button">
          <Text style={styles.saveText}>save</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  cards: {
    gap: 24,
  },
  allTasks: {
    height: 70,
    borderRadius: 25,
    backgroundColor: Colors.allTasks,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    gap: 19,
  },
  stackIcon: {
    width: 50,
    height: 50,
  },
  allTasksText: {
    fontFamily: Fonts.semiBold,
    fontSize: 32,
    color: Colors.surface,
  },
  card: {
    height: 100,
    borderRadius: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 34,
    paddingRight: 22,
    gap: 16,
  },
  cardDot: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  cardTitle: {
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: 24,
  },
  cardCount: {
    fontFamily: Fonts.semiBold,
    fontSize: 24,
    marginRight: 12,
  },
  newCard: {
    backgroundColor: Colors.dashedFill,
    borderWidth: 4,
    borderStyle: 'dashed',
    borderColor: Colors.dashed,
    paddingLeft: 30,
  },
  input: {
    minWidth: 0, // let the field shrink inside the card instead of overflowing it
    padding: 0,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  colorBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    backgroundColor: Colors.surface,
    boxShadow: '0px -6px 20px rgba(0, 0, 0, 0.10)',
  },
  swatches: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: Colors.surface,
    outlineWidth: 1,
    outlineColor: Colors.text,
    outlineStyle: 'solid',
  },
  saveButton: {
    marginLeft: 'auto',
    height: 30,
    paddingHorizontal: 16,
    borderRadius: 15,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
  },
  saveText: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: Colors.surface,
  },
});
