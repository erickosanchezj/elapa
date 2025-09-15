/* /js/theme.js
   Handles dark and light theme toggling
   Allows staff to switch themes for better visibility
   RELEVANT FILES: index.html, precios.html, js/styles.css */

(function() {
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');

    // Switch theme and remember choice
    function setTheme(mode) {
        const isDark = mode === 'dark';
        root.classList.toggle('dark', isDark);
        localStorage.setItem('theme', mode);
        if (meta) meta.setAttribute('content', isDark ? '#111827' : '#f59e0b');
    }

    // Determine starting theme
    function getTheme() {
        const stored = localStorage.getItem('theme');
        if (stored) return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Apply theme ASAP
    setTheme(getTheme());

    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('theme-toggle');
        const icon = document.getElementById('theme-icon');
        if (!btn || !icon) return;

        function updateIcon() {
            icon.textContent = root.classList.contains('dark') ? 'light_mode' : 'dark_mode';
        }

        btn.addEventListener('click', () => {
            const mode = root.classList.contains('dark') ? 'light' : 'dark';
            setTheme(mode);
            updateIcon();
        });

        updateIcon();
    });
})();
