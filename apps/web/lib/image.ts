// Client-side photo compression (UI-SPEC §4.11): long side ≤ 1600 px, WebP, ≤ 300 KB when the picture allows.
import { fitWithin } from "./listing";

const MAX_SIDE = 1600;
const MAX_BYTES = 300 * 1024;

const toBlob = (c: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob | null>((res) => {
    c.toBlob(res, type, q);
  });

/** Throws when the file isn't an image the browser can decode. */
export async function compressImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const { w, h } = fitWithin(bmp.width, bmp.height, MAX_SIDE);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")?.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  let best: Blob | null = null;
  for (const q of [0.85, 0.7, 0.55, 0.4]) {
    // A browser without WebP encoding answers with PNG; the server takes JPEG, PNG and WebP, so either is fine.
    const b = await toBlob(c, "image/webp", q);
    if (!b) continue;
    best = b;
    if (b.size <= MAX_BYTES) break;
  }
  if (!best) throw new Error("encode");
  return best;
}
