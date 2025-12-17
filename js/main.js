// /js/main.js
// This file handles the main application logic for the table management view.
// It exists to keep the main HTML file clean and to modularize the JavaScript code.
// RELEVANT FILES: index.html, js/app.js
document.addEventListener('DOMContentLoaded', () => {
    const App = window.TaqueriaApp;
    let currentTipState = { tableId: null, subtotal: 0, tip: 0 };

    function syncUiPrefs() {
        App.applyUiPrefs();
        const denseBtn = App.$('#toggle-dense');
        if (denseBtn) denseBtn.setAttribute('aria-pressed', String(App.AppState.uiDense));
        const contrastBtn = App.$('#toggle-contrast');
        if (contrastBtn) contrastBtn.setAttribute('aria-pressed', String(App.AppState.uiHighContrast));
    }

    function triggerAddFx(btn) {
        if (!btn) return;
        btn.classList.remove('btn-pulse');
        btn.offsetWidth; // force reflow to restart animation
        btn.classList.add('btn-pulse');
    }

    function syncSearchField() {
        const input = App.$('#menu-search');
        const clearBtn = App.$('#menu-search-clear');
        if (input) input.value = App.AppState.menuSearch || '';
        if (clearBtn) clearBtn.classList.toggle('hidden', !(App.AppState.menuSearch || '').length);
    }

    function focusMenuSearch() {
        const input = App.$('#menu-search');
        if (input) {
            input.focus();
            input.select();
        }
    }

    function render() {
        syncUiPrefs();
        syncSearchField();
        renderTables();
        updateTimers();
        const table = App.AppState.tables.find(t => t.id === App.AppState.currentTableId);
        if (table) {
            openDrawer(table, false);
        }
    }

    function renderTables() {
        const grid = App.$('#tables-grid');
        grid.innerHTML = '';
        if (App.AppState.tables.length === 0) {
            grid.innerHTML = `<div class="text-gray-500 dark:text-gray-400 italic">No hay mesas.</div>`;
            return;
        }
          const sortedTables = [...App.AppState.tables].sort((a, b) => {
              const getTimestamp = table => table.charged ? (table.paidAt || table.createdAt || 0) : (table.createdAt || 0);
              return getTimestamp(b) - getTimestamp(a);
          });
          sortedTables.forEach(t => {
              const subtotal = App.computeTableTotal(t);
              const finalTotal = subtotal + (t.charged ? t.tip : 0);
              const card = document.createElement('div');
              card.className = 'card bg-white dark:bg-gray-800 rounded-xl shadow p-5 cursor-pointer relative border-l-4';
              card.dataset.tableId = t.id;
              const timeInfoHtml = t.charged && t.openDurationMs
                  ? App.formatDuration(t.openDurationMs)
                  : !t.charged && t.createdAt
                  ? `<div data-created-at="${t.createdAt}"></div>`
                  : '';
              card.innerHTML = `
                  <div class=\"absolute top-3 right-3 flex gap-2\">${t.charged ? `<span class=\"badge bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-white\">COBRADA</span>` : ''}</div>
                  <h3 class=\"text-xl font-bold\">${t.name}</h3>
                  <p class=\"text-sm text-gray-500 dark:text-gray-400 min-h-[20px]\">${t.note || ''}</p>
                  <div class=\"mt-2 flex items-end justify-between\">
                      <div>
                          <span class=\"text-gray-600 dark:text-gray-300\">Total</span>
                          <div class=\"text-xl font-extrabold\">${App.money(finalTotal)}</div>
                          ${t.charged && t.tip ? `<div class=\"text-sm text-amber-600 dark:text-amber-400\">Propina: ${App.money(t.tip)}</div>` : ''}
                      </div>
                      <div class=\"text-xs text-gray-500 dark:text-gray-400\">${timeInfoHtml}</div>
                  </div>`;
              grid.appendChild(card);
          });
        App.$('#grand-total').textContent = 'TOTAL (activas): ' + App.money(App.computeGrandTotalActive());
    }

    function renderMenuList(table) {
        const menu = App.$('#menu-list');
        const quick = App.$('#quick-add');
        menu.innerHTML = '';
        quick.innerHTML = '';
        const isDisabled = table.charged ? 'opacity-50 pointer-events-none' : '';
        const filter = (App.AppState.menuSearch || '').trim().toLowerCase();

        const presets = App.AppState.quickPresets || [];
        if (presets.length === 0) {
            quick.innerHTML = `<div class="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/60 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">Configura accesos rápidos para tus combos frecuentes.</div>`;
        } else {
            presets.forEach(preset => {
                const item = App.AppState.items.find(i => i.id === preset.itemId);
                if (!item || !preset.qty) return;
                const label = preset.label && preset.label.trim() ? preset.label : `${preset.qty} × ${item.label}`;
                const btn = document.createElement('button');
                btn.dataset.add = preset.itemId;
                btn.dataset.delta = preset.qty;
                btn.className = `bg-yellow-500 hover:bg-yellow-600 text-white text-sm px-3 py-2 rounded-lg ${isDisabled}`;
                btn.textContent = label;
                quick.appendChild(btn);
            });
        }

        const listItems = App.AppState.items.filter(it => !filter || it.label.toLowerCase().includes(filter));
        if (listItems.length === 0) {
            menu.innerHTML = `<div class="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/60 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">Sin productos que coincidan.</div>`;
            return;
        }
        listItems.forEach(it => {
            const qty = table.order[it.id] || 0;
            const promoBadge = (it.id === 'taco_pastor' && App.isPastorPromoActive()) ? '<span class="ml-2 badge bg-red-500 text-white">2x1</span>' : '';
            const row = document.createElement('div');
            row.className = `flex items-center justify-between bg-white dark:bg-gray-800 border rounded-lg dark:border-gray-600 p-3 ${isDisabled}`;
            row.innerHTML = `
                <div>
                    <div class="font-semibold flex items-center">${it.label} ${promoBadge}</div>
                    <div class="text-gray-600 dark:text-gray-300 text-sm">${App.money(App.AppState.prices[it.id] || 0)} c/u</div>
                </div>
                <div class="flex items-center gap-2">
                    <button data-minus="${it.id}" class="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 font-bold dark:bg-gray-700 dark:hover:bg-gray-600">−</button>
                    <input data-qty="${it.id}" type="number" min="0" value="${qty}" class="w-16 text-center border rounded-md p-1 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
                    <button data-plus="${it.id}" class="w-8 h-8 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold">+</button>
                    <div class="flex gap-1">
                        <button data-add="${it.id}" data-delta="2" class="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 font-bold dark:bg-gray-700 dark:hover:bg-gray-600">2</button>
                        <button data-add="${it.id}" data-delta="4" class="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 font-bold dark:bg-gray-700 dark:hover:bg-gray-600">4</button>
                        <button data-add="${it.id}" data-delta="6" class="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 font-bold dark:bg-gray-700 dark:hover:bg-gray-600">6</button>
                    </div>
                </div>`;
            menu.appendChild(row);
        });
    }

    function refreshQuickAddArea() {
        const currentTable = App.AppState.tables.find(t => t.id === App.AppState.currentTableId);
        if (currentTable) {
            renderMenuList(currentTable);
        }
    }

    function renderQuickPresetEditor() {
        const list = App.$('#preset-list');
        if (!list) return;
        list.innerHTML = '';
        const presets = App.AppState.quickPresets || [];
        if (presets.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/60 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2';
            empty.textContent = 'No hay accesos rápidos. Agrega uno nuevo.';
            list.appendChild(empty);
            return;
        }

        presets.forEach(preset => {
            const row = document.createElement('div');
            row.className = 'grid grid-cols-12 gap-3 items-center bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-lg p-3';
            
            const labelInput = document.createElement('input');
            labelInput.type = 'text';
            labelInput.placeholder = 'Etiqueta';
            labelInput.value = preset.label || '';
            labelInput.dataset.presetId = preset.id;
            labelInput.dataset.field = 'label';
            labelInput.className = 'col-span-5 p-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100';

            const select = document.createElement('select');
            select.dataset.presetId = preset.id;
            select.dataset.field = 'itemId';
            select.className = 'col-span-5 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-yellow-500 focus:border-transparent';
            App.AppState.items.forEach(it => {
                const opt = document.createElement('option');
                opt.value = it.id;
                opt.textContent = it.label;
                if (it.id === preset.itemId) opt.selected = true;
                select.appendChild(opt);
            });

            const qtyInput = document.createElement('input');
            qtyInput.type = 'number';
            qtyInput.min = '1';
            qtyInput.value = preset.qty || 1;
            qtyInput.dataset.presetId = preset.id;
            qtyInput.dataset.field = 'qty';
            qtyInput.className = 'col-span-1 p-2 border rounded-lg text-center dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-yellow-500 focus:border-transparent';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.dataset.deletePreset = preset.id;
            deleteBtn.className = 'col-span-1 text-red-600 hover:text-red-700 font-semibold';
            deleteBtn.textContent = '✕';

            row.appendChild(labelInput);
            row.appendChild(select);
            row.appendChild(qtyInput);
            row.appendChild(deleteBtn);
            list.appendChild(row);
        });
    }

    function renderTableSummary(table) {
        const box = App.$('#table-summary');
        box.innerHTML = '';
        if (Object.keys(table.order).length === 0) {
            box.innerHTML = '<div class="text-gray-500 dark:text-gray-400">Sin productos aún.</div>';
            return;
        }
          const ul = document.createElement('ul');
          ul.className = 'space-y-1';
          for (const [itemId, qty] of Object.entries(table.order)) {
              const item = App.AppState.items.find(i => i.id === itemId);
              const label = item ? item.label : itemId;
              const { chargedQty, total } = App.computeLine(itemId, qty);
              const li = document.createElement('li');
              li.className = 'flex items-center justify-between';
              li.innerHTML = `
                  <span>${qty} × ${label} ${itemId === 'taco_pastor' && App.isPastorPromoActive() ? `(Pagas ${chargedQty})` : ''}</span>
                  <span class="font-semibold">${App.money(total)}</span>`;
              ul.appendChild(li);
          }
          box.appendChild(ul);
          if (table.charged && table.tip) {
              const tipRow = document.createElement('div');
              tipRow.className = 'mt-2 flex items-center justify-between text-sm text-amber-600 dark:text-amber-400';
              tipRow.innerHTML = `<span>Propina</span><span class="font-semibold">${App.money(table.tip)}</span>`;
              box.appendChild(tipRow);
          }
      }

    function renderDrawerActions(table) {
        const wrapper = App.$('#drawer-actions');
          if (table.charged) {
              wrapper.innerHTML = `
                  <button id=\"print-bill\" class=\"col-span-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg dark:bg-blue-600 dark:hover:bg-blue-500\">Imprimir Cuenta</button>
                  <button id=\"reopen-table\" class=\"col-span-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-lg dark:bg-amber-600 dark:hover:bg-amber-500\">Reabrir Mesa</button>
                  <button id=\"delete-table\" class="col-span-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-lg dark:bg-red-600 dark:hover:bg-red-500">Eliminar</button>`;
          } else {
              wrapper.innerHTML = `
                  <button id="print-bill" class="col-span-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg dark:bg-blue-600 dark:hover:bg-blue-500">Imprimir Cuenta</button>
                  <button id="close-table" class="col-span-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg dark:bg-green-600 dark:hover:bg-green-500">Cobrar & Cerrar</button>
                  <button id="clear-table" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded-lg text-sm dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100">Limpiar</button>
                  <button id="delete-table" class="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 rounded-lg text-sm dark:bg-red-600 dark:hover:bg-red-500">Eliminar</button>`;
        }
    }

    function renderDailyReport() {
        const report = App.computeDailyReport();
        const summaryContainer = App.$("#report-summary");
        summaryContainer.innerHTML = `
            <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div class="text-sm text-gray-700 dark:text-gray-300">Ventas (Subtotal)</div>
                <div class="text-2xl font-extrabold text-gray-800 dark:text-gray-100">${App.money(report.totalSubtotals)}</div>
            </div>
            <div class="bg-amber-50 dark:bg-amber-700 p-4 rounded-lg">
                <div class="text-sm text-amber-700 dark:text-amber-200">Propinas</div>
                <div class="text-2xl font-extrabold text-amber-800 dark:text-amber-100">${App.money(report.totalTips)}</div>
            </div>
            <div class="bg-green-50 dark:bg-green-700 p-4 rounded-lg">
                <div class="text-sm text-green-700 dark:text-green-200">Total Cobrado</div>
                <div class="text-2xl font-extrabold text-green-800 dark:text-green-100">${App.money(report.totalSubtotals + report.totalTips)}</div>
            </div>`;

        const itemsContainer = App.$("#report-items-breakdown");
        itemsContainer.innerHTML = "";
        const sortedItems = Object.entries(report.itemCounts).sort((a, b) => b[1] - a[1]);

        if (sortedItems.length === 0) {
            itemsContainer.innerHTML = '<div class="text-gray-500 dark:text-gray-400 italic">No hay ventas registradas hoy.</div>';
            return;
        }

        sortedItems.forEach(([itemId, count]) => {
            const item = App.AppState.items.find(i => i.id === itemId);
            const label = item ? item.label : itemId;
            const revenue = report.itemRevenue[itemId] || 0;
            const el = document.createElement("div");
            el.className = "flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-lg";
            el.innerHTML = `
                <span class=\"font-medium text-gray-800 dark:text-gray-100\">${label}</span>
                <div class=\"text-right\">
                    <span class=\"font-bold text-lg\">${count}</span>
                    <span class=\"ml-2 text-sm text-gray-600 dark:text-gray-300\">${App.money(revenue)}</span>
                </div>`;
            itemsContainer.appendChild(el);
        });
    }

    function openQuickPresetsModal() {
        renderQuickPresetEditor();
        App.$('#quick-presets-modal')?.classList.remove('hidden');
    }

    function closeQuickPresetsModal() {
        App.$('#quick-presets-modal')?.classList.add('hidden');
    }

    function addQuickPreset() {
        const firstItem = App.AppState.items[0];
        if (!firstItem) return alert('No hay productos en el menú. Primero agrega productos en Precios.');
        App.AppState.quickPresets.push({ id: App.uid(), label: `Nuevo preset (${firstItem.label})`, itemId: firstItem.id, qty: 1 });
        App.persist();
        renderQuickPresetEditor();
        refreshQuickAddArea();
    }

    function resetQuickPresets() {
        if (!confirm('¿Restablecer los accesos rápidos predeterminados?')) return;
        App.AppState.quickPresets = (App.DEFAULT_QUICK_PRESETS || []).slice();
        App.persist();
        renderQuickPresetEditor();
        refreshQuickAddArea();
    }

    function addTable() {
        const name = App.$('#table-name').value.trim();
        const note = App.$('#table-note').value.trim();
        if (!name) return alert('Escribe un nombre o número de mesa.');
        App.AppState.tables.push({ id: App.uid(), name, note, order: {}, charged: false, paidAt: null, createdAt: Date.now(), openDurationMs: null, tip: 0 });
        App.$('#table-name').value = '';
        App.$('#table-note').value = '';
        App.persist();
        render();
        App.toast('Mesa creada', 'success');
    }

    function finalizeCloseTable(tableId, tipAmount) {
        const table = App.AppState.tables.find(t => t.id === tableId);
        if (!table) return;
        table.charged = true;
        table.paidAt = Date.now();
        table.openDurationMs = table.paidAt - table.createdAt;
        table.tip = tipAmount;
        App.persist();
        render();
        closeTipModal();
        App.toast(`Mesa ${table.name} cobrada`, 'success');
    }

    function reopenTable(tableId) {
        const table = App.AppState.tables.find(t => t.id === tableId);
        if (!table || !table.charged) return;
        if (!confirm(`Reabrir ${table.name}?`)) return;
        table.charged = false;
        table.paidAt = null;
        table.openDurationMs = null;
        table.tip = 0;
        App.persist();
        render();
        App.toast('Mesa reabierta', 'info');
    }

    function deleteTable(tableId) {
        if (!confirm(`Eliminar mesa? Esta acción no se puede deshacer.`)) return;
        App.AppState.tables = App.AppState.tables.filter(t => t.id !== tableId);
        App.persist();
        closeDrawer();
        render();
        App.toast('Mesa eliminada', 'info');
    }

    function changeQty(tableId, itemId, delta) {
        const table = App.AppState.tables.find(t => t.id === tableId);
        if (!table || table.charged) return;
        const currentQty = table.order[itemId] || 0;
        const nextQty = Math.max(0, currentQty + delta);
        if (nextQty === 0) {
            delete table.order[itemId];
        } else {
            table.order[itemId] = nextQty;
        }
        App.persist();
        render();
    }

    function setQty(tableId, itemId, qty) {
        const table = App.AppState.tables.find(t => t.id === tableId);
        if (!table || table.charged) return;
        if (qty === 0) {
            delete table.order[itemId];
        } else {
            table.order[itemId] = qty;
        }
        App.persist();
        render();
    }

    function clearTable(tableId) {
        const table = App.AppState.tables.find(t => t.id === tableId);
        if (table && !table.charged && confirm(`Limpiar orden de ${table.name}?`)) {
            table.order = {};
            App.persist();
            render();
            App.toast("Mesa limpiada", "info");
        }
    }

    function closeAllTables() {
        const activeTables = App.AppState.tables.filter(t => !t.charged);
        if (activeTables.length === 0) return alert("No hay mesas activas.");
        if (!confirm(`Cobrar & Cerrar TODAS las mesas activas (SIN propina)?`)) return;
        activeTables.forEach(t => {
            t.charged = true;
            t.paidAt = Date.now();
            t.openDurationMs = t.paidAt - t.createdAt;
            t.tip = 0;
        });
        App.persist();
        render();
        App.toast("Mesas activas cobradas", "success");
    }

    function printBill(tableId) {
        const table = App.AppState.tables.find(t => t.id === tableId);
        if (!table) return;

        const orderEntries = Object.entries(table.order || {});
        const rowsHtml = orderEntries.length
            ? orderEntries.map(([itemId, qty]) => {
                const item = App.AppState.items.find(i => i.id === itemId);
                const line = App.computeLine(itemId, qty);
                return `<tr><td class="qty">${qty}x</td><td class="item">${item ? item.label : "Item"}</td><td class="price">${App.money(line.total)}</td></tr>`;
            }).join("")
            : '<tr><td class="receipt-empty" colspan="3">Sin productos</td></tr>';
        const subtotal = App.computeTableTotal(table);
        const tip = table.tip || 0;
        const issuedAt = new Date().toLocaleString();
        const logoUrl = new URL('icons/icon-192.png', document.baseURI).href; // Build an absolute path so the iframe can load the logo.

        // Build inline CSS so the iframe ticket keeps our styling when it prints.
        const styleContent = `
body{font-family:'Courier New',Courier,monospace;font-size:10pt;margin:0;padding:0}
h1,h2,h3,p{margin:0}
#print-area{width:100%;padding:8px 0}
.receipt-brand{text-align:center;margin-bottom:8px}
.receipt-brand-logo{width:48px;height:48px;object-fit:contain;margin:0 auto 4px;display:block}
.receipt-brand-name{font-size:14pt;letter-spacing:1px}
.receipt-brand-tagline{font-size:8pt;text-transform:uppercase;letter-spacing:1px}
.receipt-meta{margin:6px 0;font-size:9pt;display:flex;flex-direction:column;gap:2px}
.receipt-meta-row{display:flex;justify-content:space-between}
.receipt-meta-label{font-weight:700;letter-spacing:.5px;text-transform:uppercase}
.receipt-table{width:100%;border-collapse:collapse;margin-top:4px}
.receipt-table colgroup col:first-child{width:18%}
.receipt-table colgroup col:nth-child(2){width:52%}
.receipt-table colgroup col:last-child{width:30%}
.receipt-table th,.receipt-table td{padding:4px 2px}
.receipt-table th{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.8px;text-align:left;border-bottom:1px solid #000}
.receipt-table td.qty{text-align:left}
.receipt-table td.item{text-align:left}
.receipt-table td.price{text-align:right}
.receipt-table tbody tr+tr td{border-top:1px dotted #9ca3af}
.receipt-table .receipt-empty{text-align:center;font-style:italic;padding:8px 0}
.receipt-summary{margin-top:8px;display:flex;flex-direction:column;gap:2px;font-size:10pt}
.receipt-summary-row{display:flex;justify-content:space-between}
.receipt-summary-row.total{font-weight:700;border-top:1px solid #000;margin-top:4px;padding-top:4px}
.text-right{text-align:right}
hr{border:0;border-top:1px dashed #000;margin:6px 0}
        `.trim();

        const tipRow = tip
            ? `<div class='receipt-summary-row'><span>Propina</span><span>${App.money(tip)}</span></div>`
            : "";

        // Compose the printable ticket markup with metadata, order lines, and totals.
        const ticketHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Ticket ${table.name}</title>
  <style>${styleContent}</style>
</head>
<body>
  <div id="print-area">
    <div class="receipt-brand">
      <img src="${logoUrl}" alt="Logo de Taquería El Apá" class="receipt-brand-logo"/>
      <h1 class="receipt-brand-name">Taquería &quot;El Apá&quot;</h1>
      <p class="receipt-brand-tagline">Sabor auténtico cada día</p>
    </div>
    <hr>
    <div class="receipt-meta">
      <div class="receipt-meta-row"><span class="receipt-meta-label">Mesa</span><span>${table.name}</span></div>
      <div class="receipt-meta-row"><span class="receipt-meta-label">Fecha</span><span>${issuedAt}</span></div>
    </div>
    <hr>
    <table class="receipt-table">
      <colgroup><col><col><col></colgroup>
      <thead><tr><th>Cant</th><th>Producto</th><th class="text-right">Total</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="receipt-summary">
      <div class="receipt-summary-row"><span>Subtotal</span><span>${App.money(subtotal)}</span></div>
      ${tipRow}
      <div class="receipt-summary-row total"><span>Total</span><span>${App.money(subtotal + tip)}</span></div>
    </div>
  </div>
</body>
</html>`;

        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(ticketHtml);
        doc.close();
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        document.body.removeChild(iframe);
    }

    function openDrawer(table, shouldAnimate = true) {
        if (!table) return;
        App.AppState.currentTableId = table.id;
        syncSearchField();
        App.$("#drawer-title").textContent = table.name;
          App.$("#drawer-note").textContent = table.note || "";
          App.$("#drawer-status").innerHTML = table.charged ? `<span class="badge bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-white">COBRADA</span> <span class="text-gray-500 dark:text-gray-400">— ${new Date(table.paidAt || Date.now()).toLocaleString()}</span>` : '<span class="badge bg-emerald-100 text-emerald-700">ACTIVA</span>';
          App.$("#table-total").textContent = App.money(App.computeTableTotal(table) + (table.charged ? table.tip : 0));
          renderMenuList(table);
          renderTableSummary(table);
          renderDrawerActions(table);
        if (shouldAnimate) {
            App.$("#drawer").classList.remove("translate-x-full");
            App.$("#backdrop").classList.remove("pointer-events-none", "opacity-0");
            document.documentElement.classList.add("overflow-hidden");
        }
    }

    function closeDrawer() {
        App.AppState.currentTableId = null;
        App.$("#drawer").classList.add("translate-x-full");
        App.$("#backdrop").classList.add("pointer-events-none", "opacity-0");
        document.documentElement.classList.remove("overflow-hidden");
    }

    function updateTimers() {
        const now = Date.now();
        App.$$("[data-table-id]").forEach(card => {
            const tableId = card.dataset.tableId;
            const table = App.AppState.tables.find(t => t.id === tableId);
            if (table && !table.charged && table.createdAt) {
                const timerEl = card.querySelector("[data-created-at]");
                if (timerEl) timerEl.textContent = App.formatElapsedTime(now - table.createdAt);
                const minutes = (now - table.createdAt) / 60000;
                card.style.borderColor = minutes > 30 ? "#ef4444" : minutes > 15 ? "#f59e0b" : "#22c55e";
            } else {
                card.style.borderColor = "transparent";
            }
        });
    }

    function openTipModal(tableId) {
        const table = App.AppState.tables.find(t => t.id === tableId);
        if (!table) return;
        const subtotal = App.computeTableTotal(table);
        currentTipState = { tableId, subtotal, tip: 0 };
        App.$('#tip-modal-title').textContent = `Agregar Propina a ${table.name}`;
        App.$('#tip-subtotal').textContent = App.money(subtotal);
        updateTipDisplay(0, null);
        App.$('#tip-modal').classList.remove('hidden');
    }

    function closeTipModal() {
        App.$('#tip-modal').classList.add('hidden');
    }

    function updateTipDisplay(tipAmount, selectedBtn) {
        currentTipState.tip = tipAmount;
        App.$('#tip-amount').textContent = App.money(tipAmount);
        App.$('#tip-grand-total').textContent = App.money(currentTipState.subtotal + tipAmount);
        App.$$('#tip-modal .tip-option-btn.selected').forEach(btn => btn.classList.remove('selected'));
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
        }
        if (selectedBtn?.dataset.tipPercent) {
            App.$('#tip-custom-amount').value = '';
        }
    }

    function openReportModal() {
        renderDailyReport();
        App.$("#report-modal").classList.remove("hidden");
    }

    function wireEvents() {
        App.$('#add-table').addEventListener('click', addTable);
        App.$('#close-all').addEventListener('click', closeAllTables);
        App.$('#show-report').addEventListener('click', openReportModal);
        App.$('#report-close').addEventListener('click', () => App.$("#report-modal").classList.add("hidden"));
        App.$('#toggle-dense')?.addEventListener('click', () => {
            App.AppState.uiDense = !App.AppState.uiDense;
            App.persist();
            syncUiPrefs();
            render();
        });
        App.$('#toggle-contrast')?.addEventListener('click', () => {
            App.AppState.uiHighContrast = !App.AppState.uiHighContrast;
            App.persist();
            syncUiPrefs();
        });
        App.$('#tables-grid').addEventListener('click', e => { const t = e.target.closest('[data-table-id]')?.dataset.tableId; if (t) { const a = App.AppState.tables.find(e => e.id === t); openDrawer(a); } });
        App.$('#drawer-close').addEventListener('click', closeDrawer);
        App.$('#backdrop').addEventListener('click', closeDrawer);
        App.$('#drawer-actions').addEventListener('click', e => { const t = App.AppState.currentTableId; if (!t) return; const a = e.target.id, n = {'reopen-table': reopenTable, 'delete-table': deleteTable, 'clear-table': clearTable, 'close-table': () => openTipModal(t), 'print-bill': printBill}; if (n[a]) n[a](t); });
        const menuList = App.$('#menu-list');
        const quickAdd = App.$('#quick-add');
        const menuSearch = App.$('#menu-search');
        const menuSearchClear = App.$('#menu-search-clear');
        if (menuSearch) {
            menuSearch.addEventListener('input', () => {
                App.AppState.menuSearch = menuSearch.value;
                if (menuSearchClear) menuSearchClear.classList.toggle('hidden', !menuSearch.value);
                const current = App.AppState.tables.find(t => t.id === App.AppState.currentTableId);
                if (current) renderMenuList(current);
            });
        }
        if (menuSearchClear) {
            menuSearchClear.addEventListener('click', () => {
                App.AppState.menuSearch = '';
                if (menuSearch) menuSearch.value = '';
                menuSearchClear.classList.add('hidden');
                const current = App.AppState.tables.find(t => t.id === App.AppState.currentTableId);
                if (current) renderMenuList(current);
                focusMenuSearch();
            });
        }
        const handleClick = e => {
            const t = App.AppState.currentTableId;
            if (!t) return;
            const addBtn = e.target.closest('[data-add]');
            if (addBtn) {
                changeQty(t, addBtn.dataset.add, Number(addBtn.dataset.delta));
                const item = App.AppState.items.find(i => i.id === addBtn.dataset.add);
                triggerAddFx(addBtn);
                App.toast(`${addBtn.dataset.delta} × ${item?.label || addBtn.dataset.add}`, 'success', 1400, { confetti: true });
                return;
            }
            const plusBtn = e.target.closest('[data-plus]');
            const plus = plusBtn?.dataset.plus;
            if (plus) {
                changeQty(t, plus, 1);
                triggerAddFx(plusBtn);
                return;
            }
            const minus = e.target.closest('[data-minus]')?.dataset.minus;
            if (minus) changeQty(t, minus, -1);
        };
        menuList.addEventListener('click', handleClick);
        quickAdd.addEventListener('click', handleClick);
        menuList.addEventListener('input', e => { const t = App.AppState.currentTableId; if (!t) return; const a = e.target.closest('[data-qty]')?.dataset.qty; if (a) setQty(t, a, Math.max(0, Number(e.target.value || 0))) });

        App.$('#open-quick-presets')?.addEventListener('click', openQuickPresetsModal);
        App.$('#quick-presets-close')?.addEventListener('click', closeQuickPresetsModal);
        App.$('#quick-presets-done')?.addEventListener('click', closeQuickPresetsModal);
        App.$('#add-quick-preset')?.addEventListener('click', addQuickPreset);
        App.$('#reset-quick-presets')?.addEventListener('click', resetQuickPresets);
        App.$('#preset-list')?.addEventListener('input', e => {
            const target = e.target;
            const presetId = target.dataset.presetId;
            const field = target.dataset.field;
            if (!presetId || !field) return;
            const preset = App.AppState.quickPresets.find(p => p.id === presetId);
            if (!preset) return;
            if (field === 'qty') {
                preset.qty = Math.max(1, Number(target.value || 1));
                target.value = preset.qty;
            } else if (field === 'label') {
                preset.label = target.value;
            } else if (field === 'itemId') {
                preset.itemId = target.value;
            }
            App.persist();
            refreshQuickAddArea();
        });
        App.$('#preset-list')?.addEventListener('click', e => {
            const btn = e.target.closest('[data-delete-preset]');
            if (!btn) return;
            const presetId = btn.dataset.deletePreset;
            App.AppState.quickPresets = App.AppState.quickPresets.filter(p => p.id !== presetId);
            App.persist();
            renderQuickPresetEditor();
            refreshQuickAddArea();
        });

        App.$('#tip-cancel').addEventListener('click', closeTipModal);
        App.$('#tip-confirm').addEventListener('click', () => finalizeCloseTable(currentTipState.tableId, currentTipState.tip));
        App.$$('#tip-modal [data-tip-percent]').forEach(btn => {
            btn.addEventListener('click', () => {
                const percent = Number(btn.dataset.tipPercent);
                const tipAmount = currentTipState.subtotal * percent;
                updateTipDisplay(tipAmount, btn);
            });
        });
        App.$('#tip-custom-amount').addEventListener('input', e => {
            const customAmount = Number(e.target.value || 0);
            updateTipDisplay(customAmount, null);
        });

        App.$('#mobile-action-bar')?.addEventListener('click', e => {
            const action = e.target.closest('[data-mobile-action]')?.dataset.mobileAction;
            if (!action) return;
            if (action === 'new-table') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => App.$('#table-name')?.focus(), 180);
            } else if (action === 'search') {
                const current = App.AppState.tables.find(t => t.id === App.AppState.currentTableId) || App.AppState.tables.find(t => !t.charged);
                if (current) {
                    openDrawer(current);
                    setTimeout(focusMenuSearch, 200);
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setTimeout(() => App.$('#table-name')?.focus(), 180);
                }
            } else if (action === 'charge') {
                const current = App.AppState.tables.find(t => t.id === App.AppState.currentTableId && !t.charged) || App.AppState.tables.find(t => !t.charged);
                if (!current) return alert('No hay mesas activas para cobrar.');
                if (!App.AppState.currentTableId) openDrawer(current);
                openTipModal(current.id);
            } else if (action === 'report') {
                openReportModal();
            }
        });
    }

    function init() {
        App.loadState();
        wireEvents();
        render();
        setInterval(updateTimers, 30000);
        App.handleSW();

        // Checar si se accedió desde un "shortcut"
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'showReport') {
            openReportModal();
        }
    }
    init();
});
