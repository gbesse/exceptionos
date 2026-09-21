#!/usr/bin/env node
// Purpose: Operate immutable exception-desk snapshots and export reviewed ERP proposals.
import { readFile, writeFile } from 'node:fs/promises';
import { createDesk, openCase, resolveCase, suggest, prepareERPChange, revokePrecedent } from '../src/index.mjs';
const read = async path => JSON.parse(await readFile(path, 'utf8'));
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help') { console.log('exceptionos init CATALOG.json OUTPUT.json\nexceptionos open DESK.json CASE.json ACTOR OUTPUT.json\nexceptionos suggest DESK.json CASE_ID\nexceptionos resolve DESK.json CASE_ID RESOLUTION.json OUTPUT.json\nexceptionos revoke DESK.json PRECEDENT_ID REVIEW.json OUTPUT.json\nexceptionos prepare DESK.json CASE_ID\nexceptionos jev DESK.json CASE_ID\nOutput snapshots never overwrite an existing file.'); return; }
  const counts = { init: 2, open: 4, suggest: 2, resolve: 4, revoke: 4, prepare: 2, jev: 2 };
  if (!Object.hasOwn(counts, command) || args.length !== counts[command]) throw new Error('Invalid arguments; use --help');
  let result, output;
  if (command === 'init') { result = createDesk(await read(args[0])); output = args[1]; }
  else {
    const desk = await read(args[0]);
    if (command === 'open') { result = openCase(desk, await read(args[1]), args[2]); output = args[3]; }
    if (command === 'resolve') { result = resolveCase(desk, args[1], await read(args[2])); output = args[3]; }
    if (command === 'revoke') { result = revokePrecedent(desk, args[1], await read(args[2])); output = args[3]; }
    if (command === 'suggest') result = suggest(desk, args[1]);
    if (command === 'prepare') result = prepareERPChange(desk, args[1]);
    if (command === 'jev') { const { proposeWithJev } = await import('../src/jev.mjs'); result = await proposeWithJev(desk, args[1]); }
  }
  if (output) await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  else console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(`exceptionos: ${error.message}`); process.exitCode = 1; });
