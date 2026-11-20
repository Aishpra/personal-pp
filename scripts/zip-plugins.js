#!/usr/bin/env node
// Packages SiteKit's WordPress plugins as zip files, ready for Plugins -> Add New -> Upload
// on a client's live site:  npm run plugins:zip  ->  dist/plugins/<plugin>.zip
// Written in plain Node (zlib) so it works without a zip program installed.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'wordpress');
const OUT = path.join(ROOT, 'dist', 'plugins');
const PLUGINS = ['sitekit-contact-form', 'sitekit-motion', 'sitekit-seo'];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function* walk(dir, base = dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p, base);
    else yield [p, path.relative(base, p).split(path.sep).join('/')];
  }
}

// Minimal zip writer: deflated entries, a central directory, no extras.
function zip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  const dosTime = 0x0000, dosDate = 0x5a21; // fixed timestamp (2025-01-01) for reproducible zips
  for (const [name, data] of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
    head.writeUInt16LE(dosTime, 10); head.writeUInt16LE(dosDate, 12); head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(deflated.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(nameBuf.length, 26);
    local.push(head, nameBuf, deflated);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(dosTime, 12); cen.writeUInt16LE(dosDate, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(deflated.length, 20);
    cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += head.length + nameBuf.length + deflated.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cenBuf, end]);
}

fs.mkdirSync(OUT, { recursive: true });
for (const plugin of PLUGINS) {
  const dir = path.join(SRC, plugin);
  // WordPress expects the plugin's folder inside the zip.
  const files = [...walk(dir)].map(([p, rel]) => [`${plugin}/${rel}`, fs.readFileSync(p)]);
  const out = path.join(OUT, `${plugin}.zip`);
  fs.writeFileSync(out, zip(files));
  console.log(`${path.relative(ROOT, out)}  (${files.length} files, ${Math.round(fs.statSync(out).size / 1024)} KB)`);
}
console.log('\nOn the live site: Plugins -> Add New -> Upload Plugin, choose each zip, then Activate.');
