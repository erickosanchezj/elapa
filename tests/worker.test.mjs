// /tests/worker.test.mjs
// Unit tests for the Cloudflare Worker (config + backups) against a simulated GitHub API.
// Protects the device key check, the read-only config, the backups branch and error hints. Run: node --test tests/*.test.mjs
// RELEVANT FILES: ../cloudflare/config-worker/worker.js, ../cloudflare/config-worker/README.md, ../js/backup.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SOURCE = fs.readFileSync(new URL('../cloudflare/config-worker/worker.js', import.meta.url), 'utf8');
let copies = 0;
// A fresh copy of the Worker per test (its "branch ready" memory starts empty).
const freshWorker = async () => (await import(`data:text/javascript;base64,${Buffer.from(`${SOURCE}\n// copy ${copies++}`).toString('base64')}`)).default;

const ENV = { GITHUB_REPO: 'me/elapa-config', GITHUB_BRANCH: 'main', CONFIG_PATH: 'config.json', ALLOWED_ORIGINS: 'https://apa.chinito.cc',
    GITHUB_TOKEN: 'token-1', DEVICE_KEY: 'device-key', BACKUP_REPO: 'me/elapa-config', BACKUP_BRANCH: 'backups' };

// Simulated GitHub: branches -> { path: { content, sha } }. `fail` forces a status for one kind of call.
function fakeGitHub({ fail = {} } = {}) {
    const gh = { branches: { main: { 'config.json': { content: '{"promoOn":true}', sha: 'c1' } } }, calls: [], n: 1 };
    globalThis.fetch = async (url, opts = {}) => {
        const u = new URL(url), path = decodeURIComponent(u.pathname), method = opts.method || 'GET';
        const kind = method === 'POST' ? 'createRef' : method === 'PUT' ? 'put' : path.includes('/branches/') ? 'branch'
            : path.includes('/git/ref/') ? 'baseRef' : path.includes('/contents/') ? 'contents' : 'repo';
        gh.calls.push({ kind, method, path, ref: u.searchParams.get('ref'), token: opts.headers.Authorization });
        if (fail[kind]) return new Response('fail', { status: fail[kind] });
        let m;
        if (kind === 'repo') return Response.json({ default_branch: 'main' });
        if ((m = path.match(/\/branches\/(.+)$/))) return gh.branches[m[1]] ? Response.json({ name: m[1] }) : new Response('nf', { status: 404 });
        if ((m = path.match(/\/git\/ref\/heads\/(.+)$/))) return Response.json({ object: { sha: `head-${m[1]}` } });
        if (kind === 'createRef') { const name = JSON.parse(opts.body).ref.replace('refs/heads/', ''); gh.branches[name] = structuredClone(gh.branches.main); return Response.json({}, { status: 201 }); }
        const file = path.split('/contents/')[1];
        if (method === 'GET') {
            const files = gh.branches[u.searchParams.get('ref')];
            if (!files) return new Response('no ref', { status: 404 });
            if (file === 'backups') {
                const list = Object.keys(files).filter(f => f.startsWith('backups/')).map(f => ({ type: 'file', name: f.slice(8), size: files[f].content.length }));
                return list.length ? Response.json([...list, { type: 'file', name: 'README.md', size: 1 }]) : new Response('nf', { status: 404 });
            }
            const f = files[file];
            if (!f) return new Response('nf', { status: 404 });
            return opts.headers.Accept.includes('raw') ? new Response(f.content) : Response.json({ sha: f.sha });
        }
        const body = JSON.parse(opts.body), files = gh.branches[body.branch];
        if (files[file] && body.sha !== files[file].sha) return new Response('sha mismatch', { status: 409 });
        files[file] = { content: Buffer.from(body.content, 'base64').toString('utf8'), sha: `s${gh.n++}` };
        return Response.json({}, { status: 201 });
    };
    return gh;
}

const call = (worker, path, { method = 'GET', key = 'device-key', body, env = ENV } = {}) =>
    worker.fetch(new Request(`https://w.example${path}`, { method, body, headers: { 'X-Config-Key': key, Origin: 'https://apa.chinito.cc' } }), env);
const backup = (day = '2026-11-04', data = { tacos_tables: '[1]' }) => JSON.stringify({ day, device: 'd-ab12cd34', savedAt: 1, data });

test('serves config.json with the right key and refuses a wrong key without calling GitHub', async () => {
    const gh = fakeGitHub(), worker = await freshWorker();
    const ok = await call(worker, '/');
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), '{"promoOn":true}');
    assert.equal(ok.headers.get('Access-Control-Allow-Origin'), 'https://apa.chinito.cc');
    gh.calls.length = 0;
    assert.equal((await call(worker, '/', { key: 'wrong' })).status, 401);
    assert.equal((await call(worker, '/backups', { key: '' })).status, 401);
    assert.equal(gh.calls.length, 0);
});

