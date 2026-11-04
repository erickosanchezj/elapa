// /js/receipt.js
// Builds a printable receipt for one table and prints it. Open tables print a pre-bill ("Cuenta");
// paid tables print the final ticket with tip. On iOS home-screen apps, opens recibo.html instead.
// RELEVANT FILES: receipt.css, floor.js, app.js, ../recibo.html
(function () {
    'use strict';
    const App = window.TaqueriaApp;
    const LOGO = 'icons/icon-192.png';
    new Image().src = LOGO; // preload, so printing never has to wait for it (and stays inside the tap)

    // Plain data for one receipt: everything recibo.html needs, with no access to this device's storage.
    function receiptData(table) {
        const lines = App.lineAmounts(table); // charged amounts; older paid orders may only have estimates
        const subtotal = App.computeTableTotal(table);
        const tip = table.charged ? (table.tip || 0) : 0;
        return {
            mesa: table.name,
            dateLabel: table.charged ? 'Pagada' : 'Fecha',
            date: new Date(table.charged ? table.paidAt : Date.now()).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }),
            orden: '#' + table.id.slice(-4).toUpperCase(),
            rows: Object.entries(table.order || {}).filter(([, qty]) => qty > 0).map(([itemId, qty]) => ({
                qty,
                label: App.AppState.items.find(i => i.id === itemId)?.label || itemId,
                mods: App.describeMods(App.modGroups(table.modifiers, itemId, qty), qty), // "2 Sin Cebolla · 2 normales"
                amount: lines.estimated ? null : lines.amounts[itemId], // no amount rather than today's price
            })),
            subtotal, tip, total: subtotal + tip,
            estimated: lines.estimated,
            charged: Boolean(table.charged),
        };
    }

    // Receipt markup from that data. Every value is escaped: recibo.html renders data taken from its URL.
    App.receiptHtml = function (d) {
        const esc = v => App.escapeHTML(String(v ?? ''));
        const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
        const meta = (label, value) => `<div class="receipt-meta-row"><span class="receipt-meta-label">${esc(label)}</span><span>${esc(value)}</span></div>`;
        const sum = (label, value, cls = '') => `<div class="receipt-summary-row ${cls}"><span>${label}</span><span>${App.money(num(value))}</span></div>`;
        const list = Array.isArray(d.rows) ? d.rows.filter(r => r && typeof r === 'object') : [];
        const rows = list.length ? list.map(r => `<tr><td>${num(r.qty)}x</td>
                <td>${esc(r.label)}${r.mods ? `<span class="receipt-mods">${esc(r.mods)}</span>` : ''}</td>
                <td class="price">${typeof r.amount === 'number' ? App.money(r.amount) : ''}</td></tr>`).join('')
            : '<tr><td class="receipt-empty" colspan="3">Sin productos</td></tr>';
        return `
            <div class="receipt-brand">
                <img src="${LOGO}" alt="" class="receipt-brand-logo">
                <h1 class="receipt-brand-name">Taquería "El Apá"</h1>
                <p class="receipt-brand-tagline">Sabor auténtico cada día</p>
            </div>
            <hr>
            <div class="receipt-meta">${meta('Mesa', d.mesa)}${meta(d.dateLabel, d.date)}${meta('Orden', d.orden)}</div>
            <hr>
            <table class="receipt-table">
                <colgroup><col><col><col></colgroup>
                <thead><tr><th>Cant</th><th>Producto</th><th class="text-right">Total</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="receipt-summary">
                ${sum('Subtotal', d.subtotal)}
                ${num(d.tip) ? sum('Propina', d.tip) : ''}
                ${sum('Total', d.total, 'total')}
            </div>
            ${d.estimated ? '<p class="receipt-note">Importes por producto no disponibles para esta orden.</p>' : ''}
            <p class="receipt-note">${d.charged ? '¡Gracias por su visita!' : 'Cuenta por pagar. Propina no incluida.'}</p>`;
    };

    // Shared by the "Imprimir" buttons on open and paid table cards. Runs synchronously inside the tap:
    // Safari ignores print requests that come after waiting for something.
    App.printReceipt = table => {
        const data = receiptData(table);
        // iOS home-screen apps can't print. Open the receipt as a normal page (it can't read this
        // app's storage on iOS, so the data travels in the link) and print it from there.
        if (window.navigator.standalone === true) {
            window.open(`recibo.html#${encodeURIComponent(JSON.stringify(data))}`, '_blank');
            return;
        }
        let area = document.getElementById('print-area');
        if (!area) {
            area = document.createElement('div');
            area.id = 'print-area';
            document.body.appendChild(area);
        }
        area.innerHTML = App.receiptHtml(data);
        window.print();
    };
})();
