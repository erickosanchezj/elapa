// /js/report-page.js
// Fills reporte.html: period filter, KPIs, sales by hour, products, 2x1 promo cost,
// unpaid tables, last 6 months, CSV export and storage use.
// RELEVANT FILES: ../reporte.html, app.js, report-charts.js, report-layout.css
document.addEventListener('DOMContentLoaded', () => {
    const App = window.TaqueriaApp;
    App.loadState();
    const $ = id => document.getElementById(id);
    const esc = App.escapeHTML;
    const DAY = 864e5;
    const midnight = d => new Date(d).setHours(0, 0, 0, 0);
    const short = ms => new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    const hhmm = ms => { const m = Math.round(ms / 60000); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
    const isoDay = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    let period = 'hoy';

    // [start, end) for the selected period. Weeks start on Monday.
    function range() {
        const today = midnight(Date.now());
        if (period === 'ayer') return [today - DAY, today, `Ayer, ${short(today - DAY)}`];
        if (period === 'semana') { const start = today - ((new Date(today).getDay() + 6) % 7) * DAY; return [start, today + DAY, `Semana del ${short(start)} al ${short(today)}`]; }
        if (period === 'mes') { const start = new Date(today).setDate(1); return [start, today + DAY, `${short(start)} al ${short(today)}`]; }
        if (period === 'dia' && $('report-day').value) { const [y, m, d] = $('report-day').value.split('-').map(Number); const start = new Date(y, m - 1, d).getTime(); return [start, start + DAY, short(start)]; }
        return [today, today + DAY, `Hoy, ${short(today)}`];
    }

    function render() {
        const [start, end, label] = range();
        const r = App.computeReport(start, end);
        $('report-period-label').textContent = label;
        document.querySelectorAll('[data-period]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.period === period)));

        // KPIs
        const total = r.totalSubtotals + r.totalTips;
        const tiles = [['Ventas', App.money(r.totalSubtotals)], ['Propinas', App.money(r.totalTips)], ['Total cobrado', App.money(total)],
            ['Mesas cobradas', r.tablesCount], ['Ticket promedio', App.money(r.tablesCount ? r.totalSubtotals / r.tablesCount : 0)],
            ['Tiempo promedio', hhmm(r.tablesCount ? r.durationMs / r.tablesCount : 0)]];
        $('report-kpis').innerHTML = tiles.map(([k, v]) => `<div class="report-kpi"><dt>${k}</dt><dd>${v}</dd></div>`).join('');

        // Sales by hour: only the hours between the first and last sale.
        const hours = r.byHour.map((v, h) => ({ h, v })).filter(x => x.v > 0).map(x => x.h);
        if (!hours.length) $('report-hours').innerHTML = '<p class="subtle">Sin ventas en este periodo.</p>';
        else {
            const data = [];
            for (let h = Math.min(...hours); h <= Math.max(...hours); h++) {
                data.push({ label: `${h}:00`, value: r.byHour[h], detail: `${App.money(r.byHour[h])} · ${r.tablesByHour[h]} ${r.tablesByHour[h] === 1 ? 'mesa' : 'mesas'}` });
            }
            App.renderColumns($('report-hours'), data, 'Ventas por hora');
        }

        // Products sold, by revenue
        const rows = Object.entries(r.itemRevenue).sort((a, b) => b[1] - a[1]).map(([id, amount]) => {
            const item = App.AppState.items.find(i => i.id === id);
            const share = r.totalSubtotals ? Math.round(amount / r.totalSubtotals * 100) : 0;
            return `<tr><td>${esc(item?.label || id)}</td><td class="num">${r.itemCounts[id]}</td><td class="num">${App.money(amount)}</td><td class="num">${share}%</td></tr>`;
        }).join('');
        $('report-products').innerHTML = rows
            ? `<table class="report-table"><thead><tr><th>Producto</th><th class="num">Cantidad</th><th class="num">Importe</th><th class="num">%</th></tr></thead><tbody>${rows}</tbody></table>`
              + (r.estimated ? '<p class="subtle">Algunos importes son aproximados: órdenes cobradas antes de guardar importes por producto.</p>' : '')
            : '<p class="subtle">Sin productos vendidos.</p>';

        // 2x1 promo cost
        $('report-promo').innerHTML = r.promo.qty
            ? `<p><strong>${r.promo.qty} tacos de pastor gratis</strong> (≈ ${App.money(r.promo.value)}) en ${r.promo.days.size} ${r.promo.days.size === 1 ? 'día' : 'días'} de promo.</p>`
            : '<p class="subtle">No se regalaron tacos por la promo en este periodo.</p>';

        // Open tables created in the period
        $('report-unpaid').innerHTML = r.unpaidTables.length
            ? `<table class="report-table"><tbody>${r.unpaidTables.map(t => `<tr><td>${esc(t.name)}</td><td class="num">${App.money(t.total)}</td></tr>`).join('')}</tbody></table>`
            : '<p class="subtle">No hay mesas sin cobrar de este periodo.</p>';

        $('report-export').onclick = () => exportCsv(r, start, end);
    }

    // One row per paid table. "'" in front of =,+,-,@ stops spreadsheets from running it as a formula.
    function exportCsv(r, start, end) {
        const cell = v => { let s = String(v); if (/^[=+\-@]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
        const lines = [['Fecha', 'Hora', 'Mesa', 'Productos', 'Subtotal', 'Propina', 'Total']];
        [...r.tables].sort((a, b) => a.paidAt - b.paidAt).forEach(t => {
            const d = new Date(t.paidAt);
            const products = Object.entries(t.order || {}).filter(([, q]) => q > 0).map(([id, q]) => {
                const mods = App.describeMods(App.modGroups(t.modifiers, id, q), q);
                return `${q}× ${App.AppState.items.find(i => i.id === id)?.label || id}${mods ? ` (${mods})` : ''}`;
            }).join(', ');
            const sub = App.computeTableTotal(t), tip = t.tip || 0;
            lines.push([d.toLocaleDateString('es-MX'), d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }), t.name, products, sub.toFixed(2), tip.toFixed(2), (sub + tip).toFixed(2)]);
        });
        const csv = '﻿' + lines.map(l => l.map(cell).join(',')).join('\r\n'); // BOM so Excel reads accents
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `reporte-${isoDay(start)}_a_${isoDay(end - 1)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    // Last 6 months (fixed range, not tied to the period filter).
    function renderMonths() {
        const months = App.computeMonthlyTimeline(6);
        if (!months.some(m => m.subtotal > 0)) { $('report-months').innerHTML = '<p class="subtle">Aún no hay ventas guardadas.</p>'; return; }
        App.renderColumns($('report-months'), months.map(m => ({ label: m.label, value: m.subtotal,
            detail: `${App.money(m.subtotal)} ventas · ${App.money(m.tips)} propinas · ${m.tablesCount} ${m.tablesCount === 1 ? 'mesa' : 'mesas'}` })), 'Ventas de los últimos 6 meses');
    }

    // Browser storage is about 5 MB per site; warn before it fills up.
    function renderStorage() {
        let chars = 0;
        try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); chars += k.length + (localStorage.getItem(k) || '').length; } } catch { return; }
        const pct = Math.min(100, Math.round(chars / 5e6 * 100));
        const used = chars < 1e5 ? `${Math.max(1, Math.round(chars / 1e3))} KB` : `${(chars / 1e6).toFixed(1)} MB`;
        $('report-storage').innerHTML = `<p>${App.AppState.tables.length} mesas guardadas · ${used} de ≈5 MB (${pct}%).</p>
            <div class="report-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Uso del almacenamiento"><span style="width:${pct}%"></span></div>
            ${pct >= 70 ? '<p class="report-warning">El espacio se está llenando. Exporta tus reportes en CSV para guardarlos.</p>' : ''}`;
    }

    document.querySelectorAll('[data-period]').forEach(b => b.addEventListener('click', () => { period = b.dataset.period; render(); }));
    $('report-day').max = isoDay(Date.now());
    $('report-day').addEventListener('change', () => { if ($('report-day').value) { period = 'dia'; render(); } });
    render();
    renderMonths();
    renderStorage();
});
