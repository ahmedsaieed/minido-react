import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { Category } from '../types';

interface Props {
  isoDate: string;
  defaultCat: string;
  categories: Category[];
  onCommit: (text: string, categoryCode: string) => void;
}

export default function ExpressEntry({ isoDate, defaultCat, categories, onCommit }: Props) {
  const [text, setText] = useState('');
  const [cat, setCat] = useState(defaultCat);
  const [focused, setFocused] = useState(false);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!focused) setCat(defaultCat);
  }, [defaultCat, focused]);

  const getCat = (code: string) =>
    categories.find((c) => c.code === code) ?? { code, color: theme.cream3, title: code };

  const catObj = getCat(cat);

  const commit = () => {
    if (!text.trim()) return;
    onCommit(text.trim(), cat);
    setText('');
    setTimeout(() => inputRef.current?.focus(), 20);
  };

  const opacity = focused || text ? 1 : 0.32;

  return (
    <View style={[styles.row, { opacity }]}>
      <View style={styles.handleSpacer} />
      <View style={styles.dashedBox} />

      {/* Category selector */}
      <TouchableOpacity onPress={() => setCatPickerOpen(true)} style={styles.catBtn}>
        <Text style={[styles.catText, { color: catObj.color }]}>{catObj.code}</Text>
      </TouchableOpacity>

      {/* Inline cat picker dropdown */}
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
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); if (Platform.OS !== 'web') commit(); }}
        onSubmitEditing={commit}
        placeholder="add task…"
        placeholderTextColor={theme.cream3}
        style={styles.input}
        returnKeyType="done"
        blurOnSubmit={false}
      />

      {text.length > 0 && (
        <TouchableOpacity onPress={commit} style={styles.submitBtn}>
          <Text style={styles.submitText}>↵</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  handleSpacer: { width: 20 },
  dashedBox: {
    width: 15,
    height: 15,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.border,
    borderRadius: 2,
  },
  catBtn: { paddingVertical: 1 },
  catText: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, fontWeight: '500' },
  catDropdown: {
    position: 'absolute',
    left: 44,
    top: 24,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 4,
    zIndex: 50,
    elevation: 10,
  },
  catOption: { paddingHorizontal: 10, paddingVertical: 6 },
  catOptionText: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },
  input: {
    flex: 1,
    color: theme.cream2,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    padding: 0,
  },
  submitBtn: { paddingHorizontal: 3 },
  submitText: { color: theme.cream3, fontSize: 9, letterSpacing: 1 },
});
