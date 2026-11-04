// /js/receipt-image.js
// Draws a receipt as a PNG image (576 px wide = an 80 mm thermal printer) from receipt.js's data.
// iOS home-screen apps can't print, but they can share an image: the share sheet offers Print (AirPrint),
// printer apps for Bluetooth thermal printers, saving it, or sending it by message.
// RELEVANT FILES: receipt.js, ../index.html, app.js
(function () {
    'use strict';
    const App = window.TaqueriaApp;
    const W = 576, PAD = 16;
    const FONT = '"Courier New", Courier, monospace';
    const logo = new Image();
    logo.src = 'icons/icon-192.png'; // same file receipt.js preloads; drawn only once loaded

    // Lays the receipt out top to bottom. With draw=false it only measures the height.
    function layout(ctx, d, draw) {
        let y = PAD;
        const font = (size, bold) => { ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`; };
        const text = (s, x, align = 'left') => { if (draw) { ctx.textAlign = align; ctx.fillText(s, x, y); } };
        const rule = dashed => {
            if (draw) { ctx.setLineDash(dashed ? [8, 6] : []); ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke(); }
            y += 14;
        };
        // Wrap words so long names or options never run into the price column.
        const wrap = (s, maxWidth) => String(s).split(' ').reduce((lines, word) => {
            const last = lines[lines.length - 1];
            if (last && ctx.measureText(`${last} ${word}`).width <= maxWidth) lines[lines.length - 1] = `${last} ${word}`;
            else lines.push(word);
            return lines;
        }, []);
        const money = v => App.money(typeof v === 'number' && Number.isFinite(v) ? v : 0);

        ctx.textBaseline = 'top';
        if (logo.complete && logo.naturalWidth) { if (draw) ctx.drawImage(logo, (W - 96) / 2, y, 96, 96); y += 104; }
        font(34, true); text('Taquería "El Apá"', W / 2, 'center'); y += 42;
        font(20); text('Sabor auténtico cada día', W / 2, 'center'); y += 34;
        rule(true);
        font(22, true); [['Mesa', d.mesa], [d.dateLabel, d.date], ['Orden', d.orden]].forEach(([k, v]) => {
            font(22, true); text(String(k ?? ''), PAD); font(22); text(String(v ?? ''), W - PAD, 'right'); y += 30;
        });
        y += 4; rule(true);
        font(20, true); text('CANT', PAD); text('PRODUCTO', PAD + 80); text('TOTAL', W - PAD, 'right'); y += 30; rule(false);
        const rows = Array.isArray(d.rows) ? d.rows.filter(r => r && typeof r === 'object') : [];
        if (!rows.length) { font(22); text('Sin productos', W / 2, 'center'); y += 34; }
        rows.forEach(r => {
            font(24); text(`${Number(r.qty) || 0}x`, PAD);
            if (typeof r.amount === 'number') text(money(r.amount), W - PAD, 'right');
            wrap(r.label, W - PAD * 2 - 80 - 150).forEach(line => { text(line, PAD + 80); y += 30; });
            if (r.mods) { font(19); wrap(r.mods, W - PAD * 2 - 80 - 20).forEach(line => { text(line, PAD + 80); y += 24; }); }
            y += 8;
        });
        y += 4;
        font(24); text('Subtotal', PAD); text(money(d.subtotal), W - PAD, 'right'); y += 32;
        if (Number(d.tip)) { text('Propina', PAD); text(money(d.tip), W - PAD, 'right'); y += 32; }
        rule(false);
        font(26, true); text('Total', PAD); text(money(d.total), W - PAD, 'right'); y += 44;
        font(19);
        if (d.estimated) { text('Importes por producto no disponibles.', W / 2, 'center'); y += 28; }
        text(d.charged ? '¡Gracias por su visita!' : 'Cuenta por pagar. Propina no incluida.', W / 2, 'center'); y += 28;
        return y + PAD;
    }

    // Synchronous on purpose: iOS only opens the share sheet if it's asked for right inside the tap.
    App.receiptImageFile = function (d) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = W;
        canvas.height = layout(ctx, d, false);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, canvas.height);
        ctx.fillStyle = '#000';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        layout(ctx, d, true);
        const bytes = atob(canvas.toDataURL('image/png').split(',')[1]);
        const data = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) data[i] = bytes.charCodeAt(i);
        const name = String(d.mesa || 'recibo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'recibo';
        return new File([data], `recibo-${name}.png`, { type: 'image/png' });
    };
})();
