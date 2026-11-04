// /js/report.js
// Shows today's sales report when the app opens from the "Ver Reporte del Día" shortcut.
// The manifest shortcut points to index.html?action=showReport; this file answers it.
// RELEVANT FILES: ../index.html, app.js, floor.js, ../manifest.webmanifest
document.addEventListener('DOMContentLoaded', () => {
    const App = window.TaqueriaApp;
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') !== 'showReport') return;

    const sheet = document.getElementById('report-sheet');
    const body = document.getElementById('report-body');
    document.getElementById('report-close').addEventListener('click', () => sheet.close());

    // floor.js already loaded the saved data; this reads the same AppState.
    const report = App.computeDailyReport();
    const row = (label, value) => `<div><dt>${App.escapeHTML(label)}</dt><dd>${value}</dd></div>`;

    // Products sold today, most sold first.
    const sold = Object.entries(report.itemCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([id, qty]) => {
            const item = App.AppState.items.find(i => i.id === id);
            return row(`${qty}× ${item?.label || id}`, App.money(report.itemRevenue[id]));
        }).join('');

    const unpaid = report.unpaidTablesToday
        .map(t => row(t.name, App.money(t.total))).join('');

    body.innerHTML = `
        <div class="closed-order">
            <dl>
                ${row('Mesas cobradas', report.tablesCount)}
                ${row('Ventas', App.money(report.totalSubtotals))}
                ${row('Propinas', App.money(report.totalTips))}
                <div class="closed-total"><dt>Total</dt><dd>${App.money(report.totalSubtotals + report.totalTips)}</dd></div>
            </dl>
            <h3 class="subtle">Productos vendidos</h3>
            ${sold ? `<dl>${sold}</dl>` : '<p class="subtle">Aún no hay ventas hoy.</p>'}
            <h3 class="subtle">Mesas sin cobrar</h3>
            ${unpaid ? `<dl>${unpaid}</dl>` : '<p class="subtle">No hay mesas abiertas de hoy.</p>'}
        </div>`;

    // Clean the URL so a refresh shows the normal floor plan.
    history.replaceState(null, '', 'index.html');
    sheet.showModal();
});
