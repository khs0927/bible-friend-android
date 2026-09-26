#!/usr/bin/env node
// Export the design from Figma through the REST API (works with a View seat).
//
//   1. Figma → Settings → Security → Personal access tokens → "Generate new token"
//      (scope: File content → Read-only). Keep it private.
//   2. PowerShell:  setx FIGMA_TOKEN "<token>"   (then open a new terminal)
//   3. pnpm figma:export [fileKey]
//
// Writes to design/figma/:
//   manifest.json   pages → top-level frames (id, name, size)
//   tokens.json     colors, text styles, radii, spacing found in the file
//   frames/*.png    every top-level frame rendered at 2x
// The token never leaves this machine except to api.figma.com.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE_KEY = process.argv[2] ?? 'cqQhO3opkgUmaEgOPAEUt3';
const TOKEN = process.env.FIGMA_TOKEN;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'design', 'figma');

if (!TOKEN) {
  console.error('FIGMA_TOKEN is not set. See the header of scripts/figma-export.mjs.');
  process.exit(1);
}

async function figma(path) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`https://api.figma.com/v1${path}`, { headers: { 'X-Figma-Token': TOKEN } });
    if (response.status === 429) {
      const wait = Number(response.headers.get('retry-after') ?? 30) * 1000;
      console.warn(`rate limited, waiting ${wait / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, wait));
      continue;
    }
    if (!response.ok) throw new Error(`Figma ${path}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
    return response.json();
  }
  throw new Error(`Figma ${path}: still rate limited`);
}

const hex = ({ r, g, b, a = 1 }) =>
  `#${[r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}${a < 1 ? Math.round(a * 255).toString(16).padStart(2, '0') : ''}`.toUpperCase();

function collect(node, acc) {
  for (const fill of node.fills ?? []) {
    if (fill.type === 'SOLID' && fill.visible !== false) {
      const value = hex({ ...fill.color, a: (fill.opacity ?? 1) * (fill.color.a ?? 1) });
      acc.colors.set(value, (acc.colors.get(value) ?? 0) + 1);
    }
  }
  if (node.type === 'TEXT' && node.style) {
    const { fontFamily, fontWeight, fontSize, lineHeightPx, letterSpacing } = node.style;
    const key = `${fontFamily}/${fontWeight}/${fontSize}/${Math.round(lineHeightPx ?? 0)}`;
    const entry = acc.text.get(key) ?? { fontFamily, fontWeight, fontSize, lineHeight: Math.round(lineHeightPx ?? 0), letterSpacing, count: 0, sample: node.characters?.slice(0, 20) };
    entry.count += 1;
    acc.text.set(key, entry);
  }
  if (typeof node.cornerRadius === 'number') acc.radii.set(node.cornerRadius, (acc.radii.get(node.cornerRadius) ?? 0) + 1);
  for (const key of ['itemSpacing', 'paddingLeft', 'paddingTop']) {
    if (typeof node[key] === 'number' && node[key] > 0) acc.spacing.set(node[key], (acc.spacing.get(node[key]) ?? 0) + 1);
  }
  for (const child of node.children ?? []) collect(child, acc);
}

const byCount = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));

console.log(`Reading file ${FILE_KEY}…`);
const file = await figma(`/files/${FILE_KEY}`);
const acc = { colors: new Map(), text: new Map(), radii: new Map(), spacing: new Map() };
const manifest = { name: file.name, lastModified: file.lastModified, pages: [] };
const frameIds = [];
for (const page of file.document.children) {
  const frames = (page.children ?? [])
    .filter((node) => ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'SECTION'].includes(node.type))
    .map((node) => ({ id: node.id, name: node.name, type: node.type, width: Math.round(node.absoluteBoundingBox?.width ?? 0), height: Math.round(node.absoluteBoundingBox?.height ?? 0) }));
  manifest.pages.push({ id: page.id, name: page.name, frames });
  frameIds.push(...frames.map((frame) => frame.id));
  collect(page, acc);
}

mkdirSync(join(out, 'frames'), { recursive: true });
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
writeFileSync(
  join(out, 'tokens.json'),
  JSON.stringify(
    {
      source: `figma:${FILE_KEY}`,
      exportedAt: new Date().toISOString(),
      colors: byCount(acc.colors).slice(0, 60),
      textStyles: [...acc.text.values()].sort((a, b) => b.count - a.count).slice(0, 40),
      radii: byCount(acc.radii).slice(0, 20),
      spacing: byCount(acc.spacing).slice(0, 20),
      namedStyles: file.styles,
    },
    null,
    2,
  ),
);
console.log(`${manifest.pages.length} pages, ${frameIds.length} frames → design/figma/manifest.json, tokens.json`);

for (let i = 0; i < frameIds.length; i += 20) {
  const batch = frameIds.slice(i, i + 20);
  const { images } = await figma(`/images/${FILE_KEY}?ids=${encodeURIComponent(batch.join(','))}&format=png&scale=2`);
  for (const [id, url] of Object.entries(images ?? {})) {
    if (!url) continue;
    const png = Buffer.from(await (await fetch(url)).arrayBuffer());
    const frame = manifest.pages.flatMap((page) => page.frames).find((f) => f.id === id);
    const name = `${id.replace(/[:;]/g, '-')}-${(frame?.name ?? 'frame').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40)}.png`;
    writeFileSync(join(out, 'frames', name), png);
    console.log(`  frames/${name}`);
  }
}
console.log('Done.');
