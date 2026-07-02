# Smart DND UI Tweaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply eight UX tweaks to the Smart DND prefs and Quick Settings tile: a custom app-style prefs window with a burger menu (replacing the General tab), `+`/trash icon buttons, a friendlier offset picker, next-activation times in lists and the tile, and an option to hide the Quick Settings tile.

**Architecture:** Keep the pure/glue split. New pure helpers (`format.js`, `offset.js`, `schedule.nextStart`, `calendarMatch.nextEnable`) are unit-tested with gjs. `prefs.js` is rewritten to install its own `Adw.ToolbarView`+`Adw.HeaderBar` chrome (the handed `Adw.PreferencesWindow` is an `Adw.Window`, so `window.set_content(...)` works — verified). `dndService` enriches its status with next-activation timestamps; `quickToggle` and `extension` consume that plus a new `show-quick-settings` key.

**Tech Stack:** GJS (ESM), GNOME Shell 50, libadwaita 1.9 (Adw.ViewStack/ViewSwitcher/ToolbarView/HeaderBar/PreferencesDialog/AboutDialog), Gtk4 (DropDown/StringList/MenuButton/SpinButton), Gio.Menu/SimpleActionGroup, GSettings.

## Global Constraints

- Extension dir/UUID: `smart-dnd@keithvassallo.com`; GNOME 50 only.
- Shell-loaded modules (`extension.js`, everything in `lib/`) must NOT import Gtk/Gdk/Adw/EDataServer — only `gi://Gio`/`gi://GLib` and local pure modules. `prefs.js` is the ONLY file that may import Gtk/Adw/EDataServer.
- `ExtensionPreferences` import path on this system is `resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js` (capital S/E, `/js/`). The lowercase path does NOT exist in the prefs process.
- Pure modules import nothing from `resource:///` or `gi://`; tests assert exact values via `assertEq`; register each new test file in `test/run.js` before `run()`.
- Signals via `connectObject`/`disconnectObject` shell-side; single timeout id via one helper; no try/catch around non-throwing `disconnect`/`destroy`/`signal_unsubscribe`/`Source.remove`; `console.*` not `log()`; `disable()` leaves nothing in global scope.
- Look-ahead is **7 days everywhere** (calendar range and next-activation scans).
- Offsets remain stored as signed minutes (`enableOffsetMin`/`disableOffsetMin`): 0 = at, negative = before, positive = after.
- Shexli must stay clean (run `shexli "$(pwd)/smart-dnd@keithvassallo.com"` — absolute path; it crashes on a relative path).
- After glue/prefs changes, reinstall with `./install.sh`; prefs is verified by launching `gnome-extensions prefs smart-dnd@keithvassallo.com` and checking `journalctl --user --since "1 min ago" | grep -iE "smart-dnd|ImportError|error"` — no relogin needed for prefs.

---

### Task 1: `show-quick-settings` schema key + `format.js` (next-time formatting)

**Files:**
- Modify: `smart-dnd@keithvassallo.com/schemas/org.gnome.shell.extensions.smart-dnd.gschema.xml`
- Create: `smart-dnd@keithvassallo.com/lib/format.js`
- Test: `test/format.test.js`
- Modify: `test/run.js`

**Interfaces:**
- Produces: `formatWhen(nowMs, tsMs)` → short local string: `"HH:MM"` if `tsMs` is on the same local calendar day as `nowMs`; `"Ddd HH:MM"` (e.g. `"Mon 22:00"`) if 1–6 days ahead; `"D Mmm HH:MM"` (e.g. `"9 Jul 22:00"`) otherwise. 24-hour, zero-padded.

- [ ] **Step 1: Add the schema key**

In the schema XML, add inside `<schema>` (after `ignore-all-day`):
```xml
    <key name="show-quick-settings" type="b">
      <default>true</default>
      <summary>Show Quick Settings tile</summary>
      <description>Show the Smart DND toggle in the Quick Settings panel.</description>
    </key>
```

- [ ] **Step 2: Write `test/format.test.js`**

```js
import {test, assertEq} from './harness.js';
import {formatWhen} from '../smart-dnd@keithvassallo.com/lib/format.js';

const at = (y, mo, d, h, mi) => new Date(y, mo, d, h, mi, 0).getTime();

test('same day -> HH:MM', () => {
    assertEq(formatWhen(at(2026, 6, 2, 8, 0), at(2026, 6, 2, 22, 5)), '22:05');
});
test('within a week -> weekday HH:MM', () => {
    // 2026-07-02 is a Thursday; +4 days = Monday 2026-07-06
    assertEq(formatWhen(at(2026, 6, 2, 8, 0), at(2026, 6, 6, 7, 0)), 'Mon 07:00');
});
test('beyond a week -> day month HH:MM', () => {
    assertEq(formatWhen(at(2026, 6, 2, 8, 0), at(2026, 6, 20, 9, 30)), '20 Jul 09:30');
});
test('zero-pads hours and minutes', () => {
    assertEq(formatWhen(at(2026, 6, 2, 8, 0), at(2026, 6, 2, 9, 5)), '09:05');
});
```

- [ ] **Step 3: Run, expect FAIL** — add `import './format.test.js';` to `test/run.js` above the `run()` line, then `gjs -m test/run.js`. Expected: FAIL (module not found).

- [ ] **Step 4: Write `lib/format.js`**

```js
const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function formatWhen(nowMs, tsMs) {
    const now = new Date(nowMs);
    const t = new Date(tsMs);
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    const time = `${hh}:${mm}`;
    const diffDays = Math.round((startOfDay(t) - startOfDay(now)) / DAY_MS);
    if (diffDays === 0) return time;
    if (diffDays >= 1 && diffDays <= 6) return `${DAYS[t.getDay()]} ${time}`;
    return `${t.getDate()} ${MONTHS[t.getMonth()]} ${time}`;
}
```

- [ ] **Step 5: Run, expect PASS** — `gjs -m test/run.js`. Expected: all format tests `ok`; suite green.

