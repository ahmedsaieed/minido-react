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
        ⠿ handle — the only draggable element on web.
        Lives outside GestureDetector so HTML5 drag never conflicts with swipe.
      */}
      <View style={styles.handle} {...(onHandleMouseDown ? { onMouseDown: onHandleMouseDown } as any : {})}>
        <Text style={styles.handleIcon}>⠿</Text>
      </View>

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
    paddingVertical: 2,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
    borderRadius: 2,
  },
  dropTarget: {
    backgroundColor: 'rgba(212,201,168,0.07)',
    borderLeftColor: theme.accent,
  },
  handle: {
    paddingHorizontal: 3,
    paddingTop: 10,
    alignSelf: 'flex-start',
    cursor: 'grab' as any,
  },
  handleIcon: { color: theme.border, fontSize: 12 },
  swipeRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingVertical: 8,
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
  swipeLabel: { fontSize: 9, letterSpacing: 1.5, fontFamily: 'monospace' },
  checkbox: {
    width: 15,
    height: 15,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 2,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  checkmark: { fontSize: 8, lineHeight: 12 },
  catBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
    marginTop: 1,
    zIndex: 2,
  },
  catCode: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, fontWeight: '500' },
  textWrap: { flex: 1, zIndex: 2 },
  taskText: { color: theme.cream2, fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
  taskTextDone: { textDecorationLine: 'line-through', color: theme.cream3 },
  editInput: {
    flex: 1,
    color: theme.cream,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: theme.surfaceDeep,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  actionBtn: { paddingHorizontal: 3, zIndex: 2 },
  actionIcon: { color: theme.cream3, fontSize: 12 },
  deleteIcon: { color: theme.cream3, fontSize: 16, lineHeight: 20 },
});
