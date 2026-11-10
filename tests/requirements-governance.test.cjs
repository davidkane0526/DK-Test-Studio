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
test('DKTS active README does not claim finished upstream-host migration',()=>{
 const readme=read('README.md');
 assert.match(readme,/完全基于 DKDS 框架/);
 assert.match(readme,/不能称为已完整基于 DKDS 框架/);
 assert.match(read('docs/ROADMAP.md'),/DKDS 只读框架来源/);
 assert.match(read('docs/UPSTREAM_BRANCH_AUDIT.md'),/远程分支删除尚未执行/);
});
