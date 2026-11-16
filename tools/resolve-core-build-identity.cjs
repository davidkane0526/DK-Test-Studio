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
const summary=`## DK Test Studio build identity\n\n- Package version: **V${pkg.version}**\n- Development/update identity: **${identity.buildId}**\n- Combined identity: **V${pkg.version} ${identity.buildId}**\n- Android versionCode: **${identity.versionCode}**\n`;
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
process.stdout.write(output+summary);
