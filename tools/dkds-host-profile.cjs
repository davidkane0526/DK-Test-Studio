#!/usr/bin/env node
'use strict';
/*
 * DKTS only: inspect a READ-ONLY checkout of the actual DKDS framework.
 * Keep every non-analysis built-in plugin; omit analysis workbenches/providers
 * from DKTS distribution staging, NEVER from DKDS itself.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function verify(root){
 const src=path.resolve(root),exists=p=>fs.existsSync(path.join(src,p));
 const required=[
  'package.json','src/index.html','src/app','src/core','src/plugins',
  'src/plugins/connectivity-center/plugin.json',
  'src/plugins/data-center/plugin.json',
  'src/plugins/status-monitor/plugin.json',
  'desktop/native-update.js','desktop/ui-hot-update.js',
  'desktop/apply-portable-update.ps1','mobile/package.json',
  'mobile/plugins/DkdsLanTcp.template','mobile/plugins/DkdsAppUpdate.template',
  'mobile/plugins/DkdsUiHotUpdate.template','sdk/tools/dkds-plugin.js'
 ];
 const missing=required.filter(p=>!exists(p));
 if(missing.length)throw Error('DKDS framework host missing: '+missing.join(', '));
 const pkg=readJson(path.join(src,'package.json'));
 if(pkg.name!=='dk-data-studio')throw Error('Unexpected upstream framework identity');
 const index=path.join(src,'src/plugins'),all=[];
 for(const entry of fs.readdirSync(index,{withFileTypes:true})){
  if(!entry.isDirectory()||entry.name.startsWith('_'))continue;
  const manifest=path.join(index,entry.name,'plugin.json');
  if(!fs.existsSync(manifest))continue;
  const m=readJson(manifest);
  if(/4200|keithley|dkts/i.test([m.id,m.name,m.workspace?.activity,m.window?.activity].join(' ')))
   throw Error('DKDS framework contains prohibited built-in instrument plugin: '+entry.name);
  const analysis=(m.capabilities||[]).some(v=>String(v).startsWith('analysis.'))||
    (m.pluginType==='workbench'&&/analysis/i.test(m.description||''));
  all.push({directory:entry.name,id:m.id,type:m.pluginType||'unknown',
   analysis,reason:analysis?'analysis capability/workbench':'retain non-analysis plugin'});
 }
 if(all.length<10)throw Error('DKDS built-in plugin inventory unexpectedly small');
 const included=all.filter(x=>!x.analysis),excluded=all.filter(x=>x.analysis);
 const ids=new Set(included.map(x=>x.id));
 for(const requiredId of ['builtin.connectivity-center','builtin.data-center',
   'builtin.status-monitor','builtin.shell-navigation',
   'builtin.scientific-data-contracts','builtin.workspace-safeguards']){
  if(!ids.has(requiredId))throw Error('Mandatory DKDS framework plugin not retained: '+requiredId);
 }
 if(!included.some(x=>x.type==='theme'))throw Error('DKDS themes were lost');
 if(!excluded.some(x=>x.id==='builtin.pulse-analysis'))
  throw Error('Analytic plugin exclusion failed');
 const digest=crypto.createHash('sha256').update(JSON.stringify(all)).digest('hex');
 return {schema:'dkts-dkds-host-profile-v1',upstream:{name:pkg.name,version:pkg.version,
  path:src,pluginCatalogSha256:digest},
  framework:{communication:'generic-connectivity-center',
   hotUpdate:'desktop/ui-hot-update.js + DkdsUiHotUpdate.template',
   localFullUpdate:'desktop/native-update.js + DkdsAppUpdate.template',
   dataCenter:true,scientificCore:true,themes:true,sharedProjects:true,
   memorySmbAiHistoryWeb:'DKDS host and retained foundation plugins'},
  included,excluded,counts:{total:all.length,retained:included.length,
   excluded:excluded.length},noUpstreamWrites:true};
}
if(require.main===module){
 const source=process.argv[2];
 if(!source)throw Error('Usage: node tools/dkds-host-profile.cjs <read-only-DKDS-checkout> [report.json]');
 const report=verify(source);
 const target=process.argv[3];
 if(target){fs.mkdirSync(path.dirname(path.resolve(target)),{recursive:true});
  fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify({version:report.upstream.version,counts:report.counts,
  retained:report.included.map(x=>x.id),
  omittedAnalysis:report.excluded.map(x=>x.id)},null,2));
}
module.exports={verify};
