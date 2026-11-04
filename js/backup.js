// /js/backup.js
// Automatic cloud backups of this device's data through the config Worker (saved in a private GitHub
// repo), plus restore. Protects the sales history, which otherwise lives only in this browser.
// RELEVANT FILES: app.js, remote-config.js, ../precios.html, ../cloudflare/config-worker/worker.js
(function () {
    'use strict';
    const App = window.TaqueriaApp;
    const SOURCE_KEY = 'tacos_config_source'; // Worker address + device key (remote-config.js)
    const STATE_KEY = 'tacos_backup_state';   // { at, hash, day, name, bytes, error, errorAt }
    const DEVICE_ID_KEY = 'tacos_device_id';
    const EVERY_MS = 20 * 60 * 1000;           // at most one automatic backup every 20 minutes
    // Never backed up or restored: the device key, cached central config and backup bookkeeping.
    const SKIP = ['tacos_config_source', 'tacos_remote_config', 'tacos_remote_config_error', STATE_KEY, DEVICE_ID_KEY];
    const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
    const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full */ } };
    const when = ms => new Date(ms).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const size = n => n < 1e6 ? `${Math.max(1, Math.round(n / 1e3))} KB` : `${(n / 1e6).toFixed(1)} MB`;
    const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const backedUp = k => (k.startsWith('tacos_') || k === 'theme') && !SKIP.includes(k);
    // Leaving a screen cancels an upload in progress: that is not an error worth showing.
    let leaving = false;
    window.addEventListener('pagehide', () => { leaving = true; });

    // Random id per device, so two devices never overwrite each other's backups.
    function deviceId() {
        let id = localStorage.getItem(DEVICE_ID_KEY);
        if (!id) {
            id = 'd-' + [...crypto.getRandomValues(new Uint8Array(5))].map(b => b.toString(36).padStart(2, '0')).join('');
            localStorage.setItem(DEVICE_ID_KEY, id);
        }
        return id;
    }

    // Everything the app saved, as the exact stored strings (sorted so the change check is stable).
    function snapshot() {
        const data = {};
        Object.keys(localStorage).filter(backedUp).sort().forEach(k => { data[k] = localStorage.getItem(k); });
        return data;
    }
    // Small text fingerprint to skip backups when nothing changed.
    const fingerprint = text => { let h = 5381; for (let i = 0; i < text.length; i++) h = (h * 33 + text.charCodeAt(i)) | 0; return `${text.length}:${h}`; };

    // Calls the Worker with the device key. path: 'backup', 'backups' or 'backups/<file>'.
    async function worker(path, options = {}) {
        const source = read(SOURCE_KEY);
        if (!source?.url || !source?.key) throw new Error('conecta primero la configuración central');
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 20000);
        try {
            const base = source.url.endsWith('/') ? source.url : `${source.url}/`;
            const res = await fetch(new URL(path, base), { ...options, signal: abort.signal, cache: 'no-store',
                headers: { 'X-Config-Key': source.key, ...(options.body ? { 'Content-Type': 'application/json' } : {}) } });
            if (res.status === 401) throw new Error('clave incorrecta');
            if (res.status === 501) throw new Error('el Worker no tiene respaldos configurados');
            if (!res.ok) throw new Error(`el Worker respondió ${res.status}: ${(await res.text()).slice(0, 80)}`);
            return res.json();
        } catch (e) {
            throw new Error(e.name === 'AbortError' || e instanceof TypeError ? 'no se pudo contactar al Worker' : e.message);
        } finally {
            clearTimeout(timer);
        }
    }

    // Save today's file for this device. Skips when nothing changed since the last backup today.
    async function backupNow(force = false) {
        const data = snapshot();
        const hash = fingerprint(JSON.stringify(data));
        const state = read(STATE_KEY) || {};
        if (!force && state.hash === hash && state.day === today()) return { ok: true, skipped: true };
        try {
            const result = await worker('backup', { method: 'PUT', body: JSON.stringify({ day: today(), device: deviceId(), savedAt: Date.now(), data }) });
            write(STATE_KEY, { at: Date.now(), hash, day: today(), name: result.name, bytes: result.bytes });
            return { ok: true };
        } catch (e) {
            if (!leaving) write(STATE_KEY, { ...state, error: e.message, errorAt: Date.now() });
            return { ok: false, message: e.message };
        } finally {
            App.onBackupChange?.();
        }
    }

    // Automatic: after saves (debounced), on page load and when the app comes back to the screen.
    let timer = null;
    function maybeBackup() {
        clearTimeout(timer);
        if (!read(SOURCE_KEY) || !navigator.onLine) return;
        const wait = (read(STATE_KEY)?.at || 0) + EVERY_MS - Date.now();
        if (wait > 0) { timer = setTimeout(maybeBackup, wait); return; } // try again when the 20 minutes are up
        backupNow();
    }
    const save = App.persist;
    App.persist = function () { save.apply(this, arguments); clearTimeout(timer); timer = setTimeout(maybeBackup, 30000); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') maybeBackup(); });
    setTimeout(maybeBackup, 5000);

    // Restore: download the chosen file first, then back up current data, then replace and reload.
    async function restore(name) {
        const backup = await worker(`backups/${encodeURIComponent(name)}`);
        const data = backup?.data;
        if (!data || typeof data !== 'object' || Object.values(data).some(v => typeof v !== 'string')) throw new Error('el respaldo no tiene el formato esperado');
        const safety = await backupNow(true); // the replaced data stays in today's file and in GitHub's history
        if (!safety.ok && !confirm(`No se pudo respaldar los datos actuales (${safety.message}). ¿Restaurar de todos modos?`)) return false;
        Object.keys(localStorage).filter(backedUp).forEach(k => localStorage.removeItem(k));
        Object.entries(data).filter(([k]) => backedUp(k)).forEach(([k, v]) => localStorage.setItem(k, v));
        write(STATE_KEY, {}); // back up the restored data on the next page load
        return true;
    }

    // Panel on precios.html.
    document.addEventListener('DOMContentLoaded', () => {
        const status = document.getElementById('backup-status');
        if (!status) return;
        const list = document.getElementById('backup-list');
        const nowButton = document.getElementById('backup-now');
        const restoreButton = document.getElementById('backup-restore');
        const connected = Boolean(read(SOURCE_KEY));
        [nowButton, restoreButton, list].forEach(el => { el.disabled = !connected; });

        App.onBackupChange = () => {
            const s = read(STATE_KEY) || {};
            status.textContent = !connected ? 'Conecta la configuración central para activar los respaldos.'
                : s.error && (!s.at || s.errorAt > s.at) ? `No se pudo respaldar (${s.error}).${s.at ? ` Último respaldo correcto: ${when(s.at)}` : ''}`
                : s.at ? `Último respaldo: ${when(s.at)} · ${size(s.bytes || 0)}` : 'Aún no hay respaldos de este dispositivo.';
        };
        App.onBackupChange();

        async function loadList() {
            try {
                const files = await worker('backups');
                const mine = deviceId();
                list.innerHTML = files.length ? files.map(f => {
                    const [day, device] = f.name.replace('.json', '').split('_');
                    const label = `${new Date(`${day}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })} · ${device === mine ? 'este dispositivo' : `otro dispositivo (${device})`} · ${size(f.size)}`;
                    return `<option value="${App.escapeHTML(f.name)}">${App.escapeHTML(label)}</option>`;
                }).join('') : '<option value="">Aún no hay respaldos</option>';
                restoreButton.disabled = !files.length;
            } catch (e) {
                list.innerHTML = `<option value="">No se pudo cargar la lista</option>`;
                restoreButton.disabled = true;
                status.textContent = `No se pudo cargar la lista (${e.message}).`;
            }
        }
        if (connected) loadList();

        nowButton.addEventListener('click', async () => {
            nowButton.disabled = true;
            status.textContent = 'Respaldando…';
            const r = await backupNow(true);
            nowButton.disabled = false;
            if (r.ok) { App.toast('Respaldo guardado', 'success'); loadList(); }
        });

        restoreButton.addEventListener('click', async () => {
            const name = list.value;
            if (!name || !confirm('¿Restaurar este respaldo? Reemplaza las mesas, ventas y ajustes de este dispositivo. Antes se guarda un respaldo de los datos actuales.')) return;
            restoreButton.disabled = true;
            status.textContent = 'Restaurando…';
            try {
                if (await restore(name)) { App.toast('Respaldo restaurado', 'success'); setTimeout(() => location.reload(), 600); }
                else restoreButton.disabled = false;
            } catch (e) {
                status.textContent = `No se pudo restaurar (${e.message}).`;
                restoreButton.disabled = false;
            }
        });
    });
})();
