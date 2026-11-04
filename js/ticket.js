// js/ticket.js
// Handles the logic for the Ticket Creation screen.
// Allows adding items to a draft order and committing it to a table.
// RELEVANT FILES: ticket.html, js/app.js
document.addEventListener('DOMContentLoaded', () => {
    const App = window.TaqueriaApp;
    if (!App) {
        console.error('TaqueriaApp not initialized');
        return;
    }
    let currentTableId = null;
    let draftOrder = {}; // { itemId: qty }
    let draftMods = {}; // { itemId: [{ qty: 2, mods: ['Sin Cebolla'] }] } — option groups (options-dialog.js)
    let currentCategory = 'tacos'; // Default category
    let tableData = null; // The table object if editing existing
    const els = {
        tableName: document.getElementById('table-name'),
        tableMeta: document.getElementById('table-meta'),
        commitBtn: document.getElementById('commit-btn'),
        commitTotal: document.getElementById('commit-total'),
        categoryNav: document.getElementById('category-nav'),
        productGrid: document.getElementById('product-grid'),
        trayHandle: document.getElementById('tray-handle'),
        trayList: document.getElementById('tray-list'),
        trayCount: document.getElementById('tray-count'),
        trayTotal: document.getElementById('tray-total'),
    };
    function init() {
        App.loadState();
        const urlParams = new URLSearchParams(window.location.search);
        currentTableId = urlParams.get('tableId');
        if (currentTableId) {
            tableData = App.AppState.tables.find(t => t.id === currentTableId);
            if (tableData) {
                draftOrder = { ...tableData.order };
                // Read old one-list saves as a single group (app.js modGroups).
                Object.keys(draftOrder).forEach(id => {
                    const groups = App.modGroups(tableData.modifiers, id, draftOrder[id]);
                    if (groups.length) draftMods[id] = groups;
                });
            } else {
                currentTableId = null;
            }
        }
        renderHeader();
        renderCategories();
        renderShortcuts();
        renderGrid();
        renderTray();
        wireEvents();
    }
    function renderHeader() {
        if (tableData) {
            els.tableName.innerHTML = `${App.escapeHTML(tableData.name)} <span class="draft-label">Borrador</span>`;
            const now = Date.now();
            const elapsed = now - (tableData.createdAt || now);
            const minutes = Math.floor(elapsed / 60000);
            const pad = n => n.toString().padStart(2, '0');
            const hh = Math.floor(minutes / 60);
            const mm = minutes % 60;
            els.tableMeta.textContent = `Orden #${tableData.id.slice(-4).toUpperCase()} / Tiempo ${pad(hh)}:${pad(mm)}`;
        } else {
            els.tableName.innerHTML = `Nueva mesa <span class="draft-label">Borrador</span>`;
            els.tableMeta.textContent = `Nueva orden / Tiempo 00:00`;
        }
    }
    function renderCategories() {
        // Same four categories as menu.html. Products are saved as 'otros' and shown as "Extras".
        const fixed = ['tacos', 'bebidas', 'postres', 'otros'];
        const stored = App.AppState.items.map(i => i.category || 'otros');
        const sortedCats = [...new Set([...fixed, ...stored])];
        els.categoryNav.innerHTML = '';
        sortedCats.forEach(cat => {
            const btn = document.createElement('button');
            const isActive = cat === currentCategory;
            btn.className = isActive ? 'bg-primary' : '';
            btn.type = 'button';
            btn.setAttribute('aria-pressed', String(isActive));
            btn.textContent = cat === 'otros' ? 'Extras' : App.describeCategory(cat);
            btn.onclick = () => {
                currentCategory = cat;
                renderCategories();
                renderGrid();
            };
            els.categoryNav.appendChild(btn);
        });
    }
    // Quick-order shortcuts ("4 × Pastor"), edited on precios.html. One tap adds that quantity.
    function renderShortcuts() {
        const list = document.getElementById('quick-shortcut-list');
        const presets = App.AppState.quickPresets.filter(p => App.AppState.items.some(i => i.id === p.itemId));
        document.getElementById('quick-shortcuts').hidden = presets.length === 0;
        list.innerHTML = presets.map(p => {
            const label = App.AppState.items.find(i => i.id === p.itemId).label;
            const soldOut = !App.isInStock(p.itemId) ? ' disabled' : '';
            return `<button type="button" class="button" data-item="${App.escapeHTML(p.itemId)}" data-qty="${p.qty}"${soldOut}>${p.qty} × ${App.escapeHTML(label)}</button>`;
        }).join('');
        list.onclick = e => {
            const btn = e.target.closest('[data-item]');
            if (btn) addItem(btn.dataset.item, Number(btn.dataset.qty));
        };
    }
    function renderGrid() {
        els.productGrid.innerHTML = '';
        const items = App.AppState.items.filter(i => (i.category || 'otros') === currentCategory);
        if (items.length === 0) {
            els.productGrid.innerHTML = '<div class="empty-state">No hay productos en esta categoría.</div>';
            return;
        }
        items.forEach(item => {
            const qty = draftOrder[item.id] || 0;
            const price = App.AppState.prices[item.id] || 0;
            const btn = document.createElement('button');
            // Products marked "Agotado" in menu.html cannot be added.
            const inStock = App.isInStock(item.id);
            btn.className = 'product-button';
            btn.type = 'button';
            btn.disabled = !inStock;
            btn.setAttribute('aria-pressed', String(qty > 0));
            btn.setAttribute('aria-label', inStock
                ? `Agregar ${item.label}, ${App.money(price)}. Cantidad: ${qty}`
                : `${item.label}, agotado`);
            btn.onclick = () => addItem(item.id);
            let badgeHtml = '';
            if (!inStock) {
                badgeHtml = '<span class="product-quantity">Agotado</span>';
            } else if (qty > 0) {
                badgeHtml = `<span class="product-quantity">${qty} en la orden</span>`;
            }
            btn.innerHTML = `
                ${badgeHtml}
                <span class="product-name">${App.escapeHTML(item.label)}</span>
                <span class="product-price">${App.money(price)}</span>
            `;
            els.productGrid.appendChild(btn);
        });
    }
    function renderTray() {
        els.trayList.innerHTML = '';
        let total = 0;
        let count = 0;
        const entries = Object.entries(draftOrder);
        if (entries.length === 0) {
            els.trayList.innerHTML = '<p class="tray-empty">Aún no hay productos en la orden.</p>';
            els.trayList.classList.add('hidden'); // Keep the existing empty state collapsed
        }
        entries.forEach(([itemId, qty]) => {
            const item = App.AppState.items.find(i => i.id === itemId);
            if (!item || qty <= 0) return;
            const line = App.computeLine(itemId, qty);
            total += line.total;
            count += qty;
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'tray-item';
            row.onclick = () => openModal(itemId);
            const help = App.describeMods(draftMods[itemId] || [], qty) || 'Editar cantidad u opciones';
            row.innerHTML = `<span><span class="tray-item-name">${qty} × ${App.escapeHTML(item.label)}</span>
                <span class="tray-item-help">${App.escapeHTML(help)}</span></span><span class="tray-item-price">${App.money(line.total)}</span>`;
            els.trayList.appendChild(row);
        });
        els.trayCount.textContent = `${count} productos`;
        els.trayTotal.textContent = App.money(total);
        els.commitTotal.textContent = App.money(total);
    }
    function addItem(itemId, qty = 1) {
        draftOrder[itemId] = (draftOrder[itemId] || 0) + qty;
        renderGrid();
        renderTray();
    }
    function updateQty(itemId, newQty) {
        if (newQty <= 0) {
            delete draftOrder[itemId];
            delete draftMods[itemId];
        } else {
            draftOrder[itemId] = newQty;
        }
        renderGrid();
        renderTray();
    }
    // Opens options-dialog.js for one line; saves the new quantity and option groups.
    function openModal(itemId) {
        const item = App.AppState.items.find(i => i.id === itemId);
        if (!item) return;
        App.openOptionsDialog(item, draftOrder[itemId] || 1, draftMods[itemId] || [], (qty, groups) => {
            if (groups.length) draftMods[itemId] = groups;
            else delete draftMods[itemId];
            updateQty(itemId, qty);
        });
    }
    function commitTicket() {
        const entries = Object.entries(draftOrder);
        if (entries.length === 0) {
            return alert("Agrega productos antes de guardar la orden.");
        }
        if (tableData) {
            tableData.order = { ...draftOrder };
            tableData.modifiers = { ...draftMods };
        } else {
            App.openTableSheet(({ name, note }) => {
                const newTable = {
                    id: App.uid(),
                    name: name,
                    note,
                    order: { ...draftOrder },
                    modifiers: { ...draftMods },
                    charged: false,
                    paidAt: null,
                    createdAt: Date.now(),
                    openDurationMs: null,
                    tip: 0,
                    rounds: [],
                    friends: []
                };
                App.AppState.tables.push(newTable);
                App.persist();
                window.location.href = "index.html";
            });
            return;
        }
        App.persist();
        window.location.href = "index.html"; // Go back to floor plan
    }
    function wireEvents() {
        els.trayHandle.onclick = () => {
            els.trayList.classList.toggle('hidden');
            els.trayHandle.setAttribute('aria-expanded', String(!els.trayList.classList.contains('hidden')));
            const icon = els.trayHandle.querySelector('.material-symbols-outlined');
            if (els.trayList.classList.contains('hidden')) {
                icon.textContent = 'expand_less';
            } else {
                icon.textContent = 'expand_more';
            }
        };
        els.commitBtn.onclick = commitTicket;
    }
    init();
});
