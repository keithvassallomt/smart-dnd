export function titleMatches(rule, summary) {
    if (typeof summary !== 'string' || typeof rule.pattern !== 'string') return false;
    const hay = summary.toLowerCase();
    const needle = rule.pattern.toLowerCase();
    switch (rule.matchType) {
        case 'contains': return hay.includes(needle);
        case 'startsWith': return hay.startsWith(needle);
        case 'endsWith': return hay.endsWith(needle);
        case 'regex':
            try { return new RegExp(rule.pattern, 'i').test(summary); }
            catch (e) { console.warn(`smart-dnd: invalid regex "${rule.pattern}": ${e.message}`); return false; }
        default: return false;
    }
}

export function sourceAllowed(rule, sourceUid) {
    return rule.calendars.length === 0 || rule.calendars.includes(sourceUid);
}

export function eventWindow(rule, event) {
    return {
        on: (event.start + rule.enableOffsetMin * 60) * 1000,
        off: (event.end + rule.disableOffsetMin * 60) * 1000,
    };
}

function matchingWindows(rules, events, ignoreAllDay) {
    const windows = [];
    for (const rule of rules) {
        if (!rule.enabled) continue;
        for (const ev of events) {
            if (ignoreAllDay && ev.allDay) continue;
            if (!sourceAllowed(rule, ev.sourceUid)) continue;
            if (!titleMatches(rule, ev.summary)) continue;
            windows.push(eventWindow(rule, ev));
        }
    }
    return windows;
}

export function rulesActiveAt(rules, events, nowMs, ignoreAllDay) {
    return matchingWindows(rules, events, ignoreAllDay).some(w => nowMs >= w.on && nowMs < w.off);
}

export function calendarNextTransition(rules, events, nowMs, ignoreAllDay) {
    let best = null;
    for (const w of matchingWindows(rules, events, ignoreAllDay)) {
        for (const edge of [w.on, w.off]) {
            if (edge > nowMs && (best === null || edge < best)) best = edge;
        }
    }
    return best;
}

export function nextEnable(rules, events, nowMs, ignoreAllDay) {
    let best = null;
    for (const w of matchingWindows(rules, events, ignoreAllDay)) {
        if (w.on > nowMs && (best === null || w.on < best)) best = w.on;
    }
    return best;
}