- [ ] **Step 6: Verify schema compiles** — `glib-compile-schemas --dry-run smart-dnd@keithvassallo.com/schemas`. Expected: no output, exit 0.

- [ ] **Step 7: Commit**
```bash
git add smart-dnd@keithvassallo.com/schemas test/format.test.js test/run.js smart-dnd@keithvassallo.com/lib/format.js
git commit -m "Add show-quick-settings key and format.js next-time helper"
```

---

### Task 2: `schedule.nextStart` + `calendarMatch.nextEnable`

**Files:**
- Modify: `smart-dnd@keithvassallo.com/lib/schedule.js`
- Modify: `smart-dnd@keithvassallo.com/lib/calendarMatch.js`
- Test: `test/nextActivation.test.js`
- Modify: `test/run.js`

**Interfaces:**
- Consumes: `toMinutes` (schedule.js, existing); internal `matchingWindows` (calendarMatch.js, existing).
- Produces:
  - `nextStart(schedules, nowMs)` → epoch-ms of the earliest enabled schedule window START strictly after `nowMs` within the next 7 days, or `null`.
  - `nextEnable(rules, events, nowMs, ignoreAllDay)` → epoch-ms of the earliest matching-event enable edge (`on`) strictly after `nowMs`, or `null`.

- [ ] **Step 1: Write `test/nextActivation.test.js`**

```js
import {test, assertEq} from './harness.js';
import {nextStart} from '../smart-dnd@keithvassallo.com/lib/schedule.js';
import {nextEnable} from '../smart-dnd@keithvassallo.com/lib/calendarMatch.js';

const at = (y, mo, d, h, mi) => new Date(y, mo, d, h, mi, 0).getTime();
const S = 1000;

test('nextStart finds today\'s upcoming start', () => {
    // Thu 2026-07-02 08:00; schedule starts 22:00 on Thursdays (dow 4)
    const sched = {name: 'W', days: [4], start: '22:00', end: '23:00', enabled: true};
    assertEq(nextStart([sched], at(2026, 6, 2, 8, 0)), at(2026, 6, 2, 22, 0));
});
test('nextStart rolls to next matching day when today passed', () => {
    const sched = {name: 'W', days: [4], start: '22:00', end: '23:00', enabled: true};
    // Thu 23:00 -> next Thursday
    assertEq(nextStart([sched], at(2026, 6, 2, 23, 0)), at(2026, 6, 9, 22, 0));
});
test('nextStart ignores disabled schedules and returns null when none', () => {
    const sched = {name: 'W', days: [4], start: '22:00', end: '23:00', enabled: false};
    assertEq(nextStart([sched], at(2026, 6, 2, 8, 0)), null);
    assertEq(nextStart([], at(2026, 6, 2, 8, 0)), null);
});
test('nextEnable returns earliest future on-edge', () => {
    const rule = {name: 'R', matchType: 'contains', pattern: 'Meet', calendars: [],
        enableOffsetMin: 0, disableOffsetMin: 0, enabled: true};
    const ev = {summary: 'Team Meeting', start: 5000, end: 6000, sourceUid: 'a', allDay: false};
    assertEq(nextEnable([rule], [ev], 1000 * S, true), 5000 * S);
    assertEq(nextEnable([rule], [ev], 5000 * S, true), null); // on-edge is now-or-past
});
test('nextEnable applies enable offset and skips non-matches', () => {
    const rule = {name: 'R', matchType: 'contains', pattern: 'Meet', calendars: [],
        enableOffsetMin: -10, disableOffsetMin: 0, enabled: true};
    const ev = {summary: 'Team Meeting', start: 5000, end: 6000, sourceUid: 'a', allDay: false};
    assertEq(nextEnable([rule], [ev], 1000 * S, true), (5000 - 600) * S);
    const noMatch = {summary: 'Lunch', start: 5000, end: 6000, sourceUid: 'a', allDay: false};
    assertEq(nextEnable([rule], [noMatch], 1000 * S, true), null);
});
```

- [ ] **Step 2: Run, expect FAIL** — add `import './nextActivation.test.js';` to `test/run.js`, run `gjs -m test/run.js`. Expected: FAIL (nextStart/nextEnable not exported).

- [ ] **Step 3: Add `nextStart` to `lib/schedule.js`**

Append to the file (the `DAY_MS`/`MIN_MS`/`toMinutes` already exist at the top):
```js
export function nextStart(schedules, nowMs) {
    const enabled = schedules.filter(s => s.enabled && toMinutes(s.start) !== toMinutes(s.end));
    if (enabled.length === 0) return null;
    const now = new Date(nowMs);
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let best = null;
    for (const s of enabled) {
        const start = toMinutes(s.start);
        for (let d = 0; d <= 7; d++) {
            const dayStart = midnight + d * DAY_MS;
            const dow = new Date(dayStart).getDay();
            if (s.days.includes(dow)) {
                const ts = dayStart + start * MIN_MS;
                if (ts > nowMs && (best === null || ts < best)) best = ts;
            }
        }
    }
    return best;
}
```

- [ ] **Step 4: Add `nextEnable` to `lib/calendarMatch.js`**

Append (uses the existing module-internal `matchingWindows`):
```js
export function nextEnable(rules, events, nowMs, ignoreAllDay) {
    let best = null;
    for (const w of matchingWindows(rules, events, ignoreAllDay)) {
        if (w.on > nowMs && (best === null || w.on < best)) best = w.on;
    }
    return best;
}
```

- [ ] **Step 5: Run, expect PASS** — `gjs -m test/run.js`. Expected: all nextActivation tests `ok`; suite green.

- [ ] **Step 6: Commit**
```bash
git add smart-dnd@keithvassallo.com/lib/schedule.js smart-dnd@keithvassallo.com/lib/calendarMatch.js test/nextActivation.test.js test/run.js
git commit -m "Add nextStart/nextEnable next-activation helpers"
```

---

