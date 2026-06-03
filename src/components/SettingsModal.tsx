import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { useGoogleAuth } from '../hooks/useGoogleAuth';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsModal({ visible, onClose }: Props) {
  const { ready, isSignedIn, user, signIn, signOut, error } = useGoogleAuth();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>SETTINGS</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>GOOGLE ACCOUNT</Text>

          {!ready ? (
            <Text style={styles.help}>Loading…</Text>
          ) : isSignedIn ? (
            <View>
              <Text style={styles.userLine} numberOfLines={1}>
                {user?.email ?? 'Signed in'}
              </Text>
              {!!user?.name && <Text style={styles.userSub} numberOfLines={1}>{user.name}</Text>}
              <TouchableOpacity onPress={signOut} style={styles.btnGhost}>
                <Text style={styles.btnGhostText}>SIGN OUT</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.help}>
                Sign in to back up and sync your tasks across devices via Google Drive
                (private app folder — invisible in your Drive).
              </Text>
              <TouchableOpacity onPress={signIn} style={styles.btnPrimary}>
                <Text style={styles.btnPrimaryText}>SIGN IN WITH GOOGLE</Text>
              </TouchableOpacity>
            </View>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 6,
    padding: 22,
    width: '100%',
    maxWidth: 380,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  title: { color: theme.accent, fontFamily: 'monospace', fontSize: 11, letterSpacing: 3 },
  closeBtn: { padding: 3 },
  closeText: { color: theme.cream3, fontSize: 22, lineHeight: 24 },
  sectionLabel: {
    color: theme.cream3,
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 10,
  },
  userLine: { color: theme.cream, fontFamily: 'monospace', fontSize: 14, marginBottom: 2 },
  userSub: { color: theme.cream3, fontFamily: 'monospace', fontSize: 12, marginBottom: 14 },
  help: { color: theme.cream2, fontFamily: 'monospace', fontSize: 12, lineHeight: 18, marginBottom: 14 },
  btnPrimary: {
    backgroundColor: theme.accent,
    borderRadius: 4,
    paddingHorizontal: 22,
    paddingVertical: 11,
    alignSelf: 'flex-start',
  },
  btnPrimaryText: { color: theme.surfaceDeep, fontFamily: 'monospace', fontSize: 12, letterSpacing: 2, fontWeight: '500' },
  btnGhost: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  btnGhostText: { color: theme.cream3, fontFamily: 'monospace', fontSize: 12, letterSpacing: 2 },
  error: { color: '#d48a8a', fontFamily: 'monospace', fontSize: 11, marginTop: 14, lineHeight: 16 },
});
