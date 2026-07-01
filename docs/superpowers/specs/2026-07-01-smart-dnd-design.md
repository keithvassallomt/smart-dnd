# Smart DND — Design Spec

**UUID:** `com.keithvassallo.smart-dnd`
**Target:** GNOME Shell 50
**Date:** 2026-07-01

## 1. Overview

A GNOME 50 extension that automatically toggles Do Not Disturb based on **time
schedules** and **calendar events**. GNOME only offers a manual DND toggle; this
adds automation.

DND is the standard gsetting `org.gnome.desktop.notifications show-banners`
(`false` = DND active). No private APIs or hacks.

The extension acts **only at transitions** (a window/event begins or ends), so it
never fights a manual DND change made mid-window.

### Design principles

- **Pure logic separated from GNOME glue.** Schedule evaluation, calendar-rule
  matching, and the coordinator state machine are pure functions of the form
  `(rules, now) -> { active, nextTransition }`. They are unit-tested with plain
  `gjs`, with exact-value assertions (antislop #31).
- **No Evolution-Data-Server work in the shell process.** The shell side filters
  events by a string it already receives. `EDataServer` is imported **only** in
  `prefs.js` (an ordinary GTK process), purely to map calendar UIDs to friendly
  names.
- **Review-clean from day one.** GNOME EGO review guidelines and the project's
  `ext_rev.md` notes are treated as hard constraints (see §9).

## 2. Architecture / file layout

```
com.keithvassallo.smart-dnd/
  metadata.json        # uuid, shell-version ["50"], settings-schema, url, donations
  extension.js         # enable()/disable() only — wires modules, owns Quick Settings
  prefs.js             # Adw preferences (Gtk/Adw/EDataServer — never in the shell)
  lib/
    coordinator.js     # state machine + DND gsetting control + ownership tracking
    schedule.js        # PURE: evaluate(schedules, now) -> {active, next}
    calendar.js        # CalendarServer DBus proxy + PURE rule matcher
    quickToggle.js     # QuickMenuToggle + SystemIndicator
    store.js           # load/save the settings lists
  schemas/
    org.gnome.shell.extensions.smart-dnd.gschema.xml
  test/                # gjs test scripts for schedule.js, calendar.js, coordinator
  po/                  # source-language strings only (antislop #2)
```

`extension.js` never imports Gtk/Gdk (review guideline). Directory name equals the
UUID.

## 3. Coordinator (state machine)

Single source of truth:

```
desired = masterEnabled && (scheduleActive || anyCalendarRuleActive)
```

State:
- `_owned` — did *this extension* turn DND on?
- `_lastDesired` — previous computed value, to detect edges.

Behaviour at each re-evaluation:
- **Rising edge** (`desired` false→true): set DND on, `_owned = true`.
- **Falling edge** (true→false): if `_owned`, set DND off, `_owned = false`.
- **No edge:** do nothing — a manual change mid-window is respected. If the user
  manually enabled DND outside any window, `_owned` stays false and we never turn
  it off.

Re-evaluation is triggered by:
- schedule timer firing,
- calendar change signal,
- settings change,
- **resume from suspend** — logind `PrepareForSleep(false)` — so a machine that
  slept through a boundary corrects on wake.

Each timer fire recomputes the *next* transition freshly from local time, so DST
and clock changes self-heal on the following fire. (Known minor limitation: a
timezone change mid-window is corrected at the next fire, not instantly — accepted
to avoid over-engineering, antislop #13/#35.)

## 4. Schedule engine (`schedule.js`, pure)

Each schedule:

```json
{ "id": "…", "name": "Weeknights", "days": [1,2,3,4,5],
  "start": "22:00", "end": "07:00", "enabled": true }
```

- `days`: 0–6 (0 = Sunday), the days the window **starts** on.
- Windows may cross midnight (`start` > `end`).
- Union across all enabled schedules.

`evaluate(schedules, now)` returns `{ active: bool, nextTransition: unixSeconds }`.
The coordinator arms a single `GLib.timeout` to `nextTransition` (no polling).

## 5. Calendar monitor (`calendar.js`)

Uses the existing shell service `org.gnome.Shell.CalendarServer` — the same
aggregated source the top-bar calendar uses (antislop #3: platform-standard).

Interface (verified live on GNOME 50.2):
- method `SetTimeRange(x since, x until, b force_reload)`
- signal `EventsAddedOrUpdated(a(ssxxa{sv}))` — tuple `(id, summary, start_unix, end_unix, extras)`
- signal `EventsRemoved(as ids)`
- signal `ClientDisappeared(s source_uid)`
- props `Since`, `Until`, `HasCalendars`

**Event id format:** `"<source-uid>\n<event-uid>\n<recurrence>"`. The first line is
the EDS source UID — i.e. which calendar the event belongs to. Verified: UID
`d6736f51…` = "Family", `9e71651b…` = "Keith Personal", matching the EDS registry
exactly.

Monitor behaviour:
- On enable and on a rolling basis, `SetTimeRange(todayStart, +48h, false)`.
- Maintain a local map `id -> { summary, start, end, sourceUid, allDay }`, updated
  from `EventsAddedOrUpdated` / `EventsRemoved`.
- **All-day inference:** extras carries no all-day flag in this signature, so infer
  it (starts at local midnight and duration is a whole number of days). Skipped by
  default unless `ignore-all-day` is off.

Each rule:

```json
{ "id": "…", "name": "Meetings",
  "matchType": "contains|startsWith|endsWith|regex", "pattern": "Meeting",
  "calendars": [],                // [] = all calendars; else list of source UIDs
  "enableOffsetMin": 0, "disableOffsetMin": 0, "enabled": true }
```

A rule is **active** if, for any event whose `sourceUid` passes the `calendars`
filter (empty = all) **and** whose title matches `pattern` per `matchType`, now is
within `[start + enableOffset, end + disableOffset)`. Title matching uses plain
string ops for contains/startsWith/endsWith (antislop #24); regex only for the
regex mode. Offsets also feed the next-transition timer.

## 6. Quick Settings (`quickToggle.js`)

An `Adw`-styled `QuickMenuToggle`:
- Title "Smart DND"; toggling it flips the master `master-enabled` key.
- Subtitle shows live status: *"On until 7:00 AM"*, *"On during 'Standup'"*, or
  *"Idle"* (plain string building, not regex).
- Expandable menu: a status line + **Settings…** which opens prefs.
- Registered through a `SystemIndicator` added to Quick Settings.

## 7. Preferences (`prefs.js`)

`fillPreferencesWindow(window)`, Adw rows, minimal text — meaning carried by
subtitles and icons rather than paragraphs.

- **General group:** master enable switch; "Ignore all-day events" switch.
- **Schedules page:** an "Add schedule" button; each schedule an
  `Adw.ExpanderRow` (title = name, subtitle e.g. "10:00 PM – 7:00 AM · Mon–Fri").
  Expanded: name entry, start/end time pickers, a pill row of weekday toggles,
  enable switch, remove button.
- **Calendar page:** one intro row ("Turns on DND during matching events in your
  calendars"); "Add rule" button; each rule an `Adw.ExpanderRow`. Expanded:
  match-type dropdown, pattern entry, a **Calendars** multi-select (friendly
  names from `EDataServer.SourceRegistry`, default "All calendars"), "Turn on"
  control (At start / X min before / X min after + spin), "Turn off" control
  (At end / X min before / X min after + spin), enable switch, remove button.
- All widgets and signal handlers are torn down on window close (review
  requirement / `ext_rev.md` #8).

**Calendar name mapping:** `EDataServer.SourceRegistry.new_sync()` →
`list_sources(SOURCE_EXTENSION_CALENDAR)` → `{ uid, display_name, enabled }`.
Precondition check (antislop #4): if the registry is unavailable, the Calendars
control degrades to "All calendars" and rules still function (shell side only ever
needs UIDs). Import of `EDataServer` is confined to `prefs.js`.

## 8. Storage (GSettings schema)

Schema id `org.gnome.shell.extensions.smart-dnd`. Keys:

| key | type | default | meaning |
|---|---|---|---|
| `master-enabled` | `b` | `true` | global automation on/off |
| `ignore-all-day` | `b` | `true` | skip all-day calendar events |
| `schedules` | `as` | `[]` | each element a JSON-encoded schedule object |
| `calendar-rules` | `as` | `[]` | each element a JSON-encoded rule object |

JSON-per-element keeps the schema flat and avoids nested-variant pain. `store.js`
owns (de)serialization and id generation. `schemas/gschemas.compiled` is **never
committed** (`ext_rev.md`); the build/install script compiles it locally.

## 9. Review-guideline compliance (baked in)

- No Gtk/Gdk/EDataServer imports in `extension.js` or any `lib/` file loaded by
  the shell.
- `connectObject()` / `disconnectObject()` for all signal wiring (`ext_rev.md` #6).
- Every `GLib` timeout id nulled when removed; no single property holds multiple
  timeout ids (`ext_rev.md` #7).
- DBus proxy, Quick Settings items, settings object all destroyed/nulled in
  `disable()`; nothing left in global scope after disable.
- `console.*` for logging, never `log()` (`ext_rev.md` #3).
- No try/catch around `disconnect`/`destroy`/`signal_unsubscribe` (`ext_rev.md`
  #5, #9; antislop #12).
- `super.destroy()` in custom widget destructors where applicable.
- `donations` field in `metadata.json`.
- **Shexli** static analyzer installed and run clean before completion (project
  rule #5).

## 10. Testing

`gjs` scripts under `test/`, exact-value assertions:
- `schedule.js`: midnight-crossing window, day-mask boundaries, overlapping
  schedules, disabled schedule ignored, next-transition timestamps.
- `calendar.js`: each match type, calendar-UID filter (empty vs specific),
  enable/disable offset math, all-day inference + skip.
- `coordinator.js`: rising/falling edges, ownership tracking, manual-override
  respected (no reassert), master-disabled short-circuit.

## Out of scope (v1)

- Per-event one-off overrides / snooze.
- Reasserting scheduled state against manual changes (deliberately not done).
- Non-title calendar matching (location, attendees, description).
- Instant timezone-change correction (corrected at next timer fire).
