// /js/menu.js
// Manages the logic for the menu management page (menu.html).
// RELEVANT FILES: menu.html, js/app.js

document.addEventListener('DOMContentLoaded', () => {
    const App = window.TaqueriaApp;
    if (!App) {
        console.error('TaqueriaApp not found!');
        return;
    }

    // --- Local state ---
    let activeCategory = 'tacos';
    let searchQuery = '';
    let quickToggleMode = false;

    // --- DOM refs ---
    const itemsList       = App.$('#items-list');
    const headerText      = App.$('#items-header-text');
    const searchInput     = App.$('#menu-search');
    const categoryTabs    = App.$('#category-tabs');
    const btnQuickToggle  = App.$('#btn-quick-toggle');
    const btnAddItem      = App.$('#btn-add-item');
    const quickSection    = App.$('#quick-toggle-section');
    const quickGrid       = App.$('#quick-toggle-grid');
    const btnExitQuick    = App.$('#btn-exit-quick');
    const modalOverlay    = App.$('#modal-overlay');
    const modalTitle      = App.$('#modal-title');
    const modalForm       = App.$('#modal-form');
    const modalItemId     = App.$('#modal-item-id');
    const modalItemName   = App.$('#modal-item-name');
    const modalItemPrice  = App.$('#modal-item-price');
    const modalItemCat    = App.$('#modal-item-category');
    const modalCancel     = App.$('#modal-cancel');
    const modalDelete     = App.$('#modal-delete');

    // --- Helpers ---

    function getFilteredItems() {
        return App.AppState.items.filter(item => {
            const matchCat = item.category === activeCategory;
            const matchSearch = !searchQuery || item.label.toLowerCase().includes(searchQuery.toLowerCase());
            return matchCat && matchSearch;
        });
    }

    function categoryLabel(cat) {
        if (cat === 'tacos') return 'Tacos';
        if (cat === 'bebidas') return 'Bebidas';
        if (cat === 'postres') return 'Postres';
        return 'Extras';
    }

    // --- Render ---

    function renderTabs() {
        const tabs = categoryTabs.querySelectorAll('[data-category]');
        tabs.forEach(tab => {
            const isActive = tab.dataset.category === activeCategory;
            tab.classList.toggle('bg-primary', isActive);
            tab.classList.toggle('text-white', isActive);
            tab.classList.toggle('hover:bg-slate-100', !isActive);
            tab.classList.toggle('dark:hover:bg-slate-800', !isActive);
        });
    }

    function renderItems() {
        if (!itemsList) return;

        const items = getFilteredItems();
        headerText.textContent = searchQuery
            ? `Search results for "${searchQuery}"`
            : `Master Inventory / Category: ${categoryLabel(activeCategory)}`;

        if (items.length === 0) {
            itemsList.innerHTML = `
                <div class="px-4 py-8 text-center text-slate-400">
                    <span class="material-symbols-outlined text-4xl mb-2 block">inventory_2</span>
                    <p class="text-sm font-display uppercase">No items found</p>
                </div>`;
            return;
        }

        itemsList.innerHTML = '';
        items.forEach(item => {
            const inStock = App.isInStock(item.id);
            const price = App.AppState.prices[item.id] || 0;

            const rowClass = inStock
                ? 'bg-white dark:bg-background-dark'
                : 'bg-slate-50 dark:bg-slate-900/50 opacity-60 grayscale';
            const labelClass = inStock
                ? 'text-slate-900 dark:text-slate-100'
                : 'text-slate-500 line-through decoration-primary';
            const priceClass = inStock
                ? 'text-primary'
                : 'text-slate-500';
            const statusLabel = inStock ? 'IN STOCK' : 'OOS';
            const statusTextClass = inStock
                ? 'text-slate-900 dark:text-slate-100'
                : 'text-slate-500';
            const toggleBg = inStock
                ? 'bg-primary border-slate-900'
                : 'bg-slate-300 dark:bg-slate-700 border-slate-400';
            const knobPos = inStock
                ? 'right-0 border-l border-slate-900'
                : 'left-0 border-r border-slate-400';
            const editBorder = inStock
                ? 'border-slate-900 hover:bg-slate-900 hover:text-white'
                : 'border-slate-400';

            const row = document.createElement('div');
            row.className = `flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-800 ${rowClass}`;
            row.dataset.itemId = item.id;
            row.innerHTML = `
                <div class="flex flex-col">
                    <span class="text-base font-bold font-display uppercase ${labelClass}">${item.emoji ? item.emoji + ' ' : ''}${item.label}</span>
                    <span class="text-xs font-mono ${priceClass} font-bold tracking-tight">${App.money(price)}</span>
                </div>
                <div class="flex items-center gap-6">
                    <div class="flex flex-col items-end gap-1">
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Status</span>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold font-display ${statusTextClass}">${statusLabel}</span>
                            <div class="stock-toggle w-10 h-5 ${toggleBg} relative cursor-pointer border">
                                <div class="absolute ${knobPos} top-0 bottom-0 w-4 bg-white"></div>
                            </div>
                        </div>
                    </div>
                    <button class="edit-btn p-2 border ${editBorder} transition-all">
                        <span class="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                </div>`;
            itemsList.appendChild(row);
        });
    }

    function renderQuickToggleGrid() {
        if (!quickGrid) return;
        const items = getFilteredItems();
        quickGrid.innerHTML = '';
        items.forEach(item => {
            const inStock = App.isInStock(item.id);
            const bg = inStock ? 'bg-primary text-white border-slate-900' : 'bg-slate-300 text-slate-600 border-slate-400';
            const action = inStock ? 'Kill Item' : 'Revive';
            const btn = document.createElement('button');
            btn.className = `aspect-square border flex flex-col items-center justify-center p-4 ${bg} transition-colors`;
            btn.dataset.itemId = item.id;
            btn.innerHTML = `
                <span class="text-lg font-bold font-display uppercase leading-tight">${item.label}</span>
                <span class="text-[10px] uppercase font-mono mt-2">${action}</span>`;
            quickGrid.appendChild(btn);
        });
    }

    // --- Modal ---

    function openModal() {
        modalOverlay.style.display = 'flex';
        modalOverlay.classList.remove('hidden');
    }

    function closeModal() {
        modalOverlay.style.display = 'none';
        modalOverlay.classList.add('hidden');
        modalForm.reset();
        modalItemId.value = '';
        modalDelete.classList.add('hidden');
    }

    function openAddModal() {
        modalTitle.textContent = 'Add New Item';
        modalItemId.value = '';
        modalItemName.value = '';
        modalItemPrice.value = '';
        modalItemCat.value = activeCategory;
        modalDelete.classList.add('hidden');
        openModal();
        modalItemName.focus();
    }

    function openEditModal(itemId) {
        const item = App.AppState.items.find(i => i.id === itemId);
        if (!item) return;
        const price = App.AppState.prices[itemId] || 0;

        modalTitle.textContent = 'Edit Item';
        modalItemId.value = itemId;
        modalItemName.value = item.label;
        modalItemPrice.value = price.toFixed(2);
        modalItemCat.value = item.category || 'otros';

        if (item.base) {
            modalDelete.classList.add('hidden');
        } else {
            modalDelete.classList.remove('hidden');
        }

        openModal();
        modalItemName.focus();
    }

    // --- CRUD handlers ---

    function handleSaveItem(e) {
        e.preventDefault();
        const id = modalItemId.value;
        const name = modalItemName.value.trim();
        const price = parseFloat(modalItemPrice.value);
        const category = modalItemCat.value;

        if (!name || isNaN(price)) {
            App.toast('Enter a valid name and price', 'error');
            return;
        }

        if (id) {
            // Update existing
            const item = App.AppState.items.find(i => i.id === id);
            if (item) {
                item.label = name;
                item.category = category;
                App.AppState.prices[id] = price;
            }
            App.persist();
            App.toast('Item updated', 'success');
        } else {
            // Create new
            const newId = 'custom_' + name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
            App.AppState.items.push({ id: newId, label: name, base: false, category: category, emoji: '' });
            App.AppState.prices[newId] = price;
            App.AppState.stock[newId] = true;
            App.persist();
            App.toast('Item added', 'success');
        }

        closeModal();
        renderItems();
        if (quickToggleMode) renderQuickToggleGrid();
    }

    function handleDeleteItem(itemId) {
        const item = App.AppState.items.find(i => i.id === itemId);
        if (!item || item.base) {
            App.toast('Cannot delete base items', 'error');
            return;
        }
        if (confirm(`Delete "${item.label}"?`)) {
            App.AppState.items = App.AppState.items.filter(i => i.id !== itemId);
            delete App.AppState.prices[itemId];
            delete App.AppState.stock[itemId];
            App.persist();
            closeModal();
            renderItems();
            if (quickToggleMode) renderQuickToggleGrid();
            App.toast('Item deleted', 'info');
        }
    }

    function handleToggleStock(itemId) {
        App.toggleStock(itemId);
        renderItems();
        if (quickToggleMode) renderQuickToggleGrid();
        const item = App.AppState.items.find(i => i.id === itemId);
        const status = App.isInStock(itemId) ? 'in stock' : 'out of stock';
        App.toast(`${item.label} → ${status}`, 'info');
    }

    // --- Event wiring ---

    function wireEvents() {
        // Category tabs
        categoryTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('[data-category]');
            if (!tab) return;
            e.preventDefault();
            activeCategory = tab.dataset.category;
            renderTabs();
            renderItems();
            if (quickToggleMode) renderQuickToggleGrid();
        });

        // Search with debounce
        let searchTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                searchQuery = e.target.value.trim();
                renderItems();
                if (quickToggleMode) renderQuickToggleGrid();
            }, 150);
        });

        // Item list — event delegation for toggle and edit
        itemsList.addEventListener('click', (e) => {
            const row = e.target.closest('[data-item-id]');
            if (!row) return;
            const itemId = row.dataset.itemId;

            if (e.target.closest('.stock-toggle')) {
                handleToggleStock(itemId);
            } else if (e.target.closest('.edit-btn')) {
                openEditModal(itemId);
            }
        });

        // FAB — add item
        btnAddItem.addEventListener('click', openAddModal);

        // Quick Toggle Mode
        btnQuickToggle.addEventListener('click', () => {
            quickToggleMode = !quickToggleMode;
            quickSection.classList.toggle('hidden', !quickToggleMode);
            if (quickToggleMode) renderQuickToggleGrid();
        });
        btnExitQuick.addEventListener('click', () => {
            quickToggleMode = false;
            quickSection.classList.add('hidden');
        });

        // Quick toggle grid — event delegation
        quickGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-item-id]');
            if (btn) handleToggleStock(btn.dataset.itemId);
        });

        // Modal events
        modalForm.addEventListener('submit', handleSaveItem);
        modalCancel.addEventListener('click', closeModal);
        modalDelete.addEventListener('click', () => {
            handleDeleteItem(modalItemId.value);
        });
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }

    // --- Init ---

    function init() {
        App.loadState();
        App.applyUiPrefs();
        renderTabs();
        renderItems();
        wireEvents();
    }

    init();
});
