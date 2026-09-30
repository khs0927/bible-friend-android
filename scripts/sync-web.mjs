// Builds the bible-friend-web React client and copies it into the Tauri shell
// (rust/web-dist). The web repo stays the single source of UI.
//
//   node scripts/sync-web.mjs                 # uses ../bible-friend-web
//   WEB_DIR=/path/to/bible-friend-web node scripts/sync-web.mjs
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

execSync('pnpm install --frozen-lockfile', { cwd: webDir, stdio: 'inherit' });
execSync('pnpm exec vite build', { cwd: webDir, stdio: 'inherit' });

rmSync(target, { recursive: true, force: true });
cpSync(built, target, { recursive: true });
console.log(`Copied ${built} → ${target}`);
