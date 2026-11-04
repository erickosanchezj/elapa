// /js/cleanup.js
// "Liberar espacio" on reporte.html: removes paid tables older than 6 or 12 months from this device.
// Browser storage is ~5 MB; it only runs when an earlier-day cloud backup exists and a fresh backup succeeds.
// RELEVANT FILES: ../reporte.html, backup.js, report-page.js, app.js
document.addEventListener('DOMContentLoaded', () => {
    const App = window.TaqueriaApp;
    const $ = id => document.getElementById(id);
    const age = $('cleanup-age'), count = $('cleanup-count'), run = $('cleanup-run'), status = $('cleanup-status');
    const connected = () => { try { return Boolean(localStorage.getItem('tacos_config_source')); } catch { return false; } };
    const day = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const short = ms => new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

    // Paid tables paid before this date (midnight, 6 or 12 months ago). Open tables never count.
    const cutoff = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() - Number(age.value)); return d.getTime(); };
    const oldTables = () => App.AppState.tables.filter(t => t.charged && (t.paidAt || 0) < cutoff());

    function show() {
        const n = oldTables().length;
        count.textContent = n ? `${n} ${n === 1 ? 'mesa cobrada' : 'mesas cobradas'} antes del ${short(cutoff())}.` : `No hay mesas cobradas antes del ${short(cutoff())}.`;
        run.disabled = !n || !connected();
        if (!connected()) status.textContent = 'Para liberar espacio de forma segura, conecta la configuración central y sus respaldos (Precios).';
    }
    age.addEventListener('change', show);

    run.addEventListener('click', async () => {
        const remove = oldTables();
        if (!remove.length || !confirm(`¿Quitar ${remove.length} mesas cobradas antes del ${short(cutoff())} de este dispositivo? Primero se guarda un respaldo.`)) return;
        run.disabled = true;
        try {
            // Today's backup file is overwritten during the day, so the removed tables must also be in a
            // backup from an earlier day (those files are never overwritten).
            status.textContent = 'Revisando respaldos…';
            const mine = App.backup.deviceId();
            const files = await App.backup.list();
            if (!files.some(f => f.name.includes(mine) && f.name.slice(0, 10) < day(Date.now()))) {
                throw new Error('aún no hay un respaldo de este dispositivo de un día anterior; inténtalo mañana');
            }
            status.textContent = 'Respaldando…';
            const result = await App.backup.now(true);
            if (!result.ok) throw new Error(result.message);
            const ids = new Set(remove.map(t => t.id));
            App.AppState.tables = App.AppState.tables.filter(t => !ids.has(t.id));
            App.persist();
            App.renderReportPage();
            status.textContent = `Se quitaron ${remove.length} mesas. Siguen en tus respaldos anteriores de GitHub.`;
            App.toast('Espacio liberado', 'success');
        } catch (e) {
            status.textContent = `No se liberó espacio (${e.message}).`;
        } finally {
            show();
        }
    });
    show();
});
