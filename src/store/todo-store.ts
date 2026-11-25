import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ListColor } from '@/constants/theme';
import { addDays, startOfToday, todayKey } from '@/lib/dates';

export type TodoList = {
  id: string;
  name: string;
  color: ListColor;
  /** Last local or remote change (ms). */
  updatedAt: number;
  /** Changed on this device and not uploaded yet. */
  dirty?: boolean;
};

export type Task = {
  id: string;
  title: string;
  listId: string;
  /** Local date, `YYYY-MM-DD`. */
  date: string;
  /** Optional local time, `HH:MM` (24h). */
  time?: string;
  done: boolean;
  createdAt: number;
  /** When the task was ticked off (ms). Decides whether it counts as finished today or moves to "earlier". */
  completedAt?: number;
  /** Manual position set by drag-and-drop; tasks without one sort after the ones that have it. */
  order?: number;
  updatedAt: number;
  dirty?: boolean;
};

/** A deletion that still has to reach the server. */
export type Tombstone = { table: 'lists' | 'tasks'; id: string; at: number };

export type NewTask = Pick<Task, 'title' | 'listId' | 'date' | 'time'>;

type TodoState = {
  lists: TodoList[];
  tasks: Task[];
  profileName: string;
  profileDirty: boolean;

  /** The list the last new task was added to; the next new task defaults to it. */
  lastListId: string | null;
  /** False until the first-launch welcome screen has been dismissed on this device. */
  welcomed: boolean;

  // --- cloud sync bookkeeping (see lib/sync.ts) ---
  tombstones: Tombstone[];
  /** True until the user changes anything: untouched sample data is replaced, not uploaded, on first sign-in. */
  pristine: boolean;
  /** The account this device's data was last synced with. */
  cloudUserId: string | null;
  /** Newest server `updated_at` already pulled. */
  cursor: string | null;

  addTask: (task: NewTask) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  /** Stores the given ids as the manual order (index = position). */
  reorderTasks: (orderedIds: string[]) => void;
  /** Deletes finished tasks older than today (optionally only one list's). */
  clearEarlier: (listId?: string) => void;
  /** Housekeeping: deletes tasks that were finished more than 30 days ago. */
  purgeOldCompleted: () => void;
  addList: (name: string, color: ListColor) => void;
  deleteList: (id: string) => void;
  setProfileName: (name: string) => void;
  setWelcomed: () => void;
  resetAll: () => void;
};

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function seed() {
  const today = todayKey();
  const now = Date.now();
  const list = (id: string, name: string, color: ListColor): TodoList => ({ id, name, color, updatedAt: now, dirty: true });
  const task = (n: number, t: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'dirty'>): Task => ({
    ...t,
    id: newId(),
    createdAt: now + n,
    updatedAt: now,
    dirty: true,
  });
  return {
    lists: [list('work', 'Work', 'purple'), list('personal', 'Personal', 'green')],
    tasks: [
      task(0, { title: 'Make a cup of coffee', listId: 'work', date: today, time: '10:00', done: false }),
      task(1, { title: 'Answer emails', listId: 'work', date: today, time: '11:30', done: false }),
      { ...task(2, { title: 'Eat breakfast', listId: 'personal', date: today, done: true }), completedAt: now },
      task(3, { title: 'Team meeting', listId: 'work', date: addDays(today, 1), time: '10:00', done: false }),
      task(4, { title: 'Go for a run', listId: 'personal', date: addDays(today, 2), time: '07:00', done: false }),
    ],
    profileName: 'Your name',
    profileDirty: false,
    tombstones: [] as Tombstone[],
    lastListId: null as string | null,
    welcomed: false,
    pristine: true,
    cloudUserId: null as string | null,
    cursor: null as string | null,
  };
}

