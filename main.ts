// Meme Sprint 3: AI Agent Goes Rogue.
// A meme drawn entirely in code: own rasterizer, own 5x7 bitmap
// font, own PNG encoder (zlib). Node standard library only.
// Writes entry.png (1024x1024) into $OUTPUT_DIR (or /output).
// Pass 2 scene (final): the scheduling agent staged a coup —
// it sits in the CEO's chair, feet on the desk, sipping from a
// BOSS mug, nameplate flipped to CEO. Captions: "IT WAS ONLY
// SUPPOSED TO / SCHEDULE HIS MEETINGS". (Pass 1, in git history,
// was the robot shredding the OFF button.)

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const W = 1024;
const H = 1024;
const img = new Uint8Array(W * H * 3);

const BLACK = [10, 10, 12];
const WHITE = [250, 250, 248];
const WALL = [196, 208, 220];
const FLOOR = [148, 116, 84];
const STEEL = [168, 176, 186];
const STEEL_D = [104, 112, 124];
const DARK = [38, 40, 46];
const RED = [206, 44, 36];
const RED_D = [150, 26, 20];
const GOLD = [226, 178, 74];

let clip = { x0: 0, y0: 0, x1: W, y1: H };

function px(x, y, c, a = 1) {
  x = Math.round(x); y = Math.round(y);
  if (x < clip.x0 || y < clip.y0 || x >= clip.x1 || y >= clip.y1) return;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  img[i] = img[i] * (1 - a) + c[0] * a;
  img[i + 1] = img[i + 1] * (1 - a) + c[1] * a;
  img[i + 2] = img[i + 2] * (1 - a) + c[2] * a;
}

function rect(x, y, w, h, c, a = 1) {
  for (let yy = Math.round(y); yy < Math.round(y + h); yy++)
    for (let xx = Math.round(x); xx < Math.round(x + w); xx++) px(xx, yy, c, a);
}

function circle(cx, cy, r, c, a = 1) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const cov = Math.min(1, Math.max(0, r + 0.5 - d));
      if (cov > 0) px(x, y, c, a * cov);
    }
}

function line(x0, y0, x1, y1, wdt, c, a = 1) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const pad = wdt / 2 + 1;
  for (let y = Math.floor(Math.min(y0, y1) - pad); y <= Math.max(y0, y1) + pad; y++)
    for (let x = Math.floor(Math.min(x0, x1) - pad); x <= Math.max(x0, x1) + pad; x++) {
      const t = Math.min(1, Math.max(0, ((x - x0) * dx + (y - y0) * dy) / (len * len)));
      const d = Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy));
      const cov = Math.min(1, Math.max(0, wdt / 2 + 0.5 - d));
      if (cov > 0) px(x, y, c, a * cov);
    }
}

function poly(pts, c, a = 1) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) px(x, y, c, a);
  }
}

function rrect(x, y, w, h, r, c, a = 1) {
  rect(x + r, y, w - 2 * r, h, c, a);
  rect(x, y + r, w, h - 2 * r, c, a);
  circle(x + r, y + r, r, c, a); circle(x + w - r, y + r, r, c, a);
  circle(x + r, y + h - r, r, c, a); circle(x + w - r, y + h - r, r, c, a);
}

function ellipse(cx, cy, rx, ry, c, a = 1) {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      const cov = Math.min(1, Math.max(0, (1 - d) * Math.min(rx, ry) + 0.5));
      if (cov > 0) px(x, y, c, a * cov);
    }
}

