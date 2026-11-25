import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listMessage } from '@/components/celebration';
import { QuickAddRow } from '@/components/quick-add-row';
import { CountBadge, Screen, SectionTitle } from '@/components/screen';
import { SortableTasks } from '@/components/sortable-tasks';
import { TaskRow } from '@/components/task-row';
import { Colors, Fonts } from '@/constants/theme';
import { confirm } from '@/lib/confirm';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { finishedAt, isEarlier, isFinishedToday, sortTasks, useTodoStore } from '@/store/todo-store';
import { useUiStore } from '@/store/ui-store';

/** Tasks of one list, or of every list when id is "all". */
export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tasks = useTodoStore((s) => s.tasks);
  const list = useTodoStore((s) => s.lists.find((l) => l.id === id));
  const deleteList = useTodoStore((s) => s.deleteList);

  const isAll = id === 'all';
  // Open tasks; finished today (stay visible); finished on earlier days (tucked into a collapsed section).
  const { open, done, earlier } = useMemo(() => {
    const sorted = sortTasks(isAll ? tasks : tasks.filter((t) => t.listId === id));
    return {
      open: sorted.filter((t) => !t.done),
      done: sorted.filter((t) => isFinishedToday(t)),
      earlier: sorted.filter((t) => isEarlier(t)).sort((a, b) => finishedAt(b) - finishedAt(a)),
    };
  }, [tasks, id, isAll]);
  const [showEarlier, setShowEarlier] = useState(false);
  const clearEarlier = useTodoStore((s) => s.clearEarlier);

  const onClearEarlier = async () => {
    if (await confirm('Clear earlier tasks?', `${earlier.length} finished task${earlier.length === 1 ? '' : 's'} will be deleted.`, 'Clear')) {
      clearEarlier(isAll ? undefined : id);
      setShowEarlier(false);
    }
  };

  // Quick-add: make room for the keyboard while the "Add a task" row is focused.
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const [quickAdding, setQuickAdding] = useState(false);

  // Celebrate when the last open task of this list gets ticked off (not on load, and not when one is deleted).
  const celebrate = useUiStore((s) => s.celebrate);
  const listName = list?.name;
  const previous = useRef({ id, open: open.length, done: done.length });
  useEffect(() => {
    const before = previous.current;
    previous.current = { id, open: open.length, done: done.length };
    if (before.id === id && !isAll && listName && before.open > 0 && open.length === 0 && done.length > before.done) {
      celebrate(listMessage(listName));
    }
  }, [id, isAll, listName, open.length, done.length, celebrate]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/lists'));

  const onDelete = async () => {
    if (!list) return;
    if (await confirm('Delete list?', `"${list.name}" and all its tasks will be removed.`, 'Delete')) {
      deleteList(list.id);
      back();
    }
  };

  return (
    <View style={styles.root}>
      <Screen
        label="List"
        title={isAll ? 'All Tasks' : (list?.name ?? 'Not found')}
        contentGap={30}
        bottomPadding={quickAdding ? Math.max(keyboard, insets.bottom + 12) + 90 : undefined}
        scrollOnPadding={Platform.OS !== 'web'}
        headerRight={
          <Pressable onPress={back} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        }>
        <View style={styles.tasks}>
          {open.length === 0 && (isAll || !list) && <Text style={styles.empty}>No open tasks.</Text>}
          <SortableTasks tasks={open} />
          {list && <QuickAddRow listId={list.id} onFocusChange={setQuickAdding} />}
        </View>

        {done.length > 0 && (
          <>
            <View style={styles.completedHeader}>
              <SectionTitle>completed</SectionTitle>
              <CountBadge count={done.length} />
            </View>
            <View style={styles.tasks}>
              {done.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </View>
          </>
        )}

        {earlier.length > 0 && (
          <>
            <View style={styles.earlierHeader}>
              <Pressable
                style={styles.earlierToggle}
                onPress={() => setShowEarlier((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showEarlier }}>
                <SectionTitle>earlier</SectionTitle>
                <CountBadge count={earlier.length} />
                <Text style={styles.chevron}>{showEarlier ? '▴' : '▾'}</Text>
              </Pressable>
              <Pressable onPress={onClearEarlier} hitSlop={8} accessibilityRole="button">
                <Text style={styles.clear}>Clear</Text>
              </Pressable>
            </View>
            {showEarlier && (
              <View style={styles.tasks}>
                {earlier.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </View>
            )}
          </>
        )}

        {list && (
          <Pressable onPress={onDelete} style={styles.deleteList} accessibilityRole="button">
            <Text style={styles.deleteText}>Delete list</Text>
          </Pressable>
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backText: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  tasks: {
    gap: 27,
    zIndex: 1, // a lifted task being dragged paints above the "completed" header
  },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginTop: 30,
    marginBottom: 24,
  },
  earlierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 30,
    marginBottom: 20,
  },
  earlierToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  chevron: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  clear: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  empty: {
    fontFamily: Fonts.light,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  deleteList: {
    marginTop: 48,
  },
  deleteText: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: Colors.danger,
  },
});
