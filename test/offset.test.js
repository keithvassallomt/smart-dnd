import {test, assertEq} from './harness.js';
import {offsetToUi, uiToOffset, MAG_MINUTES} from '../smart-dnd@keithvassallo.com/lib/offset.js';

test('MAG_MINUTES is the fixed set', () => assertEq(MAG_MINUTES, [1, 5, 10, 15]));
test('zero -> at event', () => assertEq(offsetToUi(0), {direction: 0, magIndex: 0, custom: 0}));
test('negative fixed -> before + magIndex', () => assertEq(offsetToUi(-10), {direction: 1, magIndex: 2, custom: 0}));
test('positive fixed -> after + magIndex', () => assertEq(offsetToUi(5), {direction: 2, magIndex: 1, custom: 0}));
test('non-fixed -> Custom index with value', () => assertEq(offsetToUi(-7), {direction: 1, magIndex: 4, custom: 7}));
test('uiToOffset at ignores magnitude', () => assertEq(uiToOffset(0, 3, 99), 0));
test('uiToOffset before fixed', () => assertEq(uiToOffset(1, 2, 0), -10));
test('uiToOffset after custom', () => assertEq(uiToOffset(2, 4, 7), 7));
test('round-trips', () => {
    for (const m of [0, -1, -5, -10, -15, -7, 5, 12]) {
        const ui = offsetToUi(m);
        assertEq(uiToOffset(ui.direction, ui.magIndex, ui.custom), m);
    }
});
