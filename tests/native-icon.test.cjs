'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('one branded native icon is generated for taskbar, task manager, installer and Android launcher',()=>{
  execFileSync(process.execPath,['tools/generate-app-icons.cjs'],{cwd:root,stdio:'pipe'});
  const ico=fs.readFileSync(path.join(root,'build/icon.ico'));
  assert.equal(ico.readUInt16LE(0),0);
  assert.equal(ico.readUInt16LE(2),1);
  assert(ico.readUInt16LE(4)>=7,'icon must have at least 7 resolutions');
  const iconSize=ico.readUInt32LE(6+8);
  const iconOffset=ico.readUInt32LE(6+12);
  assert(iconSize>1000);
  assert.equal(ico.subarray(iconOffset,iconOffset+8).toString('hex'),'89504e470d0a1a0a');
  for(const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]){
    const f=path.join(root,'android/app/src/main/res/mipmap-'+density+'/ic_launcher.png');
    const image=fs.readFileSync(f);
    assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(image.readUInt32BE(16),size);
    assert.equal(image.readUInt32BE(20),size);
  }
  const pkg=require('../package.json');
  assert.equal(pkg.build.win.icon,'build/icon.ico');
  assert.equal(pkg.build.win.executableName,'DK Test Studio');
  assert(pkg.build.files.includes('build/icon.ico'));
  const main=fs.readFileSync(path.join(root,'desktop/main.cjs'),'utf8');
  assert.match(main,/app\.setAppUserModelId\('studio\.dk\.test'\)/);
  assert.match(main,/build\/icon\.ico/);
  const manifest=fs.readFileSync(path.join(root,'android/app/src/main/AndroidManifest.xml'),'utf8');
  assert.match(manifest,/android:icon="@mipmap\/ic_launcher"/);
  assert.match(manifest,/android:roundIcon="@mipmap\/ic_launcher_round"/);
});
