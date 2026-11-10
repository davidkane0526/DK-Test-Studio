#!/usr/bin/env node
'use strict';
/* CI launches the REAL DKDS-derived Electron host, verifies renderer catalog,
 * and collects a screenshot. This is a DKTS-only developer preview. */
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
async function main(){
 const staged=path.resolve(process.argv[2]||'dist/dkts-framework-staging');
 const evidence=path.resolve(process.argv[3]||'dist/core-smoke-evidence');
 const binary=process.platform==='win32'?
  path.join(staged,'node_modules/electron/dist/electron.exe'):
  path.join(staged,'node_modules/electron/dist/electron');
 if(!fs.existsSync(binary))throw Error('Electron binary missing: '+binary);
 fs.mkdirSync(evidence,{recursive:true});
 const report=path.join(evidence,'report.json');
 if(fs.existsSync(report))fs.unlinkSync(report);
 const logs=[];
 const app=spawn(binary,['.'],{
  cwd:staged,env:{...process.env,
   DKTS_CORE_BOOT_SMOKE:'1',DKTS_CORE_SMOKE_DIR:evidence},
  windowsHide:false
 });
 for(const channel of ['stdout','stderr'])app[channel].on('data',chunk=>{
  const data=String(chunk);logs.push(data);
  process.stdout.write(data.slice(0,6000));
 });
 let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;app.kill();},125000);
 const code=await new Promise((resolve,reject)=>{
  app.once('error',reject);app.once('exit',resolve);
 });
 clearTimeout(timer);
 if(timedOut)throw Error('Core Electron boot exceeded deadline');
 if(code!==0)throw Error('Core Electron startup failed with exit '+code+
  ', last output: '+logs.join('').slice(-1800));
 if(!fs.existsSync(report))throw Error('App exited but no Core smoke report exists');
 const result=JSON.parse(fs.readFileSync(report,'utf8'));
 if(!result.ok||!result.has4200Workspace||!result.keptDataCenter||
    !result.keptConnectivity||!result.keptTheme||!result.removedAnalysis)
  throw Error('Core runtime rendered an incomplete DKTS plugin catalog');
 const shot=path.join(evidence,'core-host.png');
 if(!fs.existsSync(shot)||fs.statSync(shot).size<4000)
  throw Error('Core host screenshot missing or suspiciously small');
 console.log('Actual Electron boot and screenshot verified:',JSON.stringify(result));
}
main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
