// /cloudflare/config-worker/worker.js
// Cloudflare Worker that serves config.json from a PRIVATE GitHub repo to the El Apá app.
// Keeps prices, promo and templates editable on github.com without making them public.
// RELEVANT FILES: wrangler.toml, README.md, config.example.json, ../../js/remote-config.js
//
// Settings (wrangler.toml [vars]): GITHUB_REPO, GITHUB_BRANCH, CONFIG_PATH, ALLOWED_ORIGINS.
// Secrets (wrangler secret put): GITHUB_TOKEN (read-only, that repo only), DEVICE_KEY (shared with the app).

// Compare two strings in constant time, so the key can't be guessed from response timing.
function sameKey(given, expected) {
    if (!expected) return false;
    const a = new TextEncoder().encode(given);
    const b = new TextEncoder().encode(expected);
    let diff = a.length ^ b.length;
    for (let i = 0; i < b.length; i++) diff |= (a[i] || 0) ^ b[i];
    return diff === 0;
}

export default {
    async fetch(request, env) {
        // CORS: only the app's own site(s) may read the answer.
        const origin = request.headers.get('Origin') || '';
        const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
        const cors = {
            'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || 'null',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'X-Config-Key',
            'Vary': 'Origin',
        };
        const reply = (body, status, extra = {}) => new Response(body, { status, headers: { ...cors, 'Cache-Control': 'no-store', ...extra } });

        if (request.method === 'OPTIONS') return reply(null, 204);
        if (request.method !== 'GET') return reply('Method not allowed', 405);
        if (!sameKey(request.headers.get('X-Config-Key') || '', env.DEVICE_KEY)) return reply('Unauthorized', 401);

        // Read the raw file through the GitHub API with the read-only token.
        const path = (env.CONFIG_PATH || 'config.json').split('/').map(encodeURIComponent).join('/');
        const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}?ref=${encodeURIComponent(env.GITHUB_BRANCH || 'main')}`;
        let github;
        try {
            github = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.raw+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'User-Agent': 'elapa-config-worker',
                },
            });
        } catch {
            return reply('GitHub unreachable', 502);
        }
        if (!github.ok) return reply(`GitHub answered ${github.status}`, 502);

        // Never pass on a broken file: the app keeps its last good copy instead.
        const text = await github.text();
        try { JSON.parse(text); } catch { return reply('config.json is not valid JSON', 502); }
        return reply(text, 200, { 'Content-Type': 'application/json; charset=utf-8' });
    },
};
