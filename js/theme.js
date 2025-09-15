/* /js/theme.js
   Handles dark and light theme toggling
   Allows staff to switch themes for better visibility
   RELEVANT FILES: index.html, precios.html, js/styles.css */

(function() {
    const root = document.documentElement;

    // Apply or remove the dark class and remember the choice
    function applyTheme(isDark) {
        if (isDark) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    // Get stored theme or fall back to system preference
    function getStoredTheme() {
        const stored = localStorage.getItem('theme');
        if (stored) {
            return stored === 'dark';
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // Set initial theme immediately
    const initialTheme = getStoredTheme();
    applyTheme(initialTheme);

    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('theme-toggle');
        const icon = document.getElementById('theme-icon');

        if (!btn || !icon) {
            console.warn('Theme toggle elements not found');
            return;
        }

        // Update icon based on current theme
        function updateIcon() {
            const isDark = root.classList.contains('dark');
            icon.textContent = isDark ? 'light_mode' : 'dark_mode';
        }

        updateIcon();

        btn.addEventListener('click', () => {
            const isDark = root.classList.contains('dark');
            applyTheme(!isDark);
            updateIcon();
        });
    });
})();
