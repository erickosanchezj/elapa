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
    // Option groups for one order line, e.g. [{ qty: 2, mods: ['Sin Cebolla'] }] (ticket.html, option C).
    // Tacos outside every group are "normales". Old saves stored one list for the whole line: read it as one group.
    App.modGroups = function(modifiers, itemId, qty) {
        const raw = (modifiers || {})[itemId];
        if (!Array.isArray(raw) || !raw.length) return [];
        if (typeof raw[0] === 'string') return [{ qty, mods: raw }];
        return raw.filter(g => g && g.qty > 0 && Array.isArray(g.mods) && g.mods.length);
    };
    // Short text for those groups: "Sin Cebolla" when it covers the whole line,
    // otherwise "2 Sin Cebolla · 1 Sin Piña · 1 normal".
    App.describeMods = function(groups, qty) {
        if (!groups.length) return '';
        if (groups.length === 1 && groups[0].qty >= qty) return groups[0].mods.join(', ');
        const rest = qty - groups.reduce((sum, g) => sum + g.qty, 0);
        const parts = groups.map(g => `${g.qty} ${g.mods.join(', ')}`);
        if (rest > 0) parts.push(`${rest} ${rest === 1 ? 'normal' : 'normales'}`);
        return parts.join(' · ');
    };
    // Amount per product for one table. Paid tables use what checkout saved (checkoutLines).
    // Older paid tables (before checkoutLines) split their frozen subtotal in proportion to today's
    // prices, so the parts still add up to what was charged; `estimated` marks that case.
    App.lineAmounts = function(table) {
        const entries = Object.entries(table.order || {}).filter(([, qty]) => qty > 0);
        const saved = table.charged && table.checkoutLines;
        const amounts = Object.fromEntries(entries.map(([id, qty]) =>
            [id, saved && Number.isFinite(saved[id]) ? saved[id] : App.computeLine(id, qty).total]));
        if (!table.charged || saved) return { amounts, estimated: false };
        const sum = Object.values(amounts).reduce((a, b) => a + b, 0);
        const scale = sum ? App.computeTableTotal(table) / sum : 0;
        Object.keys(amounts).forEach(id => { amounts[id] *= scale; });
        return { amounts, estimated: true };
    };
    App.closeTable = function(table) {
        if (!table || table.charged) return false;
        const paidAt = Date.now();
        table.checkoutSubtotal = App.computeTableTotal(table);
        // Freeze what each line cost and the 2x1 savings, so receipts and reports never use later prices.
        table.checkoutLines = Object.fromEntries(Object.entries(table.order || {})
            .map(([itemId, qty]) => [itemId, App.computeLine(itemId, qty).total]));
        const pastorQty = (table.order || {}).taco_pastor || 0;
        const pastor = App.computeLine('taco_pastor', pastorQty);
        table.checkoutPromo = { qty: pastorQty - pastor.chargedQty, value: (pastorQty - pastor.chargedQty) * pastor.unit };
        table.charged = true;
        table.paidAt = paidAt;
        table.openDurationMs = paidAt - (table.createdAt || paidAt);
        App.persist();
        return true;
    };
    // 2x1 savings saved at checkout: { qty: free pastor tacos, value: pesos }. Tables paid before
    // checkoutPromo existed used the old always-on Monday/Wednesday rule, so it is rebuilt from the paid day.
    App.promoSaved = function(t, lines = App.lineAmounts(t)) {
        if (t.checkoutPromo) return t.checkoutPromo;
        const qty = (t.order || {}).taco_pastor || 0;
        const day = new Date(t.paidAt).getDay();
        if (!qty || (day !== 1 && day !== 3)) return { qty: 0, value: 0 };
        const charged = Math.ceil(qty / 2);
        return { qty: qty - charged, value: (qty - charged) * (lines.amounts.taco_pastor / charged) };
    };

    // Sales report for tables paid in [startMs, endMs); archived tables are left out.
    // Used by the floor KPIs, the "Reporte del día" dialog (report.js) and reporte.html.
    App.computeReport = function(startMs, endMs) {
        const inRange = ms => ms >= startMs && ms < endMs;
        const paid = App.AppState.tables.filter(t => t.charged && !t.archived && t.paidAt && inRange(t.paidAt));
        const report = { tables: paid, tablesCount: paid.length, totalSubtotals: 0, totalTips: 0, durationMs: 0,
            itemCounts: {}, itemRevenue: {}, byHour: Array(24).fill(0), tablesByHour: Array(24).fill(0),
            promo: { qty: 0, value: 0, days: new Set() }, estimated: false };
        paid.forEach(t => {
            const subtotal = App.computeTableTotal(t);
            const hour = new Date(t.paidAt).getHours();
            report.totalSubtotals += subtotal;
            report.totalTips += t.tip || 0;
            report.durationMs += t.openDurationMs || 0;
            report.byHour[hour] += subtotal;
            report.tablesByHour[hour] += 1;
            const lines = App.lineAmounts(t); // charged amounts, not today's prices
            report.estimated = report.estimated || lines.estimated;
            for (const [id, amount] of Object.entries(lines.amounts)) {
                report.itemCounts[id] = (report.itemCounts[id] || 0) + t.order[id];
                report.itemRevenue[id] = (report.itemRevenue[id] || 0) + amount;
            }
            const promo = App.promoSaved(t, lines);
            if (promo.qty > 0) {
                report.promo.qty += promo.qty;
                report.promo.value += promo.value;
                report.promo.days.add(new Date(t.paidAt).toDateString());
            }
        });
        report.unpaidTables = App.AppState.tables.filter(t => !t.charged && inRange(t.createdAt || 0))
            .map(t => ({ id: t.id, name: t.name, note: t.note, createdAt: t.createdAt, total: App.computeTableTotal(t) }));
        report.unpaidTablesToday = report.unpaidTables; // name kept for report.js
        return report;
    };
    App.computeDailyReport = () => App.computeReport(new Date().setHours(0, 0, 0, 0), Infinity);

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
