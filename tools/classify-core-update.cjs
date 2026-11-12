'use strict';
const {execFileSync}=require('node:child_process');
const HOT_CSS='integrations/dkds-native/ui-shell.css';
function classify(files){
  const metadata=file=>file.startsWith('docs/')||file.startsWith('.github/')||
    ['README.md','CHANGELOG.md','LICENSE'].includes(file);
  const changed=[...new Set(files)].filter(Boolean).filter(file=>!metadata(file));
  const updateChannel=changed.length===0?'none':
    changed.every(file=>file===HOT_CSS)?'ui-hot':'full-app';
  return {updateChannel,hotUpdateAvailable:updateChannel==='ui-hot',changedFiles:changed};
}
function changedFiles(){
  if(process.env.DKTS_FORCE_FULL_APP==='true')return ['package.json'];
  const head=process.env.GITHUB_SHA||'HEAD';
  const base=process.env.DKTS_BASE_SHA||'';
  if(base&&!/^0+$/.test(base)&&base!==head){
    return execFileSync('git',['diff','--name-only',base+'...'+head],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
  }
  try{return execFileSync('git',['diff','--name-only','HEAD^','HEAD'],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean);}
  catch{return ['package.json'];}
}
if(require.main===module){
  const result=classify(changedFiles());
  const output=[
    'update_channel='+result.updateChannel,
    'hot_update_available='+String(result.hotUpdateAvailable),
    'changed_files='+result.changedFiles.join(',')
  ].join('\n')+'\n';
  if(process.env.GITHUB_OUTPUT)require('node:fs').appendFileSync(process.env.GITHUB_OUTPUT,output);
  process.stdout.write(output);
}
module.exports={classify,changedFiles};
