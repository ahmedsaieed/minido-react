import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme } from '../constants/theme';
import { Category } from '../types';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  categories: Category[];
  onAdd: (text: string, categoryCode: string, isoDate: string) => void;
  onOpenCategoryModal: () => void;
}

const FAB_BOTTOM_CLOSED = 22;
const FAB_MARGIN_ABOVE_PANEL = 10;

export default function AddPanel({ categories, onAdd, onOpenCategoryModal }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [cat, setCat] = useState(categories[0]?.code ?? 'GEN');
  const [date, setDate] = useState(todayISO());
  const [catDropOpen, setCatDropOpen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fabBottomAnim = useRef(new Animated.Value(FAB_BOTTOM_CLOSED)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const targetBottom = open ? panelHeight + FAB_MARGIN_ABOVE_PANEL : FAB_BOTTOM_CLOSED;
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: open ? 1 : 0, duration: 160, useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: open ? 1 : 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fabBottomAnim, { toValue: targetBottom, duration: 160, useNativeDriver: false }),
    ]).start();
    if (open) setTimeout(() => inputRef.current?.focus(), 180);
  }, [open, panelHeight]);

  useEffect(() => {
    if (categories.length && !categories.find((c) => c.code === cat)) {
      setCat(categories[0].code);
    }
  }, [categories]);

  const handleAdd = () => {
    if (!text.trim()) return;
    onAdd(text.trim(), cat, date);
    setText('');
    setOpen(false);
  };

  const onPanelLayout = (e: LayoutChangeEvent) => {
    setPanelHeight(e.nativeEvent.layout.height);
  };

  const panelTranslate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] });
  const fabRotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });
  const today = todayISO();
  const selectedCat = categories.find((c) => c.code === cat);

  return (
    <>
      {open && (
        <Animated.View
          style={[styles.panel, { transform: [{ translateY: panelTranslate }] }]}
          onLayout={onPanelLayout}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Row 1: Category + Task */}
            <View style={styles.row}>
              <View style={styles.catField}>
                <Text style={styles.label}>CATEGORY</Text>
                <TouchableOpacity
                  style={styles.catSelect}
                  onPress={() => setCatDropOpen((v) => !v)}
                >
                  <Text style={styles.catSelectText} numberOfLines={1}>
                    {selectedCat ? `${selectedCat.code} — ${selectedCat.title}` : cat}
                  </Text>
                  <Text style={styles.catSelectChevron}>▾</Text>
                </TouchableOpacity>
                {catDropOpen && (
                  <View style={styles.catDropdown}>
                    {categories.map((c) => (
                      <TouchableOpacity
                        key={c.code}
                        style={styles.catOption}
                        onPress={() => { setCat(c.code); setCatDropOpen(false); }}
                      >
                        <Text style={styles.catOptionText}>{c.code} — {c.title}</Text>
                      </TouchableOpacity>
                    ))}
                    <View style={styles.catSep} />
                    <TouchableOpacity
                      style={styles.catOption}
                      onPress={() => { setCatDropOpen(false); setOpen(false); onOpenCategoryModal(); }}
                    >
                      <Text style={styles.catOptionText}>＋ Create new…</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.flex1}>
                <Text style={styles.label}>TASK</Text>
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={setText}
                  placeholder="What needs doing…"
                  placeholderTextColor={theme.cream3}
                  onSubmitEditing={handleAdd}
                  style={styles.input}
                  returnKeyType="done"
                  blurOnSubmit={false}
                />
              </View>
            </View>

            {/* Row 2: Date + Add — right-padded so ADD button clears the FAB */}
            <View style={styles.row}>
              <View style={styles.flex1}>
                <Text style={styles.label}>DATE</Text>
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  placeholder={today}
                  placeholderTextColor={theme.cream3}
                  style={styles.input}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <TouchableOpacity onPress={handleAdd} style={[styles.addBtn, styles.addBtnClearsFab]}>
                <Text style={styles.addBtnText}>ADD</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      )}

      {/* FAB — animates above the panel when open */}
      <Animated.View
        style={[
          styles.fab,
          open && styles.fabOpen,
          { bottom: fabBottomAnim, transform: [{ rotate: fabRotate }] },
        ]}
      >
        <TouchableOpacity onPress={() => setOpen((v) => !v)} style={styles.fabTouchable}>
          <Text style={[styles.fabIcon, { color: open ? theme.cream3 : theme.surfaceDeep }]}>＋</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    padding: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
    zIndex: 50,
  },
  row: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-end' },
  catField: { width: 140 },
  flex1: { flex: 1 },
  label: { color: theme.cream3, fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, marginBottom: 5 },
  input: {
    backgroundColor: theme.surfaceDeep,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 4,
    color: theme.cream,
    fontFamily: 'monospace',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  catSelect: {
    backgroundColor: theme.surfaceDeep,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catSelectText: { color: theme.cream, fontFamily: 'monospace', fontSize: 12, flex: 1 },
  catSelectChevron: { color: theme.cream3, fontSize: 10 },
  catDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 4,
    zIndex: 100,
    elevation: 20,
  },
  catOption: { paddingHorizontal: 10, paddingVertical: 8 },
  catOptionText: { color: theme.cream, fontFamily: 'monospace', fontSize: 12 },
  catSep: { height: 1, backgroundColor: theme.borderSubtle },
  addBtn: {
    backgroundColor: theme.accent,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 9,
    alignSelf: 'flex-end',
  },
  // Ensure ADD button doesn't sit under the FAB (FAB is 44px wide + 20px right margin)
  addBtnClearsFab: { marginRight: 64 },
  addBtnText: { color: theme.surfaceDeep, fontFamily: 'monospace', fontSize: 10, letterSpacing: 2, fontWeight: '500' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.accent,
    zIndex: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fabOpen: { backgroundColor: theme.border },
  fabTouchable: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  fabIcon: { fontSize: 22, lineHeight: 26 },
});
