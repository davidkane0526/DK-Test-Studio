#!/usr/bin/env node
'use strict';
// Actual DKDS host installer normalization, not a mock facade or schema check.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const [hostDir,pkgFile]=process.argv.slice(2);
if(!hostDir||!pkgFile)throw Error('Usage: verify-native-dkds-install <dkds-checkout> <plugin.dkplugin>');
const root=path.resolve(hostDir);
const {normalizePluginPackage}=require(path.join(root,'desktop','plugin-package.js'));
const {normalizeExternalPluginWindow}=require(path.join(root,'desktop','plugin-window-manager.js'));
const raw=JSON.parse(fs.readFileSync(path.resolve(pkgFile),'utf8'));
const pkg=normalizePluginPackage(raw,{allowBuiltinId:false});
assert.equal(pkg.manifest.id,'com.dkts.keithley-4200','external DKTS plugin identity');
assert.equal(pkg.manifest.version,'0.7.3');
assert.equal(pkg.manifest.apiVersion,'1.19.0');
assert.equal(pkg.manifest.pluginType,'workbench');
assert.equal(pkg.manifest.workspace?.role,'top');
assert.equal(pkg.manifest.window?.activity,'dkts-keithley-4200');
assert.ok(!pkg.manifest.id.startsWith('builtin.'),'4200A must not be DKDS built-in');
const win=normalizeExternalPluginWindow(pkg);
assert.equal(win?.packageManifest?.id,pkg.manifest.id);
assert.equal(win?.packageManifest?.version,pkg.manifest.version);
assert.equal(win?.packageManifest?.window?.artifactHydration,'live');
assert.equal(win?.packageManifest?.window?.persistence,'project');
assert.ok(win?.dependencies?.includes('scientific-renderer'),
 'real DKDS TOP window requires Core Scientific Plot dependency');
for(const name of ['model.js','plugin.js']){
 assert.equal(typeof win?.packageFiles?.[name],'string','missing packaged '+name);
 assert.ok(win.packageFiles[name].length>500,'truncated '+name);
}
console.log('DKDS official host package normalizer and dedicated TOP window accept DKTS v0.7.3');
