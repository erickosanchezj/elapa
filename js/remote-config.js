// /js/remote-config.js
// Central config (option A): reads prices, products, promo, late time, shortcuts and templates
// from the private config.json served by the Cloudflare Worker, and overlays them on local data.
// RELEVANT FILES: app.js, ../precios.html, ../cloudflare/config-worker/worker.js, ../cloudflare/config-worker/README.md
(function () {
    'use strict';
    const App = window.TaqueriaApp;
    const SOURCE_KEY = 'tacos_config_source';   // { url, key } entered once on precios.html
    const CACHE_KEY = 'tacos_remote_config';    // { fetchedAt, data }: last good copy, used offline
    const ERROR_KEY = 'tacos_remote_config_error'; // { at, message } from the last failed update
    const CATEGORIES = ['tacos', 'bebidas', 'postres', 'otros'];
    const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
    const write = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };
    const when = ms => new Date(ms).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    // Check the file before using it. Unknown keys are ignored; a bad value rejects the whole file.
    function validate(d) {
        const fail = msg => { throw new Error(msg); };
        const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
        const plain = v => v && typeof v === 'object' && !Array.isArray(v);
        if (!plain(d)) fail('el archivo no es un objeto JSON');
        const out = {};
        if ('prices' in d) {
            if (!plain(d.prices) || Object.values(d.prices).some(v => typeof v !== 'number' || !(v >= 0))) fail('"prices" debe tener precios ≥ 0');
            out.prices = { ...d.prices };
        }
        if ('items' in d) {
            if (!Array.isArray(d.items) || d.items.some(i => !plain(i) || typeof i.id !== 'string' || !i.id || typeof i.label !== 'string' || !i.label.trim())) fail('"items" necesita id y label en cada producto');
            out.items = d.items.map(i => ({ id: i.id, label: i.label.trim(), category: CATEGORIES.includes(i.category) ? i.category : 'otros' }));
        }
        if ('promoOn' in d) { if (typeof d.promoOn !== 'boolean') fail('"promoOn" debe ser true o false'); out.promoOn = d.promoOn; }
        if ('lateMinutes' in d) { if (!isInt(d.lateMinutes, 5, 600)) fail('"lateMinutes" debe ser un entero entre 5 y 600'); out.lateMinutes = d.lateMinutes; }
        if ('quickPresets' in d) {
            if (!Array.isArray(d.quickPresets) || d.quickPresets.some(p => !plain(p) || typeof p.itemId !== 'string' || !isInt(p.qty, 1, 99))) fail('"quickPresets" necesita itemId y qty (1–99)');
            out.quickPresets = d.quickPresets.map(p => ({ itemId: p.itemId, qty: p.qty }));
        }
        if ('tableTemplates' in d) {
            const okOrder = o => plain(o) && Object.values(o).every(q => isInt(q, 1, 99));
            if (!Array.isArray(d.tableTemplates) || d.tableTemplates.some(t => !plain(t) || typeof t.name !== 'string' || !t.name.trim() || !okOrder(t.order || {}))) fail('"tableTemplates" necesita name y order con cantidades (1–99)');
            out.tableTemplates = d.tableTemplates.map(t => ({ name: t.name.trim(), note: typeof t.note === 'string' ? t.note : '', order: { ...(t.order || {}) } }));
        }
        return out;
    }

    // Overlay the last good copy on local data. app.js calls this at the end of App.loadState().
    App.applyRemoteConfig = function () {
        let d;
        try { d = validate(read(CACHE_KEY)?.data); } catch { return; }
        const S = App.AppState;
        if (d.items) { // the file's list is the product list; base products always stay
            const byId = Object.fromEntries(S.items.map(i => [i.id, i]));
            S.items = [...d.items.map(i => ({ base: false, emoji: '', ...byId[i.id], ...i })),
                ...S.items.filter(i => i.base && !d.items.some(c => c.id === i.id))];
        }
        if (d.prices) Object.assign(S.prices, d.prices);
        if ('promoOn' in d) S.promoEnabled = d.promoOn;
        if ('lateMinutes' in d) S.lateMinutes = d.lateMinutes;
        if (d.quickPresets) S.quickPresets = d.quickPresets.map((p, i) => ({ id: `central_${i}`, ...p }));
        if (d.tableTemplates) S.tableTemplates = d.tableTemplates.map((t, i) => ({ id: `central_t_${i}`, label: t.name, ...t }));
    };

    // Download a fresh copy. Returns { ok, changed } or { ok: false, message }.
    async function refresh(source = read(SOURCE_KEY)) {
        if (!source?.url || !source?.key) return { ok: false, message: 'sin conectar' };
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 8000);
        try {
            const res = await fetch(source.url, { headers: { 'X-Config-Key': source.key }, cache: 'no-store', signal: abort.signal });
            if (res.status === 401) throw new Error('clave incorrecta');
            if (!res.ok) throw new Error(`el Worker respondió ${res.status}: ${(await res.text()).slice(0, 80)}`);
            let raw;
            try { raw = await res.json(); } catch { throw new Error('la respuesta no es JSON'); }
            const data = validate(raw);
            const changed = JSON.stringify(data) !== JSON.stringify(read(CACHE_KEY)?.data);
            write(CACHE_KEY, { fetchedAt: Date.now(), data });
            write(ERROR_KEY, null);
            return { ok: true, changed };
        } catch (e) {
            const message = e.name === 'AbortError' || e instanceof TypeError ? 'no se pudo contactar al Worker' : e.message;
            write(ERROR_KEY, { at: Date.now(), message });
            return { ok: false, message };
        } finally {
            clearTimeout(timer);
        }
    }

    // Background update on every page load. New values apply on the next screen, never mid-order.
    const background = read(SOURCE_KEY) && navigator.onLine ? refresh() : Promise.resolve(null);
    background.then(r => { if (r?.ok && r.changed) App.toast('Ajustes centrales actualizados. Se aplican al cambiar de pantalla.', 'info', 3500); });

    document.addEventListener('DOMContentLoaded', () => {
        const cached = read(CACHE_KEY);
        let data = null;
        try { data = cached && validate(cached.data); } catch { data = null; }

        // Managed settings stay visible but can't be edited here (inert = no clicks, no focus).
        if (data) {
            const lock = {
                menu: ['#add-item-form', '.prices-screen #items-list'],
                promoOn: ['#promo-toggle'],
                lateMinutes: ['#late-minutes'],
                quickPresets: ['#shortcut-editor', '#add-shortcut'],
                tableTemplates: ['#template-editor', '#add-template'],
            };
            const managed = Object.keys(data).map(k => (k === 'prices' || k === 'items') ? 'menu' : k);
            [...new Set(managed)].forEach(key => {
                document.body.classList.add(`managed-${key}`); // menu.html hides add/edit buttons via CSS
                (lock[key] || []).forEach(sel => document.querySelectorAll(sel).forEach(el => { el.inert = true; el.classList.add('is-managed'); }));
            });
            const heading = document.querySelector('.prices-screen .page-heading, .catalog-screen .page-heading');
            if (heading) {
                const banner = document.createElement('p');
                banner.className = 'managed-banner';
                banner.textContent = `Algunos ajustes vienen de la configuración central (GitHub) y aquí no se pueden editar. Actualizada: ${when(cached.fetchedAt)}`;
                heading.after(banner);
            }
        }

        // Connect / disconnect panel on precios.html.
        const form = document.getElementById('central-form');
        if (!form) return;
        const status = document.getElementById('central-status');
        const disconnect = document.getElementById('central-disconnect');
        const source = read(SOURCE_KEY);
        form.elements.centralUrl.value = source?.url || '';
        form.elements.centralKey.placeholder = source ? 'Guardada en este dispositivo' : '';
        form.elements.centralKey.required = !source;
        disconnect.hidden = !source;
        // Status line; shown again once the background update above finishes.
        const showStatus = () => {
            const copy = read(CACHE_KEY);
            const error = read(ERROR_KEY);
            status.textContent = !source ? 'Sin conectar: se usan los ajustes de este dispositivo.'
                : error && (!copy || error.at >= copy.fetchedAt) ? `No se pudo actualizar (${error.message}).${copy ? ` Se usa la copia del ${when(copy.fetchedAt)}` : ''}`
                : copy ? `Conectada. Actualizada: ${when(copy.fetchedAt)}` : 'Conectada. Esperando la primera actualización.';
        };
        showStatus();
        background.then(showStatus);

        form.addEventListener('submit', async event => {
            event.preventDefault();
            const url = form.elements.centralUrl.value.trim();
            const key = form.elements.centralKey.value || source?.key || '';
            if (!/^https:\/\//.test(url) && !/^http:\/\/localhost(:\d+)?\//.test(url)) return App.toast('La dirección debe empezar con https://', 'error');
            status.textContent = 'Conectando…';
            const result = await refresh({ url, key });
            if (!result.ok) { status.textContent = `No se pudo conectar: ${result.message}.`; return; }
            write(SOURCE_KEY, { url, key }); // saved only after a successful download
            App.toast('Configuración central conectada', 'success');
            setTimeout(() => location.reload(), 600); // reload to apply and lock the managed settings
        });

        disconnect.addEventListener('click', () => {
            if (!confirm('¿Desconectar la configuración central? Los ajustes actuales se quedan en este dispositivo y vuelven a ser editables.')) return;
            App.loadState(); // includes the central values...
            App.persist();   // ...so they stay saved on this device after disconnecting
            [SOURCE_KEY, CACHE_KEY, ERROR_KEY].forEach(k => write(k, null));
            location.reload();
        });
    });
})();
