// /js/ui.js
// Supplies shared presentation helpers and keyboard behavior.
// Keeps escaped labels, focus and dialog access consistent without changing data rules.
// RELEVANT FILES: app.js, theme.js, styles.css, menu.js
(function () {
    'use strict';
    document.documentElement.classList.add('js');
    const App = window.TaqueriaApp;
    App.escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);

    document.addEventListener('DOMContentLoaded', () => {
        // Safari resizes the visual viewport when its keyboard opens.
        const viewport = window.visualViewport;
        const syncViewport = () => {
            const root = document.documentElement;
            root.style.setProperty('--visual-height', `${viewport.height}px`);
            root.style.setProperty('--visual-top', `${viewport.offsetTop}px`);
            const editing = document.activeElement?.matches('input, textarea, select');
            root.classList.toggle('keyboard-open', Boolean(editing && window.innerHeight - viewport.height > 120));
        };
        if (viewport) {
            viewport.addEventListener('resize', syncViewport);
            viewport.addEventListener('scroll', syncViewport);
            document.addEventListener('focusin', syncViewport);
            document.addEventListener('focusout', syncViewport);
            syncViewport();
        }
        const themeButton = document.getElementById('theme-toggle');
        const syncTheme = () => themeButton?.setAttribute('aria-pressed',
            String(document.documentElement.classList.contains('dark')));
        syncTheme();
        new MutationObserver(syncTheme).observe(document.documentElement,
            { attributes: true, attributeFilter: ['class'] });

        let lastOutsideFocus = document.activeElement;
        document.addEventListener('focusin', event => {
            if (!event.target.closest('.modal-overlay')) lastOutsideFocus = event.target;
        });

        // Existing handlers own open/close. Observe visibility to add focus safety.
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            const panel = overlay.querySelector('[role="dialog"]');
            let previousFocus = null;
            let open = false;
            const focusable = () => [...panel.querySelectorAll(
                'button:not(:disabled), input:not([type="hidden"]), select, a[href]'
            )].filter(el => el.getClientRects().length);
            const background = [...document.body.children].filter(el =>
                el !== overlay && !['SCRIPT', 'LINK'].includes(el.tagName));
            new MutationObserver(() => {
                const visible = !overlay.classList.contains('hidden') && overlay.style.display !== 'none';
                if (visible === open) return;
                open = visible;
                background.forEach(el => el.inert = open);
                if (open) {
                    previousFocus = lastOutsideFocus;
                    focusable()[0]?.focus();
                } else if (previousFocus?.isConnected) previousFocus.focus();
            }).observe(overlay, { attributes: true, attributeFilter: ['class', 'style'] });
            panel.addEventListener('keydown', event => {
                if (event.key === 'Escape') {
                    const close = panel.querySelector('#modal-cancel, #modal-close');
                    close?.click();
                    return;
                }
                if (event.key !== 'Tab') return;
                const targets = focusable();
                const first = targets[0], last = targets.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault(); last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault(); first?.focus();
                }
            });
        });
        document.querySelectorAll('[aria-disabled="true"]').forEach(link =>
            link.addEventListener('click', event => event.preventDefault()));
        const tabs = [...document.querySelectorAll('.order-tabs [role="tab"]')];
        tabs.forEach((tab, index) => tab.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
                (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            tabs[next].focus(); tabs[next].click();
        }));
    });
})();
