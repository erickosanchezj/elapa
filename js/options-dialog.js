// /js/options-dialog.js
// The ticket's "Editar producto" dialog: quantity plus option groups ("2 Sin Cebolla · 2 normales").
// Lets one order line carry different options per taco without changing prices or order totals.
// RELEVANT FILES: ticket.js, ../ticket.html, app.js, ui.js
(function () {
    'use strict';
    const App = window.TaqueriaApp;
    // Options offered per category. Products in other categories show no options.
    const OPTIONS = {
        tacos: ['Con Todo', 'Sin Cebolla', 'Sin Piña', 'Sin Verdura', 'Tortilla Harina'],
        bebidas: ['Con Hielo', 'Sin Hielo', 'Limón'],
    };

    document.addEventListener('DOMContentLoaded', () => {
        const $ = id => document.getElementById(id);
        const modal = $('modifier-modal');
        const optionsBox = $('modal-options');
        let qty = 1, applyCount = 1, groups = [], onSave = null;

        const used = () => groups.reduce((sum, g) => sum + g.qty, 0);
        const checked = () => [...optionsBox.querySelectorAll('input:checked')].map(c => c.value);

        // Quantity can drop below the grouped tacos: shrink the last groups to fit.
        function fitGroups() {
            let extra = used() - qty;
            for (let i = groups.length - 1; i >= 0 && extra > 0; i--) {
                const cut = Math.min(groups[i].qty, extra);
                groups[i].qty -= cut;
                extra -= cut;
            }
            groups = groups.filter(g => g.qty > 0);
        }

        function render() {
            fitGroups();
            const free = qty - used();
            applyCount = Math.min(Math.max(applyCount, 1), Math.max(free, 1));
            $('modal-qty-val').textContent = qty;
            $('apply-val').textContent = applyCount;
            $('apply-of').textContent = `de ${free}`;
            $('apply-btn').disabled = free < 1;
            $('apply-minus').disabled = applyCount <= 1;
            $('apply-plus').disabled = applyCount >= free;
            const rows = groups.map((g, i) => `<div class="option-group"><span>${g.qty} × ${App.escapeHTML(g.mods.join(', '))}</span>
                <button type="button" class="table-close" data-remove="${i}">Quitar</button></div>`);
            if (groups.length && free > 0) rows.push(`<p class="subtle">${free} ${free === 1 ? 'normal' : 'normales'}</p>`);
            $('modal-groups').innerHTML = rows.join('');
        }

        // Turn the ticked options into a group of `applyCount` tacos; same options merge into one group.
        function addGroup() {
            const mods = checked();
            if (!mods.length) return App.toast('Elige al menos una opción', 'error');
            const free = qty - used();
            if (free < 1) return App.toast('Todos ya tienen opciones; quita un grupo primero', 'error');
            const count = Math.min(applyCount, free);
            const same = groups.find(g => g.mods.join('|') === mods.join('|'));
            if (same) same.qty += count; else groups.push({ qty: count, mods });
            optionsBox.querySelectorAll('input').forEach(c => { c.checked = false; });
            applyCount = qty - used();
            render();
        }

        $('modal-qty-minus').onclick = () => { if (qty > 0) { qty--; render(); } };
        $('modal-qty-plus').onclick = () => { qty++; render(); };
        $('apply-minus').onclick = () => { applyCount--; render(); };
        $('apply-plus').onclick = () => { applyCount++; render(); };
        $('apply-btn').onclick = addGroup;
        $('modal-groups').onclick = e => {
            const btn = e.target.closest('[data-remove]');
            if (btn) { groups.splice(Number(btn.dataset.remove), 1); render(); }
        };
        $('modal-close').onclick = () => modal.classList.add('hidden');
        $('modal-update-btn').onclick = () => {
            // Ticked but not yet added: apply them, so "tick + Guardar" works as before.
            if (checked().length) {
                if (qty - used() < 1) return App.toast('Todos ya tienen opciones; quita un grupo primero', 'error');
                addGroup();
            }
            modal.classList.add('hidden');
            onSave(qty, groups);
        };

        // ticket.js calls this with the line's current quantity and groups; callback gets (qty, groups).
        App.openOptionsDialog = (item, currentQty, currentGroups, callback) => {
            onSave = callback;
            qty = currentQty;
            groups = currentGroups.map(g => ({ qty: g.qty, mods: [...g.mods] }));
            applyCount = qty - used();
            const options = OPTIONS[item.category || 'otros'] || [];
            $('modal-title').textContent = `Editar ${item.label}`;
            $('modal-options-set').hidden = !options.length;
            $('modal-no-options').hidden = options.length > 0;
            optionsBox.innerHTML = options.map(opt => `<label class="modifier-option"><input type="checkbox" value="${opt}"><span>${opt}</span></label>`).join('');
            render();
            modal.classList.remove('hidden');
        };
    });
})();
