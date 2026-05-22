import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { theme } from '../constants/theme';
import { Category, Task } from '../types';

interface Props {
  task: Task;
  category: Category;
  isPast: boolean;
  isEditing: boolean;
  editText: string;
  isDragging?: boolean;
  onHandleMouseDown?: (e: any) => void;
  // Native drag callbacks — wired from TaskList. The handle attaches a
  // long-press-activated Pan that fires these three on JS thread.
  onNativeDragStart?: () => void;
  onNativeDragUpdate?: (absoluteY: number) => void;
  onNativeDragEnd?: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onMoveToToday: () => void;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onEditStart: () => void;
  onEditChange: (text: string) => void;
  onEditEnd: () => void;
  onCatPress: () => void;
}

const SWIPE_THRESHOLD = 52;
const RUBBER_BAND = 0.45;
const MAX_TX = 60;

export default function TaskRow({
  task,
  category,
  isPast,
  isEditing,
  editText,
  isDragging,
  onHandleMouseDown,
  onNativeDragStart,
  onNativeDragUpdate,
  onNativeDragEnd,
  onToggle,
  onDelete,
  onMoveToToday,
  onSwipeRight,
  onSwipeLeft,
  onEditStart,
  onEditChange,
  onEditEnd,
  onCatPress,
}: Props) {
  const tx = useSharedValue(0);

  const triggerSwipe = (dir: 'right' | 'left') => {
    if (dir === 'right') onSwipeRight();
    else onSwipeLeft();
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const raw = e.translationX;
      tx.value = Math.sign(raw) * Math.min(Math.abs(raw) * RUBBER_BAND, MAX_TX);
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const dir = e.translationX > 0 ? 'right' : 'left';
        tx.value = withTiming(0, { duration: 280 });
        runOnJS(triggerSwipe)(dir);
      } else {
        tx.value = withSpring(0);
      }
    });

  // Long-press the ⠿ handle to begin dragging. Once the long-press fires,
  // pan tracks the finger's absolute Y so TaskList can find the drop zone.
  // onFinalize runs on both end and cancel; commitDrop is a no-op if the
  // gesture never actually activated.
  const dragGesture = Gesture.Pan()
    .activateAfterLongPress(280)
    .onStart(() => {
      if (onNativeDragStart) runOnJS(onNativeDragStart)();
    })
    .onUpdate((e) => {
      if (onNativeDragUpdate) runOnJS(onNativeDragUpdate)(e.absoluteY);
    })
    .onFinalize(() => {
      if (onNativeDragEnd) runOnJS(onNativeDragEnd)();
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  const rightOverlayStyle = useAnimatedStyle(() => ({
    opacity: tx.value > 0 ? Math.min(tx.value / 30, 1) : 0,
  }));
  const leftOverlayStyle = useAnimatedStyle(() => ({
    opacity: tx.value < 0 ? Math.min(-tx.value / 30, 1) : 0,
  }));

  const rowOpacity = isDragging ? 0.3 : task.done ? 0.45 : 1;

  return (
    <View
      style={[styles.container, { opacity: rowOpacity }]}
    >
      {/*
        ⠿ handle — drag source. On web: mousedown. On native: long-press
        activates a Pan gesture (kept outside the swipe GestureDetector so
        the two don't fight for the same finger).
      */}
      {onNativeDragStart ? (
        <GestureDetector gesture={dragGesture}>
          <View style={styles.handle}>
            <Text style={styles.handleIcon}>⠿</Text>
          </View>
        </GestureDetector>
      ) : (
        <View style={styles.handle} {...(onHandleMouseDown ? { onMouseDown: onHandleMouseDown } as any : {})}>
          <Text style={styles.handleIcon}>⠿</Text>
        </View>
      )}

      {/* Swipe gesture wraps only the task content, not the handle */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.swipeRow, animStyle]}>
          <Animated.View style={[styles.overlay, styles.overlayRight, rightOverlayStyle]} pointerEvents="none">
            <Text style={[styles.swipeLabel, { color: '#a8c99a' }]}>+1 DAY ›</Text>
          </Animated.View>

          <Animated.View style={[styles.overlay, styles.overlayLeft, leftOverlayStyle]} pointerEvents="none">
            <Text style={[styles.swipeLabel, { color: '#7eb8c9' }]}>‹ +2 DAYS</Text>
          </Animated.View>

          {/* Checkbox */}
          <TouchableOpacity
            style={[
              styles.checkbox,
              task.done && { borderColor: category.color, backgroundColor: category.color + '20' },
            ]}
            onPress={onToggle}
          >
            {task.done && <Text style={[styles.checkmark, { color: category.color }]}>✓</Text>}
          </TouchableOpacity>

          {/* Category badge */}
          <TouchableOpacity
            onPress={onCatPress}
            style={[styles.catBadge, { backgroundColor: category.color + '1a' }]}
          >
            <Text style={[styles.catCode, { color: category.color }]}>{category.code}</Text>
          </TouchableOpacity>

          {/* Task text / inline editor */}
          {isEditing ? (
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={onEditChange}
              onBlur={onEditEnd}
              onSubmitEditing={onEditEnd}
              autoFocus
              returnKeyType="done"
              blurOnSubmit
            />
          ) : (
            <TouchableOpacity style={styles.textWrap} onPress={onEditStart}>
              <Text
                style={[styles.taskText, task.done && styles.taskTextDone]}
                numberOfLines={2}
              >
                {task.text}
              </Text>
            </TouchableOpacity>
          )}

          {isPast && (
            <TouchableOpacity onPress={onMoveToToday} style={styles.actionBtn}>
              <Text style={styles.actionIcon}>↑</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
            <Text style={styles.deleteIcon}>×</Text>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
    borderRadius: 2,
  },
  dropTarget: {
    backgroundColor: 'rgba(212,201,168,0.07)',
    borderLeftColor: theme.accent,
  },
  handle: {
    paddingHorizontal: 4,
    paddingTop: 10,
    alignSelf: 'flex-start',
    cursor: 'grab' as any,
  },
  handleIcon: { color: theme.cream3, fontSize: 18, lineHeight: 18, fontWeight: '700' },
  swipeRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 4,
    justifyContent: 'center',
    zIndex: 1,
  },
  overlayRight: {
    backgroundColor: 'rgba(168,200,154,0.18)',
    alignItems: 'flex-start',
    paddingLeft: 10,
  },
  overlayLeft: {
    backgroundColor: 'rgba(122,180,200,0.18)',
    alignItems: 'flex-end',
    paddingRight: 10,
  },
  swipeLabel: { fontSize: 11, letterSpacing: 1.5, fontFamily: 'monospace' },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 2,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  checkmark: { fontSize: 10, lineHeight: 14 },
  catBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
    marginTop: 1,
    zIndex: 2,
  },
  catCode: { fontFamily: 'monospace', fontSize: 11, letterSpacing: 1, fontWeight: '500' },
  textWrap: { flex: 1, zIndex: 2 },
  taskText: { color: theme.cream2, fontFamily: 'monospace', fontSize: 14, lineHeight: 22 },
  taskTextDone: { textDecorationLine: 'line-through', color: theme.cream3 },
  editInput: {
    flex: 1,
    color: theme.cream,
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 22,
    backgroundColor: theme.surfaceDeep,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    zIndex: 2,
  },
  actionBtn: { paddingHorizontal: 4, zIndex: 2 },
  actionIcon: { color: theme.cream3, fontSize: 14 },
  deleteIcon: { color: theme.cream3, fontSize: 20, lineHeight: 24 },
});
