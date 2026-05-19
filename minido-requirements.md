# minido — Product Requirements

> Minimal todo app. Fast entry, category-coded tasks, works on iOS, Android & web.

---

## 1. Vision

minido is a personal task manager built around one idea: **categorise without friction**. Every task gets a short code prefix (1–3 chars) that signals what area of life it belongs to. No projects, no tags, no nesting — just a flat dated list that's fast to scan and fast to fill.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native via Expo (SDK 51+) |
| Navigation | Expo Router (file-based) |
| Auth | `@react-native-google-signin/google-signin` |
| Remote storage | Google Drive `appDataFolder` via REST API |
| Local storage | SQLite via `expo-sqlite` |
| Token storage | `expo-secure-store` |
| State management | Zustand |
| Animations | `react-native-reanimated` v3 |
| Gestures | `react-native-gesture-handler` |
| Drag reorder | `react-native-draggable-flatlist` |
| Notifications | `expo-notifications` *(deferred — Phase 5)* |

**Platform targets:**

| Platform | Minimum |
|---|---|
| iOS | 13.0 |
| Android | API 21 / Android 5.0 |
| Web | Responsive, DOM-based via Expo Web |

**No custom backend.** Data lives entirely in the user's own Google Drive as a single JSON file (`minido_data.json`). The app is the backend.

---

## 3. Design Language

Reference: `minido.jsx` is the complete working prototype — use it as the primary visual and interaction spec.

| Token | Value |
|---|---|
| Background | `#3a3830` |
| Surface | `#322f28` |
| Surface deep | `#2a2822` |
| Cream (primary text) | `#e8e2d4` |
| Cream 2 (secondary text) | `#c8c0b0` |
| Cream 3 (muted) | `#7a7468` |
| Accent | `#d4c9a8` |
| Border | `#4a4640` |
| Border subtle | `#3e3b34` |

**Typography:** DM Mono via `@expo-google-fonts/dm-mono`, weight 300–500. All UI text is monospace. The wordmark uses thin geometric SVG strokes with the `O` as a pure open circle (see SVG paths in `minido.jsx` header).

**Tone:** No decorative elements. No shadows except on modals. Spacing is tight. Every pixel earns its place.

**Web vs native rendering note:** On web, Expo renders a standard DOM React app — text selection, browser accessibility, and normal scroll behaviour all work as expected. On iOS/Android, `react-native-reanimated` and `react-native-gesture-handler` run on the UI thread, giving native-quality swipe and drag performance.

---

## 4. Data Model

### Task
```ts
interface Task {
  id: string;           // UUID
  text: string;         // task description
  categoryCode: string; // references Category.code
  isoDate: string;      // "YYYY-MM-DD"
  done: boolean;
  sortOrder: number;    // manual drag order within a day
  createdAt: string;    // ISO timestamp
  updatedAt: string;    // ISO timestamp
}
```

### Category
```ts
interface Category {
  code: string;   // 1–3 uppercase chars, e.g. "GEN", "WRK", "GV"
  color: string;  // hex string e.g. "#7eb8c9"
  title: string;  // short label e.g. "Work"
}
```

### AppData (Drive file root)
```json
{
  "version": 1,
  "lastModified": "2026-05-04T12:00:00Z",
  "categories": [...],
  "tasks": [...]
}
```

**Default categories** (seeded on first launch):

| Code | Color | Title |
|---|---|---|
| GEN | `#9a9080` | General |
| WRK | `#7eb8c9` | Work |
| PRS | `#a8c99a` | Personal |
| LUV | `#c99a9a` | Dating / Relationship |

---

## 5. Sync Architecture

### Principle: local-first, Drive as source of truth on conflict

```
App opens
  → load from local SQLite immediately (instant UI)
  → fetch Drive file in background
  → compare lastModified timestamps
  → if Drive is newer: merge into local, update UI
  → if local is newer: push to Drive

Any task change
  → write to SQLite immediately
  → debounce 2s → push full JSON to Drive
```

### Conflict resolution
- Single user, multiple devices: **last-write-wins** based on `lastModified`
- No operational transforms needed at this scale

### Offline behaviour
- All reads/writes work fully offline via SQLite
- Pending Drive writes are queued; sync retries on next connectivity event (`@react-native-community/netinfo`)

---

## 6. Auth Flow

1. App opens → check for stored Google token via `expo-secure-store`
2. If token exists and valid → proceed to home screen
3. If no token → show sign-in screen (Google button only)
4. On sign-in: request scopes `email` + `https://www.googleapis.com/auth/drive.appdata`
5. Store token securely; handle refresh transparently
6. Handle revocation gracefully → return to sign-in screen
7. **Web:** Google Sign-In uses the web OAuth popup flow (same package, different render path)

---

## 7. Project Structure

