// /tests/app.test.mjs
// Unit tests for the restaurant rules in js/app.js: prices, 2x1 promo, checkout, reports, options, settings.
// Protects the numbers staff and customers see whenever the code changes. Run: node --test tests/
// RELEVANT FILES: load-app.mjs, ../js/app.js, ../js/floor.js, ../js/report-page.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, table } from './load-app.mjs';

const WEDNESDAY = '2026-11-04T15:00:00'; // 2x1 day
const THURSDAY = '2026-11-05T15:00:00';
const json = v => JSON.parse(JSON.stringify(v)); // compare values created inside the sandbox

test('money uses es-MX thousands separators', () => {
    const { App } = loadApp();
    assert.equal(App.money(1026), '$1,026.00');
    assert.equal(App.money(1234567.5), '$1,234,567.50');
    assert.equal(App.money(undefined), '$0.00');
});

test('2x1 pastor applies on Monday/Wednesday only, and only with the switch on', () => {
    assert.equal(loadApp({ now: WEDNESDAY }).App.computeLine('taco_pastor', 4).total, 34); // pay 2 of 4 at $17
    assert.equal(loadApp({ now: WEDNESDAY }).App.computeLine('taco_pastor', 3).total, 34); // pay 2 of 3
    assert.equal(loadApp({ now: THURSDAY }).App.computeLine('taco_pastor', 4).total, 68);
    assert.equal(loadApp({ now: WEDNESDAY, seed: { tacos_promo_on: 'false' } }).App.computeLine('taco_pastor', 4).total, 68);
    assert.equal(loadApp({ now: WEDNESDAY }).App.computeLine('taco_suadero', 4).total, 68); // promo is pastor-only
});

test('promo switch is ON by default and ignores the old always-false tacos_promoEnabled key', () => {
    const { App } = loadApp({ seed: { tacos_promoEnabled: 'false' } });
    assert.equal(App.AppState.promoEnabled, true);
});

test('late-table time defaults to 60 minutes and keeps a saved value', () => {
    assert.equal(loadApp().App.AppState.lateMinutes, 60);
    assert.equal(loadApp({ seed: { tacos_late_minutes: '45' } }).App.AppState.lateMinutes, 45);
    assert.equal(loadApp().App.formatLateTime(45), '45 min');
    assert.equal(loadApp().App.formatLateTime(60), '1 h');
    assert.equal(loadApp().App.formatLateTime(90), '1 h 30 min');
});

test('deleting every shortcut or template keeps the lists empty (defaults are only for first use)', () => {
    const { App } = loadApp({ seed: { tacos_quick_presets: '[]', tacos_table_templates: '[]' } });
    assert.equal(App.AppState.quickPresets.length, 0);
    assert.equal(App.AppState.tableTemplates.length, 0);
    assert.ok(loadApp().App.AppState.quickPresets.length > 0, 'first use gets the defaults');
});

test('checkout freezes subtotal, line amounts and 2x1 savings', () => {
    const { App } = loadApp({ now: WEDNESDAY });
    const t = table({ order: { taco_pastor: 4, cerveza: 1 }, tip: 7 });
    App.AppState.tables.push(t);
    App.closeTable(t);
    assert.equal(t.charged, true);
    assert.equal(t.checkoutSubtotal, 69);
    assert.deepEqual(json(t.checkoutLines), { taco_pastor: 34, cerveza: 35 });
    assert.deepEqual(json(t.checkoutPromo), { qty: 2, value: 34 });
    // Later price or promo changes never change what was charged.
    App.AppState.prices.taco_pastor = 99;
    App.AppState.promoEnabled = false;
    assert.equal(App.computeTableTotal(t), 69);
    assert.deepEqual(json(App.lineAmounts(t)), { amounts: { taco_pastor: 34, cerveza: 35 }, estimated: false });
});

test('older paid tables without saved lines split the frozen subtotal and are marked estimated', () => {
    const { App } = loadApp({ now: THURSDAY });
    const old = table({ order: { taco_pastor: 4, cerveza: 1 }, charged: true, paidAt: Date.now(), checkoutSubtotal: 69 });
    const { amounts, estimated } = App.lineAmounts(old);
    assert.equal(estimated, true);
    assert.equal(Math.round((amounts.taco_pastor + amounts.cerveza) * 100) / 100, 69);
});

test('reports leave out archived tables and count tips, hours and promo savings', () => {
    const { App } = loadApp({ now: WEDNESDAY });
    const at = h => new Date(`2026-11-04T${h}:00:00`).getTime();
    App.AppState.tables = [
        table({ id: 'a', order: { taco_pastor: 4 }, charged: true, paidAt: at(13), checkoutSubtotal: 34, checkoutLines: { taco_pastor: 34 }, checkoutPromo: { qty: 2, value: 34 }, tip: 5, openDurationMs: 600000 }),
        table({ id: 'b', order: { cerveza: 2 }, charged: true, paidAt: at(14), checkoutSubtotal: 70, checkoutLines: { cerveza: 70 }, tip: 0, openDurationMs: 1200000 }),
        table({ id: 'c', order: { gringas: 1 }, charged: true, paidAt: at(14), checkoutSubtotal: 80, checkoutLines: { gringas: 80 }, archived: true }),
        table({ id: 'd', order: { refresco: 1 } }), // still open
    ];
    const r = App.computeDailyReport();
    assert.equal(r.tablesCount, 2);
    assert.equal(r.totalSubtotals, 104);
    assert.equal(r.totalTips, 5);
    assert.equal(r.byHour[13], 34);
    assert.equal(r.byHour[14], 70);
    assert.equal(r.promo.qty, 2);
    assert.equal(r.unpaidTablesToday.length, 1);
    assert.deepEqual(json(r.itemRevenue), { taco_pastor: 34, cerveza: 70 });
});

test('older Monday tables rebuild their 2x1 savings from the paid day', () => {
    const { App } = loadApp({ now: WEDNESDAY });
    const monday = table({ order: { taco_pastor: 2 }, charged: true, paidAt: new Date('2026-11-02T19:00:00').getTime(), checkoutSubtotal: 17 });
    assert.deepEqual(json(App.promoSaved(monday)), { qty: 1, value: 17 });
});

test('option groups: old one-list saves read as one group; mixed groups describe the rest as "normales"', () => {
    const { App } = loadApp();
    assert.deepEqual(json(App.modGroups({ taco_pastor: ['Sin Cebolla'] }, 'taco_pastor', 4)), [{ qty: 4, mods: ['Sin Cebolla'] }]);
    const groups = [{ qty: 2, mods: ['Sin Cebolla'] }, { qty: 1, mods: ['Sin Piña', 'Sin Verdura'] }];
    assert.equal(App.describeMods(groups, 4), '2 Sin Cebolla · 1 Sin Piña, Sin Verdura · 1 normal');
    assert.equal(App.describeMods([{ qty: 4, mods: ['Sin Cebolla'] }], 4), 'Sin Cebolla');
    assert.equal(App.describeMods([], 4), '');
});

test('state survives a save and reload', () => {
    const first = loadApp();
    first.App.AppState.lateMinutes = 30;
    first.App.AppState.promoEnabled = false;
    first.App.persist();
    const again = loadApp({ seed: first.storage.dump() });
    assert.equal(again.App.AppState.lateMinutes, 30);
    assert.equal(again.App.AppState.promoEnabled, false);
});
