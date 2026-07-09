// /tests/navigation-pages.test.cjs
// Regression tests for top-level navigation destinations
// Exists so nav controls point to real pages instead of dead controls
// RELEVANT FILES: index.html, menu.html, kds.html, settings.html
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(file) {
    return fs.readFileSync(path.join(root, file), 'utf8');
}

function test(name, fn) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (err) {
        console.error(`not ok - ${name}`);
        console.error(err.stack || err.message);
        process.exitCode = 1;
    }
}

test('floor navigation points KDS and Trompo to real pages', () => {
    const index = read('index.html');

    assert.match(index, /href="kds\.html"/);
    assert.match(index, /href="trompo\.html"/);
    assert.ok(fs.existsSync(path.join(root, 'kds.html')));
    assert.ok(fs.existsSync(path.join(root, 'trompo.html')));
});

test('menu navigation points Staff and Settings to real pages', () => {
    const menu = read('menu.html');

    assert.match(menu, /href="staff\.html"/);
    assert.match(menu, /href="settings\.html"/);
    assert.ok(fs.existsSync(path.join(root, 'staff.html')));
    assert.ok(fs.existsSync(path.join(root, 'settings.html')));
});

test('service worker caches operation pages and scripts', () => {
    const sw = read('service-worker.js');

    ['kds.html', 'trompo.html', 'staff.html', 'settings.html', 'js/ops.js', 'js/ticket.js'].forEach(asset => {
        assert.ok(sw.includes(`./${asset}`), `${asset} missing from service worker cache`);
    });
});
