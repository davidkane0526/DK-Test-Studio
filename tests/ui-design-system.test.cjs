'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {buildUiSystem,cssSources}=require('../tools/build-ui-system.cjs');
test('compiled resources exactly match the frozen a97 visual baseline and local alignment patch',()=>{
 const out=buildUiSystem({write:false});assert.equal(read('web/app.js'),out.js);assert.equal(read('web/styles.css'),out.css);
 assert.equal(cssSources.length,2);assert.match(out.js,/VERSION='1.0.0'/);
 assert.match(out.css,/a97 visual baseline plus targeted alignment/);
});
test('unverified layered redesign has no effect on the restored visual contract',()=>{
 const css=read('web/styles.css');
 assert.doesNotMatch(css,/@layer dkts\./);
 assert(css.indexOf('/* a97-baseline */')<css.indexOf('/* control-alignment */'));
 assert.match(css,/\.dkts-select-popover\{\s*position:fixed/);
 assert.match(css,/\.dkts-numeric-keypad\[hidden\]\{display:none!important\}/);
 assert.match(css,/body\.dkts-android-shell \.dkts-numeric-keypad\{/);
});
test('a single field-height contract governs parameter and terminal controls only',()=>{
 const fix=read('web/ui/controls-alignment.css');
 assert.match(fix,/--dkts-unified-control-height:36px/);
 assert.match(fix,/--dkts-unified-control-height:44px/);
 assert.match(fix,/\.terminal-profiles/);
 assert.match(fix,/\.sweep-terminal-row\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(fix,/\.dkts-numeric-keypad|\.dkts-select-popover|\.dkts-select-option|\.dkds-scientific-nav-tools/);
});
test('existing keyboard and dropdown interaction remains bound while measurement runner is preserved',()=>{
 const app=read('web/app-main.js');
 assert.match(app,/function enhanceWorkspaceSelects\(root=document\)/);
 assert.match(app,/function installAndroidNumericKeypad\(\)/);
 assert.match(app,/window\.DKTSNumericKeypad=Object\.freeze/);
 assert.match(app,/window\.DKTSEnhanceNewSelects=enhanceWorkspaceSelects/);
 assert.match(app,/startKxciMeasurement/);
 assert.match(app,/post\('\/api\/measurement\/start'/);
});
test('semantic component constructors remain available without taking CSS ownership of the a97 layout',()=>{
 const source=read('web/ui/runtime.js');
 assert.match(source,/contractVersion:VERSION/);assert.match(source,/createField/);
 assert.match(source,/createAction/);assert.match(source,/DKDSStyleGate/);
 assert.doesNotMatch(read('web/styles.css'),/dkds\.field-control\{/);
});
test('DKDS plugin theme bridge and existing three-file hot-update contract remain intact',()=>{
 const presentation=read('integrations/dkds/presentation.js'),bridge=read('integrations/dkds/frame-bridge.js'),manifest=JSON.parse(read('integrations/dkds/plugin.json'));
 assert.match(presentation,/DKDSTheme/);assert.match(bridge,/DKTSFrameSession/);
 assert(manifest.requiresCore.includes('ui.theme'));
 const updater=read('src/ui-update.cjs'),android=read('android/app/src/main/java/studio/dk/test/UiUpdateManager.java');
 assert.match(updater,/index\.html[\s\S]*app\.js[\s\S]*styles\.css/);
 assert.match(android,/index\.html[\s\S]*app\.js[\s\S]*styles\.css/);
 assert.match(read('docs/UI_ARCHITECTURE.md'),/three-file set/);
});

test('assigned-port rendering avoids three redundant disabled configuration grids',()=>{
 const app=read('web/app-main.js');
 const css=read('web/ui/controls-alignment.css');
 assert.match(app,/row\.dataset\.assigned=unavailable\?'false':'true'/);
 assert.match(css,/\.sweep-terminal-row\[data-assigned="false"\]\{display:none\}/);
 assert.match(css,/\.sweep-fixed-voltages>label\[hidden\]\{display:none!important\}/);
 assert.match(app,/label\.hidden=unassigned/);
 assert.match(app,/input\.disabled=unassigned\|\|active\.has\(role\)/);
 assert.match(css,/\.sweep-axis-heading\{\s*display:grid/);
 assert.match(css,/grid-template-columns:minmax\(510px,540px\) minmax\(0,1fr\)/);
 const visual=read('tools/ui-visual-smoke.cjs');
 assert.match(visual,/android-tablet-iv-full\.png/);
 assert.match(visual,/desktop-iv-full\.png/);
});
