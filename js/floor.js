// /js/floor.js
// Renders the floor plan and the open or closed order views.
// This file exists so staff can quickly manage tables and review completed orders.
// RELEVANT FILES: index.html, js/app.js, js/styles.css
document.addEventListener('DOMContentLoaded', () => {
    const App = window.TaqueriaApp;
    const SLA_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes
    const MIN_GRID_SLOTS = 12;
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

            let cardClass = "group relative flex flex-col w-full bg-white dark:bg-gray-800 border border-border-color dark:border-gray-700 active:border-primary active:bg-gray-50 dark:active:bg-gray-700 transition-colors text-left h-40 cursor-pointer";
            let indicatorClass = "absolute left-0 top-0 bottom-0 w-1 bg-rosa";
            let titleClass = "font-display font-bold text-2xl text-text-main dark:text-white";
            let warningIcon = "";

            if (isSlaBreach) {
                cardClass = "group relative flex flex-col w-full bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 active:border-primary active:bg-red-100 dark:active:bg-red-900/30 transition-colors text-left h-40 cursor-pointer";
                indicatorClass = "absolute left-0 top-0 bottom-0 w-1 bg-rosa";
                titleClass = "font-display font-bold text-2xl text-primary";
                warningIcon = `
                    <div class="flex items-center text-primary">
                        <span class="material-symbols-outlined text-[16px]">warning</span>
                        <span class="font-mono text-xs ml-1">SLA</span>
                    </div>`;
            }

            const elapsedHours = Math.floor(elapsed / 3600000);
            const elapsedMinutes = Math.floor((elapsed % 3600000) / 60000);
            const pad = n => n.toString().padStart(2, '0');
            const timeStr = `${pad(elapsedHours)}:${pad(elapsedMinutes)}`;

            const card = document.createElement('button');
            card.className = cardClass;
            card.dataset.tableId = table.id;
            card.innerHTML = `
                <div class="${indicatorClass}"></div>
                <div class="flex flex-col justify-between h-full p-3 pl-4 w-full">
                    <div class="flex justify-between items-start w-full">
                        <span class="${titleClass}">${table.name}</span>
                        ${warningIcon || `
                        <div class="flex items-center text-text-muted">
                            <span class="material-symbols-outlined text-[16px]">group</span>
                            <span class="font-mono text-xs ml-1 truncate max-w-[60px]">${table.note || '-'}</span>
                        </div>`}
                    </div>
                    <div class="space-y-1">
                        <div class="flex justify-between items-end">
                            <span class="font-mono text-xs ${isSlaBreach ? 'text-primary font-bold' : 'text-text-muted'} uppercase">Elapsed</span>
                            <span class="font-mono font-bold ${isSlaBreach ? 'text-primary' : 'text-text-main dark:text-gray-200'} tabular-nums">${timeStr}</span>
                        </div>
                        <div class="flex justify-between items-end">
                            <span class="font-mono text-xs text-text-muted uppercase">Total</span>
                            <span class="font-mono font-bold text-rosa tabular-nums">${App.money(total)}</span>
                        </div>
                        <span data-close-order="${table.id}" class="block border border-gray-300 dark:border-gray-600 py-1 text-center font-display text-xs font-bold uppercase hover:border-primary hover:text-primary">Close order</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });

        const slotsNeeded = Math.max(0, MIN_GRID_SLOTS - activeTables.length);
        for (let i = 0; i < slotsNeeded; i++) {
            const btn = document.createElement('button');
            btn.className = "group relative flex flex-col w-full bg-white dark:bg-gray-800 border border-border-color dark:border-gray-700 active:border-primary active:bg-gray-50 dark:active:bg-gray-700 transition-colors text-left h-32 opacity-80 hover:opacity-100 cursor-pointer";
            btn.dataset.action = "create-table";

            btn.innerHTML = `
                <div class="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 dark:bg-gray-600"></div>
                <div class="flex flex-col justify-between h-full p-3 pl-4 w-full">
                    <div class="flex justify-between items-start w-full">
                        <span class="font-display font-bold text-2xl text-text-muted dark:text-gray-500">Free</span>
                    </div>
                    <div class="space-y-1 opacity-40">
                        <div class="flex justify-between items-end">
                            <span class="font-mono text-xs text-text-muted uppercase">Elapsed</span>
                            <span class="font-mono font-bold text-text-muted tabular-nums">--:--</span>
                        </div>
                        <div class="flex justify-between items-end">
                            <span class="font-mono text-xs text-text-muted uppercase">Total</span>
                            <span class="font-mono font-bold text-text-muted tabular-nums">$0.00</span>
                        </div>
                    </div>
                </div>
            `;
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
                <div class="col-span-full border border-dashed border-border-color dark:border-gray-700 py-12 text-center">
                    <span class="material-symbols-outlined text-4xl text-text-muted">receipt_long</span>
                    <p class="mt-2 font-display font-bold uppercase">No closed orders yet</p>
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
                .join(' · ');

            const card = document.createElement('article');
            card.className = 'relative flex flex-col min-h-36 bg-white dark:bg-gray-800 border border-border-color dark:border-gray-700 p-4 pl-5';
            card.innerHTML = `
                <div class="absolute left-0 top-0 bottom-0 w-1 bg-gray-400"></div>
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <h2 class="font-display font-bold text-xl text-text-main dark:text-white">${table.name}</h2>
                        <p class="font-mono text-[11px] text-text-muted uppercase">${paidDate}</p>
                    </div>
                    <span class="border border-gray-300 dark:border-gray-600 px-2 py-1 font-mono text-[10px] uppercase">Paid</span>
                </div>
                <p class="my-3 flex-1 text-sm text-gray-600 dark:text-gray-300">${items || 'No items recorded'}</p>
                <div class="border-t border-border-color dark:border-gray-700 pt-2 font-mono text-xs">
                    <div class="flex justify-between"><span>Subtotal</span><span>${App.money(subtotal)}</span></div>
                    <div class="flex justify-between text-text-muted"><span>Tip</span><span>${App.money(tip)}</span></div>
                    <div class="flex justify-between mt-1 font-bold text-rosa"><span>Total</span><span>${App.money(subtotal + tip)}</span></div>
                </div>`;
            grid.appendChild(card);
        });
    }

    function promptAddTable() {
        const name = prompt("Nombre de la mesa (ej. Mesa 5):");
        if (name && name.trim()) {
            const note = prompt("Nota (opcional):") || "";
            const newTable = {
                id: App.uid(),
                name: name.trim(),
                note: note.trim(),
                order: {},
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
            render();
            if(confirm("Ir a la mesa ahora?")) {
                window.location.href = `ticket.html?tableId=${newTable.id}`;
            }
        }
    }

    function closeOrder(tableId) {
        const table = App.AppState.tables.find(t => t.id === tableId && !t.charged);
        if (!table || !confirm(`Close and charge ${table.name}?`)) return;
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
