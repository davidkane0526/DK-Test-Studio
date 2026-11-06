# DK Test Studio UI Architecture

DKTS uses a standalone UI contract aligned with DK Data Studio's public UI conventions. It does not copy the DKDS host's private DOM or require DKDS to render the independent Windows and Android applications.

- Theme values use the public DKDS --dkui-* token family. Standalone mode supplies matching light/dark defaults; the DKDS host forwards its active theme snapshot to the embedded workbench.
- Component identity uses semantic names such as field, toolbarAction, tab, chip and panelHeader. Variants and interaction states are represented by data attributes.
- Geometry is declared once in web/ui/runtime.js and exposed through DKTSUI.metrics. CSS consumes the corresponding custom properties.
- Page chrome, workspace surfaces, parameter panes, acquisition panes and responsive breakpoints have separate ownership layers.
- web/app-main.js owns instrument connection, test configuration, measurement state, history and data rendering. It does not own global design tokens.

## Source tree

| Source | Responsibility |
|---|---|
| web/ui/runtime.js | Component identity, field/action/surface factories, theme adapter, dynamic DOM enhancement |
| web/ui/tokens.css | DKDS-compatible semantic theme tokens and DKTS geometry metrics |
| web/ui/layout.css | Application chrome, workspace, cards, panels and dialogs |
| web/ui/components.css | Field, action, tab, chip and focus/disabled states |
| web/ui/measurement.css | Xsweep/Psweep, port settings, parameter forms and acquisition data layout |
| web/ui/responsive.css | Container queries, narrow-screen layout and Android touch geometry |
| web/ui/legacy.css | Transitional chart/native-shell rules retained until their owning modules are migrated |
| web/app-main.js | DKTS application and measurement workflow |

## Build and update contract

tools/build-ui-system.cjs compiles the source modules into web/app.js and web/styles.css. The compiled files are committed and are the only UI resources consumed by the current hot-update contract. The update payload therefore remains the established three-file set: index.html, app.js and styles.css. No new native allowlist, Android shell generation, or full-package installation is needed for ordinary UI changes.

The same compiled app.js and styles.css are used by the standalone application, Android asset sync and the DKDS external plugin. Build entry points run the compiler before packaging, and tests compare generated outputs with their source modules to prevent stale bundles.

## Responsive layout rules

- Wide workspace: one-line terminal profile controls and a compact parameter pane beside a flexible acquisition pane.
- Medium workspace: terminal profile controls wrap to two rows; parameter and acquisition panes stack when content width becomes constrained.
- Phone: two-column test cards, two-column terminal controls, stacked parameter/acquisition panes and touch-sized numeric controls.
- Android: 44 px primary form controls; desktop retains compact 32 px controls.

## Extension rules

1. Add a primitive or variant to the UI runtime contract before styling it.
2. Put visual values in semantic tokens, not hard-coded component selectors.
3. Put geometry in the structure/measurement layers; do not append CSS overrides to repair earlier geometry.
4. Add narrow-screen behavior in responsive.css, preferably using the workspace container rather than device-name selectors.
5. Keep instrument-specific state and safety logic in web/app-main.js or src/shared/, never in the visual runtime.
6. Run npm test, npm run build:ui, Android asset sync and DKDS plugin validation before treating the UI change as complete.
