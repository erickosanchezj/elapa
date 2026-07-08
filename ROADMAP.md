<!-- /ROADMAP.md -->
<!-- Ordered task list for fixing UI-wiring audit findings from REVIEW.md -->
<!-- Exists so each listed UI wiring issue can be fixed and tested independently -->
<!-- RELEVANT FILES: REVIEW.md, index.html, menu.html, ticket.html -->

# UI Wiring Roadmap

## Task 1: Wire or disable Floor KDS nav
Files: [`index.html`]

Change: Wire the bottom nav `KDS` link to an existing implemented KDS route or panel, or make it non-clickable if no KDS screen exists.

Acceptance Criteria: Pass if: Clicking the `KDS` nav item changes `window.location.pathname` to the implemented KDS route or makes a KDS panel visible within 100ms; if no KDS route/panel exists, the item should not be presented as an active clickable control.

Test: Open `index.html` in a browser. Click the bottom nav item labeled `KDS`. Within 100ms, confirm one of these concrete outcomes: `window.location.pathname` changes to the implemented KDS route, a KDS panel is visible in the page, or the item is no longer an active clickable link and cannot change the URL to `index.html#`.

Status: [x] Done

## Task 2: Wire or disable Floor Trompo nav
Files: [`index.html`]

Change: Wire the bottom nav `Trompo` link to an existing implemented Trompo route or panel, or make it non-clickable if no Trompo screen exists.

Acceptance Criteria: Pass if: Clicking the `Trompo` nav item changes `window.location.pathname` to the implemented Trompo route or makes a Trompo panel visible within 100ms; if no Trompo route/panel exists, the item should not be focusable/clickable as a link.

Test: Open `index.html` in a browser. Click the bottom nav item labeled `Trompo`. Within 100ms, confirm one of these concrete outcomes: `window.location.pathname` changes to the implemented Trompo route, a Trompo panel is visible in the page, or the item is not focusable and not clickable as a link.

Status: [x] Done

## Task 3: Wire Menu Orders nav
Files: [`menu.html`]

Change: Change the bottom nav `Orders` link so it navigates to the existing orders or floor route represented by this app.

Acceptance Criteria: Pass if: Clicking `Orders` navigates to the chosen existing orders/floor route within 100ms, and `window.location.href` no longer ends with `menu.html#`.

Test: Open `menu.html` in a browser. Click the bottom nav item labeled `Orders`. Within 100ms, confirm `window.location.href` does not end with `menu.html#` and the browser is on the chosen existing orders or floor page, such as `index.html` or `ticket.html`.

Status: [x] Done

## Task 4: Wire or disable Menu Staff nav
Files: [`menu.html`]

Change: Wire the bottom nav `Staff` link to an existing staff route, or make it disabled and non-interactive if no staff screen exists.

Acceptance Criteria: Pass if: Clicking `Staff` either navigates to an implemented staff route within 100ms or, if intentionally unavailable, does not change URL hash, does not scroll to top, and exposes `aria-disabled="true"`.

Test: Open `menu.html` in a browser and note `window.location.href` plus the current scroll position. Click the bottom nav item labeled `Staff`. Within 100ms, confirm one of these concrete outcomes: the browser navigates to an implemented staff route, or `window.location.href` is unchanged, the scroll position is unchanged, and the Staff control has `aria-disabled="true"`.

Status: [x] Done

## Task 5: Wire or disable Menu Settings nav
Files: [`menu.html`]

Change: Wire the bottom nav `Settings` link to existing settings UI, or make it disabled and non-interactive if no settings screen exists.

Acceptance Criteria: Pass if: Clicking `Settings` either opens/navigates to an implemented settings UI within 100ms or, if unavailable, keeps the URL unchanged and exposes `aria-disabled="true"`.

Test: Open `menu.html` in a browser and note `window.location.href`. Click the bottom nav item labeled `Settings`. Within 100ms, confirm one of these concrete outcomes: the browser navigates to an implemented settings UI, a settings UI opens, or `window.location.href` is unchanged and the Settings control has `aria-disabled="true"`.

Status: [x] Done

## Task 6: Persist ticket modifier choices
Files: [`ticket.html`, `js/ticket.js`, `js/app.js`]

Change: Store selected modal modifiers with the draft line item, restore them when reopening the item, and persist them when the ticket is committed.

Acceptance Criteria: Pass if: Opening the modal for `taco_pastor`, checking `Sin Cebolla`, pressing `#modal-update-btn`, and reopening that item shows `Sin Cebolla` still checked; after pressing `#commit-btn`, the persisted table record in `localStorage.tacos_tables` contains the selected modifier for that line item.

Test: Open `ticket.html` in a browser with clean localStorage. Click the Pastor product button, open the Pastor row from `#tray-list`, check `Sin Cebolla`, and click `#modal-update-btn`. Reopen the Pastor row and confirm `Sin Cebolla` is still checked. Click `#commit-btn`, enter a table name when prompted, then run `JSON.parse(localStorage.getItem('tacos_tables'))` in DevTools and confirm the new table record contains `Sin Cebolla` for the Pastor line item.

