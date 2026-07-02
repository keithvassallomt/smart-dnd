# Smart DND

<p align="center">
  <img src="assets/smart-dnd.svg" width="120" alt="Smart DND logo">
</p>

Automatically enable **Do Not Disturb** on a schedule or during matching calendar
events — so notifications go quiet during your sleep hours, focus blocks, and
meetings, and come back on their own afterwards.

GNOME ships a manual Do Not Disturb toggle but no way to automate it. Smart DND
adds that automation, driven entirely from a Quick Settings tile and a clean
preferences window.

- **Supported GNOME versions:** 49, 50
- **UUID:** `smart-dnd@keithvassallo.com`
- **License:** GPL-3.0-or-later

> [!NOTE]
> <img width="200" height="auto" alt="friendly-manifesto-badge" src="https://github.com/user-attachments/assets/cb91210b-0f66-46fe-93a8-a3a67857593c" /> <br>
> This project voluntarily adheres to The Friendly Manifesto. Read more [here](https://friendlymanifesto.org)

---

## Features

- **Time schedules** — turn DND on between two times on the days you choose
  (e.g. *10:00 PM – 7:00 AM, Mon–Fri*). Windows that cross midnight are handled
  correctly.
- **Calendar rules** — turn DND on during calendar events whose title matches a
  pattern (*contains / starts with / ends with / regular expression*), optionally
  limited to specific calendars.
- **Flexible offsets** — start DND *at*, *before*, or *after* an event begins,
  and end it *at*, *before*, or *after* it finishes (1/5/10/15 minutes or a
  custom value).
- **Quick Settings tile** — flip automation on/off and see the next scheduled
  activation at a glance (*"Next: Tomorrow, 09:36"*). The tile can be hidden if
  you prefer to set-and-forget.
- **Respects you** — Smart DND only acts at schedule/event boundaries, so it
  never fights a manual DND change, and it releases DND it turned on when the
  extension is disabled.
- **Uses your real calendars** — reads the same calendars GNOME already knows
  about (via GNOME Online Accounts / Evolution Data Server), with no extra
  account setup.

## Screenshots

![Quick Settings tile](https://github.com/user-attachments/assets/d486489d-b495-4978-bc99-561cbfd3f3d2)

![Schedules](https://github.com/user-attachments/assets/734f3fb2-2032-4d0f-98f2-cb717d8b790e)

![Calendar rules](https://github.com/user-attachments/assets/9082d7c4-b17b-4c29-bc41-a7314979b660)
<!-- <img width="1620" height="1380" alt="calendar_rule" src="https://github.com/user-attachments/assets/9082d7c4-b17b-4c29-bc41-a7314979b660" /> -->

## Installation

### From extensions.gnome.org

<a href="https://extensions.gnome.org/extension/10322/smart-dnd/"><img width="228" alt="Get it on GNOME Extensions" src="https://github.com/user-attachments/assets/a9aa1a44-8d52-465b-980b-6f8e6c811fee" /></a>

Install from [extensions.gnome.org](https://extensions.gnome.org/extension/10322/smart-dnd/) — it handles updates automatically.

### From source

```bash
git clone https://github.com/keithvassallomt/smart-dnd.git
cd smart-dnd
./install.sh
```

Then log out and back in (required on Wayland to load a new extension) and enable
it:

```bash
gnome-extensions enable smart-dnd@keithvassallo.com
```

Open its settings with:

```bash
gnome-extensions prefs smart-dnd@keithvassallo.com
```

## Usage

Everything is configured from the preferences window (the **Settings** entry on
the Quick Settings tile, or the command above):

- **Schedule** — click **+** to add a schedule, then set its name, start/end
  time, and the days it runs. Each row shows when it will next turn DND on.
- **Calendar** — click **+** to add a rule, choose how event titles are matched
  and the pattern to match, optionally pick which calendars to watch, and set the
  turn-on / turn-off offsets.
- **General** (in the ☰ menu) — enable or disable all automation, show or hide
  the Quick Settings tile, and choose whether all-day events are ignored.

DND is on whenever *any* enabled schedule window or matching calendar event is
active.

## How it works

Smart DND toggles the standard GNOME setting
`org.gnome.desktop.notifications show-banners` — the exact same switch as the
built-in Do Not Disturb button — so it integrates cleanly with the rest of the
desktop. Calendar events are read from the shell's own `CalendarServer`, the same
source that powers the top-bar calendar, so any calendar visible there can drive
a rule.

## Development

The core logic (schedule evaluation, calendar matching, the state machine,
time formatting) lives in dependency-free modules under
`smart-dnd@keithvassallo.com/lib/` and is unit-tested with plain GJS:

```bash
gjs -m test/run.js
```

Static analysis is run with [Shexli](https://pypi.org/project/shexli/):

```bash
python3 -m venv venv && . venv/bin/activate
pip install -U shexli
shexli "$(pwd)/smart-dnd@keithvassallo.com"
```

## Contributing

Issues and pull requests are welcome at
<https://github.com/keithvassallomt/smart-dnd>.

## Donations

If Smart DND is useful to you, you can support development on
[GitHub Sponsors](https://github.com/sponsors/keithvassallomt).

## License

Released under the [GNU General Public License v3.0 or later](LICENSE).
