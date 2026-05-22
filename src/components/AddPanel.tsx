import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../constants/theme';
import { Category } from '../types';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseISO(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date();
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  categories: Category[];
  onAdd: (text: string, categoryCode: string, isoDate: string) => void;
  onOpenCategoryModal: () => void;
}

export default function AddPanel({ categories, onAdd, onOpenCategoryModal }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [cat, setCat] = useState(categories[0]?.code ?? 'GEN');
  const [date, setDate] = useState(todayISO());
  const [catDropOpen, setCatDropOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: open ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
    if (open) setTimeout(() => inputRef.current?.focus(), 180);
  }, [open]);

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

  const panelTranslate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] });
  const today = todayISO();
  const selectedCat = categories.find((c) => c.code === cat);

  const panelBottom = keyboardHeight;
  const panelPadBottom = keyboardHeight > 0 ? 14 : Platform.OS === 'ios' ? 34 : 22;

  return (
    <>
      {open && (
        <Animated.View
          style={[
            styles.panel,
            { transform: [{ translateY: panelTranslate }] },
            { bottom: panelBottom, paddingBottom: panelPadBottom },
          ]}
        >
          {/* Close button */}
          <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>

          {/* Row 1: Task (full width) */}
          <View style={styles.row}>
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

          {/* Row 2: Category + Date + ADD */}
          <View style={styles.row}>
            <View style={styles.catField}>
              <Text style={styles.label}>CATEGORY</Text>
              <TouchableOpacity
                style={styles.catSelect}
                onPress={() => setCatDropOpen((v) => !v)}
              >
                <Text style={styles.catSelectText} numberOfLines={1}>
                  {selectedCat ? `${selectedCat.code}` : cat}
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
              <Text style={styles.label}>DATE</Text>
              <View style={styles.dateInputWrap}>
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  placeholder={today}
                  placeholderTextColor={theme.cream3}
                  style={[styles.input, styles.dateInput]}
                  keyboardType="numbers-and-punctuation"
                />
                <TouchableOpacity
                  onPress={() => { Keyboard.dismiss(); setPickerOpen(true); }}
                  style={styles.calBtn}
                >
                  <Text style={styles.calIcon}>📅</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity onPress={handleAdd} style={styles.addBtn}>
              <Text style={styles.addBtnText}>ADD</Text>
            </TouchableOpacity>
          </View>

          {pickerOpen && (
            <DateTimePicker
              value={parseISO(date)}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_event, selected) => {
                setPickerOpen(false);
                if (selected) setDate(toISO(selected));
              }}
            />
          )}
        </Animated.View>
      )}

      {/* FAB — fixed at bottom corner, hidden while panel is open */}
      {!open && (
        <View style={styles.fab}>
          <TouchableOpacity onPress={() => setOpen(true)} style={styles.fabTouchable}>
            <Text style={styles.fabIcon}>＋</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    padding: 20,
    zIndex: 50,
  },
  closeBtn: {
    position: 'absolute',
    top: 4,
    right: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
    zIndex: 60,
  },
  closeText: { color: theme.cream3, fontSize: 24, lineHeight: 26 },
  row: { flexDirection: 'row', gap: 9, marginBottom: 12, alignItems: 'flex-end' },
  catField: { width: 110 },
  flex1: { flex: 1 },
  label: { color: theme.cream3, fontFamily: 'monospace', fontSize: 11, letterSpacing: 2, marginBottom: 6 },
  input: {
    backgroundColor: theme.surfaceDeep,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 4,
    color: theme.cream,
    fontFamily: 'monospace',
    fontSize: 14,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  dateInputWrap: { position: 'relative' },
  dateInput: { paddingRight: 40 },
  calBtn: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calIcon: { fontSize: 18 },
  catSelect: {
    backgroundColor: theme.surfaceDeep,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 4,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catSelectText: { color: theme.cream, fontFamily: 'monospace', fontSize: 14, flex: 1 },
  catSelectChevron: { color: theme.cream3, fontSize: 12 },
  catDropdown: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    minWidth: 200,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 4,
    marginBottom: 4,
    zIndex: 100,
    elevation: 20,
  },
  catOption: { paddingHorizontal: 11, paddingVertical: 9 },
  catOptionText: { color: theme.cream, fontFamily: 'monospace', fontSize: 14 },
  catSep: { height: 1, backgroundColor: theme.borderSubtle },
  addBtn: {
    backgroundColor: theme.accent,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 11,
    alignSelf: 'flex-end',
  },
  addBtnText: { color: theme.surfaceDeep, fontFamily: 'monospace', fontSize: 12, letterSpacing: 2, fontWeight: '500' },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 24,
    width: 53,
    height: 53,
    borderRadius: 27,
    backgroundColor: theme.accent,
    zIndex: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 11,
    elevation: 8,
  },
  fabTouchable: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  fabIcon: { fontSize: 27, lineHeight: 31, color: theme.surfaceDeep },
});
