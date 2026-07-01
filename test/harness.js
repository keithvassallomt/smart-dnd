import System from 'system';

const _cases = [];
export function test(name, fn) { _cases.push({name, fn}); }

function _eq(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b))
        return a.length === b.length && a.every((x, i) => _eq(x, b[i]));
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const ka = Object.keys(a), kb = Object.keys(b);
        return ka.length === kb.length && ka.every(k => _eq(a[k], b[k]));
    }
    return false;
}

export function assertEq(actual, expected, msg = '') {
    if (!_eq(actual, expected))
        throw new Error(`${msg}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
}

export function assertTrue(v, msg = '') {
    if (v !== true) throw new Error(`${msg}\n  expected true, got ${JSON.stringify(v)}`);
}

export function run() {
    let failed = 0;
    for (const c of _cases) {
        try { c.fn(); print(`  ok   ${c.name}`); }
        catch (e) { failed++; print(`  FAIL ${c.name}\n       ${e.message.replace(/\n/g, '\n       ')}`); }
    }
    print(`\n${_cases.length - failed}/${_cases.length} passed`);
    System.exit(failed === 0 ? 0 : 1);
}
