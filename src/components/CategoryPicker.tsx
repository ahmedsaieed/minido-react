import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { Category } from '../types';

interface Props {
  visible: boolean;
  categories: Category[];
  currentCode: string;
  onSelect: (code: string) => void;
  onCreateNew: () => void;
  onClose: () => void;
}

export default function CategoryPicker({ visible, categories, currentCode, onSelect, onCreateNew, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.picker}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.code}
              style={styles.option}
              onPress={() => { onSelect(cat.code); onClose(); }}
            >
              <View style={[styles.dot, { backgroundColor: cat.color }]} />
              <Text style={[styles.code, { color: cat.color }]}>{cat.code}</Text>
              <Text style={styles.title}>{cat.title}</Text>
              {currentCode === cat.code && (
                <Text style={styles.check}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
          <View style={styles.sep} />
          <TouchableOpacity style={styles.option} onPress={() => { onClose(); onCreateNew(); }}>
            <Text style={styles.createNew}>＋ Create new…</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  picker: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 5,
    padding: 4,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 3,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  code: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },
  title: { color: theme.cream3, fontFamily: 'monospace', fontSize: 9, flex: 1 },
  check: { color: theme.accent, fontSize: 9 },
  sep: { height: 1, backgroundColor: theme.borderSubtle, marginVertical: 2 },
  createNew: { color: theme.cream3, fontFamily: 'monospace', fontSize: 9, letterSpacing: 1 },
});
