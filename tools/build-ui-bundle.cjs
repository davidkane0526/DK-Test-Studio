#!/usr/bin/env node
'use strict';
/*
 * The resource release intentionally contains HTML/CSS/frontend JS only.
 * Native drivers, TCP backends, and measurement execution cannot be hot-swapped.
 */
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const releaseDir=path.join(root,'dist');
const version=process.env.GITHUB_SHA||process.env.DKTS_UI_VERSION||'local-dev';
if(!/^[a-zA-Z0-9._-]{5,80}$/.test(version))throw Error('Invalid update version');
function packed(bytes){
  return {sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    base64:bytes.toString('base64'),bytes:bytes.length};
}
function versionedHtml(content){
  const token='<meta name="dkts-ui-version" content="bundled">';
  if(!content.includes(token))throw Error('Missing frontend version marker');
  return Buffer.from(content.replace(token,
    '<meta name="dkts-ui-version" content="'+version+'">'),'utf8');
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
  schema:'dkts-ui-v1',version,minShell:3,
  repository:'davidkane0526/DK-Test-Studio',
  // Only the allowlisted frontend resources may be replaced.
  platforms:{windows,android}
};
fs.mkdirSync(releaseDir,{recursive:true});
const outfile=path.join(releaseDir,'DKTS-UI-bundle.json');
fs.writeFileSync(outfile,JSON.stringify(bundle)+'\n','utf8');
process.stdout.write('UI update bundle: '+outfile+' ('+fs.statSync(outfile).size+' bytes)\n');
module.exports={bundle,outfile};
