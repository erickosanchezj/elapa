// /js/templates.js
// Shows saved table templates (e.g. "Brendos") inside the floor plan's "Abrir mesa" sheet.
// One tap opens a dated table with the template's note and order, so regular customers are seated fast.
// RELEVANT FILES: ../index.html, floor.js, table-sheet.js, presets-editor.js
(function () {
    'use strict';
    const App = window.TaqueriaApp;
    const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // "Brendos" becomes "Brendos-Nov4", so repeat visits stay easy to tell apart.
    const datedName = base => {
        const d = new Date();
        return `${base}-${MONTHS[d.getMonth()]}${d.getDate()}`;
    };

    // Runs after floor.js (script order in index.html), so the saved data is already loaded.
    document.addEventListener('DOMContentLoaded', () => {
        const section = document.getElementById('template-section');
        const list = document.getElementById('template-list');
        if (!section || !list) return;

        const templates = App.AppState.tableTemplates.filter(t => t && t.name);
        section.hidden = templates.length === 0;
        list.innerHTML = templates.map(t => {
            const count = Object.values(t.order || {}).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
            return `<button type="button" class="button" data-template="${App.escapeHTML(t.id)}">${App.escapeHTML(t.name)} · ${count}</button>`;
        }).join('');

        list.addEventListener('click', event => {
            const button = event.target.closest('[data-template]');
            const tpl = button && templates.find(t => t.id === button.dataset.template);
            if (!tpl) return;

            // Keep only products that still exist; leave out sold-out ones and say so.
            const order = {};
            const skipped = [];
            Object.entries(tpl.order || {}).forEach(([itemId, qty]) => {
                const item = App.AppState.items.find(i => i.id === itemId);
                if (!item || !(qty > 0)) return;
                if (App.isInStock(itemId)) order[itemId] = qty;
                else skipped.push(item.label);
            });

            const table = {
                id: App.uid(), name: datedName(tpl.name), note: tpl.note || '', order, modifiers: {},
                charged: false, paidAt: null, createdAt: Date.now(), openDurationMs: null, tip: 0
            };
            App.AppState.tables.push(table);
            App.persist();
            document.getElementById('table-sheet').close();
            App.renderFloor();
            App.toast(skipped.length
                ? `${table.name} abierta. Agotado: ${skipped.join(', ')}`
                : `${table.name} abierta con su orden`, skipped.length ? 'info' : 'success', 3000);
        });
    });
})();
