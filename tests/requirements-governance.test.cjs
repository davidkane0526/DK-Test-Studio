'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('the latest user instructions override prior DKDS-side 4200A development plans',()=>{
 const a=read('AGENTS.md'),req=read('docs/USER_REQUIREMENTS.md');
 assert.match(a,/Do NOT write any DKDS source/);
 assert.match(a,/Every non-continue user instruction/);
 assert(req.includes('R-20261110-001'));
 for(const phrase of ['除非我要求','通信、热更新和本地全量更新',
  '完全基于DKDS框架','保留除了分析外的全部插件',
  '所有的要求除了 继续'])assert(req.includes(phrase),phrase);
 assert.match(read('docs/DEVELOPMENT_LOG.md'),/DKDS.*PR.*16/);
});
test('DKTS README records the single stable Core identity and leaves physical acceptance explicit',()=>{
 const readme=read('README.md');
 const req=read('docs/USER_REQUIREMENTS.md');
 assert.match(readme,/完全基于 DKDS 框架/);
 assert.match(readme,/PR #18/);
 assert.match(readme,/真实 4200A 验收/);
 assert.match(readme,/单一 DKTS 原生应用身份/);
 assert.ok(readme.includes('Android 包名为 `studio.dk.test`'));
 assert.match(readme,/真实设备安装.*仍待/);
 assert.match(req,/R-20261111-007/);
 assert.match(req,/直接合并 PR #18到main/);
 assert.match(read('docs/ROADMAP.md'),/DKDS 只读框架来源/);
 assert.match(read('docs/UPSTREAM_BRANCH_AUDIT.md'),/远程分支删除尚未执行/);
});
