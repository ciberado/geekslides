/**
 * GeekSlides v2 — image optimizer.
 *
 * Port of v1's tools/imageoptimizer/index.js.
 * Uses sharp to resize and compress images for production builds.
 *
 * JPEG/JPG images are resized to at most 1920×1080 (preserving aspect ratio)
 * and re-encoded as progressive JPEG. All other file types are copied as-is.
 */

import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import sharp from 'sharp';

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const JPEG_QUALITY = 95;

export interface ImageEntry {
  src: string;
  alt?: string;
  sanitizedFileName?: string;
  error?: unknown;
}

/* ---------- single image ----------------------------------------------- */

/**
 * Optimize one image file.
 * JPEG files are resized (if larger than max dimensions) and re-encoded.
 * Other formats are copied unchanged.
 */
export async function optimizeImage(
  fileName: string,
  inputDirectory: string,
  outputDirectory: string,
): Promise<void> {
  const inputPath = join(inputDirectory, fileName);
  const outputPath = join(outputDirectory, fileName);

  if (!fileName.match(/\.(jpg|jpeg)$/i)) {
    await copyFile(inputPath, outputPath);
    return;
  }

  await sharp(inputPath)
    .resize(MAX_WIDTH, MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: JPEG_QUALITY,
      progressive: true,
      force: false,
    })
    .toFile(outputPath);
}

/* ---------- batch by manifest ------------------------------------------ */

/**
 * Optimize all images referenced in an array of ImageEntry records.
 * Entries without a `sanitizedFileName` are skipped.
 */
export async function optimizeImages(
  entries: ImageEntry[],
  inputDirectory: string,
  outputDirectory: string,
): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(
    entries
      .filter((e) => e.sanitizedFileName)
      .map((e) => optimizeImage(e.sanitizedFileName ?? '', inputDirectory, outputDirectory)),
  );
}

/**
 * Load a JSON manifest, optimize referenced images, and return the entries.
 */
export async function optimizeImagesFromManifest(
  manifestPath: string,
  inputDirectory: string,
  outputDirectory: string,
): Promise<ImageEntry[]> {
  const data = JSON.parse(await readFile(manifestPath, 'utf-8')) as ImageEntry[];
  await optimizeImages(data, inputDirectory, outputDirectory);
  return data;
}

/* ---------- batch by directory ----------------------------------------- */

/**
 * Optimize all image files in a directory, writing results to outputDirectory.
 * Processes all files found; non-JPEG files are copied unchanged.
 */
export async function optimizeDirectory(
  inputDirectory: string,
  outputDirectory: string,
): Promise<string[]> {
  await mkdir(outputDirectory, { recursive: true });
  const files = await readdir(inputDirectory);
  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
  const images = files.filter((f) => imageExts.has(extname(f).toLowerCase()));

  await Promise.all(images.map((f) => optimizeImage(f, inputDirectory, outputDirectory)));
  return images;
}
