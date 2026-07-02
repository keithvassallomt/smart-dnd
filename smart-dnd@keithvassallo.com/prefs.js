import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import EDataServer from 'gi://EDataServer';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {parseList, serializeList, newId, SCHEDULE_DEFAULTS, RULE_DEFAULTS}
    from './lib/store.js';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MATCH_TYPES = [
    ['contains', 'Contains'], ['startsWith', 'Starts with'],
    ['endsWith', 'Ends with'], ['regex', 'Matches regex'],
];

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

export default class SmartDndPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings;

        this._fillGeneral(window, settings);
        this._fillSchedules(window, settings);
        this._fillCalendar(window, settings);
    }

    _fillGeneral(window, settings) {
        const page = new Adw.PreferencesPage({title: 'General', icon_name: 'preferences-system-symbolic'});
        const group = new Adw.PreferencesGroup();

        const master = new Adw.SwitchRow({title: 'Enable automation'});
        settings.bind('master-enabled', master, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(master);

        const allDay = new Adw.SwitchRow({
            title: 'Ignore all-day events',
            subtitle: 'Do not enable DND for all-day calendar events',
        });
        settings.bind('ignore-all-day', allDay, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(allDay);

        page.add(group);
        window.add(page);
    }

    _fillSchedules(window, settings) {
        const page = new Adw.PreferencesPage({title: 'Schedules', icon_name: 'alarm-symbolic'});
        const group = new Adw.PreferencesGroup({title: 'Schedules'});
        page.add(group);
        window.add(page);

        let rows = [];
        const rebuild = () => {
            for (const row of rows) group.remove(row);
            const schedules = parseList(settings.get_strv('schedules'));
            const save = () => settings.set_strv('schedules', serializeList(schedules));
            rows = schedules.map((sched, i) =>
                this._scheduleRow(sched, () => { schedules.splice(i, 1); save(); rebuild(); }, save));
            const addRow = this._addButtonRow('Add schedule', () => {
                schedules.push({id: newId('sched'), ...SCHEDULE_DEFAULTS});
                save(); rebuild();
            });
            rows.push(addRow);
            for (const row of rows) group.add(row);
        };
        rebuild();
    }

    _scheduleRow(sched, onRemove, save) {
        const row = new Adw.ExpanderRow({title: sched.name || 'Schedule',
            subtitle: `${sched.start} – ${sched.end}`});

        const name = new Adw.EntryRow({title: 'Name', text: sched.name});
        name.connect('changed', () => { sched.name = name.text; row.title = name.text || 'Schedule'; save(); });
        row.add_row(name);

        const start = this._timeRow('Start', sched.start, v => { sched.start = v; row.subtitle = `${sched.start} – ${sched.end}`; save(); });
        const end = this._timeRow('End', sched.end, v => { sched.end = v; row.subtitle = `${sched.start} – ${sched.end}`; save(); });
        row.add_row(start);
        row.add_row(end);

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

        row.add_row(this._removeButtonRow(onRemove));
        return row;
    }

    _fillCalendar(window, settings) {
        const page = new Adw.PreferencesPage({title: 'Calendar', icon_name: 'x-office-calendar-symbolic'});
        const group = new Adw.PreferencesGroup({title: 'Calendar rules',
            description: 'Turn on DND during matching events in your calendars'});
        page.add(group);
        window.add(page);

        const calendars = listCalendars();
        let rows = [];
        const rebuild = () => {
            for (const row of rows) group.remove(row);
            const rules = parseList(settings.get_strv('calendar-rules'));
            const save = () => settings.set_strv('calendar-rules', serializeList(rules));
            rows = rules.map((rule, i) =>
                this._ruleRow(rule, calendars, () => { rules.splice(i, 1); save(); rebuild(); }, save));
            const addRow = this._addButtonRow('Add rule', () => {
                rules.push({id: newId('rule'), ...RULE_DEFAULTS});
                save(); rebuild();
            });
            rows.push(addRow);
            for (const row of rows) group.add(row);
        };
        rebuild();
    }

    _ruleRow(rule, calendars, onRemove, save) {
        const row = new Adw.ExpanderRow({title: rule.name || 'Rule', subtitle: rule.pattern});

        const name = new Adw.EntryRow({title: 'Name', text: rule.name});
        name.connect('changed', () => { rule.name = name.text; row.title = name.text || 'Rule'; save(); });
        row.add_row(name);

        const match = new Adw.ComboRow({title: 'Match',
            model: Gtk.StringList.new(MATCH_TYPES.map(m => m[1]))});
        match.selected = Math.max(0, MATCH_TYPES.findIndex(m => m[0] === rule.matchType));
        match.connect('notify::selected', () => { rule.matchType = MATCH_TYPES[match.selected][0]; save(); });
        row.add_row(match);

        const pattern = new Adw.EntryRow({title: 'Pattern', text: rule.pattern});
        pattern.connect('changed', () => { rule.pattern = pattern.text; row.subtitle = pattern.text; save(); });
        row.add_row(pattern);

        if (calendars.length > 0)
            row.add_row(this._calendarPicker(rule, calendars, save));

        row.add_row(this._offsetRow('Turn on', rule, 'enableOffsetMin', save));
        row.add_row(this._offsetRow('Turn off', rule, 'disableOffsetMin', save));

        const enabled = new Adw.SwitchRow({title: 'Enabled', active: rule.enabled});
        enabled.connect('notify::active', () => { rule.enabled = enabled.active; save(); });
        row.add_row(enabled);

        row.add_row(this._removeButtonRow(onRemove));
        return row;
    }

    _calendarPicker(rule, calendars, save) {
        const row = new Adw.ExpanderRow({title: 'Calendars',
            subtitle: rule.calendars.length === 0 ? 'All calendars' : `${rule.calendars.length} selected`});
        for (const cal of calendars) {
            const sw = new Adw.SwitchRow({title: cal.name, active: rule.calendars.includes(cal.uid)});
            sw.connect('notify::active', () => {
                const set = new Set(rule.calendars);
                sw.active ? set.add(cal.uid) : set.delete(cal.uid);
                rule.calendars = [...set];
                row.subtitle = rule.calendars.length === 0 ? 'All calendars' : `${rule.calendars.length} selected`;
                save();
            });
            row.add_row(sw);
        }
        return row;
    }

    _offsetRow(title, rule, key, save) {
        const row = new Adw.SpinRow({title: `${title} (minutes offset)`,
            adjustment: new Gtk.Adjustment({lower: -120, upper: 120, step_increment: 5, value: rule[key]})});
        row.connect('notify::value', () => { rule[key] = row.value; save(); });
        return row;
    }

    _timeRow(title, value, onChange) {
        const row = new Adw.EntryRow({title: `${title} (HH:MM)`, text: value});
        row.connect('changed', () => {
            if (/^([01]\d|2[0-3]):[0-5]\d$/.test(row.text)) onChange(row.text);
        });
        return row;
    }

    _addButtonRow(label, onClick) {
        const row = new Adw.ActionRow();
        const btn = new Gtk.Button({label, halign: Gtk.Align.CENTER, hexpand: true,
            css_classes: ['suggested-action']});
        btn.connect('clicked', onClick);
        row.set_child(btn);
        return row;
    }

    _removeButtonRow(onRemove) {
        const row = new Adw.ActionRow();
        const btn = new Gtk.Button({label: 'Remove', css_classes: ['destructive-action']});
        btn.connect('clicked', onRemove);
        row.add_suffix(btn);
        return row;
    }
}
