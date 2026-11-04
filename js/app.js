// /js/app.js
// Provides shared state, pricing, persistence, and checkout helpers.
// This file exists so every page uses the same restaurant data rules.
// RELEVANT FILES: index.html, js/floor.js, js/ticket.js
(function() {
    'use strict';
    window.TaqueriaApp = {};
    const App = window.TaqueriaApp;

    App.AppState = { items: [], prices: {}, stock: {}, promoEnabled: null, lateMinutes: 60, tables: [], pricesCollapsed: null, currentTableId: null, quickPresets: [], uiDense: false, uiHighContrast: false, menuSearch: '', menuCategory: 'all', tableTemplates: [] };
    App.$ = sel => document.querySelector(sel);
    App.$$ = sel => document.querySelectorAll(sel);
    App.money = n => '$' + (n || 0).toFixed(2);
    App.uid = () => 'id_' + Math.random().toString(36).slice(2, 10);
    App.isMonOrWed = () => { const d = new Date().getDay(); return d === 1 || d === 3; };
    // "Late table" threshold label for the floor plan and precios.html: 45 → "45 min", 60 → "1 h", 90 → "1 h 30 min".
    App.formatLateTime = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
    const BASE_ITEMS = [
        { id: 'taco_pastor', label: 'Pastor', base: true },
        { id: 'taco_suadero', label: 'Suadero', base: true },
        { id: 'taco_carbon', label: 'Al Carbón', base: true },
        { id: 'taco_tripa', label: 'Tripa', base: true },
        { id: 'taco_cabeza', label: 'Cabeza', base: true },
        { id: 'gringas', label: 'Gringas', base: true },
        { id: 'refresco', label: 'Refresco', base: true },
        { id: 'cerveza', label: 'Cerveza', base: true },
    ];
    const DEFAULT_PRICES = { refresco: 27.00, taco_pastor: 17.00, taco_suadero: 17.00, taco_carbon: 40.00, taco_tripa: 18.00, taco_cabeza: 17.00, gringas: 80.00, cerveza: 35.00 };
    const DEFAULT_QUICK_PRESETS = [
        { id: 'qp_pastor_2', label: '2 × Taco de Pastor', itemId: 'taco_pastor', qty: 2 },
        { id: 'qp_pastor_4', label: '4 × Taco de Pastor', itemId: 'taco_pastor', qty: 4 },
        { id: 'qp_pastor_6', label: '6 × Taco de Pastor', itemId: 'taco_pastor', qty: 6 },
        { id: 'qp_suadero_2', label: '2 × Taco de Suadero', itemId: 'taco_suadero', qty: 2 },
        { id: 'qp_suadero_4', label: '4 × Taco de Suadero', itemId: 'taco_suadero', qty: 4 },
        { id: 'qp_suadero_6', label: '6 × Taco de Suadero', itemId: 'taco_suadero', qty: 6 },
    ];
    App.DEFAULT_QUICK_PRESETS = DEFAULT_QUICK_PRESETS;
    const DEFAULT_TABLE_TEMPLATES = [
        { id: 'tmpl_brendos', label: 'Brendos', name: 'Brendos', note: 'Pareja', order: { taco_pastor: 6, refresco: 2 } },
        { id: 'tmpl_jaricks', label: 'Jaricks', name: 'Jaricks', note: 'Pareja', order: { taco_suadero: 6, cerveza: 2 } },
        { id: 'tmpl_compartida', label: 'Compartida', name: 'Mesa Compartida', note: 'Para pedidos en común', order: { taco_carbon: 2, taco_tripa: 2, cerveza: 4 } },
    ];
    App.DEFAULT_TABLE_TEMPLATES = DEFAULT_TABLE_TEMPLATES;
    const REMOVED_ITEMS = ['agua_horchata', 'agua_jamaica', 'flan_casero'];
    const ITEM_META = {
        taco_pastor: { category: 'tacos', emoji: '🌮', label: 'Pastor' },
        taco_suadero: { category: 'tacos', emoji: '🌮', label: 'Suadero' },
        taco_carbon: { category: 'tacos', emoji: '🌮', label: 'Al Carbón' },
        taco_tripa: { category: 'tacos', emoji: '🌮', label: 'Tripa' },
        taco_cabeza: { category: 'tacos', emoji: '🌮', label: 'Cabeza' },
        gringas: { category: 'tacos', emoji: '🌮', label: 'Gringas' },
        refresco: { category: 'bebidas', emoji: '🥤', label: 'Refresco' },
        cerveza: { category: 'bebidas', emoji: '🍺', label: 'Cerveza' },
    };

    App.loadState = function() {
        App.AppState.items = JSON.parse(localStorage.getItem('tacos_items') || 'null') || BASE_ITEMS.slice();
        App.AppState.prices = JSON.parse(localStorage.getItem('tacos_prices') || 'null') || { ...DEFAULT_PRICES };
        // Promo switch (precios.html). New key, ON unless staff turned it off: the old 'tacos_promoEnabled' was always saved as false.
        App.AppState.promoEnabled = localStorage.getItem('tacos_promo_on') !== 'false';
        App.AppState.lateMinutes = Number(localStorage.getItem('tacos_late_minutes')) || 60; // set on precios.html
        App.AppState.tables = JSON.parse(localStorage.getItem('tacos_tables') || '[]');
        const storedPresets = JSON.parse(localStorage.getItem('tacos_quick_presets') || 'null');
        App.AppState.quickPresets = Array.isArray(storedPresets) ? storedPresets : DEFAULT_QUICK_PRESETS.slice(); // [] = staff deleted all
        const storedTemplates = JSON.parse(localStorage.getItem('tacos_table_templates') || 'null');
        App.AppState.tableTemplates = Array.isArray(storedTemplates) ? storedTemplates : DEFAULT_TABLE_TEMPLATES.slice();
        BASE_ITEMS.forEach(b => { if (!App.AppState.items.find(x => x.id === b.id)) App.AppState.items.unshift(b); if (!(b.id in App.AppState.prices)) App.AppState.prices[b.id] = DEFAULT_PRICES[b.id] || 0; });
        App.AppState.items = App.AppState.items
            .filter(it => !REMOVED_ITEMS.includes(it.id))
            .map(it => App.mergeItemDefaults(it));
        REMOVED_ITEMS.forEach(id => { delete App.AppState.prices[id]; });
        App.AppState.quickPresets = App.AppState.quickPresets.filter(p => p && p.itemId && p.qty > 0);
        if(localStorage.getItem('tacos_tables_v2')) { App.AppState.tables = JSON.parse(localStorage.getItem('tacos_tables_v2')); localStorage.setItem('tacos_tables', localStorage.getItem('tacos_tables_v2')); localStorage.removeItem('tacos_tables_v2'); }
        App.AppState.stock = JSON.parse(localStorage.getItem('tacos_stock') || '{}');
        App.AppState.uiDense = Boolean(JSON.parse(localStorage.getItem('tacos_ui_dense') || 'false'));
        App.AppState.uiHighContrast = Boolean(JSON.parse(localStorage.getItem('tacos_ui_high_contrast') || 'false'));
    };

    App.isPastorPromoActive = function() {
        return App.AppState.promoEnabled && App.isMonOrWed(); // 2x1 pastor: switch on AND Monday/Wednesday
    };

    App.persist = function() {
        localStorage.setItem('tacos_items', JSON.stringify(App.AppState.items));
        localStorage.setItem('tacos_prices', JSON.stringify(App.AppState.prices));
        localStorage.setItem('tacos_promo_on', String(App.AppState.promoEnabled));
        localStorage.setItem('tacos_late_minutes', String(App.AppState.lateMinutes));
        localStorage.setItem('tacos_tables', JSON.stringify(App.AppState.tables));
        localStorage.setItem('tacos_quick_presets', JSON.stringify(App.AppState.quickPresets));
        localStorage.setItem('tacos_table_templates', JSON.stringify(App.AppState.tableTemplates));
        localStorage.setItem('tacos_stock', JSON.stringify(App.AppState.stock));
        localStorage.setItem('tacos_ui_dense', JSON.stringify(App.AppState.uiDense));
        localStorage.setItem('tacos_ui_high_contrast', JSON.stringify(App.AppState.uiHighContrast));
    };
    App.applyUiPrefs = function() {
        const body = document.body;
        if (!body) return;
        body.classList.toggle('dense', !!App.AppState.uiDense);
        body.classList.toggle('high-contrast', !!App.AppState.uiHighContrast);
    };

    App.mergeItemDefaults = function(item) {
        const defaults = ITEM_META[item.id] || {};
        return {
            ...item,
            category: item.category || defaults.category || 'otros',
            emoji: item.emoji || defaults.emoji || '',
            label: defaults.label || item.label,
        };
    };

    App.describeCategory = function(cat) {
        if (cat === 'tacos') return 'Tacos';
        if (cat === 'bebidas') return 'Bebidas';
        if (cat === 'postres') return 'Postres';
        return 'Otros';
    };

    App.isInStock = function(itemId) {
        return App.AppState.stock[itemId] !== false;
    };

    App.toggleStock = function(itemId) {
        App.AppState.stock[itemId] = !App.isInStock(itemId);
        App.persist();
    };

    App.computeLine = function(itemId, qty) {
        const p = App.AppState.prices[itemId] || 0;
        let c = qty;
        if (itemId === 'taco_pastor' && App.isPastorPromoActive()) {
            c = Math.ceil(qty / 2);
        }
        return { unit: p, chargedQty: c, total: c * p };
    };
    App.computeTableTotal = function(table) {
        if (table.charged && Number.isFinite(table.checkoutSubtotal)) return table.checkoutSubtotal;
        return Object.entries(table.order).reduce((s, [i, q]) => s + App.computeLine(i, q).total, 0);
    };
    App.closeTable = function(table) {
        if (!table || table.charged) return false;
        const paidAt = Date.now();
        table.checkoutSubtotal = App.computeTableTotal(table);
        table.charged = true;
        table.paidAt = paidAt;
        table.openDurationMs = paidAt - (table.createdAt || paidAt);
        App.persist();
        return true;
    };
    App.computeDailyReport = function(){
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayStartMs = todayStart.getTime();
        const todaysTables = App.AppState.tables.filter(t => t.charged && !t.archived && t.paidAt && t.paidAt >= todayStartMs); // Archived = excluded from sales
        const unpaidTablesToday = App.AppState.tables
            .filter(t => !t.charged && (t.createdAt || 0) >= todayStartMs)
            .map(t => ({
                id: t.id,
                name: t.name,
                note: t.note,
                createdAt: t.createdAt,
                total: App.computeTableTotal(t),
            }));
        const totalSubtotals = todaysTables.reduce((sum, t) => sum + App.computeTableTotal(t), 0);
        const totalTips = todaysTables.reduce((sum, t) => sum + (t.tip || 0), 0);

        const itemCounts = {};
        const itemRevenue = {};
        todaysTables.forEach(t => {
            for (const [id, qty] of Object.entries(t.order)) {
                itemCounts[id] = (itemCounts[id] || 0) + qty;
                const line = App.computeLine(id, qty);
                itemRevenue[id] = (itemRevenue[id] || 0) + line.total;
            }
        });
        return { totalSubtotals, totalTips, tablesCount: todaysTables.length, itemCounts, itemRevenue, unpaidTablesToday };
    };

    App.computeMonthlyTimeline = function(monthsBack = 6) {
        const now = new Date();
        const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const chargedTables = App.AppState.tables.filter(t => t.charged && !t.archived && t.paidAt);
        const timeline = [];
        for (let i = monthsBack - 1; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getTime();
            const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1).getTime();
            const monthTables = chargedTables.filter(t => t.paidAt >= start && t.paidAt < end);
            const subtotal = monthTables.reduce((s, t) => s + App.computeTableTotal(t), 0);
            const tips = monthTables.reduce((s, t) => s + (t.tip || 0), 0);
            timeline.push({
                key: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
                label: `${monthNames[monthDate.getMonth()]} ${String(monthDate.getFullYear()).slice(-2)}`,
                subtotal,
                tips,
                total: subtotal + tips,
                tablesCount: monthTables.length,
            });
        }
        return timeline;
    };

    App.toast = function(message, type = 'success', timeout = 2000) {
        const w = App.$('#toast-wrap');
        if (!w) return;
        const e = document.createElement('div');
        const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-gray-800';
        e.className = `pointer-events-auto text-white ${bg} shadow-lg rounded-xl px-4 py-2 text-sm opacity-0 translate-y-2 transition-[opacity,transform] duration-200`;
        e.textContent = message;
        w.appendChild(e);
        requestAnimationFrame(() => e.classList.remove('opacity-0', 'translate-y-2'));
        setTimeout(() => {
            e.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => e.remove(), 200);
        }, timeout);
    };
})();
