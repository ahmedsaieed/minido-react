import { useMemo } from 'react';
import { Task } from '../types';

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useDates(tasks: Task[], futureDays: number, today: string): string[] {
  return useMemo(() => {
    const set = new Set(tasks.map((t) => t.isoDate));
    for (let i = 0; i < futureDays; i++) {
      set.add(addDays(today, i));
    }
    const past = [...set].filter((d) => d < today).sort();
    const future = [...set].filter((d) => d >= today).sort();
    // Cap future at 20 dates only for the initial 8-day window
    const cappedFuture = futureDays <= 8 ? future.slice(0, 20) : future;
    return [...past, ...cappedFuture];
  }, [tasks, futureDays, today]);
}
