// /js/precios.js
// Manages the logic for the menu and price administration page.
// This file exists to separate the menu management functionality from the main application logic.
// RELEVANT FILES: precios.html, js/app.js

document.addEventListener('DOMContentLoaded', () => {
    const App = window.TaqueriaApp;
    if (!App) {
        console.error('TaqueriaApp not found!');
        return;
    }

    const itemsList = App.$('#items-list');
    const addItemForm = App.$('#add-item-form');
    const itemNameInput = App.$('#item-name');
    const itemPriceInput = App.$('#item-price');
    const promoToggle = App.$('#promo-toggle');

    function renderItems() {
        if (!itemsList) return;
        itemsList.innerHTML = '';
        App.AppState.items.forEach(item => {
            const price = App.AppState.prices[item.id] || 0;
            const isBaseItem = item.base;

            const itemEl = document.createElement('div');
            itemEl.className = 'flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-lg';
            itemEl.dataset.itemId = item.id;

            itemEl.innerHTML = `
                <div class="flex-1">
                    <span class="font-semibold text-gray-800 dark:text-gray-100">${item.label}</span>
                    ${isBaseItem ? '<span class="ml-2 text-xs text-gray-500 dark:text-gray-400">(básico)</span>' : ''}
                </div>
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                        <input type="number" value="${price.toFixed(2)}" min="0" step="0.50"
                               class="price-input w-28 pl-7 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100">
                    </div>
                    <button ${isBaseItem ? 'disabled' : ''} class="delete-item-btn text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            `;
            itemsList.appendChild(itemEl);
        });
    }

    function renderPromoToggle() {
        if (!promoToggle) return;
        promoToggle.checked = App.AppState.promoEnabled;
    }

    function handleAddItem(e) {
        e.preventDefault();
        const name = itemNameInput.value.trim();
        const price = parseFloat(itemPriceInput.value);

        if (!name || isNaN(price)) {
            App.toast('Por favor, ingresa un nombre y precio válidos.', 'error');
            return;
        }

        const newId = 'custom_' + name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();

        App.AppState.items.push({ id: newId, label: name, base: false });
        App.AppState.prices[newId] = price;
        App.persist();

        App.toast('Producto agregado con éxito', 'success');
        addItemForm.reset();
        renderItems();
    }

    function handleUpdatePrice(itemId, newPrice) {
        if (isNaN(newPrice)) return;
        App.AppState.prices[itemId] = newPrice;
        App.persist();
        App.toast('Precio actualizado', 'success');
    }

    function handleDeleteItem(itemId) {
        const item = App.AppState.items.find(i => i.id === itemId);
        if (!item || item.base) {
            App.toast('No se pueden eliminar los productos básicos.', 'error');
            return;
        }

        if (confirm(`¿Seguro que quieres eliminar "${item.label}"?`)) {
            App.AppState.items = App.AppState.items.filter(i => i.id !== itemId);
            delete App.AppState.prices[itemId];
            App.persist();
            App.toast('Producto eliminado', 'info');
            renderItems();
        }
    }

    function handleTogglePromo() {
        App.AppState.promoEnabled = promoToggle.checked;
        App.persist();
        App.toast(`Promoción ${promoToggle.checked ? 'activada' : 'desactivada'}`, 'info');
    }

    function wireEvents() {
        if (addItemForm) {
            addItemForm.addEventListener('submit', handleAddItem);
        }

        if (itemsList) {
            itemsList.addEventListener('change', (e) => {
                if (e.target.classList.contains('price-input')) {
                    const itemId = e.target.closest('[data-item-id]').dataset.itemId;
                    const newPrice = parseFloat(e.target.value);
                    handleUpdatePrice(itemId, newPrice);
                }
            });

            itemsList.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.delete-item-btn');
                if (deleteBtn) {
                    const itemId = deleteBtn.closest('[data-item-id]').dataset.itemId;
                    handleDeleteItem(itemId);
                }
            });
        }

        if (promoToggle) {
            promoToggle.addEventListener('change', handleTogglePromo);
        }
    }

    function init() {
        App.loadState();
        renderItems();
        renderPromoToggle();
        wireEvents();
    }

    init();
});