'use strict';
const {execFileSync}=require('node:child_process');
const HOT_CSS='integrations/dkds-native/ui-shell.css';
function classify(files,{finalBuild=false}={}){
  const metadata=file=>file.startsWith('docs/')||file.startsWith('.github/')||
    ['README.md','CHANGELOG.md','LICENSE'].includes(file);
  const changed=[...new Set(files)].filter(Boolean).filter(file=>!metadata(file));
  // The reviewed source may already be on main when the build is authorized.
  const updateChannel=changed.length===0?(finalBuild?'full-app':'none'):
    changed.every(file=>file===HOT_CSS)?'ui-hot':'full-app';
  return {updateChannel,hotUpdateAvailable:updateChannel==='ui-hot',changedFiles:changed};
}
function changedFiles(){
  const head=process.env.GITHUB_SHA||'HEAD';
  const base=process.env.DKTS_BASE_SHA||'';
  if(base&&!/^0+$/.test(base)&&base!==head){
    return execFileSync('git',['diff','--name-only',base+'...'+head],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
  }
  try{return execFileSync('git',['diff','--name-only','HEAD^','HEAD'],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean);}
  catch{return ['package.json'];}
}
if(require.main===module){
  const result=classify(changedFiles(),{finalBuild:process.env.DKTS_FINAL_BUILD==='true'});
  const output=[
    'update_channel='+result.updateChannel,
    'hot_update_available='+String(result.hotUpdateAvailable),
    'changed_files='+result.changedFiles.join(',')
  ].join('\n')+'\n';
  if(process.env.GITHUB_OUTPUT)require('node:fs').appendFileSync(process.env.GITHUB_OUTPUT,output);
  process.stdout.write(output);
}
module.exports={classify,changedFiles};
