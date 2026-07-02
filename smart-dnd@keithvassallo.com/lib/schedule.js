export function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

function prevDow(dow) { return (dow + 6) % 7; }

// Local wall-clock time on (today + dayOffset). The Date constructor interprets
// its fields as local time, so this stays correct across DST changes — a day
// with a clock change is not 24h, and fixed-ms arithmetic would drift an hour.
function localTs(now, dayOffset, minutes) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset,
        Math.floor(minutes / 60), minutes % 60).getTime();
}

function localDow(now, dayOffset) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset).getDay();
}

export function scheduleActiveAt(schedule, dow, minutes) {
    if (!schedule.enabled) return false;
    const start = toMinutes(schedule.start);
    const end = toMinutes(schedule.end);
    if (start === end) return false;
    const startsToday = schedule.days.includes(dow);
    if (start < end)
        return startsToday && minutes >= start && minutes < end;
    // wraps midnight: head today (>= start) or tail from yesterday's window (< end)
    const head = startsToday && minutes >= start;
    const tail = schedule.days.includes(prevDow(dow)) && minutes < end;
    return head || tail;
}

export function anyActiveAt(schedules, dow, minutes) {
    return schedules.some(s => scheduleActiveAt(s, dow, minutes));
}

export function nextTransition(schedules, nowMs) {
    const enabled = schedules.filter(s => s.enabled && toMinutes(s.start) !== toMinutes(s.end));
    if (enabled.length === 0) return null;

    // Generate every start/end boundary timestamp over the next 8 days, keep the
    // earliest strictly after now. A "start" fires on each listed day at start-time;
    // an "end" fires at end-time, on the next day when the window wraps midnight.
    const now = new Date(nowMs);
    let best = null;
    for (const s of enabled) {
        const start = toMinutes(s.start), end = toMinutes(s.end);
        const wraps = start > end;
        // Start at d = -1 so a window that began yesterday and wraps past midnight
        // still has its end (which falls today) counted; past starts/ends are
        // filtered out by the `> nowMs` checks below.
        for (let d = -1; d <= 8; d++) {
            if (s.days.includes(localDow(now, d))) {
                const startTs = localTs(now, d, start);
                if (startTs > nowMs && (best === null || startTs < best)) best = startTs;
                const endTs = localTs(now, d + (wraps ? 1 : 0), end);
                if (endTs > nowMs && (best === null || endTs < best)) best = endTs;
            }
        }
    }
    return best;
}

export function nextStart(schedules, nowMs) {
    const enabled = schedules.filter(s => s.enabled && toMinutes(s.start) !== toMinutes(s.end));
    if (enabled.length === 0) return null;
    const now = new Date(nowMs);
    let best = null;
    for (const s of enabled) {
        const start = toMinutes(s.start);
        for (let d = 0; d <= 7; d++) {
            if (s.days.includes(localDow(now, d))) {
                const ts = localTs(now, d, start);
                if (ts > nowMs && (best === null || ts < best)) best = ts;
            }
        }
    }
    return best;
}
