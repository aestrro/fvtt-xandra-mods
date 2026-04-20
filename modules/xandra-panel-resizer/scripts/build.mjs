import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

async function copyFiles() {
  // Ensure dist directory exists
  await fs.mkdir(DIST_DIR, { recursive: true });

  // Copy module.json
  await fs.copyFile(
    path.join(ROOT_DIR, 'module.json'),
    path.join(DIST_DIR, 'module.json')
  );

  // Copy language files
  const langDir = path.join(ROOT_DIR, 'lang');
  const langDistDir = path.join(DIST_DIR, 'lang');
  try {
    await fs.mkdir(langDistDir, { recursive: true });
    const files = await fs.readdir(langDir);
    for (const file of files) {
      await fs.copyFile(path.join(langDir, file), path.join(langDistDir, file));
    }
  } catch (e) {
    // lang directory might be empty
  }

  // Copy templates
  const templatesDir = path.join(ROOT_DIR, 'templates');
  const templatesDistDir = path.join(DIST_DIR, 'templates');
  try {
    await fs.mkdir(templatesDistDir, { recursive: true });
    const files = await fs.readdir(templatesDir);
    for (const file of files) {
      await fs.copyFile(path.join(templatesDir, file), path.join(templatesDistDir, file));
    }
  } catch (e) {
    // templates directory might be empty
  }

  // Copy CSS directly from src/styles/sidebar-resizer.css
  const cssSrc = path.join(ROOT_DIR, 'src', 'styles', 'sidebar-resizer.css');
  const cssDest = path.join(DIST_DIR, 'styles.css');
  try {
    await fs.copyFile(cssSrc, cssDest);
    console.log('✅ CSS copied');
  } catch (e) {
    console.warn('⚠️  CSS copy failed');
  }

  // Copy static assets
  const staticDir = path.join(ROOT_DIR, 'static');
  const staticDistDir = path.join(DIST_DIR, 'static');
  try {
    await fs.mkdir(staticDistDir, { recursive: true });
    const files = await fs.readdir(staticDir);
    for (const file of files) {
      const srcPath = path.join(staticDir, file);
      const destPath = path.join(staticDistDir, file);
      const stat = await fs.stat(srcPath);
      if (stat.isDirectory()) {
        await fs.cp(srcPath, destPath, { recursive: true });
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  } catch (e) {
    // static directory might be empty
  }

  console.log('✅ Build complete');
}

const watch = process.argv.includes('--watch');

if (watch) {
  console.log('👀 Watching for changes...');
  await copyFiles();
} else {
  await copyFiles();
}
