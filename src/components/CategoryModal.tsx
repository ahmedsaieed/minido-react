import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { Category } from '../types';
import CategoryForm from './CategoryForm';

interface Props {
  visible: boolean;
  existingCodes: string[];
  onClose: () => void;
  onCreate: (category: Category) => void;
}

export default function CategoryModal({ visible, existingCodes, onClose, onCreate }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>NEW CATEGORY</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Only mounted while visible, so the form starts empty each time. */}
          {visible && (
            <CategoryForm
              existingCodes={existingCodes}
              submitLabel="CREATE"
              onSubmit={(cat) => { onCreate(cat); onClose(); }}
              onCancel={onClose}
            />
          )}
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
});