Status: [x] Done

## Task 7: Respect product stock in ticket grid
Files: [`ticket.html`, `js/ticket.js`, `js/app.js`]

Change: Render product buttons from `App.isInStock(item.id)` and block `addItem()` for out-of-stock products.

Acceptance Criteria: Pass if: With `localStorage.tacos_stock` containing `{ "taco_pastor": false }`, opening `ticket.html` renders the Pastor product with the out-of-stock visual state, and clicking it does **not** change `#tray-count`, `#tray-total`, or `#commit-total` within 100ms.

Test: In DevTools, run `localStorage.setItem('tacos_stock', JSON.stringify({ taco_pastor: false }))`, then open `ticket.html`. Confirm the Pastor product shows the out-of-stock visual state. Record `#tray-count`, `#tray-total`, and `#commit-total`, click Pastor, wait 100ms, and confirm all three values are unchanged.

Status: [x] Done

## Task 8: Apply modal quantity and modifiers together
Files: [`ticket.html`, `js/ticket.js`, `js/app.js`]

Change: Make `#modal-update-btn` apply both the modal quantity and the selected modifier state for the current draft item.

Acceptance Criteria: Pass if: Selecting a modifier checkbox, changing quantity to `2`, and clicking `#modal-update-btn` updates both the item quantity and selected modifier state within 100ms; reopening the modal for the same item shows quantity `2` and the same modifier selected.

Test: Open `ticket.html` in a browser. Add Pastor to the tray, click the Pastor row in `#tray-list`, select `Sin Cebolla`, click `#modal-qty-plus` until `#modal-qty-val` is `2`, and click `#modal-update-btn`. Within 100ms, confirm `#tray-count` shows `2 ITEMS`. Reopen the Pastor row and confirm `#modal-qty-val` is `2` and `Sin Cebolla` remains checked.

Status: [ ] Not started

## Task 9: Fix tray expand icon state
Files: [`ticket.html`, `js/ticket.js`]

Change: Swap the tray icon text so collapsed shows `expand_more` and expanded shows `expand_less`.

Acceptance Criteria: Pass if: Starting with `#tray-list.hidden === true`, clicking `#tray-handle` removes `hidden` and the icon text becomes `expand_less` within 100ms; clicking again adds `hidden` and the icon text becomes `expand_more` within 100ms.

Test: Open `ticket.html` in a browser. Confirm `document.querySelector('#tray-list').classList.contains('hidden') === true`. Click `#tray-handle`, wait 100ms, and confirm `#tray-list` does not have `hidden` and the icon inside `#tray-handle` reads `expand_less`. Click `#tray-handle` again, wait 100ms, and confirm `#tray-list` has `hidden` and the icon reads `expand_more`.

Status: [ ] Not started

## Task 10: Wire promo toggle state
Files: [`precios.html`, `js/precios.js`, `js/app.js`]

Change: Make `#promo-toggle` an operator control that persists `App.AppState.promoEnabled` and updates `App.computeLine()` according to the intended promo rule.

Acceptance Criteria: Pass if: Toggling `#promo-toggle` from off to on updates `localStorage.tacos_promoEnabled` to `true` within 100ms, and `App.computeLine('taco_pastor', 2).total` reflects the enabled promo rule on the same page load.

Test: Open `precios.html` in a browser. Set `localStorage.tacos_promoEnabled` to `false`, reload the page, and confirm `#promo-toggle` starts off. Click `#promo-toggle`, wait 100ms, and confirm `localStorage.getItem('tacos_promoEnabled')` is `true` or `"true"`. In DevTools, run `TaqueriaApp.computeLine('taco_pastor', 2).total` and confirm the total reflects the enabled pastor promo rule on the same page load.

Status: [ ] Not started

## Task 11: Add active table completion flow
Files: [`ticket.html`, `js/ticket.js`]

Change: Add a minimal action for an existing active table that marks it paid/done by setting `charged = true`, `paidAt = Date.now()`, and `openDurationMs = paidAt - createdAt`, then persists and returns to the floor.

Acceptance Criteria: Pass if: An active table can be marked paid/done from the current active UI, the table record in `localStorage.tacos_tables` has `charged === true`, a numeric `paidAt`, and a numeric `openDurationMs`, the table no longer appears in the active floor grid, and the existing `#kpi-sales` / `#kpi-sla` values update from that completed table on `index.html`.

Test: Open `index.html`, create a table with `#fab-add-table`, choose to go to the table, add one product on `ticket.html`, and click `#commit-btn` to save the order. Reopen that table from `index.html`, click the new paid/done action, and confirm the browser returns to `index.html`. In DevTools, run `JSON.parse(localStorage.getItem('tacos_tables')).find(t => t.name === '<table name used in test>')` and confirm `charged === true`, `typeof paidAt === 'number'`, and `typeof openDurationMs === 'number'`. Confirm the table is not rendered in `#floor-grid`, `#kpi-sales` includes that table total, and `#kpi-sla` is no longer stuck because of a missing completion timestamp.

Status: [ ] Not started
