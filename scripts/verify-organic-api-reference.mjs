import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOrganicAPI } from '../src/organic-api.js';
import { MODEL_SCHEMA_VERSION, ORGANIC_API_VERSION, ORGANIC_API_REFERENCE } from '../src/api-schema.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = createOrganicAPI();
const doc = await readFile(path.join(root, 'docs', 'ORGANIK-API-REFERANSI.md'), 'utf8');
const usageDoc = await readFile(path.join(root, 'docs', 'AI-KULLANIM.md'), 'utf8');
if (api.apiVersion !== ORGANIC_API_VERSION) throw new Error('API runtime version differs from schema version.');
for (const item of ORGANIC_API_REFERENCE) {
  if (typeof api[item.name] !== 'function') throw new Error(`Schema command missing at runtime: ${item.name}`);
  if (!doc.includes(`\`${item.name}(`)) throw new Error(`Generated reference missing command: ${item.name}`);
}
if (!doc.includes(`API sürümü: **${ORGANIC_API_VERSION}**`) || !doc.includes(`sözleşmesi: **${MODEL_SCHEMA_VERSION}**`)) throw new Error('Reference version metadata is stale.');
const sample = await readFile(path.join(root, 'models', 'organik-boyun.js'), 'utf8');
if (!sample.includes('return model;')) throw new Error('Organic example must return a model.');
const result = await createOrganicAPI().kure({ id: 'api-reference-check', yaricap: 2 });
if (result.id !== 'api-reference-check' || result.field([0, 0, 0]) !== 2) throw new Error('API smoke example failed.');
let rejected = false;
try { createOrganicAPI().kure({ ad: 'govde', yaricap: 0 }); } catch (error) { rejected = error.message === 'yaricap sıfırdan büyük olmalı.'; }
if (!rejected || !usageDoc.includes("yaricap: 0 })") || !usageDoc.includes("yaricap: 3 })")) throw new Error('Invalid/fix example or validation behavior is stale.');
const fixed = createOrganicAPI().kure({ ad: 'govde', yaricap: 3 });
if (fixed.field([0, 0, 0]) !== 3) throw new Error('Corrected sample failed.');
console.log(JSON.stringify({ status: 'passed', apiVersion: ORGANIC_API_VERSION, schemaVersion: MODEL_SCHEMA_VERSION, commands: ORGANIC_API_REFERENCE.length, sample: 'models/organik-boyun.js', invalidInput: 'rejected', correction: 'passed' }, null, 2));