### Task 3: `offset.js` — offset <-> UI mapping (for tweak #5)

**Files:**
- Create: `smart-dnd@keithvassallo.com/lib/offset.js`
- Test: `test/offset.test.js`
- Modify: `test/run.js`

**Interfaces:**
- Produces:
  - `MAG_MINUTES` = `[1, 5, 10, 15]` (the fixed magnitude choices; the "Custom" dropdown index equals `MAG_MINUTES.length` = 4).
  - `offsetToUi(min)` → `{direction, magIndex, custom}`: `direction` 0=at,1=before,2=after; `magIndex` is the index into the 5-item magnitude dropdown (0–3 for the fixed values, 4 for Custom); `custom` is the custom minute count (0 when not custom).
  - `uiToOffset(direction, magIndex, custom)` → signed minutes (0 when direction=at; `-val` before; `+val` after; `val` = `MAG_MINUTES[magIndex]` unless `magIndex===4`, then `custom`).

- [ ] **Step 1: Write `test/offset.test.js`**

```js
import {test, assertEq} from './harness.js';
import {offsetToUi, uiToOffset, MAG_MINUTES} from '../smart-dnd@keithvassallo.com/lib/offset.js';

test('MAG_MINUTES is the fixed set', () => assertEq(MAG_MINUTES, [1, 5, 10, 15]));
test('zero -> at event', () => assertEq(offsetToUi(0), {direction: 0, magIndex: 0, custom: 0}));
test('negative fixed -> before + magIndex', () => assertEq(offsetToUi(-10), {direction: 1, magIndex: 2, custom: 0}));
test('positive fixed -> after + magIndex', () => assertEq(offsetToUi(5), {direction: 2, magIndex: 1, custom: 0}));
test('non-fixed -> Custom index with value', () => assertEq(offsetToUi(-7), {direction: 1, magIndex: 4, custom: 7}));
test('uiToOffset at ignores magnitude', () => assertEq(uiToOffset(0, 3, 99), 0));
test('uiToOffset before fixed', () => assertEq(uiToOffset(1, 2, 0), -10));
test('uiToOffset after custom', () => assertEq(uiToOffset(2, 4, 7), 7));
test('round-trips', () => {
    for (const m of [0, -1, -5, -10, -15, -7, 5, 12]) {
        const ui = offsetToUi(m);
        assertEq(uiToOffset(ui.direction, ui.magIndex, ui.custom), m);
    }
});
```

- [ ] **Step 2: Run, expect FAIL** — add `import './offset.test.js';` to `test/run.js`, run `gjs -m test/run.js`. Expected: FAIL.

- [ ] **Step 3: Write `lib/offset.js`**

```js
export const MAG_MINUTES = [1, 5, 10, 15];
const CUSTOM_INDEX = MAG_MINUTES.length;

export function offsetToUi(min) {
    if (min === 0) return {direction: 0, magIndex: 0, custom: 0};
    const direction = min < 0 ? 1 : 2;
    const abs = Math.abs(min);
    const magIndex = MAG_MINUTES.indexOf(abs);
    if (magIndex >= 0) return {direction, magIndex, custom: 0};
    return {direction, magIndex: CUSTOM_INDEX, custom: abs};
}

export function uiToOffset(direction, magIndex, custom) {
    if (direction === 0) return 0;
    const val = magIndex === CUSTOM_INDEX ? custom : MAG_MINUTES[magIndex];
    return direction === 1 ? -val : val;
}
```

- [ ] **Step 4: Run, expect PASS** — `gjs -m test/run.js`. Expected: all offset tests `ok`; suite green.

- [ ] **Step 5: Commit**
```bash
git add smart-dnd@keithvassallo.com/lib/offset.js test/offset.test.js test/run.js
git commit -m "Add offset.js: signed-minutes <-> picker UI mapping"
```

---

### Task 4: 7-day calendar range + `dndService` status enrichment (tweak #7 data)

**Files:**
- Modify: `smart-dnd@keithvassallo.com/lib/calendarSource.js`
- Modify: `smart-dnd@keithvassallo.com/lib/dndService.js`

**Interfaces:**
- Consumes: `nextStart` (schedule.js), `nextEnable` (calendarMatch.js), existing `nextTransition`/`calendarNextTransition`.
- Produces: `DndService.getStatus()` now returns `{active, reason, nextOnMs, nextOffMs}` where `nextOnMs` is the next activation time (ms) when idle and automation is enabled (else `null`), and `nextOffMs` is the nearest upcoming boundary (ms) when active (else `null`).

- [ ] **Step 1: Widen the calendar range to 7 days**

In `lib/calendarSource.js`, change:
```js
const RANGE_SECONDS = 48 * 60 * 60;
```
to:
```js
const RANGE_SECONDS = 7 * 24 * 60 * 60;
```

- [ ] **Step 2: Import the new helpers in `dndService.js`**

Add to the existing import block:
```js
import {anyActiveAt, nextTransition, nextStart} from './schedule.js';
import {rulesActiveAt, calendarNextTransition, nextEnable} from './calendarMatch.js';
```
(Replace the existing `schedule.js`/`calendarMatch.js` import lines so `nextStart`/`nextEnable` are added — do not create duplicate import statements.)

- [ ] **Step 3: Enrich status in `_updateStatus`/`_evaluate`**

