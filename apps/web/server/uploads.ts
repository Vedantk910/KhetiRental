// Uploaded images live in the database (hosts like Vercel have no lasting disk). Type is sniffed from the bytes,
// not trusted from the client.
import { randomUUID } from "node:crypto";
import { getSql, one } from "./db";
import { ApiError } from "./http";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
type Ext = keyof typeof TYPES;
const NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

function sniff(b: Uint8Array): Ext | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

/** Saves an image and returns its URL path. */
export async function saveImage(file: unknown): Promise<string> {
  if (!(file instanceof File)) throw new ApiError(400, "file_type", "photo");
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "file_too_large", "photo");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniff(bytes);
  if (!ext) throw new ApiError(415, "file_type", "photo");
  const name = `${randomUUID()}.${ext}`;
  await getSql()`INSERT INTO uploads (name, type, bytes) VALUES (${name}, ${TYPES[ext]}, ${Buffer.from(bytes)})`;
  return `/api/uploads/${name}`;
}

/** Deletes an image saved by saveImage, given its url. Anything else (and a missing one) is ignored. */
export async function removeUpload(url: string) {
  const name = url.slice("/api/uploads/".length);
  if (url.startsWith("/api/uploads/") && NAME.test(name))
    await getSql()`DELETE FROM uploads WHERE name = ${name}`;
}

export async function readUpload(name: string) {
  if (!NAME.test(name)) throw new ApiError(404, "not_found");
  const f = one(
    await getSql()<{ bytes: Buffer; type: string }[]>`SELECT bytes, type FROM uploads WHERE name = ${name}`,
  );
  if (!f) throw new ApiError(404, "not_found");
  return f;
}

/** Multipart forms: bounded before parsing. */
export async function readForm(req: Request, maxBytes: number): Promise<FormData> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) throw new ApiError(413, "file_too_large");
  if (!req.headers.get("content-type")?.startsWith("multipart/form-data"))
    throw new ApiError(400, "invalid_request");
  try {
    return await req.formData();
  } catch {
    throw new ApiError(400, "invalid_request");
  }
}
