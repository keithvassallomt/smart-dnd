import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import EDataServer from 'gi://EDataServer';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {parseList, serializeList, newId, SCHEDULE_DEFAULTS, RULE_DEFAULTS}
    from './lib/store.js';
import {offsetToUi, uiToOffset, MAG_MINUTES} from './lib/offset.js';
import {nextStart} from './lib/schedule.js';
import {nextEnable} from './lib/calendarMatch.js';
import {formatWhen} from './lib/format.js';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MATCH_TYPES = [
    ['contains', 'Contains'], ['startsWith', 'Starts with'],
    ['endsWith', 'Ends with'], ['regex', 'Matches regex'],
];
const MAG_LABELS = ['1 minute', '5 minutes', '10 minutes', '15 minutes', 'Custom'];
const ENABLE_DIR = ['At event start', 'Before event', 'After event'];
const DISABLE_DIR = ['At event end', 'Before event end', 'After event end'];

function escapeMarkup(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

function emptyState(iconName, title, description) {
    const status = new Adw.StatusPage({icon_name: iconName, title, description});
    status.add_css_class('compact');
    return status;
}

export default class SmartDndPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings;
        window.set_default_size(760, 640);

        const iconsPath = `${this.path}/icons`;
        const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
        if (!iconTheme.get_search_path().includes(iconsPath))
            iconTheme.add_search_path(iconsPath);

        // The host (ExtensionPrefsDialog) rejects a window whose `visible_page`
        // is null after fillPreferencesWindow. Add a sentinel page to satisfy
        // that guard, then replace the whole content with our own chrome — the
        // getter keeps returning the sentinel, so the guard passes. Both add()
        // and set_content() are public Adw.Window API.
        window.add(new Adw.PreferencesPage());

        const stack = new Adw.ViewStack();
        this._buildSchedulePage(stack, settings);
        this._buildCalendarPage(window, stack, settings);

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
            application_icon: 'smart-dnd',
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
            rows = schedules.length === 0
                ? [emptyState('alarm-symbolic', 'No schedules',
                    'Click the + button above to create your first schedule')]
                : schedules.map((sched, i) =>
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
        const row = new Adw.ExpanderRow({title: escapeMarkup(sched.name || 'Schedule')});
        const trash = iconButton('user-trash-symbolic', 'Remove', ['flat']);
        trash.connect('clicked', onRemove);
        row.add_suffix(trash);

        const setSub = () => {
            const now = GLib.get_real_time() / 1000;
            const next = nextStart([sched], now);
            const when = next ? formatWhen(now, next) : '—';
            row.subtitle = `${sched.start} – ${sched.end} · Next: ${when}`;
        };
        setSub();
        const save2 = () => { save(); setSub(); };

        const name = new Adw.EntryRow({title: 'Name', text: sched.name});
        name.connect('changed', () => {
            sched.name = name.text; row.title = escapeMarkup(name.text || 'Schedule'); save();
        });
        row.add_row(name);
        row.add_row(this._timeRow('Start', sched.start, v => { sched.start = v; save2(); }));
        row.add_row(this._timeRow('End', sched.end, v => { sched.end = v; save2(); }));

        const days = new Adw.ActionRow({title: 'Days'});
        const box = new Gtk.Box({spacing: 4, valign: Gtk.Align.CENTER});
        DAY_LABELS.forEach((label, dow) => {
            const btn = new Gtk.ToggleButton({label, active: sched.days.includes(dow)});
            btn.connect('toggled', () => {
                const set = new Set(sched.days);
                btn.active ? set.add(dow) : set.delete(dow);
                sched.days = [...set].sort((a, b) => a - b);
                save2();
            });
            box.append(btn);
        });
        days.add_suffix(box);
        row.add_row(days);

        const enabled = new Adw.SwitchRow({title: 'Enabled', active: sched.enabled});
        enabled.connect('notify::active', () => { sched.enabled = enabled.active; save2(); });
        row.add_row(enabled);
        return row;
    }

    _buildCalendarPage(window, stack, settings) {
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
        let updaters = [];
        let latestEvents = [];
        const getEvents = () => latestEvents;
        const refresh = () => { for (const u of updaters) u(latestEvents); };
        const rebuild = () => {
            for (const r of rows) group.remove(r);
            const rules = parseList(settings.get_strv('calendar-rules'));
            const save = () => settings.set_strv('calendar-rules', serializeList(rules));
            updaters = [];
            rows = rules.length === 0
                ? [emptyState('x-office-calendar-symbolic', 'No calendar rules',
                    'Click the + button above to create your first calendar rule')]
                : rules.map((rule, i) => {
                    const built = this._ruleRow(rule, calendars, settings, getEvents,
                        () => { rules.splice(i, 1); save(); rebuild(); }, save);
                    updaters.push(built.updateNext);
                    return built.row;
                });
            for (const r of rows) group.add(r);
            refresh();
        };
        addBtn.connect('clicked', () => {
            const rules = parseList(settings.get_strv('calendar-rules'));
            rules.push({id: newId('rule'), ...RULE_DEFAULTS});
            settings.set_strv('calendar-rules', serializeList(rules));
            rebuild();
        });
        rebuild();

        let alive = true;
        const {proxy, signalId} = this._queryUpcomingEvents(events => {
            if (!alive) return;
            latestEvents = events;
            refresh();
        });
        window.connect('close-request', () => {
            alive = false;
            proxy.disconnectSignal(signalId);
            return false;
        });
    }

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
        const signalId = proxy.connectSignal('EventsAddedOrUpdated', (_p, _s, [events]) => {
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
        return {proxy, signalId};
    }

    _ruleRow(rule, calendars, settings, getEvents, onRemove, save) {
        const row = new Adw.ExpanderRow({title: escapeMarkup(rule.name || 'Rule')});
        const updateNext = (events) => {
            const now = GLib.get_real_time() / 1000;
            const next = nextEnable([rule], events, now, settings.get_boolean('ignore-all-day'));
            const when = next ? formatWhen(now, next) : '—';
            const base = rule.pattern || '(no pattern)';
            row.subtitle = escapeMarkup(`${base} · Next: ${when}`);
        };
        updateNext(getEvents());
        const save2 = () => { save(); updateNext(getEvents()); };

        const trash = iconButton('user-trash-symbolic', 'Remove', ['flat']);
        trash.connect('clicked', onRemove);
        row.add_suffix(trash);

        const name = new Adw.EntryRow({title: 'Name', text: rule.name});
        name.connect('changed', () => {
            rule.name = name.text; row.title = escapeMarkup(name.text || 'Rule'); save();
        });
        row.add_row(name);

        const match = new Adw.ComboRow({
            title: 'Match', model: Gtk.StringList.new(MATCH_TYPES.map(m => m[1])),
        });
        match.selected = Math.max(0, MATCH_TYPES.findIndex(m => m[0] === rule.matchType));
        match.connect('notify::selected', () => {
            rule.matchType = MATCH_TYPES[match.selected][0]; save2();
        });
        row.add_row(match);

        const pattern = new Adw.EntryRow({title: 'Pattern', text: rule.pattern});
        pattern.connect('changed', () => {
            rule.pattern = pattern.text; save2();
        });
        row.add_row(pattern);

        if (calendars.length > 0)
            row.add_row(this._calendarPicker(rule, calendars, save2));

        row.add_row(this._offsetRow('Enable DND', ENABLE_DIR, rule, 'enableOffsetMin', save2));
        row.add_row(this._offsetRow('Disable DND', DISABLE_DIR, rule, 'disableOffsetMin', save2));

        const enabled = new Adw.SwitchRow({title: 'Enabled', active: rule.enabled});
        enabled.connect('notify::active', () => { rule.enabled = enabled.active; save2(); });
        row.add_row(enabled);
        return {row, updateNext};
    }

    _calendarPicker(rule, calendars, save) {
        const summary = () =>
            rule.calendars.length === 0 ? 'All calendars' : `${rule.calendars.length} selected`;
        const row = new Adw.ExpanderRow({title: 'Calendars', subtitle: summary()});
        const setSub = () => { row.subtitle = summary(); };
        for (const cal of calendars) {
            const sw = new Adw.SwitchRow({title: escapeMarkup(cal.name), active: rule.calendars.includes(cal.uid)});
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
