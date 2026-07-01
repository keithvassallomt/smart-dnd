import {test, assertEq} from './harness.js';
import {computeDesired, reconcile} from '../smart-dnd@keithvassallo.com/lib/coordinator.js';

test('computeDesired requires master and a source', () => {
    assertEq(computeDesired({masterEnabled: true, scheduleActive: true, calendarActive: false}), true);
    assertEq(computeDesired({masterEnabled: true, scheduleActive: false, calendarActive: true}), true);
    assertEq(computeDesired({masterEnabled: false, scheduleActive: true, calendarActive: true}), false);
    assertEq(computeDesired({masterEnabled: true, scheduleActive: false, calendarActive: false}), false);
});

test('rising edge turns DND on and takes ownership', () => {
    assertEq(reconcile({desired: true, lastDesired: false, owned: false, dndOn: false}),
        {owned: true, action: 'on'});
});
test('rising edge adopts ownership if already on manually', () => {
    assertEq(reconcile({desired: true, lastDesired: false, owned: false, dndOn: true}),
        {owned: true, action: null});
});
test('falling edge releases only what we own', () => {
    assertEq(reconcile({desired: false, lastDesired: true, owned: true, dndOn: true}),
        {owned: false, action: 'off'});
});
test('falling edge does not turn off a manual DND we do not own', () => {
    assertEq(reconcile({desired: false, lastDesired: true, owned: false, dndOn: true}),
        {owned: false, action: null});
});
test('manual off mid-window is respected (no edge, no action)', () => {
    assertEq(reconcile({desired: true, lastDesired: true, owned: true, dndOn: false}),
        {owned: true, action: null});
});
test('no edge never acts', () => {
    assertEq(reconcile({desired: false, lastDesired: false, owned: false, dndOn: true}),
        {owned: false, action: null});
});
