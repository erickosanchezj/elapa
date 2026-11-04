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
| `index.html` (Mesas) | Open tables (or tap a frequent table), charge with tip, **Ver recibo** (preview, then save it as an image or print it), reopen or archive paid tables, see today's report |
| `ticket.html` (Tickets) | Add products and quick shortcuts to a table's order, with options like "Sin cebolla" |
| `menu.html` (Menú) | Edit products and mark them sold out |
| `precios.html` (Precios) | Prices, the 2x1 pastor promo switch, the late-table time, quick shortcuts, frequent tables, central config and cloud backups |
| `reporte.html` (Reporte) | Sales by period and hour, products, 2x1 promo cost, last 6 months, CSV export (opened from "Reporte del día") |

## Tests

```bash
node --test tests/*.test.mjs
```

- `tests/app.test.mjs`: prices, the 2x1 promo and its switch, checkout, reports, archive, taco options, saved settings.
- `tests/config.test.mjs`: central config (valid, invalid and partial files).
- `tests/worker.test.mjs`: the Cloudflare Worker against a simulated GitHub.
- `tests/browser.test.mjs`: real screens in Chromium. It needs Playwright and skips itself when it isn't installed.

No build step and no dependencies for the app. GitHub runs all of them on every pull request (`.github/workflows/tests.yml`).

## Where things live

- `js/app.js`: shared data, prices, promo rule, sales report and saving to `localStorage`.
- `js/remote-config.js`: optional central config; loaded right after `app.js` on every page.
- One script per screen: `floor.js`, `ticket.js`, `menu.js`, `precios.js`. Each dialog or feature has its own small file, such as `checkout.js`, `receipt.js` + `receipt-image.js` (receipt preview, image and paper version), `report.js`, `report-page.js`, `options-dialog.js`, `templates.js`, `presets-editor.js` and `backup.js`.
- `js/styles.css` imports the design tokens and the other stylesheets. See `design.md` for the visual rules.
- `service-worker.js` caches every file for offline use. **Bump `CACHE_VERSION` and add new files to `ASSETS` whenever you change or add a file.**

## Saved data (per device)

`tacos_tables`, `tacos_items`, `tacos_prices`, `tacos_stock`, `tacos_promo_on`, `tacos_late_minutes`, `tacos_quick_presets`, `tacos_table_templates`, `theme`.

With central config connected, also `tacos_config_source` (Worker address and device key) and `tacos_remote_config` (last good copy of the file). Backups add `tacos_device_id` and `tacos_backup_state`.

## Central config (optional)

Prices, products, the promo, the late-table time, shortcuts and frequent tables can come from a private `config.json` on GitHub, served by a Cloudflare Worker. `js/remote-config.js` applies it on every device. The same Worker can save automatic backups to a `backups` branch of that private repo (`js/backup.js`). Setup steps are in `cloudflare/config-worker/README.md`.

See `AGENTS.MD` for coding rules (file headers, the 300-line limit, keeping things simple).
