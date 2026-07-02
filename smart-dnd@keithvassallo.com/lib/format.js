const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function hhmm(t) {
    return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

export function formatWhen(nowMs, tsMs) {
    const now = new Date(nowMs);
    const t = new Date(tsMs);
    const time = hhmm(t);
    const diffDays = Math.round((startOfDay(t) - startOfDay(now)) / DAY_MS);
    if (diffDays === 0) return `Today, ${time}`;
    if (diffDays === 1) return `Tomorrow, ${time}`;
    if (diffDays >= 2 && diffDays <= 6) return `${DAYS[t.getDay()]}, ${time}`;
    return `${DAYS[t.getDay()]} ${t.getDate()} ${MONTHS[t.getMonth()]}, ${time}`;
}

// Compact variant for the narrow Quick Settings tile, e.g. "Mon @ 09:30"
// (today shows just the time; further out falls back to a dated form).
export function formatWhenShort(nowMs, tsMs) {
    const now = new Date(nowMs);
    const t = new Date(tsMs);
    const time = hhmm(t);
    const diffDays = Math.round((startOfDay(t) - startOfDay(now)) / DAY_MS);
    if (diffDays === 0) return time;
    if (diffDays >= 1 && diffDays <= 6) return `${DAYS_SHORT[t.getDay()]} @ ${time}`;
    return `${t.getDate()} ${MONTHS[t.getMonth()]} @ ${time}`;
}