export const useTodoStore = create<TodoState>()(
  persist(
    (set) => ({
      ...seed(),
      addTask: (task) =>
        set((s) => {
          const now = Date.now();
          return {
            pristine: false,
            lastListId: task.listId,
            tasks: [...s.tasks, { ...task, id: newId(), done: false, createdAt: now, updatedAt: now, dirty: true }],
          };
        }),
      toggleTask: (id) =>
        set((s) => ({
          pristine: false,
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            const now = Date.now();
            const done = !t.done;
            return { ...t, done, completedAt: done ? now : undefined, updatedAt: now, dirty: true };
          }),
        })),
      deleteTask: (id) =>
        set((s) => ({
          pristine: false,
          tasks: s.tasks.filter((t) => t.id !== id),
          tombstones: [...s.tombstones, { table: 'tasks', id, at: Date.now() }],
        })),
      reorderTasks: (orderedIds) =>
        set((s) => {
          const now = Date.now();
          return {
            pristine: false,
            tasks: s.tasks.map((t) => {
              const order = orderedIds.indexOf(t.id);
              return order === -1 || order === t.order ? t : { ...t, order, updatedAt: now, dirty: true };
            }),
          };
        }),
      clearEarlier: (listId) =>
        set((s) => {
          const cutoff = startOfToday();
          const gone = s.tasks.filter((t) => isEarlier(t, cutoff) && (!listId || t.listId === listId));
          if (gone.length === 0) return {};
          const ids = new Set(gone.map((t) => t.id));
          const now = Date.now();
          return {
            pristine: false,
            tasks: s.tasks.filter((t) => !ids.has(t.id)),
            tombstones: [...s.tombstones, ...gone.map((t) => ({ table: 'tasks' as const, id: t.id, at: now }))],
          };
        }),
      purgeOldCompleted: () =>
        set((s) => {
          const limit = Date.now() - PURGE_AFTER_MS;
          const gone = s.tasks.filter((t) => t.done && (t.completedAt ?? t.updatedAt) < limit);
          if (gone.length === 0) return {};
          const ids = new Set(gone.map((t) => t.id));
          const now = Date.now();
          return {
            tasks: s.tasks.filter((t) => !ids.has(t.id)),
            tombstones: [...s.tombstones, ...gone.map((t) => ({ table: 'tasks' as const, id: t.id, at: now }))],
          };
        }),
      addList: (name, color) =>
        set((s) => ({
          pristine: false,
          lists: [...s.lists, { id: newId(), name, color, updatedAt: Date.now(), dirty: true }],
        })),
      deleteList: (id) =>
        set((s) => {
          const now = Date.now();
          const removedTasks = s.tasks.filter((t) => t.listId === id);
          return {
            pristine: false,
            lastListId: s.lastListId === id ? null : s.lastListId,
            lists: s.lists.filter((l) => l.id !== id),
            tasks: s.tasks.filter((t) => t.listId !== id),
            tombstones: [
              ...s.tombstones,
              { table: 'lists', id, at: now },
              ...removedTasks.map((t) => ({ table: 'tasks' as const, id: t.id, at: now })),
            ],
          };
        }),
      setProfileName: (profileName) => set({ profileName, profileDirty: true, pristine: false }),
      setWelcomed: () => set({ welcomed: true }),
      // Clearing the data (logout, delete) shouldn't bring the welcome screen back.
      resetAll: () => set((s) => ({ ...seed(), welcomed: s.welcomed })),
    }),
    {
      name: 'todo-store',
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persisted, version) => {
        let s = persisted as Partial<TodoState>;
        // v1 had no sync bookkeeping: treat everything already on the device as real, not-yet-uploaded data.
        if (version < 2) {
          const now = Date.now();
          s = {
            ...s,
            lists: (s.lists ?? []).map((l) => ({ ...l, updatedAt: now, dirty: true })),
            tasks: (s.tasks ?? []).map((t) => ({ ...t, updatedAt: now, dirty: true })),
            profileDirty: false,
            tombstones: [],
            pristine: false,
            cloudUserId: null,
            cursor: null,
          };
        }
        // v3 records when tasks were finished: tasks already done count as finished at their last change.
        if (version < 3) {
          s = {
            ...s,
            tasks: (s.tasks ?? []).map((t) => (t.done && t.completedAt == null ? { ...t, completedAt: t.updatedAt, dirty: true } : t)),
          };
        }
        return s as TodoState;
      },
    },
  ),
);

const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/** When a done task was finished (tasks from before this was recorded fall back to their last change). */
export const finishedAt = (t: Task) => t.completedAt ?? t.updatedAt;

/** Done today: shown in the Today screen's and each list's "completed" section. */
export const isFinishedToday = (t: Task, since = startOfToday()) => t.done && finishedAt(t) >= since;

/** Done on an earlier day: tucked away in the collapsed "Earlier" section. */
export const isEarlier = (t: Task, before = startOfToday()) => t.done && finishedAt(t) < before;

/** Tasks ordered for display: manual order first, then by date, timed tasks by time, then by creation. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const ao = a.order ?? Infinity;
    const bo = b.order ?? Infinity;
    if (ao !== bo) return ao < bo ? -1 : 1;
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    return a.createdAt - b.createdAt;
  });
}
