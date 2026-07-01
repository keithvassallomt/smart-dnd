let _counter = 0;

export const SCHEDULE_DEFAULTS = {name: 'Schedule', days: [1, 2, 3, 4, 5], start: '22:00', end: '07:00', enabled: true};
export const RULE_DEFAULTS = {name: 'Rule', matchType: 'contains', pattern: '', calendars: [], enableOffsetMin: 0, disableOffsetMin: 0, enabled: true};

export function newId(prefix) {
    _counter += 1;
    return `${prefix}-${_counter}`;
}

export function parseList(stringArray) {
    const out = [];
    for (const s of stringArray) {
        let obj;
        try { obj = JSON.parse(s); }
        catch (e) { console.warn(`smart-dnd: dropping malformed settings entry: ${e.message}`); continue; }
        out.push(obj);
    }
    return out;
}

export function serializeList(objects) {
    return objects.map(o => JSON.stringify(o));
}
