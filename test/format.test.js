import {test, assertEq} from './harness.js';
import {formatWhen, formatWhenShort} from '../smart-dnd@keithvassallo.com/lib/format.js';

const at = (y, mo, d, h, mi) => new Date(y, mo, d, h, mi, 0).getTime();

test('same day -> Today, HH:MM', () => {
    assertEq(formatWhen(at(2026, 6, 2, 8, 0), at(2026, 6, 2, 22, 5)), 'Today, 22:05');
});
test('next day -> Tomorrow, HH:MM', () => {
    assertEq(formatWhen(at(2026, 6, 2, 8, 0), at(2026, 6, 3, 9, 36)), 'Tomorrow, 09:36');
});
test('within a week -> full weekday, HH:MM', () => {
    // 2026-07-02 is a Thursday; +4 days = Monday 2026-07-06
    assertEq(formatWhen(at(2026, 6, 2, 8, 0), at(2026, 6, 6, 7, 0)), 'Monday, 07:00');
});
test('beyond a week -> weekday day month, HH:MM', () => {
    // 2026-07-20 is a Monday, 18 days out
    assertEq(formatWhen(at(2026, 6, 2, 8, 0), at(2026, 6, 20, 9, 30)), 'Monday 20 Jul, 09:30');
});
test('zero-pads hours and minutes', () => {
    assertEq(formatWhen(at(2026, 6, 2, 8, 0), at(2026, 6, 2, 9, 5)), 'Today, 09:05');
});
test('formatWhenShort: today -> just the time', () => {
    assertEq(formatWhenShort(at(2026, 6, 2, 8, 0), at(2026, 6, 2, 22, 5)), '22:05');
});
test('formatWhenShort: within a week -> Ddd @ HH:MM', () => {
    // 2026-07-06 is a Monday
    assertEq(formatWhenShort(at(2026, 6, 2, 8, 0), at(2026, 6, 6, 9, 30)), 'Mon @ 09:30');
});
test('formatWhenShort: beyond a week -> D Mmm @ HH:MM', () => {
    assertEq(formatWhenShort(at(2026, 6, 2, 8, 0), at(2026, 6, 20, 9, 30)), '20 Jul @ 09:30');
});