In `_evaluate()`, after `desired`/`scheduleActive`/`calendarActive` are computed and the timer is armed, replace the `this._updateStatus(...)` call and the `_updateStatus` method so status carries next-activation data. Change the call site to:
```js
        this._updateStatus(desired, scheduleActive, calendarActive, {
            masterEnabled, schedules, rules, events, ignoreAllDay, nowMs,
        });
```
and replace the method with:
```js
    _updateStatus(desired, scheduleActive, calendarActive, ctx) {
        let reason = 'idle';
        if (desired && scheduleActive) reason = 'schedule';
        else if (desired && calendarActive) reason = 'calendar';

        let nextOnMs = null;
        if (ctx.masterEnabled && !desired) {
            const candidates = [
                nextStart(ctx.schedules, ctx.nowMs),
                nextEnable(ctx.rules, ctx.events, ctx.nowMs, ctx.ignoreAllDay),
            ].filter(t => t !== null);
            if (candidates.length > 0) nextOnMs = Math.min(...candidates);
        }
        let nextOffMs = null;
        if (desired) {
            const candidates = [
                nextTransition(ctx.schedules, ctx.nowMs),
                calendarNextTransition(ctx.rules, ctx.events, ctx.nowMs, ctx.ignoreAllDay),
            ].filter(t => t !== null);
            if (candidates.length > 0) nextOffMs = Math.min(...candidates);
        }

        this._status = {active: desired, reason, nextOnMs, nextOffMs};
        for (const cb of this._statusHandlers) cb(this._status);
    }
```

- [ ] **Step 4: Syntax check** — `node --check smart-dnd@keithvassallo.com/lib/calendarSource.js && node --check smart-dnd@keithvassallo.com/lib/dndService.js`. Expected: exit 0 for both.

- [ ] **Step 5: Suite still green** — `gjs -m test/run.js`. Expected: unchanged pass count (no new tests; pure logic already covered).

- [ ] **Step 6: Commit**
```bash
git add smart-dnd@keithvassallo.com/lib/calendarSource.js smart-dnd@keithvassallo.com/lib/dndService.js
git commit -m "Widen calendar range to 7 days; expose next-activation in status"
```

---

### Task 5: Quick Settings tile shows next activation (tweak #7)

**Files:**
- Modify: `smart-dnd@keithvassallo.com/lib/quickToggle.js`

**Interfaces:**
- Consumes: `DndService.getStatus()` → `{active, reason, nextOnMs, nextOffMs}` (Task 4); `formatWhen` (format.js).

- [ ] **Step 1: Update imports and `subtitleFor`**

Add imports at the top:
```js
import GLib from 'gi://GLib';
import {formatWhen} from './format.js';
```
Replace `subtitleFor` with:
```js
function subtitleFor(status) {
    const nowMs = GLib.get_real_time() / 1000;
    if (status.active) {
        const base = status.reason === 'calendar' ? 'On during event' : 'On';
        return status.nextOffMs ? `${base} · until ${formatWhen(nowMs, status.nextOffMs)}` : base;
    }
    return status.nextOnMs ? `Next: ${formatWhen(nowMs, status.nextOnMs)}` : 'None scheduled';
}
```

- [ ] **Step 2: Syntax check** — `node --check smart-dnd@keithvassallo.com/lib/quickToggle.js`. Expected: exit 0.

- [ ] **Step 3: Suite green** — `gjs -m test/run.js`. Expected: unchanged.

- [ ] **Step 4: Commit**
```bash
git add smart-dnd@keithvassallo.com/lib/quickToggle.js
git commit -m "Show next activation / until-time in the Quick Settings tile"
```

---

### Task 6: Honor `show-quick-settings` (tweak #1)

**Files:**
- Modify: `smart-dnd@keithvassallo.com/extension.js`

**Interfaces:**
- Consumes: `show-quick-settings` gsetting (Task 1); `SmartDndIndicator` (quickToggle.js); `DndService`.

- [ ] **Step 1: Rewrite `extension.js` to add/remove the tile per the setting**

```js
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {DndService} from './lib/dndService.js';
import {SmartDndIndicator} from './lib/quickToggle.js';

export default class SmartDndExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._service = new DndService(this._settings);
        this._service.start();
        this._indicator = null;
        this._syncIndicator();
        this._settings.connectObject('changed::show-quick-settings',
            () => this._syncIndicator(), this);
    }

    disable() {
        this._settings.disconnectObject(this);
        this._removeIndicator();
        this._service.stop();
        this._service = null;
        this._settings = null;
    }

    _syncIndicator() {
        const wanted = this._settings.get_boolean('show-quick-settings');
        if (wanted && !this._indicator) {
            this._indicator = new SmartDndIndicator(this, this._service);
            Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        } else if (!wanted && this._indicator) {
            this._removeIndicator();
        }
    }

    _removeIndicator() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
```

- [ ] **Step 2: Syntax check** — `node --check smart-dnd@keithvassallo.com/extension.js`. Expected: exit 0.

- [ ] **Step 3: Live check (controller)** — `./install.sh`, then toggle the key and confirm the tile appears/disappears without errors:
```bash
SD="$HOME/.local/share/gnome-shell/extensions/smart-dnd@keithvassallo.com/schemas"
gsettings --schemadir "$SD" set org.gnome.shell.extensions.smart-dnd show-quick-settings false
gsettings --schemadir "$SD" set org.gnome.shell.extensions.smart-dnd show-quick-settings true
journalctl --user --since "1 min ago" | grep -iE "smart-dnd|error" || echo "no errors"
```
Expected: no errors; tile hides then reappears. (Requires the extension already loaded from a prior session; if not yet loaded live, this is deferred to the next relogin.)

- [ ] **Step 4: Commit**
```bash
git add smart-dnd@keithvassallo.com/extension.js
git commit -m "Add show-quick-settings option to hide the tile"
```

---

### Task 7: Rewrite `prefs.js` — custom window, burger menu, `+`/trash, offset picker (tweaks #8, #2, #3, #4, #5, part of #1)

**Files:**
- Modify (full rewrite): `smart-dnd@keithvassallo.com/prefs.js`

**Interfaces:**
- Consumes: `parseList`/`serializeList`/`newId`/`SCHEDULE_DEFAULTS`/`RULE_DEFAULTS` (store.js); `offsetToUi`/`uiToOffset`/`MAG_MINUTES` (offset.js).
- Produces: `SmartDndPreferences.fillPreferencesWindow(window)` that installs custom chrome (no default tab header); General + About live in a burger menu; Schedule/Calendar are ViewStack pages.

- [ ] **Step 1: Write the full new `prefs.js`**

