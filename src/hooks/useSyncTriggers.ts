// Wires up automatic sync triggers:
//   - on mount (if signed in)
//   - on app foreground
//   - debounced ~10s after any task/category change
//
// All triggers funnel through useSyncStore.syncNow which already coalesces
// concurrent calls.

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useTaskStore } from '../store/taskStore';
import { useSyncStore } from '../store/syncStore';
import { loadTokens } from '../services/googleAuth';

const DEBOUNCE_MS = 10_000;

async function isSignedIn(): Promise<boolean> {
  const t = await loadTokens();
  return !!t;
}

export function useSyncTriggers(): void {
  const syncNow = useSyncStore((s) => s.syncNow);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Skip the first tasks/categories change after hydration — those are the
  // initial DB-load setters, not real user edits.
  const skipFirstChange = useRef(true);

  // 1. On mount: trigger sync if signed in.
  useEffect(() => {
    (async () => {
      if (await isSignedIn()) syncNow();
    })();
    // Allow real mutations to schedule debounced sync after a tick.
    const t = setTimeout(() => { skipFirstChange.current = false; }, 500);
    return () => clearTimeout(t);
  }, [syncNow]);

  // 2. On app foreground.
  useEffect(() => {
    const handler = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        (async () => { if (await isSignedIn()) syncNow(); })();
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [syncNow]);

  // 3. Debounced auto-sync after task/category changes.
  useEffect(() => {
    let prevTasksRef = useTaskStore.getState().tasks;
    let prevCatsRef = useTaskStore.getState().categories;
    let prevTombTasks = useTaskStore.getState().tombstones.tasks;
    let prevTombCats = useTaskStore.getState().tombstones.categories;

    const unsub = useTaskStore.subscribe((state) => {
      const changed =
        state.tasks !== prevTasksRef ||
        state.categories !== prevCatsRef ||
        state.tombstones.tasks !== prevTombTasks ||
        state.tombstones.categories !== prevTombCats;
      prevTasksRef = state.tasks;
      prevCatsRef = state.categories;
      prevTombTasks = state.tombstones.tasks;
      prevTombCats = state.tombstones.categories;

      if (!changed) return;
      if (skipFirstChange.current) return;

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        (async () => { if (await isSignedIn()) syncNow(); })();
      }, DEBOUNCE_MS);
    });
    return () => {
      unsub();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [syncNow]);
}
