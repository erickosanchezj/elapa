// /js/floor.js
// Renders the floor plan and the open or closed order views.
// This file exists so staff can quickly manage tables and review completed orders.
// RELEVANT FILES: index.html, js/app.js, js/styles.css
document.addEventListener('DOMContentLoaded', () => {
    const App = window.TaqueriaApp;
    const SLA_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes
    let orderView = 'open';

    function init() {
        App.loadState();
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

    }

    function render() {
        updateKPIs();
        updateOrderTabs();
        if (orderView === 'closed') renderClosedOrders();
        else renderGrid();
    }

    function setOrderView(view) {
        orderView = view;
        render();
    }

    function updateOrderTabs() {
        const openOrders = App.AppState.tables.filter(t => !t.charged);
        const closedOrders = App.AppState.tables.filter(t => t.charged);
        document.getElementById('open-orders-count').textContent = openOrders.length;
        document.getElementById('closed-orders-count').textContent = closedOrders.length;

        ['open', 'closed'].forEach(view => {
            const button = document.getElementById(`show-${view}-orders`);
            const isActive = orderView === view;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', String(isActive));
        });

        document.getElementById('fab-add-table')?.parentElement.classList.toggle('hidden', orderView === 'closed');
    }

    function updateKPIs() {
        const report = App.computeDailyReport();
        const activeTables = App.AppState.tables.filter(t => !t.charged);

        const now = Date.now();
        const incidents = activeTables.filter(t => (now - t.createdAt) > SLA_THRESHOLD_MS).length;
        const kpiIncidents = document.getElementById('kpi-incidents');
        if (kpiIncidents) kpiIncidents.textContent = incidents;

        let totalDuration = 0;
        let count = 0;
        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);
        const todayStartMs = todayStart.getTime();
        const closedToday = App.AppState.tables.filter(t => t.charged && t.paidAt && t.paidAt >= todayStartMs);

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
            const isSlaBreach = elapsed > SLA_THRESHOLD_MS;
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
                    <span class="table-status">${isSlaBreach ? '<span class="material-symbols-outlined" aria-hidden="true">warning</span>Más de 1 h' : 'Abierta'}</span></div>
                    <p class="table-note">${App.escapeHTML(table.note || '')}</p>
                    <span class="table-total">${App.money(total)}</span>
                </a>
                <div class="table-footer"><span class="table-time">Tiempo ${timeStr}</span>
                    <button type="button" data-close-order="${App.escapeHTML(table.id)}" class="table-close">Cobrar</button>
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

    function renderClosedOrders() {
        const grid = document.getElementById('floor-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const closedOrders = App.AppState.tables
            .filter(t => t.charged)
            .sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));

        if (!closedOrders.length) {
            grid.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined" aria-hidden="true">receipt_long</span>
                    <p >Aún no hay órdenes cobradas</p>
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
                    return `${qty}× ${item?.label || itemId}`;
                })
                .join(', ');

            const card = document.createElement('article');
            card.className = 'table-card closed-order';
            card.innerHTML = `
                <div class="table-topline"><h2 class="table-name">${App.escapeHTML(table.name)}</h2><span class="table-status">Pagada</span></div>
                <p class="subtle">${paidDate}</p>
                <p class="subtle">${App.escapeHTML(items || 'Sin productos registrados')}</p>
                <dl><div><dt>Subtotal</dt><dd>${App.money(subtotal)}</dd></div>
                    <div><dt>Propina</dt><dd>${App.money(tip)}</dd></div>
                    <div class="closed-total"><dt>Total</dt><dd>${App.money(subtotal + tip)}</dd></div></dl>`;
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

    function closeOrder(tableId) {
        const table = App.AppState.tables.find(t => t.id === tableId && !t.charged);
        if (!table || !confirm(`¿Cerrar y cobrar ${table.name}?`)) return;
        App.closeTable(table);
        orderView = 'closed';
        render();
    }

    function handleGridClick(e) {
        const closeButton = e.target.closest('[data-close-order]');
        if (closeButton) return closeOrder(closeButton.dataset.closeOrder);
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
