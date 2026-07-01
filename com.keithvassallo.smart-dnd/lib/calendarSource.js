import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const IFACE = `
<node>
  <interface name="org.gnome.Shell.CalendarServer">
    <method name="SetTimeRange">
      <arg type="x" direction="in"/>
      <arg type="x" direction="in"/>
      <arg type="b" direction="in"/>
    </method>
    <signal name="EventsAddedOrUpdated">
      <arg type="a(ssxxa{sv})"/>
    </signal>
    <signal name="EventsRemoved">
      <arg type="as"/>
    </signal>
  </interface>
</node>`;

const CalendarProxy = Gio.DBusProxy.makeProxyWrapper(IFACE);
const RANGE_SECONDS = 48 * 60 * 60;

function isAllDay(start, end) {
    if (end <= start) return false;
    if ((end - start) % 86400 !== 0) return false;
    const atMidnight = (ts) => {
        const d = GLib.DateTime.new_from_unix_local(ts);
        const r = d.get_hour() === 0 && d.get_minute() === 0 && d.get_second() === 0;
        return r;
    };
    return atMidnight(start) && atMidnight(end);
}

export class CalendarSource {
    constructor(onChanged) {
        this._onChanged = onChanged;
        this._proxy = null;
        this._events = new Map();
    }

    start() {
        this._proxy = new CalendarProxy(
            Gio.DBus.session,
            'org.gnome.Shell.CalendarServer',
            '/org/gnome/Shell/CalendarServer');
        this._proxy.connectSignal('EventsAddedOrUpdated', (_p, _s, [events]) => {
            for (const [id, summary, start, end] of events)
                this._events.set(id, {
                    summary,
                    start,
                    end,
                    sourceUid: id.split('\n')[0],
                    allDay: isAllDay(start, end),
                });
            this._onChanged();
        });
        this._proxy.connectSignal('EventsRemoved', (_p, _s, [ids]) => {
            for (const id of ids) this._events.delete(id);
            this._onChanged();
        });
        this.refreshRange();
    }

    refreshRange() {
        if (!this._proxy) return;
        const now = Math.floor(GLib.get_real_time() / 1e6);
        this._proxy.SetTimeRangeAsync(now, now + RANGE_SECONDS, false).catch(
            e => console.warn(`smart-dnd: SetTimeRange failed: ${e.message}`));
    }

    getEvents() {
        return [...this._events.values()];
    }

    stop() {
        this._proxy = null;
        this._events.clear();
    }
}
