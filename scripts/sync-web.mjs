// Builds the bible-friend-web React client and copies it into the Tauri shell
// (rust/web-dist). The web repo stays the single source of UI.
//
//   node scripts/sync-web.mjs                 # uses ../bible-friend-web
//   WEB_DIR=/path/to/bible-friend-web node scripts/sync-web.mjs
//
// The bundled app calls the web's server (the single backend), so the build
// needs its absolute URL: API_BASE_URL=https://<deployment> (→ VITE_API_BASE_URL).
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.resolve(process.env.WEB_DIR ?? path.join(root, '..', 'bible-friend-web'));
const built = path.join(webDir, 'dist', 'public');
const target = path.join(root, 'rust', 'web-dist');

if (!existsSync(path.join(webDir, 'vite.config.ts'))) {
  console.error(`bible-friend-web not found at ${webDir} (set WEB_DIR)`);
  process.exit(1);
}

const apiBase = process.env.API_BASE_URL ?? process.env.VITE_API_BASE_URL;
if (!apiBase) {
  console.error('Set API_BASE_URL to the deployed bible-friend-web server (e.g. https://<app>.vercel.app)');
  process.exit(1);
}

execSync('pnpm install', { cwd: webDir, stdio: 'inherit' });
execSync('pnpm exec vite build', {
  cwd: webDir,
  stdio: 'inherit',
  env: { ...process.env, VITE_API_BASE_URL: apiBase },
});

rmSync(target, { recursive: true, force: true });
cpSync(built, target, { recursive: true });
console.log(`Copied ${built} → ${target}`);
