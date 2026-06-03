import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, LayoutChangeEvent, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { Category, Task } from '../types';
import ExpressEntry from './ExpressEntry';
import TaskRow from './TaskRow';

const IS_WEB = Platform.OS === 'web';

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const day = d.getDate();
  const mon = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const yy = String(d.getFullYear()).slice(2);
  return `${wd} ${day} ${mon} '${yy}`;
}

// Where the task will be inserted: before `beforeTaskId`, or append to `iso` if null
type DropLine = { iso: string; beforeTaskId: string | null } | null;

// Defined outside TaskList so the component type is stable across re-renders.
// If defined inside, every dropLine state change creates a new type → React
// unmounts/remounts the nodes → mouseenter never re-fires → drop target freezes.
// Wraps each ExpressEntry with a ref so TaskList can measureInWindow it
// when the keyboard pops up, and scroll the row above the keyboard if it
// would otherwise be covered.
function ExpressMeasure({
  iso, registerView, children,
}: {
  iso: string;
  registerView?: (iso: string, view: View | null) => void;
  children: any;
}) {
  const viewRef = useRef<View | null>(null);
  useEffect(() => {
    if (!registerView) return;
    registerView(iso, viewRef.current);
    return () => registerView(iso, null);
  }, [iso, registerView]);
  return <View ref={viewRef}>{children}</View>;
}

function DropZone({
  iso, beforeTaskId, isActive, onHover, registerView,
}: {
  iso: string;
  beforeTaskId: string | null;
  isActive: boolean;
  onHover: () => void;
  registerView?: (key: string, view: View | null) => void;
}) {
  const viewRef = useRef<View | null>(null);
  const key = `${iso}|${beforeTaskId ?? 'end'}`;

  useEffect(() => {
    if (!registerView) return;
    registerView(key, viewRef.current);
    return () => registerView(key, null);
  }, [key, registerView]);

  return (
    <View
      ref={viewRef}
      style={styles.dropZone}
      {...(IS_WEB ? { onMouseEnter: onHover } as any : {})}
    >
      <View style={[styles.dropZoneLine, isActive && styles.dropZoneLineActive]} />
    </View>
  );
}

interface Props {
  tasks: Task[];
  categories: Category[];
  filter: 'all' | 'todo' | 'done';
  catFilter: string | null;
  futureDays: number;
  today: string;
  editingId: string | null;
  editText: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveToToday: (id: string) => void;
  onSwipeRight: (id: string, isoDate: string) => void;
  onSwipeLeft: (id: string, isoDate: string) => void;
  onEditStart: (id: string, text: string) => void;
  onEditChange: (text: string) => void;
  onEditEnd: (id: string) => void;
  onCatPress: (id: string) => void;
  onExpressCommit: (isoDate: string, text: string, cat: string) => void;
  onShowMore: () => void;
  onReorder: (tasks: Task[]) => void;
}

