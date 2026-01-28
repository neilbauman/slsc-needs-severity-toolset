#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const dirs = [
  '.next/cache/webpack/client-production',
  '.next/cache/webpack/server-production',
  '.next/cache/webpack/client-development',
  '.next/cache/webpack/server-development',
];
const root = path.resolve(__dirname, '..');
dirs.forEach((d) => {
  const full = path.join(root, d);
  try {
    fs.mkdirSync(full, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
});
