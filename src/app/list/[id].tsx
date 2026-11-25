import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CountBadge, Screen, SectionTitle } from '@/components/screen';
import { SortableTasks } from '@/components/sortable-tasks';
import { TaskRow } from '@/components/task-row';
import { Colors, Fonts } from '@/constants/theme';
import { confirm } from '@/lib/confirm';
import { sortTasks, useTodoStore } from '@/store/todo-store';

/** Tasks of one list, or of every list when id is "all". */
export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tasks = useTodoStore((s) => s.tasks);
  const list = useTodoStore((s) => s.lists.find((l) => l.id === id));
  const deleteList = useTodoStore((s) => s.deleteList);

  const isAll = id === 'all';
  const { open, done } = useMemo(() => {
    const sorted = sortTasks(isAll ? tasks : tasks.filter((t) => t.listId === id));
    return { open: sorted.filter((t) => !t.done), done: sorted.filter((t) => t.done) };
  }, [tasks, id, isAll]);

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
        headerRight={
          <Pressable onPress={back} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        }>
        <View style={styles.tasks}>
          {open.length === 0 && <Text style={styles.empty}>No open tasks.</Text>}
          <SortableTasks tasks={open} />
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
