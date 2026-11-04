<!-- /cloudflare/config-worker/README.md -->
<!-- Step-by-step setup for the private central config (Cloudflare Worker + private GitHub repo). -->
<!-- Lets the owner edit prices, promo and templates on github.com without making them public. -->
<!-- RELEVANT FILES: worker.js, wrangler.toml, config.example.json, ../../js/remote-config.js -->
# Central config for El Apá

Edit prices, products, the 2x1 promo, the late-table time, quick shortcuts and frequent tables in **one private file on GitHub**. Every device with the app picks up the changes.

The same Worker can also save **automatic backups** of each device's tables, sales and settings to a `backups` branch of the same private repo. See [Backups](#backups-optional).

```
config.json (private repo) ──read-only token──▶ Cloudflare Worker ──device key──▶ El Apá app
```

- **The file stays private.** It lives in a private repo. Only the Worker can read it, using a read-only token stored in Cloudflare.
- **The app needs a device key** to get the file from the Worker. The key is entered once on the Precios page.
- **Offline is fine.** The app keeps the last good copy. If the file is broken, the app keeps using the previous copy and Precios shows the error.
- **Stock stays per device.** "Agotado" changes during service, so it is never in the file.
- **Cost:** the free plans of GitHub and Cloudflare cover this.

## 1. Create the private repo

1. On github.com, create a new repository named `elapa-config` and make it **Private**.
2. Add a file named `config.json`. Copy the contents of `config.example.json` from this folder and adjust them.

## 2. Create a read-only token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
2. **Repository access:** Only select repositories → `elapa-config`.
3. **Permissions:** Repository permissions → **Contents: Read-only**. Nothing else.
4. **Expiration:** pick a date and add a reminder. When the token expires, devices keep their last copy until you replace it.
5. Copy the token. You will paste it in step 4.

## 3. Create a device key

This is the password the app sends to the Worker. Generate a random one:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Keep it somewhere safe. You will paste it in Cloudflare and on each device.

## 4. Deploy the Worker

You need a free Cloudflare account. Your domain does not need to be on Cloudflare: the Worker gets a `*.workers.dev` address.

**Option A: from the terminal (recommended).** From this folder:

```bash
cd cloudflare/config-worker
```

```bash
npx wrangler login
```

```bash
npx wrangler secret put GITHUB_TOKEN
```

```bash
npx wrangler secret put DEVICE_KEY
```

```bash
npx wrangler deploy
```

The last command prints the address, for example `https://elapa-config.your-name.workers.dev`.

**Option B: from the Cloudflare dashboard.**

1. Workers & Pages → Create → Worker. Name it `elapa-config` and deploy the starter.
2. Click **Edit code**, replace everything with `worker.js`, and deploy.
3. Settings → Variables and Secrets. Add the four text variables from `wrangler.toml` (`GITHUB_REPO`, `GITHUB_BRANCH`, `CONFIG_PATH`, `ALLOWED_ORIGINS`). Add `GITHUB_TOKEN` and `DEVICE_KEY` as **Secret**.

If your GitHub user or repo name differs, change `GITHUB_REPO` in `wrangler.toml` (or in the dashboard).

## 5. Check it

Replace the address and key with yours:

```bash
curl -H "X-Config-Key: YOUR-DEVICE-KEY" https://elapa-config.your-name.workers.dev/
```

You should see your `config.json`. With a wrong key you get `Unauthorized`.

## 6. Connect each device

1. Open the app → **Precios** → **Configuración central**.
2. Paste the Worker address and the device key, then tap **Conectar**.
3. The page reloads. Settings that come from the file show "Algunos ajustes vienen de la configuración central" and can no longer be edited on the device.

To stop using it, tap **Desconectar**. The current values stay on the device and become editable again.

## Editing the config

Edit `config.json` on github.com and commit. Each device downloads it the next time a screen opens. It then applies on the following screen change, so an order in progress is never interrupted.

To get it right away, open Precios → **Configuración central** → **Actualizar ahora**.

**How updates reach the device:** the Worker doesn't run on a schedule and never pushes anything. It only wakes up when the app asks: each time a screen opens, or when you tap "Actualizar ahora". Each request reads the file from GitHub at that moment.

Every key is optional. **A key that is not in the file stays editable on each device.**

