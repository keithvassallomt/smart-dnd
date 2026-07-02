const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

export function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

function prevDow(dow) { return (dow + 6) % 7; }

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
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let best = null;
    for (const s of enabled) {
        const start = toMinutes(s.start), end = toMinutes(s.end);
        const wraps = start > end;
        for (let d = 0; d <= 8; d++) {
            const dayStart = midnight + d * DAY_MS;
            const dow = new Date(dayStart).getDay();
            if (s.days.includes(dow)) {
                const startTs = dayStart + start * MIN_MS;
                if (startTs > nowMs && (best === null || startTs < best)) best = startTs;
                const endTs = dayStart + (wraps ? DAY_MS : 0) + end * MIN_MS;
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
