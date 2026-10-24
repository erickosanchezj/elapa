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
    let currentCategory = 'tacos'; // Default category
    let tableData = null; // The table object if editing existing
    let modalItem = null; // ID of item currently in modal
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
        modal: document.getElementById('modifier-modal'),
        modalTitle: document.getElementById('modal-title'),
        modalOptions: document.getElementById('modal-options'),
        modalClose: document.getElementById('modal-close'),
        modalUpdate: document.getElementById('modal-update-btn'),
        modalQtyMinus: document.getElementById('modal-qty-minus'),
        modalQtyPlus: document.getElementById('modal-qty-plus'),
        modalQtyVal: document.getElementById('modal-qty-val'),
    };
    function init() {
        App.loadState();
        const urlParams = new URLSearchParams(window.location.search);
        currentTableId = urlParams.get('tableId');
        if (currentTableId) {
            tableData = App.AppState.tables.find(t => t.id === currentTableId);
            if (tableData) {
                draftOrder = { ...tableData.order };
            } else {
                currentTableId = null;
            }
        }
        renderHeader();
        renderCategories();
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
        const categories = ['tacos', 'bebidas', 'postres', 'extras']; // Fixed list from design or dynamic?
        const dynCategories = [...new Set(App.AppState.items.map(i => i.category || 'otros'))];
        const order = ['tacos', 'bebidas', 'postres', 'extras', 'otros'];
        const sortedCats = Array.from(new Set([...order, ...dynCategories])).filter(c => dynCategories.includes(c) || order.includes(c));
        els.categoryNav.innerHTML = '';
        sortedCats.forEach(cat => {
            const btn = document.createElement('button');
            const isActive = cat === currentCategory;
            const activeClasses = "border-primary bg-surface-light text-text-main";
            const inactiveClasses = "border-transparent text-text-muted hover:bg-surface-light/50 hover:text-text-main";
            btn.className = isActive ? 'bg-primary' : '';
            btn.type = 'button';
            btn.setAttribute('aria-pressed', String(isActive));
            btn.textContent = cat === 'extras' ? 'Extras' : App.describeCategory(cat);
            btn.onclick = () => {
                currentCategory = cat;
                renderCategories();
                renderGrid();
            };
            els.categoryNav.appendChild(btn);
        });
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
            const inStock = true;
            btn.className = 'product-button';
            btn.type = 'button';
            btn.setAttribute('aria-pressed', String(qty > 0));
            btn.setAttribute('aria-label', `Agregar ${item.label}, ${App.money(price)}. Cantidad: ${qty}`);
            btn.onclick = (e) => {
                addItem(item.id);
            };
            let badgeHtml = '';
            if (qty > 0) {
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
        } else {
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
            row.innerHTML = `<span><span class="tray-item-name">${qty} × ${App.escapeHTML(item.label)}</span>
                <span class="tray-item-help">Editar cantidad</span></span><span class="tray-item-price">${App.money(line.total)}</span>`;
            els.trayList.appendChild(row);
        });
        els.trayCount.textContent = `${count} productos`;
        els.trayTotal.textContent = App.money(total);
        els.commitTotal.textContent = App.money(total);
    }
    function addItem(itemId) {
        if (!draftOrder[itemId]) draftOrder[itemId] = 0;
        draftOrder[itemId]++;
        renderGrid();
        renderTray();
    }
    function updateQty(itemId, newQty) {
        if (newQty <= 0) {
            delete draftOrder[itemId];
        } else {
            draftOrder[itemId] = newQty;
        }
        renderGrid();
        renderTray();
    }
    function openModal(itemId) {
        const item = App.AppState.items.find(i => i.id === itemId);
        if (!item) return;
        modalItem = itemId;
        const currentQty = draftOrder[itemId] || 1;
        els.modalTitle.textContent = `Editar ${item.label}`;
        els.modalQtyVal.textContent = currentQty;
        els.modalOptions.innerHTML = '';
        const category = item.category || 'otros';
        const MODIFIERS = {
            'tacos': ['Con Todo', 'Sin Cebolla', 'Sin Piña', 'Sin Verdura', 'Tortilla Harina'],
            'bebidas': ['Con Hielo', 'Sin Hielo', 'Limón'],
            'postres': [],
            'extras': []
        };
        const options = MODIFIERS[category] || [];
        if (options.length === 0) {
             els.modalOptions.innerHTML = '<p class="subtle">No hay opciones adicionales para este producto.</p>';
        } else {
            options.forEach(opt => {
                const label = document.createElement('label');
                label.className = "modifier-option";
                label.innerHTML = `<input type="checkbox"><span>${opt}</span>`;
                const checkbox = label.querySelector('input');
                checkbox.onclick = (e) => {
                };
                els.modalOptions.appendChild(label);
            });
        }
        els.modal.classList.remove('hidden');
    }
    function closeModal() {
        els.modal.classList.add('hidden');
        modalItem = null;
    }
    function commitTicket() {
        const entries = Object.entries(draftOrder);
        if (entries.length === 0) {
            return alert("Agrega productos antes de guardar la orden.");
        }
        if (tableData) {
            tableData.order = { ...draftOrder };
        } else {
            const name = prompt("Nombre o número de mesa:", "Mesa nueva");
            if (!name) return;
            const newTable = {
                id: App.uid(),
                name: name,
                note: '',
                order: { ...draftOrder },
                charged: false,
                paidAt: null,
                createdAt: Date.now(),
                openDurationMs: null,
                tip: 0,
                rounds: [],
                friends: []
            };
            App.AppState.tables.push(newTable);
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
        els.modalClose.onclick = closeModal;
        els.modalQtyMinus.onclick = () => {
            const val = parseInt(els.modalQtyVal.textContent);
            if (val > 0) els.modalQtyVal.textContent = val - 1;
        };
        els.modalQtyPlus.onclick = () => {
            const val = parseInt(els.modalQtyVal.textContent);
            els.modalQtyVal.textContent = val + 1;
        };
        els.modalUpdate.onclick = () => {
            if (modalItem) {
                const val = parseInt(els.modalQtyVal.textContent);
                updateQty(modalItem, val);
                closeModal();
            }
        };
        els.commitBtn.onclick = commitTicket;
    }
    init();
});
