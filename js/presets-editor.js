// /js/presets-editor.js
// Edits quick-order shortcuts ("4 × Pastor") and frequent-table templates ("Brendos") on precios.html.
// Lets staff change them with plain fields instead of code; ticket.js and templates.js read the same data.
// RELEVANT FILES: ../precios.html, app.js, ticket.js, templates.js
document.addEventListener('DOMContentLoaded', () => {
    const App = window.TaqueriaApp;
    const shortcutList = document.getElementById('shortcut-editor');
    const templateList = document.getElementById('template-editor');
    if (!shortcutList || !templateList) return;
    const esc = App.escapeHTML;
    const items = () => App.AppState.items;
    // Save right away; show one "Guardado" after edits pause instead of a toast per field.
    let toastTimer;
    const saved = () => {
        App.persist();
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => App.toast('Guardado', 'info', 1200), 500);
    };
    const countOf = t => Object.values(t.order || {}).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
    const summaryText = t => `${t.name} · ${countOf(t)} productos`;
    const empty = text => `<p class="subtle editor-empty">${text}</p>`;

    // --- Quick-order shortcuts: one row per shortcut (product + quantity). ---
    function renderShortcuts() {
        const presets = App.AppState.quickPresets;
        shortcutList.innerHTML = presets.length ? presets.map(p => `
            <div class="editor-row" data-id="${esc(p.id)}">
                <select data-field="itemId" aria-label="Producto">${items().map(i =>
                    `<option value="${esc(i.id)}"${i.id === p.itemId ? ' selected' : ''}>${esc(i.label)}</option>`).join('')}</select>
                <input data-field="qty" type="number" inputmode="numeric" min="1" step="1" value="${p.qty}" aria-label="Cantidad">
                <button type="button" class="icon-button" data-delete aria-label="Eliminar acceso rápido"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>
            </div>`).join('') : empty('Sin accesos rápidos.');
    }

    shortcutList.addEventListener('change', e => {
        const preset = App.AppState.quickPresets.find(p => p.id === e.target.closest('[data-id]')?.dataset.id);
        if (!preset) return;
        if (e.target.dataset.field === 'itemId') preset.itemId = e.target.value;
        if (e.target.dataset.field === 'qty') {
            const qty = Math.floor(Number(e.target.value));
            if (!(qty >= 1)) { e.target.value = preset.qty; return App.toast('La cantidad debe ser 1 o más', 'error'); }
            preset.qty = qty;
        }
        saved();
    });

    shortcutList.addEventListener('click', e => {
        const id = e.target.closest('[data-delete]') && e.target.closest('[data-id]').dataset.id;
        if (!id || !confirm('¿Eliminar este acceso rápido?')) return;
        App.AppState.quickPresets = App.AppState.quickPresets.filter(p => p.id !== id);
        saved();
        renderShortcuts();
    });

    document.getElementById('add-shortcut').addEventListener('click', () => {
        if (!items().length) return;
        App.AppState.quickPresets.push({ id: App.uid(), itemId: items()[0].id, qty: 2 });
        saved();
        renderShortcuts();
        shortcutList.querySelector('.editor-row:last-child select').focus();
    });

    // --- Frequent tables: a collapsible block per template (name, note, quantity per product). ---
    function renderTemplates(openId) {
        const templates = App.AppState.tableTemplates;
        templateList.innerHTML = templates.length ? templates.map(t => `
            <details class="template-editor-item" data-id="${esc(t.id)}"${t.id === openId ? ' open' : ''}>
                <summary>${esc(summaryText(t))}</summary>
                <div class="template-editor-body">
                    <label><span class="field-label">Nombre (obligatorio)</span><input data-field="name" type="text" maxlength="60" value="${esc(t.name)}" autocomplete="off"></label>
                    <label><span class="field-label">Nota</span><input data-field="note" type="text" maxlength="250" value="${esc(t.note || '')}" autocomplete="off"></label>
                    <div class="template-qty-grid" role="group" aria-label="Productos de ${esc(t.name)}">${items().map(i => `
                        <label><span>${esc(i.label)}</span><input data-item="${esc(i.id)}" type="number" inputmode="numeric" min="0" step="1" value="${(t.order || {})[i.id] || 0}"></label>`).join('')}
                    </div>
                    <button type="button" class="button button-danger" data-delete>Eliminar mesa frecuente</button>
                </div>
            </details>`).join('') : empty('Sin mesas frecuentes.');
    }

    templateList.addEventListener('change', e => {
        const block = e.target.closest('[data-id]');
        const tpl = App.AppState.tableTemplates.find(t => t.id === block?.dataset.id);
        if (!tpl) return;
        const field = e.target.dataset.field;
        if (field === 'name') {
            const name = e.target.value.trim();
            if (!name) { e.target.value = tpl.name; return App.toast('Escribe un nombre', 'error'); }
            tpl.name = tpl.label = name;
        } else if (field === 'note') {
            tpl.note = e.target.value.trim();
        } else if (e.target.dataset.item) {
            const qty = Math.floor(Number(e.target.value));
            tpl.order = tpl.order || {};
            if (qty > 0) tpl.order[e.target.dataset.item] = qty;
            else { delete tpl.order[e.target.dataset.item]; e.target.value = 0; }
        }
        block.querySelector('summary').textContent = summaryText(tpl);
        saved();
    });

    templateList.addEventListener('click', e => {
        if (!e.target.closest('[data-delete]')) return;
        const id = e.target.closest('[data-id]').dataset.id;
        const tpl = App.AppState.tableTemplates.find(t => t.id === id);
        if (!tpl || !confirm(`¿Eliminar la mesa frecuente “${tpl.name}”?`)) return;
        App.AppState.tableTemplates = App.AppState.tableTemplates.filter(t => t.id !== id);
        saved();
        renderTemplates();
    });

    document.getElementById('add-template').addEventListener('click', () => {
        const tpl = { id: App.uid(), name: 'Nueva mesa', label: 'Nueva mesa', note: '', order: {} };
        App.AppState.tableTemplates.push(tpl);
        saved();
        renderTemplates(tpl.id);
        const input = templateList.querySelector(`[data-id="${tpl.id}"] [data-field="name"]`);
        input.focus();
        input.select();
    });

    // precios.js calls this after adding or deleting a product, so the product lists stay current.
    App.renderPresetEditors = () => { renderShortcuts(); renderTemplates(); };
    App.renderPresetEditors();
});
