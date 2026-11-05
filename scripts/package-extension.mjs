import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const distDir = fileURLToPath(new URL('../apps/extension/dist/', import.meta.url));
const publicDir = fileURLToPath(new URL('../apps/web/public/', import.meta.url));
const downloadsDir = join(publicDir, 'downloads');

mkdirSync(publicDir, { recursive: true });
mkdirSync(downloadsDir, { recursive: true });

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const fullPath = join(dir, name);
    return statSync(fullPath).isDirectory() ? filesUnder(fullPath) : [fullPath];
  });
}

const manifestPath = join(distDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '1.0.0';

const parentFolder = 'ourtube-companion';
const entries = {};

const allFiles = filesUnder(distDir);
for (const file of allFiles) {
  const rel = relative(distDir, file).split(sep).join('/');
  entries[`${parentFolder}/${rel}`] = readFileSync(file);
}

console.log(`Packaging ${allFiles.length} files from ${distDir}...`);
const zippedBuffer = zipSync(entries, { level: 9 });

const zipName = 'ourtube-companion.zip';
const targetPath1 = join(downloadsDir, zipName);
const targetPath2 = join(publicDir, zipName);

writeFileSync(targetPath1, zippedBuffer);
writeFileSync(targetPath2, zippedBuffer);

const metadata = {
  name: 'OurTube Companion Extension',
  version,
  builtAt: new Date().toISOString(),
  fileName: zipName,
  sizeBytes: zippedBuffer.length,
  sizeFormatted: `${(zippedBuffer.length / 1024).toFixed(1)} KB`,
  entryFolder: parentFolder
};

writeFileSync(join(downloadsDir, 'extension.json'), JSON.stringify(metadata, null, 2));

console.log(`Successfully packaged extension:`);
console.log(`  -> ${targetPath1} (${metadata.sizeFormatted})`);
console.log(`  -> ${targetPath2}`);
console.log(`  -> ${join(downloadsDir, 'extension.json')}`);
