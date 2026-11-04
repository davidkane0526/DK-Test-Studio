#!/usr/bin/env node
'use strict';
// Deterministically stage the exact shared core sources into a DKDS API 1.19 plug-in.
// No generated executable instrument commands or duplicate measurement logic.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'dist','dkds-plugin');
const template=path.join(root,'integrations','dkds');
const manifest=JSON.parse(fs.readFileSync(path.join(template,'plugin.json'),'utf8'));
const copy={
  'kxci-protocol.js':'src/shared/kxci-protocol.js',
  'measurement-plan.js':'src/shared/measurement-plan.js',
  'waveform.js':'src/shared/waveform.js',
  'identity-core.js':'src/shared/identity-core.js',
  'interop.js':'src/shared/interop.js',
  'presentation.js':'integrations/dkds/presentation.js',
  'plugin.js':'integrations/dkds/plugin.js'
};
// The Android/Windows standalone host keeps its original trusted shared
// module owner. Only the generated DKDS EXTERNAL plugin receives a new owner.
// This is a deterministic change of registration metadata, not domain logic.
const ORIGINAL_OWNER='com.dkds.keithley-4200';
const EXTERNAL_OWNER='com.dkts.keithley-4200';
function adaptPluginSource(name,data){
  if(name==='interop.js'){
    const marker="const PLUGIN_ID='"+ORIGINAL_OWNER+"';";
    if(!data.includes(marker))throw Error('Interop owner marker missing');
    return data.replace(marker,"const PLUGIN_ID='"+EXTERNAL_OWNER+"';");
  }
  if(['kxci-protocol.js','measurement-plan.js','waveform.js','identity-core.js'].includes(name)){
    const marker="'"+ORIGINAL_OWNER+"'";
    if(!data.includes(marker))throw Error('Shared module registration owner missing: '+name);
    return data.replace(marker,"'"+EXTERNAL_OWNER+"'");
  }
  return data;
}
const requireFiles=new Set(manifest.scripts);
if(manifest.apiVersion!=='1.19.0'||manifest.id!=='com.dkts.keithley-4200'||manifest.version!=='0.5.0')
  throw Error('Unexpected standalone DK Test Studio plugin identity / API / version');
if(requireFiles.size!==Object.keys(copy).length||Object.keys(copy).some(x=>!requireFiles.has(x)))
  throw Error('Plugin manifest scripts must exactly match staging files');
fs.mkdirSync(folder,{recursive:true});
const files={};
for(const [name,src] of Object.entries(copy)){
  const data=adaptPluginSource(name,fs.readFileSync(path.join(root,src),'utf8'));
  fs.writeFileSync(path.join(folder,name),data,'utf8');files[name]=data;
}
fs.writeFileSync(path.join(folder,'plugin.json'),JSON.stringify(manifest,null,2)+'\n');
const pkg={schema:1,manifest,files};
const artifact=path.join(root,'dist',manifest.id+'-'+manifest.version+'.dkplugin');
fs.writeFileSync(artifact,JSON.stringify(pkg,null,2)+'\n','utf8');
console.log('Staged '+folder);
console.log('DKDS Plugin API 1.19 package candidate '+artifact);
console.log('For production, validate against DK Data Studio SDK before installation.');
module.exports={folder,artifact,manifest,adaptPluginSource};

