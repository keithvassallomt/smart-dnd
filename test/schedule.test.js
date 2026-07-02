import {test, assertEq} from './harness.js';
import {toMinutes, scheduleActiveAt, anyActiveAt, nextTransition} from '../smart-dnd@keithvassallo.com/lib/schedule.js';

const weeknights = {name: 'W', days: [1, 2, 3, 4, 5], start: '22:00', end: '07:00', enabled: true};
const daytime = {name: 'D', days: [3], start: '09:00', end: '17:00', enabled: true};

test('toMinutes parses HH:MM', () => assertEq(toMinutes('07:30'), 450));

test('same-day window active inside, inactive outside', () => {
    assertEq(scheduleActiveAt(daytime, 3, toMinutes('12:00')), true);   // Wed noon
    assertEq(scheduleActiveAt(daytime, 3, toMinutes('08:59')), false);
    assertEq(scheduleActiveAt(daytime, 4, toMinutes('12:00')), false);  // Thu, not in days
});

test('end boundary is exclusive', () => {
    assertEq(scheduleActiveAt(daytime, 3, toMinutes('17:00')), false);
    assertEq(scheduleActiveAt(daytime, 3, toMinutes('09:00')), true);
});

test('midnight-crossing: head on start day', () => {
    assertEq(scheduleActiveAt(weeknights, 1, toMinutes('23:00')), true);  // Mon 23:00
});
test('midnight-crossing: tail belongs to next day', () => {
    assertEq(scheduleActiveAt(weeknights, 2, toMinutes('06:00')), true);  // Tue 06:00 = Mon window tail
    assertEq(scheduleActiveAt(weeknights, 6, toMinutes('06:00')), true);  // Sat 06:00 = Fri window tail
    assertEq(scheduleActiveAt(weeknights, 0, toMinutes('06:00')), false); // Sun 06:00 = Sat has no window
    assertEq(scheduleActiveAt(weeknights, 1, toMinutes('06:00')), false); // Mon 06:00 = Sun has no window
});

test('disabled and zero-length never active', () => {
    assertEq(scheduleActiveAt({...daytime, enabled: false}, 3, toMinutes('12:00')), false);
    assertEq(scheduleActiveAt({...daytime, start: '09:00', end: '09:00'}, 3, toMinutes('09:00')), false);
});

test('anyActiveAt ORs schedules', () => {
    assertEq(anyActiveAt([daytime, weeknights], 1, toMinutes('23:00')), true);
    assertEq(anyActiveAt([daytime, weeknights], 0, toMinutes('12:00')), false);
});

test('nextTransition finds the next boundary', () => {
    // Wed 2026-01-07 08:00 local; daytime rule starts 09:00 same day.
    const now = new Date(2026, 0, 7, 8, 0, 0).getTime();
    const next = nextTransition([daytime], now);
    assertEq(next, new Date(2026, 0, 7, 9, 0, 0).getTime());
});
test('nextTransition returns null with no schedules', () => {
    assertEq(nextTransition([], Date.now()), null);
});
test('nextTransition is DST-correct across the spring-forward day', () => {
    // In DST zones a day with a clock change is not 24h; the boundary must land
    // at the real local wall-clock time, not an hour off.
    const s = {name: 'D', days: [0], start: '09:00', end: '10:00', enabled: true};
    const now = new Date(2026, 2, 28, 12, 0).getTime(); // Sat before the change
    assertEq(nextTransition([s], now), new Date(2026, 2, 29, 9, 0).getTime());
});
