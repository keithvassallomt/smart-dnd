import {test, assertEq} from './harness.js';
import {nextStart} from '../smart-dnd@keithvassallo.com/lib/schedule.js';
import {nextEnable} from '../smart-dnd@keithvassallo.com/lib/calendarMatch.js';

const at = (y, mo, d, h, mi) => new Date(y, mo, d, h, mi, 0).getTime();
const S = 1000;

test('nextStart finds today\'s upcoming start', () => {
    // Thu 2026-07-02 08:00; schedule starts 22:00 on Thursdays (dow 4)
    const sched = {name: 'W', days: [4], start: '22:00', end: '23:00', enabled: true};
    assertEq(nextStart([sched], at(2026, 6, 2, 8, 0)), at(2026, 6, 2, 22, 0));
});
test('nextStart rolls to next matching day when today passed', () => {
    const sched = {name: 'W', days: [4], start: '22:00', end: '23:00', enabled: true};
    // Thu 23:00 -> next Thursday
    assertEq(nextStart([sched], at(2026, 6, 2, 23, 0)), at(2026, 6, 9, 22, 0));
});
test('nextStart ignores disabled schedules and returns null when none', () => {
    const sched = {name: 'W', days: [4], start: '22:00', end: '23:00', enabled: false};
    assertEq(nextStart([sched], at(2026, 6, 2, 8, 0)), null);
    assertEq(nextStart([], at(2026, 6, 2, 8, 0)), null);
});
test('nextEnable returns earliest future on-edge', () => {
    const rule = {name: 'R', matchType: 'contains', pattern: 'Meet', calendars: [],
        enableOffsetMin: 0, disableOffsetMin: 0, enabled: true};
    const ev = {summary: 'Team Meeting', start: 5000, end: 6000, sourceUid: 'a', allDay: false};
    assertEq(nextEnable([rule], [ev], 1000 * S, true), 5000 * S);
    assertEq(nextEnable([rule], [ev], 5000 * S, true), null); // on-edge is now-or-past
});
test('nextEnable applies enable offset and skips non-matches', () => {
    const rule = {name: 'R', matchType: 'contains', pattern: 'Meet', calendars: [],
        enableOffsetMin: -10, disableOffsetMin: 0, enabled: true};
    const ev = {summary: 'Team Meeting', start: 5000, end: 6000, sourceUid: 'a', allDay: false};
    assertEq(nextEnable([rule], [ev], 1000 * S, true), (5000 - 600) * S);
    const noMatch = {summary: 'Lunch', start: 5000, end: 6000, sourceUid: 'a', allDay: false};
    assertEq(nextEnable([rule], [noMatch], 1000 * S, true), null);
});
test('nextStart is DST-correct across the spring-forward day', () => {
    // Europe/London springs forward on 2026-03-29; the Sunday 09:00 start must
    // resolve to real local 09:00, not shift by the DST hour.
    const s = {name: 'D', days: [0], start: '09:00', end: '10:00', enabled: true};
    const now = new Date(2026, 2, 28, 12, 0).getTime();
    assertEq(nextStart([s], now), new Date(2026, 2, 29, 9, 0).getTime());
});
