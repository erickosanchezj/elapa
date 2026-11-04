// /js/floor.js
// Renders the floor plan and the open or closed order views.
// This file exists so staff can quickly manage tables and review completed orders.
// RELEVANT FILES: index.html, js/app.js, js/styles.css
document.addEventListener('DOMContentLoaded', () => {
    const App = window.TaqueriaApp;
    // A table open longer than this is "late" (red card, top KPI). Minutes are set on precios.html.
    const lateMs = () => App.AppState.lateMinutes * 60000;
    // Only tables paid today can be reopened; older ones are closed history.
    const paidToday = t => (t.paidAt || 0) >= new Date().setHours(0, 0, 0, 0);
    let orderView = 'open';

    function init() {
        App.loadState();
        App.renderFloor = render; // templates.js re-renders after opening a table
        render();
        setInterval(() => {
            render();
        }, 30000);

        const fab = document.getElementById('fab-add-table');
        if (fab) fab.addEventListener('click', promptAddTable);

        const grid = document.getElementById('floor-grid');
        if (grid) grid.addEventListener('click', handleGridClick);

        document.getElementById('show-open-orders')?.addEventListener('click', () => setOrderView('open'));
        document.getElementById('show-closed-orders')?.addEventListener('click', () => setOrderView('closed'));
        document.getElementById('show-archived-orders')?.addEventListener('click', () => setOrderView('archived'));

    }

    function render() {
        updateKPIs();
        updateOrderTabs();
        if (orderView === 'open') renderGrid();
        else renderClosedOrders(orderView === 'archived');
    }

    function setOrderView(view) {
        orderView = view;
        render();
    }

    function updateOrderTabs() {
        const tables = App.AppState.tables;
        document.getElementById('open-orders-count').textContent = tables.filter(t => !t.charged).length;
        document.getElementById('closed-orders-count').textContent = tables.filter(t => t.charged && !t.archived).length;
        document.getElementById('archived-orders-count').textContent = tables.filter(t => t.charged && t.archived).length;

        ['open', 'closed', 'archived'].forEach(view => {
            const button = document.getElementById(`show-${view}-orders`);
            const isActive = orderView === view;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', String(isActive));
        });

        document.getElementById('fab-add-table')?.parentElement.classList.toggle('hidden', orderView !== 'open');
    }

    function updateKPIs() {
        const report = App.computeDailyReport();
        const activeTables = App.AppState.tables.filter(t => !t.charged);

        const now = Date.now();
        const incidents = activeTables.filter(t => (now - t.createdAt) > lateMs()).length;
        document.getElementById('kpi-incidents-label').textContent = `Mesas con más de ${App.formatLateTime(App.AppState.lateMinutes)}`;
        const kpiIncidents = document.getElementById('kpi-incidents');
        if (kpiIncidents) kpiIncidents.textContent = incidents;

        let totalDuration = 0;
        let count = 0;
        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);
        const todayStartMs = todayStart.getTime();
        const closedToday = App.AppState.tables.filter(t => t.charged && !t.archived && t.paidAt && t.paidAt >= todayStartMs);

        if (closedToday.length > 0) {
            totalDuration = closedToday.reduce((sum, t) => sum + (t.openDurationMs || 0), 0);
            count = closedToday.length;
        }

        let avgMs = count > 0 ? totalDuration / count : 0;

        const hours = Math.floor(avgMs / 3600000);
        const minutes = Math.floor((avgMs % 3600000) / 60000);

        const pad = n => n.toString().padStart(2, '0');
        const formattedSla = `${pad(hours)}:${pad(minutes)}`; // HH:MM
        const kpiSla = document.getElementById('kpi-sla');
        if (kpiSla) kpiSla.textContent = formattedSla;

        const kpiSales = document.getElementById('kpi-sales');
        if (kpiSales) kpiSales.textContent = App.money(report.totalSubtotals);
        document.getElementById('kpi-tips').textContent = App.money(report.totalTips); // tips kept separate from sales
    }

    function renderGrid() {
        const grid = document.getElementById('floor-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const activeTables = App.AppState.tables.filter(t => !t.charged);
        const now = Date.now();

        activeTables.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));

        activeTables.forEach(table => {
            const elapsed = now - table.createdAt;
            const isSlaBreach = elapsed > lateMs();
            const total = App.computeTableTotal(table);

            const card = document.createElement('article');
            card.className = `table-card ${isSlaBreach ? 'table-late' : ''}`;
            const elapsedHours = Math.floor(elapsed / 3600000);
            const elapsedMinutes = Math.floor((elapsed % 3600000) / 60000);
            const pad = n => n.toString().padStart(2, '0');
            const timeStr = `${pad(elapsedHours)}:${pad(elapsedMinutes)}`;
            // Keep table navigation and checkout as separate keyboard targets.
            card.innerHTML = `
                <a class="table-open" href="ticket.html?tableId=${encodeURIComponent(table.id)}" data-table-id="${App.escapeHTML(table.id)}">
                    <div class="table-topline"><span class="table-name">${App.escapeHTML(table.name)}</span>
                    <span class="table-status">${isSlaBreach ? `<span class="material-symbols-outlined" aria-hidden="true">warning</span>Más de ${App.formatLateTime(App.AppState.lateMinutes)}` : 'Abierta'}</span></div>
                    <p class="table-note">${App.escapeHTML(table.note || '')}</p>
                    <span class="table-total">${App.money(total)}</span>
                </a>
                <div class="table-footer"><span class="table-time">Tiempo ${timeStr}</span>
                    <span class="table-actions"><button type="button" data-print-order="${App.escapeHTML(table.id)}" class="table-close" aria-label="Imprimir cuenta de ${App.escapeHTML(table.name)}">Imprimir</button>
                    <button type="button" data-close-order="${App.escapeHTML(table.id)}" class="table-close">Cobrar</button></span>
                </div>`;
            grid.appendChild(card);
        });

        const slotsNeeded = 1;
        for (let i = 0; i < slotsNeeded; i++) {
            const btn = document.createElement('button');
            btn.className = 'table-card table-free';
            btn.type = 'button';
            btn.dataset.action = 'create-table';
            btn.setAttribute('aria-label', 'Abrir mesa');
            btn.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">add</span>
                <span class="free-label">Abrir mesa</span>`;
            grid.appendChild(btn);
        }
    }

    // Shows paid orders (Cobradas) or archived paid orders (Archivadas).
    function renderClosedOrders(archived) {
        const grid = document.getElementById('floor-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const sortKey = t => (archived ? t.archivedAt : t.paidAt) || 0;
        const closedOrders = App.AppState.tables
            .filter(t => t.charged && Boolean(t.archived) === archived)
            .sort((a, b) => sortKey(b) - sortKey(a));

        if (!closedOrders.length) {
            grid.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined" aria-hidden="true">${archived ? 'inventory_2' : 'receipt_long'}</span>
                    <p >${archived ? 'No hay órdenes archivadas' : 'Aún no hay órdenes cobradas'}</p>
                </div>`;
            return;
        }

        closedOrders.forEach(table => {
            const subtotal = App.computeTableTotal(table);
            const tip = table.tip || 0;
            const paidDate = table.paidAt ? new Date(table.paidAt).toLocaleString('es-MX', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            }) : 'Fecha no disponible';
            const items = Object.entries(table.order || {})
                .filter(([, qty]) => qty > 0)
                .map(([itemId, qty]) => {
                    const item = App.AppState.items.find(candidate => candidate.id === itemId);
                    const mods = table.modifiers?.[itemId] || []; // Options saved from ticket.html
                    return `${qty}× ${item?.label || itemId}${mods.length ? ` (${mods.join(', ')})` : ''}`;
                })
                .join(', ');

            // Paid cards can be reopened or archived; archived cards can only be restored.
            const id = App.escapeHTML(table.id);
            const actions = archived
                ? `<button type="button" class="table-close" data-order-action="restore" data-id="${id}">Restaurar</button>`
                : `${paidToday(table) ? `<button type="button" class="table-close" data-order-action="reopen" data-id="${id}">Reabrir</button>` : ''}
                   <button type="button" class="table-close" data-order-action="archive" data-id="${id}">Archivar</button>
                   <button type="button" class="table-close" data-print-order="${id}" aria-label="Imprimir ticket de ${App.escapeHTML(table.name)}">Imprimir</button>`;

            const card = document.createElement('article');
            card.className = 'table-card closed-order';
            card.innerHTML = `
                <div class="table-topline"><h2 class="table-name">${App.escapeHTML(table.name)}</h2><span class="table-status">${archived ? 'Archivada' : 'Pagada'}</span></div>
                <p class="subtle">${paidDate}</p>
                <p class="subtle">${App.escapeHTML(items || 'Sin productos registrados')}</p>
                <dl><div><dt>Subtotal</dt><dd>${App.money(subtotal)}</dd></div>
                    <div><dt>Propina</dt><dd>${App.money(tip)}</dd></div>
                    <div class="closed-total"><dt>Total</dt><dd>${App.money(subtotal + tip)}</dd></div></dl>
                <div class="table-footer">${actions}</div>`;
            grid.appendChild(card);
        });
    }

    function promptAddTable() {
        App.openTableSheet(({ name, note, destination }) => {
            const table = {
                id: App.uid(), name, note, order: {}, charged: false, paidAt: null,
                createdAt: Date.now(), openDurationMs: null, tip: 0, rounds: [], friends: []
            };
            App.AppState.tables.push(table);
            App.persist();
            render();
            if (destination === 'ticket') {
                window.location.href = `ticket.html?tableId=${encodeURIComponent(table.id)}`;
            }
        });
    }

    // Opens the checkout sheet (checkout.js); the table closes only after "Cobrar" is confirmed.
    function closeOrder(tableId) {
        const table = App.AppState.tables.find(t => t.id === tableId && !t.charged);
        if (!table) return;
        App.openCheckout(table, tip => {
            if (table.charged) return;
            table.tip = tip; // App.closeTable() saves it together with the checkout.
            // Freeze each line's amount so a reprinted ticket matches what was charged.
            table.checkoutLines = Object.fromEntries(Object.entries(table.order)
                .map(([itemId, qty]) => [itemId, App.computeLine(itemId, qty).total]));
            App.closeTable(table);
            orderView = 'closed';
            render();
            App.toast(`${table.name} cobrada`, 'success');
        });
    }

    // Paid -> open again. Clears the frozen checkout so the total uses current prices.
    function reopenOrder(table) {
        if (!confirm(`¿Reabrir ${table.name}? Saldrá de las ventas hasta que la cobres de nuevo.`)) return;
        table.charged = false;
        table.paidAt = null;
        table.openDurationMs = null;
        table.tip = 0;
        delete table.checkoutSubtotal;
        delete table.checkoutLines;
        App.persist();
        orderView = 'open';
        render();
        App.toast(`${table.name} reabierta`, 'info');
    }

    // Archive hides a paid order and removes it from sales. Nothing is deleted.
    function setArchived(table, archived) {
        table.archived = archived;
        table.archivedAt = archived ? Date.now() : null;
        App.persist();
        render();
        App.toast(`${table.name} ${archived ? 'archivada' : 'restaurada'}`, 'info');
    }

    function handleOrderAction(button) {
        const table = App.AppState.tables.find(t => t.id === button.dataset.id && t.charged);
        if (!table) return;
        const action = button.dataset.orderAction;
        if (action === 'reopen' && !table.archived && paidToday(table)) reopenOrder(table);
        else if (action === 'archive') setArchived(table, true);
        else if (action === 'restore') setArchived(table, false);
    }

    function handleGridClick(e) {
        const closeButton = e.target.closest('[data-close-order]');
        if (closeButton) return closeOrder(closeButton.dataset.closeOrder);
        const printButton = e.target.closest('[data-print-order]');
        if (printButton) {
            const table = App.AppState.tables.find(t => t.id === printButton.dataset.printOrder);
            return table && App.printReceipt(table);
        }
        const orderAction = e.target.closest('[data-order-action]');
        if (orderAction) return handleOrderAction(orderAction);
        const card = e.target.closest('button');
        if (!card) return;

        if (card.dataset.tableId) {
            // Navigate to table
            window.location.href = `ticket.html?tableId=${card.dataset.tableId}`;
        } else if (card.dataset.action === 'create-table') {
            promptAddTable();
        }
    }

    init();
});
