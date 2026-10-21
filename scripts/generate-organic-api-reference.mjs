import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL_SCHEMA_VERSION, ORGANIC_API_VERSION, ORGANIC_API_REFERENCE } from '../src/api-schema.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rows = ORGANIC_API_REFERENCE.map(item => `| \`${item.name}(${item.args})\` | ${item.purpose} |`).join('\n');
const doc = `# Organik API referansı\n\nBu dosya \`src/api-schema.js\` kaynağından üretilir.\n\n- Organik API sürümü: **${ORGANIC_API_VERSION}**\n- Model sonuç sözleşmesi: **${MODEL_SCHEMA_VERSION}**\n- Koordinatlar ve ölçüler: **mm**; açı: **derece**.\n- Model kodu \`return model;\` ile bir \`OrganikParca\` döndürür.\n\n| Komut | Kullanım |\n|---|---|\n${rows}\n\nTam örnekler ve hata sınırları: [AI-KULLANIM.md](./AI-KULLANIM.md). Geometri ve baskı sınırları açıklanan prototip kısıtlarıdır.\n`;
await writeFile(path.join(root, 'docs', 'ORGANIK-API-REFERANSI.md'), doc);
console.log(`Wrote docs/ORGANIK-API-REFERANSI.md (${ORGANIC_API_REFERENCE.length} commands; API ${ORGANIC_API_VERSION}; schema ${MODEL_SCHEMA_VERSION}).`);
