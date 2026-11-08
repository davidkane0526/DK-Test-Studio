# DKTS — native DKDS TOP integration preview

This is an **external** Plugin API 1.19 workbench. It is not copied into DKDS `src/plugins` and must be installed separately. It does not replace the stable DKTS plugin or the standalone app automatically.

Host-owned services are used without reimplementation:
- `ctx.ui.unitTemplates` / TOP PRIMARY + PRIME, native plot panel and header.
- `ctx.data.sources.list` / `ctx.data.artifacts.get` for existing Data Center records.
- `ctx.state.create` and `ctx.project.capture` for project-scoped test-page state.
- DKDS themes, navigation, history, memory, SMB, AI, web service and other app services remain in the DKDS **host**.

There is no iframe. No source/measure bridge, port mapping or actual KXCI execution is exposed in this preview. The native runtime must be connected to the verified DKTS backend and FS-Pro PagePlan before replacing the existing production plugin. Do not install this preview over a running real-measurement workflow.

The original standalone Windows/Android UI and its hot-update pipeline remain separate. This plugin does not claim to restore hot updates to the separate FS-Pro preview.
