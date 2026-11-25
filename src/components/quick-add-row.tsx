import { type ComponentRef, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { todayKey } from '@/lib/dates';
import { useTodoStore } from '@/store/todo-store';

type QuickAddRowProps = {
  /** New tasks go into this list, dated today. */
  listId: string;
  /** Lets the screen make room for the keyboard while the row is being used. */
  onFocusChange?: (focused: boolean) => void;
};

/**
 * An always-there "new task" row at the end of a list. Type a name and press Enter / return: the task is added
 * and the row clears, still focused and ready for the next one. Pressing Enter on an empty row stops adding.
 */
export function QuickAddRow({ listId, onFocusChange }: QuickAddRowProps) {
  const addTask = useTodoStore((s) => s.addTask);
  const [text, setText] = useState('');
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  const submit = () => {
    const title = text.trim();
    if (!title) {
      input.current?.blur(); // Enter on an empty row = done adding
      return;
    }
    addTask({ title, listId, date: todayKey() });
    setText('');
    // Stay in the row for the next task, and keep it in view as the list grows.
    setTimeout(() => {
      input.current?.focus();
      if (Platform.OS === 'web') {
        (input.current as unknown as HTMLElement | null)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      }
    }, 30);
  };

  return (
    <View style={styles.row}>
      <View style={styles.circle}>
        <Text style={styles.plus}>+</Text>
      </View>
      <TextInput
        ref={input}
        style={styles.input}
        placeholder="Add a task"
        placeholderTextColor={Colors.textSecondary}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        submitBehavior="submit" // keep the keyboard open after Enter
        returnKeyType="next"
        enterKeyHint="next"
        accessibilityLabel="Add a task"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  circle: {
    width: 33,
    height: 33,
    borderRadius: 16.5,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.checkboxBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    fontFamily: Fonts.light,
    fontSize: 20,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
    padding: 0,
    fontFamily: Fonts.light,
    fontSize: 16,
    color: Colors.text,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
});
