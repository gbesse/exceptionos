// Purpose: Exercise the installed-style CLI workflow, invalid commands and non-overwriting output files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const bin = join(root, 'bin/exceptionos.mjs');
const env = { ...process.env, MANDATE_SIGNING_KEY: 'fictional-cli-test-secret-at-least-32-bytes' };
delete env.TYPESAFE_API_KEY;
function run(...args) { return execFileSync(process.execPath, [bin, ...args], { cwd: root, env, timeout: 10_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function fixtures(t) {
  const dir = mkdtempSync(join(tmpdir(), 'exceptionos-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  execFileSync(process.execPath, [join(root, 'examples/write-fixtures.mjs'), dir], { env, timeout: 10_000, stdio: 'pipe' });
  return name => join(dir, name);
}
const read = path => JSON.parse(readFileSync(path, 'utf8'));
test('help works and unknown commands fail visibly', () => {
  assert.match(run('--help'), /exceptionos/);
  assert.throws(() => run('unknown'), error => error.status === 1 && error.stderr.includes('Invalid'));
});
test('CLI resolves an exception, exports a proposal and refuses to overwrite a snapshot', t => {
  const f = fixtures(t);
  run('init', f('catalog.json'), f('desk0.json'));
  run('open', f('desk0.json'), f('case.json'), 'demo-operator', f('desk1.json'));
  assert.equal(JSON.parse(run('suggest', f('desk1.json'), 'order-1-line-1')).status, 'needs_review');
  run('resolve', f('desk1.json'), 'order-1-line-1', f('resolution.json'), f('desk2.json'));
  const proposal = JSON.parse(run('prepare', f('desk2.json'), 'order-1-line-1'));
  assert.equal(proposal.toSku, 'PAPER-A4-500'); assert.equal(proposal.execution, 'not_executed');
  assert.throws(() => run('init', f('catalog.json'), f('desk0.json')), error => error.stderr.includes('EEXIST'));
  assert.equal(read(f('desk0.json')).cases.length, 0);
});
