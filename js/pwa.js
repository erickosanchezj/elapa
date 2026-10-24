// /js/pwa.js
// Registers the shared offline worker on every current app screen.
// Installs updates without reloading a working order or forcing worker activation.
// RELEVANT FILES: ../service-worker.js, ui.js, ../manifest.webmanifest
(function () {
    'use strict';
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    const register = () => navigator.serviceWorker.register('./service-worker.js', {
        updateViaCache: 'none'
    }).catch(error => console.warn('Offline setup could not complete:', error.message));
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    // No skipWaiting or controllerchange reload: updates activate after all app windows close.
})();
