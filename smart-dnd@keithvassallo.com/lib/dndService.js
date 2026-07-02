import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {parseList} from './store.js';
import {anyActiveAt, nextTransition, nextStart} from './schedule.js';
import {rulesActiveAt, calendarNextTransition, nextEnable} from './calendarMatch.js';
import {computeDesired, reconcile} from './coordinator.js';
import {CalendarSource} from './calendarSource.js';

const NOTIFY_SCHEMA = 'org.gnome.desktop.notifications';
const SHOW_BANNERS = 'show-banners';

export class DndService {
    constructor(settings) {
        this._settings = settings;
        this._notify = new Gio.Settings({schema_id: NOTIFY_SCHEMA});
        this._calendar = new CalendarSource(() => this._evaluate());
        this._owned = false;
        this._lastDesired = false;
        this._timerId = null;
        this._sleepSubId = 0;
        this._statusHandlers = [];
        this._status = {active: false, reason: 'idle', nextOnMs: null, nextOffMs: null};
    }

    connect(_signal, cb) {
        this._statusHandlers.push(cb);
        return () => { this._statusHandlers = this._statusHandlers.filter(h => h !== cb); };
    }
    getStatus() { return this._status; }

    start() {
        this._calendar.start();
        this._settings.connectObject(
            'changed::master-enabled', () => this._evaluate(),
            'changed::ignore-all-day', () => this._evaluate(),
            'changed::schedules', () => this._evaluate(),
            'changed::calendar-rules', () => this._evaluate(),
            this);
        this._sleepSubId = Gio.DBus.system.signal_subscribe(
            'org.freedesktop.login1', 'org.freedesktop.login1.Manager',
            'PrepareForSleep', '/org/freedesktop/login1', null,
            Gio.DBusSignalFlags.NONE,
            (_c, _s, _p, _i, _sig, params) => {
                const [aboutToSleep] = params.deepUnpack();
                if (!aboutToSleep) { this._calendar.refreshRange(); this._evaluate(); }
            });
        this._evaluate();
    }

    stop() {
        this._clearTimer();
        if (this._owned && this._dndOn())
            this._setDnd(false);
        this._owned = false;
        this._settings.disconnectObject(this);
        if (this._sleepSubId) {
            Gio.DBus.system.signal_unsubscribe(this._sleepSubId);
            this._sleepSubId = 0;
        }
        this._calendar.stop();
        this._notify = null;
        this._statusHandlers = [];
    }

    _clearTimer() {
        if (this._timerId) {
            GLib.Source.remove(this._timerId);
            this._timerId = null;
        }
    }

    _dndOn() { return !this._notify.get_boolean(SHOW_BANNERS); }
    _setDnd(on) { this._notify.set_boolean(SHOW_BANNERS, !on); }

    _evaluate() {
        const nowMs = GLib.get_real_time() / 1000;
        const now = new Date(nowMs);
        const dow = now.getDay();
        const minutes = now.getHours() * 60 + now.getMinutes();

        const masterEnabled = this._settings.get_boolean('master-enabled');
        const ignoreAllDay = this._settings.get_boolean('ignore-all-day');
        const schedules = parseList(this._settings.get_strv('schedules'));
        const rules = parseList(this._settings.get_strv('calendar-rules'));
        const events = this._calendar.getEvents();

        const scheduleActive = anyActiveAt(schedules, dow, minutes);
        const calendarActive = rulesActiveAt(rules, events, nowMs, ignoreAllDay);
        const desired = computeDesired({masterEnabled, scheduleActive, calendarActive});

        const {owned, action} = reconcile({
            desired, lastDesired: this._lastDesired, owned: this._owned, dndOn: this._dndOn(),
        });
        this._owned = owned;
        this._lastDesired = desired;
        if (action === 'on') this._setDnd(true);
        else if (action === 'off') this._setDnd(false);

        this._armTimer(schedules, rules, events, nowMs, ignoreAllDay);
        this._updateStatus(desired, scheduleActive, calendarActive, {
            masterEnabled, schedules, rules, events, ignoreAllDay, nowMs,
        });
    }

    _armTimer(schedules, rules, events, nowMs, ignoreAllDay) {
        this._clearTimer();
        const candidates = [
            nextTransition(schedules, nowMs),
            calendarNextTransition(rules, events, nowMs, ignoreAllDay),
        ].filter(t => t !== null);
        if (candidates.length === 0) return;
        const next = Math.min(...candidates);
        const seconds = Math.max(1, Math.ceil((next - nowMs) / 1000));
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            this._timerId = null;
            this._evaluate();
            return GLib.SOURCE_REMOVE;
        });
    }

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
}
