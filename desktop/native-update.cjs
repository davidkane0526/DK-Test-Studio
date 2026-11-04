'use strict';
/*
 * DK Test Studio portable updater. Only the original GitHub repository's
 * preview portable executable is accepted, with a GitHub API SHA-256 digest.
 * Renderer receives a narrow check/status/install interface, never a URL/path.
 */
const https=require('node:https');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {pipeline}=require('node:stream/promises');
const {Transform}=require('node:stream');
const RELEASES='https://api.github.com/repos/davidkane0526/DK-Test-Studio/releases?per_page=20';
const PREVIEW=/^dkts-preview-\d+$/;
const PORTABLE=/^DK-Test-Studio-Portable-(\d+\.\d+\.\d+)-x64\.exe$/;
const LIMIT=180*1024*1024;
function trusted(url){
  return url.protocol==='https:'&&(
    url.hostname==='api.github.com'||url.hostname==='github.com'||
    url.hostname==='release-assets.githubusercontent.com'||
    url.hostname.endsWith('.githubusercontent.com')
  );
}
function openHttps(urlString,redirects=0){
  return new Promise((resolve,reject)=>{
    let url;
    try{url=new URL(urlString);if(!trusted(url))throw Error('更新来源不可信');}
    catch(e){return reject(e);}
    if(redirects>5)return reject(Error('下载跳转次数过多'));
    const request=https.get(url,{
      headers:{'User-Agent':'DK-Test-Studio-Windows-Updater','Accept':'application/vnd.github+json'},
      timeout:20000
    },response=>{
      if([301,302,303,307,308].includes(response.statusCode)){
        const location=response.headers.location;
        response.resume();
        if(!location)return reject(Error('GitHub 返回无效跳转'));
        let next;try{next=new URL(location,url).toString();}catch(e){return reject(e);}
        return resolve(openHttps(next,redirects+1));
      }
      if(response.statusCode!==200){
        response.resume();
        return reject(Error('GitHub HTTP '+response.statusCode));
      }
      resolve(response);
    });
    request.on('timeout',()=>request.destroy(Error('下载连接超时')));
    request.on('error',reject);
  });
}
async function readJson(url,maximum=2*1024*1024){
  const response=await openHttps(url),parts=[];
  let size=0;
  for await(const part of response){
    size+=part.length;
    if(size>maximum){response.destroy();throw Error('更新清单过大');}
    parts.push(part);
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
function tuple(v){return String(v).split('.').map(Number);}
function newer(a,b){
  const x=tuple(a),y=tuple(b);
  if(x.length!==3||y.length!==3||x.some(n=>!Number.isSafeInteger(n))||y.some(n=>!Number.isSafeInteger(n)))return false;
  return x.some((n,i)=>n>y[i]&&x.slice(0,i).every((value,k)=>value===y[k]));
}
function pickRelease(releases,currentVersion){
  let best=null;
  for(const release of releases){
    if(!PREVIEW.test(String(release.tag_name||''))||release.draft)continue;
    const assets=Array.isArray(release.assets)?release.assets:[];
    const portable=assets.filter(a=>PORTABLE.test(String(a.name||'')));
    for(const asset of portable){
      const match=PORTABLE.exec(asset.name);if(!match||!newer(match[1],currentVersion))continue;
      const expected='https://github.com/davidkane0526/DK-Test-Studio/releases/download/'+release.tag_name+'/';
      if(!String(asset.browser_download_url||'').startsWith(expected))continue;
      if(!/^sha256:[a-f0-9]{64}$/i.test(String(asset.digest||'')))continue;
      if(!Number.isSafeInteger(asset.size)||asset.size<1000000||asset.size>LIMIT)continue;
      if(!best||newer(match[1],best.version)){
        best=Object.freeze({version:match[1],url:asset.browser_download_url,
          digest:asset.digest.slice(7).toLowerCase(),size:asset.size});
      }
    }
  }
  return best;
}
function createPortableUpdater({app,userData,scriptPath,currentVersion,portablePath=process.env.PORTABLE_EXECUTABLE_FILE||''}){
  const enabled=process.platform==='win32'&&app?.isPackaged&&path.isAbsolute(portablePath)&&
    path.extname(portablePath).toLowerCase()==='.exe'&&fs.existsSync(portablePath);
  let state=enabled?'idle':'unsupported',error='',progress=0,candidate=null,file=null,working=false;
  const failureLog=path.join(userData,'native-updates','last-update-error.txt');
  const readInstallFailure=()=>{
    try{return fs.readFileSync(failureLog,'utf8').trim().slice(0,140);}
    catch{return '';}
  };
  const status=()=>({status:state,version:candidate?.version||currentVersion,error,progress,
    installedVersion:currentVersion,installError:readInstallFailure(),
    supported:enabled});
  async function check(){
    if(!enabled)return status();
    if(working)return status();
    working=true;state='checking';error='';
    try{
      const releases=await readJson(RELEASES);
      if(!Array.isArray(releases))throw Error('GitHub 版本清单格式错误');
      const next=pickRelease(releases,currentVersion);
      if(!next){candidate=null;state='current';}
      else {
        candidate=next;
        state=file&&file.version===next.version?'ready':'available';
      }
    }catch(e){state='error';error=String(e.message||e).slice(0,140);}
    finally{working=false;}
    return status();
  }
  async function install(){
    if(!enabled)throw Error('仅支持 Windows 便携版应用内替换');
    if(working)throw Error('正在执行更新，请稍后');
    if(!candidate)throw Error('请先检查应用更新');
    if(!newer(candidate.version,currentVersion))throw Error('更新版本必须高于本地版本');
    working=true;
    let staged;
    try{
      const folder=path.join(userData,'native-updates');
      await fs.promises.mkdir(folder,{recursive:true});
      staged=path.join(folder,'DKTS-portable-'+candidate.version+'.exe');
      const downloadNeeded=file?.version!==candidate.version||
        !fs.existsSync(staged);
      if(downloadNeeded){
        state='downloading';progress=0;error='';
        const temp=staged+'.partial';
        await fs.promises.rm(temp,{force:true});
        const response=await openHttps(candidate.url);
        const hash=crypto.createHash('sha256');let bytes=0;
        const metering=new Transform({transform(chunk,encoding,done){
          bytes+=chunk.length;
          if(bytes>candidate.size||bytes>LIMIT)return done(Error('下载超过预期大小'));
          hash.update(chunk);
          progress=Math.min(99,Math.trunc(bytes*100/candidate.size));
          done(null,chunk);
        }});
        try{
          await pipeline(response,metering,fs.createWriteStream(temp,{flags:'wx'}));
          if(bytes!==candidate.size||hash.digest('hex')!==candidate.digest)
            throw Error('Windows 更新文件的 SHA-256 校验失败');
          await fs.promises.rm(staged,{force:true});
          await fs.promises.rename(temp,staged);
        }catch(e){await fs.promises.rm(temp,{force:true});throw e;}
      }
      file={version:candidate.version};
      progress=100;state='ready';
      if(!fs.existsSync(scriptPath))throw Error('便携更新脚本缺失');
      // Electron packages scripts in app.asar; PowerShell cannot address asar
      // pseudo paths, so write the trusted bundled script to a real local file.
      const preparedScript=path.join(folder,'apply-portable-update.ps1');
      await fs.promises.writeFile(preparedScript,await fs.promises.readFile(scriptPath));
      // A previous failed detached replacement must not masquerade as the
      // result of this attempt. The PowerShell helper owns subsequent errors.
      await fs.promises.rm(failureLog,{force:true});
      const command=spawn('powershell.exe',[
        '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
        '-File',preparedScript,'-Source',staged,'-Target',portablePath,
        '-ParentPid',String(process.pid)
      ],{detached:true,stdio:'ignore',windowsHide:true});
      await new Promise((resolve,reject)=>{
        command.once('error',reject);
        command.once('spawn',resolve);
      });
      command.unref();
      state='restarting';
      setTimeout(()=>app.quit(),350);
      return status();
    }catch(e){state='error';error=String(e.message||e).slice(0,140);return status();}
    finally{working=false;}
  }
  return Object.freeze({check,install,status});
}
module.exports={createPortableUpdater,pickRelease,newer,trusted};