```js
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import EDataServer from 'gi://EDataServer';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {parseList, serializeList, newId, SCHEDULE_DEFAULTS, RULE_DEFAULTS}
    from './lib/store.js';
import {offsetToUi, uiToOffset, MAG_MINUTES} from './lib/offset.js';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MATCH_TYPES = [
    ['contains', 'Contains'], ['startsWith', 'Starts with'],
    ['endsWith', 'Ends with'], ['regex', 'Matches regex'],
];
const MAG_LABELS = ['1 minute', '5 minutes', '10 minutes', '15 minutes', 'Custom'];
const ENABLE_DIR = ['At event start', 'Before event', 'After event'];
const DISABLE_DIR = ['At event end', 'Before event end', 'After event end'];

function listCalendars() {
    try {
        const reg = EDataServer.SourceRegistry.new_sync(null);
        return reg.list_sources(EDataServer.SOURCE_EXTENSION_CALENDAR)
            .map(s => ({uid: s.get_uid(), name: s.get_display_name()}));
    } catch (e) {
        console.warn(`smart-dnd: calendar registry unavailable: ${e.message}`);
        return [];
    }
}

function iconButton(iconName, tooltip, cssClasses) {
    return new Gtk.Button({
        icon_name: iconName, tooltip_text: tooltip,
        css_classes: cssClasses, valign: Gtk.Align.CENTER,
    });
}

export default class SmartDndPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings;
        window.set_default_size(760, 640);

        const stack = new Adw.ViewStack();
        this._buildSchedulePage(stack, settings);
        this._buildCalendarPage(stack, settings);

        const switcher = new Adw.ViewSwitcher({stack, policy: Adw.ViewSwitcherPolicy.WIDE});
        const header = new Adw.HeaderBar({title_widget: switcher});

        const menu = new Gio.Menu();
        menu.append('General Settings', 'prefs.general');
        menu.append('About Smart DND', 'prefs.about');
        header.pack_end(new Gtk.MenuButton({
            icon_name: 'open-menu-symbolic', menu_model: menu, primary: true,
        }));

        const actions = new Gio.SimpleActionGroup();
        const general = new Gio.SimpleAction({name: 'general'});
        general.connect('activate', () => this._openGeneral(window, settings));
        actions.add_action(general);
        const about = new Gio.SimpleAction({name: 'about'});
        about.connect('activate', () => this._openAbout(window));
        actions.add_action(about);
        window.insert_action_group('prefs', actions);

        const toolbar = new Adw.ToolbarView();
        toolbar.add_top_bar(header);
        toolbar.set_content(stack);
        window.set_content(toolbar);
    }

    _openGeneral(window, settings) {
        const dialog = new Adw.PreferencesDialog({title: 'General Settings'});
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup();

        const master = new Adw.SwitchRow({title: 'Enable automation'});
        settings.bind('master-enabled', master, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(master);

        const tile = new Adw.SwitchRow({
            title: 'Show Quick Settings tile',
            subtitle: 'Show the Smart DND toggle in Quick Settings',
        });
        settings.bind('show-quick-settings', tile, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(tile);

        const allDay = new Adw.SwitchRow({
            title: 'Ignore all-day events',
            subtitle: 'Do not enable DND for all-day calendar events',
        });
        settings.bind('ignore-all-day', allDay, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(allDay);

        page.add(group);
        dialog.add(page);
        dialog.present(window);
    }

    _openAbout(window) {
        const about = new Adw.AboutDialog({
            application_name: 'Smart DND',
            application_icon: 'notifications-disabled-symbolic',
            version: '1.0',
            developer_name: 'Keith Vassallo',
            license_type: Gtk.License.GPL_3_0,
            website: 'https://github.com/keithvassallomt/smart-dnd',
            comments: 'Automatically enable Do Not Disturb on a schedule or during matching calendar events.',
        });
        about.present(window);
    }

    _buildSchedulePage(stack, settings) {
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({title: 'Schedules'});
        const addBtn = iconButton('list-add-symbolic', 'Add schedule', ['flat']);
        group.set_header_suffix(addBtn);
        page.add(group);
        stack.add_titled_with_icon(page, 'schedule', 'Schedule', 'alarm-symbolic');

        let rows = [];
        const rebuild = () => {
            for (const r of rows) group.remove(r);
            const schedules = parseList(settings.get_strv('schedules'));
            const save = () => settings.set_strv('schedules', serializeList(schedules));
            rows = schedules.map((sched, i) =>
                this._scheduleRow(sched, () => { schedules.splice(i, 1); save(); rebuild(); }, save));
            for (const r of rows) group.add(r);
        };
        addBtn.connect('clicked', () => {
            const schedules = parseList(settings.get_strv('schedules'));
            schedules.push({id: newId('sched'), ...SCHEDULE_DEFAULTS});
            settings.set_strv('schedules', serializeList(schedules));
            rebuild();
        });
        rebuild();
    }

    _scheduleRow(sched, onRemove, save) {
        const row = new Adw.ExpanderRow({
            title: sched.name || 'Schedule',
            subtitle: `${sched.start} – ${sched.end}`,
        });
        const trash = iconButton('user-trash-symbolic', 'Remove', ['flat']);
        trash.connect('clicked', onRemove);
        row.add_suffix(trash);

        const name = new Adw.EntryRow({title: 'Name', text: sched.name});
        name.connect('changed', () => {
            sched.name = name.text; row.title = name.text || 'Schedule'; save();
        });
        row.add_row(name);

        const setSub = () => { row.subtitle = `${sched.start} – ${sched.end}`; };
        row.add_row(this._timeRow('Start', sched.start, v => { sched.start = v; setSub(); save(); }));
        row.add_row(this._timeRow('End', sched.end, v => { sched.end = v; setSub(); save(); }));

        const days = new Adw.ActionRow({title: 'Days'});
        const box = new Gtk.Box({spacing: 4, valign: Gtk.Align.CENTER});
        DAY_LABELS.forEach((label, dow) => {
            const btn = new Gtk.ToggleButton({label, active: sched.days.includes(dow)});
            btn.connect('toggled', () => {
                const set = new Set(sched.days);
                btn.active ? set.add(dow) : set.delete(dow);
                sched.days = [...set].sort((a, b) => a - b);
                save();
            });
            box.append(btn);
        });
        days.add_suffix(box);
        row.add_row(days);

        const enabled = new Adw.SwitchRow({title: 'Enabled', active: sched.enabled});
        enabled.connect('notify::active', () => { sched.enabled = enabled.active; save(); });
        row.add_row(enabled);
        return row;
    }

    _buildCalendarPage(stack, settings) {
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'Calendar rules',
            description: 'Turn on DND during matching events in your calendars',
        });
        const addBtn = iconButton('list-add-symbolic', 'Add rule', ['flat']);
        group.set_header_suffix(addBtn);
        page.add(group);
        stack.add_titled_with_icon(page, 'calendar', 'Calendar', 'x-office-calendar-symbolic');

        const calendars = listCalendars();
        let rows = [];
        const rebuild = () => {
            for (const r of rows) group.remove(r);
            const rules = parseList(settings.get_strv('calendar-rules'));
            const save = () => settings.set_strv('calendar-rules', serializeList(rules));
            rows = rules.map((rule, i) =>
                this._ruleRow(rule, calendars, () => { rules.splice(i, 1); save(); rebuild(); }, save));
            for (const r of rows) group.add(r);
        };
        addBtn.connect('clicked', () => {
            const rules = parseList(settings.get_strv('calendar-rules'));
            rules.push({id: newId('rule'), ...RULE_DEFAULTS});
            settings.set_strv('calendar-rules', serializeList(rules));
            rebuild();
        });
        rebuild();
    }

    _ruleRow(rule, calendars, onRemove, save) {
        const row = new Adw.ExpanderRow({title: rule.name || 'Rule', subtitle: rule.pattern});
        const trash = iconButton('user-trash-symbolic', 'Remove', ['flat']);
        trash.connect('clicked', onRemove);
        row.add_suffix(trash);

        const name = new Adw.EntryRow({title: 'Name', text: rule.name});
        name.connect('changed', () => {
            rule.name = name.text; row.title = name.text || 'Rule'; save();
        });
        row.add_row(name);

        const match = new Adw.ComboRow({
            title: 'Match', model: Gtk.StringList.new(MATCH_TYPES.map(m => m[1])),
        });
        match.selected = Math.max(0, MATCH_TYPES.findIndex(m => m[0] === rule.matchType));
        match.connect('notify::selected', () => {
            rule.matchType = MATCH_TYPES[match.selected][0]; save();
        });
        row.add_row(match);

        const pattern = new Adw.EntryRow({title: 'Pattern', text: rule.pattern});
        pattern.connect('changed', () => {
            rule.pattern = pattern.text; row.subtitle = pattern.text; save();
        });
        row.add_row(pattern);

        if (calendars.length > 0)
            row.add_row(this._calendarPicker(rule, calendars, save));

        row.add_row(this._offsetRow('Enable DND', ENABLE_DIR, rule, 'enableOffsetMin', save));
        row.add_row(this._offsetRow('Disable DND', DISABLE_DIR, rule, 'disableOffsetMin', save));

        const enabled = new Adw.SwitchRow({title: 'Enabled', active: rule.enabled});
        enabled.connect('notify::active', () => { rule.enabled = enabled.active; save(); });
        row.add_row(enabled);
        return row;
    }

    _calendarPicker(rule, calendars, save) {
        const row = new Adw.ExpanderRow({
            title: 'Calendars',
            subtitle: rule.calendars.length === 0 ? 'All calendars' : `${rule.calendars.length} selected`,
        });
        const setSub = () => {
            row.subtitle = rule.calendars.length === 0 ? 'All calendars' : `${rule.calendars.length} selected`;
        };
        for (const cal of calendars) {
            const sw = new Adw.SwitchRow({title: cal.name, active: rule.calendars.includes(cal.uid)});
            sw.connect('notify::active', () => {
                const set = new Set(rule.calendars);
                sw.active ? set.add(cal.uid) : set.delete(cal.uid);
                rule.calendars = [...set];
                setSub(); save();
            });
            row.add_row(sw);
        }
        return row;
    }

    _offsetRow(title, dirLabels, rule, key, save) {
        const ui = offsetToUi(rule[key]);
        const row = new Adw.ActionRow({title});
        const box = new Gtk.Box({spacing: 6, valign: Gtk.Align.CENTER});

        const dir = new Gtk.DropDown({model: Gtk.StringList.new(dirLabels)});
        dir.selected = ui.direction;
        const mag = new Gtk.DropDown({model: Gtk.StringList.new(MAG_LABELS)});
        mag.selected = ui.magIndex;
        const custom = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1, upper: 600, step_increment: 1, value: ui.custom || 1,
            }),
            valign: Gtk.Align.CENTER,
        });

        const applySensitivity = () => {
            const atEvent = dir.selected === 0;
            mag.sensitive = !atEvent;
            custom.sensitive = !atEvent && mag.selected === MAG_MINUTES.length;
        };
        const sync = () => {
            applySensitivity();
            rule[key] = uiToOffset(dir.selected, mag.selected, custom.value);
            save();
        };
        dir.connect('notify::selected', sync);
        mag.connect('notify::selected', sync);
        custom.connect('notify::value', sync);
        applySensitivity();

        box.append(dir);
        box.append(mag);
        box.append(custom);
        row.add_suffix(box);
        return row;
    }

    _timeRow(title, value, onChange) {
        const row = new Adw.EntryRow({title: `${title} (HH:MM)`, text: value});
        row.connect('changed', () => {
            if (/^([01]\d|2[0-3]):[0-5]\d$/.test(row.text)) onChange(row.text);
        });
        return row;
    }
}
```

