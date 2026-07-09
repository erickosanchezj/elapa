// /tests/app-data.test.cjs
// Regression tests for shared restaurant data and reporting rules
// Exists so sales, tips, SLA, and promo behavior stay stable across UI screens
// RELEVANT FILES: js/app.js, js/floor.js, js/ticket.js, precios.html
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createLocalStorage(seed = {}) {
    const store = { ...seed };
    return {
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
        },
        setItem(key, value) {
            store[key] = String(value);
        },
        removeItem(key) {
            delete store[key];
        },
        dump() {
            return { ...store };
        },
    };
}

function loadApp(seed = {}) {
    const context = {
        window: {},
        document: { querySelector: () => null, querySelectorAll: () => [] },
        localStorage: createLocalStorage(seed),
        navigator: {},
        setTimeout,
        clearTimeout,
        requestAnimationFrame: fn => fn(),
        console,
        Date,
    };
    context.window.window = context.window;
    context.window.document = context.document;
    context.window.localStorage = context.localStorage;
    context.window.navigator = context.navigator;
    vm.createContext(context);
    const appPath = path.join(__dirname, '..', 'js', 'app.js');
    vm.runInContext(fs.readFileSync(appPath, 'utf8'), context, { filename: appPath });
    return context.window.TaqueriaApp;
}

function test(name, fn) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (err) {
        console.error(`not ok - ${name}`);
        console.error(err.stack || err.message);
        process.exitCode = 1;
    }
}

test('pastor promo requires toggle and Monday or Wednesday', () => {
    const App = loadApp({
        tacos_promoEnabled: 'true',
        tacos_tables: '[]',
    });
    App.loadState();

    assert.strictEqual(App.isPastorPromoActive(new Date('2026-07-06T12:00:00')), true);
    assert.strictEqual(App.isPastorPromoActive(new Date('2026-07-07T12:00:00')), false);
    assert.strictEqual(App.isPastorPromoActive(new Date('2026-07-08T12:00:00')), true);

    App.AppState.promoEnabled = false;
    assert.strictEqual(App.isPastorPromoActive(new Date('2026-07-08T12:00:00')), false);
});

test('finalizing a table snapshots subtotal, tip, total, and duration', () => {
    const App = loadApp({
        tacos_promoEnabled: 'false',
        tacos_tables: '[]',
    });
    App.loadState();

    const table = {
        id: 'mesa-1',
        name: 'Mesa 1',
        order: { taco_pastor: 2 },
        charged: false,
        createdAt: 1000,
    };

    App.finalizeTableSale(table, 5, 61000);

    assert.strictEqual(table.charged, true);
    assert.strictEqual(table.paidAt, 61000);
    assert.strictEqual(table.openDurationMs, 60000);
    assert.strictEqual(table.tip, 5);
    assert.strictEqual(table.finalSubtotal, 34);
    assert.strictEqual(table.finalTotal, 39);
});

test('SLA threshold comes from persisted operator setting', () => {
    const App = loadApp({
        tacos_slaMinutes: '45',
        tacos_tables: '[]',
    });
    App.loadState();

    assert.strictEqual(App.AppState.slaMinutes, 45);
    assert.strictEqual(App.getSlaThresholdMs(), 45 * 60 * 1000);
});

test('daily report uses closed sale snapshots instead of current prices', () => {
    const today = new Date();
    today.setHours(10, 0, 0, 0);

    const App = loadApp({
        tacos_promoEnabled: 'false',
        tacos_prices: JSON.stringify({ taco_pastor: 99 }),
        tacos_tables: JSON.stringify([
            {
                id: 'closed-1',
                name: 'Closed',
                order: { taco_pastor: 2 },
                charged: true,
                paidAt: today.getTime(),
                openDurationMs: 60000,
                tip: 3,
                finalSubtotal: 34,
                finalTotal: 37,
            },
        ]),
    });
    App.loadState();

    const report = App.computeDailyReport();

    assert.strictEqual(report.totalSubtotals, 34);
    assert.strictEqual(report.totalTips, 3);
    assert.strictEqual(report.totalNet, 37);
});
