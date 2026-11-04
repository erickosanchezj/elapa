// /js/trompo.js
// Fills trompo.html: total pastor tacos in open tables, the mix of options, and each table oldest first.
// Lets whoever slices the pastor see what's pending; refreshes every 15 s and when the screen returns.
// RELEVANT FILES: ../trompo.html, app.js, floor.js, report-layout.css
document.addEventListener('DOMContentLoaded', () => {
    const App = window.TaqueriaApp;
    const PASTOR = 'taco_pastor';
    const $ = id => document.getElementById(id);
    const esc = App.escapeHTML;
    const minutes = ms => Math.max(0, Math.floor((Date.now() - (ms || Date.now())) / 60000));

    function render() {
        App.loadState(); // re-read: tables change on other screens
        const tables = App.AppState.tables
            .filter(t => !t.charged && (t.order || {})[PASTOR] > 0)
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); // oldest first
        const total = tables.reduce((sum, t) => sum + t.order[PASTOR], 0);

        // Same options added up across tables: "6 normales · 3 Sin Cebolla".
        const mix = {};
        tables.forEach(t => {
            const qty = t.order[PASTOR];
            const groups = App.modGroups(t.modifiers, PASTOR, qty);
            groups.forEach(g => { const key = g.mods.join(', '); mix[key] = (mix[key] || 0) + g.qty; });
            const rest = qty - groups.reduce((sum, g) => sum + g.qty, 0);
            if (rest > 0) mix[''] = (mix[''] || 0) + rest;
        });
        const mixText = Object.entries(mix).sort((a, b) => b[1] - a[1])
            .map(([mods, n]) => `${n} ${mods || (n === 1 ? 'normal' : 'normales')}`).join(' · ');

        $('trompo-count').textContent = total;
        $('trompo-mix').textContent = mixText;
        $('trompo-updated').textContent = `Tacos de pastor en mesas abiertas · actualizado ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
        $('trompo-tables').innerHTML = tables.length ? `<table class="report-table"><thead><tr><th>Mesa</th><th class="num">Pastor</th><th>Opciones</th><th class="num">Tiempo</th></tr></thead><tbody>${
            tables.map(t => {
                const qty = t.order[PASTOR];
                const late = minutes(t.createdAt) >= App.AppState.lateMinutes;
                return `<tr${late ? ' class="is-late"' : ''}><td>${esc(t.name)}</td><td class="num">${qty}</td>
                    <td>${esc(App.describeMods(App.modGroups(t.modifiers, PASTOR, qty), qty) || 'Normales')}</td>
                    <td class="num">${minutes(t.createdAt)} min</td></tr>`;
            }).join('')}</tbody></table>`
            : '<p class="subtle">No hay pastor pendiente en mesas abiertas.</p>';
    }

    render();
    setInterval(render, 15000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') render(); });
    window.addEventListener('storage', render); // another tab changed the tables
});
