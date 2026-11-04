// /tests/config.test.mjs
// Unit tests for the central config (js/remote-config.js): valid files apply, broken or partial ones are safe.
// Protects the "edit config.json on GitHub" workflow from silently changing prices or settings. Run: node --test tests/*.test.mjs
// RELEVANT FILES: load-app.mjs, ../js/remote-config.js, ../cloudflare/config-worker/config.example.json
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './load-app.mjs';

const FILES = ['js/app.js', 'js/remote-config.js'];
const withConfig = (data, seed = {}) => loadApp({ files: FILES, seed: { ...seed, tacos_remote_config: JSON.stringify({ fetchedAt: 1, data }) } });

test('a valid config applies prices, products, promo, late time, shortcuts and templates', () => {
    const { App } = withConfig({
        prices: { taco_pastor: 20, quesadilla: 30 },
        items: [{ id: 'taco_pastor', label: 'Pastor', category: 'tacos' }, { id: 'quesadilla', label: 'Quesadilla', category: 'otros' }],
        promoOn: false, lateMinutes: 45,
        quickPresets: [{ itemId: 'taco_pastor', qty: 3 }],
        tableTemplates: [{ name: 'Primos', note: 'Domingo', order: { taco_suadero: 5 } }],
    });
    const S = App.AppState;
    assert.equal(S.prices.taco_pastor, 20);
    assert.equal(S.promoEnabled, false);
    assert.equal(S.lateMinutes, 45);
    assert.equal(S.quickPresets.length, 1);
    assert.equal(S.quickPresets[0].qty, 3);
    assert.equal(S.tableTemplates[0].name, 'Primos');
    assert.ok(S.items.some(i => i.id === 'quesadilla' && i.category === 'otros'));
    assert.ok(S.items.some(i => i.id === 'taco_carbon'), 'basic products are never removed');
});

test('an invalid value rejects the whole file, so local settings stay', () => {
    const { App } = withConfig({ prices: { taco_pastor: 99 }, promoOn: 'yes' }, { tacos_late_minutes: '50' });
    assert.equal(App.AppState.prices.taco_pastor, 17, 'price not applied from a rejected file');
    assert.equal(App.AppState.promoEnabled, true);
    assert.equal(App.AppState.lateMinutes, 50);
});

test('rejects negative prices, out-of-range minutes and bad shortcuts', () => {
    assert.equal(withConfig({ prices: { taco_pastor: -1 } }).App.AppState.prices.taco_pastor, 17);
    assert.equal(withConfig({ lateMinutes: 2 }).App.AppState.lateMinutes, 60);
    assert.equal(withConfig({ quickPresets: [{ itemId: 'taco_pastor', qty: 0 }] }).App.AppState.quickPresets.length > 1, true);
});

test('keys missing from the file stay as they are on the device', () => {
    const { App } = withConfig({ lateMinutes: 30 }, { tacos_promo_on: 'false', tacos_prices: JSON.stringify({ taco_pastor: 18 }) });
    assert.equal(App.AppState.lateMinutes, 30);
    assert.equal(App.AppState.promoEnabled, false);
    assert.equal(App.AppState.prices.taco_pastor, 18);
});

test('with no config downloaded yet, nothing changes', () => {
    const { App } = loadApp({ files: FILES });
    assert.equal(App.AppState.prices.taco_pastor, 17);
    assert.equal(App.AppState.lateMinutes, 60);
});
