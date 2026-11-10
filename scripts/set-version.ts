// Usato dalla CI prima di expo prebuild: scrive in app.json versione e versionCode.
// npx tsx scripts/set-version.ts <GITHUB_REF> <GITHUB_RUN_NUMBER>
import { readFileSync, writeFileSync } from 'node:fs';
import { versionFromRef } from '../src/core/appVersion';

const [ref = '', run = '0'] = process.argv.slice(2);
const appJson = JSON.parse(readFileSync('app.json', 'utf8'));
const { version, versionCode } = versionFromRef(ref, appJson.expo.version, Number(run));
appJson.expo.version = version;
appJson.expo.android.versionCode = versionCode;
writeFileSync('app.json', JSON.stringify(appJson, null, 2) + '\n');
console.log(`Versione ${version} (versionCode ${versionCode})`);
