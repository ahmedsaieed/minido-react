import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { Category } from '../types';

interface Props {
  isoDate: string;
  defaultCat: string;
  categories: Category[];
  onCommit: (text: string, categoryCode: string) => void;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}

function ExpressEntry({
  isoDate, defaultCat, categories, onCommit,
  isActive, onActivate, onDeactivate,
}: Props) {
  const [text, setText] = useState('');
  const [cat, setCat] = useState(defaultCat);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const onCommitRef = useRef(onCommit);
  useEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);

  useEffect(() => {
    if (!isActive) setCat(defaultCat);
  }, [defaultCat, isActive]);

  const getCat = (code: string) =>
    categories.find((c) => c.code === code) ?? { code, color: theme.cream3, title: code };

  const catObj = getCat(cat);

  const commit = () => {
    if (!text.trim()) return;
    onCommitRef.current(text.trim(), cat);
    setText('');
    setTimeout(() => inputRef.current?.focus(), 20);
  };

  // Inactive placeholder — same horizontal layout as TaskRow so the square,
  // category and text columns visually line up with real tasks above it.
  if (!isActive) {
    return (
      <Pressable onPress={onActivate} style={[styles.container, { opacity: 0.32 }]}>
        <View style={styles.handle} />
        <View style={styles.inner}>
          <View style={styles.dashedBox} />
          <View style={[styles.catBadge, { backgroundColor: catObj.color + '1a' }]}>
            <Text style={[styles.catCode, { color: catObj.color }]}>{catObj.code}</Text>
          </View>
          <Text style={[styles.taskText, styles.placeholderText]}>add task…</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <View style={styles.inner}>
        <View style={styles.dashedBox} />

        <TouchableOpacity
          onPress={() => setCatPickerOpen(true)}
          style={[styles.catBadge, { backgroundColor: catObj.color + '1a' }]}
        >
          <Text style={[styles.catCode, { color: catObj.color }]}>{catObj.code}</Text>
        </TouchableOpacity>

        {catPickerOpen && (
          <View style={styles.catDropdown}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={styles.catOption}
                onPress={() => { setCat(c.code); setCatPickerOpen(false); }}
              >
                <Text style={[styles.catOptionText, { color: c.color }]}>{c.code}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          onBlur={onDeactivate}
          onSubmitEditing={commit}
          placeholder="add task…"
          placeholderTextColor={theme.cream3}
          style={styles.textInput}
          returnKeyType="done"
          blurOnSubmit={false}
          autoFocus
        />

        {text.length > 0 && (
          <TouchableOpacity onPress={commit} style={styles.submitBtn}>
            <Text style={styles.submitText}>↵</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default memo(ExpressEntry, (prev, next) =>
  prev.isoDate === next.isoDate &&
  prev.defaultCat === next.defaultCat &&
  prev.categories === next.categories &&
  prev.isActive === next.isActive
);

// Layout numbers below match TaskRow so columns line up visually:
//   container.paddingVertical, handle width, inner paddings, gap,
//   dashedBox size+marginTop (match checkbox), catBadge paddings+marginTop,
//   font sizes — all kept in sync deliberately.
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3,
  },
  handle: {
    width: 25,
    alignSelf: 'flex-start',
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  dashedBox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.border,
    borderRadius: 2,
    marginTop: 2,
  },
  catBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
    marginTop: 1,
  },
  catCode: { fontFamily: 'monospace', fontSize: 11, letterSpacing: 1, fontWeight: '500' },
  catDropdown: {
    position: 'absolute',
    left: 48,
    top: 32,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 4,
    zIndex: 50,
    elevation: 10,
  },
  catOption: { paddingHorizontal: 11, paddingVertical: 7 },
  catOptionText: { fontFamily: 'monospace', fontSize: 12, letterSpacing: 1 },
  textInput: {
    flex: 1,
    color: theme.cream2,
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 22,
    padding: 0,
  },
  taskText: { flex: 1, color: theme.cream2, fontFamily: 'monospace', fontSize: 14, lineHeight: 22 },
  placeholderText: { color: theme.cream3 },
  submitBtn: { paddingHorizontal: 4 },
  submitText: { color: theme.cream3, fontSize: 11, letterSpacing: 1 },
});