test('backups create the "backups" branch once and never touch main or config.json', async () => {
    const gh = fakeGitHub(), worker = await freshWorker();
    const first = await call(worker, '/backup', { method: 'PUT', body: backup() });
    assert.equal(first.status, 200);
    assert.ok(gh.calls.some(c => c.kind === 'createRef'));
    gh.calls.length = 0;
    await call(worker, '/backup', { method: 'PUT', body: backup('2026-11-04', { tacos_tables: '[1,2]' }) });
    assert.ok(!gh.calls.some(c => c.kind === 'branch' || c.kind === 'createRef'), 'branch check remembered');
    assert.deepEqual(Object.keys(gh.branches.main), ['config.json']);
    assert.equal(gh.branches.main['config.json'].sha, 'c1');
    assert.ok(gh.branches.backups['backups/2026-11-04_d-ab12cd34.json'].content.includes('[1,2]'));
});

test('lists and downloads backups; accents and emoji survive', async () => {
    fakeGitHub();
    const worker = await freshWorker();
    await call(worker, '/backup', { method: 'PUT', body: backup('2026-11-03', { tacos_items: '[{"label":"Al Carbón 🌮"}]' }) });
    await call(worker, '/backup', { method: 'PUT', body: backup('2026-11-04') });
    const list = await (await call(worker, '/backups')).json();
    assert.deepEqual(list.map(f => f.name), ['2026-11-04_d-ab12cd34.json', '2026-11-03_d-ab12cd34.json']);
    const one = await (await call(worker, '/backups/2026-11-03_d-ab12cd34.json')).json();
    assert.ok(one.data.tacos_items.includes('Al Carbón 🌮'));
});

test('rejects bad backup names, path tricks, missing data and oversized backups', async () => {
    fakeGitHub();
    const worker = await freshWorker();
    const put = body => call(worker, '/backup', { method: 'PUT', body });
    assert.equal((await put(JSON.stringify({ day: '2026-1-4', device: 'd-ab12cd34', data: {} }))).status, 400);
    assert.equal((await put(JSON.stringify({ day: '2026-11-04', device: '../../config', data: {} }))).status, 400);
    assert.equal((await put(JSON.stringify({ day: '2026-11-04', device: 'd-ab12cd34' }))).status, 400);
    assert.equal((await put('not json')).status, 400);
    assert.equal((await put(backup('2026-11-04', { x: 'a'.repeat(6.5e6) }))).status, 413);
    assert.equal((await call(worker, '/backups/..%2Fconfig.json')).status, 400);
});

test('backup errors name the failing step with a hint', async () => {
    const cases = [
        [{ createRef: 403 }, /creating the "backups" branch: GitHub answered 403 \(the token needs Contents: Read and write\)/],
        [{ branch: 401 }, /GitHub answered 401 \(the token is wrong or expired\)/],
        [{ repo: 404, branch: 404 }, /reading the repo: GitHub answered 404 \(check BACKUP_REPO/],
    ];
    for (const [fail, message] of cases) {
        fakeGitHub({ fail });
        const res = await call(await freshWorker(), '/backup', { method: 'PUT', body: backup() });
        assert.equal(res.status, 502);
        assert.match(await res.text(), message);
    }
    fakeGitHub({ fail: { put: 403 } }).branches.backups = {}; // branch exists, but the token can't write
    assert.match(await (await call(await freshWorker(), '/backup', { method: 'PUT', body: backup() })).text(), /Saving the backup: GitHub answered 403/);
});

test('backups are off until BACKUP_REPO is set', async () => {
    fakeGitHub();
    const res = await call(await freshWorker(), '/backups', { env: { ...ENV, BACKUP_REPO: '' } });
    assert.equal(res.status, 501);
});
