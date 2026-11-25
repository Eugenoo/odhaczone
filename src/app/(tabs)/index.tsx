import { usePathname } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ProgressRing } from '@/components/progress-ring';
import { CountBadge, Screen, SectionTitle } from '@/components/screen';
import { SortableTasks } from '@/components/sortable-tasks';
import { TaskRow } from '@/components/task-row';
import { Colors, Fonts } from '@/constants/theme';
import { formatShortDate, todayKey } from '@/lib/dates';
import { isFinishedToday, sortTasks, useTodoStore } from '@/store/todo-store';
import { useUiStore } from '@/store/ui-store';

/** "Main" frame: today's tasks (plus overdue ones), progress, and what's done today. */
export default function TodayScreen() {
  const tasks = useTodoStore((s) => s.tasks);
  const today = todayKey();

  const { open, done } = useMemo(() => {
    const sorted = sortTasks(tasks);
    return {
      open: sorted.filter((t) => !t.done && t.date <= today),
      // Everything finished today counts, whatever date it was planned for (e.g. an overdue task from yesterday).
      done: sorted.filter((t) => isFinishedToday(t)),
    };
  }, [tasks, today]);

  // Progress = finished today out of everything that was due today or overdue.
  const total = open.length + done.length;
  const progress = total === 0 ? 0 : done.length / total;

  // Celebrate when the last open task gets ticked off: the list just became empty AND one more task is done
  // (so deleting the last task, or opening the app with nothing left, doesn't trigger it).
  const celebrate = useUiStore((s) => s.celebrate);
  const focused = usePathname() === '/'; // this screen stays mounted under a list page; only celebrate when visible
  const previous = useRef({ open: open.length, done: done.length });
  useEffect(() => {
    const before = previous.current;
    previous.current = { open: open.length, done: done.length };
    if (focused && before.open > 0 && open.length === 0 && done.length > before.done) celebrate();
  }, [open.length, done.length, celebrate, focused]);

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
