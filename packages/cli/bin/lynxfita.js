#!/usr/bin/env node
import { runCli } from '../dist/index.js';

runCli(process.argv)
  .then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  })
  .catch((err) => {
    console.error('[LynxFita CLI Error]:', err);
    process.exit(1);
  });
