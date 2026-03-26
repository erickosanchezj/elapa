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

    // State
    let currentTableId = null;
    let draftOrder = {}; // { itemId: qty }
    let currentCategory = 'tacos'; // Default category
    let tableData = null; // The table object if editing existing
    let modalItem = null; // ID of item currently in modal

    // DOM Elements
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

        // Parse URL
        const urlParams = new URLSearchParams(window.location.search);
        currentTableId = urlParams.get('tableId');

        if (currentTableId) {
            tableData = App.AppState.tables.find(t => t.id === currentTableId);
            if (tableData) {
                // Clone existing order to draft
                draftOrder = { ...tableData.order };
            } else {
                // Table ID provided but not found? Treat as new or error.
                // We'll treat as new with that ID (unlikely scenario), or just ignore.
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
            els.tableName.innerHTML = `${tableData.name} <span class="text-text-muted font-mono text-sm align-middle ml-1">[DRAFT]</span>`;
            const now = Date.now();
            const elapsed = now - (tableData.createdAt || now);
            const minutes = Math.floor(elapsed / 60000);
            const pad = n => n.toString().padStart(2, '0');
            const hh = Math.floor(minutes / 60);
            const mm = minutes % 60;
            els.tableMeta.textContent = `INCIDENT #${tableData.id.slice(-4).toUpperCase()} • WAIT: ${pad(hh)}:${pad(mm)}`;
        } else {
            els.tableName.innerHTML = `NEW TABLE <span class="text-text-muted font-mono text-sm align-middle ml-1">[DRAFT]</span>`;
            els.tableMeta.textContent = `NEW TICKET • WAIT: 00:00`;
        }
    }

    function renderCategories() {
        const categories = ['tacos', 'bebidas', 'postres', 'extras']; // Fixed list from design or dynamic?
        // Let's use dynamic but ensure Tacos is first as per design
        const dynCategories = [...new Set(App.AppState.items.map(i => i.category || 'otros'))];
        // Merge/Sort
        const order = ['tacos', 'bebidas', 'postres', 'extras', 'otros'];
        const sortedCats = Array.from(new Set([...order, ...dynCategories])).filter(c => dynCategories.includes(c) || order.includes(c));

        els.categoryNav.innerHTML = '';
        sortedCats.forEach(cat => {
            const btn = document.createElement('button');
            const isActive = cat === currentCategory;
            const activeClasses = "border-primary bg-surface-light text-text-main";
            const inactiveClasses = "border-transparent text-text-muted hover:bg-surface-light/50 hover:text-text-main";

            btn.className = `flex-1 min-w-[100px] py-3 text-center border-b-4 font-display font-bold text-sm tracking-wide transition-colors uppercase ${isActive ? activeClasses : inactiveClasses}`;
            btn.textContent = cat;
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
            els.productGrid.innerHTML = '<div class="col-span-full text-center text-text-muted py-10 font-mono">NO ITEMS IN CATEGORY</div>';
            return;
        }

        items.forEach(item => {
            const qty = draftOrder[item.id] || 0;
            const price = App.AppState.prices[item.id] || 0;

            const btn = document.createElement('button');
            // Check stock status (mocked as true for now)
            const inStock = true;

            btn.className = "group relative aspect-square bg-white border border-border-strong hover:bg-surface-light active:bg-surface-light transition-colors flex flex-col items-center justify-center p-2 select-none";
            btn.onclick = (e) => {
                // If clicking the badge (if we had one separate), open modal?
                // For now, simple tap = add.
                addItem(item.id);
            };

            // HTML Structure
            let badgeHtml = '';
            if (qty > 0) {
                badgeHtml = `<div class="absolute top-2 left-2 bg-black text-white font-mono text-xs w-6 h-6 flex items-center justify-center">${qty}</div>`;
            }

            btn.innerHTML = `
                ${badgeHtml}
                <div class="absolute top-3 right-3 w-2 h-2 rounded-full ${inStock ? 'bg-success' : 'bg-red-500'}"></div>
                <span class="font-display font-bold text-lg leading-tight mb-1 uppercase text-center">${item.label}</span>
                <span class="font-mono text-text-muted text-sm">${App.money(price)}</span>
            `;

            els.productGrid.appendChild(btn);
        });
    }

    function renderTray() {
        els.trayList.innerHTML = '';
        let total = 0;
        let count = 0;

        const entries = Object.entries(draftOrder);
        // Show Tray list if not empty (or always show but handle empty state)
        if (entries.length === 0) {
            els.trayList.innerHTML = '<div class="p-4 text-center text-text-muted font-mono text-sm">TRAY IS EMPTY</div>';
            els.trayList.classList.add('hidden'); // Hide list
        } else {
            // els.trayList.classList.remove('hidden'); // Only show if expanded?
            // The design has a "collapsed view" and a "scrollable list".
            // We'll toggle visibility on header click, but update content always.
        }

        entries.forEach(([itemId, qty]) => {
            const item = App.AppState.items.find(i => i.id === itemId);
            if (!item || qty <= 0) return;

            const line = App.computeLine(itemId, qty);
            total += line.total;
            count += qty;

            const row = document.createElement('div');
            row.className = "flex items-center justify-between p-4 border-b border-border-subtle group hover:bg-surface-light/50 relative overflow-hidden cursor-pointer";
            row.onclick = () => openModal(itemId);

            row.innerHTML = `
                <div class="flex items-start gap-3">
                    <span class="bg-border-strong text-white font-mono text-xs px-1.5 py-0.5 mt-0.5">${qty}x</span>
                    <div>
                        <p class="font-display font-bold text-sm leading-tight uppercase">${item.label}</p>
                        <p class="font-mono text-xs text-text-muted mt-0.5">TAP TO EDIT</p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <span class="font-mono text-sm font-medium">${App.money(line.total)}</span>
                    <div class="w-1 h-8 bg-border-subtle rounded-full"></div>
                </div>
            `;
            els.trayList.appendChild(row);
        });

        els.trayCount.textContent = `${count} ITEMS`;
        els.trayTotal.textContent = App.money(total);
        els.commitTotal.textContent = App.money(total);
    }

    // Actions
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

    // Modal
    function openModal(itemId) {
        const item = App.AppState.items.find(i => i.id === itemId);
        if (!item) return;

        modalItem = itemId;
        const currentQty = draftOrder[itemId] || 1;

        els.modalTitle.textContent = `CONFIG: ${item.label}`;
        els.modalQtyVal.textContent = currentQty;

        // Render Modifiers based on category
        els.modalOptions.innerHTML = '';
        const category = item.category || 'otros';

        // Define modifiers per category
        const MODIFIERS = {
            'tacos': ['Con Todo', 'Sin Cebolla', 'Sin Piña', 'Sin Verdura', 'Tortilla Harina'],
            'bebidas': ['Con Hielo', 'Sin Hielo', 'Limón'],
            'postres': [],
            'extras': []
        };

        const options = MODIFIERS[category] || [];

        if (options.length === 0) {
             els.modalOptions.innerHTML = '<p class="text-center text-text-muted text-sm italic">No modifiers available for this item.</p>';
        } else {
            options.forEach(opt => {
                const label = document.createElement('label');
                label.className = "flex items-center gap-3 p-3 border border-border-subtle cursor-pointer hover:bg-surface-light group select-none";
                label.innerHTML = `
                    <div class="relative flex items-center">
                        <input class="peer h-5 w-5 appearance-none border-2 border-border-strong bg-white checked:bg-primary checked:border-primary transition-colors cursor-pointer" type="checkbox"/>
                        <span class="material-symbols-outlined absolute text-white text-sm pointer-events-none hidden peer-checked:block left-[2px]">check</span>
                    </div>
                    <span class="font-display font-bold text-sm uppercase flex-1">${opt}</span>
                `;
                // Add simple toggle behavior (visual only)
                const checkbox = label.querySelector('input');
                checkbox.onclick = (e) => {
                    // Logic to handle exclusive options could go here if needed
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
            return alert("Ticket is empty!");
        }

        if (tableData) {
            // Update existing
            tableData.order = { ...draftOrder };
            // Update timestamp only if not charged? Or keep createdAt.
            // Usually we don't change createdAt.
        } else {
            // Create New
            // Need a name. Design says "Table 04".
            // We'll prompt for name or generate one.
            const name = prompt("Enter Table Name / Number:", "Mesa New");
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
        window.location.href = "floor.html"; // Go back to floor plan
    }

    // Events
    function wireEvents() {
        // Tray Expand/Collapse
        els.trayHandle.onclick = () => {
            els.trayList.classList.toggle('hidden');
            const icon = els.trayHandle.querySelector('.material-symbols-outlined');
            if (els.trayList.classList.contains('hidden')) {
                icon.textContent = 'expand_less';
            } else {
                icon.textContent = 'expand_more';
            }
        };

        // Modal Controls
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

        // Commit
        els.commitBtn.onclick = commitTicket;
    }

    init();
});
