// /js/receipt.js
// Receipt for one table: a preview image to save or share, and a paper version to print.
// Open tables get a pre-bill ("Cuenta"); paid tables the final ticket with tip.
// RELEVANT FILES: receipt-image.js, receipt.css, floor.js, ../index.html
(function () {
    'use strict';
    const App = window.TaqueriaApp;
    const LOGO = 'icons/icon-192.png';
    new Image().src = LOGO; // preload, so the receipt never has to wait for it (and stays inside the tap)

    // Plain data for one receipt, shared by the image (receipt-image.js) and the paper version.
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

    // Paper receipt markup from that data. Every value is escaped.
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

    // "Imprimir" on table cards opens a preview of the receipt image with:
    //  - "Guardar recibo como imagen": the share sheet (save, AirPrint, printer apps, send) or a download;
    //  - "Imprimir": direct printing, only outside iOS home-screen apps (iOS blocks printing there).
    let current = null; // { data, file, url } for the receipt shown in the preview

    // Paper receipt from the data, printed right inside the tap.
    function printPaper(data) {
        let area = document.getElementById('print-area');
        if (!area) {
            area = document.createElement('div');
            area.id = 'print-area';
            document.body.appendChild(area);
        }
        area.innerHTML = App.receiptHtml(data);
        window.print();
    }

    // The image can fail to export when index.html is opened from disk (file://): the logo then counts
    // as another origin. Try without the logo, and as a last resort print on paper as before.
    function imageFile(data) {
        try { return App.receiptImageFile(data); } catch { /* try without the logo */ }
        try { return App.receiptImageFile(data, { withLogo: false }); } catch { return null; }
    }

    App.printReceipt = table => {
        const sheet = document.getElementById('receipt-sheet');
        if (current) URL.revokeObjectURL(current.url);
        const data = receiptData(table);
        const file = imageFile(data);
        if (!file) { current = null; printPaper(data); return; }
        current = { data, file, url: URL.createObjectURL(file) };
        const img = document.getElementById('receipt-preview');
        img.src = current.url;
        img.alt = `Recibo de ${data.mesa}`;
        document.getElementById('receipt-sheet-title').textContent = `Recibo · ${data.mesa}`;
        document.getElementById('receipt-print-now').hidden = window.navigator.standalone === true;
        sheet.showModal();
    };

    document.addEventListener('DOMContentLoaded', () => {
        const sheet = document.getElementById('receipt-sheet');
        if (!sheet) return;
        document.getElementById('receipt-sheet-close').addEventListener('click', () => sheet.close());
        sheet.addEventListener('close', () => {
            if (current) URL.revokeObjectURL(current.url);
            current = null;
        });

        // A fresh tap, so iOS allows the share sheet. Without image sharing (most computers), download it.
        document.getElementById('receipt-save').addEventListener('click', () => {
            if (!current) return;
            const { file, data } = current;
            if (navigator.canShare?.({ files: [file] })) {
                navigator.share({ files: [file], title: `Recibo ${data.mesa}` }).catch(() => {}); // cancelling is fine
                return;
            }
            const link = document.createElement('a');
            link.href = current.url;
            link.download = file.name;
            link.click();
        });

        document.getElementById('receipt-print-now').addEventListener('click', () => { if (current) printPaper(current.data); });
    });
})();
