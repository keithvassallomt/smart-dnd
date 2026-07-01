export function computeDesired({masterEnabled, scheduleActive, calendarActive}) {
    return masterEnabled && (scheduleActive || calendarActive);
}

export function reconcile({desired, lastDesired, owned, dndOn}) {
    if (desired && !lastDesired)
        return {owned: true, action: dndOn ? null : 'on'};
    if (!desired && lastDesired)
        return owned && dndOn ? {owned: false, action: 'off'} : {owned: false, action: null};
    return {owned, action: null};
}
