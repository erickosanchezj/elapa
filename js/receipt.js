// /js/receipt.js
// Builds a printable receipt for one table and opens the browser's print dialog.
// Open tables print a pre-bill ("Cuenta"); paid tables print the final ticket with tip.
// RELEVANT FILES: receipt.css, floor.js, app.js, ../index.html
(function () {
    'use strict';
    const App = window.TaqueriaApp;

    function receiptHtml(table) {
        const esc = App.escapeHTML;
        const entries = Object.entries(table.order || {}).filter(([, qty]) => qty > 0);
        // Charged amounts per line (app.js). Older paid orders never saved them, so their lines
        // print without amounts instead of showing today's prices as if they were charged.
        const lines = App.lineAmounts(table);
        const rows = entries.length ? entries.map(([itemId, qty]) => {
            const item = App.AppState.items.find(i => i.id === itemId);
            const mods = table.modifiers?.[itemId] || [];
            const modsHtml = mods.length ? `<span class="receipt-mods">${esc(mods.join(', '))}</span>` : '';
            return `<tr><td>${qty}x</td><td>${esc(item?.label || itemId)}${modsHtml}</td>
                <td class="price">${lines.estimated ? '' : App.money(lines.amounts[itemId])}</td></tr>`;
        }).join('') : '<tr><td class="receipt-empty" colspan="3">Sin productos</td></tr>';

        const subtotal = App.computeTableTotal(table);
        const tip = table.charged ? (table.tip || 0) : 0;
        const date = ms => new Date(ms).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
        const meta = (label, value) => `<div class="receipt-meta-row"><span class="receipt-meta-label">${label}</span><span>${esc(value)}</span></div>`;
        const sum = (label, value, cls = '') => `<div class="receipt-summary-row ${cls}"><span>${label}</span><span>${App.money(value)}</span></div>`;

        return `
            <div class="receipt-brand">
                <img src="icons/icon-192.png" alt="" class="receipt-brand-logo">
                <h1 class="receipt-brand-name">Taquería "El Apá"</h1>
                <p class="receipt-brand-tagline">Sabor auténtico cada día</p>
            </div>
            <hr>
            <div class="receipt-meta">
                ${meta('Mesa', table.name)}
                ${meta(table.charged ? 'Pagada' : 'Fecha', date(table.charged ? table.paidAt : Date.now()))}
                ${meta('Orden', '#' + table.id.slice(-4).toUpperCase())}
            </div>
            <hr>
            <table class="receipt-table">
                <colgroup><col><col><col></colgroup>
                <thead><tr><th>Cant</th><th>Producto</th><th class="text-right">Total</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="receipt-summary">
                ${sum('Subtotal', subtotal)}
                ${tip ? sum('Propina', tip) : ''}
                ${sum('Total', subtotal + tip, 'total')}
            </div>
            ${lines.estimated ? '<p class="receipt-note">Importes por producto no disponibles para esta orden.</p>' : ''}
            <p class="receipt-note">${table.charged ? '¡Gracias por su visita!' : 'Cuenta por pagar. Propina no incluida.'}</p>`;
    }

    // Shared by the "Imprimir" buttons on open and paid table cards.
    App.printReceipt = async table => {
        let area = document.getElementById('print-area');
        if (!area) {
            area = document.createElement('div');
            area.id = 'print-area';
            document.body.appendChild(area);
        }
        area.innerHTML = receiptHtml(table);
        // Wait for the logo so it is not missing on paper; print anyway if it fails.
        await area.querySelector('img').decode().catch(() => {});
        window.print();
    };
})();
