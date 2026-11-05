#!/usr/bin/env node
'use strict';
// Build-time packaging of identical shared source into a standalone Android application.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const destination=path.join(root,'android/app/src/main/assets');
const scripts=[
  'android/bootstrap.js',
  'shared/hardware-capabilities.js',
  'shared/kxci-protocol.js',
  'shared/measurement-plan.js',
  'shared/waveform.js',
  'shared/identity-core.js',
  'android/native-client.js'
];
function makeAndroidHtml(){
  const scriptTags=scripts.map(src=>'<script src="/'+src+'" defer></script>').join('\n');
  const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
  const marker='<script src="/app.js" defer></script>';
  if(!html.includes(marker))throw Error('Android packaging requires expected Web UI entry point');
  return html.replace(marker,scriptTags+'\n'+marker);
}
function syncAssets(){
  fs.mkdirSync(path.join(destination,'android'),{recursive:true});
  fs.mkdirSync(path.join(destination,'shared'),{recursive:true});
  require('./prepare-dkds-plot-vendor.cjs');
  fs.writeFileSync(path.join(destination,'index.html'),makeAndroidHtml());
  for(const item of ["d3.min.js","dkds/theme-bridge.js","dkds/style-gate.js","dkds/native-touch-drag.js","dkds/chart-export.js","dkds/display.js","dkds/heatmap-canvas.js","dkds/heatmap-selection.js","dkds/presentation.js","dkds/d3-renderer.js","dkds/chart-runtime.js"]){
    const source=path.join(root,'web','vendor',item);
    const output=path.join(destination,'vendor',item);
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.copyFileSync(source,output);
  }
  for(const file of ['app.js','styles.css'])
    fs.copyFileSync(path.join(root,'web',file),path.join(destination,file));
  for(const file of ['hardware-capabilities.js','kxci-protocol.js','measurement-plan.js','waveform.js','identity-core.js'])
    fs.copyFileSync(path.join(root,'src/shared',file),path.join(destination,'shared',file));
  for(const file of ['bootstrap.js','native-client.js'])
    fs.copyFileSync(path.join(root,'android/web',file),path.join(destination,'android',file));
  console.log('Synced DK Test Studio Android assets: shared core copied byte-for-byte.');
}
if(require.main===module)syncAssets();
module.exports={makeAndroidHtml,syncAssets};
