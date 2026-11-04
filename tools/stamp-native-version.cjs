#!/usr/bin/env node
'use strict';
// Produce matching immutable native versions for all platforms in one Actions run.
// A rerun of the same workflow retains its version; later runs increase it.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const platform=process.argv[2];
if(!['windows','android'].includes(platform))throw Error('Expected windows or android');
const run=Number(process.env.GITHUB_RUN_NUMBER||'');
if(!Number.isSafeInteger(run)||run<1||run>1000000)throw Error('Valid GITHUB_RUN_NUMBER is required');
const packPath=path.join(root,'package.json');
const pack=JSON.parse(fs.readFileSync(packPath,'utf8'));
const match=/^(\d+)\.(\d+)\.(\d+)$/.exec(pack.version);
if(!match)throw Error('Invalid baseline version');
const version=match[1]+'.'+match[2]+'.'+(1000+run);
const code=100000+run;
if(platform==='windows'){
  pack.version=version;
  fs.writeFileSync(packPath,JSON.stringify(pack,null,2)+'\n');
}else{
  const gradlePath=path.join(root,'android/app/build.gradle');
  let gradle=fs.readFileSync(gradlePath,'utf8');
  if(!/versionCode \d+/.test(gradle)||!/versionName '\d+\.\d+\.\d+'/.test(gradle))
    throw Error('Android version placeholders missing');
  gradle=gradle.replace(/versionCode \d+/, 'versionCode '+code)
    .replace(/versionName '\d+\.\d+\.\d+'/, "versionName '"+version+"'");
  fs.writeFileSync(gradlePath,gradle);
}
const htmlPath=path.join(root,'web/index.html');
let html=fs.readFileSync(htmlPath,'utf8');
if(!/id="native-version-badge"[^>]*>v\d+\.\d+\.\d+<\/button>/.test(html))
  throw Error('Native version badge missing');
html=html.replace(/(id="native-version-badge"[^>]*>)v\d+\.\d+\.\d+(<\/button>)/,
  '$1v'+version+'$2');
fs.writeFileSync(htmlPath,html);
console.log(platform+' native version '+version+' (Android versionCode '+code+')');
