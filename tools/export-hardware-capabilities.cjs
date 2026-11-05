#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(root, 'dist', 'DKTS-4200A-Hardware-Capability-Database-v1.json'));
const database = require('../src/shared/hardware-capabilities.js').exportDatabase();
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(database, null, 2) + '\n', 'utf8');
console.log('Exported ' + database.schema + ' to ' + output);
