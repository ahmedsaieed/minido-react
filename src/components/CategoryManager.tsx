import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { FALLBACK_CATEGORY } from '../store/taskStore';
import { Category } from '../types';
import CategoryForm from './CategoryForm';

export type CategoryView =
  | { kind: 'list' }
  | { kind: 'edit'; code: string }
  | { kind: 'new' };

interface Props {
  view: CategoryView;
  onNavigate: (view: CategoryView) => void;
  categories: Category[];
  // Active task count per category code.
  taskCounts: Record<string, number>;
  onCreate: (category: Category) => void;
  onUpdate: (code: string, changes: Pick<Category, 'title' | 'color'>) => void;
  onDelete: (code: string) => void;
}

// List → edit/new, all inside the host card (no nested modals, which are
// unreliable on native). Navigation state is owned by the parent so the
// Android back button can step back through it.
export default function CategoryManager({
  view, onNavigate, categories, taskCounts, onCreate, onUpdate, onDelete,
}: Props) {
  const go = (kind: 'list' | 'new') => onNavigate({ kind });

  // If the category vanished (e.g. deleted by a sync), fall back to the list.
  const editing = view.kind === 'edit' ? categories.find((c) => c.code === view.code) : undefined;
  const existingCodes = categories.map((c) => c.code);

  if (view.kind === 'new') {
    return (
      <CategoryForm
        existingCodes={existingCodes}
        submitLabel="CREATE"
        onSubmit={(cat) => { onCreate(cat); go('list'); }}
        onCancel={() => go('list')}
      />
    );
  }

  if (editing) {
    const count = taskCounts[editing.code] ?? 0;
    const fallback = categories.find((c) => c.code === FALLBACK_CATEGORY);
    const deleteNote = count === 0
      ? 'It has no tasks.'
      : `${count} task${count === 1 ? '' : 's'} will move to ${FALLBACK_CATEGORY}${fallback ? ` · ${fallback.title}` : ''}.`;
    return (
      <CategoryForm
        initial={editing}
        existingCodes={existingCodes}
        submitLabel="SAVE"
        onSubmit={(cat) => { onUpdate(editing.code, { title: cat.title, color: cat.color }); go('list'); }}
        onCancel={() => go('list')}
        onDelete={editing.code === FALLBACK_CATEGORY ? undefined : () => { onDelete(editing.code); go('list'); }}
        deleteNote={deleteNote}
      />
    );
  }

  return (
    <View>
      <ScrollView style={styles.list}>
        {categories.map((cat) => {
          const count = taskCounts[cat.code] ?? 0;
          return (
            <TouchableOpacity key={cat.code} style={styles.row} onPress={() => onNavigate({ kind: 'edit', code: cat.code })}>
              <View style={[styles.dot, { backgroundColor: cat.color }]} />
              <Text style={[styles.code, { color: cat.color }]}>{cat.code}</Text>
              <Text style={styles.title} numberOfLines={1}>{cat.title}</Text>
              <Text style={styles.count}>{count}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.sep} />
      <TouchableOpacity style={styles.row} onPress={() => go('new')}>
        <Text style={styles.createNew}>＋ New category</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 340 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 11,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  code: { fontFamily: 'monospace', fontSize: 13, letterSpacing: 1, width: 34 },
  title: { color: theme.cream2, fontFamily: 'monospace', fontSize: 13, flex: 1 },
  count: { color: theme.cream3, fontFamily: 'monospace', fontSize: 11 },
  chevron: { color: theme.cream3, fontSize: 16, lineHeight: 18 },
  sep: { height: 1, backgroundColor: theme.borderSubtle, marginVertical: 4 },
  createNew: { color: theme.cream3, fontFamily: 'monospace', fontSize: 12, letterSpacing: 1 },
});
