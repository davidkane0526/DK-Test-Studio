'use strict';
const fs=require('node:fs');
const {buildIdentity}=require('./core-build-identity.cjs');
const pkg=require('../package.json');
const identity=buildIdentity(process.env.DKTS_BUILD_NUMBER||process.env.DKTS_PREVIEW_BUILD_NUMBER||process.env.GITHUB_RUN_NUMBER);
const output=[
  'build_id='+identity.buildId,
  'build_number='+identity.buildNumber,
  'android_version_code='+identity.versionCode,
  'app_version='+pkg.version
].join('\n')+'\n';
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,output);
process.stdout.write(output);