```
app/
  _layout.tsx          — root layout, auth gate
  index.tsx            — redirects to /home or /signin
  signin.tsx           — sign-in screen
  home.tsx             — main task list

src/
  components/
    Header.tsx         — sticky header: logo, progress, filters
    TaskList.tsx        — grouped date sections + FlatList
    TaskRow.tsx         — single task with swipe + drag
    ExpressEntry.tsx    — inline quick-add row per day
    AddPanel.tsx        — bottom sheet add form
    CategoryModal.tsx   — new category creation modal
    CategoryPicker.tsx  — inline category change popover
    MinidoLogo.tsx      — SVG wordmark component

  store/
    taskStore.ts        — Zustand store: tasks, categories, filters
    syncStore.ts        — Drive sync state + queue

  services/
    db.ts              — expo-sqlite CRUD layer
    drive.ts           — Google Drive REST client
    sync.ts            — sync orchestrator (local ↔ Drive)
    auth.ts            — Google Sign-In wrapper

  hooks/
    useDates.ts        — derives visible date list from tasks + futureDays
    useSync.ts         — triggers sync on mount + connectivity change

  constants/
    theme.ts           — all design tokens as constants
    defaultCategories.ts

  types/
    index.ts           — Task, Category, AppData interfaces
```

---

## 8. Screens & Navigation

```
/ (root)
├── /signin     — Google sign-in screen
└── /home       — main task list (default when authenticated)
```

No nested navigation. No separate settings screen in v1.

---

## 9. Home Screen

### Header (sticky)
- minido wordmark SVG (left)
- Thin divider
- Progress bar (completion ratio, 36px wide)
- Thin divider
- Status filter pills: ALL · TODO · DONE
- Thin divider
- Category filter chips (dot + code per category)

All on one horizontal row. Wraps on narrow screens.

### Task List

Tasks grouped by ISO date, sorted chronologically.

**Date header row**
- Past dates: muted cream colour, prefixed `↑`
- Today: bright cream, suffixed `· TODAY`
- Future: accent colour

**Initial date window on open:**
- All past dates that have tasks
- Today + 7 days ahead (always shown, even if empty)
- Future task dates beyond 7 days included but capped at 20 total
- `+ 7 MORE DAYS` button at bottom — each tap adds 7 more days, **uncapped** after first tap

**Task row**
- Drag handle `⠿` (visible on hover / long-press on mobile)
- Checkbox — tap to toggle; uses category colour when done
- Category badge — tap to open inline `CategoryPicker`
- Task text — double-tap to edit inline
- Past tasks only: move-to-today icon button (shows on hover)
- Delete `×` (shows on hover)
- Opacity 45% when done

**Express entry** (bottom of every day section, filter = ALL only)
- Dashed checkbox placeholder
- Inline category `<select>` styled as coloured code text (no native chrome)
- Text input with placeholder `add task…`
- Press Enter (web) or tap anywhere outside the row (mobile) → commits, cursor stays, category persists for next entry
- Default category: last task in that day, or GEN for empty days
- Row opacity 32% when unfocused, 100% when focused or has text

### Swipe Gestures (task rows — `react-native-gesture-handler`)
- Swipe right → move task to next day (+1)
- Swipe left → move task two days ahead (+2)
- Live `translateX` rubber-band feedback (45% of finger travel, capped 60px)
- Directional gradient overlay: `+1 DAY ›` (green tint) or `‹ +2 DAYS` (blue tint)
- Threshold 52px: on release past threshold → fly animation → task moves

### Drag to Reorder (`react-native-draggable-flatlist`)
- Drag within a day or across days
- Drop on date header → appends to end of that day
- Dragging row: 30% opacity; drop target row: left accent border highlight

---

## 10. FAB — Add Task Panel

Floating `+` button, bottom right. Rotates to `×` when open.

Bottom sheet panel (slides up from bottom):
- **Category** dropdown → code — title, last option `＋ Create new…`
- **Task** text input (auto-focused on open)
- **Date** picker (native date picker, minimum = today)
- **ADD** button

Enter submits. Escape / tap outside closes.

---

## 11. New Category Modal

Triggered from: Add panel category dropdown, or inline CategoryPicker on task rows.

Fields (single modal, no steps):
- **Code** (1–3 uppercase chars) + **Short Title** on one row
- **Color** — 10 preset swatches + custom colour picker
- Live preview badge (shown when code ≥ 1 char and title filled)
- `×` close button top-right

Validation: code 1–3 chars, unique; title required.

---

## 12. Build Phases