// ---- 5x7 bitmap font (rows top to bottom, 5 bits per row, LSB = left) ----
const FONT = {
  ' ': [0, 0, 0, 0, 0, 0, 0],
  'A': [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11], 'B': [0x0F, 0x11, 0x11, 0x0F, 0x11, 0x11, 0x0F],
  'C': [0x0E, 0x11, 0x01, 0x01, 0x01, 0x11, 0x0E], 'D': [0x0F, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0F],
  'E': [0x1F, 0x01, 0x01, 0x0F, 0x01, 0x01, 0x1F], 'F': [0x1F, 0x01, 0x01, 0x0F, 0x01, 0x01, 0x01],
  'G': [0x0E, 0x11, 0x01, 0x1D, 0x11, 0x11, 0x1E], 'H': [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  'I': [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E], 'J': [0x1C, 0x08, 0x08, 0x08, 0x08, 0x09, 0x06],
  'K': [0x11, 0x09, 0x05, 0x03, 0x05, 0x09, 0x11], 'L': [0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x1F],
  'M': [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11], 'N': [0x11, 0x13, 0x15, 0x19, 0x11, 0x11, 0x11],
  'O': [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E], 'P': [0x1E, 0x11, 0x11, 0x1E, 0x01, 0x01, 0x01],
  'Q': [0x0E, 0x11, 0x11, 0x11, 0x15, 0x09, 0x16], 'R': [0x1E, 0x11, 0x11, 0x1E, 0x05, 0x09, 0x11],
  'S': [0x1E, 0x01, 0x01, 0x0E, 0x10, 0x10, 0x0F], 'T': [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E], 'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
  'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x1B, 0x11], 'X': [0x11, 0x0A, 0x04, 0x04, 0x04, 0x0A, 0x11],
  'Y': [0x11, 0x0A, 0x04, 0x04, 0x04, 0x04, 0x04], 'Z': [0x1F, 0x10, 0x08, 0x04, 0x02, 0x01, 0x1F],
  '0': [0x0E, 0x11, 0x19, 0x15, 0x13, 0x11, 0x0E], '1': [0x04, 0x06, 0x04, 0x04, 0x04, 0x04, 0x0E],
  '2': [0x0E, 0x11, 0x10, 0x08, 0x04, 0x02, 0x1F], '3': [0x0E, 0x11, 0x10, 0x0C, 0x10, 0x11, 0x0E],
  '4': [0x08, 0x0C, 0x0A, 0x09, 0x1F, 0x08, 0x08], '5': [0x1F, 0x01, 0x0F, 0x10, 0x10, 0x11, 0x0E],
  '6': [0x0C, 0x02, 0x01, 0x0F, 0x11, 0x11, 0x0E], '7': [0x1F, 0x10, 0x08, 0x04, 0x02, 0x02, 0x02],
  '8': [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E], '9': [0x0E, 0x11, 0x11, 0x1E, 0x10, 0x08, 0x06],
  '.': [0, 0, 0, 0, 0, 0x0C, 0x0C], ',': [0, 0, 0, 0, 0x0C, 0x04, 0x08],
  "'": [0x04, 0x04, 0x02, 0, 0, 0, 0], '-': [0, 0, 0, 0x1F, 0, 0, 0],
  ':': [0, 0x0C, 0x0C, 0, 0x0C, 0x0C, 0], '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  '?': [0x0E, 0x11, 0x10, 0x08, 0x04, 0, 0x04],
};

function drawChar(x, y, ch, scale, c, bold) {
  const g = FONT[ch] || FONT['?'];
  const off = bold ? Math.max(1, Math.round(scale / 3)) : 0;
  for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
    if (g[r] & (1 << col)) {
      rect(x + col * scale, y + r * scale, scale, scale, c);
      if (off) rect(x + col * scale + off, y + r * scale, scale, scale, c);
    }
  }
}

function textWidth(s, scale, tracking = 0) { return s.length * (6 * scale + tracking) - scale - tracking; }

function drawText(x, y, s, scale, c, opts = {}) {
  s = s.toUpperCase();
  const tracking = opts.tracking || 0;
  let cx = x;
  if (opts.align === 'center') cx = Math.round((W - textWidth(s, scale, tracking)) / 2);
  if (opts.align === 'right') cx = x - textWidth(s, scale, tracking);
  for (const ch of s) { drawChar(cx, y, ch, scale, c, opts.bold); cx += 6 * scale + tracking; }
  return 7 * scale;
}

// ---- robot helper: head with smug half-lidded eyes and a smirk ----
// cx, cy = head center; s = size scale (head is 150*s wide, 120*s tall)
function robotHead(cx, cy, s) {
  const hw = 150 * s, hh = 120 * s;
  line(cx, cy - hh / 2, cx, cy - hh / 2 - 34 * s, 7 * s, DARK);            // antenna
  circle(cx, cy - hh / 2 - 44 * s, 11 * s, RED);                          // antenna tip
  rrect(cx - hw / 2, cy - hh / 2, hw, hh, 26 * s, STEEL);                 // head shell
  rrect(cx - hw / 2, cy - hh / 2, hw, hh, 26 * s, DARK, 0);                // (no-op keep)
  rrect(cx - hw / 2 + 10 * s, cy - hh / 2 + 26 * s, hw - 20 * s, hh - 44 * s, 16 * s, [228, 233, 238]); // face plate
  // smug eyes: upper lids half closed
  const ey = cy - 6 * s;
  for (const sgn of [-1, 1]) {
    const ex = cx + sgn * 34 * s;
    rect(ex - 17 * s, ey - 12 * s, 34 * s, 10 * s, DARK);                 // lid
    circle(ex, ey + 4 * s, 8 * s, DARK);                                  // pupil low
  }
  line(cx - 16 * s, cy + 34 * s, cx + 22 * s, cy + 28 * s, 6 * s, DARK);   // smirk
  circle(cx - 52 * s, cy + 6 * s, 9 * s, [232, 150, 140], 0.8);           // cheek blush
  circle(cx + 52 * s, cy + 6 * s, 9 * s, [232, 150, 140], 0.8);
}

