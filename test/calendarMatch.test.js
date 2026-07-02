import {test, assertEq} from './harness.js';
import {titleMatches, sourceAllowed, rulesActiveAt, calendarNextTransition}
    from '../smart-dnd@keithvassallo.com/lib/calendarMatch.js';

const r = (o) => ({name: 'R', matchType: 'contains', pattern: 'Meeting', calendars: [],
    enableOffsetMin: 0, disableOffsetMin: 0, enabled: true, ...o});
const S = 1000; // seconds→ms helper base

test('titleMatches contains (case-insensitive)', () => {
    assertEq(titleMatches(r(), 'Team meeting'), true);
    assertEq(titleMatches(r(), 'Lunch'), false);
});
test('titleMatches startsWith / endsWith', () => {
    assertEq(titleMatches(r({matchType: 'startsWith', pattern: 'Stand'}), 'Standup'), true);
    assertEq(titleMatches(r({matchType: 'endsWith', pattern: 'up'}), 'Standup'), true);
    assertEq(titleMatches(r({matchType: 'startsWith', pattern: 'up'}), 'Standup'), false);
});
test('titleMatches regex, invalid pattern is false not throw', () => {
    assertEq(titleMatches(r({matchType: 'regex', pattern: '^Sync\\d+$'}), 'Sync12'), true);
    assertEq(titleMatches(r({matchType: 'regex', pattern: '('}), 'anything'), false);
});
test('titleMatches returns false for non-string summary or pattern (no throw)', () => {
    assertEq(titleMatches(r(), undefined), false);
    assertEq(titleMatches(r(), null), false);
    assertEq(titleMatches(r({pattern: undefined}), 'Team meeting'), false);
});
test('sourceAllowed honours calendars filter', () => {
    assertEq(sourceAllowed(r(), 'uid-x'), true);
    assertEq(sourceAllowed(r({calendars: ['uid-a']}), 'uid-a'), true);
    assertEq(sourceAllowed(r({calendars: ['uid-a']}), 'uid-b'), false);
});

const ev = {summary: 'Team Meeting', start: 1000, end: 4600, sourceUid: 'uid-a', allDay: false};

test('rulesActiveAt inside window', () => {
    assertEq(rulesActiveAt([r()], [ev], 2000 * S, true), true);   // between 1000s and 4600s
    assertEq(rulesActiveAt([r()], [ev], 5000 * S, true), false);  // after end
    assertEq(rulesActiveAt([r()], [ev], 4600 * S, true), false);  // off is exclusive
});
test('offsets shift the window', () => {
    // enable 10 min before start: on = (1000 - 600)s
    assertEq(rulesActiveAt([r({enableOffsetMin: -10})], [ev], 500 * S, true), true);
    assertEq(rulesActiveAt([r()], [ev], 500 * S, true), false);
});
test('all-day skipped when ignoreAllDay', () => {
    const allday = {...ev, allDay: true};
    assertEq(rulesActiveAt([r()], [allday], 2000 * S, true), false);
    assertEq(rulesActiveAt([r()], [allday], 2000 * S, false), true);
});
test('disabled rule and source mismatch never active', () => {
    assertEq(rulesActiveAt([r({enabled: false})], [ev], 2000 * S, true), false);
    assertEq(rulesActiveAt([r({calendars: ['other']})], [ev], 2000 * S, true), false);
});
test('calendarNextTransition returns next boundary', () => {
    assertEq(calendarNextTransition([r()], [ev], 2000 * S, true), 4600 * S); // next is the off edge
    assertEq(calendarNextTransition([r()], [ev], 500 * S, true), 1000 * S);  // next is the on edge
    assertEq(calendarNextTransition([r()], [ev], 5000 * S, true), null);     // nothing left
});
