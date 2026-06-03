import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, DMMono_300Light, DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { DEFAULT_CATEGORIES } from './src/constants/defaultCategories';
import { theme } from './src/constants/theme';
import {
  initDb,
  seedDefaults,
  getCategories as dbGetCategories,
  getTasks as dbGetTasks,
  getTaskTombstones as dbGetTaskTombstones,
  getCategoryTombstones as dbGetCategoryTombstones,
  createTask as dbCreateTask,
  updateTask as dbUpdateTask,
  deleteTask as dbDeleteTask,
  createCategory as dbCreateCategory,
} from './src/services/db';
import { useTaskStore } from './src/store/taskStore';
import { useSyncTriggers } from './src/hooks/useSyncTriggers';
import { Category, Task } from './src/types';
import AddPanel from './src/components/AddPanel';
import CategoryModal from './src/components/CategoryModal';
import CategoryPicker from './src/components/CategoryPicker';
import Header from './src/components/Header';
import SettingsModal from './src/components/SettingsModal';
import TaskList from './src/components/TaskList';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const IS_WEB = Platform.OS === 'web';

export default function App() {
  const [fontsLoaded] = useFonts({ DMMono_300Light, DMMono_400Regular, DMMono_500Medium });
  const [dbReady, setDbReady] = useState(false);

  // Auto-sync triggers: mount + foreground + debounced mutations.
  useSyncTriggers();

  const {
    tasks, categories,
    setTasks, setCategories, setTombstones,
    addTask, updateTask, deleteTask,
    toggleDone, moveTask, changeCategory, addCategory,
  } = useTaskStore();

  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('todo');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [futureDays, setFutureDays] = useState(8);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [catPickerTaskId, setCatPickerTaskId] = useState<string | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const today = todayISO();

  // Refs so callbacks don't need tasks/editText in their dep arrays
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  const editTextRef = useRef(editText);
  useEffect(() => { editTextRef.current = editText; }, [editText]);

  // ── DB init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (IS_WEB) {
      // Web: zustand persist restores from localStorage automatically.
      // Only seed defaults if this is a first-ever launch (nothing persisted yet).
      const state = useTaskStore.getState();
      if (state.categories.length === 0) {
        setCategories(DEFAULT_CATEGORIES);
      }
      setDbReady(true);
      return;
    }
    try {
      initDb();
      seedDefaults();
      setCategories(dbGetCategories());
      setTasks(dbGetTasks());
      setTombstones({
        tasks: dbGetTaskTombstones(),
        categories: dbGetCategoryTombstones(),
      });
    } catch (e) {
      console.warn('DB init failed, falling back to in-memory store', e);
      setCategories(DEFAULT_CATEGORIES);
    }
    setDbReady(true);
  }, []);

  // ── Actions (write to SQLite then update Zustand) ────────────────────────────
  const handleAddTask = useCallback((text: string, categoryCode: string, isoDate: string) => {
    const now = new Date().toISOString();
    const task: Task = {
      id: uuid(), text, categoryCode, isoDate, done: false,
      sortOrder: tasksRef.current.filter((t) => t.isoDate === isoDate).length,
      createdAt: now, updatedAt: now,
    };
    if (!IS_WEB) { try { dbCreateTask(task); } catch (e) { console.warn(e); } }
    addTask(task);
  }, [addTask]);

  const handleExpressCommit = useCallback((isoDate: string, text: string, categoryCode: string) => {
    handleAddTask(text, categoryCode, isoDate);
  }, [handleAddTask]);

  const handleToggle = useCallback((id: string) => {
    toggleDone(id);
    if (!IS_WEB) {
      const updated = useTaskStore.getState().tasks.find((t) => t.id === id);
      if (updated) { try { dbUpdateTask(id, { done: updated.done, updatedAt: updated.updatedAt }); } catch (e) { console.warn(e); } }
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (!IS_WEB) { try { dbDeleteTask(id); } catch (e) { console.warn(e); } }
    deleteTask(id);
  }, []);

  const handleMoveTask = useCallback((id: string, isoDate: string) => {
    moveTask(id, isoDate);
    if (!IS_WEB) {
      try { dbUpdateTask(id, { isoDate, updatedAt: new Date().toISOString() }); } catch (e) { console.warn(e); }
    }
  }, []);

  const handleChangeCategory = useCallback((id: string, categoryCode: string) => {
    changeCategory(id, categoryCode);
    if (!IS_WEB) {
      try { dbUpdateTask(id, { categoryCode, updatedAt: new Date().toISOString() }); } catch (e) { console.warn(e); }
    }
  }, []);

  const handleEditEnd = useCallback((id: string) => {
    const txt = editTextRef.current.trim();
    if (!txt) {
      handleDelete(id);
    } else {
      updateTask(id, { text: txt });
      if (!IS_WEB) {
        try { dbUpdateTask(id, { text: txt, updatedAt: new Date().toISOString() }); } catch (e) { console.warn(e); }
      }
    }
    setEditingId(null);
  }, [handleDelete, updateTask]);

  const handleAddCategory = useCallback((cat: Category) => {
    if (!IS_WEB) { try { dbCreateCategory(cat); } catch (e) { console.warn(e); } }
    addCategory(cat);
  }, []);

  const handleReorder = useCallback((reordered: Task[]) => {
    const now = new Date().toISOString();
    // Bump updatedAt on any row whose position/day actually changed so sync
    // picks the reorder up as a real edit.
    const bumped = reordered.map((t) => {
      const original = tasksRef.current.find((o) => o.id === t.id);
      if (original && (original.isoDate !== t.isoDate || original.sortOrder !== t.sortOrder)) {
        return { ...t, updatedAt: now };
      }
      return t;
    });
    setTasks(bumped);
    if (!IS_WEB) {
      for (const t of bumped) {
        const original = tasksRef.current.find((o) => o.id === t.id);
        if (original && (original.isoDate !== t.isoDate || original.sortOrder !== t.sortOrder)) {
          try { dbUpdateTask(t.id, { isoDate: t.isoDate, sortOrder: t.sortOrder, updatedAt: now }); } catch (e) { console.warn(e); }
        }
      }
    }
  }, [setTasks]);

  const catPickerTask = catPickerTaskId ? tasks.find((t) => t.id === catPickerTaskId) : null;

  return (
    <SafeAreaProvider>
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.inner}>
          <Header
            categories={categories}
            filter={filter}
            catFilter={catFilter}
            totalDone={tasks.filter((t) => t.done).length}
            total={tasks.length}
            onFilterChange={setFilter}
            onCatFilterChange={setCatFilter}
            onOpenSettings={() => setShowSettings(true)}
          />

          <TaskList
            tasks={tasks}
            categories={categories}
            filter={filter}
            catFilter={catFilter}
            futureDays={futureDays}
            today={today}
            editingId={editingId}
            editText={editText}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onMoveToToday={(id) => handleMoveTask(id, today)}
            onSwipeRight={(id, iso) => {
              const d = new Date(iso + 'T00:00:00');
              d.setDate(d.getDate() + 1);
              handleMoveTask(id, `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
            }}
            onSwipeLeft={(id, iso) => {
              const d = new Date(iso + 'T00:00:00');
              d.setDate(d.getDate() + 2);
              handleMoveTask(id, `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
            }}
            onEditStart={(id, text) => { setEditingId(id); setEditText(text); }}
            onEditChange={setEditText}
            onEditEnd={handleEditEnd}
            onCatPress={(id) => setCatPickerTaskId(id)}
            onExpressCommit={handleExpressCommit}
            onShowMore={() => setFutureDays((d) => d + 7)}
            onReorder={handleReorder}
          />

          <AddPanel
            categories={categories}
            onAdd={handleAddTask}
            onOpenCategoryModal={() => setShowCatModal(true)}
          />

          {catPickerTask && (
            <CategoryPicker
              visible={!!catPickerTaskId}
              categories={categories}
              currentCode={catPickerTask.categoryCode}
              onSelect={(code) => handleChangeCategory(catPickerTask.id, code)}
              onCreateNew={() => { setCatPickerTaskId(null); setShowCatModal(true); }}
              onClose={() => setCatPickerTaskId(null)}
            />
          )}

          <CategoryModal
            visible={showCatModal}
            existingCodes={categories.map((c) => c.code)}
            onClose={() => setShowCatModal(false)}
            onCreate={handleAddCategory}
          />

          <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  root: { flex: 1, backgroundColor: theme.bg },
  inner: { flex: 1 },
});
