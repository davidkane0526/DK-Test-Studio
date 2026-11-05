'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {bundle,uiReleaseVersion}=require('../tools/build-ui-bundle.cjs');
const {validateBundle,createUiUpdater}=require('../src/ui-update.cjs');
const VERSION='123456789abcdef123456789abcdef123456789a';
function prepare(platform){
  const value=JSON.parse(JSON.stringify(bundle));
  value.version=VERSION;return value;
}
test('manifest includes platform-specific entry HTML and identical CSS/JS',()=>{
  const b=prepare();
  assert.equal(b.minShell,4,'safe update ancestry checks require the v0.3.7 native shell');
  assert.throws(()=>validateBundle({...b,minShell:3},'windows'),/Unsupported/);
  assert.deepEqual(Object.keys(b.platforms).sort(),['android','windows']);
  assert.match(b.uiVersion,/^a\d+$/);
  assert.match(b.packageVersion,/^\d+\.\d+\.\d+$/);
  assert.equal(uiReleaseVersion,b.uiVersion);
  const win=validateBundle(b,'windows'),android=validateBundle(b,'android');
  assert.notDeepEqual(win['index.html'],android['index.html']);
  assert.deepEqual(win['app.js'],android['app.js']);
  assert.deepEqual(win['styles.css'],android['styles.css']);
  assert.match(android['index.html'].toString(),/native-client.js/);
  assert.throws(()=>validateBundle({...b,repository:'unexpected'},'windows'),/Unsupported/);
  const corrupted=prepare();
  corrupted.platforms.windows['app.js'].sha256='0'.repeat(64);
  assert.throws(()=>validateBundle(corrupted,'windows'),/checksum/);
});

const BASE='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OLD='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
function releaseAt(commit,{published='2026-11-03T07:07:23Z'}={}){
  return {tag_name:'dkts-ui-'+commit,target_commitish:commit,published_at:published,
    assets:[{name:'DKTS-UI-bundle.json',browser_download_url:
      'https://github.com/davidkane0526/DK-Test-Studio/releases/download/dkts-ui-'+commit+'/DKTS-UI-bundle.json'}]};
}
function stubGitHub({head=VERSION,release=releaseAt(VERSION),status='ahead',bundleData=prepare()}={}){
  const requests=[];
  const fetchImpl=async url=>{
    requests.push(url);
    if(url.endsWith('/branches/main'))
      return {ok:true,json:async()=>({commit:{sha:head}})};
    if(url.includes('/compare/'))
      return {ok:true,json:async()=>({status,ahead_by:status==='ahead'?1:0})};
    if(url.includes('/releases/tags/')){
      if(release&&url.endsWith('/releases/tags/'+release.tag_name))
        return {ok:true,json:async()=>release};
      return {ok:false,status:404};
    }
    if(url.includes('/releases/download/'))
      return {ok:true,json:async()=>bundleData};
    throw Error('Unexpected GitHub API request '+url);
  };
  return {fetchImpl,requests};
}
test('main HEAD hot-update replaces cached files, then preserves verified cache across restart',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dkts-ui-'));
  const b=prepare(),github=stubGitHub();
  const updater=createUiUpdater({cacheDir:dir,baseCommit:BASE,fetchImpl:github.fetchImpl});
  try{
    assert.equal(updater.state().version,'bundled');
    assert.match(updater.state().uiVersion,/^a\d+$/);
    const updated=await updater.updateOnce();
    assert.equal(updated.updated,true);
    assert.equal(updated.version,VERSION);
    assert.equal(updated.uiVersion,b.uiVersion);
    assert.equal(updater.state().packageVersion,b.packageVersion);
    assert.deepEqual(updater.getAsset('styles.css'),Buffer.from(b.platforms.windows['styles.css'].base64,'base64'));
    assert.equal((await updater.updateOnce()).updated,false);
    assert.equal(updater.state().tag,'dkts-ui-'+VERSION);
    assert(github.requests.some(url=>url.includes('/compare/'+BASE+'...'+VERSION)));
    assert(github.requests.every(url=>!url.includes('/releases?')));
    const reread=createUiUpdater({cacheDir:dir,baseCommit:BASE,fetchImpl:github.fetchImpl});
    assert.equal(reread.state().version,VERSION);
    assert.equal(reread.state().uiVersion,b.uiVersion);
    assert.equal(reread.state().packageVersion,b.packageVersion);
    assert.equal(reread.getAsset('../internal.js'),null);
    const newerNative=createUiUpdater({cacheDir:dir,baseCommit:VERSION,fetchImpl:github.fetchImpl});
    assert.equal(newerNative.state().version,'bundled',
      'new native shell must not load old shell cache without fresh validation');
    assert.equal(newerNative.getAsset('styles.css'),null);
  }finally{updater.stop();fs.rmSync(dir,{recursive:true,force:true});}
});

