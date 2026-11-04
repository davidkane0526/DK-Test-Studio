'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const API='https://api.github.com/repos/davidkane0526/DK-Test-Studio';
const COMMIT=/^[a-f0-9]{40}$/i;
const REPO='davidkane0526/DK-Test-Studio';
const ASSET='DKTS-UI-bundle.json';
const FILES=Object.freeze(['index.html','app.js','styles.css']);
const TYPE='dkts-ui-v1';
function validateBundle(bundle,platform){
  if(!bundle||bundle.schema!==TYPE||bundle.repository!==REPO||
    !/^[a-zA-Z0-9._-]{5,80}$/.test(bundle.version||'')||
    bundle.minShell!==3||!bundle.platforms?.[platform])
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
  // The built-in index.html is stamped with the exact native-shell commit.
  // This is the offline floor: a Release published later cannot downgrade it.
  function embeddedCommit(){
    if(options.baseCommit!==undefined)return String(options.baseCommit);
    try{
      const html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8');
      return /<meta name="dkts-ui-version" content="([a-f0-9]{40})">/i.exec(html)?.[1]||'';
    }catch{return '';}
  }
  const baseCommit=embeddedCommit().toLowerCase();
  let version='bundled',tag='',status='idle',lastError='',busy=null;
  const active=path.join(root,'ui-active'),stage=path.join(root,'ui-next'),backup=path.join(root,'ui-previous');
  function verifyCached(folder){
    const meta=JSON.parse(fs.readFileSync(path.join(folder,'meta.json'),'utf8'));
    if(meta.schema!==TYPE||meta.repository!==REPO||meta.minShell!==3||
      !COMMIT.test(baseCommit)||meta.shellBase!==baseCommit||
      !COMMIT.test(meta.version)||meta.tag!=='dkts-ui-'+meta.version)
      throw Error('Cached UI does not belong to the current native shell');
    const entries={};
    for(const name of FILES){
      const bytes=fs.readFileSync(path.join(folder,name));
      entries[name]={sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
        bytes:bytes.length,base64:bytes.toString('base64')};
    }
    validateBundle({schema:TYPE,version:meta.version,minShell:3,repository:REPO,
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
  async function request(url,{notFound=false}={}){
    const res=await fetcher(url,{
      headers:{'User-Agent':'DK-Test-Studio','Accept':'application/vnd.github+json'},
      signal:AbortSignal.timeout(12000)
    });
    if(notFound&&res.status===404)return null;
    if(!res.ok)throw Error('Update endpoint HTTP '+res.status);
    return res.json();
  }
  async function updateOnce(){
    if(busy)return busy;
    const task=(async()=>{
      try{
        status='checking';
        if(!COMMIT.test(baseCommit))
          throw Error('内置程序缺少可信 Git 版本标识，已阻止可能的 UI 回退');
        // UI hot-update releases are published only while their commit is
        // main HEAD. Resolve that exact tag: publication dates never order code.
        const branch=await request(API+'/branches/main');
        const head=String(branch?.commit?.sha||'').toLowerCase();
        if(!COMMIT.test(head))throw Error('无法验证主分支 Git 版本');
        const installed=version==='bundled'?baseCommit:version;
        if(!COMMIT.test(installed))throw Error('已安装 UI 版本无效');
        if(head===installed){status='current';return {updated:false,version};}
        const releaseTag='dkts-ui-'+head;
        const release=await request(API+'/releases/tags/'+releaseTag,{notFound:true});
        if(!release){status='pending';return {updated:false,version};}
        if(release.draft||release.tag_name!==releaseTag||
           String(release.target_commitish||'').toLowerCase()!==head)
          throw Error('UI 发布包与 main 提交不一致');
        // Require a real Git fast-forward from the installed UI to the
        // requested HEAD. A force-push or replayed release cannot roll back.
        const comparison=await request(API+'/compare/'+installed+'...'+head);
        if(comparison?.status!=='ahead'||!(comparison.ahead_by>0)){
          status='blocked';return {updated:false,version};
        }
        const asset=release.assets?.find(a=>a.name===ASSET);
        const expected='https://github.com/'+REPO+'/releases/download/'+releaseTag+'/'+ASSET;
        if(!asset||asset.browser_download_url!==expected)
          throw Error('UI 发布包来源不可信');
        const bundle=await request(expected);
        if(String(bundle.version||'').toLowerCase()!==head)
          throw Error('UI 热更新版本与主分支不一致');
        const parts=validateBundle(bundle,'windows');
        fs.mkdirSync(root,{recursive:true});
        fs.rmSync(stage,{recursive:true,force:true});fs.mkdirSync(stage);
        for(const name of FILES)fs.writeFileSync(path.join(stage,name),parts[name]);
        fs.writeFileSync(path.join(stage,'meta.json'),JSON.stringify({
          schema:TYPE,version:head,tag:releaseTag,minShell:3,repository:REPO,
          shellBase:baseCommit
        }));
        verifyCached(stage);
        fs.rmSync(backup,{recursive:true,force:true});
        if(fs.existsSync(active))fs.renameSync(active,backup);
        try{fs.renameSync(stage,active);}
        catch(e){if(fs.existsSync(backup))fs.renameSync(backup,active);throw e;}
        version=head;tag=releaseTag;status='updated';lastError='';
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
