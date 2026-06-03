import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { createSyncFile, downloadJson, findSyncFile, listAppData, updateSyncFile } from '../services/drive';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface DriveTestResult {
  ok: boolean;
  log: string[];
}

export default function SettingsModal({ visible, onClose }: Props) {
  const { ready, isSignedIn, user, signIn, signOut, error } = useGoogleAuth();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<DriveTestResult | null>(null);

  const runDriveTest = async () => {
    setTesting(true);
    const log: string[] = [];
    const t0 = Date.now();
    const push = (s: string) => { log.push(`${((Date.now() - t0) / 1000).toFixed(2)}s  ${s}`); };
    try {
      push('list appDataFolder…');
      const before = await listAppData();
      push(`  found ${before.length} file(s)`);

      const probe = { test: true, at: new Date().toISOString(), nonce: Math.random().toString(36).slice(2) };
      let file = await findSyncFile();
      if (file) {
        push(`update existing file (${file.id})…`);
        file = await updateSyncFile(file.id, probe);
      } else {
        push('create sync file…');
        file = await createSyncFile(probe);
      }
      push(`  id=${file.id} version=${file.version ?? '?'}`);

      push('download…');
      const fetched = await downloadJson<typeof probe>(file.id);
      push(`  nonce matches? ${fetched.nonce === probe.nonce ? 'yes' : 'NO!'}`);

      setTestResult({ ok: true, log });
    } catch (e: any) {
      log.push(`ERROR: ${e?.message ?? String(e)}`);
      setTestResult({ ok: false, log });
    } finally {
      setTesting(false);
    }
  };

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
              <View style={styles.btnRow}>
                <TouchableOpacity onPress={runDriveTest} disabled={testing} style={styles.btnPrimary}>
                  <Text style={styles.btnPrimaryText}>{testing ? 'TESTING…' : 'TEST DRIVE'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={signOut} style={styles.btnGhost}>
                  <Text style={styles.btnGhostText}>SIGN OUT</Text>
                </TouchableOpacity>
              </View>
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

          {!!testResult && (
            <View style={[styles.testBox, !testResult.ok && styles.testBoxErr]}>
              <ScrollView style={{ maxHeight: 180 }}>
                {testResult.log.map((line, i) => (
                  <Text key={i} style={styles.testLine}>{line}</Text>
                ))}
              </ScrollView>
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
  btnRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
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
  testBox: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 4,
    backgroundColor: theme.surfaceDeep,
    padding: 10,
  },
  testBoxErr: { borderColor: '#d48a8a' },
  testLine: { color: theme.cream2, fontFamily: 'monospace', fontSize: 11, lineHeight: 15 },
  error: { color: '#d48a8a', fontFamily: 'monospace', fontSize: 11, marginTop: 14, lineHeight: 16 },
});
