// /js/recibo.js
// Shows the receipt passed in recibo.html's link (#data) and prints it when "Imprimir" is tapped.
// The data comes from the URL, so it is only rendered through App.receiptHtml, which escapes everything.
// RELEVANT FILES: ../recibo.html, receipt.js, receipt.css
document.addEventListener('DOMContentLoaded', () => {
    const App = window.TaqueriaApp;
    const area = document.getElementById('print-area');
    const button = document.getElementById('receipt-print');
    let data = null;
    try { data = JSON.parse(decodeURIComponent(location.hash.slice(1))); } catch { data = null; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        area.innerHTML = '<p class="receipt-note">No hay datos del recibo. Vuelve a la app y toca Imprimir otra vez.</p>';
        button.disabled = true;
        return;
    }
    area.innerHTML = App.receiptHtml(data);
    document.title = `Recibo ${String(data.mesa || '')} | Taquería El Apá`;
    button.addEventListener('click', () => window.print()); // directly inside the tap, as Safari requires
});
