// /cloudflare/config-worker/worker.js
// Cloudflare Worker for El Apá: serves config.json from a PRIVATE repo and saves/restores device backups
// in another PRIVATE repo, so settings and sales history live on GitHub without being public.
// RELEVANT FILES: wrangler.toml, README.md, ../../js/remote-config.js, ../../js/backup.js
//
// Routes (all need the X-Config-Key header = DEVICE_KEY):
//   GET  /                      → config.json from GITHUB_REPO (read-only GITHUB_TOKEN)
//   PUT  /backup                → writes backups/<day>_<device>.json to BACKUP_REPO (GITHUB_BACKUP_TOKEN)
//   GET  /backups               → lists saved backups (newest first)
//   GET  /backups/<file>.json   → downloads one backup
// Settings: GITHUB_REPO, GITHUB_BRANCH, CONFIG_PATH, ALLOWED_ORIGINS, BACKUP_REPO, BACKUP_BRANCH.
// Secrets: GITHUB_TOKEN, DEVICE_KEY, GITHUB_BACKUP_TOKEN (read-write, backup repo only).

const MAX_BACKUP_BYTES = 6 * 1024 * 1024; // browser storage is ~5 MB, so a backup never needs more
const BACKUP_FILE = /^\d{4}-\d{2}-\d{2}_d-[a-z0-9]{4,32}\.json$/; // e.g. 2026-11-04_d-ab12cd34.json

// Compare two strings in constant time, so the key can't be guessed from response timing.
function sameKey(given, expected) {
    if (!expected) return false;
    const a = new TextEncoder().encode(given);
    const b = new TextEncoder().encode(expected);
    let diff = a.length ^ b.length;
    for (let i = 0; i < b.length; i++) diff |= (a[i] || 0) ^ b[i];
    return diff === 0;
}

// GitHub's contents API wants base64; convert in chunks so multi-MB backups don't overflow the stack.
function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
}

// One place for GitHub API calls: repo is "owner/name", path is inside the repo, ref is the branch.
function github(token, repo, path, { ref, method = 'GET', raw = false, body } = {}) {
    const safePath = path.split('/').map(encodeURIComponent).join('/');
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    return fetch(`https://api.github.com/repos/${repo}/contents/${safePath}${query}`, {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'elapa-config-worker',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
}

export default {
    async fetch(request, env) {
        // CORS: only the app's own site(s) may read the answer.
        const origin = request.headers.get('Origin') || '';
        const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
        const cors = {
            'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || 'null',
            'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'X-Config-Key, Content-Type',
            'Vary': 'Origin',
        };
        const reply = (body, status, extra = {}) => new Response(body, { status, headers: { ...cors, 'Cache-Control': 'no-store', ...extra } });
        const json = (value, status = 200) => reply(JSON.stringify(value), status, { 'Content-Type': 'application/json; charset=utf-8' });

        if (request.method === 'OPTIONS') return reply(null, 204);
        if (!sameKey(request.headers.get('X-Config-Key') || '', env.DEVICE_KEY)) return reply('Unauthorized', 401);

        const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
        try {
            // --- Config (read-only) ---
            if (path === '/' && request.method === 'GET') {
                const res = await github(env.GITHUB_TOKEN, env.GITHUB_REPO, env.CONFIG_PATH || 'config.json', { ref: env.GITHUB_BRANCH || 'main', raw: true });
                if (!res.ok) return reply(`GitHub answered ${res.status}`, 502);
                const text = await res.text();
                try { JSON.parse(text); } catch { return reply('config.json is not valid JSON', 502); } // app keeps its last good copy
                return reply(text, 200, { 'Content-Type': 'application/json; charset=utf-8' });
            }

            // --- Backups (read-write, separate repo and token) ---
            if (path.startsWith('/backup')) {
                if (!env.BACKUP_REPO || !env.GITHUB_BACKUP_TOKEN) return reply('Backups are not configured', 501);
                const branch = env.BACKUP_BRANCH || 'main';
                const call = (file, opts = {}) => github(env.GITHUB_BACKUP_TOKEN, env.BACKUP_REPO, file, opts);

                if (path === '/backup' && request.method === 'PUT') {
                    if (Number(request.headers.get('Content-Length') || 0) > MAX_BACKUP_BYTES) return reply('Backup too large', 413);
                    const text = await request.text();
                    if (text.length > MAX_BACKUP_BYTES) return reply('Backup too large', 413);
                    let body;
                    try { body = JSON.parse(text); } catch { return reply('Backup is not valid JSON', 400); }
                    const name = `${body?.day}_${body?.device}.json`;
                    if (!BACKUP_FILE.test(name) || !body.data || typeof body.data !== 'object') return reply('Backup needs day, device and data', 400);
                    // Updating a file needs its current sha; retry once if another save landed in between.
                    for (let attempt = 0; attempt < 2; attempt++) {
                        const meta = await call(`backups/${name}`, { ref: branch });
                        if (!meta.ok && meta.status !== 404) return reply(`GitHub answered ${meta.status}`, 502);
                        const sha = meta.ok ? (await meta.json()).sha : undefined;
                        const put = await call(`backups/${name}`, { method: 'PUT', body: {
                            message: `Respaldo ${body.day} (${body.device})`, branch, content: toBase64(text), ...(sha ? { sha } : {}),
                        } });
                        if (put.ok) return json({ ok: true, name, bytes: text.length });
                        if (put.status !== 409 && put.status !== 422) return reply(`GitHub answered ${put.status}`, 502);
                    }
                    return reply('GitHub kept rejecting the update, try again', 502);
                }

                if (path === '/backups' && request.method === 'GET') {
                    const res = await call('backups', { ref: branch });
                    if (res.status === 404) return json([]); // no backups yet
                    if (!res.ok) return reply(`GitHub answered ${res.status}`, 502);
                    const files = (await res.json()).filter(f => f.type === 'file' && BACKUP_FILE.test(f.name));
                    return json(files.map(f => ({ name: f.name, size: f.size })).sort((a, b) => b.name.localeCompare(a.name)).slice(0, 90));
                }

                const file = path.slice('/backups/'.length);
                if (path.startsWith('/backups/') && request.method === 'GET') {
                    if (!BACKUP_FILE.test(file)) return reply('Unknown backup name', 400); // no other files, no "../"
                    const res = await call(`backups/${file}`, { ref: branch, raw: true });
                    if (!res.ok) return reply(`GitHub answered ${res.status}`, res.status === 404 ? 404 : 502);
                    return reply(await res.text(), 200, { 'Content-Type': 'application/json; charset=utf-8' });
                }
            }
            return reply('Not found', 404);
        } catch {
            return reply('GitHub unreachable', 502);
        }
    },
};
