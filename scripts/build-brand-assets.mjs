// Turns the hand-made illustration PNGs in icon/アイコン into web assets:
//   public/brand/<name>.png   256px, background knocked out to alpha
//   public/brand/logo-tile.png 192px, the app tile as drawn (opaque)
//   public/icons/*            PWA / Apple / favicon icons built from the logo
//
// Run with: node scripts/build-brand-assets.mjs
// Idempotent; commit the outputs. Source PNGs are opaque (no alpha channel)
// on an off-white ground with soft drop shadows, so the knock-out is done on
// distance-from-white rather than a chroma key.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'icon', 'アイコン');
const OUT = path.join(ROOT, 'public', 'brand');
const ICONS = path.join(ROOT, 'public', 'icons');

// Source file -> asset name. Names are what components/brand/illustration.tsx
// expects; keep them in sync.
const FILES = {
  'Add set.png': 'add-set',
  'Calender.png': 'calendar',
  'Coach.png': 'coach',
  'Complete.png': 'complete',
  'Delate.png': 'delete',
  'Edit.png': 'edit',
  'History.png': 'history',
  'Home.png': 'home',
  'Icon LOGO.png': 'logo',
  'Notes.png': 'notes',
  'Notification.png': 'notification',
  'PR.png': 'pr',
  'Profile.png': 'profile',
  'Program.png': 'program',
  'Progress.png': 'progress',
  'Recovery.png': 'recovery',
  'RestTime.png': 'rest-time',
  'Search.png': 'search',
  'Setting.png': 'setting',
  'Stats.png': 'stats',
  'Timer.png': 'timer',
  'Workout.png': 'workout',
};

const SIZE = 256;
const MARGIN = 0.08;

// Alpha from distance to white: the off-white ground (~10 away), the tile
// (~8) and the soft shadow (<= 55) drop out; navy, lime and their anti-aliased
// edges survive. Returns a transparent, tightly cropped, square RGBA buffer.
async function knockOut(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const dist = 255 - Math.min(r, g, b);
      const alpha = Math.max(0, Math.min(255, (dist - 60) * 5));
      data[i + 3] = alpha;
      if (alpha > 160) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error(`nothing left after knock-out: ${file}`);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const side = Math.ceil(Math.max(w, h) * (1 + MARGIN * 2));
  const left = Math.max(0, minX - Math.floor((side - w) / 2));
  const top = Math.max(0, minY - Math.floor((side - h) / 2));
  const extractW = Math.min(side, width - left);
  const extractH = Math.min(side, height - top);
  return sharp(data, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: extractW, height: extractH })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: false });
}

// The logo as drawn: the rounded tile itself, without the page shadow. Finds
// the tile by its own edge (anything darker than the near-white page).
async function logoTile(file, size) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const dist = 255 - Math.min(data[i], data[i + 1], data[i + 2]);
      if (dist > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  // Grow the glyph box to the tile: the tile is centred on the glyph and about
  // 2.1x its width in the source art.
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const half = Math.round(((maxX - minX) * 1.18) / 2 + 40);
  const left = Math.max(0, Math.round(cx - half));
  const top = Math.max(0, Math.round(cy - half));
  const side = Math.min(half * 2, width - left, height - top);
  return sharp(file).extract({ left, top, width: side, height: side }).resize(size, size).png();
}

// App icon: brand ground, glyph centred at `scale` of the canvas.
async function appIcon(glyph, size, scale) {
  const inner = Math.round(size * scale);
  const glyphBuf = await sharp(glyph).resize(inner, inner).png().toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: '#F7F8F5' },
  })
    .composite([{ input: glyphBuf, gravity: 'centre' }])
    .png();
}

mkdirSync(OUT, { recursive: true });
mkdirSync(ICONS, { recursive: true });

for (const [file, name] of Object.entries(FILES)) {
  const src = path.join(SRC, file);
  const out = path.join(OUT, `${name}.png`);
  const buf = await (await knockOut(src)).toBuffer();
  writeFileSync(out, buf);
  console.log(`${name}.png ${(buf.length / 1024).toFixed(1)} KB`);
}

const logoSrc = path.join(SRC, 'Icon LOGO.png');
writeFileSync(path.join(OUT, 'logo-tile.png'), await (await logoTile(logoSrc, 192)).toBuffer());

const logoGlyph = path.join(OUT, 'logo.png');
for (const [file, size, scale] of [
  ['icon-192.png', 192, 0.72],
  ['icon-512.png', 512, 0.72],
  ['icon-maskable-512.png', 512, 0.56],
  ['apple-touch-icon.png', 180, 0.72],
]) {
  writeFileSync(path.join(ICONS, file), await (await appIcon(logoGlyph, size, scale)).toBuffer());
}
writeFileSync(
  path.join(ROOT, 'app', 'icon.png'),
  await sharp(logoGlyph).resize(64, 64).png().toBuffer(),
);
console.log(
  'icons written; logo-tile',
  readFileSync(path.join(OUT, 'logo-tile.png')).length,
  'bytes',
);
