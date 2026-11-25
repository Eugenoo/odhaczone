import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CountBadge, Screen } from '@/components/screen';
import { TaskRow } from '@/components/task-row';
import { Colors, Fonts } from '@/constants/theme';
import { formatDaySubtitle, formatDayTitle, todayKey } from '@/lib/dates';
import { sortTasks, type Task, useTodoStore } from '@/store/todo-store';

/** "Schedue" frame: open tasks after today, grouped by day. */
export default function UpcomingScreen() {
  const tasks = useTodoStore((s) => s.tasks);
  const today = todayKey();

  const groups = useMemo(() => {
    const byDate = new Map<string, Task[]>();
    for (const t of sortTasks(tasks)) {
      if (t.done || t.date <= today) continue;
      byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);
    }
    return [...byDate.entries()];
  }, [tasks, today]);

  return (
    <Screen label="Schedule" title="Upcoming" contentGap={14}>
      {groups.length === 0 && <Text style={styles.empty}>No upcoming tasks.</Text>}
      <View style={styles.groups}>
        {groups.map(([date, dayTasks]) => (
          <View key={date} style={styles.group}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{formatDayTitle(date)}</Text>
              <Text style={styles.daySubtitle}>{formatDaySubtitle(date)}</Text>
              <View style={styles.spacer} />
              <CountBadge count={dayTasks.length} size="sm" />
            </View>
            <View style={styles.tasks}>
              {dayTasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  groups: {
    gap: 20,
  },
  group: {
    gap: 18,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 6,
  },
  dayTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.textSecondary,
  },
  daySubtitle: {
    fontFamily: Fonts.light,
    fontSize: 15,
    color: Colors.text,
  },
  spacer: {
    flex: 1,
  },
  tasks: {
    gap: 17,
  },
  empty: {
    fontFamily: Fonts.light,
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
