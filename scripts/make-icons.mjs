// Generates icons/icon-192.png and icons/icon-512.png — solid indigo with a
// simple "steps to a star" motif. Pure Node (zlib), no dependencies.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTable = [];
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function makePNG(size, draw) {
  const W = size, H = size;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    const rowStart = y * (1 + W * 3);
    raw[rowStart] = 0; // no filter
    for (let x = 0; x < W; x++) {
      const [r, g, b] = draw(x, y).map(Math.round);
      const o = rowStart + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit truecolor RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [79, 70, 229];       // indigo
const STEP = [255, 251, 235];   // cream
const STAR = [250, 204, 21];    // amber

const draw = (S) => (x, y) => {
  const cx = x / S, cy = y / S; // 0..1
  // three rising steps
  const steps = [[0.18, 0.60, 0.62], [0.5, 0.42, 0.28], [0.82, 0.24, 0.28]]; // x, y, w (approx)
  for (let i = 0; i < 3; i++) {
    const [sx, sy] = [steps[i][0], steps[i][1]];
    if (Math.abs(cx - sx) < 0.11 - i * 0.02 && cy > sy && cy < sy + 0.12) return STEP;
  }
  // star: 5-point-ish diamond at top
  const dx = Math.abs(cx - 0.5), dy = Math.abs(cy - 0.18);
  if (dx + dy < 0.11) return STAR;
  return BG;
};

mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-192.png', makePNG(192, draw(192)));
writeFileSync('icons/icon-512.png', makePNG(512, draw(512)));
console.log('icons written');
