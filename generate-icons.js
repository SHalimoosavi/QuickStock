'use strict';
/** Generates favicon/PWA icons for the landing site using only Node's
 * built-in zlib (no dependencies, no network). Same mark as the app itself
 * (a price-tag diamond) for brand consistency between product and site. */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, 'icons');
const INK = [0x0b, 0x0d, 0x08, 255];
const AMBER = [0xd9, 0x8e, 0x04, 255];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8; ihdrData[9] = 6; ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdrData), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function drawTag(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const half = size * (maskable ? 0.30 : 0.37);
  const holeOff = half * 0.62;
  const holeR = size * 0.05;
  const sqrt2 = Math.SQRT2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const rx = (dx + dy) / sqrt2, ry = (dy - dx) / sqrt2;
      let c = INK;
      if (Math.abs(rx) <= half && Math.abs(ry) <= half) {
        c = AMBER;
        const hx = cx - holeOff, hy = cy - holeOff;
        const hdx = x + 0.5 - hx, hdy = y + 0.5 - hy;
        if (hdx * hdx + hdy * hdy <= holeR * holeR) c = INK;
      }
      buf[idx] = c[0]; buf[idx + 1] = c[1]; buf[idx + 2] = c[2]; buf[idx + 3] = c[3];
    }
  }
  return buf;
}

function write(name, size, maskable) {
  const png = encodePng(size, size, drawTag(size, maskable));
  fs.writeFileSync(path.join(OUT_DIR, name), png);
  console.log(`Wrote ${name} (${size}x${size}, ${png.length} bytes)`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
write('favicon-16.png', 16, false);
write('favicon-32.png', 32, false);
write('apple-touch-icon.png', 180, true);
write('icon-192.png', 192, false);
write('icon-512.png', 512, false);
write('icon-maskable-192.png', 192, true);
write('icon-maskable-512.png', 512, true);

function drawOgBanner(w, h) {
  const buf = Buffer.alloc(w * h * 4);
  const markCx = w * 0.22, markCy = h * 0.5, markHalf = h * 0.30;
  const holeOff = markHalf * 0.62, holeR = h * 0.045;
  const sqrt2 = Math.SQRT2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      let c = INK;

      // subtle vertical ledger rules on the right two-thirds
      if (x > w * 0.38) {
        const rowHeight = h / 7;
        const rowIndex = Math.floor(y / rowHeight);
        const withinRow = y - rowIndex * rowHeight;
        if (withinRow < 2) c = [255, 255, 255, 18]; // faint hairline (low alpha ink-on-ink, blended manually below)
      }

      // brand mark (diamond + hole) on the left
      const dx = x + 0.5 - markCx, dy = y + 0.5 - markCy;
      const rx = (dx + dy) / sqrt2, ry = (dy - dx) / sqrt2;
      if (Math.abs(rx) <= markHalf && Math.abs(ry) <= markHalf) {
        c = AMBER;
        const hx = markCx - holeOff, hy = markCy - holeOff;
        const hdx = x + 0.5 - hx, hdy = y + 0.5 - hy;
        if (hdx * hdx + hdy * hdy <= holeR * holeR) c = INK;
      }

      // blend faint hairlines against ink background (since PNG has no real alpha compositing in our raw writer)
      if (c[3] === 18) {
        const blend = (ch) => Math.round(INK[ch] + (255 - INK[ch]) * 0.06);
        c = [blend(0), blend(1), blend(2), 255];
      }

      buf[idx] = c[0]; buf[idx + 1] = c[1]; buf[idx + 2] = c[2]; buf[idx + 3] = 255;
    }
  }
  return buf;
}

function writeOg(name, w, h) {
  const png = encodePng(w, h, drawOgBanner(w, h));
  fs.writeFileSync(path.join(OUT_DIR, name), png);
  console.log(`Wrote ${name} (${w}x${h}, ${png.length} bytes)`);
}

writeOg('og-banner.png', 1200, 630);
console.log('Done.');
