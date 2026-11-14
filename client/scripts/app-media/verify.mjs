#!/usr/bin/env node
// Verify the published media contract after capture and manifest generation.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(client, 'package.json'));
const ts = require('typescript');
const source = fs.readFileSync(path.join(client, 'src/content/appMedia.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const media = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const failures = [];
const counts = { screens: 0, gifs: 0, videos: 0, loops: 0 };
const check = (url) => {
  const file = path.join(client, 'public', url);
  if (!fs.existsSync(file) || !fs.statSync(file).size) failures.push(`Missing or empty: ${url}`);
  return file;
};
for (const [id, screen] of Object.entries(media.APP_SCREENS)) {
  for (const variant of screen.variants) { check(media.screenSrc(id, variant)); counts.screens++; }
}
for (const [id, variants] of Object.entries(media.APP_GIFS)) {
  for (const variant of variants) { check(media.gifSrc(id, variant)); counts.gifs++; }
}
for (const [id, video] of Object.entries(media.APP_VIDEOS)) {
  for (const variant of video.variants) {
    const src = media.videoSrc(id, variant);
    check(src.mp4); check(src.poster); counts.videos++;
  }
}
for (const [id, loop] of Object.entries(media.APP_LOOPS)) {
  for (const variant of loop.variants) {
    const src = media.loopSrc(id, variant);
    const file = check(src.mp4); check(src.webm); check(src.poster); check(media.gifSrc(id, variant));
    counts.loops++;
    if (!fs.existsSync(file) || !fs.statSync(file).size) continue;
    try {
      const info = JSON.parse(execFileSync(process.env.FFPROBE || 'ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }));
      const stream = info.streams.find(s => s.codec_type === 'video');
      if (!stream || stream.codec_name !== 'h264' || stream.width !== 720 || stream.height !== 1560 || stream.r_frame_rate !== '30/1' || stream.pix_fmt !== 'yuv420p') {
        failures.push(`Wrong portrait video format: ${src.mp4}`);
      }
      if (info.streams.some(s => s.codec_type === 'audio')) failures.push(`Unexpected audio: ${src.mp4}`);
      if (+info.format.size > 2_500_000) failures.push(`MP4 exceeds 2.5 MB: ${src.mp4}`);
      if (+info.format.duration <= 0) failures.push(`Empty duration: ${src.mp4}`);
    } catch (error) { failures.push(`Unreadable video: ${src.mp4}: ${error.message}`); }
  }
}
console.log(JSON.stringify({ counts, failures }, null, 2));
if (failures.length) process.exitCode = 1;