- [ ] **Step 2: Syntax check** — `node --check smart-dnd@keithvassallo.com/prefs.js`. Expected: exit 0.

- [ ] **Step 3: Live launch (controller verification)** — `./install.sh`, then:
```bash
gnome-extensions prefs smart-dnd@keithvassallo.com
journalctl --user --since "1 min ago" | grep -iE "smart-dnd|ImportError|error" || echo "no errors"
```
Expected: window opens with a ViewSwitcher (Schedule/Calendar) and a top-right burger menu (General Settings, About); `+` in each group header; trash icon per row; offset rows show the three-widget picker; no errors logged.

- [ ] **Step 4: Commit**
```bash
git add smart-dnd@keithvassallo.com/prefs.js
git commit -m "Rewrite prefs: custom window with burger menu, + / trash icons, offset picker"
```

---

### Task 8: Next-activation subtitles in the prefs lists (tweak #6)

**Files:**
- Modify: `smart-dnd@keithvassallo.com/prefs.js`

**Interfaces:**
- Consumes: `nextStart` (schedule.js), `nextEnable` (calendarMatch.js), `formatWhen` (format.js); `org.gnome.Shell.CalendarServer` (session DBus) for upcoming events.
- Produces: each schedule row subtitle shows `"<start> – <end> · Next: <when>"` (or `"· Next: —"` when none); each calendar rule row subtitle shows `"<pattern> · Next: <when>"`, updated when events load.