| Key | What it controls | Rules |
|---|---|---|
| `prices` | Price per product id, e.g. `"taco_pastor": 17` | Numbers ≥ 0 |
| `items` | The product list: `id`, `label`, `category` | Category: `tacos`, `bebidas`, `postres` or `otros` (shown as "Extras"). The 8 basic products can be renamed but never removed. |
| `promoOn` | The 2x1 pastor promo (Monday and Wednesday) | `true` or `false` |
| `lateMinutes` | When an open table turns red | Whole number, 5–600 |
| `quickPresets` | Shortcuts on Tickets, e.g. `{ "itemId": "taco_pastor", "qty": 4 }` | `qty` 1–99 |
| `tableTemplates` | Frequent tables: `name`, `note`, `order` | Quantities 1–99 |

If anything is invalid, the whole file is rejected and devices keep the previous copy. Precios shows the reason, for example `"promoOn" debe ser true o false`.

## Backups (optional)

Every table and sale lives only in the device's browser. Backups copy them to your private `elapa-config` repo, on a separate **`backups`** branch, so a lost or reset phone doesn't lose the history. Your `config.json` on `main` keeps a clean history and is never touched by backups.

- **When:** automatically, at most every 20 minutes and only when something changed. Precios also has a **Respaldar ahora** button.
- **Where:** branch `backups`, one file per day and device, for example `backups/2026-11-04_d-ab12cd34.json`. Each file is a full snapshot and is overwritten during the day; GitHub's history keeps the earlier versions. To look at them on github.com, switch the branch selector from `main` to `backups`.
- **Never included:** the device key and the cached central config.
- **Restore:** Precios → **Respaldo en la nube** → choose a backup → **Restaurar este respaldo**. The app first downloads the chosen backup, then backs up the current data, then replaces it.

### Setup (about 5 minutes)

1. **Give your existing token write access.** GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → open your `elapa-config` token → **Edit** → Repository permissions → **Contents: Read and write** → Update. The token value doesn't change, so the Worker secret stays the same.
2. **Add two Text variables to the Worker** (Settings → Variables and Secrets), then deploy:
   - `BACKUP_REPO` = `erickosanchezj/elapa-config`
   - `BACKUP_BRANCH` = `backups`

   With wrangler, they are already in `wrangler.toml`.
3. **Deploy the new `worker.js`.** In the dashboard, open **Edit code**, paste the new file and deploy. With wrangler:

   ```bash
   npx wrangler deploy
   ```

4. **Check it.** This should print `[]` before the first backup:

   ```bash
   curl -H "X-Config-Key: YOUR-DEVICE-KEY" https://elapa-config.your-name.workers.dev/backups
   ```

5. Open the app on the device. The first backup runs a few seconds after any screen opens and **creates the `backups` branch automatically** from `main`. Precios → **Respaldo en la nube** shows "Último respaldo: …".

**Prefer a separate repo?** Set `BACKUP_REPO` to another private repo and add a `GITHUB_BACKUP_TOKEN` secret with write access to that repo only. Your main token can then stay read-only.

## Status messages on Precios

| Message | Meaning |
|---|---|
| Conectada. Actualizada: … | Everything is working |
| clave incorrecta | The device key does not match the `DEVICE_KEY` secret |
| el Worker respondió 502: GitHub answered 401 | The GitHub token is wrong or expired |
| el Worker respondió 502: config.json is not valid JSON | A typo in the file (a missing comma or quote) |
| no se pudo contactar al Worker | No internet, or a wrong address |
| el Worker no tiene respaldos configurados | `BACKUP_REPO` is missing in the Worker |
| No se pudo respaldar (… Could not prepare the "backups" branch …) | The token is still read-only: give it **Contents: Read and write** |
| No se pudo respaldar (el Worker respondió 502: GitHub answered 403) | Same: the token can't write |
| No se pudo respaldar (el Worker respondió 502: GitHub answered 404) | Wrong `BACKUP_REPO` |

## Security notes

- **The token** can only read this one repo. It never reaches the app or the browser.
- **The device key** is saved in the app's storage on each device. Anyone who has it can read the config and, if backups are on, read and write backups (your sales history). Keep it private. To change it, update the `DEVICE_KEY` secret and re-enter it on each device.
- **With backups on, the token can write to `elapa-config`.** The Worker only ever writes files named like `backups/2026-11-04_d-xxxx.json` on the `backups` branch; it never writes to `main` or to `config.json`. For stricter separation, use a separate repo and `GITHUB_BACKUP_TOKEN` (see above).
- **`ALLOWED_ORIGINS`** stops other websites from reading the config in a browser. Requests outside a browser still need the key.
