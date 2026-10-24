<!-- /.hallmark/redesign.md -->
<!-- Records the El Apá redesign and its verification. -->
<!-- Gives reviewers the changes, evidence and existing limitations in one place. -->
<!-- RELEVANT FILES: compare.html, behavior-checks.json, copy-changes.diff, ../design.md -->
# El Apá redesign

Full redesign of four working screens: `index.html`, `ticket.html`, `menu.html`, `precios.html`.

The project keeps its vanilla JavaScript, localStorage schema, pricing and checkout rules.
There are no data migrations, deleted files or removed routes.

## Result

- One amber and gray system, Inter typography, shared tokens and locally bundled fonts.
- Table navigation and checkout are separate keyboard targets.
- Desktop ticket entry pairs products with an order rail. The phone order summary stays at the bottom.
- Menu availability uses native buttons with switch semantics. Dialogs trap and restore focus.
- Spanish labels replace the mixed-language display copy. Exact source changes are in `copy-changes.diff`.
- Existing nonfunctional destinations remain explicitly disabled. The old unconditional “SHIFT OPEN” label is omitted because it had no state behind it.
- The promotion instruction now accurately describes the existing automatic Monday/Wednesday behavior.
- The service-worker cache version includes the new CSS, helper script and local fonts.

## Evidence

`compare.html` contains the original and final browser captures at desktop and phone sizes.
`behavior-checks.json` records successful workflow, responsive, keyboard and CDN-unavailable checks.
The preservation check retains 6/6 links, 15/15 fields, 29/29 script hooks and 6/6 figures.
Final sweep: 0 FAIL, 0 WARN and 0 open REFLEX findings, with one documented gate waiver (39b).
Five headings were translated or rewritten and recorded in the stylesheet stamp.

The browser environment blocks file URLs. The capture transport maps each file to the same local HTTP-served page; remote CDN requests are fetched through the environment proxy with normal certificate validation.
The initial before count includes four blocked file-URL captures. Actual HTTP before screenshots are available for all four routes.

## Review

Fresh-context finish review: one finding, resolved. The old promotion instruction contradicted its automatic status.
The reviewer found no gap between the chosen system and the result.
The original phone catalog showed more rows in its first viewport; the redesigned version prioritizes readable labels and larger touch targets.

Large table and product tiles exceed generic button heights. Hallmark gate 39b is waived for these working tap targets; standard controls retain 44px touch targets.
Neutral surfaces are not additional primary-button styles. Icon-grid warnings concern functional product/table controls, not feature illustrations.

## Existing limitations

KDS, Trompo, Personal and Ajustes still have no configured destinations.
Ticket modifier checkboxes are still visual only; the existing order model does not save modifiers.
Synchronous local data has no asynchronous loading or recovery interface; none was invented by this redesign.
The automatic promotion and existing stored prices are carried over as found.

## Material

No photo slots or placeholder images. No new assets or business claims are needed to use the redesigned screens.