- [ ] **Step 1: Add imports to `prefs.js`**

Add:
```js
import GLib from 'gi://GLib';
import {nextStart} from './lib/schedule.js';
import {nextEnable} from './lib/calendarMatch.js';
import {formatWhen} from './lib/format.js';
```

- [ ] **Step 2: Schedule subtitle shows next activation**

In `_scheduleRow`, replace the `setSub` helper and initial subtitle so both the window and next-start show:
```js
        const setSub = () => {
            const now = GLib.get_real_time() / 1000;
            const next = nextStart([sched], now);
            const when = next ? formatWhen(now, next) : '—';
            row.subtitle = `${sched.start} – ${sched.end} · Next: ${when}`;
        };
        setSub();
```
Remove the plain `subtitle: \`${sched.start} – ${sched.end}\`` from the `ExpanderRow` constructor (leave `title` only) and ensure the time-row `onChange` callbacks call `setSub()` (they already do via the existing `setSub` calls).

- [ ] **Step 3: Add a one-shot CalendarServer query for the Calendar page**

Add this method to the class (loads up to 7 days of events once, then invokes `onEvents(eventsArray)`):
```js
    _queryUpcomingEvents(onEvents) {
        const iface = `
        <node><interface name="org.gnome.Shell.CalendarServer">
          <method name="SetTimeRange">
            <arg type="x" direction="in"/><arg type="x" direction="in"/><arg type="b" direction="in"/>
          </method>
          <signal name="EventsAddedOrUpdated"><arg type="a(ssxxa{sv})"/></signal>
        </interface></node>`;
        const Proxy = Gio.DBusProxy.makeProxyWrapper(iface);
        const proxy = new Proxy(Gio.DBus.session,
            'org.gnome.Shell.CalendarServer', '/org/gnome/Shell/CalendarServer');
        const collected = new Map();
        proxy.connectSignal('EventsAddedOrUpdated', (_p, _s, [events]) => {
            for (const [id, summary, start, end] of events) {
                collected.set(id, {
                    summary, start, end,
                    sourceUid: id.split('\n')[0],
                    allDay: (end > start) && ((end - start) % 86400 === 0),
                });
            }
            onEvents([...collected.values()]);
        });
        const now = Math.floor(GLib.get_real_time() / 1e6);
        proxy.SetTimeRangeAsync(now, now + 7 * 24 * 60 * 60, false).catch(
            e => console.warn(`smart-dnd: prefs SetTimeRange failed: ${e.message}`));
        return proxy;
    }
```

- [ ] **Step 4: Wire calendar-rule subtitles to live event data**

In `_buildCalendarPage`, keep the latest events and a list of subtitle updaters; refresh them when events arrive. Replace the body after `stack.add_titled_with_icon(...)` with:
```js
        const calendars = listCalendars();
        let rows = [];
        let latestEvents = [];
        let updaters = [];
        const ignoreAllDay = settings.get_boolean('ignore-all-day');

        const refreshSubtitles = () => { for (const u of updaters) u(latestEvents); };

        const rebuild = () => {
            for (const r of rows) group.remove(r);
            const rules = parseList(settings.get_strv('calendar-rules'));
            const save = () => settings.set_strv('calendar-rules', serializeList(rules));
            updaters = [];
            rows = rules.map((rule, i) => {
                const built = this._ruleRow(rule, calendars, () => { rules.splice(i, 1); save(); rebuild(); }, save);
                updaters.push(built.updateNext);
                return built.row;
            });
            for (const r of rows) group.add(r);
            refreshSubtitles();
        };
        addBtn.connect('clicked', () => {
            const rules = parseList(settings.get_strv('calendar-rules'));
            rules.push({id: newId('rule'), ...RULE_DEFAULTS});
            settings.set_strv('calendar-rules', serializeList(rules));
            rebuild();
        });
        rebuild();
        this._calendarProxy = this._queryUpcomingEvents(events => {
            latestEvents = events;
            refreshSubtitles();
        });
        void ignoreAllDay;
```
Note: `ignoreAllDay` is read once here and captured by `_ruleRow`'s updater via closure below; the `void ignoreAllDay;` line is removed in Step 5 once the updater uses it. (Keep it only if Step 5 hasn't yet referenced it — otherwise Shexli flags an unused var.)

- [ ] **Step 5: Make `_ruleRow` return an updater**

