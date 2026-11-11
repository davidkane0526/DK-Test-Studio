#!/usr/bin/env node
'use strict';
// Default DKTS developer launch: run the genuine, pinned DKDS Core-derived host.
// The upstream DKDS repository is NEVER patched. The original standalone
// Electron entrypoint is available only by explicitly using start:legacy.
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {stage}=require('./stage-dkds-host.cjs');
const ROOT=path.resolve(__dirname,'..');
const PIN='20f056851a61d2144e9524c3ed568628d4b8557c';
const UPSTREAM_URL='https://github.com/davidkane0526/DK-Data-Studio.git';
function invoke(bin,args,cwd,{capture=false}={}){
 const result=spawnSync(bin,args,{cwd,encoding:capture?'utf8':undefined,
  stdio:capture?['ignore','pipe','pipe']:'inherit',
  env:process.env,windowsHide:false,
  shell:process.platform==='win32'&&/\.cmd$/i.test(bin)});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error(bin+' '+args.join(' ')+' failed with exit '+result.status+
  (capture?'\n'+String(result.stderr||''):''));
 return capture?String(result.stdout).trim():'';
}
function pinnedSource(){
 const override=String(process.env.DKTS_DKDS_SOURCE||'').trim();
 const source=override?path.resolve(override):
  path.join(ROOT,'.dkts-cache','dkds-pinned',PIN);
 const git=invoke('git',['rev-parse','HEAD'],source,{capture:true});
 if(git!==PIN)throw Error('DKDS source must be the read-only pinned commit '+PIN+
  ', received '+git+' at '+source);
 return source;
}
function ensureSource(){
 const override=String(process.env.DKTS_DKDS_SOURCE||'').trim();
 if(override)return pinnedSource();
 const target=path.join(ROOT,'.dkts-cache','dkds-pinned',PIN);
 if(!fs.existsSync(path.join(target,'.git'))){
  fs.mkdirSync(target,{recursive:true});
  invoke('git',['init'],target);
  invoke('git',['remote','add','origin',UPSTREAM_URL],target);
  invoke('git',['fetch','--depth=1','origin',PIN],target);
  invoke('git',['checkout','--detach',PIN],target);
 }
 return pinnedSource();
}
function main(){
 const source=ensureSource(),output=path.join(ROOT,'dist','dkts-core-mainline');
 const staging=stage(source,output);
 if(!staging.derivedDistribution||staging.previewAppId!=='studio.dk.test.corepreview')
  throw Error('Derived Core staging safety contract failed');
 const npm=process.platform==='win32'?'npm.cmd':'npm';
 invoke(npm,['install','--include=dev','--no-audit','--no-fund'],output);
 for(const task of ['runtime:build','styles:build','sdk:authoring','plugin:index',
  'plugin:validate','brand:assets'])invoke(npm,['run',task],output);
 invoke(process.execPath,['scripts/prepare-build.js'],output);
 const electron=path.join(output,'node_modules','electron','cli.js');
 if(!fs.existsSync(electron))throw Error('Real DKDS Core Electron is unavailable: '+electron);
 console.log('Starting DK Test Studio Core from pinned read-only DKDS '+PIN.slice(0,8));
 invoke(process.execPath,[electron,'.'],output);
}
try{main();}catch(error){console.error('DKTS Core launch failed:',error.message);process.exitCode=1;}
