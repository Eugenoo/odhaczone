import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import type { ListColor } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { type Task, type TodoList, useTodoStore } from '@/store/todo-store';

/**
 * Local-first sync. The app always reads and writes its on-device store, so it works offline.
 * While signed in, `syncNow` uploads local changes (marked `dirty`), then downloads anything newer from the server.
 * Conflict rule: a change still waiting to be uploaded wins locally; otherwise the newest server write wins.
 * Deletions travel as `deleted_at` stamps so other devices learn about them.
 */

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export const useSyncStatus = create<{ status: SyncStatus; lastSyncedAt: number | null; error: string | null }>(() => ({
  status: 'idle',
  lastSyncedAt: null,
  error: null,
}));

type ListRow = { id: string; name: string; color: string; updated_at: string; deleted_at: string | null };
type TaskRow = {
  id: string;
  list_id: string;
  title: string;
  date: string;
  time: string | null;
  done: boolean;
  position: number | null;
  created_at: number;
  completed_at: number | null;
  updated_at: string;
  deleted_at: string | null;
};
type ProfileRow = { name: string; updated_at: string };
type Remote = { lists: ListRow[]; tasks: TaskRow[]; profile: ProfileRow | null };

const PAGE = 1000;
const CHUNK = 500;

let userId: string | null = null;
let running = false;
let rerun = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let cleanups: (() => void)[] = [];

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const isNetworkError = (e: unknown) => /fetch|network|offline|timeout/i.test(e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------------------------------------- start / stop

export function startSync(id: string) {
  if (userId === id) return;
  stopSync();
  userId = id;

  // Local changes -> upload soon after they happen.
  let prev = useTodoStore.getState();
  const unsubscribe = useTodoStore.subscribe((s) => {
    const changed =
      s.lists !== prev.lists || s.tasks !== prev.tasks || s.tombstones !== prev.tombstones || s.profileDirty !== prev.profileDirty;
    prev = s;
    if (changed && hasPending()) schedule(1500);
  });
  cleanups.push(unsubscribe);

  // Other devices -> hear about changes immediately.
  const channel = supabase.channel(`sync-${id}`);
  for (const table of ['lists', 'tasks', 'profiles']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => schedule(300));
  }
  channel.subscribe();
  cleanups.push(() => void supabase.removeChannel(channel));

  // Coming back to the app / getting internet back -> catch up.
  if (Platform.OS === 'web') {
    const wake = () => {
      if (document.visibilityState === 'visible') schedule(200);
    };
    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    cleanups.push(() => {
      window.removeEventListener('online', wake);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    });
  } else {
    const sub = AppState.addEventListener('change', (state) => state === 'active' && schedule(200));
    cleanups.push(() => sub.remove());
  }
  const interval = setInterval(() => schedule(0), 60_000); // safety net
  cleanups.push(() => clearInterval(interval));

  schedule(0);
}

export function stopSync() {
  clearTimeout(timer);
  cleanups.forEach((fn) => fn());
  cleanups = [];
  userId = null;
  rerun = false;
  useSyncStatus.setState({ status: 'idle', error: null });
}

function schedule(delay: number) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

function hasPending() {
  const s = useTodoStore.getState();
  return s.profileDirty || s.tombstones.length > 0 || s.lists.some((l) => l.dirty) || s.tasks.some((t) => t.dirty);
}

// ---------------------------------------------------------------------------------------------- one round

export async function syncNow() {
  const uid = userId;
  if (!uid) return;
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  useSyncStatus.setState({ status: 'syncing', error: null });
  try {
    await run(uid);
    if (userId === uid) useSyncStatus.setState({ status: 'idle', lastSyncedAt: Date.now(), error: null });
  } catch (e) {
    const offline = isNetworkError(e);
    useSyncStatus.setState({ status: offline ? 'offline' : 'error', error: offline ? null : String(e instanceof Error ? e.message : e) });
  } finally {
    running = false;
    if (rerun) {
      rerun = false;
      schedule(500);
    }
  }
}

async function run(uid: string) {
  const first = useTodoStore.getState().cloudUserId !== uid;

  if (first) {
    // First time this device meets this account.
    const remote = await fetchRemote(uid, null);
    const s = useTodoStore.getState();
    const accountHasData = remote.lists.length + remote.tasks.length > 0;
    if (s.pristine && accountHasData) {
      // Only untouched sample data here: the account's data replaces it (no duplicates).
      useTodoStore.setState({ lists: [], tasks: [], tombstones: [], profileDirty: false, cursor: null });
      applyRemote(remote);
      useTodoStore.setState({ cloudUserId: uid, pristine: false });
      return;
    }
    // Real data on this device: upload all of it into the account.
    useTodoStore.setState((st) => ({
      cloudUserId: uid,
      cursor: null,
      pristine: false,
      lists: st.lists.map((l) => ({ ...l, dirty: true })),
      tasks: st.tasks.map((t) => ({ ...t, dirty: true })),
      profileDirty: st.profileName !== 'Your name',
    }));
  }

  await push(uid);
  applyRemote(await fetchRemote(uid, useTodoStore.getState().cursor));
}

// ---------------------------------------------------------------------------------------------- upload

