'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const get = p => fs.readFileSync(path.join(root, '.github/workflows', p), 'utf8');
const triggers = p => get(p).split(/\npermissions:/, 1)[0];

test('unified Windows and Android release is gated by an explicit final main commit', () => {
  const content = get('dkts-framework-contract.yml');
  assert.match(content, /branches: \[main\]/);
  assert.match(content, /contains\(github\.event\.head_commit\.message, '\[DKTS-FINAL-BUILD\]'\)/);
  assert.match(content, /github\.event_name == 'push'/);
  assert.match(content, /npx electron-builder --win portable/);
  assert.match(content, /app-core-fixed-signed\.apk/);
  assert.match(content, /publish-core-preview:/);
  assert.doesNotMatch(triggers('dkts-framework-contract.yml'), /\bpull_request:|\bworkflow_dispatch:/);
  const publisher = content.slice(content.indexOf('  publish-core-preview:'));
  assert.match(publisher, /github\.event_name == 'push'/);
  assert.match(publisher, /github\.ref == 'refs\/heads\/main'/);
});

test('parallel native and frontend build workflows cannot run automatically on main push', () => {
  const manual = [
    'ci.yml', 'dkds-native-core-plugin.yml', 'dkts-core-host-preview-contract.yml',
    'web-ui-demo.yml', 'android-dkds-smoke.yml', 'fspro-web-visual-pr.yml',
    'pr-native-previews.yml'
  ];
  for (const name of manual) {
    const on = triggers(name);
    assert.match(on, /\bworkflow_dispatch:/, `${name}: manual diagnostics remain available`);
    assert.doesNotMatch(on, /\bpush:/, `${name}: no push builds`);
    assert.doesNotMatch(on, /\bpull_request:/, `${name}: no PR builds`);
  }
});

test('source archiving, build identity, branch policy and the static Pages preview run on main', () => {
  for (const name of ['ui-update.yml', 'source-zip.yml', 'main-only-branch-policy.yml', 'core-pages.yml']) {
    assert.match(triggers(name), /\bpush:\s*\n\s+branches: \[main\]/);
  }
  assert.doesNotMatch(get('ui-update.yml'), /electron-builder|gradlew|assembleRelease|gh release create/);
  assert.doesNotMatch(get('source-zip.yml'), /electron-builder|gradlew|assembleRelease|gh release create/);
  const pages = get('core-pages.yml');
  assert.match(pages, /build-same-source-preview\.cjs/);
  assert.match(pages, /actions\/deploy-pages@v4/);
  assert.doesNotMatch(pages, /electron-builder|gradlew|assembleRelease|gh release create/);
  assert.doesNotMatch(get('web-ui-demo.yml'), /deploy-pages|upload-pages-artifact/);
  assert.match(fs.readFileSync(path.join(root, 'docs/USER_REQUIREMENTS.md'), 'utf8'), /R-20261118-005/);
});
