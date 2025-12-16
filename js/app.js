(function() {
    'use strict';
    
    window.TaqueriaApp = {};
    const App = window.TaqueriaApp;

    App.AppState = { items: [], prices: {}, promoEnabled: null, tables: [], pricesCollapsed: null, currentTableId: null };

    App.$ = sel => document.querySelector(sel);
    App.$$ = sel => document.querySelectorAll(sel);
    App.money = n => '$' + (n || 0).toFixed(2);
    App.uid = () => 'id_' + Math.random().toString(36).slice(2, 10);
    App.isMonOrWed = () => { const d = new Date().getDay(); return d === 1 || d === 3; };
    App.formatElapsedTime = ms => { const m = Math.floor(ms / 60000); if (m < 1) return 'hace un momento'; if (m === 1) return 'hace 1 min'; return `hace ${m} min`; };
    App.formatDuration = ms => { if (!ms && ms !== 0) return ''; const m = Math.round(ms / 60000); if (m < 1) return 'Abierta por < 1 min'; return `Abierta por ${m} min`; };

    const BASE_ITEMS = [
        { id: 'taco_pastor', label: 'Taco de Pastor', base: true },
        { id: 'taco_suadero', label: 'Taco de Suadero', base: true },
        { id: 'taco_carbon', label: 'Taco al Carbón', base: true },
        { id: 'taco_tripa', label: 'Taco de Tripa', base: true },
        { id: 'taco_cabeza', label: 'Taco de Cabeza', base: true },
        { id: 'gringas', label: 'Gringas', base: true },
        { id: 'refresco', label: 'Refresco', base: true },
        { id: 'cerveza', label: 'Cerveza', base: true },
    ];
    const DEFAULT_PRICES = { refresco: 27.00, taco_pastor: 17.00, taco_suadero: 17.00, taco_carbon: 40.00, taco_tripa: 18.00, taco_cabeza: 17.00, gringas: 80.00, cerveza: 35.00 };

    App.loadState = function() {
        App.AppState.items = JSON.parse(localStorage.getItem('tacos_items') || 'null') || BASE_ITEMS.slice();
        App.AppState.prices = JSON.parse(localStorage.getItem('tacos_prices') || 'null') || { ...DEFAULT_PRICES };
        App.AppState.promoEnabled = JSON.parse(localStorage.getItem('tacos_promoEnabled') || 'null');
        if (App.AppState.promoEnabled === null) App.AppState.promoEnabled = false;
        App.AppState.tables = JSON.parse(localStorage.getItem('tacos_tables') || '[]');
        BASE_ITEMS.forEach(b => { if (!App.AppState.items.find(x => x.id === b.id)) App.AppState.items.unshift(b); if (!(b.id in App.AppState.prices)) App.AppState.prices[b.id] = DEFAULT_PRICES[b.id] || 0; });
        if(localStorage.getItem('tacos_tables_v2')) { App.AppState.tables = JSON.parse(localStorage.getItem('tacos_tables_v2')); localStorage.setItem('tacos_tables', localStorage.getItem('tacos_tables_v2')); localStorage.removeItem('tacos_tables_v2'); }
    };

    App.isPastorPromoActive = function() {
        return App.isMonOrWed();
    };

    App.persist = function() {
        localStorage.setItem('tacos_items', JSON.stringify(App.AppState.items));
        localStorage.setItem('tacos_prices', JSON.stringify(App.AppState.prices));
        localStorage.setItem('tacos_promoEnabled', JSON.stringify(App.AppState.promoEnabled));
        localStorage.setItem('tacos_tables', JSON.stringify(App.AppState.tables));
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

    App.toast = function(message, type = 'success', timeout = 2000) {
        const w = App.$('#toast-wrap');
        if (!w) return;
        const e = document.createElement('div');
        const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-gray-800';
        e.className = `pointer-events-auto text-white ${bg} shadow-lg rounded-xl px-4 py-2 text-sm opacity-0 translate-y-2 transition-all duration-200`;
        e.textContent = message;
        w.appendChild(e);
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
