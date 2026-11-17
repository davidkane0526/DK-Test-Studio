#!/usr/bin/env node
'use strict';
/*
 * Build a browser preview from the exact DKDS Core source pinned by DKTS and
 * this DKTS source tree's native plugin. This stages source only; it does not
 * install Electron, compile a Windows executable, or compile an Android APK.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {stage}=require('./stage-dkds-host.cjs');
const ROOT=path.resolve(__dirname,'..');
const PIN='20f056851a61d2144e9524c3ed568628d4b8557c';
const EXPECTED_DKDS_VERSION='3.72.3';
const IGNORE=new Set(['.git','node_modules','dist','compat','.expo','.gradle','.cache','coverage','build','signing-private']);
const IGNORE_PATHS=['android/app/src/main/assets','android/.gradle','android/build','android/app/build','android/signing-private'];
function ignoredRelative(relative){
 const value=String(relative||'').split(path.sep).join('/');
 if(!value)return false;
 const parts=value.split('/');
 if(parts.some(part=>IGNORE.has(part)||part==='.DS_Store'||part.endsWith('.log')||/\.(?:keystore|jks|p12|pfx)$/i.test(part)))return true;
 if(IGNORE_PATHS.some(prefix=>value===prefix||value.startsWith(prefix+'/')))return true;
 return parts.length>=6&&parts.slice(0,5).join('/')==='android/app/src/main/res'&&parts[5].startsWith('mipmap-');
}
function run(script,args,cwd){
 const r=spawnSync(process.execPath,[script,...args],{cwd,encoding:'utf8',stdio:'inherit',env:process.env});
 if(r.error)throw r.error;
 if(r.status!==0)throw Error(`${path.basename(script)} failed with exit ${r.status}`);
}
function treeDigest(folder){
 const hash=crypto.createHash('sha256');
 const visit=dir=>{
  const dirRelative=path.relative(folder,dir);
  if(ignoredRelative(dirRelative))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   const file=path.join(dir,entry.name),rel=path.relative(folder,file).split(path.sep).join('/');
   if(ignoredRelative(rel))continue;
   if(entry.isDirectory())visit(file);
   else if(entry.isFile()){
    hash.update(rel);hash.update('\0');hash.update(fs.readFileSync(file));hash.update('\0');
   }
  }
 };
 visit(folder);return hash.digest('hex');
}
function copyClean(source,target){
 fs.cpSync(source,target,{recursive:true,filter:file=>{
  const rel=path.relative(source,file);if(!rel||rel==='.')return true;
  return !rel.split(path.sep).some(part=>IGNORE.has(part));
 }});
}
function build(upstream,out){
 upstream=path.resolve(upstream);out=path.resolve(out);
 if(!fs.existsSync(path.join(upstream,'package.json')))throw Error('Pinned DKDS source directory is missing package.json');
 const dkdsPkg=JSON.parse(fs.readFileSync(path.join(upstream,'package.json'),'utf8'));
 if(dkdsPkg.name!=='dk-data-studio'||dkdsPkg.version!==EXPECTED_DKDS_VERSION)
  throw Error(`Expected read-only DKDS ${EXPECTED_DKDS_VERSION}, received ${dkdsPkg.name}@${dkdsPkg.version}`);
 const dktsPkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
 const info=fs.readFileSync(path.join(ROOT,'BUILD-INFO.md'),'utf8');
 const buildMatch=/Development identity:\*\* `a([1-9][0-9]*)`/.exec(info);
 if(!buildMatch)throw Error('BUILD-INFO.md must declare a provisional aNNN identity');
 process.env.DKTS_PREVIEW_BUILD_NUMBER=buildMatch[1];
 const stageDir=path.join(ROOT,'dist','.same-source-preview-stage');
 const staged=stage(upstream,stageDir,{dktsRoot:ROOT});
 if(staged.upstream.version!==EXPECTED_DKDS_VERSION||staged.counts.retained<10||staged.counts.excluded<1)
  throw Error('DKDS staging profile did not retain the full non-analysis host');
 // Remove this workspace's absolute filesystem path from the distributable manifest.
 const stageManifestPath=path.join(stageDir,'DKTS_FRAMEWORK_STAGING.json');
 const stageManifest=JSON.parse(fs.readFileSync(stageManifestPath,'utf8'));
 stageManifest.upstream.path='pinned DKDS source archive (read-only)';
 if(stageManifest.updaterSafety)stageManifest.updaterSafety.source='pinned DKDS source archive (read-only)';
 stageManifest.upstream.commit=PIN;
 stageManifest.previewArtifact='DKTS-Core-Same-Source-Preview';
 fs.writeFileSync(stageManifestPath,JSON.stringify(stageManifest,null,2)+'\n');
 // Generate the actual Core frontend and plugin catalog from this staged source.
 const tasks=[
  'scripts/generate-runtime-compositions.js','scripts/validate-styles.js',
  'tools/sdk/generate-unit-template-reference.js','scripts/generate-sdk-authoring-reference.js',
  'scripts/generate-plugin-index.js','scripts/validate-plugins.js',
  'scripts/generate-brand-assets.js','scripts/prepare-build.js'
 ];
 for(const task of tasks)run(task,[],stageDir);
 const manifest=JSON.parse(fs.readFileSync(path.join(stageDir,'src/plugins/dkts-4200a/plugin.json'),'utf8'));
 if(manifest.id!=='com.dkts.keithley-4200'||manifest.version!==JSON.parse(fs.readFileSync(path.join(ROOT,'integrations/dkds-native/plugin.json'),'utf8')).version)
  throw Error('Staged Core does not contain this source tree\'s DKTS native plugin');
 const indexFile=path.join(stageDir,'src/generated/plugin-index.js');
 if(!fs.readFileSync(indexFile,'utf8').includes('com.dkts.keithley-4200'))
  throw Error('Generated DKDS plugin catalog does not contain the DKTS workspace');
 const outParent=path.dirname(out);fs.mkdirSync(outParent,{recursive:true});
 if(fs.existsSync(out))fs.rmSync(out,{recursive:true,force:true});
 fs.mkdirSync(out,{recursive:true});
 const host=path.join(out,'host');copyClean(stageDir,host);
 // Bundle the exact D3 renderer used by DKDS. The preview is self-contained:
 // no npm registry access or first-launch build is needed on the user's PC.
 const d3Package=JSON.parse(fs.readFileSync(path.join(ROOT,'node_modules/d3/package.json'),'utf8'));
 if(d3Package.version!=='7.9.0')throw Error('Same-source preview requires the pinned D3 7.9.0 runtime');
 const vendor=path.join(host,'vendor');fs.mkdirSync(vendor,{recursive:true});
 fs.copyFileSync(path.join(ROOT,'node_modules/d3/dist/d3.min.js'),path.join(vendor,'d3.min.js'));
 const hostPackage=path.join(host,'package.json');
 const hp=JSON.parse(fs.readFileSync(hostPackage,'utf8'));
 // The browser preview uses only static Core assets and the bundled D3 file.
 // No package install is required or advertised by this preview artifact.
 hp.dependencies={};hp.devDependencies={};hp.optionalDependencies={};hp.scripts={};
 fs.writeFileSync(hostPackage,JSON.stringify(hp,null,2)+'\n');
 fs.rmSync(path.join(host,'package-lock.json'),{force:true});
 // In the preview copy only, select the desktop layout breakpoint while the
 // existing web-bridge continues to provide browser-safe file fallbacks.
 const htmlFile=path.join(host,'src/index.html');
 let html=fs.readFileSync(htmlFile,'utf8');
 const from="const host=mobile?'mobile':(window.electronAPI?'desktop':'web');";
 const to="const desktopPreview=query.has('dktsDesktopPreview');\n      const host=mobile?'mobile':(window.electronAPI||desktopPreview?'desktop':'web');";
 if(html.split(from).length!==2)throw Error('Pinned DKDS host detection anchor changed; refusing unsafe preview patch');
 html=html.replace(from,to);
 const d3Source='../node_modules/d3/dist/d3.min.js';
 if(html.split(d3Source).length!==2)throw Error('Pinned DKDS D3 script reference changed; refusing an incomplete offline preview');
 html=html.replace(d3Source,'../vendor/d3.min.js');
 fs.writeFileSync(htmlFile,html,'utf8');
 fs.copyFileSync(path.join(ROOT,'tools/preview-server.cjs'),path.join(out,'preview-server.cjs'));
 const startCmd=`@echo off\r\nsetlocal\r\ncd /d "%~dp0host"\r\nwhere node >nul 2>nul || (echo Node.js 20 or newer is required.& pause & exit /b 1)\r\nnode -e "if(Number(process.versions.node.split('.')[0])<20)process.exit(1)" || (echo Please install Node.js 20 or newer.& pause & exit /b 1)\r\necho Starting the prebuilt DKDS Core same-source preview.\r\necho D3 7.9.0 is bundled; no npm install or build step is required.\r\nnode "%~dp0preview-server.cjs" "%CD%" 4173\r\nexit /b 0\r\n`;
 fs.writeFileSync(path.join(out,'Start-DKTS-Core-Same-Source-Preview.cmd'),startCmd,'utf8');
 const sourceHash=treeDigest(ROOT);
 const previewManifest={schema:'dkts.core.same-source-preview.v1',
  dkts:{version:dktsPkg.version,buildId:staged.buildId,sourceTreeSha256:sourceHash,
   nativePluginId:manifest.id,nativePluginVersion:manifest.version},
  dkds:{repository:'davidkane0526/DK-Data-Studio',commit:PIN,version:EXPECTED_DKDS_VERSION,
   packageJsonSha256:staged.upstream.packageSha256},
  framework:{retainedPlugins:staged.counts.retained,excludedAnalysisPlugins:staged.counts.excluded,
   generatedCoreHtml:true,generatedCoreCss:true,generatedRuntimeBundles:true,
   nativePluginIncluded:true,sourceOnly:true},
  preview:{host:'browser',desktopLayoutFlag:'dktsDesktopPreview=1',serverBind:'127.0.0.1',port:4173,
   d3Version:'7.9.0',d3Bundled:true,npmInstallRequired:false,hardwareOutput:false,electronIpc:false,nativeFileDialogs:false,
   automaticUpdates:false,realInstrumentConnection:false,realKxciMeasurement:false,
   windowsPortableCompiled:false,androidApkCompiled:false}};
 fs.writeFileSync(path.join(out,'PREVIEW-MANIFEST.json'),JSON.stringify(previewManifest,null,2)+'\n');
 fs.writeFileSync(path.join(out,'README.md'),`# DKTS Core Same-Source Preview\n\n**DKTS V${dktsPkg.version} ${staged.buildId} (provisional)**\n\nThis is a browser preview built from the actual DKDS Core source pinned by DKTS and the DKTS native 4200A plugin in this source snapshot. It is not the standalone FS-Pro imitation page.\n\n## Start on Windows\n\n1. Extract this ZIP to a writable folder.\n2. Install Node.js 20 or newer.\n3. Double-click \`Start-DKTS-Core-Same-Source-Preview.cmd\`.\n4. The script starts the prebuilt Core preview and opens the browser at \`http://127.0.0.1:4173\`.\n5. Keep the command window open. Press Ctrl+C to stop the local server.\n\nThe preview bundles the exact D3 7.9.0 runtime and needs no npm install, npm registry access, or first-launch build. It installs no Electron binary and compiles no Windows EXE or Android APK. It serves the generated \`host/src/index.html\`, the same DKDS Core CSS/runtime bundles, and the DKTS plugin catalog from this package. A preview-only bootstrap flag selects the desktop layout; the existing DKDS web bridge supplies browser-safe fallbacks.\n\n## Preview limitations\n\n- Electron IPC, native window chrome, native file dialogs, native update installation and platform-specific integration are not available. Browser file picker/download fallbacks may work where the Core provides them.\n- This preview does not connect to a Keithley 4200A, send KXCI output, execute measurements, acquire instrument raw data, or verify hardware safety.\n- It is a same-source UI preview, not proof of pixel-identical rendering in Electron/Android and not a native package acceptance test.\n\n## Provenance\n\nSee \`PREVIEW-MANIFEST.json\` and \`host/DKTS_FRAMEWORK_STAGING.json\`. DKTS source tree SHA-256: \`${sourceHash}\`. DKDS is read-only: \`${PIN}\`. The generated host retains ${staged.counts.retained} non-analysis plugins and excludes ${staged.counts.excluded} analysis plugins.\n`,'utf8');
 return {out,manifest:previewManifest};
}
if(require.main===module){
 const upstream=process.argv[2],out=process.argv[3]||path.join(ROOT,'dist','DKTS-Core-Same-Source-Preview');
 if(!upstream)throw Error('Usage: node tools/build-same-source-preview.cjs <pinned-DKDS-source> [output-directory]');
 try{const result=build(upstream,out);console.log('DKTS Core same-source preview prepared:',JSON.stringify({out:result.out,dkts:result.manifest.dkts,dkds:result.manifest.dkds,preview:result.manifest.preview},null,2));}
 catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}
module.exports={build,treeDigest};
