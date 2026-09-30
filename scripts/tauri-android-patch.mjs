// Applies Bible Friend's Android settings to the Tauri-generated project
// (rust/apps/bible-friend/gen/android) after `cargo tauri android init`.
// Idempotent, so CI can run init + patch on every build.
//
// - app label "성경 친구" (productName stays ASCII for Gradle)
// - RECORD_AUDIO / MODIFY_AUDIO_SETTINGS: voice questions use getUserMedia in
//   the WebView; Tauri's WebChromeClient asks for the runtime permission only
//   when the manifest declares it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const main = path.join(root, 'rust/apps/bible-friend/gen/android/app/src/main');
const manifest = path.join(main, 'AndroidManifest.xml');
const strings = path.join(main, 'res/values/strings.xml');
const APP_LABEL = '성경 친구';

const PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
];

if (!existsSync(manifest)) {
  console.error(`Missing ${manifest}. Run \`pnpm rust:android:init\` first.`);
  process.exit(1);
}

let xml = readFileSync(manifest, 'utf8');
const missing = PERMISSIONS.filter(p => !xml.includes(`"${p}"`));
if (missing.length) {
  const lines = missing.map(p => `    <uses-permission android:name="${p}" />`).join('\n');
  xml = xml.replace(/(<manifest[^>]*>)/, `$1\n${lines}`);
  writeFileSync(manifest, xml);
}
console.log(missing.length ? `Added ${missing.join(', ')}` : 'AndroidManifest.xml already patched');

if (existsSync(strings)) {
  const before = readFileSync(strings, 'utf8');
  const after = before.replace(/(<string name="(?:app_name|main_activity_title)">)[^<]*(<\/string>)/g, `$1${APP_LABEL}$2`);
  if (after !== before) writeFileSync(strings, after);
  console.log(`App label: ${APP_LABEL}`);
}
