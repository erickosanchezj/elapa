// /js/menu.js
// Manages the logic for the menu management page (menu.html).
// Keeps catalog editing and availability controls together.
// RELEVANT FILES: menu.html, js/app.js
document.addEventListener('DOMContentLoaded', () => {
    const App = window.TaqueriaApp;
    if (!App) {
        console.error('TaqueriaApp not found!');
        return;
    }
    let activeCategory = 'tacos';
    let searchQuery = '';
    let quickToggleMode = false;
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
    function renderTabs() {
        const tabs = categoryTabs.querySelectorAll('[data-category]');
        tabs.forEach(tab => {
            const isActive = tab.dataset.category === activeCategory;
            tab.classList.toggle('bg-primary', isActive);
            tab.setAttribute('aria-current', isActive ? 'true' : 'false');
            tab.classList.toggle('hover:bg-slate-100', !isActive);
            tab.classList.toggle('dark:hover:bg-slate-800', !isActive);
        });
    }
    function renderItems() {
        if (!itemsList) return;
        const items = getFilteredItems();
        headerText.textContent = searchQuery
            ? `Resultados para “${searchQuery}”`
            : `${categoryLabel(activeCategory)}`;
        if (items.length === 0) {
            itemsList.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined" aria-hidden="true">inventory_2</span>
                    <p >No hay productos en esta selección</p>
                </div>`;
            return;
        }
        itemsList.innerHTML = '';
        items.forEach(item => {
            const inStock = App.isInStock(item.id);
            const price = App.AppState.prices[item.id] || 0;
            const row = document.createElement('div');
            row.className = `inventory-row ${inStock ? '' : 'is-unavailable'}`;
            row.dataset.itemId = item.id;
            row.innerHTML = `
                <div><span class="item-name">${App.escapeHTML(item.label)}</span><span class="item-price">${App.money(price)}</span></div>
                <div class="item-controls">
                    <div class="stock-control"><span class="stock-label">${inStock ? 'Disponible' : 'Agotado'}</span>
                        <button type="button" class="stock-toggle" role="switch" aria-checked="${inStock}" aria-label="Disponibilidad de ${App.escapeHTML(item.label)}">
                            <span class="switch-track" aria-hidden="true"><span class="switch-knob"></span></span>
                        </button>
                    </div>
                    <button type="button" class="edit-btn icon-button" aria-label="Editar ${App.escapeHTML(item.label)}"><span class="material-symbols-outlined" aria-hidden="true">edit</span></button>
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
            const action = inStock ? 'Marcar agotado' : 'Marcar disponible';
            const btn = document.createElement('button');
            btn.className = "quick-stock";
            btn.type = "button";
            btn.setAttribute("aria-pressed", String(inStock));
            btn.dataset.itemId = item.id;
            btn.innerHTML = `
                <span class="item-name">${App.escapeHTML(item.label)}</span>
                <span class="subtle">${action}</span>`;
            quickGrid.appendChild(btn);
        });
    }
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
        modalTitle.textContent = 'Agregar producto';
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
        modalTitle.textContent = 'Editar producto';
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
    function handleSaveItem(e) {
        e.preventDefault();
        const id = modalItemId.value;
        const name = modalItemName.value.trim();
        const price = parseFloat(modalItemPrice.value);
        const category = modalItemCat.value;
        if (!name || isNaN(price)) {
            App.toast('Ingresa un nombre y precio válidos', 'error');
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
            App.toast('Producto actualizado', 'success');
        } else {
            // Create new
            const newId = 'custom_' + name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
            App.AppState.items.push({ id: newId, label: name, base: false, category: category, emoji: '' });
            App.AppState.prices[newId] = price;
            App.AppState.stock[newId] = true;
            App.persist();
            App.toast('Producto agregado', 'success');
        }
        closeModal();
        renderItems();
        if (quickToggleMode) renderQuickToggleGrid();
    }
    function handleDeleteItem(itemId) {
        const item = App.AppState.items.find(i => i.id === itemId);
        if (!item || item.base) {
            App.toast('No se pueden eliminar los productos básicos', 'error');
            return;
        }
        if (confirm(`¿Eliminar “${item.label}”?`)) {
            App.AppState.items = App.AppState.items.filter(i => i.id !== itemId);
            delete App.AppState.prices[itemId];
            delete App.AppState.stock[itemId];
            App.persist();
            closeModal();
            renderItems();
            if (quickToggleMode) renderQuickToggleGrid();
            App.toast('Producto eliminado', 'info');
        }
    }
    function handleToggleStock(itemId) {
        const focus = document.activeElement?.closest('.stock-toggle, .quick-stock');
        const target = focus?.classList.contains('quick-stock') ? '#quick-toggle-grid' : '#items-list';
        App.toggleStock(itemId);
        renderItems();
        if (quickToggleMode) renderQuickToggleGrid();
        if (focus) document.querySelector(`${target} [data-item-id="${CSS.escape(itemId)}"]${target === '#items-list' ? ' .stock-toggle' : ''}`)?.focus();
        const item = App.AppState.items.find(i => i.id === itemId);
        const status = App.isInStock(itemId) ? 'disponible' : 'agotado';
        App.toast(`${item.label}: ${status}`, 'info');
    }
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
    function init() {
        App.loadState();
        App.applyUiPrefs();
        renderTabs();
        renderItems();
        wireEvents();
    }
    init();
});
