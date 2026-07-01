import {test, assertEq} from './harness.js';

test('assertEq deep-compares arrays', () => assertEq([1, 2], [1, 2]));
test('assertEq deep-compares objects', () => assertEq({a: 1, b: [2]}, {a: 1, b: [2]}));
