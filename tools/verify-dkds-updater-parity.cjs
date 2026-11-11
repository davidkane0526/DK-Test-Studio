#!/usr/bin/env node
'use strict';
/**
 * Verifies updater safety invariants in the genuine pinned DKDS source before
 * deriving a DKTS Core host. This is an upstream integrity contract, NOT
 * evidence that DKTS production release/asset compatibility is complete.
 */
const fs=require('node:fs'),path=require('node:path');
function verifyUpdaterParity(source){
 const root=path.resolve(source);
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const data={
  windows:read('desktop/native-update.js'),
  windowsInstall:read('desktop/apply-portable-update.ps1'),
  windowsUi:read('desktop/ui-hot-update.js'),
  android:read('mobile/plugins/DkdsAppUpdate.template'),
  androidUi:read('mobile/plugins/DkdsUiHotUpdate.template')
 };
 const rules={
  winDownloadSha:/hash\.digest\('hex'\)\s*!==\s*candidate\.digest/.test(data.windows),
  winCachedSha:/verifiedHash\.digest\('hex'\)\s*!==\s*candidate\.digest/.test(data.windows),
  winCachedSize:/verifiedSize\s*!==\s*candidate\.size/.test(data.windows),
  winInstallRollback:/Move-Item[^\n]*\$backup[^\n]*\$Target/.test(data.windowsInstall),
  winUiSha:/SHA-256|sha256/.test(data.windowsUi)&&/digest\('hex'\)/.test(data.windowsUi),
  winUiPrevious:/previous\.json/.test(data.windowsUi)&&/loadCached\(backup\)/.test(data.windowsUi),
  androidCachedSha:/verifyDownloaded\(apk,selected\)/.test(data.android),
  androidSigner:/validateApk\(apk,selected\.version\)/.test(data.android),
  androidUiSha:/MessageDigest\.getInstance\("SHA-256"\)/.test(data.androidUi),
  androidUiPrevious:/previous\.json/.test(data.androidUi)&&/readBundle\(backup\)/.test(data.androidUi),
 };
 const missing=Object.entries(rules).filter(([,valid])=>!valid).map(([name])=>name);
 if(missing.length)throw Error('Pinned DKDS Core lacks required updater safety contracts: '+missing.join(', '));
 return Object.freeze({source:root,verified:rules,verifiedCount:Object.keys(rules).length,
  caveat:'Staging safety only; production DKTS Core updater release identity, Android signing, and end-to-end rollback remain unverified'});
}
if(require.main===module){
 if(!process.argv[2])throw Error('Usage: verify-dkds-updater-parity.cjs <read-only-DKDS-source>');
 console.log(JSON.stringify(verifyUpdaterParity(process.argv[2]),null,2));
}
module.exports={verifyUpdaterParity};
