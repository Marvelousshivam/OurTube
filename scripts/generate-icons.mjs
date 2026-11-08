import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

function crc32(buf) {
  const table = [];
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

// Canonical Concept 1 ("Twin-Bud Loop") SVG with seamless Bezier over/under crossover
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="ourtube-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF2A4B" />
      <stop offset="100%" stop-color="#B80D2E" />
    </linearGradient>
  </defs>
  <!-- Squircle Container -->
  <rect x="2" y="2" width="124" height="124" rx="34" fill="url(#ourtube-grad)" />
  <rect x="4" y="4" width="120" height="120" rx="32" fill="none" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="2" />

  <!-- 1. Full Infinity Wired Cord (Base Loop) -->
  <path
    d="M 16 64 C 16 32, 47 32, 64 64 C 81 96, 112 96, 112 64 C 112 32, 81 32, 64 64 C 47 96, 16 96, 16 64 Z"
    fill="none"
    stroke="#FFFFFF"
    stroke-width="9"
    stroke-linecap="round"
    stroke-linejoin="round"
  />

  <!-- 2. Over/Under Crossover Gap Mask -->
  <path
    d="M 54 49 C 58 54, 61 59, 64 64 C 67 69, 70 74, 74 79"
    fill="none"
    stroke="#D91E3E"
    stroke-width="15.5"
    stroke-linecap="butt"
  />

  <!-- 3. Seamless Over-Strand Bezier S-Curve -->
  <path
    d="M 16 64 C 16 32, 47 32, 64 64 C 81 96, 112 96, 112 64"
    fill="none"
    stroke="#FFFFFF"
    stroke-width="9"
    stroke-linecap="round"
  />

  <!-- 4. Left Angled Earbud inside Left Loop -->
  <g transform="translate(35, 64) rotate(-26)">
    <rect x="-7" y="-9.5" width="12" height="19" rx="6" fill="#FFD8E4" />
    <circle cx="7.5" cy="0" r="4.6" fill="#FFFFFF" />
    <rect x="-3" y="-4" width="2.2" height="8" rx="1.1" fill="#B80D2E" opacity="0.7" />
  </g>

  <!-- 5. Right Angled Earbud inside Right Loop -->
  <g transform="translate(93, 64) rotate(-26)">
    <rect x="-5" y="-9.5" width="12" height="19" rx="6" fill="#FFD8E4" />
    <circle cx="-7.5" cy="0" r="4.6" fill="#FFFFFF" />
    <rect x="0.8" y="-4" width="2.2" height="8" rx="1.1" fill="#B80D2E" opacity="0.7" />
  </g>
</svg>
`;

function evalCubic(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const x = mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0];
  const y = mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1];
  return [x, y];
}

// Segments 0 & 1 form the Over-strand S-curve; Segments 2 & 3 form the Under-strand S-curve
const OVER_SEGMENTS = [
  [[16, 64], [16, 32], [47, 32], [64, 64]],
  [[64, 64], [81, 96], [112, 96], [112, 64]]
];

const UNDER_SEGMENTS = [
  [[112, 64], [112, 32], [81, 32], [64, 64]],
  [[64, 64], [47, 96], [16, 96], [16, 64]]
];

function sampleSegments(segments, steps = 48) {
  const pts = [];
  for (const seg of segments) {
    for (let i = 0; i <= steps; i++) {
      pts.push(evalCubic(seg[0], seg[1], seg[2], seg[3], i / steps));
    }
  }
  return pts;
}

const OVER_POINTS = sampleSegments(OVER_SEGMENTS, 50);
const UNDER_POINTS = sampleSegments(UNDER_SEGMENTS, 50);

function distToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const c1 = wx * vx + wy * vy;
  if (c1 <= 0) return Math.hypot(px - x1, py - y1);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - x2, py - y2);
  const b = c1 / c2;
  return Math.hypot(px - (x1 + b * vx), py - (y1 + b * vy));
}

function distToPolyline(px, py, pts) {
  let minD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d < minD) minD = d;
  }
  return minD;
}

function sdRoundBox(px, py, cx, cy, halfW, halfH, rad) {
  const qx = Math.abs(px - cx) - (halfW - rad);
  const qy = Math.abs(py - cy) - (halfH - rad);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
}

const COS_26 = Math.cos((26 * Math.PI) / 180);
const SIN_26 = Math.sin((26 * Math.PI) / 180);

function sampleLogo128(ux, uy) {
  const dContainer = sdRoundBox(ux, uy, 64, 64, 62, 62, 34);
  if (dContainer > 0) {
    return [0, 0, 0, 0];
  }

  // Diagonal gradient #FF2A4B -> #B80D2E
  const t = Math.max(0, Math.min(1, (ux + uy) / 256));
  const bgR = 255 + (184 - 255) * t;
  const bgG = 42 + (13 - 42) * t;
  const bgB = 75 + (46 - 75) * t;

  let r = bgR;
  let g = bgG;
  let b = bgB;

  if (dContainer > -4.0 && dContainer < -2.0) {
    r = r * 0.86 + 255 * 0.14;
    g = g * 0.86 + 255 * 0.14;
    b = b * 0.86 + 255 * 0.14;
  }

  const dUnder = distToPolyline(ux, uy, UNDER_POINTS);
  const dOver = distToPolyline(ux, uy, OVER_POINTS);

  // 1. Under-strand (strokeWidth 9 -> radius 4.5), masked only at the center crossover
  const inCenterCrossoverMask = dOver <= 7.75 && ux > 44 && ux < 84;
  if (dUnder <= 4.5 && !inCenterCrossoverMask) {
    r = 255;
    g = 255;
    b = 255;
  }

  // 2. Seamless Over-strand (strokeWidth 9 -> radius 4.5)
  if (dOver <= 4.5) {
    r = 255;
    g = 255;
    b = 255;
  }

  // 3. Left Angled Earbud inside Left Loop: translate(35, 64) rotate(-26deg)
  {
    const dx = ux - 35;
    const dy = uy - 64;
    const lx = dx * COS_26 - dy * SIN_26;
    const ly = dx * SIN_26 + dy * COS_26;

    // Silicone ear-tip: circle at (7.5, 0) r=4.6
    if (Math.hypot(lx - 7.5, ly) <= 4.6) {
      r = 255;
      g = 255;
      b = 255;
    }
    // Acoustic housing: rect x in [-7, 5] (cx=-1, hw=6), y in [-9.5, 9.5] (cy=0, hh=9.5), rx=6
    if (sdRoundBox(lx, ly, -1, 0, 6, 9.5, 6) <= 0) {
      r = 255;
      g = 216;
      b = 228;
      // Mesh slit: rect x in [-3, -0.8] (cx=-1.9, hw=1.1), y in [-4, 4] (cy=0, hh=4), rx=1.1
      if (sdRoundBox(lx, ly, -1.9, 0, 1.1, 4, 1.1) <= 0) {
        r = Math.round(255 * 0.3 + 184 * 0.7);
        g = Math.round(216 * 0.3 + 13 * 0.7);
        b = Math.round(228 * 0.3 + 46 * 0.7);
      }
    }
  }

  // 4. Right Angled Earbud inside Right Loop: translate(93, 64) rotate(-26deg)
  {
    const dx = ux - 93;
    const dy = uy - 64;
    const lx = dx * COS_26 - dy * SIN_26;
    const ly = dx * SIN_26 + dy * COS_26;

    // Silicone ear-tip: circle at (-7.5, 0) r=4.6
    if (Math.hypot(lx + 7.5, ly) <= 4.6) {
      r = 255;
      g = 255;
      b = 255;
    }
    // Acoustic housing: rect x in [-5, 7] (cx=1, hw=6), y in [-9.5, 9.5] (cy=0, hh=9.5), rx=6
    if (sdRoundBox(lx, ly, 1, 0, 6, 9.5, 6) <= 0) {
      r = 255;
      g = 216;
      b = 228;
      // Mesh slit: rect x in [0.8, 3] (cx=1.9, hw=1.1), y in [-4, 4] (cy=0, hh=4), rx=1.1
      if (sdRoundBox(lx, ly, 1.9, 0, 1.1, 4, 1.1) <= 0) {
        r = Math.round(255 * 0.3 + 184 * 0.7);
        g = Math.round(216 * 0.3 + 13 * 0.7);
        b = Math.round(228 * 0.3 + 46 * 0.7);
      }
    }
  }

  return [r, g, b, 255];
}

function renderOurTubePixel(x, y, w, h) {
  const scaleX = 128 / w;
  const scaleY = 128 / h;
  let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
  const grid = 4;

  for (let sy = 0; sy < grid; sy++) {
    for (let sx = 0; sx < grid; sx++) {
      const ux = (x + (sx + 0.5) / grid) * scaleX;
      const uy = (y + (sy + 0.5) / grid) * scaleY;
      const [r, g, b, a] = sampleLogo128(ux, uy);
      if (a > 0) {
        sumR += r;
        sumG += g;
        sumB += b;
        sumA += a;
      }
    }
  }

  const samples = grid * grid;
  const outA = Math.round(sumA / samples);
  if (outA === 0) return [0, 0, 0, 0];
  const activeCount = sumA / 255;
  return [
    Math.round(sumR / activeCount),
    Math.round(sumG / activeCount),
    Math.round(sumB / activeCount),
    outA
  ];
}

const extDir = path.resolve('apps/extension/icons');
const extDistDir = path.resolve('apps/extension/dist/icons');
const webPublicDir = path.resolve('apps/web/public');
const webIconsDir = path.resolve('apps/web/public/icons');

fs.mkdirSync(extDir, { recursive: true });
fs.mkdirSync(extDistDir, { recursive: true });
fs.mkdirSync(webIconsDir, { recursive: true });

fs.writeFileSync(path.join(webPublicDir, 'favicon.svg'), LOGO_SVG, 'utf8');
fs.writeFileSync(path.join(webIconsDir, 'logo.svg'), LOGO_SVG, 'utf8');
console.log('Generated favicon.svg and icons/logo.svg');

for (const size of [16, 32, 48, 128]) {
  const pngBuffer = createPng(size, size, renderOurTubePixel);
  fs.writeFileSync(path.join(extDir, `icon${size}.png`), pngBuffer);
  fs.writeFileSync(path.join(extDistDir, `icon${size}.png`), pngBuffer);
  fs.writeFileSync(path.join(webIconsDir, `icon${size}.png`), pngBuffer);
  console.log(`Generated icon${size}.png (${pngBuffer.length} bytes)`);
}
