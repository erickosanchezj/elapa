<!-- /design.md -->
<!-- Describes the shared visual system for El Apá. -->
<!-- Keeps future screens consistent with the restaurant workspace. -->
<!-- RELEVANT FILES: js/tokens.css, js/styles.css, js/base.css -->
# Design: Taquería El Apá

This app uses one shared system. Change it intentionally across screens.

## System

- Genre: modern-minimal. Scope: app screen.
- Theme: the project's named amber and gray brand, with Inter.
- Palette: light neutral canvas, quiet elevated surfaces, dark neutral text.
- Accent: amber `#f59e0b`, paired with dark ink for readable buttons.
- Signature: the live table grid, with names, elapsed time, totals and checkout.
- Layout: a capped 1280px container, top bar and four working bottom destinations (Mesas, Tickets, Precios, Menú).
- Keep product facts, storage keys, handlers and routes intact.

## Tokens

`js/tokens.css` is the source of truth for color, fonts, spacing and sizing.
`js/fonts.css` loads locally bundled Inter and Material Symbols.
Light and dark modes use the same roles. Honor the saved theme preference.
Use the shared app scale; labels are sentence case, without tracking.
Use tabular numerals for money, elapsed time and quantities.

## Controls

- Primary: amber fill, dark text, 8px radius, at least 44px touch target.
- Secondary: neutral surface, visible edge, same radius and height.
- Focus: immediate 2px outline with a 3px offset.
- Fields: a persistent label, visible edge, native validation.
- Destructive actions retain confirmation.
- Dialogs trap keyboard focus, close with Escape and restore focus.

## Motion

Still by default. Feedback belongs to real interactions.
Honor reduced motion. Never animate layout dimensions.

## Exports

`js/tokens.css`, `js/base.css`, `js/styles.css`.
Legacy and receipt rules remain available in separate stylesheets.

## iOS and offline behavior

Safe-area insets protect the status bar and home indicator, including landscape.
A native table sheet collects names and notes on both floor and ticket screens.
Every screen registers the local-only offline shell. Updates wait until app windows close.
Theme metadata follows the current canvas; icon dimensions match the manifest.
