// /tests/browser.test.mjs
// End-to-end checks in a real browser (Chromium via Playwright): screens, checkout, receipts, archive, options,
// central config and backups. Skipped automatically when Playwright isn't installed. Run: node --test tests/*.test.mjs
// RELEVANT FILES: ../index.html, ../ticket.html, ../precios.html, ../reporte.html, load-app.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium = null;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { /* not installed: tests skip */ }
const skip = chromium ? false : 'Playwright is not installed';

// Tiny static server for the repo, so pages load over http like on the real site.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ttf': 'font/ttf' };
let server, base, browser;
before(async () => {
    if (skip) return;
    server = http.createServer((req, res) => {
        const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    }).listen(0);
    base = `http://localhost:${server.address().port}`;
    browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

const WEDNESDAY = new Date('2026-11-04T15:00:00');
// New page with a fixed clock, stubbed print, saved tables, and a list of page errors.
async function open(url, { tables = [], seed = {}, width = 1280, init } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
    await context.addInitScript(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
    if (init) await context.addInitScript(init);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());
    await page.clock.setFixedTime(WEDNESDAY);
    await page.goto(`${base}/index.html`);
    await page.evaluate(({ tables, seed }) => {
        localStorage.clear();
        localStorage.setItem('tacos_tables', JSON.stringify(tables));
        Object.entries(seed).forEach(([k, v]) => localStorage.setItem(k, v));
    }, { tables, seed });
    await page.goto(`${base}/${url}`);
    return { page, context, errors };
}
const at = (h, m = 0) => new Date(2026, 10, 4, h, m).getTime();
const openTable = (id, name, order, extra = {}) => ({ id, name, note: '', order, charged: false, createdAt: at(14), tip: 0, ...extra });

test('every screen loads without errors or sideways scrolling on a phone', { skip }, async () => {
    for (const url of ['index.html', 'ticket.html', 'menu.html', 'precios.html', 'reporte.html', 'trompo.html']) {
        const { page, context, errors } = await open(url, { width: 320 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${url} scrolls sideways`);
        assert.deepEqual(errors, [], `${url} errors`);
        await context.close();
    }
});

test('checkout with a 10% tip updates the paid card, sales, tips and the daily report', { skip }, async () => {
    const { page, context, errors } = await open('index.html', { tables: [openTable('a', 'Mesa 1', { cerveza: 2 })] });
    await page.click('[data-close-order="a"]');
    await page.click('.tip-option:has-text("10%")');
    assert.equal(await page.textContent('#checkout-total'), '$77.00');
    await page.click('#checkout-form [type=submit]');
    assert.equal(await page.textContent('#kpi-sales'), '$70.00');
    assert.equal(await page.textContent('#kpi-tips'), '$7.00');
    assert.match(await page.textContent('#floor-grid .closed-order'), /Propina\s*\$7\.00[\s\S]*Total\s*\$77\.00/);
    await page.click('#open-report');
    assert.match(await page.textContent('#report-body'), /Mesas cobradas\s*1/);
    assert.deepEqual(errors, []);
    await context.close();
});

test('archived tables leave sales; only tables paid today can be reopened', { skip }, async () => {
    const paid = (id, paidAt, sub) => ({ id, name: id, note: '', order: { cerveza: 1 }, charged: true, paidAt, checkoutSubtotal: sub, checkoutLines: { cerveza: sub }, createdAt: paidAt - 600000, tip: 0 });
    const { page, context } = await open('index.html', { tables: [paid('hoy', at(13), 35), paid('ayer', at(13) - 864e5, 70)] });
    await page.click('#show-closed-orders');
    assert.ok(await page.$('[data-order-action="reopen"][data-id="hoy"]'));
    assert.equal(await page.$('[data-order-action="reopen"][data-id="ayer"]'), null);
    await page.click('[data-order-action="archive"][data-id="hoy"]');
    assert.equal(await page.textContent('#kpi-sales'), '$0.00');
    await context.close();
});

test('ticket: sold-out products are disabled; shortcuts and option groups work', { skip }, async () => {
    const { page, context, errors } = await open('ticket.html', { seed: { tacos_stock: JSON.stringify({ taco_suadero: false }) } });
    assert.equal(await page.isDisabled('.product-button:has-text("Suadero")'), true);
    await page.click('#quick-shortcut-list button:has-text("4 × Pastor")');
    await page.click('#tray-handle');
    await page.click('.tray-item');
    await page.check('#modal-options input[value="Sin Cebolla"]');
    await page.click('#apply-minus'); await page.click('#apply-minus');
    await page.click('#apply-btn');
    await page.click('#modal-update-btn');
    assert.equal(await page.textContent('.tray-item-help'), '2 Sin Cebolla · 2 normales');
    assert.equal(await page.textContent('#tray-total'), '$34.00'); // Wednesday 2x1
    assert.deepEqual(errors, []);
    await context.close();
});

test('"Ver recibo": preview image, save as image, and print on paper inside the tap', { skip }, async () => {
    const { page, context, errors } = await open('index.html', { tables: [openTable('a', 'Mesa 1', { cerveza: 1 })] });
    await page.click('[data-print-order="a"]');
    assert.equal(await page.$eval('#receipt-sheet', d => d.open), true);
    await page.waitForFunction(() => document.getElementById('receipt-preview').naturalWidth === 576);
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#receipt-save')]);
    assert.equal(download.suggestedFilename(), 'recibo-Mesa-1.png');
    assert.equal(await page.evaluate(() => { document.getElementById('receipt-print-now').click(); return window.__prints; }), 1);
    assert.match(await page.textContent('#print-area'), /Cuenta por pagar/);
    assert.deepEqual(errors, []);
    await context.close();
});

test('"Ver recibo" in the iPhone home-screen app: no print button, share sheet with the image', { skip }, async () => {
    const init = () => {
        Object.defineProperty(navigator, 'standalone', { value: true });
        navigator.canShare = d => Boolean(d?.files?.length);
        navigator.share = d => { window.__shared = d.files.map(f => `${f.name} ${f.type}`); return Promise.resolve(); };
    };
    const { page, context } = await open('index.html', { tables: [openTable('a', 'Mesa 1', { cerveza: 1 })], init });
    await page.click('[data-print-order="a"]');
    assert.equal(await page.isVisible('#receipt-print-now'), false);
    const shared = await page.evaluate(() => { document.getElementById('receipt-save').click(); return window.__shared; });
    assert.deepEqual(shared, ['recibo-Mesa-1.png image/png']);
    await context.close();
});

test('central config: connecting applies the file and locks managed settings', { skip }, async () => {
    const { page, context, errors } = await open('precios.html');
    await context.route('https://w.test/**', route => {
        if (route.request().headers()['x-config-key'] !== 'k') return route.fulfill({ status: 401, body: 'Unauthorized' });
        const url = new URL(route.request().url());
        if (url.pathname === '/backups') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ promoOn: false, lateMinutes: 45, prices: { taco_pastor: 20 } }) });
    });
    await page.fill('#central-url', 'https://w.test/');
    await page.fill('#central-key', 'k');
    await Promise.all([page.waitForEvent('load'), page.click('#central-form [type=submit]')]);
    assert.equal(await page.inputValue('#late-minutes'), '45');
    assert.equal(await page.isChecked('#promo-toggle'), false);
    assert.equal(await page.evaluate(() => document.getElementById('late-minutes').inert), true);
    assert.ok(await page.$('.managed-banner'));
    assert.deepEqual(errors, []);
    await context.close();
});

test('backup restore is all-or-nothing and backups never include the device key', { skip }, async () => {
    const saved = [];
    const huge = { day: '2026-11-01', device: 'd-big12345', data: { tacos_tables: `[${'"x",'.repeat(3e6)}"x"]` } };
    const { page, context } = await open('precios.html', {
        tables: [openTable('keep', 'Mesa importante', { cerveza: 2 })],
        seed: { tacos_config_source: JSON.stringify({ url: 'https://w.test/', key: 'secret-key' }) },
    });
    await context.route('https://w.test/**', route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/backup') { saved.push(route.request().postData()); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"name":"x","bytes":1}' }); }
        if (url.pathname === '/backups') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ name: '2026-11-01_d-big12345.json', size: 12e6 }]) });
        if (url.pathname.startsWith('/backups/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(huge) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('#backup-list option[value]').length > 0 && document.getElementById('backup-list').value);
    await page.click('#backup-restore');
    await page.waitForFunction(() => /no se cambió nada/.test(document.getElementById('backup-status').textContent));
    assert.match(await page.evaluate(() => localStorage.getItem('tacos_tables')), /Mesa importante/);
    assert.ok(saved.length > 0, 'a safety backup was attempted');
    assert.ok(saved.every(body => !body.includes('secret-key')), 'device key never sent in a backup');
    await context.close();
});

test('"Liberar espacio" removes only old paid tables, and only with an earlier-day backup', { skip }, async () => {
    const DAY = 864e5;
    const paid = (id, daysAgo) => ({ id, name: id, note: '', order: { cerveza: 1 }, charged: true, paidAt: at(13) - daysAgo * DAY, checkoutSubtotal: 35, checkoutLines: { cerveza: 35 }, createdAt: at(12) - daysAgo * DAY, tip: 0 });
    const tables = [paid('viejo', 400), paid('medio', 200), paid('reciente', 10), openTable('abierta', 'Abierta', { refresco: 1 }, { createdAt: at(12) - 500 * DAY })];
    const ids = page => page.evaluate(() => JSON.parse(localStorage.getItem('tacos_tables')).map(t => t.id).join(','));

    // Not connected: disabled, with the reason.
    let { page, context } = await open('reporte.html', { tables });
    assert.equal(await page.isDisabled('#cleanup-run'), true);
    assert.match(await page.textContent('#cleanup-status'), /conecta la configuración central/);
    await context.close();

    // Connected: the Worker's backup list decides whether an earlier-day backup exists.
    for (const [files, expectRemoved] of [[[], false], [['2026-11-01_DEVICE.json'], true]]) {
        ({ page, context } = await open('reporte.html', { tables, seed: { tacos_config_source: JSON.stringify({ url: 'https://w.test/', key: 'k' }), tacos_device_id: 'd-dev12345' } }));
        const order = [];
        await context.route('https://w.test/**', route => {
            const p = new URL(route.request().url()).pathname;
            order.push(`${route.request().method()} ${p}`);
            if (p === '/backups') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(files.map(n => ({ name: n.replace('DEVICE', 'd-dev12345'), size: 1 }))) });
            if (p === '/backup') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"name":"x","bytes":1}' });
            return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        });
        await page.reload();
        assert.match(await page.textContent('#cleanup-count'), /^1 mesa cobrada/); // 12 months: only "viejo" (open tables never count)
        await page.selectOption('#cleanup-age', '6');
        assert.match(await page.textContent('#cleanup-count'), /^2 mesas cobradas/); // 6 months: "viejo" + "medio"
        await page.click('#cleanup-run');
        await page.waitForFunction(() => /Se quitaron|No se liberó/.test(document.getElementById('cleanup-status').textContent));
        if (expectRemoved) {
            assert.equal(await ids(page), 'reciente,abierta');
            assert.ok(order.indexOf('PUT /backup') > order.indexOf('GET /backups'), 'fresh backup before removing');
        } else {
            assert.match(await page.textContent('#cleanup-status'), /de un día anterior/);
            assert.equal(await ids(page), 'viejo,medio,reciente,abierta');
        }
        await context.close();
    }
});

test('Trompo: pastor in open tables, the options mix, oldest table first, and it refreshes', { skip }, async () => {
    const mins = m => new Date('2026-11-04T15:00:00').getTime() - m * 60000;
    const tables = [
        openTable('b', 'Mesa B', { taco_pastor: 2, cerveza: 1 }, { createdAt: mins(10) }),
        openTable('a', 'Mesa A', { taco_pastor: 4 }, { createdAt: mins(70), modifiers: { taco_pastor: [{ qty: 2, mods: ['Sin Cebolla'] }] } }),
        openTable('c', 'Sin pastor', { cerveza: 2 }, { createdAt: mins(5) }),
        { ...openTable('d', 'Pagada', { taco_pastor: 6 }), charged: true, paidAt: mins(1) },
    ];
    const { page, context, errors } = await open('trompo.html', { tables });
    assert.equal(await page.textContent('#trompo-count'), '6');
    assert.equal(await page.textContent('#trompo-mix'), '4 normales · 2 Sin Cebolla');
    const rows = await page.$$eval('#trompo-tables tbody tr', r => r.map(x => `${x.cells[0].textContent}|${x.cells[1].textContent}|${x.cells[2].textContent.trim()}|${x.className}`));
    assert.deepEqual(rows, ['Mesa A|4|2 Sin Cebolla · 2 normales|is-late', 'Mesa B|2|Normales|']);
    // A new order on another screen shows up when the Trompo screen comes back into view.
    await page.evaluate(() => {
        const t = JSON.parse(localStorage.getItem('tacos_tables'));
        t.push({ id: 'e', name: 'Mesa E', note: '', order: { taco_pastor: 3 }, charged: false, createdAt: Date.now(), tip: 0 });
        localStorage.setItem('tacos_tables', JSON.stringify(t));
        document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.textContent('#trompo-count'), '9');
    assert.deepEqual(errors, []);
    await context.close();
    // The floor plan links to it.
    const floor = await open('index.html');
    assert.ok(await floor.page.$('a.link[href="trompo.html"]'));
    await floor.context.close();
});
