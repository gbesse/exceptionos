// Purpose: Write fictional CLI input documents without overwriting any existing file.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalog, order } from './fixtures.mjs';
const destination = resolve(process.argv[2] ?? 'local-data');
await mkdir(destination, { recursive: true });
const fixtures = { 'catalog.json': catalog, 'case.json': order, 'resolution.json': { sku: 'PAPER-A4-500', actor: 'demo-reviewer', note: 'Synthetic reference confirmed against the example catalog.', expectedRevision: 0 } };
for (const [name, value] of Object.entries(fixtures)) await writeFile(resolve(destination, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(`Fictional fixtures written to ${destination}`);
