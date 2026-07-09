// /js/ops.js
// Renders lightweight operations pages for KDS, Trompo, Staff, and Settings
// Exists so disabled nav items become useful views without adding dependencies
// RELEVANT FILES: kds.html, trompo.html, staff.html, settings.html
document.addEventListener('DOMContentLoaded', () => {
    const App = window.TaqueriaApp;
    const page = document.body.dataset.page;
    const root = document.getElementById('ops-content');
    if (!App || !root) return;

    App.loadState();

    const activeTables = () => App.AppState.tables.filter(t => !t.charged);
    const itemLabel = id => App.AppState.items.find(i => i.id === id)?.label || id;
    const modifiersFor = (table, id) => (table.orderModifiers && table.orderModifiers[id] || []).join(', ');
    const card = html => `<section class="border border-gray-200 p-4 bg-white">${html}</section>`;
    const empty = text => `<div class="border border-dashed border-gray-300 p-6 text-center text-gray-500">${text}</div>`;

    function renderKds() {
        const rows = activeTables().flatMap(table => Object.entries(table.order || {})
            .filter(([, qty]) => qty > 0)
            .map(([id, qty]) => ({ table, id, qty })));
        root.innerHTML = rows.length ? rows.map(row => card(`
            <div class="flex items-start justify-between gap-3">
                <div>
                    <div class="font-bold text-lg">${row.qty}x ${itemLabel(row.id)}</div>
                    <div class="text-sm text-gray-500">${row.table.name}${row.table.note ? ` - ${row.table.note}` : ''}</div>
                    ${modifiersFor(row.table, row.id) ? `<div class="mt-2 text-sm font-mono text-rose-600">${modifiersFor(row.table, row.id)}</div>` : ''}
                </div>
                <a class="text-sm font-bold text-rose-600" href="ticket.html?tableId=${row.table.id}">Open</a>
            </div>`)).join('') : empty('No active kitchen items.');
    }

    function renderTrompo() {
        const rows = activeTables()
            .map(table => ({ table, qty: Number((table.order || {}).taco_pastor || 0) }))
            .filter(row => row.qty > 0);
        const total = rows.reduce((sum, row) => sum + row.qty, 0);
        root.innerHTML = card(`
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-sm text-gray-500 uppercase font-mono">Pastor needed</div>
                    <div class="text-4xl font-bold">${total}</div>
                </div>
                <div class="text-sm font-bold ${App.isPastorPromoActive() ? 'text-rose-600' : 'text-gray-500'}">${App.isPastorPromoActive() ? '2x1 active' : 'No promo now'}</div>
            </div>`) + (rows.length ? rows.map(row => card(`
            <div class="flex items-center justify-between">
                <div class="font-bold">${row.table.name}</div>
                <div class="text-2xl font-bold">${row.qty} pastor</div>
            </div>`)).join('') : empty('No active pastor orders.'));
    }

    function renderStaff() {
        const report = App.computeDailyReport();
        const active = activeTables();
        const now = Date.now();
        const incidents = active.filter(t => now - (t.createdAt || now) > App.getSlaThresholdMs()).length;
        root.innerHTML = `
            <section class="grid grid-cols-2 gap-3">
                ${card(`<div class="text-sm text-gray-500">Active Tables</div><div class="text-3xl font-bold">${active.length}</div>`)}
                ${card(`<div class="text-sm text-gray-500">SLA Incidents</div><div class="text-3xl font-bold">${incidents}</div>`)}
                ${card(`<div class="text-sm text-gray-500">Net Sales</div><div class="text-3xl font-bold">${App.money(report.totalNet)}</div>`)}
                ${card(`<div class="text-sm text-gray-500">Tips</div><div class="text-3xl font-bold">${App.money(report.totalTips)}</div>`)}
            </section>
            ${report.unpaidTablesToday.length ? card(`<div class="font-bold mb-2">Unpaid today</div>${report.unpaidTablesToday.map(t => `<div class="flex justify-between py-1 border-t border-gray-100"><span>${t.name}</span><span>${App.money(t.total)}</span></div>`).join('')}`) : empty('No unpaid tables from today.')}`;
    }

    function renderSettings() {
        root.innerHTML = card(`
            <label class="block text-sm font-bold uppercase mb-2" for="sla-minutes">SLA minutes</label>
            <input id="sla-minutes" type="number" min="1" value="${App.AppState.slaMinutes}" class="w-full border border-gray-300 p-3 text-lg font-mono"/>
            <p class="mt-2 text-sm text-gray-500">Tables older than this show as SLA incidents.</p>
            <label class="mt-6 flex items-center justify-between gap-4">
                <span>
                    <span class="block text-sm font-bold uppercase">Pastor 2x1</span>
                    <span class="block text-sm text-gray-500">Applies only Monday and Wednesday when enabled.</span>
                </span>
                <input id="promo-enabled" type="checkbox" ${App.AppState.promoEnabled ? 'checked' : ''} class="h-6 w-6"/>
            </label>
            <button id="settings-save" class="mt-6 w-full bg-rose-600 text-white font-bold uppercase p-3">Save Settings</button>
        `);
        document.getElementById('settings-save').addEventListener('click', () => {
            App.AppState.slaMinutes = Math.max(1, Number(document.getElementById('sla-minutes').value || 60));
            App.AppState.promoEnabled = document.getElementById('promo-enabled').checked;
            App.persist();
            App.toast('Settings saved', 'success');
        });
    }

    if (page === 'kds') renderKds();
    if (page === 'trompo') renderTrompo();
    if (page === 'staff') renderStaff();
    if (page === 'settings') renderSettings();
});
