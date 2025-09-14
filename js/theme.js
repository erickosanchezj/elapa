/* /js/theme.js
   Handles dark and light theme toggling
   Allows staff to switch themes for better visibility
   RELEVANT FILES: index.html, precios.html, js/styles.css */

(function() {
    const root = document.documentElement;

    function applyTheme(isDark) {
        root.classList.toggle('dark', isDark);
        localStorage.theme = isDark ? 'dark' : 'light';
    }

    // Set initial theme early
    applyTheme(localStorage.theme === 'dark');

    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('theme-toggle');
        const icon = document.getElementById('theme-icon');
        if (!btn || !icon) {
            console.warn('Theme toggle elements not found');
            return;
        }
        icon.textContent = root.classList.contains('dark') ? 'light_mode' : 'dark_mode';
        btn.addEventListener('click', () => {
            const isDark = root.classList.contains('dark');
            applyTheme(!isDark);
            icon.textContent = isDark ? 'dark_mode' : 'light_mode';
        });
    });
})();
