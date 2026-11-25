import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ProgressRing } from '@/components/progress-ring';
import { CountBadge, Screen, SectionTitle } from '@/components/screen';
import { SortableTasks } from '@/components/sortable-tasks';
import { TaskRow } from '@/components/task-row';
import { Colors, Fonts } from '@/constants/theme';
import { formatShortDate, todayKey } from '@/lib/dates';
import { sortTasks, useTodoStore } from '@/store/todo-store';

/** "Main" frame: today's tasks (plus overdue ones), progress, and what's done today. */
export default function TodayScreen() {
  const tasks = useTodoStore((s) => s.tasks);
  const today = todayKey();

  const { open, done } = useMemo(() => {
    const sorted = sortTasks(tasks);
    return {
      open: sorted.filter((t) => !t.done && t.date <= today),
      done: sorted.filter((t) => t.done && t.date === today),
    };
  }, [tasks, today]);

  const todayTotal = open.filter((t) => t.date === today).length + done.length;
  const progress = todayTotal === 0 ? 0 : done.length / todayTotal;

  return (
    <Screen
      label="Today"
      title={formatShortDate(today)}
      headerRight={<ProgressRing value={progress} />}
      contentGap={44}>
      <View style={styles.list}>
        {open.length === 0 && done.length === 0 && (
          <Text style={styles.empty}>Nothing planned. Tap + to add a task.</Text>
        )}
        <SortableTasks tasks={open} />
      </View>

      {done.length > 0 && (
        <>
          <View style={styles.completedHeader}>
            <SectionTitle>completed</SectionTitle>
            <CountBadge count={done.length} />
          </View>
          <View style={styles.list}>
            {done.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
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
});
