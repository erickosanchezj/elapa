<!-- /README.md -->
<!-- Explains what the El Apá app is, how to run it and where things live. -->
<!-- Gives new developers and AI agents a one-page starting point. -->
<!-- RELEVANT FILES: AGENTS.MD, design.md, index.html, js/app.js -->
# Taquería El Apá

Offline-ready web app (PWA) for taking orders and managing tables at Taquería El Apá.
It is plain HTML, CSS and JavaScript: no build step and no server. All data is saved in the browser of each device (`localStorage`).

## Run it

Open `index.html` in a browser. To test offline mode and installation, serve the folder over HTTP:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Screens

| Page | What staff do there |
|---|---|
| `index.html` (Mesas) | Open tables (or tap a frequent table), charge with tip, print, reopen or archive paid tables, see today's report |
| `ticket.html` (Tickets) | Add products and quick shortcuts to a table's order, with options like "Sin cebolla" |
| `menu.html` (Menú) | Edit products and mark them sold out |
| `precios.html` (Precios) | Prices, the 2x1 pastor promo switch, the late-table time, quick shortcuts and frequent tables |

## Where things live

- `js/app.js`: shared data, prices, promo rule, sales report and saving to `localStorage`.
- One script per screen: `floor.js`, `ticket.js`, `menu.js`, `precios.js`. Each dialog or feature has its own small file, such as `checkout.js`, `receipt.js`, `report.js`, `templates.js` and `presets-editor.js`.
- `js/styles.css` imports the design tokens and the other stylesheets. See `design.md` for the visual rules.
- `service-worker.js` caches every file for offline use. **Bump `CACHE_VERSION` and add new files to `ASSETS` whenever you change or add a file.**

## Saved data (per device)

`tacos_tables`, `tacos_items`, `tacos_prices`, `tacos_stock`, `tacos_promo_on`, `tacos_late_minutes`, `tacos_quick_presets`, `tacos_table_templates`, `theme`.

See `AGENTS.MD` for coding rules (file headers, the 300-line limit, keeping things simple).
