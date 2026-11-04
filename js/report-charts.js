// /js/report-charts.js
// Draws a simple one-series column chart (SVG) with a hover/focus tooltip and a table view.
// Keeps reporte.html charts readable and accessible without a chart library.
// RELEVANT FILES: report-page.js, report-layout.css, ../reporte.html, tokens.css
(function () {
    'use strict';
    const App = window.TaqueriaApp;
    const NS = 'http://www.w3.org/2000/svg';
    const HEIGHT = 220;
    const PAD = { top: 24, right: 8, bottom: 28, left: 52 };

    // Round the top of the axis up to 1, 2, 2.5, 5 or 10 × 10^n so ticks are clean numbers.
    const niceMax = v => {
        if (v <= 0) return 1;
        const p = 10 ** Math.floor(Math.log10(v));
        return [1, 2, 2.5, 5, 10].find(step => v / p <= step) * p;
    };
    // Axis ticks: full under 10,000, compact above ($12K).
    const tick = v => v >= 10000 ? `$${Math.round(v / 1000)}K` : `$${Math.round(v).toLocaleString('es-MX')}`;
    const el = (name, attrs) => {
        const node = document.createElementNS(NS, name);
        Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
        return node;
    };
    // Column path: 4px rounded data-end at the top, square at the baseline.
    const columnPath = (x, y, w, h) => {
        const r = Math.min(4, h, w / 2);
        return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
    };

    // data: [{ label, value, detail }]. detail is the tooltip/table line, e.g. "$340.00 · 5 mesas".
    App.renderColumns = (box, data, title) => {
        box.innerHTML = '';
        box.classList.add('chart');
        const plot = document.createElement('div');
        plot.className = 'chart-plot';
        const tip = document.createElement('div');
        tip.className = 'chart-tip';
        tip.hidden = true;
        plot.appendChild(tip);
        box.appendChild(plot);

        function draw() {
            plot.querySelector('svg')?.remove();
            const width = Math.max(plot.clientWidth, 240);
            const plotW = width - PAD.left - PAD.right;
            const plotH = HEIGHT - PAD.top - PAD.bottom;
            const max = niceMax(Math.max(...data.map(d => d.value)));
            const band = plotW / data.length;
            const barW = Math.min(24, band * 0.6);
            const y = v => PAD.top + plotH - (v / max) * plotH;
            const svg = el('svg', { width, height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}`, role: 'group', 'aria-label': title });

            [0, max / 2, max].forEach(v => { // recessive hairline grid + clean ticks
                svg.appendChild(el('line', { x1: PAD.left, x2: width - PAD.right, y1: y(v), y2: y(v), class: 'chart-grid' }));
                const t = el('text', { x: PAD.left - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'chart-axis' });
                t.textContent = tick(v);
                svg.appendChild(t);
            });

            const every = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 44))); // x labels that fit
            const top = data.reduce((best, d, i) => d.value > data[best].value ? i : best, 0);
            data.forEach((d, i) => {
                const x = PAD.left + i * band + (band - barW) / 2;
                const h = Math.max(0, PAD.top + plotH - y(d.value));
                const bar = el('path', { d: columnPath(x, y(d.value), barW, h), class: 'chart-bar' });
                if (h > 0) svg.appendChild(bar);
                if (i % every === 0) {
                    const t = el('text', { x: x + barW / 2, y: HEIGHT - 8, 'text-anchor': 'middle', class: 'chart-axis' });
                    t.textContent = d.label;
                    svg.appendChild(t);
                }
                if (i === top && d.value > 0) { // label only the tallest column
                    const t = el('text', { x: x + barW / 2, y: y(d.value) - 6, 'text-anchor': 'middle', class: 'chart-value' });
                    t.textContent = App.money(d.value);
                    svg.appendChild(t);
                }
                // Hit target: the whole band, bigger than the bar; same tooltip on hover and keyboard focus.
                const hit = el('rect', { x: PAD.left + i * band, y: PAD.top, width: band, height: plotH, class: 'chart-hit',
                    tabindex: 0, 'aria-label': `${d.label}: ${d.detail}` });
                const show = () => {
                    bar.classList.add('is-active');
                    tip.replaceChildren();
                    const strong = document.createElement('strong');
                    strong.textContent = d.detail;
                    const small = document.createElement('span');
                    small.textContent = d.label;
                    tip.append(strong, small);
                    tip.hidden = false;
                    tip.style.left = `${Math.min(Math.max(x + barW / 2, 70), width - 70)}px`;
                    tip.style.top = `${Math.max(y(d.value) - 8, 0)}px`;
                };
                const hide = () => { bar.classList.remove('is-active'); tip.hidden = true; };
                hit.addEventListener('pointerenter', show);
                hit.addEventListener('focus', show);
                hit.addEventListener('pointerleave', hide);
                hit.addEventListener('blur', hide);
                svg.appendChild(hit);
            });
            plot.appendChild(svg);
        }

        // Table view: every value is readable without hovering.
        const details = document.createElement('details');
        details.className = 'chart-table';
        const summary = document.createElement('summary');
        summary.textContent = 'Ver como tabla';
        const table = document.createElement('table');
        data.forEach(d => {
            const row = table.insertRow();
            row.insertCell().textContent = d.label;
            row.insertCell().textContent = d.detail;
        });
        details.append(summary, table);
        box.appendChild(details);

        draw();
        new ResizeObserver(() => draw()).observe(plot);
    };
})();
