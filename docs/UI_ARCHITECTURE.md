# DK Test Studio UI — a97 visual rollback
The November 6 layered redesign was rolled back because its global chrome, field and scroll rules regressed Android numeric editing and the anchored select dropdown. The visually authoritative baseline is the working pre-PR a97 `web/styles.css` (commit `f4680808`).

The project retains the newer KXCI measurement runner, native bridges, DKDS plugin integration, and original UI JavaScript handlers. Only the stylesheet cascade was restored. The number pad, floating select, scientific plot controls and status chrome still use their a97 style and interaction semantics. All size corrections are isolated to `web/ui/controls-alignment.css`.

## Sources
- `web/ui/legacy.css`: complete pre-PR a97 stylesheet, intentionally unlayered.
- `web/ui/controls-alignment.css`: limited 36 px desktop/44 px Android form control heights and alignment.
- `web/ui/runtime.js` / `web/app-main.js`: original measurement/UI runtime, still compiled into `web/app.js`.
- `web/ui/{tokens,layout,components,measurement,responsive}.css`: archived, **not emitted** by the compiler; must not be re-enabled without an interactive regression test.

`tools/build-ui-system.cjs` builds `web/styles.css` and `web/app.js` deterministically. Android, Windows and DKDS share the established three-file set: index.html, app.js and styles.css.

## Regression safeguards
- Never apply a generic action/field selector to number-pad keys, dropdown list items or chart buttons.
- Do not replace document scrolling with a fixed flex viewport while the a97 keypad and popover use viewport-relative coordinates and `window.scrollBy`.
- Do not add a global `@layer` cascade over the a97 stylesheet.
- Preserve instrument safety and data provenance independently of appearance changes.
