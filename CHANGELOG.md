# Changelog

All notable changes to Smart DND are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> The `version-name` in `metadata.json` is only for extensions.gnome.org; this
> changelog is the source of truth for the project's semantic version.

## [Unreleased]

## [0.1.0] - 2026-07-02

### Added

- **Scheduled Do Not Disturb** — turn DND on between two times on the days of the
  week you choose, including windows that cross midnight.
- **Calendar-based DND** — turn DND on during calendar events whose title matches
  a pattern (contains, starts with, ends with, or a regular expression),
  optionally limited to specific calendars. Events come from the calendars GNOME
  already knows about, with no extra account setup.
- **Configurable offsets** — start and end DND *at*, *before*, or *after* an event
  (1, 5, 10, 15 minutes, or a custom value).
- **Quick Settings tile** — toggle automation on/off and see the next scheduled
  activation at a glance (e.g. "Mon @ 09:30"). The tile can be hidden
  from preferences.
- **Preferences window** — an app-style window with Schedule and Calendar views
  and a primary menu holding General settings and About.
- **Next-activation times** shown in the schedule and calendar lists and in the
  Quick Settings tile.
- **Empty-state guidance** prompting you to create your first schedule or calendar
  rule when a list is empty.
- **General settings** — a master automation switch, a show/hide toggle for the
  Quick Settings tile, and an option to ignore all-day events.
- 7-day look-ahead for calendar events and DST-correct schedule calculations.
- Behaviour that respects the user: Smart DND only acts at schedule/event
  boundaries (never fighting a manual DND change) and releases any DND it enabled
  when the extension is disabled.

[Unreleased]: https://github.com/keithvassallomt/smart-dnd/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/keithvassallomt/smart-dnd/releases/tag/v0.1.0
