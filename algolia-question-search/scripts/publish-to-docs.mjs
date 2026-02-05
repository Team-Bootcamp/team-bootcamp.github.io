import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

const repoRoot = path.resolve(projectRoot, '..');
const targetDir = path.join(repoRoot, 'docs', 'algolia-search');

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

if (!(await pathExists(distDir))) {
  throw new Error(`Missing build output at ${distDir}. Run \`npm run build\` first.`);
}

await fs.rm(targetDir, {recursive: true, force: true});
await fs.mkdir(targetDir, {recursive: true});

const entries = await fs.readdir(distDir);
await Promise.all(
  entries.map((entry) =>
    fs.cp(path.join(distDir, entry), path.join(targetDir, entry), {
      recursive: true,
    }),
  ),
);

console.log(`Copied ${distDir} -> ${targetDir}`);
