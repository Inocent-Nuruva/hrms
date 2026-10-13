import Busboy from "busboy";
import { Readable } from "node:stream";
import sharp from "sharp";
import { z } from "zod";

import { backendUrl, ContractError, errorResponse, HttpError, readLimitedBody } from "@/lib/server/http";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { requireSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_FILE_BYTES + 16 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const TargetId = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().positive().safe());
const UploadResult = z.object({
  profile_photo_url: z.string().nullable().optional(),
  uploaded_profile_photo_url: z.string().nullable().optional(),
  approval_required: z.boolean().optional(),
  applied_immediately: z.boolean().optional(),
}).passthrough();

async function parseImage(request: Request): Promise<Buffer> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    throw new HttpError(415, "Send one image as multipart/form-data using the file field.");
  }
  // Check the incoming stream before retaining bytes. No unbounded request.formData().
  const bytes = await readLimitedBody(request, MAX_MULTIPART_BYTES);
  return new Promise<Buffer>((resolve, reject) => {
    let parser: ReturnType<typeof Busboy>;
    try {
      parser = Busboy({ headers: { "content-type": contentType }, limits: {
        files: 1, fields: 0, parts: 2, fileSize: MAX_FILE_BYTES,
        fieldNameSize: 100, headerPairs: 50,
      } });
    } catch {
      reject(new HttpError(400, "Invalid multipart boundary."));
      return;
    }
    const source = Readable.from([bytes]);
    const chunks: Buffer[] = [];
    let fileCount = 0;
    let fileBytes = 0;
    let failure: HttpError | null = null;
    const fail = (error: HttpError) => { failure ??= error; };
    parser.on("file", (field, stream, info) => {
      fileCount += 1;
      if (field !== "file" || !ACCEPTED_TYPES.has(info.mimeType)) {
        fail(new HttpError(415, "Upload a JPEG, PNG, WEBP, or GIF using the file field."));
      }
      if (info.encoding !== "7bit" && info.encoding !== "binary") {
        fail(new HttpError(415, "Encoded multipart files are not supported."));
      }
      stream.on("limit", () => fail(new HttpError(413, "Image must be smaller than 5 MB.")));
      stream.on("error", () => fail(new HttpError(400, "Invalid image stream.")));
      stream.on("data", (chunk: Buffer) => {
        if (chunk.length > MAX_FILE_BYTES - fileBytes) {
          fail(new HttpError(413, "Image must be smaller than 5 MB."));
          return;
        }
        fileBytes += chunk.length;
        if (!failure) chunks.push(chunk);
      });
    });
    parser.on("field", () => fail(new HttpError(400, "Unexpected multipart fields.")));
    parser.on("filesLimit", () => fail(new HttpError(400, "Upload exactly one image.")));
    parser.on("fieldsLimit", () => fail(new HttpError(400, "Unexpected multipart fields.")));
    parser.on("partsLimit", () => fail(new HttpError(400, "Upload exactly one file part.")));
    parser.on("error", () => {
      source.destroy();
      reject(new HttpError(400, "Invalid multipart image data."));
    });
    parser.on("close", () => {
      if (failure) reject(failure);
      else if (fileCount !== 1 || fileBytes === 0) reject(new HttpError(400, "Image file is required."));
      else resolve(Buffer.concat(chunks, fileBytes));
    });
    source.on("error", () => {
      parser.destroy();
      reject(new HttpError(400, "Could not read the image stream."));
    });
    source.pipe(parser);
  });
}

