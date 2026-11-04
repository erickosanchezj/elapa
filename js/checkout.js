// /js/checkout.js
// Shows the checkout sheet: subtotal, tip choice (none, 10%, 15%, 20% or a custom amount) and final total.
// Replaces the plain "¿Cerrar y cobrar?" prompt so staff can record a tip when charging a table.
// RELEVANT FILES: ../index.html, floor.js, app.js, styles.css
(function () {
    'use strict';
    const App = window.TaqueriaApp;

    document.addEventListener('DOMContentLoaded', () => {
        const sheet = document.getElementById('checkout-sheet');
        const form = document.getElementById('checkout-form');
        const custom = form.elements.tipCustom;
        const radios = [...form.querySelectorAll('input[name="tipChoice"]')];
        const show = (id, amount) => { document.getElementById(id).textContent = App.money(amount); };
        let subtotal = 0;
        let choice = '0'; // A percent like '0.10', or 'custom' while typing an amount.
        let onConfirm = null;

        // Tip in pesos, rounded to cents. Empty or invalid amounts count as no tip.
        function currentTip() {
            const amount = choice === 'custom' ? Number(custom.value) : subtotal * Number(choice);
            return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
        }

        function update() {
            const tip = currentTip();
            show('checkout-subtotal', subtotal);
            show('checkout-tip', tip);
            show('checkout-total', subtotal + tip);
            show('checkout-submit-total', subtotal + tip);
        }

        // Picking a percent clears the custom amount.
        radios.forEach(radio => radio.addEventListener('change', () => {
            choice = radio.value;
            custom.value = '';
            update();
        }));

        // Typing an amount deselects the percent buttons.
        custom.addEventListener('input', () => {
            choice = 'custom';
            radios.forEach(radio => { radio.checked = false; });
            update();
        });

        document.getElementById('checkout-cancel').addEventListener('click', () => sheet.close());
        document.getElementById('checkout-back').addEventListener('click', () => sheet.close());
        sheet.addEventListener('close', () => form.reset());

        // Native validation blocks negative amounts before this runs.
        form.addEventListener('submit', event => {
            event.preventDefault();
            const tip = currentTip();
            sheet.close();
            onConfirm?.(tip);
        });

        // floor.js calls this from the "Cobrar" button; callback receives the tip in pesos.
        App.openCheckout = (table, callback) => {
            onConfirm = callback;
            subtotal = App.computeTableTotal(table);
            choice = '0';
            form.reset();
            document.getElementById('checkout-title').textContent = `Cobrar ${table.name}`;
            update();
            sheet.showModal();
            radios[0].focus();
        };
    });
})();
