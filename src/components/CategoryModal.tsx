import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme } from '../constants/theme';
import { Category } from '../types';

const PRESETS = [
  '#c8b89a', '#7eb8c9', '#a8c99a', '#c99a9a',
  '#b89ac9', '#c9c97e', '#7ec9b8', '#c9a87e',
  '#9a9080', '#aab8c8',
];

interface Props {
  visible: boolean;
  existingCodes: string[];
  onClose: () => void;
  onCreate: (category: Category) => void;
}

export default function CategoryModal({ visible, existingCodes, onClose, onCreate }: Props) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(PRESETS[0]);
  const [error, setError] = useState('');

  const reset = () => { setCode(''); setTitle(''); setColor(PRESETS[0]); setError(''); };

  const handleCreate = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 1 || c.length > 3) { setError('Code must be 1–3 characters'); return; }
    if (existingCodes.includes(c)) { setError('Code already exists'); return; }
    if (!title.trim()) { setError('Title is required'); return; }
    onCreate({ code: c, color, title: title.trim() });
    reset();
    onClose();
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.modal} onPress={() => {}}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>NEW CATEGORY</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Code + Title */}
          <View style={styles.row}>
            <View style={styles.codeField}>
              <Text style={styles.label}>CODE (1–3)</Text>
              <TextInput
                value={code}
                onChangeText={(v) => { setCode(v.toUpperCase()); setError(''); }}
                maxLength={3}
                placeholder="MKT"
                placeholderTextColor={theme.cream3}
                autoCapitalize="characters"
                style={[styles.input, styles.codeInput]}
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>SHORT TITLE</Text>
              <TextInput
                value={title}
                onChangeText={(v) => { setTitle(v); setError(''); }}
                placeholder="e.g. Marketing"
                placeholderTextColor={theme.cream3}
                onSubmitEditing={handleCreate}
                style={styles.input}
              />
            </View>
          </View>

          {/* Color */}
          <View style={styles.colorSection}>
            <Text style={styles.label}>COLOR</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.colorRow}>
                {PRESETS.map((c) => (
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
            <TouchableOpacity onPress={handleClose} style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCreate} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>CREATE</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: theme.accent, fontFamily: 'monospace', fontSize: 11, letterSpacing: 3 },
  closeBtn: { padding: 3 },
  closeBtnText: { color: theme.cream3, fontSize: 22, lineHeight: 24 },
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
  colorSection: { marginBottom: 16 },
  colorRow: { flexDirection: 'row', gap: 8, paddingVertical: 7 },
  colorDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  colorDotSel: { borderColor: theme.cream, transform: [{ scale: 1.18 }] },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16 },
  previewLabel: { color: theme.cream3, fontFamily: 'monospace', fontSize: 11, letterSpacing: 1.5 },
  previewBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 2 },
  previewCode: { fontFamily: 'monospace', fontSize: 13, fontWeight: '500' },
  previewTitle: { color: theme.cream2, fontFamily: 'monospace', fontSize: 13 },
  error: { color: '#d48a8a', fontFamily: 'monospace', fontSize: 12, marginBottom: 9 },
  actions: { flexDirection: 'row', gap: 9, justifyContent: 'flex-end', marginTop: 20 },
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
});
