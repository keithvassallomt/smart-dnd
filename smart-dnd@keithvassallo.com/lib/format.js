const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function formatWhen(nowMs, tsMs) {
    const now = new Date(nowMs);
    const t = new Date(tsMs);
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    const time = `${hh}:${mm}`;
    const diffDays = Math.round((startOfDay(t) - startOfDay(now)) / DAY_MS);
    if (diffDays === 0) return time;
    if (diffDays >= 1 && diffDays <= 6) return `${DAYS[t.getDay()]} ${time}`;
    return `${t.getDate()} ${MONTHS[t.getMonth()]} ${time}`;
}
