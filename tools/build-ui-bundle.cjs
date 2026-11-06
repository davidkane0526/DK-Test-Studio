#!/usr/bin/env node
'use strict';
/*
 * Each development commit carries two identities: immutable package Vx.x.x
 * and hot-update aNNNN. This bundle advances only the latter; native drivers,
 * TCP backends, and measurement execution cannot be hot-swapped.
 */
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
require('./build-ui-system.cjs').buildUiSystem();
const releaseDir=path.join(root,'dist');
const version=process.env.DKTS_BUILD_SHA||process.env.GITHUB_SHA||'local-dev';
const packageVersion=require('../package.json').version;
const uiReleaseVersion=process.env.DKTS_UI_VERSION||'a0';
if(!/^[a-zA-Z0-9._-]{5,80}$/.test(version))throw Error('Invalid update commit version');
if(!/^\d+\.\d+\.\d+$/.test(packageVersion))throw Error('Invalid full package semver');
if(!/^a\d+$/.test(uiReleaseVersion))throw Error('Invalid UI hot-update ID');
function packed(bytes){
  return {sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    base64:bytes.toString('base64'),bytes:bytes.length};
}
function versionedHtml(content){
  const commitToken='<meta name="dkts-ui-version" content="bundled">';
  const releaseToken='<meta name="dkts-ui-release" content="bundled">';
  if(!content.includes(commitToken)||!content.includes(releaseToken))
    throw Error('Missing frontend commit or semantic version marker');
  const stamped=content
    .replace(commitToken,'<meta name="dkts-ui-version" content="'+version+'">')
    .replace(releaseToken,'<meta name="dkts-ui-release" content="'+uiReleaseVersion+'">');
  const buttonStart=stamped.indexOf('<button type="button" id="native-version-badge"');
  const buttonEnd=stamped.indexOf('</button>',buttonStart);
  const textStart=stamped.indexOf('>',buttonStart)+1;
  if(buttonStart<0||buttonEnd<textStart||
    !/^V?\d+\.\d+\.\d+$/.test(stamped.slice(textStart,buttonEnd)))
    throw Error('Missing package-version button');
  return Buffer.from(stamped.slice(0,textStart)+'V'+packageVersion+
    stamped.slice(buttonEnd),'utf8');
}
function resource(filename,source){
  const bytes=fs.readFileSync(path.join(root,source));
  return packed(filename==='index.html'?versionedHtml(bytes.toString('utf8')):bytes);
}
// Produce Android HTML in memory, avoiding parallel-test and generated-file races.
const {makeAndroidHtml}=require('./sync-android-assets.cjs');
const files=['index.html','app.js','styles.css'];
const windows=Object.fromEntries(files.map(f=>[f,resource(f,'web/'+f)]));
const android=Object.fromEntries(files.map(f=>{
  if(f!=='index.html')return [f,resource(f,'web/'+f)];
  const bytes=versionedHtml(makeAndroidHtml());
  return [f,packed(bytes)];
}));
const bundle={
  schema:'dkts-ui-v1',version,uiVersion:uiReleaseVersion,packageVersion,minShell:4,
  repository:'davidkane0526/DK-Test-Studio',
  // Only the allowlisted frontend resources may be replaced.
  platforms:{windows,android}
};
fs.mkdirSync(releaseDir,{recursive:true});
const outfile=path.join(releaseDir,'DKTS-UI-bundle.json');
fs.writeFileSync(outfile,JSON.stringify(bundle)+'\n','utf8');
process.stdout.write('DKTS V'+packageVersion+' '+uiReleaseVersion+' UI bundle: '+outfile+' ('+fs.statSync(outfile).size+' bytes)\n');
module.exports={bundle,outfile,uiReleaseVersion};