### Phase 1 — Expo shell + local data
- `npx create-expo-app minido --template blank-typescript`
- Install and configure: `expo-sqlite`, `zustand`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-draggable-flatlist`, `@expo-google-fonts/dm-mono`
- Implement SQLite CRUD layer (`src/services/db.ts`)
- Implement Zustand task + category store (`src/store/taskStore.ts`)
- Seed default categories on first launch
- All app logic works fully offline — no auth, no Drive yet

**Phase 1 testing (before proceeding to Phase 2):**

Write a Jest + `@testing-library/react-native` test suite covering:

| Test | What it verifies |
|---|---|
| `db.createTask` | Task is inserted and returned with correct fields |
| `db.updateTask` | Field changes persist on re-read |
| `db.deleteTask` | Task is removed; others are unaffected |
| `db.getTasksByDate` | Returns only tasks for the given ISO date |
| `db.createCategory` | Category is inserted; code uniqueness enforced |
| `db.seedDefaults` | GEN, WRK, PRS, LUV present after first launch |
| `db.seedDefaults` idempotent | Running seed twice doesn't duplicate categories |
| Zustand `addTask` | Store reflects new task immediately |
| Zustand `toggleDone` | `done` flips; `updatedAt` is refreshed |
| Zustand `moveTask` | `isoDate` changes to target date |
| Zustand `changeCategory` | Task `categoryCode` updates correctly |
| Zustand `deleteTask` | Task removed from store |
| Zustand `addCategory` | Category added; available for task assignment |
| `useDates` hook | Returns correct date list for given tasks + futureDays |
| `useDates` past cap | Past dates with no tasks are excluded |
| `useDates` future cap | Initial window capped at 20 future dates |
| `useDates` show more | Uncapped after futureDays > 8 |

All tests must pass before Phase 2 begins. Run with `npx jest --coverage`; target ≥ 90% coverage on `src/services/db.ts` and `src/store/taskStore.ts`.

### Phase 2A — Android UI (priority)
- Port all components from `minido.jsx` to React Native, **targeting Android first**
- `TaskRow` with `react-native-reanimated` v3 swipe gestures
- `TaskList` with `react-native-draggable-flatlist` drag reorder
- `ExpressEntry` (tap-outside-to-commit via `onBlur` on mobile)
- `AddPanel`, `CategoryModal`, `CategoryPicker`
- Sticky `Header` with filters
- All design tokens from `theme.ts`
- Test on Android emulator (API 21 min) and a physical Android device
- Swipe, drag, express entry, and all interactions must feel native-quality on Android before proceeding

### Phase 2B — Web UI
- Ensure all components render correctly via Expo Web (DOM-based)
- Swap touch gesture handlers for mouse equivalents where needed using `Platform.select()` or `.web.ts` file pairs
- Express entry: Enter key commits on web (tap-outside already works via `onBlur`)
- Test in Chrome and Safari

### Phase 3 — Google Sign-In
- Install `@react-native-google-signin/google-signin`
- Sign-in screen → home navigation
- Token stored in `expo-secure-store`
- Token refresh handled transparently
- Sign-out accessible from a long-press or settings gesture (TBD)

### Phase 4 — Google Drive sync
- Implement `src/services/drive.ts` — read/write `minido_data.json` to `appDataFolder`
- Implement `src/services/sync.ts` — local-first orchestrator per Section 5
- Offline queue with `@react-native-community/netinfo` retry trigger
- Schema migration via `version` field
- Web: OAuth popup flow via `@react-native-google-signin/google-signin` web support

### Phase 5 — Notifications *(deferred)*
- `expo-notifications`
- Daily digest for overdue tasks
- Optional per-task reminders

### Phase 6 — iOS *(lowest priority)*
- Audit all components for iOS-specific rendering differences
- Test swipe and drag on iOS simulator and physical device
- Handle iOS keyboard avoidance for `AddPanel` bottom sheet
- Submit to App Store

---

## 13. Reference Assets

| File | Purpose |
|---|---|
| `minido.jsx` | **Primary spec** — complete working prototype; use as pixel + interaction reference for all UI work |
| `minido-logo.png` | Wordmark reference |

---

## 14. Prompting Notes for Claude Code

- Always work **one phase at a time**. Do not implement auth or Drive until Phase 1 is complete and tested.
- The `minido.jsx` prototype is the source of truth for all UI behaviour. When in doubt about an interaction, refer to it.
- All design tokens live in `src/constants/theme.ts`. Never hardcode colours or font sizes inline.
- Use `react-native-reanimated` for all animations — never `Animated` from core React Native.
- Platform differences (web vs native) should be isolated to a `Platform.select()` call or a `.web.ts` / `.native.ts` file pair — never scattered through component logic.
- SQLite writes are the primary source of truth for state. Zustand is a read cache derived from SQLite, not the other way around.

---

## 15. Out of Scope (v1)

- Collaboration / shared lists
- Recurring tasks
- Sub-tasks
- Multiple accounts
- Export / import
- Dark/light mode toggle (dark only)
- Web push notifications
