import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { Category } from '../types';

export const COLOR_PRESETS = [
  '#c8b89a', '#7eb8c9', '#a8c99a', '#c99a9a',
  '#b89ac9', '#c9c97e', '#7ec9b8', '#c9a87e',
  '#9a9080', '#aab8c8',
];

interface Props {
  // When set, the form edits this category: the code is shown but locked,
  // because tasks reference categories by code.
  initial?: Category;
  existingCodes: string[];
  submitLabel: string;
  onSubmit: (category: Category) => void;
  onCancel: () => void;
  // Shown only in edit mode. Omit to hide the delete button (e.g. for GEN).
  onDelete?: () => void;
  // Explains what deleting does, shown in the confirm step.
  deleteNote?: string;
}

export default function CategoryForm({
  initial, existingCodes, submitLabel, onSubmit, onCancel, onDelete, deleteNote,
}: Props) {
  const isEdit = !!initial;
  const [code, setCode] = useState(initial?.code ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [color, setColor] = useState(initial?.color ?? COLOR_PRESETS[0]);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Re-seed when switching between categories without unmounting.
  useEffect(() => {
    setCode(initial?.code ?? '');
    setTitle(initial?.title ?? '');
    setColor(initial?.color ?? COLOR_PRESETS[0]);
    setError('');
    setConfirmingDelete(false);
  }, [initial?.code]);

  // A synced category may use a colour outside the presets; keep it pickable.
  const swatches = COLOR_PRESETS.includes(color) || !initial
    ? COLOR_PRESETS
    : [initial.color, ...COLOR_PRESETS];

  const handleSubmit = () => {
    const c = code.trim().toUpperCase();
    if (!isEdit) {
      if (c.length < 1 || c.length > 3) { setError('Code must be 1–3 characters'); return; }
      if (existingCodes.includes(c)) { setError('Code already exists'); return; }
    }
    if (!title.trim()) { setError('Title is required'); return; }
    onSubmit({
      ...(initial ?? {}),
      code: isEdit ? initial!.code : c,
      color,
      title: title.trim(),
      updatedAt: new Date().toISOString(),
    });
  };

  if (confirmingDelete && initial) {
    return (
      <View>
        <Text style={styles.confirmText}>
          Delete <Text style={{ color: initial.color }}>{initial.code}</Text> · {initial.title}?
        </Text>
        {!!deleteNote && <Text style={styles.confirmNote}>{deleteNote}</Text>}
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => setConfirmingDelete(false)} style={styles.btnGhost}>
            <Text style={styles.btnGhostText}>KEEP</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.btnDanger}>
            <Text style={styles.btnPrimaryText}>DELETE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View>
      {/* Code + Title */}
      <View style={styles.row}>
        <View style={styles.codeField}>
          <Text style={styles.label}>{isEdit ? 'CODE' : 'CODE (1–3)'}</Text>
          {isEdit ? (
            <View style={[styles.input, styles.codeLocked]}>
              <Text style={[styles.codeLockedText, { color }]}>{code}</Text>
            </View>
          ) : (
            <TextInput
              value={code}
              onChangeText={(v) => { setCode(v.toUpperCase()); setError(''); }}
              maxLength={3}
              placeholder="MKT"
              placeholderTextColor={theme.cream3}
              autoCapitalize="characters"
              style={[styles.input, styles.codeInput]}
            />
          )}
        </View>
        <View style={styles.flex1}>
          <Text style={styles.label}>SHORT TITLE</Text>
          <TextInput
            value={title}
            onChangeText={(v) => { setTitle(v); setError(''); }}
            placeholder="e.g. Marketing"
            placeholderTextColor={theme.cream3}
            onSubmitEditing={handleSubmit}
            style={styles.input}
          />
        </View>
      </View>

      {/* Color */}
      <View style={styles.colorSection}>
        <Text style={styles.label}>COLOR</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.colorRow}>
            {swatches.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotSel]}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Preview */}
      {code.length >= 1 && title.length > 0 && (
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>PREVIEW</Text>
          <View style={[styles.previewBadge, { backgroundColor: color + '1a' }]}>
            <Text style={[styles.previewCode, { color }]}>{code.toUpperCase()}</Text>
          </View>
          <Text style={styles.previewTitle}>{title}</Text>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Actions */}
      <View style={styles.actions}>
        {isEdit && onDelete && (
          <TouchableOpacity onPress={() => setConfirmingDelete(true)} style={styles.btnDeleteLink}>
            <Text style={styles.btnDeleteLinkText}>DELETE</Text>
          </TouchableOpacity>
        )}
        <View style={styles.flex1} />
        <TouchableOpacity onPress={onCancel} style={styles.btnGhost}>
          <Text style={styles.btnGhostText}>CANCEL</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSubmit} style={styles.btnPrimary}>
          <Text style={styles.btnPrimaryText}>{submitLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const DANGER = '#d48a8a';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 9, marginBottom: 16, alignItems: 'flex-end' },
  codeField: { width: 100 },
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
  codeInput: { textAlign: 'center', letterSpacing: 3 },
  codeLocked: { alignItems: 'center', borderStyle: 'dashed' },
  codeLockedText: { fontFamily: 'monospace', fontSize: 14, letterSpacing: 3, fontWeight: '500' },
  colorSection: { marginBottom: 16 },
  colorRow: { flexDirection: 'row', gap: 8, paddingVertical: 7, paddingHorizontal: 3 },
  colorDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  colorDotSel: { borderColor: theme.cream, transform: [{ scale: 1.18 }] },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16 },
  previewLabel: { color: theme.cream3, fontFamily: 'monospace', fontSize: 11, letterSpacing: 1.5 },
  previewBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 2 },
  previewCode: { fontFamily: 'monospace', fontSize: 13, fontWeight: '500' },
  previewTitle: { color: theme.cream2, fontFamily: 'monospace', fontSize: 13 },
  error: { color: DANGER, fontFamily: 'monospace', fontSize: 12, marginBottom: 9 },
  actions: { flexDirection: 'row', gap: 9, alignItems: 'center', marginTop: 20 },
  btnGhost: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  btnGhostText: { color: theme.cream3, fontFamily: 'monospace', fontSize: 12, letterSpacing: 2 },
  btnPrimary: {
    backgroundColor: theme.accent,
    borderRadius: 4,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  btnPrimaryText: { color: theme.surfaceDeep, fontFamily: 'monospace', fontSize: 12, letterSpacing: 2, fontWeight: '500' },
  btnDanger: {
    backgroundColor: DANGER,
    borderRadius: 4,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  btnDeleteLink: { paddingVertical: 10, paddingRight: 6 },
  btnDeleteLinkText: { color: DANGER, fontFamily: 'monospace', fontSize: 12, letterSpacing: 2 },
  confirmText: { color: theme.cream, fontFamily: 'monospace', fontSize: 14, marginBottom: 10, lineHeight: 20 },
  confirmNote: { color: theme.cream2, fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
});