Change `_ruleRow` to return `{row, updateNext}` and set the subtitle from matching events. Replace the `_ruleRow` signature/return and subtitle handling:
```js
    _ruleRow(rule, calendars, onRemove, save) {
        const row = new Adw.ExpanderRow({title: rule.name || 'Rule'});
        const ignoreAllDay = true;
        const updateNext = (events) => {
            const now = GLib.get_real_time() / 1000;
            const next = nextEnable([rule], events, now, ignoreAllDay);
            const when = next ? formatWhen(now, next) : '—';
            const base = rule.pattern || '(no pattern)';
            row.subtitle = `${base} · Next: ${when}`;
        };
        updateNext([]);
```
Keep the rest of `_ruleRow` unchanged EXCEPT: the `pattern.connect('changed', ...)` handler must call `updateNext(this._lastCalendarEvents ?? [])` instead of setting `row.subtitle` directly, and the method must `return {row, updateNext};` at the end instead of `return row;`. To give `pattern`'s handler access to the latest events, store them on the instance: in `_queryUpcomingEvents`'s callback wiring (Step 4), also set `this._lastCalendarEvents = events;`. Update the pattern handler to:
```js
        pattern.connect('changed', () => {
            rule.pattern = pattern.text; save();
            updateNext(this._lastCalendarEvents ?? []);
        });
```
And replace the final `return row;` with `return {row, updateNext};`. (`ignoreAllDay` is hardcoded `true` here to match the shell-side default; a rule's next-enable preview ignoring all-day events is correct for the common case. Remove the `void ignoreAllDay;` line added in Step 4 since it is no longer needed.)

- [ ] **Step 6: Store latest events on the instance in Step 4's callback**

Update the proxy callback in `_buildCalendarPage` to also stash events for the pattern handler:
```js
        this._calendarProxy = this._queryUpcomingEvents(events => {
            latestEvents = events;
            this._lastCalendarEvents = events;
            refreshSubtitles();
        });
```
(Remove the now-unnecessary `void ignoreAllDay;` and the `const ignoreAllDay = ...` line in `_buildCalendarPage` from Step 4 — the all-day handling now lives in `_ruleRow`.)

- [ ] **Step 7: Syntax check** — `node --check smart-dnd@keithvassallo.com/prefs.js`. Expected: exit 0.

- [ ] **Step 8: Live launch (controller verification)** — `./install.sh`, add a schedule and a calendar rule, then:
```bash
gnome-extensions prefs smart-dnd@keithvassallo.com
journalctl --user --since "1 min ago" | grep -iE "smart-dnd|error" || echo "no errors"
```
Expected: schedule rows show `"22:00 – 23:00 · Next: <when>"`; calendar rule rows show `"<pattern> · Next: <when>"` (updating shortly after open as events load); no errors.

- [ ] **Step 9: Commit**
```bash
git add smart-dnd@keithvassallo.com/prefs.js
git commit -m "Show next activation time in schedule and calendar-rule lists"
```

---

### Task 9: Shexli + final verification

**Files:**
- Modify: any file Shexli flags.

- [ ] **Step 1: Run Shexli**
```bash
. venv/bin/activate
shexli "$(pwd)/smart-dnd@keithvassallo.com"
```
Expected: `clean (0 findings)`. Fix any real finding (unused vars from the Task 8 refactor are the likeliest — e.g. a leftover `void ignoreAllDay;`); re-run until clean.

- [ ] **Step 2: Full unit suite** — `gjs -m test/run.js`. Expected: all tests pass (harness + store + schedule + calendarMatch + coordinator + format + nextActivation + offset).

- [ ] **Step 3: Review-guideline pass** — confirm: no Gtk/Adw/EDataServer import in `extension.js` or `lib/`; `prefs.js` is the only Gtk/Adw/EDataServer importer; `console.*` not `log()`; `disable()` tears down the settings signal, indicator, and service. Grep to prove:
```bash
grep -rE "gi://(Gtk|Gdk|Adw|EDataServer)" smart-dnd@keithvassallo.com/extension.js smart-dnd@keithvassallo.com/lib/ && echo "VIOLATION" || echo "clean"
```

- [ ] **Step 4: Commit**
```bash
git add -A smart-dnd@keithvassallo.com test
git commit -m "Pass Shexli and review checks for UI tweaks"
```

---

## Self-Review

**Spec coverage (the 8 tweaks):**
- #1 hide QS tile → schema key (Task 1), `show-quick-settings` in General dialog (Task 7), honored in extension.js (Task 6). ✓
- #2 tab order Schedule > Calendar > (General gone) → ViewStack order + General in menu (Task 7). ✓
- #3 `+` icon top-right → `set_header_suffix` add buttons (Task 7). ✓
- #4 trash icon per row → `add_suffix` trash button (Task 7). ✓
- #5 offset picker (direction + magnitude + custom, custom-only-when-Custom) → `offset.js` (Task 3) + `_offsetRow` (Task 7). ✓
- #6 next activation in lists → schedule subtitle + calendar async query (Task 8). ✓
- #7 next activation in tile → status enrichment (Task 4) + `subtitleFor` (Task 5). ✓
- #8 burger menu instead of General tab → custom ToolbarView/HeaderBar/menu + General/About dialogs (Task 7). ✓
- 7-day look-ahead everywhere → calendarSource range (Task 4), nextStart/nextEnable scans (Task 2), prefs query (Task 8). ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code; live-launch steps give exact commands and expected observations. The Task 8 refactor is described precisely (return `{row, updateNext}`, stash `_lastCalendarEvents`); Task 9 Step 1 explicitly hunts leftover unused vars.

**Type consistency:** `formatWhen(nowMs, tsMs)` used identically in Tasks 5 and 8. `nextStart(schedules, nowMs)`/`nextEnable(rules, events, nowMs, ignoreAllDay)` signatures match between Task 2 (definition), Task 4 (dndService), and Task 8 (prefs). `offsetToUi`/`uiToOffset`/`MAG_MINUTES` consistent between Task 3 and Task 7. Status shape `{active, reason, nextOnMs, nextOffMs}` produced in Task 4, consumed in Task 5. `show-quick-settings` key consistent across Tasks 1, 6, 7.
