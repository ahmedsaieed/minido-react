import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useSyncStore } from '../store/syncStore';
import { Category } from '../types';
import CategoryManager, { CategoryView } from './CategoryManager';

interface Props {
  visible: boolean;
  onClose: () => void;
  categories: Category[];
  taskCounts: Record<string, number>;
  onCreateCategory: (category: Category) => void;
  onUpdateCategory: (code: string, changes: Pick<Category, 'title' | 'color'>) => void;
  onDeleteCategory: (code: string) => void;
}

type SettingsView = { kind: 'main' } | CategoryView;
const TITLES: Record<SettingsView['kind'], string> = {
  main: 'SETTINGS',
  list: 'CATEGORIES',
  edit: 'EDIT CATEGORY',
  new: 'NEW CATEGORY',
};

function formatRelative(ms: number | null): string {
  if (ms == null) return 'never';
  const delta = Date.now() - ms;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

export default function SettingsModal({
  visible, onClose, categories, taskCounts,
  onCreateCategory, onUpdateCategory, onDeleteCategory,
}: Props) {
  const { ready, isSignedIn, user, signIn, signOut, error: authError } = useGoogleAuth();
  const status = useSyncStore((s) => s.status);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const lastError = useSyncStore((s) => s.lastError);
  const syncNow = useSyncStore((s) => s.syncNow);
  const [view, setView] = useState<SettingsView>({ kind: 'main' });

  // Always reopen on the main settings page.
  useEffect(() => { if (!visible) setView({ kind: 'main' }); }, [visible]);

  // Android back / Esc steps back one level before closing.
  const handleBack = () => {
    if (view.kind === 'main') onClose();
    else if (view.kind === 'list') setView({ kind: 'main' });
    else setView({ kind: 'list' });
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleBack}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {view.kind === 'list' && (
                <TouchableOpacity onPress={() => setView({ kind: 'main' })} style={styles.backBtn}>
                  <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.title}>{TITLES[view.kind]}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          {view.kind !== 'main' ? (
            <CategoryManager
              view={view}
              onNavigate={setView}
              categories={categories}
              taskCounts={taskCounts}
              onCreate={onCreateCategory}
              onUpdate={onUpdateCategory}
              onDelete={onDeleteCategory}
            />
          ) : (
          <>
          <Text style={styles.sectionLabel}>CATEGORIES</Text>
          <TouchableOpacity onPress={() => setView({ kind: 'list' })} style={styles.navRow}>
            <View style={styles.navDots}>
              {categories.slice(0, 8).map((c) => (
                <View key={c.code} style={[styles.navDot, { backgroundColor: c.color }]} />
              ))}
            </View>
            <Text style={styles.navText}>{categories.length} · MANAGE</Text>
            <Text style={styles.navChevron}>›</Text>
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>GOOGLE ACCOUNT</Text>

          {!ready ? (
            <Text style={styles.help}>Loading…</Text>
          ) : isSignedIn ? (
            <View>
              <Text style={styles.userLine} numberOfLines={1}>
                {user?.email ?? 'Signed in'}
              </Text>
              {!!user?.name && <Text style={styles.userSub} numberOfLines={1}>{user.name}</Text>}

              <View style={styles.syncRow}>
                <Text style={styles.syncStatus}>
                  {status === 'syncing'
                    ? '⟳ syncing…'
                    : status === 'error'
                    ? '⚠ sync error'
                    : `✓ synced ${formatRelative(lastSyncedAt)}`}
                </Text>
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  onPress={syncNow}
                  disabled={status === 'syncing'}
                  style={styles.btnPrimary}
                >
                  <Text style={styles.btnPrimaryText}>
                    {status === 'syncing' ? 'SYNCING…' : 'SYNC NOW'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={signOut} style={styles.btnGhost}>
                  <Text style={styles.btnGhostText}>SIGN OUT</Text>
                </TouchableOpacity>
              </View>

              {!!lastError && <Text style={styles.error}>{lastError}</Text>}
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

          {!!authError && <Text style={styles.error}>{authError}</Text>}
          </>
          )}
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { paddingRight: 4 },
  backText: { color: theme.cream3, fontSize: 22, lineHeight: 24 },
  closeBtn: { padding: 3 },
  closeText: { color: theme.cream3, fontSize: 22, lineHeight: 24 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 24,
  },
  navDots: { flexDirection: 'row', gap: 4, flex: 1 },
  navDot: { width: 9, height: 9, borderRadius: 5 },
  navText: { color: theme.cream2, fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 },
  navChevron: { color: theme.cream3, fontSize: 16, lineHeight: 18 },
  sectionLabel: {
    color: theme.cream3,
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 10,
  },
  userLine: { color: theme.cream, fontFamily: 'monospace', fontSize: 14, marginBottom: 2 },
  userSub: { color: theme.cream3, fontFamily: 'monospace', fontSize: 12, marginBottom: 12 },
  help: { color: theme.cream2, fontFamily: 'monospace', fontSize: 12, lineHeight: 18, marginBottom: 14 },
  syncRow: { marginBottom: 14 },
  syncStatus: { color: theme.cream2, fontFamily: 'monospace', fontSize: 11 },
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
  error: { color: '#d48a8a', fontFamily: 'monospace', fontSize: 11, marginTop: 14, lineHeight: 16 },
});
