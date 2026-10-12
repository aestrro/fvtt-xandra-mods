import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = path.join(moduleDirectory, 'dist');

const stripDistPrefix = (value) =>
  typeof value === 'string' ? value.replace(/^dist\//, '') : value;

const sourceManifest = JSON.parse(
  await fs.readFile(path.join(moduleDirectory, 'module.json'), 'utf8')
);
const packagedManifest = {
  ...sourceManifest,
  esmodules: sourceManifest.esmodules?.map(stripDistPrefix),
  styles: sourceManifest.styles?.map(stripDistPrefix),
  languages: sourceManifest.languages?.map((language) => ({
    ...language,
    path: stripDistPrefix(language.path)
  }))
};

await fs.mkdir(path.join(distDirectory, 'lang'), { recursive: true });
await fs.writeFile(
  path.join(distDirectory, 'module.json'),
  `${JSON.stringify(packagedManifest, null, 2)}\n`
);
await fs.copyFile(
  path.join(moduleDirectory, 'lang', 'en.json'),
  path.join(distDirectory, 'lang', 'en.json')
);
await fs.copyFile(
  path.join(moduleDirectory, 'README.md'),
  path.join(distDirectory, 'README.md')
);

console.log('xandra-dice-tray | Packaged Foundry module assets');
