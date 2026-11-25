import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { TaskRow } from '@/components/task-row';
import { Colors } from '@/constants/theme';
import { type Task, useTodoStore } from '@/store/todo-store';

const HOLD_MS = 350; // press-and-hold time before a task lifts
const SLOP = 8; // px the finger may wander during the hold before we treat it as a scroll

type Box = { y: number; h: number };

type Props = {
  tasks: Task[];
  /** Vertical space between rows; must match the list's visual gap. */
  gap?: number;
};

/**
 * A list of tasks that can be reordered: press and hold a task, it lifts, drag it between the others and let go.
 * Drag is implemented for web (the installed PWA); on native the rows are a plain list.
 */
export function SortableTasks({ tasks, gap = 27 }: Props) {
  const reorderTasks = useTodoStore((s) => s.reorderTasks);

  const [dragId, setDragId] = useState<string | null>(null);
  const [target, setTarget] = useState(0);
  const [dragSize, setDragSize] = useState(0);
  const [dragY] = useState(() => new Animated.Value(0));
  const boxes = useRef<Record<string, Box>>({});
  const targetRef = useRef(0);

  const indexOf = (id: string) => tasks.findIndex((t) => t.id === id);

  const onStart = (id: string) => {
    const i = indexOf(id);
    targetRef.current = i;
    setTarget(i);
    setDragSize((boxes.current[id]?.h ?? 0) + gap);
    dragY.setValue(0);
    setDragId(id);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
  };

  const onMove = (id: string, dy: number) => {
    dragY.setValue(dy);
    const me = boxes.current[id];
    if (!me) return;
    const center = me.y + me.h / 2 + dy;
    let next = 0;
    for (const t of tasks) {
      const b = boxes.current[t.id];
      if (t.id !== id && b && b.y + b.h / 2 < center) next++;
    }
    if (next !== targetRef.current) {
      targetRef.current = next;
      setTarget(next);
    }
  };

  const onEnd = (id: string) => {
    const from = indexOf(id);
    const to = targetRef.current;
    const me = boxes.current[id];
    const dest = boxes.current[tasks[to]?.id];
    let slot = 0;
    if (me && dest && to > from) slot = dest.y + dest.h - (me.y + me.h);
    else if (me && dest && to < from) slot = dest.y - me.y;

    // Settle into the slot, then commit the new order.
    Animated.timing(dragY, {
      toValue: slot,
      duration: 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      if (to !== from) {
        const ids = tasks.map((t) => t.id);
        ids.splice(from, 1);
        ids.splice(to, 0, id);
        reorderTasks(ids);
      }
      setDragId(null);
      dragY.setValue(0);
    });
  };

  const dragIndex = dragId === null ? -1 : indexOf(dragId);

  return (
    <View style={[{ gap }, dragId !== null && styles.raised]}>
      {tasks.map((task, index) => (
        <SortableItem
          key={task.id}
          task={task}
          index={index}
          dragIndex={dragIndex}
          target={target}
          dragSize={dragSize}
          dragging={dragId === task.id}
          dragY={dragY}
          onBox={(box) => {
            boxes.current[task.id] = box;
          }}
          onStart={onStart}
          onMove={onMove}
          onEnd={onEnd}
        />
      ))}
    </View>
  );
}

type ItemProps = {
  task: Task;
  index: number;
  dragIndex: number;
  target: number;
  dragSize: number;
  dragging: boolean;
  dragY: Animated.Value;
  onBox: (box: Box) => void;
  onStart: (id: string) => void;
  onMove: (id: string, dy: number) => void;
  onEnd: (id: string) => void;
};

function SortableItem({
  task,
  index,
  dragIndex,
  target,
  dragSize,
  dragging,
  dragY,
  onBox,
  onStart,
  onMove,
  onEnd,
}: ItemProps) {
  const ref = useRef<ComponentRef<typeof Animated.View>>(null);
  const [shift] = useState(() => new Animated.Value(0));
  const handlers = useRef({ onStart, onMove, onEnd });
  useEffect(() => {
    handlers.current = { onStart, onMove, onEnd };
  });

  // Make room: rows between the dragged row's old and new slot slide out of the way.
  let desired = 0;
  if (dragIndex >= 0 && !dragging) {
    if (dragIndex < target && index > dragIndex && index <= target) desired = -dragSize;
    else if (dragIndex > target && index >= target && index < dragIndex) desired = dragSize;
  }
  useEffect(() => {
    if (dragIndex < 0) {
      shift.setValue(0); // the list was just re-ordered; snap, don't animate
      return;
    }
    Animated.timing(shift, {
      toValue: desired,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [desired, dragIndex, shift]);

  // Press-and-hold then drag, via DOM events so the page doesn't scroll once the task has lifted.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) return;

    el.style.userSelect = 'none';
    el.style.setProperty('-webkit-user-select', 'none');
    el.style.setProperty('-webkit-touch-callout', 'none');

    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false;
    let active = false;
    let blockClickUntil = 0;
    let startX = 0;
    let startY = 0;

    const cancelHold = () => {
      clearTimeout(timer);
      pending = false;
    };
    const begin = (x: number, y: number) => {
      startX = x;
      startY = y;
      pending = true;
      timer = setTimeout(() => {
        pending = false;
        active = true;
        handlers.current.onStart(task.id);
      }, HOLD_MS);
    };
    const move = (x: number, y: number, e: Event) => {
      if (pending && (Math.abs(x - startX) > SLOP || Math.abs(y - startY) > SLOP)) {
        cancelHold(); // the finger moved before the hold finished: it's a scroll
      } else if (active) {
        if (e.cancelable) e.preventDefault(); // no page scroll while dragging
        handlers.current.onMove(task.id, y - startY);
      }
    };
    const end = () => {
      cancelHold();
      if (active) {
        active = false;
        blockClickUntil = Date.now() + 400; // releasing a drag must not toggle the task
        handlers.current.onEnd(task.id);
      }
    };

    const onTouchStart = (e: TouchEvent) => begin(e.touches[0].clientX, e.touches[0].clientY);
    const onTouchMove = (e: TouchEvent) => move(e.touches[0].clientX, e.touches[0].clientY, e);
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) begin(e.clientX, e.clientY);
    };
    const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY, e);
    const onClick = (e: Event) => {
      if (Date.now() < blockClickUntil) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    const onContextMenu = (e: Event) => {
      if (pending || active) e.preventDefault();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('click', onClick, true);
    el.addEventListener('contextmenu', onContextMenu);
    // Registered up front as non-passive so preventDefault works on iOS Safari.
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', end);

    return () => {
      cancelHold();
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', end);
    };
  }, [task.id]);

  return (
    <Animated.View
      ref={ref}
      onLayout={(e) => onBox({ y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
      style={[
        dragging
          ? { zIndex: 10, transform: [{ translateY: dragY }, { scale: 1.03 }] }
          : { transform: [{ translateY: shift }] },
      ]}>
      {dragging && <View pointerEvents="none" style={styles.lift} />}
      <TaskRow task={task} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // While dragging, the list paints above whatever follows it (e.g. the "completed" header).
  raised: {
    zIndex: 20,
  },
  // Card behind the lifted task; absolutely positioned so it doesn't change the row's layout.
  lift: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    left: -12,
    right: -12,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    boxShadow: '0px 10px 24px rgba(0, 0, 0, 0.16)',
  },
});
