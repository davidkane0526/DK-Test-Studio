'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const manifest=JSON.parse(read('docs/reference/fspro-accepted-20261116/BASELINE-MANIFEST.json'));
const plugin=read('integrations/dkds-native/plugin.js');
const css=read('integrations/dkds-native/ui-shell.css');

test('accepted FS-Pro Web source and reference screenshot remain immutable',()=>{
 assert.equal(manifest.schema,'dkts.fspro.visual-baseline-lock.v1');
 assert.match(manifest.referenceStatus,/NOT an OEM FS-Pro screenshot/);
 for(const [file,digest] of Object.entries(manifest.immutableBaselineFilesSha256)){
  const bytes=fs.readFileSync(path.join(root,file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),digest,
   `Do not silently replace the accepted FS-Pro Web visual baseline: ${file}`);
 }
});

test('LabExpress main tabs and lower scan settings retain their own levels',()=>{
 assert.ok(plugin.includes("const PAGE_TABS=[['sweep','Sweep'],['target','Target'],['strategy','Strategy']]"));
 assert.match(plugin,/renderSweep\(parameters,p,s\)/);
 assert.match(plugin,/renderFixedBias\(input.body,p\)[\s\S]*renderLimitsPanel\(options,p\)[\s\S]*renderVariablesPanel\(options,p\)[\s\S]*renderAssociateSpecPanel\(options,p,s\)[\s\S]*renderTerminalSettings\(host,p\)/);
 assert.doesNotMatch(plugin,/id:'(?:validate-sweep-plan|back-to-graphs|dkts-language-compact)'/);
});

test('Xsweep and Psweep preserve the FS-Pro scan table columns and header controls',()=>{
 assert.match(plugin,/renderSweepAxis\(input.body,p,'X'\)/);
 assert.match(plugin,/renderSweepAxis\(input.body,p,'P'\)/);
 for(const label of ['Start (V)','Stop (V)','Step (V)','Range (A)','Speed'])
  assert.ok(plugin.includes("['"+label.toLowerCase().split(' ')[0]+"'" )||plugin.includes("label:'"+label+"'" )||plugin.includes("'"+label+"'"),label+' is present in the scan editor');
 assert.match(plugin,/\['#','Start \(V\)','Stop \(V\)','Step \(V\)','Range \(A\)','Speed',''\]/);
 assert.match(plugin,/className:'dkts-sweep-segment'/);
 assert.match(plugin,/className:'dkts-sweep-segment-head'/);
 assert.match(plugin,/meta:t\(isP\?'Outer Sweep':'Inner Sweep'\)/);
 assert.match(plugin,/id:'add-segment-'\+axis/);
 assert.match(plugin,/固定偏置 · Psweep 未启用/);
});

test('Terminal, Terminal Settings and Fixed Bias are separate FS-Pro regions',()=>{
 assert.match(plugin,/for\(const logical of \['S','D','G'\]\)/);
 assert.doesNotMatch(plugin,/for\(const logical of \['S','D','G','B'\]\)/);
 assert.match(plugin,/GNDU/);
 assert.match(plugin,/title:t\('Terminal Settings'\)/);
 assert.match(plugin,/Range Mode/);
 assert.match(plugin,/Current Range \(A\)/);
 assert.match(plugin,/Compliance Mode/);
 assert.match(plugin,/Compliance \(A\)/);
 assert.match(plugin,/title:t\('Fixed Bias'\)/);
 assert.match(plugin,/data-dkts-terminal-collapsed/);
});

test('DKTS adapts public Unit entry points without a derived Core patch',()=>{
 assert.match(plugin,/units\.tabs\.create\(editorTabs,\{variant:'compact'/);
 assert.match(plugin,/onClick:\(\)=>selectTab\(id\)/);
 assert.match(plugin,/function fsproField/);
 assert.doesNotMatch(plugin,/variant:'fspro/);
 assert.doesNotMatch(read('tools/stage-dkds-host.cjs'),/patch-dkts-derived-units/);
});

test('project graph and full-width Unit editor are mutually exclusive views',()=>{
 assert.match(plugin,/editorRegion\.hidden=!editorOpen/);
 assert.match(plugin,/plotRegion\.hidden=editorOpen/);
 assert.doesNotMatch(plugin,/workRegion\.replaceChildren/);
 assert.match(plugin,/units\.plotGroup\.create\(/);
 assert.match(plugin,/frameGroup\.adoptPlot\(/);
 assert.match(plugin,/units\.scientificPlot\.create/);
 assert.match(plugin,/data-dkts-plot-group/);
 assert.match(plugin,/data-dkts-plot-frame/);
 assert.match(css,/dkts-project-plot-area/);
});

test('visual freeze does not authorize KXCI output or bypass raw-data execution',()=>{
 const runtime=read('integrations/dkds-native/measurement-runtime.js');
 assert.match(runtime,/allowInstrumentOutput/);
 assert.match(runtime,/targets\.length!==1/);
 assert.match(runtime,/Forward \/ Reverse 或 Hysteresis/);
 assert.match(plugin,/ctx\.data\.sources\.list\(\)/);
 assert.match(plugin,/ctx\.io\.saveCsv\(rows,/);
 assert.doesNotMatch(plugin,/\bME1\b|\bDV\b|\bUS\b|\bRV\b/);
});
