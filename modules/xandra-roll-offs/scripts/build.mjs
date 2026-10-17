import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = path.join(moduleDirectory, 'dist');
const sourceManifest = JSON.parse(await fs.readFile(path.join(moduleDirectory, 'module.json'), 'utf8'));
const stripDist = (value) => typeof value === 'string' ? value.replace(/^dist\//, '') : value;
const manifest = {
  ...sourceManifest,
  esmodules: sourceManifest.esmodules.map(stripDist),
  styles: sourceManifest.styles.map(stripDist),
  languages: sourceManifest.languages.map((language) => ({
    ...language,
    path: stripDist(language.path)
  }))
};

await fs.mkdir(path.join(distDirectory, 'lang'), { recursive: true });
await fs.mkdir(path.join(distDirectory, 'templates'), { recursive: true });
await fs.writeFile(path.join(distDirectory, 'module.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await Promise.all([
  fs.copyFile(path.join(moduleDirectory, 'lang/en.json'), path.join(distDirectory, 'lang/en.json')),
  fs.copyFile(path.join(moduleDirectory, 'README.md'), path.join(distDirectory, 'README.md')),
  fs.copyFile(path.join(moduleDirectory, 'LICENSE.txt'), path.join(distDirectory, 'LICENSE.txt')),
  fs.copyFile(path.join(moduleDirectory, 'templates/chat-round-summary.hbs'), path.join(distDirectory, 'templates/chat-round-summary.hbs')),
  fs.copyFile(path.join(moduleDirectory, 'templates/chat-rolloff-summary.hbs'), path.join(distDirectory, 'templates/chat-rolloff-summary.hbs'))
]);
console.log('xandra-roll-offs | Packaged Foundry module assets');