test('old Release published later cannot displace the exact main HEAD UI tag',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dkts-ui-order-'));
  const github=stubGitHub({head:VERSION,release:releaseAt(VERSION,{published:'2026-11-01T00:00:00Z'})});
  const oldRelease=releaseAt(OLD,{published:'2026-12-31T23:59:59Z'});
  const updater=createUiUpdater({cacheDir:dir,baseCommit:BASE,fetchImpl:async url=>{
    if(url.includes('/releases/tags/dkts-ui-'+OLD))throw Error('Selected replayed old release');
    return github.fetchImpl(url);
  }});
  try{
    assert(oldRelease.published_at>'2026-11-01T00:00:00Z');
    assert.equal((await updater.updateOnce()).updated,true);
    assert.equal(updater.state().version,VERSION);
    assert(github.requests.some(url=>url.endsWith('/releases/tags/dkts-ui-'+VERSION)));
    assert(!github.requests.some(url=>url.endsWith('/releases/tags/dkts-ui-'+OLD)));
  }finally{updater.stop();fs.rmSync(dir,{recursive:true,force:true});}
});

test('missing HEAD bundle waits for publication without falling back to old releases',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dkts-ui-wait-'));
  const github=stubGitHub({release:null});
  const updater=createUiUpdater({cacheDir:dir,baseCommit:BASE,fetchImpl:github.fetchImpl});
  try{
    assert.equal((await updater.updateOnce()).updated,false);
    assert.equal(updater.state().status,'pending');
    assert.equal(updater.state().version,'bundled');
    assert.equal(github.requests.length,2);
  }finally{updater.stop();fs.rmSync(dir,{recursive:true,force:true});}
});

test('replayed or force-reset Git HEAD is rejected by the fast-forward check',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dkts-ui-regression-'));
  const github=stubGitHub({status:'behind'});
  const updater=createUiUpdater({cacheDir:dir,baseCommit:BASE,fetchImpl:github.fetchImpl});
  try{
    assert.equal((await updater.updateOnce()).updated,false);
    assert.equal(updater.state().version,'bundled');
    assert.equal(updater.state().status,'blocked');
    assert.equal(github.requests.length,3);
  }finally{updater.stop();fs.rmSync(dir,{recursive:true,force:true});}
});

test('bundled shell at HEAD needs no hot-update download',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dkts-ui-current-'));
  const github=stubGitHub();
  const updater=createUiUpdater({cacheDir:dir,baseCommit:VERSION,fetchImpl:github.fetchImpl});
  try{
    assert.equal((await updater.updateOnce()).updated,false);
    assert.equal(github.requests.length,1);
    assert.equal(updater.state().status,'current');
  }finally{updater.stop();fs.rmSync(dir,{recursive:true,force:true});}
});

test('Android updater verifies branch commit, ancestry, cache floor and rejects published-at ordering',()=>{
  const android=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/UiUpdateManager.java'),'utf8');
  assert.match(android,/API\+"\/branches\/main"/);
  assert.match(android,/API\+"\/releases\/tags\/"\+tag/);
  assert.match(android,/API\+"\/compare\/"\+installed\+"\.\.\."\+head/);
  assert.match(android,/head\.equalsIgnoreCase\(selected\.optString\("target_commitish"\)\)/);
  assert.match(android,/bundledCommit\.equals\(meta\.optString\("shellBase"\)\)/);
  assert.doesNotMatch(android,/newestPublished|published_at|listReleases\(/);
  const windows=fs.readFileSync(path.join(root,'src/ui-update.cjs'),'utf8');
  assert.doesNotMatch(windows,/sort\(\(a,b\).*published_at|releases\?per_page/);
});

test('both update platforms display the exact hot-updated commit in the UI metadata',()=>{
  for(const platform of ['windows','android']){
    const page=Buffer.from(bundle.platforms[platform]['index.html'].base64,'base64').toString('utf8');
    assert.match(page,new RegExp('<meta name="dkts-ui-version" content="'+bundle.version+'">'));
    assert.match(page,new RegExp('<meta name="dkts-ui-release" content="'+uiReleaseVersion+'">'));
    assert.match(uiReleaseVersion,/^a\d+$/);
    assert.match(page,/id="ui-version-badge"/);
    assert(!page.includes('name="dkts-ui-version" content="bundled"') || bundle.version==='bundled');
  }
  const frontend=fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8');
  assert.match(frontend,/function displayUiVersion\(\)/);
  assert.match(frontend,/meta\[name="dkts-ui-release"\]/);
  assert.match(frontend,/nativePackageVersion/);
  assert.doesNotMatch(frontend,/可选完整升级|checkNativeAppUpdate/);
  assert.match(frontend,/hasHotfix/);
  assert.match(frontend,/nativeBadge\.textContent='V'\+nativePackageVersion/);
  assert.match(frontend,/textContent=hasHotfix\?hotfix/);
});
