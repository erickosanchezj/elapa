(function() {
    'use strict';
    
    window.TaqueriaApp = {};
    const App = window.TaqueriaApp;

    App.AppState = { items: [], prices: {}, promoEnabled: null, tables: [], pricesCollapsed: null, currentTableId: null, quickPresets: [], uiDense: false, uiHighContrast: false, menuSearch: '', menuCategory: 'all' };

    App.$ = sel => document.querySelector(sel);
    App.$$ = sel => document.querySelectorAll(sel);
    App.money = n => '$' + (n || 0).toFixed(2);
    App.uid = () => 'id_' + Math.random().toString(36).slice(2, 10);
    App.isMonOrWed = () => { const d = new Date().getDay(); return d === 1 || d === 3; };
    App.formatElapsedTime = ms => { const m = Math.floor(ms / 60000); if (m < 1) return 'hace un momento'; if (m === 1) return 'hace 1 min'; return `hace ${m} min`; };
    App.formatDuration = ms => { if (!ms && ms !== 0) return ''; const m = Math.round(ms / 60000); if (m < 1) return 'Abierta por < 1 min'; return `Abierta por ${m} min`; };
    App.ensureRoundsShape = table => {
        if (!table) return;
        if (!Array.isArray(table.rounds)) table.rounds = [];
        if (!Array.isArray(table.friends)) table.friends = [];
    };

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
        App.AppState.promoEnabled = JSON.parse(localStorage.getItem('tacos_promoEnabled') || 'null');
        if (App.AppState.promoEnabled === null) App.AppState.promoEnabled = false;
        App.AppState.tables = JSON.parse(localStorage.getItem('tacos_tables') || '[]');
        const storedPresets = JSON.parse(localStorage.getItem('tacos_quick_presets') || 'null');
        App.AppState.quickPresets = Array.isArray(storedPresets) && storedPresets.length ? storedPresets : DEFAULT_QUICK_PRESETS.slice();
        App.AppState.tables.forEach(App.ensureRoundsShape);
        BASE_ITEMS.forEach(b => { if (!App.AppState.items.find(x => x.id === b.id)) App.AppState.items.unshift(b); if (!(b.id in App.AppState.prices)) App.AppState.prices[b.id] = DEFAULT_PRICES[b.id] || 0; });
        App.AppState.items = App.AppState.items
            .filter(it => !REMOVED_ITEMS.includes(it.id))
            .map(it => App.mergeItemDefaults(it));
        REMOVED_ITEMS.forEach(id => { delete App.AppState.prices[id]; });
        App.AppState.quickPresets = App.AppState.quickPresets.filter(p => p && p.itemId && p.qty > 0);
        if(localStorage.getItem('tacos_tables_v2')) { App.AppState.tables = JSON.parse(localStorage.getItem('tacos_tables_v2')); localStorage.setItem('tacos_tables', localStorage.getItem('tacos_tables_v2')); localStorage.removeItem('tacos_tables_v2'); }
        App.AppState.uiDense = Boolean(JSON.parse(localStorage.getItem('tacos_ui_dense') || 'false'));
        App.AppState.uiHighContrast = Boolean(JSON.parse(localStorage.getItem('tacos_ui_high_contrast') || 'false'));
    };

    App.isPastorPromoActive = function() {
        return App.isMonOrWed();
    };

    App.persist = function() {
        localStorage.setItem('tacos_items', JSON.stringify(App.AppState.items));
        localStorage.setItem('tacos_prices', JSON.stringify(App.AppState.prices));
        localStorage.setItem('tacos_promoEnabled', JSON.stringify(App.AppState.promoEnabled));
        localStorage.setItem('tacos_tables', JSON.stringify(App.AppState.tables));
        localStorage.setItem('tacos_quick_presets', JSON.stringify(App.AppState.quickPresets));
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

    App.computeLine = function(itemId, qty) {
        const p = App.AppState.prices[itemId] || 0;
        let c = qty;
        if (itemId === 'taco_pastor' && App.isPastorPromoActive()) {
            c = Math.ceil(qty / 2);
        }
        return { unit: p, chargedQty: c, total: c * p };
    };
    
    App.computeTableTotal = function(table) {
        return Object.entries(table.order).reduce((s, [i, q]) => s + App.computeLine(i, q).total, 0);
    };

    App.computeGrandTotalActive = function() {
        return App.AppState.tables.filter(t => !t.charged).reduce((a, t) => a + App.computeTableTotal(t), 0);
    };

    App.computeRoundsTotal = function(table) {
        if (!table) return 0;
        App.ensureRoundsShape(table);
        return table.rounds.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    };

    App.getFriendsForTable = function(table) {
        if (!table) return [];
        App.ensureRoundsShape(table);
        const seen = new Set();
        const friends = [];
        const add = name => {
            const clean = (name || '').trim();
            if (!clean) return;
            const key = clean.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            friends.push(clean);
        };
        (table.friends || []).forEach(add);
        (table.rounds || []).forEach(r => add(r.payer));
        return friends;
    };

    App.computeFriendBalances = function(table) {
        if (!table) return [];
        App.ensureRoundsShape(table);
        const friends = App.getFriendsForTable(table);
        if (!friends.length) return [];
        const total = App.computeTableTotal(table) + (table.tip || 0);
        const share = friends.length ? total / friends.length : 0;
        const paidMap = {};
        (table.rounds || []).forEach(r => {
            const name = (r.payer || '').trim().toLowerCase();
            if (!name) return;
            paidMap[name] = (paidMap[name] || 0) + (Number(r.amount) || 0);
        });
        return friends.map(name => {
            const paid = paidMap[name.toLowerCase()] || 0;
            const balance = paid - share;
            return { name, paid, shouldPay: share, balance };
        });
    };
    
    App.computeDailyReport = function(){
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const todaysTables = App.AppState.tables.filter(t => t.charged && t.paidAt && t.paidAt >= todayStart.getTime());
        
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
        
        return { totalSubtotals, totalTips, tablesCount: todaysTables.length, itemCounts, itemRevenue };
    };

    App.toast = function(message, type = 'success', timeout = 2000, opts = {}) {
        const w = App.$('#toast-wrap');
        if (!w) return;
        const e = document.createElement('div');
        const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-gray-800';
        e.className = `pointer-events-auto text-white ${bg} shadow-lg rounded-xl px-4 py-2 text-sm opacity-0 translate-y-2 transition-all duration-200`;
        e.textContent = message;
        if (opts.confetti) e.classList.add('toast-with-confetti');
        w.appendChild(e);
        if (opts.confetti) {
            const colors = ['#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#a855f7'];
            for (let i = 0; i < 8; i++) {
                const dot = document.createElement('span');
                dot.className = 'confetti-piece';
                dot.style.backgroundColor = colors[i % colors.length];
                dot.style.left = `${45 + Math.random() * 20}%`;
                dot.style.setProperty('--confetti-x', `${Math.random() * 40 - 20}px`);
                dot.style.animationDelay = `${i * 12}ms`;
                e.appendChild(dot);
                setTimeout(() => dot.remove(), 700);
            }
        }
        requestAnimationFrame(() => e.classList.remove('opacity-0', 'translate-y-2'));
        setTimeout(() => {
            e.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => e.remove(), 200);
        }, timeout);
    };

    App.handleSW = function() {
        const versionEl = App.$('#app-version');
        const statusEl = App.$('#net-status');

        const updateNetStatus = () => {
            if (!statusEl) return;
            statusEl.textContent = navigator.onLine ? '· en línea' : '· sin conexión';
            statusEl.className = navigator.onLine ? 'ml-2 text-emerald-600' : 'ml-2 text-red-600';
        };

        async function requestSwVersion(config = { timeoutMs: 2000 }) {
            if (!("serviceWorker" in navigator)) throw new Error("SW not supported");
            const reg = await navigator.serviceWorker.ready;
            const sw = reg.active || reg.waiting || reg.installing;
            if (!sw) throw new Error("No active SW");
            const channel = new MessageChannel();
            const promise = new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error("SW version timeout")), config.timeoutMs);
                channel.port1.onmessage = event => {
                    clearTimeout(timer);
                    if (event.data && event.data.type === "VERSION") {
                        resolve(event.data.version);
                    } else {
                        reject(new Error("Bad SW version response"));
                    }
                };
            });
            sw.postMessage({ type: "GET_VERSION" }, [channel.port2]);
            return promise;
        }

        async function showVersion() {
            if (!versionEl) return;
            try {
                const version = await requestSwVersion({ timeoutMs: 2500 });
                versionEl.textContent = version;
                localStorage.setItem("tacos_sw_version", version);
            } catch {
                const cachedVersion = localStorage.getItem("tacos_sw_version");
                versionEl.textContent = cachedVersion ? `${cachedVersion} (cache)` : "desconocida";
            }
        }

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./service-worker.js')
                    .then(() => navigator.serviceWorker.ready)
                    .then(() => {
                        updateNetStatus();
                        return showVersion();
                    }).catch(() => {
                        if (versionEl) versionEl.textContent = 'sin SW';
                        updateNetStatus();
                    });
            });
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                App.toast('Actualizando versión…', 'info', 1500);
                setTimeout(showVersion, 400);
            });
        } else {
            if (versionEl) versionEl.textContent = 'no compatible';
            updateNetStatus();
        }
        window.addEventListener('online', updateNetStatus);
        window.addEventListener('offline', updateNetStatus);
    };
})();
