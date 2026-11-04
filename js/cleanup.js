// /js/cleanup.js
// "Liberar espacio" on reporte.html: removes paid tables older than 6 or 12 months from this device.
// Browser storage is ~5 MB; it only removes tables an earlier-day cloud backup really contains, after a fresh backup.
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
        const preview = oldTables().length;
        if (!preview || !confirm(`¿Quitar ${preview} mesas cobradas antes del ${short(cutoff())} de este dispositivo? Primero se guarda un respaldo.`)) return;
        run.disabled = true;
        try {
            // Today's backup file is overwritten during the day, so removed tables must be in a backup of this
            // device from an earlier day (never overwritten). Check its contents, not just its name.
            status.textContent = 'Revisando respaldos…';
            const mine = App.backup.deviceId();
            const earlier = (await App.backup.list())
                .filter(f => f.name.includes(mine) && f.name.slice(0, 10) < day(Date.now()))
                .sort((x, y) => y.name.localeCompare(x.name));
            if (!earlier.length) throw new Error('aún no hay un respaldo de este dispositivo de un día anterior; inténtalo mañana');
            const kept = await App.backup.get(earlier[0].name);
            let keptIds;
            try { keptIds = new Set(JSON.parse(kept.data.tacos_tables || '[]').map(t => t.id)); } catch { keptIds = new Set(); }

            status.textContent = 'Respaldando…';
            const result = await App.backup.now(true);
            if (!result.ok) throw new Error(result.message);

            // Re-read storage: another screen or tab may have changed tables while we waited.
            App.loadState();
            const candidates = oldTables();
            const ids = new Set(candidates.filter(t => keptIds.has(t.id)).map(t => t.id));
            const notBackedUp = candidates.length - ids.size;
            if (!ids.size) throw new Error(`el respaldo del ${short(new Date(`${earlier[0].name.slice(0, 10)}T12:00:00`).getTime())} no tiene esas mesas; inténtalo mañana`);
            App.AppState.tables = App.AppState.tables.filter(t => !ids.has(t.id));
            App.persist();
            App.renderReportPage();
            status.textContent = `Se quitaron ${ids.size} ${ids.size === 1 ? 'mesa' : 'mesas'}; siguen en el respaldo del ${short(new Date(`${earlier[0].name.slice(0, 10)}T12:00:00`).getTime())}.`
                + (notBackedUp ? ` ${notBackedUp} ${notBackedUp === 1 ? 'mesa se quedó' : 'mesas se quedaron'} porque aún no ${notBackedUp === 1 ? 'está' : 'están'} en un respaldo anterior.` : '');
            App.toast('Espacio liberado', 'success');
        } catch (e) {
            status.textContent = `No se liberó espacio (${e.message}).`;
        } finally {
            show();
        }
    });
    show();
});
