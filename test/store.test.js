import {test, assertEq} from './harness.js';
import {parseList, serializeList, newId} from '../com.keithvassallo.smart-dnd/lib/store.js';

test('serializeList then parseList round-trips', () => {
    const items = [{id: 'a', name: 'X'}, {id: 'b', name: 'Y'}];
    assertEq(parseList(serializeList(items)), items);
});
test('parseList skips malformed JSON', () => {
    assertEq(parseList(['{"id":"a"}', 'not json', '{"id":"b"}']), [{id: 'a'}, {id: 'b'}]);
});
test('newId is unique and prefixed', () => {
    const a = newId('sched'), b = newId('sched');
    assertEq(a.startsWith('sched-'), true);
    assertEq(a === b, false);
});