async function verifiedImage(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = await parseImage(request);
  try {
    // Decode actual raster bytes, bound decompression, flatten animation, strip metadata.
    const image = sharp(bytes, { limitInputPixels: 20_000_000, animated: false, failOn: "warning" });
    const metadata = await image.metadata();
    if (!metadata.format || !["jpeg", "png", "webp", "gif"].includes(metadata.format)) {
      throw new HttpError(415, "Unsupported image content.");
    }
    const sanitized = await image.rotate().resize({ width: 1_024, height: 1_024,
      fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).timeout({ seconds: 5 }).toBuffer();
    if (!sanitized.length || sanitized.length > MAX_FILE_BYTES) {
      throw new HttpError(413, "The processed image exceeds the upload limit.");
    }
    return Uint8Array.from(sanitized);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "The file is not a valid supported image.");
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    // Authentication and target authorization happen before consuming a single body byte.
    const actor = await requireSession(request);
    if (actor.scope !== "company" || !actor.companyId) {
      throw new HttpError(403, "Select an authorized company before uploading a profile image.");
    }
    const values = new URL(request.url).searchParams;
    if ([...values.keys()].some((key) => key !== "employeeId") || values.getAll("employeeId").length > 1) {
      throw new HttpError(400, "Invalid upload target.");
    }
    const rawTarget = values.get("employeeId");
    const parsedTarget = rawTarget === null ? null : TargetId.safeParse(rawTarget);
    if (parsedTarget && !parsedTarget.success) throw new HttpError(400, "Invalid employee ID.");
    const employeeId = parsedTarget?.success ? parsedTarget.data : actor.employeeId;
    const ownsProfile = employeeId === undefined || employeeId === actor.employeeId;
    // Live server metadata AND explicit capability; dashboard type alone is insufficient.
    const canManageProfiles = actor.dashboardType === "admin" && actor.permissions.includes("employees:update");
    if (!ownsProfile && !canManageProfiles) throw new HttpError(403, "You cannot upload a photo for this profile.");
    await enforceRateLimit({ name: "profile-photo", perMinute: 3, perDay: 30,
      globalPerMinute: 30, globalPerDay: 1_000 }, `user:${actor.id}:company:${actor.companyId}`);
    const file = await verifiedImage(request);
    const targetPath = !ownsProfile
      ? `/api/employees/${employeeId}/profile-photo`
      : actor.employeeId ? "/api/me/profile/photo" : "/api/users/me/profile-photo";
    const destination = backendUrl(targetPath);
    const form = new FormData();
    form.set("file", new Blob([file], { type: "image/webp" }), "profile-photo.webp");
    const response = await fetch(destination, {
      method: "POST",
      headers: { Authorization: `Bearer ${actor.accessToken}` },
      body: form,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
    });
    if (!response.ok) {
      await response.body?.cancel();
      const status = [400, 401, 403, 404, 409, 413, 415, 429].includes(response.status) ? response.status : 502;
      throw new HttpError(status, "The profile service could not accept this upload.");
    }
    let payload: unknown;
    try {
      const responseBytes = await readLimitedBody(new Request("http://internal/upload-result", {
        method: "POST", body: response.body, duplex: "half", signal: request.signal,
      } as RequestInit & { duplex: "half" }), 1_048_576);
      payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(responseBytes));
    } catch {
      throw new ContractError("The upload service returned an invalid response.");
    }
    const result = UploadResult.safeParse(payload);
    if (!result.success) throw new ContractError("The upload service returned an invalid response.");
    const photoPath = result.data.uploaded_profile_photo_url ?? result.data.profile_photo_url;
    if (!photoPath && result.data.approval_required !== true) {
      throw new ContractError("The upload service did not return a photo or an approval request.");
    }
    let url: string | null = null;
    if (photoPath) {
      const resolved = new URL(photoPath, destination.origin);
      if (!['http:', 'https:'].includes(resolved.protocol) || resolved.origin !== destination.origin || !resolved.pathname.startsWith("/uploads/")) {
        throw new ContractError("The upload service returned an invalid media location.");
      }
      url = new URL(`${resolved.pathname}${resolved.search}`, new URL(request.url).origin).toString();
    }
    return Response.json({ ...result.data, url }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = errorResponse(error);
    if (error instanceof RateLimitError) response.headers.set("Retry-After", String(error.retryAfterSeconds));
    return response;
  }
}
