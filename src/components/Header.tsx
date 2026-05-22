import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { Category } from '../types';
import MinidoLogo from './MinidoLogo';

interface Props {
  categories: Category[];
  filter: 'all' | 'todo' | 'done';
  catFilter: string | null;
  totalDone: number;
  total: number;
  onFilterChange: (f: 'all' | 'todo' | 'done') => void;
  onCatFilterChange: (code: string | null) => void;
}

export default function Header({ categories, filter, catFilter, totalDone, total, onFilterChange, onCatFilterChange }: Props) {
  const progress = total > 0 ? (totalDone / total) * 100 : 0;

  return (
    <View style={styles.root}>
      {/* Row 1: Logo + progress + filter pills */}
      <View style={styles.row}>
        <MinidoLogo />

        <View style={styles.divider} />

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <View style={styles.divider} />

        {(['all', 'todo', 'done'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => onFilterChange(f)}
            style={[styles.pill, filter === f && styles.pillActive]}
          >
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Row 2: Category chips (horizontal scroll if needed) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
      >
        {categories.map((cat) => {
          const active = catFilter === cat.code;
          return (
            <TouchableOpacity
              key={cat.code}
              onPress={() => onCatFilterChange(active ? null : cat.code)}
              style={[styles.catChip, active && { borderColor: cat.color + '88' }]}
            >
              <View style={[styles.catDot, { backgroundColor: cat.color }]} />
              <Text style={[styles.catChipText, active && { color: theme.cream }]}>
                {cat.code}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: theme.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderSubtle,
    paddingVertical: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 13,
    flexWrap: 'nowrap',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 11,
    gap: 9,
  },
  divider: { width: 1, height: 18, backgroundColor: theme.border },
  progressTrack: {
    width: 44,
    height: 2,
    backgroundColor: theme.borderSubtle,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.accent,
    borderRadius: 1,
  },
  pill: {
    borderWidth: 1,
    borderColor: theme.borderSubtle,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillActive: {
    borderColor: theme.accent,
    backgroundColor: 'rgba(212,201,168,0.07)',
  },
  pillText: {
    color: theme.cream3,
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 1.5,
  },
  pillTextActive: { color: theme.accent },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.borderSubtle,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  catDot: { width: 7, height: 7, borderRadius: 4 },
  catChipText: {
    color: theme.cream3,
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 1,
  },
});
