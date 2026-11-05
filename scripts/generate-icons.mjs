import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'binary');
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(width, height, getPixel) {
  const header = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);

  const scanlines = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const offset = 1 + x * 4;
      row[offset] = r;
      row[offset + 1] = g;
      row[offset + 2] = b;
      row[offset + 3] = a;
    }
    scanlines.push(row);
  }

  const rawData = Buffer.concat(scanlines);
  const idatData = zlib.deflateSync(rawData);
  const idat = chunk('IDAT', idatData);
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdr, idat, iend]);
}

// Distance from point to 2D triangle
function pointInPlayTriangle(px, py, cx, cy, size) {
  // Triangle vertices:
  // v0 (left-top): (cx - size*0.4, cy - size*0.5)
  // v1 (left-bottom): (cx - size*0.4, cy + size*0.5)
  // v2 (right-tip): (cx + size*0.55, cy)
  const x0 = cx - size * 0.35, y0 = cy - size * 0.45;
  const x1 = cx - size * 0.35, y1 = cy + size * 0.45;
  const x2 = cx + size * 0.5, y2 = cy;

  const d1 = (px - x1) * (y0 - y1) - (x0 - x1) * (py - y1);
  const d2 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  const d3 = (px - x0) * (y2 - y0) - (x2 - x0) * (py - y0);

  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

function renderOurTubePixel(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const r = w * 0.46; // squircle / circle radius

  const dx = x - cx + 0.5;
  const dy = y - cy + 0.5;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Anti-aliased circular container boundary
  const edgeDist = r - dist;
  if (edgeDist < -0.5) {
    return [0, 0, 0, 0]; // transparent
  }
  let alpha = 1.0;
  if (edgeDist < 0.5) {
    alpha = Math.max(0, Math.min(1, edgeDist + 0.5));
  }

  // Base background: YouTube Red / Coral Gradient with subtle dark edge
  const gradT = Math.max(0, Math.min(1, (y / h)));
  // Deep Crimson to Bright Coral Red
  const bgR = Math.round(255 - gradT * 40);
  const bgG = Math.round(18 + gradT * 10);
  const bgB = Math.round(38 + gradT * 20);

  // Check play triangle
  const inTriangle = pointInPlayTriangle(x + 0.5, y + 0.5, cx + w * 0.04, cy, w * 0.52);

  if (inTriangle) {
    // Pure White play button
    return [255, 255, 255, Math.round(255 * alpha)];
  }

  // Subtle inner border ring
  if (dist > r - 1.5 && dist <= r) {
    return [255, 120, 130, Math.round(255 * alpha * 0.6)];
  }

  return [bgR, bgG, bgB, Math.round(255 * alpha)];
}

const extDir = path.resolve('apps/extension/icons');
const webDir = path.resolve('apps/web/public/icons');
fs.mkdirSync(extDir, { recursive: true });
fs.mkdirSync(webDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const pngBuffer = createPng(size, size, renderOurTubePixel);
  fs.writeFileSync(path.join(extDir, `icon${size}.png`), pngBuffer);
  fs.writeFileSync(path.join(webDir, `icon${size}.png`), pngBuffer);
  console.log(`Generated icon${size}.png (${pngBuffer.length} bytes)`);
}
