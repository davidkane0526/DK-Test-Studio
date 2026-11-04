'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const API='https://api.github.com/repos/davidkane0526/DK-Test-Studio/releases?per_page=12';
const REPO='davidkane0526/DK-Test-Studio';
const ASSET='DKTS-UI-bundle.json';
const FILES=Object.freeze(['index.html','app.js','styles.css']);
const TYPE='dkts-ui-v1';
function validateBundle(bundle,platform){
  if(!bundle||bundle.schema!==TYPE||bundle.repository!==REPO||
    !/^[a-zA-Z0-9._-]{5,80}$/.test(bundle.version||'')||
    bundle.minShell!==2||!bundle.platforms?.[platform])
    throw Error('Unsupported UI update bundle');
  const entries=bundle.platforms[platform];
  if(Object.keys(entries).sort().join(',')!==FILES.slice().sort().join(','))
    throw Error('UI update contains unexpected or missing files');
  let total=0;const decoded={};
  for(const name of FILES){
    const part=entries[name];
    if(!part||typeof part.base64!=='string'||!(/^[a-f0-9]{64}$/.test(part.sha256))||
      !Number.isSafeInteger(part.bytes)||part.bytes<1||part.bytes>524288)
      throw Error('Invalid UI update entry '+name);
    const bytes=Buffer.from(part.base64,'base64');
    if(bytes.length!==part.bytes||
      crypto.createHash('sha256').update(bytes).digest('hex')!==part.sha256)
      throw Error('UI update checksum mismatch '+name);
    total+=bytes.length;decoded[name]=bytes;
  }
  if(total>1048576)throw Error('UI bundle is too large');
  if(!decoded['index.html'].toString('utf8').includes('id="plan-form"'))
    throw Error('UI bundle is not a DK Test Studio workbench');
  return decoded;
}
function createUiUpdater(options={}){
  const root=options.cacheDir;
  if(!root)throw Error('cacheDir required');
  const fetcher=options.fetchImpl||fetch;
  let version='bundled',tag='',status='idle',lastError='',busy=null;
  const active=path.join(root,'ui-active'),stage=path.join(root,'ui-next'),backup=path.join(root,'ui-previous');
  function verifyCached(folder){
    const meta=JSON.parse(fs.readFileSync(path.join(folder,'meta.json'),'utf8'));
    if(meta.schema!==TYPE||meta.repository!==REPO||meta.minShell!==2)throw Error('Invalid cached UI metadata');
    const entries={};
    for(const name of FILES){
      const bytes=fs.readFileSync(path.join(folder,name));
      entries[name]={sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
        bytes:bytes.length,base64:bytes.toString('base64')};
    }
    validateBundle({schema:TYPE,version:meta.version,minShell:2,repository:REPO,
      platforms:{windows:entries}},'windows');
    return meta;
  }
  function restore(){
    try{const meta=verifyCached(active);version=meta.version;tag=meta.tag;}catch{
      version='bundled';tag='';
      try{const meta=verifyCached(backup);
        fs.rmSync(active,{recursive:true,force:true});fs.renameSync(backup,active);
        version=meta.version;tag=meta.tag;
      }catch{ /* bundled frontend remains usable */ }
    }
  }
  restore();
  function getAsset(name){
    if(!FILES.includes(name)||version==='bundled')return null;
    try{return fs.readFileSync(path.join(active,name));}
    catch{return null;}
  }
  async function request(url){
    const res=await fetcher(url,{
      headers:{'User-Agent':'DK-Test-Studio','Accept':'application/vnd.github+json'},
      signal:AbortSignal.timeout(12000)
    });
    if(!res.ok)throw Error('Update endpoint HTTP '+res.status);
    return res.json();
  }
  async function updateOnce(){
    if(busy)return busy;
    const task=(async()=>{
      try{
        status='checking';
        const releases=await request(API);
        if(!Array.isArray(releases))throw Error('Invalid GitHub Releases response');
        // The GitHub Releases API is not always ordered by publication time.
        const release=releases.filter(r=>!r.draft&&r.tag_name?.startsWith('dkts-ui-')&&
          r.assets?.some(a=>a.name===ASSET))
          .sort((a,b)=>String(b.published_at||b.created_at||'')
            .localeCompare(String(a.published_at||a.created_at||'')))[0];
        if(!release){status='current';return {updated:false,version};}
        if(release.tag_name===tag){status='current';return {updated:false,version};}
        const asset=release.assets.find(a=>a.name===ASSET);
        if(!asset.browser_download_url?.startsWith(
          'https://github.com/davidkane0526/DK-Test-Studio/releases/download/'))
          throw Error('Unexpected update asset URL');
        const bundle=await request(asset.browser_download_url);
        if(bundle.version!==release.target_commitish&&
          bundle.version!==release.tag_name.slice('dkts-ui-'.length))
          throw Error('Update release and bundle version mismatch');
        const parts=validateBundle(bundle,'windows');
        fs.mkdirSync(root,{recursive:true});
        fs.rmSync(stage,{recursive:true,force:true});fs.mkdirSync(stage);
        for(const name of FILES)fs.writeFileSync(path.join(stage,name),parts[name]);
        fs.writeFileSync(path.join(stage,'meta.json'),JSON.stringify({
          schema:TYPE,version:bundle.version,tag:release.tag_name,minShell:2,repository:REPO
        }));
        verifyCached(stage);
        fs.rmSync(backup,{recursive:true,force:true});
        if(fs.existsSync(active))fs.renameSync(active,backup);
        try{fs.renameSync(stage,active);}
        catch(e){if(fs.existsSync(backup))fs.renameSync(backup,active);throw e;}
        version=bundle.version;tag=release.tag_name;status='updated';lastError='';
        return {updated:true,version};
      }catch(e){
        status='offline';lastError=String(e.message||e).slice(0,180);
        return {updated:false,version,error:lastError};
      }
    })();
    busy=task;
    try{return await task;}finally{if(busy===task)busy=null;}
  }
  let timer=null;
  function start(intervalMs=180000){
    if(timer)return;
    void updateOnce();
    timer=setInterval(()=>{void updateOnce();},intervalMs);
    timer.unref?.();
  }
  function stop(){if(timer)clearInterval(timer);timer=null;}
  return Object.freeze({getAsset,updateOnce,start,stop,
    state:()=>({version,tag,status,error:lastError})});
}
module.exports={createUiUpdater,validateBundle};
