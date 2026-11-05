#!/usr/bin/env node
'use strict';
// Cross-check a generated package with DKDS' ACTUAL bundled plugin registry
// and the desktop installer's current-contract package normalization.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const dkds=path.resolve(process.argv[2]||path.join(root,'compat/dkds'));
const pluginManifest=JSON.parse(fs.readFileSync(path.join(root,'integrations','dkds','plugin.json'),'utf8'));
const defaultPackagePath=path.join(root,'dist',pluginManifest.id+'-'+pluginManifest.version+'.dkplugin');
const packagePath=path.resolve(process.argv[3]||defaultPackagePath);
const normalizer=require(path.join(dkds,'desktop/plugin-package.js')).normalizePluginPackage;
const pkg=normalizer(JSON.parse(fs.readFileSync(packagePath,'utf8')),{allowBuiltinId:false});
const candidate=pkg.manifest;
const plugins=path.join(dkds,'src/plugins');
const bundled=fs.readdirSync(plugins,{withFileTypes:true})
  .filter(d=>d.isDirectory()&&!d.name.startsWith('_'))
  .map(d=>path.join(plugins,d.name,'plugin.json'))
  .filter(p=>fs.existsSync(p))
  .map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
const existingIds=new Set(bundled.map(p=>p.id));
if(existingIds.has(candidate.id))
  throw new Error('Install would override a bundled DKDS plugin: '+candidate.id);
const activities=new Set(bundled.map(p=>p.workspace?.activity).filter(Boolean));
if(activities.has(candidate.workspace?.activity))
  throw new Error('Workspace collides with bundled DKDS activity: '+candidate.workspace.activity);
const windows=new Set(bundled.map(p=>p.window?.activity).filter(Boolean));
if(windows.has(candidate.window?.activity))
  throw new Error('Window collides with bundled DKDS activity: '+candidate.window.activity);
const capabilities=new Set(bundled.flatMap(p=>p.capabilities||[]).filter(p=>p.startsWith('instrument.')));
for(const name of candidate.capabilities||[])
  if(name.startsWith('instrument.')&&capabilities.has(name))
    throw new Error('Registered instrument capability collides with DKDS builtin: '+name);
const owner='com.dkts.keithley-4200';
if(candidate.id!==owner)throw new Error('Expected external package owner '+owner);
for(const name of ['kxci-protocol.js','measurement-plan.js','waveform.js','identity-core.js','presentation.js','interop.js']){
  const source=pkg.files[name];
  if(typeof source!=='string')throw new Error('Packaged module absent: '+name);
  if(!source.includes(owner))throw new Error('Wrong module owner: '+name);
}
console.log('DKDS installer accepted candidate package normalization');
console.log('DKDS bundled plugin IDs checked: '+bundled.length);
console.log('Standalone external identity, TOP activity, window and instrument capability: unique');
console.log('Package '+candidate.id+' v'+candidate.version+' can enter external install path (not builtin override).');
