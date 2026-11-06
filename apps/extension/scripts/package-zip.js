const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '../..');
const distDir = path.resolve(__dirname, '../dist');
const webPublicZip = path.resolve(rootDir, 'web/public/ourtube-companion.zip');
const webDownloadsZip = path.resolve(rootDir, 'web/public/downloads/ourtube-companion.zip');

const psScript = `
Add-Type -AssemblyName System.IO.Compression;
Add-Type -AssemblyName System.IO.Compression.FileSystem;
$zipPath = '${webPublicZip.replace(/\\/g, '/')}';
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue;
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create);
$dist = '${distDir.replace(/\\/g, '/')}';
Get-ChildItem -Path $dist -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($dist.Length + 1).Replace('\\', '/');
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal)
};
$zip.Dispose();
Copy-Item $zipPath '${webDownloadsZip.replace(/\\/g, '/')}' -Force;
`;

try {
  execSync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`, { stdio: 'inherit' });
  console.log('[package-zip] Successfully packaged standard ourtube-companion.zip');
} catch (e) {
  console.warn('[package-zip] Packaging failed:', e.message);
}