export default function TaskList({
  tasks, categories, filter, catFilter, futureDays, today,
  editingId, editText,
  onToggle, onDelete, onMoveToToday, onSwipeRight, onSwipeLeft,
  onEditStart, onEditChange, onEditEnd, onCatPress,
  onExpressCommit, onShowMore, onReorder,
}: Props) {
  // ── Drag state ────────────────────────────────────────────────────────────
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropLine, setDropLine] = useState<DropLine>(null);
  const [ghostTask, setGhostTask] = useState<Task | null>(null);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });

  // Only one ExpressEntry can be active at a time. Inactive ones render as
  // Pressables (no TextInput) so the keyboard / InputConnection doesn't get
  // shared/stolen between sibling text inputs.
  const [activeExpressDate, setActiveExpressDate] = useState<string | null>(null);

  // Scroll Today into view when switching to DONE/ALL (where the list can
  // start with past days). We position Today ~17% down from the top of the
  // viewport so a bit of "yesterday" stays visible for context.
  const scrollViewRef = useRef<ScrollView>(null);
  const todayYRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (filter !== 'done' && filter !== 'all') return;
    const t = setTimeout(() => {
      const target = Math.max(0, todayYRef.current - viewportHeightRef.current * 0.17);
      scrollViewRef.current?.scrollTo({ y: target, animated: true });
    }, 120);
    return () => clearTimeout(t);
  }, [filter]);

  // Track each ExpressEntry's wrapper view so we can measure its on-screen
  // position when the keyboard appears.
  const expressViewRefs = useRef<Map<string, View>>(new Map());
  const registerExpressView = useCallback((iso: string, view: View | null) => {
    if (view) expressViewRefs.current.set(iso, view);
    else expressViewRefs.current.delete(iso);
  }, []);

  // Keyboard height tracker (mobile only).
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (IS_WEB) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKeyboardHeight(e.endCoordinates.height));
    const h = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => { s.remove(); h.remove(); };
  }, []);

  // When the keyboard opens AND an ExpressEntry is active, check whether it
  // would be hidden by the keyboard. If yes, scroll just enough so its
  // bottom sits ~24px above the keyboard. If already visible, leave alone.
  useEffect(() => {
    if (IS_WEB) return;
    if (!activeExpressDate || keyboardHeight === 0) return;
    const view = expressViewRefs.current.get(activeExpressDate);
    if (!view) return;
    const t = setTimeout(() => {
      view.measureInWindow((_x, y, _w, h) => {
        const screenH = Dimensions.get('window').height;
        const visibleH = screenH - keyboardHeight;
        const bottom = y + h;
        const margin = 24;
        if (bottom + margin > visibleH) {
          const delta = bottom + margin - visibleH;
          scrollViewRef.current?.scrollTo({ y: scrollYRef.current + delta, animated: true });
        }
      });
    }, 80);
    return () => clearTimeout(t);
  }, [activeExpressDate, keyboardHeight]);

  const isDraggingRef = useRef(false);
  const dragIdRef = useRef<string | null>(null);
  const dropLineRef = useRef<DropLine>(null);

  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  const onReorderRef = useRef(onReorder);
  useEffect(() => { onReorderRef.current = onReorder; }, [onReorder]);

  const setDropLineBoth = (dl: DropLine) => {
    dropLineRef.current = dl;
    setDropLine(dl);
  };

  const commitDrop = useCallback(() => {
    const srcId = dragIdRef.current;
    const dl = dropLineRef.current;

    dragIdRef.current = null;
    dropLineRef.current = null;
    isDraggingRef.current = false;
    setDraggingId(null);
    setDropLineBoth(null);
    setGhostTask(null);

    if (!srcId || !dl) return;

    const copy = [...tasksRef.current];
    const srcIdx = copy.findIndex((t) => t.id === srcId);
    if (srcIdx === -1) return;
    const [item] = copy.splice(srcIdx, 1);
    const moved = { ...item, isoDate: dl.iso };

    // Resolve effective insertion point (dropping before self → append to day)
    const beforeId = dl.beforeTaskId === srcId ? null : dl.beforeTaskId;

    if (beforeId !== null) {
      const beforeIdx = copy.findIndex((t) => t.id === beforeId);
      copy.splice(beforeIdx >= 0 ? beforeIdx : copy.length, 0, moved);
    } else {
      // Append after the last task of the target day (or at array end)
      const lastIdx = copy.reduce((acc, t, i) => (t.isoDate === dl.iso ? i : acc), -1);
      copy.splice(lastIdx >= 0 ? lastIdx + 1 : copy.length, 0, moved);
    }

    onReorderRef.current(copy.map((t, i) => ({ ...t, sortOrder: i })));
  }, []);

  useEffect(() => {
    if (!IS_WEB) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      setGhostPos({ x: e.clientX, y: e.clientY });
    };
    const onMouseUp = () => { if (isDraggingRef.current) commitDrop(); };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [commitDrop]);

  const startDrag = (id: string, task: Task, mouseX: number, mouseY: number) => {
    isDraggingRef.current = true;
    dragIdRef.current = id;
    setDraggingId(id);
    setGhostTask(task);
    setGhostPos({ x: mouseX, y: mouseY });
  };

  const hoverDropZone = (iso: string, beforeTaskId: string | null) => {
    if (!isDraggingRef.current) return;
    if (beforeTaskId === dragIdRef.current) return;
    setDropLineBoth({ iso, beforeTaskId });
  };

  // ── Native drag (Android/iOS) ─────────────────────────────────────────────
  // The handle on TaskRow attaches a long-press-activated Gesture.Pan. While
  // it pans, we find the drop zone whose center is closest to the finger Y.
  // Positions are measured (via measureInWindow) at drag start — cheap, and
  // accurate enough for the user not to feel any drift.
  const dropZoneViewRefs = useRef<Map<string, View>>(new Map());
  const measuredDropZones = useRef<Array<{ y: number; height: number; iso: string; beforeTaskId: string | null }>>([]);

  const registerDropZoneView = useCallback((key: string, view: View | null) => {
    if (view) dropZoneViewRefs.current.set(key, view);
    else dropZoneViewRefs.current.delete(key);
  }, []);

  const measureAllDropZones = useCallback(() => {
    measuredDropZones.current = [];
    for (const [key, view] of dropZoneViewRefs.current) {
      const [iso, suffix] = key.split('|');
      const beforeTaskId = suffix === 'end' ? null : suffix;
      view.measureInWindow((_x, y, _w, height) => {
        measuredDropZones.current.push({ y, height, iso, beforeTaskId });
      });
    }
  }, []);

  const startNativeDrag = useCallback((taskId: string) => {
    const t = tasksRef.current.find((x) => x.id === taskId);
    if (!t) return;
    isDraggingRef.current = true;
    dragIdRef.current = taskId;
    setDraggingId(taskId);
    measureAllDropZones();
  }, [measureAllDropZones]);

  const updateNativeDrag = useCallback((absoluteY: number) => {
    if (!isDraggingRef.current) return;
    let bestDl: DropLine = null;
    let bestDist = Infinity;
    for (const item of measuredDropZones.current) {
      const centerY = item.y + item.height / 2;
      const dist = Math.abs(centerY - absoluteY);
      if (dist < bestDist) {
        bestDist = dist;
        bestDl = { iso: item.iso, beforeTaskId: item.beforeTaskId };
      }
    }
    if (bestDl) {
      const beforeTaskId = bestDl.beforeTaskId === dragIdRef.current ? null : bestDl.beforeTaskId;
      setDropLineBoth({ iso: bestDl.iso, beforeTaskId });
    }
  }, []);

  const endNativeDrag = useCallback(() => {
    commitDrop();
  }, [commitDrop]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getCat = (code: string): Category =>
    categories.find((c) => c.code === code) ?? { code, color: theme.cream3, title: code, updatedAt: '1970-01-01T00:00:00.000Z' };

  const dates = (() => {
    const set = new Set(tasks.map((t) => t.isoDate));
    for (let i = 0; i < futureDays; i++) set.add(addDays(today, i));
    const past = [...set].filter((d) => d < today).sort();
    const future = [...set].filter((d) => d >= today).sort();
    return [...past, ...(futureDays <= 8 ? future.slice(0, 20) : future)];
  })();

  const visibleTasks = (iso: string) =>
    tasks.filter(
      (t) =>
        t.isoDate === iso &&
        (filter === 'all' ? true : filter === 'done' ? t.done : !t.done) &&
        (catFilter ? t.categoryCode === catFilter : true)
    );

  const defaultExpressCat = (iso: string) => {
    const day = tasks.filter((t) => t.isoDate === iso);
    return day.length ? day[day.length - 1].categoryCode : 'GEN';
  };

  const isDropZoneActive = (iso: string, beforeTaskId: string | null) =>
    dropLine !== null && dropLine.iso === iso && dropLine.beforeTaskId === beforeTaskId;

  // ── Ghost ─────────────────────────────────────────────────────────────────
  const ghostCat = ghostTask ? getCat(ghostTask.categoryCode) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        style={styles.root}
        contentContainerStyle={styles.content}
        onLayout={(e: LayoutChangeEvent) => {
          viewportHeightRef.current = e.nativeEvent.layout.height;
        }}
        onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={32}
      >
        {dates.map((iso) => {
          const dayTasks = visibleTasks(iso);
          // DONE: hide every empty day.
          // TODO: keep empty future days (for planning ahead) but drop empty
          //       past days — yesterday with no leftovers is just clutter.
          // ALL:  show everything.
          if (dayTasks.length === 0) {
            if (filter === 'done') return null;
            if (filter === 'todo' && iso < today) return null;
          }
          const isPast = iso < today;
          const isToday = iso === today;
          const labelColor = isPast ? theme.cream3 : isToday ? theme.cream : theme.accent;

          return (
            <View
              key={iso}
              style={styles.dateSection}
              onLayout={isToday ? (e: LayoutChangeEvent) => {
                todayYRef.current = e.nativeEvent.layout.y;
              } : undefined}
            >
              <View style={styles.dateHeader}>
                <Text style={[styles.dateLabel, { color: labelColor }]}>
                  {isPast ? '↑ ' : ''}{formatDateLabel(iso)}{isToday ? ' · TODAY' : ''}
                </Text>
              </View>

              {/* Drop zone above first task. We no longer use a "tall" variant
                  for empty days — the ExpressEntry placeholder below already
                  reserves room and the tall strip was leaving an ugly gap. */}
              <DropZone
                iso={iso}
                beforeTaskId={dayTasks[0]?.id ?? null}
                isActive={isDropZoneActive(iso, dayTasks[0]?.id ?? null)}
                onHover={() => hoverDropZone(iso, dayTasks[0]?.id ?? null)}
                registerView={IS_WEB ? undefined : registerDropZoneView}
              />

              {dayTasks.map((task, i) => {
                // Hovering the task body = "drop after this task" (large ~40px target).
                // The 8px DropZone above it handles the rarer "drop before" case.
                const afterId = dayTasks[i + 1]?.id ?? null;
                const rowHoverProps = IS_WEB ? {
                  onMouseEnter: () => {
                    if (!isDraggingRef.current) return;
                    const target = afterId === dragIdRef.current ? null : afterId;
                    setDropLineBoth({ iso, beforeTaskId: target });
                  },
                } as any : {};

                return (
                <View key={task.id} {...rowHoverProps}>
                  <TaskRow
                    task={task}
                    category={getCat(task.categoryCode)}
                    isPast={isPast}
                    isEditing={editingId === task.id}
                    editText={editText}
                    isDragging={draggingId === task.id}
                    onHandleMouseDown={
                      IS_WEB
                        ? (e: any) => { e.preventDefault(); startDrag(task.id, task, e.clientX, e.clientY); }
                        : undefined
                    }
                    onNativeDragStart={IS_WEB ? undefined : () => startNativeDrag(task.id)}
                    onNativeDragUpdate={IS_WEB ? undefined : updateNativeDrag}
                    onNativeDragEnd={IS_WEB ? undefined : endNativeDrag}
                    onToggle={() => onToggle(task.id)}
                    onDelete={() => onDelete(task.id)}
                    onMoveToToday={() => onMoveToToday(task.id)}
                    onSwipeRight={() => onSwipeRight(task.id, iso)}
                    onSwipeLeft={() => onSwipeLeft(task.id, iso)}
                    onEditStart={() => onEditStart(task.id, task.text)}
                    onEditChange={onEditChange}
                    onEditEnd={() => onEditEnd(task.id)}
                    onCatPress={() => onCatPress(task.id)}
                  />
                  {/* Drop zone below each task = before next task (or append if last) */}
                  <DropZone
                    iso={iso}
                    beforeTaskId={dayTasks[i + 1]?.id ?? null}
                    isActive={isDropZoneActive(iso, dayTasks[i + 1]?.id ?? null)}
                    onHover={() => hoverDropZone(iso, dayTasks[i + 1]?.id ?? null)}
                    registerView={IS_WEB ? undefined : registerDropZoneView}
                  />
                </View>
                );
              })}

              {!catFilter && (
                <ExpressMeasure iso={iso} registerView={IS_WEB ? undefined : registerExpressView}>
                  <ExpressEntry
                    isoDate={iso}
                    defaultCat={defaultExpressCat(iso)}
                    categories={categories}
                    onCommit={(text, cat) => onExpressCommit(iso, text, cat)}
                    isActive={activeExpressDate === iso}
                    onActivate={() => setActiveExpressDate(iso)}
                    onDeactivate={() => setActiveExpressDate(null)}
                  />
                </ExpressMeasure>
              )}
            </View>
          );
        })}

        <TouchableOpacity style={styles.showMoreBtn} onPress={onShowMore}>
          <Text style={styles.showMoreText}>+ 7 MORE DAYS</Text>
        </TouchableOpacity>
      </ScrollView>

      {ghostTask && ghostCat && IS_WEB && (
        <View
          pointerEvents="none"
          style={[styles.ghost, { left: ghostPos.x + 14, top: ghostPos.y - 10 } as any]}
        >
          <View style={[styles.ghostDot, { backgroundColor: ghostCat.color }]} />
          <Text style={styles.ghostText} numberOfLines={1}>{ghostTask.text}</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 110 },
  dateSection: { marginTop: 22 },
  dateHeader: {
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderSubtle,
    marginBottom: 2,
  },
  dateLabel: { fontFamily: 'monospace', fontSize: 11, letterSpacing: 3 },
  // Drop zone strip
  dropZone: {
    height: 9,
    justifyContent: 'center',
  },
  dropZoneLine: {
    height: 2,
    backgroundColor: theme.accent,
    borderRadius: 1,
    opacity: 0,
  },
  dropZoneLineActive: {
    opacity: 1,
  },
  showMoreBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.borderSubtle,
    borderRadius: 4,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 26,
    marginBottom: 9,
  },
  showMoreText: { color: theme.cream3, fontFamily: 'monospace', fontSize: 11, letterSpacing: 2.5 },
  ghost: {
    position: 'fixed' as any,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 260,
    opacity: 0.92,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },
  ghostDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  ghostText: { color: theme.cream, fontFamily: 'monospace', fontSize: 14, flexShrink: 1 },
});