async function push(uid: string) {
  const start = useTodoStore.getState();

  // Lists first: tasks refer to them.
  const lists = start.lists.filter((l) => l.dirty);
  for (const part of chunks(lists, CHUNK)) {
    const { error } = await supabase.from('lists').upsert(
      part.map((l) => ({ id: l.id, user_id: uid, name: l.name, color: l.color, deleted_at: null })),
      { onConflict: 'user_id,id' },
    );
    check(error);
    // Clear the flag only if the list wasn't edited again while uploading.
    const sent = new Map(part.map((l) => [l.id, l.updatedAt]));
    useTodoStore.setState((s) => ({
      lists: s.lists.map((l) => (sent.get(l.id) === l.updatedAt ? { ...l, dirty: false } : l)),
    }));
  }

  const tasks = start.tasks.filter((t) => t.dirty);
  for (const part of chunks(tasks, CHUNK)) {
    const { error } = await supabase.from('tasks').upsert(
      part.map((t) => ({
        id: t.id,
        user_id: uid,
        list_id: t.listId,
        title: t.title,
        date: t.date,
        time: t.time ?? null,
        done: t.done,
        position: t.order ?? null,
        created_at: t.createdAt,
        completed_at: t.completedAt ?? null,
        deleted_at: null,
      })),
      { onConflict: 'user_id,id' },
    );
    check(error);
    const sent = new Map(part.map((t) => [t.id, t.updatedAt]));
    useTodoStore.setState((s) => ({
      tasks: s.tasks.map((t) => (sent.get(t.id) === t.updatedAt ? { ...t, dirty: false } : t)),
    }));
  }

  // Deletions: stamp deleted_at on the server rows.
  for (const table of ['tasks', 'lists'] as const) {
    const gone = start.tombstones.filter((t) => t.table === table);
    for (const part of chunks(gone, CHUNK)) {
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', uid)
        .in('id', part.map((t) => t.id));
      check(error);
      const done = new Set(part.map((t) => `${t.table}:${t.id}:${t.at}`));
      useTodoStore.setState((s) => ({ tombstones: s.tombstones.filter((t) => !done.has(`${t.table}:${t.id}:${t.at}`)) }));
    }
  }

  if (start.profileDirty) {
    const { error } = await supabase.from('profiles').upsert({ user_id: uid, name: start.profileName }, { onConflict: 'user_id' });
    check(error);
    useTodoStore.setState((s) => (s.profileName === start.profileName ? { profileDirty: false } : {}));
  }
}

// ---------------------------------------------------------------------------------------------- download

async function fetchRemote(uid: string, cursor: string | null): Promise<Remote> {
  const lists = await fetchAll<ListRow>('lists', uid, cursor);
  const tasks = await fetchAll<TaskRow>('tasks', uid, cursor);

  let profileQuery = supabase.from('profiles').select('name, updated_at').eq('user_id', uid);
  if (cursor) profileQuery = profileQuery.gte('updated_at', cursor);
  const { data, error } = await profileQuery.maybeSingle();
  check(error);
  return { lists, tasks, profile: (data as ProfileRow | null) ?? null };
}

async function fetchAll<T>(table: 'lists' | 'tasks', uid: string, cursor: string | null): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select('*').eq('user_id', uid).order('updated_at', { ascending: true });
    if (cursor) query = query.gte('updated_at', cursor); // >= so rows sharing the cursor's timestamp aren't missed
    const { data, error } = await query.range(from, from + PAGE - 1);
    check(error);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

/** Merges server rows into the local store. Local changes that haven't been uploaded yet are never overwritten. */
function applyRemote(remote: Remote) {
  useTodoStore.setState((s) => {
    const pendingDeletes = new Set(s.tombstones.map((t) => `${t.table}:${t.id}`));

    const lists = new Map<string, TodoList>(s.lists.map((l) => [l.id, l]));
    for (const r of remote.lists) {
      const local = lists.get(r.id);
      if (local?.dirty) continue;
      if (r.deleted_at) lists.delete(r.id);
      else if (!pendingDeletes.has(`lists:${r.id}`)) {
        lists.set(r.id, { id: r.id, name: r.name, color: r.color as ListColor, updatedAt: Date.parse(r.updated_at) });
      }
    }

    const tasks = new Map<string, Task>(s.tasks.map((t) => [t.id, t]));
    for (const r of remote.tasks) {
      const local = tasks.get(r.id);
      if (local?.dirty) continue;
      if (r.deleted_at) tasks.delete(r.id);
      else if (!pendingDeletes.has(`tasks:${r.id}`)) {
        tasks.set(r.id, {
          id: r.id,
          listId: r.list_id,
          title: r.title,
          date: r.date,
          time: r.time ?? undefined,
          done: r.done,
          order: r.position ?? undefined,
          createdAt: Number(r.created_at),
          // Rows finished before completed_at existed fall back to their last server change.
          completedAt: r.done ? (r.completed_at != null ? Number(r.completed_at) : Date.parse(r.updated_at)) : undefined,
          updatedAt: Date.parse(r.updated_at),
        });
      }
    }

    // Newest server timestamp seen becomes the next pull's starting point.
    let cursor = s.cursor;
    for (const stamp of [...remote.lists, ...remote.tasks, ...(remote.profile ? [remote.profile] : [])].map((r) => r.updated_at)) {
      if (!cursor || stamp > cursor) cursor = stamp;
    }

    const profileName = remote.profile && !s.profileDirty && remote.profile.name ? remote.profile.name : s.profileName;

    return { lists: [...lists.values()], tasks: [...tasks.values()], cursor, profileName };
  });
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
