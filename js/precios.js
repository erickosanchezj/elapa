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
            // Product names carry identity; emoji metadata remains stored.

            const itemEl = document.createElement('div');
            itemEl.className = 'price-row';
            itemEl.dataset.itemId = item.id;

            itemEl.innerHTML = `
                <div class="item-details">
                    <div class="item-labels">
                      <span class="item-name">${App.escapeHTML(item.label)}</span>
                      ${isBaseItem ? '<span class="subtle">(básico)</span>' : ''}
                      <span class="pill">${App.describeCategory(item.category)}</span>
                    </div>
                </div>
                <div class="item-controls">
                    <div class="price-input-wrap">
                        <span aria-hidden="true">$</span>
                        <input type="number" name="price-${item.id}" aria-label="Precio para ${App.escapeHTML(item.label)}" autocomplete="off" value="${price.toFixed(2)}" min="0" step="0.50"
                               class="price-input">
                    </div>
                    <button ${isBaseItem ? 'disabled' : ''} aria-label="Eliminar ${App.escapeHTML(item.label)}" type="button" class="delete-item-btn icon-button">
                        <span class="material-symbols-outlined" aria-hidden="true">delete</span>
                    </button>
                </div>
            `;
            itemsList.appendChild(itemEl);
        });
    }

    function renderPromoToggle() {
        if (!promoToggle) return;
        promoToggle.checked = App.isPastorPromoActive();
        promoToggle.disabled = true;
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

        if (confirm(`¿Seguro que quieres eliminar "${App.escapeHTML(item.label)}"?`)) {
            App.AppState.items = App.AppState.items.filter(i => i.id !== itemId);
            delete App.AppState.prices[itemId];
            App.persist();
            App.toast('Producto eliminado', 'info');
            renderItems();
        }
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
    }

    function init() {
        App.loadState();
        App.applyUiPrefs();
        renderItems();
        renderPromoToggle();
        wireEvents();
    }

    init();
});
