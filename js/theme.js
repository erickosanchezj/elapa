// /js/theme.js
// This script handles the theme switching logic for the entire application.
// It reads the user's preferred theme from localStorage and applies it.
// It also wires up the theme toggle button to allow changing the theme.

(function() {
    'use strict';

    // Ensure the TaqueriaApp namespace exists
    window.TaqueriaApp = window.TaqueriaApp || {};
    const App = window.TaqueriaApp;

    // Helper to query the DOM
    App.$ = sel => document.querySelector(sel);

    /**
     * Applies the theme class to the root element.
     * @param {string} theme - The theme to apply ('dark' or 'light').
     */
    function applyThemeClass(theme) {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }

    /**
     * Updates the theme toggle button icon based on the current theme.
     */
    function updateThemeIcon() {
        const themeIcon = App.$('#theme-icon');
        if (themeIcon) {
            const isDark = document.documentElement.classList.contains('dark');
            themeIcon.textContent = isDark ? 'dark_mode' : 'light_mode';
        }
    }

    /**
     * Wires up the theme toggle button to switch the theme on click.
     */
    function setupThemeToggle() {
        const themeToggleBtn = App.$('#theme-toggle');
        if (!themeToggleBtn) return;

        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.documentElement.classList.contains('dark');
            const newTheme = isDark ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyThemeClass(newTheme);
            updateThemeIcon(); // Also update icon on click
        });
    }

    /**
     * Initializes the theme based on localStorage or system preference.
     */
    function initTheme() {
        // Apply the theme class immediately to prevent flashing
        const initialTheme = localStorage.getItem('theme') ||
                             (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        applyThemeClass(initialTheme);

        // Wait for the DOM to be fully loaded before setting up the toggle and icon
        document.addEventListener('DOMContentLoaded', () => {
            updateThemeIcon();
            setupThemeToggle();
        });
    }

    // Expose the init function to be called from other scripts
    App.initTheme = initTheme;

    // Initialize the theme as soon as this script is loaded
    App.initTheme();

})();