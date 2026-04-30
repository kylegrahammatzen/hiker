import { join } from "path";
import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";
import type { Trail } from "../src/lib/types";

const CONCURRENCY = 8;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

async function generateThumbHash(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;

    const input = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(input)
      .rotate()
      .resize(100, 100, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return toBase64(rgbaToThumbHash(info.width, info.height, data));
  } catch {
    return undefined;
  }
}

async function main() {
  const outputPath = join(import.meta.dir, "..", "src", "data", "trails.json");
  const trails = (await Bun.file(outputPath).json()) as Trail[];
  const images = trails.flatMap((trail) => trail.images ?? []);
  const missingUrls = [...new Set(images.filter((image) => !image.thumbHash).map((image) => image.url))];
  const hashes = new Map<string, string>();
  let nextIndex = 0;
  let completed = 0;

  console.log(`Generating ThumbHashes for ${missingUrls.length} image URLs...`);

  async function worker() {
    while (nextIndex < missingUrls.length) {
      const url = missingUrls[nextIndex++];
      if (!url) continue;

      const thumbHash = await generateThumbHash(url);
      completed += 1;

      if (thumbHash) hashes.set(url, thumbHash);

      if (completed % 100 === 0 || completed === missingUrls.length) {
        console.log(`  ${completed}/${missingUrls.length} processed, ${hashes.size} generated`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  let assigned = 0;
  for (const image of images) {
    const thumbHash = hashes.get(image.url);
    if (!image.thumbHash && thumbHash) {
      image.thumbHash = thumbHash;
      assigned += 1;
    }
  }

  await Bun.write(outputPath, JSON.stringify(trails, null, 2));

  console.log(`Assigned ${assigned} ThumbHashes`);
  console.log(`Written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
