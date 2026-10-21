import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateParameterValues } from '../src/parameter-schema.js';

const schema = JSON.parse(await readFile(new URL('../models/at-kafasi.parameters.json', import.meta.url), 'utf8'));
const v2Schema = JSON.parse(await readFile(new URL('../models/at-kafasi-v2.parameters.json', import.meta.url), 'utf8'));
const defaults = validateParameterValues(schema, {});
assert.deepEqual(defaults, { yukseklik: 160, kulakUzunlugu: 39, yele: true, detaylar: true, burunAcisi: 0 });
assert.deepEqual(validateParameterValues(schema, { yukseklik: 180, yele: false, detaylar: false, burunAcisi: -7 }), { yukseklik: 180, kulakUzunlugu: 39, yele: false, detaylar: false, burunAcisi: -7 });
assert.throws(() => validateParameterValues(schema, { yele: 'false' }), /true\/false/);
assert.throws(() => validateParameterValues(schema, { burunAcisi: 11 }), /adımlarla girilmeli/);
assert.throws(() => validateParameterValues(schema, { extra: true }), /Bilinmeyen/);
assert.deepEqual(validateParameterValues(v2Schema, {}), { yukseklik:160, kulakUzunlugu:39, yele:true, detaylar:true, burunAcisi:0, yanakDolgunlugu:12 });
assert.deepEqual(validateParameterValues(v2Schema, { yanakDolgunlugu:16 }), { yukseklik:160, kulakUzunlugu:39, yele:true, detaylar:true, burunAcisi:0, yanakDolgunlugu:16 });
assert.throws(() => validateParameterValues(v2Schema, { yanakDolgunlugu:17 }), /adımlarla girilmeli/);
const enumSchema = { schemaVersion: 1, parameters: [{ id: 'kalinlik', label: 'Kalınlık', type: 'enum', options: ['ince', 'kalin'], default: 'ince' }] };
assert.deepEqual(validateParameterValues(enumSchema, { kalinlik: 'kalin' }), { kalinlik: 'kalin' });
assert.throws(() => validateParameterValues(enumSchema, { kalinlik: 'devasa' }), /seçeneklerden biri/);
console.log(JSON.stringify({ status: 'passed', checked: ['V1 and V2 defaults', 'number', 'angle', 'boolean', 'enum', 'unknown-key', 'out-of-range'] }));
