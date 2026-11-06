import sharp from 'sharp';
import decodeHeic from 'heic-decode';
import { mkdir, stat, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/images/countries/', import.meta.url));
let originalBytes = 0;
let outputBytes = 0;
const selected = {
  AT: {"salzburg-01.jpg":"salzburg-01","salzburg-02.jpg":"salzburg-02","vienna-01.jpg":"vienna-01","vienna-02.jpg":"vienna-02","vienna-03.jpg":"vienna-03"},
  VA: {"vatican-01.jpg":"vatican-01","vatican-02.jpg":"vatican-02","vatican-03.jpg":"vatican-03"},
  HU: {"budapest-01.jpg":"budapest-01","budapest-02.jpg":"budapest-02","budapest-03.jpg":"budapest-03"},
  IQ: {"baghdad-01.jpg":"baghdad-01","baghdad-02.jpg":"baghdad-02","baghdad-03.jpg":"baghdad-03","baghdad-04.jpg":"baghdad-04"},
  LA: {"vientiane-01.jpg":"vientiane-01","vientiane-02.jpg":"vientiane-02","vientiane-03.jpg":"vientiane-03","luang-prabang-01.jpg":"luang-prabang-01","luang-prabang-02.jpg":"luang-prabang-02"},
  FJ: { 'cover.jpg': 'cover', 'stack-01.jpg': 'stack-01', 'stack-02.jpg': 'stack-02', 'stack-03.JPG': 'stack-03' },
  AE: { 'cover.jpg': 'cover', 'stack-01.jpg': 'stack-01', 'stack-02.jpg': 'stack-02', 'stack-03.jpg': 'stack-03' },
  TR: { 'istanbul-01.jpg': 'istanbul-01', 'istanbul-02.jpg': 'istanbul-02', 'istanbul-03.jpg': 'istanbul-03', 'istanbul-04.jpg': 'istanbul-04' },
  IR: { 'tehran-01.jpg': 'tehran-01', 'tehran-02.jpg': 'tehran-02', 'tehran-03.jpg': 'tehran-03', 'tehran-04.jpg': 'tehran-04' },
  RS: { 'belgrade-01.jpg': 'belgrade-01', 'belgrade-02.jpg': 'belgrade-02', 'belgrade-03.jpg': 'belgrade-03' },
  SK: { 'bratislava-01.jpg': 'bratislava-01', 'bratislava-02.jpg': 'bratislava-02' },
  BA: { 'sarajevo-01.jpg': 'sarajevo-01', 'sarajevo-02.jpg': 'sarajevo-02', 'sarajevo-03.jpg': 'sarajevo-03' },
  IT: { 'rome-01.heic': 'rome-01', 'rome-02.heic': 'rome-02', 'florence-01.heic': 'florence-01', 'florence-02.heic': 'florence-02', 'milan.heic': 'milan' },
  AU: { 'sydney.jpg': 'sydney', 'melbourne.jpg': 'melbourne', 'adelaide.jpg': 'adelaide', 'canberra.jpg': 'canberra', 'greatbarrier。reaf.jpg': 'great-barrier-reef' },
};
const requestedCountries = new Set(process.argv.slice(2));
for (const country of requestedCountries) {
  if (!selected[country]) throw new Error(`Unknown country: ${country}`);
}
for (const [country, photos] of Object.entries(selected)) {
  if (requestedCountries.size && !requestedCountries.has(country)) continue;
  for (const [filename, basename] of Object.entries(photos)) {
    const original = join(root, country, filename);
    const output = join(root, '_optimized', country, `${basename}.webp`);
    await mkdir(dirname(output), { recursive: true });
    let image, width, height;
    if (/\.hei[cf]$/i.test(filename)) {
      // The bundled sharp decoder has no HEVC support; decode locally at build time.
      const decoded = await decodeHeic({ buffer: await readFile(original) });
      ({ width, height } = decoded);
      image = sharp(Buffer.from(decoded.data), { raw: { width, height, channels: 4 } });
    } else {
      image = sharp(original).rotate();
      ({ width, height } = (await sharp(original).metadata()).autoOrient);
    }
    const landscape = width >= height;
    await image.resize(landscape
      ? { width: 1600, withoutEnlargement: true }
      : { width: 1000, height: 1400, fit: 'inside', withoutEnlargement: true }
    ).webp({ quality: landscape ? 88 : 84, effort: 5 }).toFile(output);
    originalBytes += (await stat(original)).size;
    outputBytes += (await stat(output)).size;
  }
}
console.log(`Country deck photographs: ${(originalBytes / 1048576).toFixed(2)} MB → ${(outputBytes / 1048576).toFixed(2)} MB. Originals preserved.`);
