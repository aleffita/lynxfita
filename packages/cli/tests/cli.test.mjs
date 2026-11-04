import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const cliPath = resolve('bin/lynxfita.js');

test('LynxFita CLI - displays help', () => {
  const output = execSync(`node "${cliPath}" help`, { encoding: 'utf-8' });
  assert.match(output, /LynxFita CLI/);
  assert.match(output, /lynxfita init/);
});

test('LynxFita CLI - check command', () => {
  const output = execSync(`node "${cliPath}" check`, { encoding: 'utf-8' });
  assert.match(output, /Subsystem check: OK/);
});
