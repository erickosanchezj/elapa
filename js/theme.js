/* /js/theme.js
   Handles dark and light theme toggling
   Allows staff to switch themes for better visibility
   RELEVANT FILES: index.html, js/styles.css */

(function() {
    const root = document.documentElement;
    const btn = document.getElementById('theme-toggle');
    const icon = document.getElementById('theme-icon');
    if (!btn || !icon) return;

    function applyTheme(isDark) {
        root.classList.toggle('dark', isDark);
        localStorage.theme = isDark ? 'dark' : 'light';
        icon.textContent = isDark ? 'light_mode' : 'dark_mode';
    }

    btn.addEventListener('click', () => {
        applyTheme(!root.classList.contains('dark'));
    });

    applyTheme(localStorage.theme === 'dark');
})();
