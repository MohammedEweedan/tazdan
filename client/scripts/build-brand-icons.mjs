import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const web = path.join(root, "public");
const mobile = path.resolve(root, "../mobile/assets");
const source = await readFile(path.join(web, "tazdan-mark.svg"), "utf8");
const accent = "#63A1DB";
const charcoal = "#16181C";
const ivory = "#FFF8F0";

function mark(color) {
  return source.replaceAll(accent, color);
}

function iconSvg(size, color, background, scale = 0.69) {
  const inset = (1 - scale) * size / 2;
  const markBody = mark(color)
    .replace(/<svg[^>]*>/, "")
    .replace("</svg>", "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${background ? `<rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="${background}"/>` : ""}<g transform="translate(${inset} ${inset}) scale(${size * scale / 100})">${markBody}</g></svg>`;
}

async function png(dest, svg, size) {
  const buffer = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  await writeFile(dest, buffer);
  return buffer;
}

// Keep the legacy filenames: existing app screens refer to them directly.
await writeFile(path.join(web, "icon-asterisk.svg"), mark(accent));
for (const [name, color] of [["icon-color", accent], ["icon", accent], ["icon-asterisk", accent], ["icon-black", charcoal], ["icon-white", ivory], ["icon-asterisk-black", charcoal], ["icon-asterisk-white", ivory]]) {
  await png(path.join(web, `${name}.png`), iconSvg(725, color, null, 0.86), 725);
}
for (const [name, color] of [["icon", accent], ["icon-black", charcoal], ["icon-white", ivory]]) {
  await png(path.resolve(root, `${name}.png`), iconSvg(725, color, null, 0.86), 725);
}

const ios = iconSvg(1024, accent, charcoal);
for (const size of [72, 96, 128, 144, 152, 192, 384, 512]) {
  await png(path.join(web, "icons", `icon-${size}x${size}.png`), ios, size);
}
await png(path.join(web, "apple-touch-icon.png"), ios, 180);
await png(path.join(web, "adaptive-icon.png"), iconSvg(1024, accent, null, 0.54), 1024);
await png(path.join(web, "splash.png"), iconSvg(1024, ivory, null, 0.86), 1024);
await writeFile(path.join(web, "icon.gif"), await sharp(Buffer.from(iconSvg(512, accent, null, 0.86))).resize(512, 512).gif().toBuffer());

const faviconSizes = [16, 32, 48, 64, 128, 256];
const images = await Promise.all(faviconSizes.map(size => sharp(Buffer.from(ios)).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
for (let i = 0; i < images.length; i++) {
  const entry = 6 + i * 16;
  header.writeUInt8(faviconSizes[i] === 256 ? 0 : faviconSizes[i], entry);
  header.writeUInt8(faviconSizes[i] === 256 ? 0 : faviconSizes[i], entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(images[i].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += images[i].length;
}
await writeFile(path.join(web, "favicon.ico"), Buffer.concat([header, ...images]));

for (const [name, color] of [["icon-asterisk", accent], ["icon-asterisk-black", charcoal], ["icon-asterisk-white", ivory]]) {
  await png(path.join(mobile, `${name}.png`), iconSvg(288, color, null, 0.86), 288);
}
for (const [name, color, background] of [
  ["icon", accent, charcoal], ["icon-color", accent, null],
  ["icon-black", charcoal, null], ["icon-white", ivory, null],
  ["favicon", accent, charcoal], ["adaptive-icon", accent, null],
]) {
  await png(path.join(mobile, `${name}.png`), iconSvg(1024, color, background, name === "adaptive-icon" ? 0.54 : 0.69), 1024);
}
await png(path.join(mobile, "icon-ios.png"), ios, 1254);
await png(path.join(mobile, "splash.png"), iconSvg(1024, ivory, null, 0.86), 1024);

console.log("Built wallet mark variants for web and mobile.");
