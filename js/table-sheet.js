// /js/table-sheet.js
// Collects table details in one accessible native dialog.
// Replaces browser prompts on both the floor and new-ticket screens.
// RELEVANT FILES: floor.js, ticket.js, ios.css, ../index.html
(function () {
    const App = window.TaqueriaApp;
    let submitDetails;
    document.addEventListener('DOMContentLoaded', () => {
        const sheet = document.getElementById('table-sheet');
        const form = document.getElementById('table-form');
        document.getElementById('table-cancel').addEventListener('click', () => sheet.close());
        sheet.addEventListener('close', () => form.reset());
        form.elements.tableName.addEventListener('input', event => event.target.setCustomValidity(''));
        form.addEventListener('submit', event => {
            event.preventDefault();
            const name = form.elements.tableName.value.trim();
            if (!name) {
                form.elements.tableName.setCustomValidity('Escribe el nombre de la mesa.');
                form.elements.tableName.reportValidity();
                return;
            }
            const details = { name, note: form.elements.tableNote.value.trim(), destination: event.submitter?.value };
            sheet.close();
            submitDetails(details);
        });
        App.openTableSheet = callback => {
            submitDetails = callback;
            form.reset();
            form.elements.tableName.setCustomValidity('');
            sheet.showModal();
            form.elements.tableName.focus();
        };
    });
})();
