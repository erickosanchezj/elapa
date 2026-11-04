// /tests/load-app.mjs
// Loads js/app.js (and optionally js/remote-config.js) in a sandbox with fake storage and a fixed clock.
// Lets the unit tests check prices, promo, reports and settings without a browser.
// RELEVANT FILES: app.test.mjs, config.test.mjs, ../js/app.js, ../js/remote-config.js
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Minimal localStorage: same behavior as the browser for strings.
export function fakeStorage(seed = {}) {
    const data = new Map(Object.entries(seed));
    return {
        getItem: k => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => { data.set(k, String(v)); },
        removeItem: k => { data.delete(k); },
        key: i => [...data.keys()][i] ?? null,
        get length() { return data.size; },
        dump: () => Object.fromEntries(data),
    };
}

// now: the fixed "current time" (e.g. a Wednesday for the 2x1). seed: initial localStorage values.
export function loadApp({ now = '2026-11-04T15:00:00', seed = {}, files = ['js/app.js'] } = {}) {
    const storage = fakeStorage(seed);
    const fixed = new Date(now).getTime();
    const context = {
        console, setTimeout, clearTimeout, Promise,
        localStorage: storage,
        navigator: { onLine: false },
        document: { querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, body: null },
        requestAnimationFrame: fn => fn(),
    };
    context.window = context;
    vm.createContext(context);
    // Freeze "now" so promo days and "today" are predictable.
    vm.runInContext(`(() => { const Real = Date; class Fixed extends Real {
        constructor(...a) { a.length ? super(...a) : super(${fixed}); } static now() { return ${fixed}; } }
        globalThis.Date = Fixed; })();`, context);
    files.forEach(file => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file }));
    const App = context.TaqueriaApp;
    App.loadState();
    return { App, storage, context };
}

// Helper to build a table record like the app saves it.
export const table = (fields = {}) => ({ id: 'id_test', name: 'Mesa 1', note: '', order: {}, charged: false, paidAt: null,
    createdAt: new Date('2026-11-04T14:00:00').getTime(), tip: 0, ...fields });
