import {test, assertEq} from './harness.js';
import {parseList, serializeList, newId, SCHEDULE_DEFAULTS, RULE_DEFAULTS}
    from '../smart-dnd@keithvassallo.com/lib/store.js';

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
test('SCHEDULE_DEFAULTS has the expected shape', () => {
    assertEq(SCHEDULE_DEFAULTS,
        {name: 'Schedule', days: [1, 2, 3, 4, 5], start: '22:00', end: '07:00', enabled: true});
});
test('RULE_DEFAULTS has the expected shape', () => {
    assertEq(RULE_DEFAULTS, {
        name: 'Rule', matchType: 'contains', pattern: '', calendars: [],
        enableOffsetMin: 0, disableOffsetMin: 0, enabled: true,
    });
});
