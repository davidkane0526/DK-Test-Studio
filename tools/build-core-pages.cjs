#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function publishCorePreview(preview, siteRoot, commit) {
  if (!/^[a-f0-9]{40}$/.test(commit || '')) {
    throw new Error('A full DKTS source commit SHA is required');
  }

  const host = path.join(preview, 'host');
  const manifest = JSON.parse(fs.readFileSync(path.join(preview, 'PREVIEW-MANIFEST.json'), 'utf8'));
  if (manifest.schema !== 'dkts.core.same-source-preview.v1' ||
      manifest.preview?.hardwareOutput !== false ||
      manifest.preview?.realInstrumentConnection !== false) {
    throw new Error('Expected an offline same-source Core preview');
  }

  const absoluteSite = path.resolve(siteRoot);
  if (!fs.statSync(path.join(absoluteSite, 'index.html')).isFile()) {
    throw new Error('Build the legacy demo before adding the Core preview');
  }
  const output = path.join(absoluteSite, 'core');
  fs.mkdirSync(output);

  function copyBrowserAssets(relative) {
    const target = path.join(output, relative);
    fs.mkdirSync(target);
    for (const entry of fs.readdirSync(path.join(host, relative), {withFileTypes: true})) {
      const file = path.posix.join(relative, entry.name);
      if (entry.isDirectory() && relative !== 'sdk' && !/^(?:tests?|fixtures)$/i.test(entry.name)) {
        copyBrowserAssets(file);
      } else if (entry.isFile() &&
          (file === 'src/index.html' ||
           (relative === 'sdk' ? /\.js$/i : /\.(?:js|css|json|svg|png|jpe?g|webp|ico|woff2?|ttf|wasm)$/i).test(entry.name))) {
        fs.copyFileSync(path.join(host, file), path.join(output, file));
      }
    }
  }
  for (const directory of ['src', 'assets', 'vendor', 'sdk']) copyBrowserAssets(directory);

  for (const file of [
    'src/index.html', 'vendor/d3.min.js', 'src/generated/plugin-index.js',
    'src/plugins/dkts-4200a/plugin.js'
  ]) {
    if (!fs.existsSync(path.join(output, file))) throw new Error('Missing preview asset: ' + file);
  }

  const entry = 'src/index.html';
  fs.writeFileSync(path.join(output, 'index.html'), [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<meta charset="utf-8">',
    '<title>DK Test Studio Core 网页预览</title>',
    '<meta http-equiv="refresh" content="0; url=' + entry + '">',
    '<a href="' + entry + '">打开 DK Test Studio Core 网页预览</a>',
    '</html>',
    ''
  ].join('\n'));
  const provenance = {
    sourceCommit: commit,
    dkts: manifest.dkts,
    dkds: manifest.dkds,
    hardwareOutput: false
  };
  fs.writeFileSync(path.join(output, 'preview.json'), JSON.stringify(provenance, null, 2) + '\n');
  console.log('Prepared GitHub Pages Core preview for ' + commit);
}

if (require.main === module) {
  const [preview, site, commit] = process.argv.slice(2);
  if (!preview || !site) throw new Error('Usage: build-core-pages.cjs <Core preview> <Pages site> <commit SHA>');
  publishCorePreview(preview, site, commit);
}
