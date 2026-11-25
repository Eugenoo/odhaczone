import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, ListColors } from '@/constants/theme';
import { confirm } from '@/lib/confirm';
import { formatTime } from '@/lib/dates';
import { type Task, useTodoStore } from '@/store/todo-store';

/** "Task 1" / "Completed Task" components from Figma. Tap the circle to toggle. Delete: ✕ on web (long-press is used for drag-to-reorder there), long-press on native. */
export function TaskRow({ task }: { task: Task }) {
  const list = useTodoStore((s) => s.lists.find((l) => l.id === task.listId));
  const toggleTask = useTodoStore((s) => s.toggleTask);
  const deleteTask = useTodoStore((s) => s.deleteTask);

  const tagColor = list ? ListColors[list.color].light : Colors.muted;

  const onDelete = async () => {
    if (await confirm('Delete task?', `"${task.title}" will be removed.`, 'Delete')) {
      deleteTask(task.id);
    }
  };
  const isWeb = Platform.OS === 'web';

  return (
    <Pressable
      style={styles.row}
      onLongPress={isWeb ? undefined : onDelete}
      accessible={false}>
      <Pressable
        onPress={() => toggleTask(task.id)}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityLabel={task.title}
        style={[styles.checkbox, task.done && styles.checkboxDone]}
      />
      <View style={styles.body}>
        <Text style={[styles.title, task.done && styles.titleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        <View style={styles.meta}>
          {list && (
            <View style={[styles.tag, { backgroundColor: tagColor }]}>
              <Text style={styles.tagText}>{list.name.toLowerCase()}</Text>
            </View>
          )}
          {task.time && !task.done && <Text style={styles.time}>{formatTime(task.time)}</Text>}
        </View>
      </View>
      {isWeb && (
        <Pressable
          onPress={onDelete}
          hitSlop={10}
          style={styles.remove}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${task.title}`}>
          <Text style={styles.removeText}>✕</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  checkbox: {
    width: 33,
    height: 33,
    borderRadius: 16.5,
    borderWidth: 1,
    borderColor: Colors.checkboxBorder,
    backgroundColor: Colors.checkboxFill,
  },
  checkboxDone: {
    backgroundColor: Colors.accent,
  },
  remove: {
    marginLeft: 'auto',
    paddingHorizontal: 4,
  },
  removeText: {
    fontFamily: Fonts.light,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  body: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    fontFamily: Fonts.light,
    fontSize: 16,
    color: Colors.text,
  },
  titleDone: {
    color: Colors.textDone,
    textDecorationLine: 'line-through',
    textDecorationColor: Colors.strike,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tag: {
    height: 15,
    paddingHorizontal: 10,
    borderRadius: 7.5,
    justifyContent: 'center',
  },
  tagText: {
    fontFamily: Fonts.light,
    fontSize: 10,
    color: Colors.text,
  },
  time: {
    fontFamily: Fonts.light,
    fontSize: 12,
    color: Colors.text,
  },
});