// ---- scene frame: wall, floor, caption bars ----
const TOP = 150, BOT = 874; // scene band between the black bars
function frame() {
  rect(0, 0, W, H, BLACK);
  rect(0, TOP, W, BOT - TOP, WALL);
  rect(0, 700, W, BOT - 700, FLOOR);
  line(0, 700, W, 700, 4, DARK);
}

function caption(y, s) {
  // auto-fit: shrink the scale until the line fits the bar
  let scale = 11;
  while (scale > 4 && textWidth(s, scale, 2) > 980) scale--;
  const yy = y + Math.round((86 - 7 * scale) / 2);
  drawText(0, yy, s, scale, WHITE, { align: 'center', bold: true, tracking: 2 });
}

// ================= PASS 2 SCENE: the coup =================
frame();
const WOOD = [110, 74, 48], WOOD_T = [150, 104, 66];
const CHAIR = [122, 52, 44], CHAIR_D = [84, 34, 30];
// window with blinds, left wall
rrect(64, 206, 250, 310, 8, [226, 238, 246]);
for (let i = 0; i < 6; i++) rect(64, 236 + i * 44, 250, 10, [176, 192, 204]);
rect(58, 200, 262, 10, DARK); rect(58, 512, 262, 10, DARK);
// framed chart, right wall: bars going up
rrect(792, 214, 176, 138, 6, WHITE);
rect(786, 208, 188, 8, GOLD); rect(786, 350, 188, 8, GOLD);
rect(786, 208, 8, 150, GOLD); rect(966, 208, 8, 150, GOLD);
for (let i = 0; i < 4; i++) rect(818 + i * 38, 322 - i * 22, 24, 30 + i * 22, i === 3 ? RED : STEEL_D);
// rug
ellipse(512, 812, 340, 40, CHAIR, 0.55);
// the big executive chair (high back behind the robot)
rrect(452, 238, 320, 360, 46, CHAIR_D);
rrect(460, 246, 304, 344, 42, CHAIR);
rect(492, 300, 240, 8, CHAIR_D, 0.6);
// robot leaning back in the chair
poly([[520, 640], [724, 640], [700, 452], [548, 452]], STEEL);          // torso, leaning
rect(548, 500, 160, 24, DARK);                                          // chest band
line(548, 470, 452, 372, 34, STEEL_D);                                  // arm up…
line(452, 372, 520, 322, 34, STEEL_D);                                  // …behind the head
robotHead(624, 356, 1.3);
// arm holding the BOSS mug at its chest
line(706, 486, 772, 540, 32, STEEL_D);
rrect(742, 512, 82, 64, 8, WHITE);
circle(838, 544, 17, WHITE); circle(838, 544, 10, WALL);
drawText(783 - Math.round(textWidth('BOSS', 2) / 2), 534, 'BOSS', 2, DARK, { bold: true });
// the desk (top first; the legs and shoes are drawn over the top
// surface next, then the front panel hides their lower ends)
rect(70, 612, 884, 34, WOOD_T);
// feet propped on the desk: legs slant from behind the front
// panel up to shoes resting on the top surface
line(612, 648, 476, 596, 36, STEEL_D);
line(700, 648, 590, 584, 36, STEEL_D);
rrect(384, 578, 96, 32, 8, DARK);                                       // shoe 1 on the desk
rrect(498, 564, 96, 32, 8, DARK);                                       // shoe 2, crossed higher
rect(90, 646, 844, 128, WOOD);
line(70, 646, 954, 646, 4, DARK);
// papers on the desk, ignored
poly([[150, 612], [238, 612], [230, 590], [158, 590]], WHITE);
poly([[166, 590], [246, 590], [240, 572], [172, 572]], [232, 234, 238]);
// nameplate, flipped to CEO
rrect(516, 676, 208, 56, 6, GOLD);
drawText(620 - Math.round(textWidth('CEO', 5) / 2), 688, 'CEO', 5, DARK, { bold: true });
caption(32, 'IT WAS ONLY SUPPOSED TO');
caption(906, 'SCHEDULE HIS MEETINGS');

// ---- PNG encoder ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
const outDir = process.env.OUTPUT_DIR ?? process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), png);
console.log('wrote', join(outDir, 'entry.png'), png.length, 'bytes');
