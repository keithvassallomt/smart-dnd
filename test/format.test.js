import {test, assertEq} from './harness.js';
import {formatWhen} from '../smart-dnd@keithvassallo.com/lib/format.js';

const at = (y, mo, d, h, mi) => new Date(y, mo, d, h, mi, 0).getTime();

test('same day -> HH:MM', () => {
    assertEq(formatWhen(at(2026, 6, 2, 8, 0), at(2026, 6, 2, 22, 5)), '22:05');
});
test('within a week -> weekday HH:MM', () => {
    // 2026-07-02 is a Thursday; +4 days = Monday 2026-07-06
    assertEq(formatWhen(at(2026, 6, 2, 8, 0), at(2026, 6, 6, 7, 0)), 'Mon 07:00');
});
test('beyond a week -> day month HH:MM', () => {
    assertEq(formatWhen(at(2026, 6, 2, 8, 0), at(2026, 6, 20, 9, 30)), '20 Jul 09:30');
});
test('zero-pads hours and minutes', () => {
    assertEq(formatWhen(at(2026, 6, 2, 8, 0), at(2026, 6, 2, 9, 5)), '09:05');
});
