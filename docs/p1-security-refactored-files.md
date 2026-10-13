# Complete P1 security refactors

All four requested files are implemented in the workspace and reproduced below in full, followed by the three concrete server helpers. No placeholder functions are required. The new helpers were necessary because `requireSession` and `ContractError` did not exist in this checkout.

## Deployment and API contract

- Deploy the frontend and backend changes together. The backend now exposes authenticated `GET /api/auth/session` for live, verified actor snapshots and `POST /api/employees/:id/profile-photo` for admins with `employees:update`. Existing self-photo engines and employee approval policies remain authoritative.
- Configure `BACKEND_ORIGIN` with the actual backend HTTP(S) origin. The server helper resolves it separately from browser relative API configuration.
- Configure `RATE_LIMIT_REDIS_REST_URL` and `RATE_LIMIT_REDIS_REST_TOKEN` for a shared Redis REST service that supports `EVAL`. Production intentionally returns 503 before reading uploads/calling AI when shared quotas are absent or unavailable. No new credentials were provisioned or real provider calls made.
- Set `RATE_LIMIT_TRUSTED_IP_HEADER` only if your trusted ingress strips and replaces incoming copies. Without it, public callers deliberately share the anonymous quota. Never trust arbitrary client-supplied forwarded IP headers.
- Upload one multipart `file`. The optional query parameter `employeeId` targets an employee; the caller must own that profile or have verified admin metadata plus `employees:update`. Without a target, the actor's own employee/account photo engine is selected. Body target fields are rejected, so multipart field order cannot affect authorization.
- Cookie-authenticated uploads require a matching Origin. Non-browser clients can send an explicit bearer Authorization header.
- Uploads are read through a byte-counted, deadline-bound reader before parsing. The multipart body is bounded to 5 MB + 16 KB overhead; the file is bounded to 5 MB. Checks occur before retaining incoming chunks. Sharp decodes actual image content under a 20-million-pixel bound, strips metadata, flattens animations, fits within 1024×1024, and re-encodes WEBP. Only verified multipart data is forwarded to authenticated backend storage; Next writes no local media files.
- Chat accepts 1–12 messages, each at most 4000 characters, ending in a user message. Provider output is capped at 1024 tokens, the provider deadline is 15 seconds, and the displayed answer is capped at 4000 characters. The widget now strips UI-only link metadata and sends at most the last 12 messages.
- Atomic chat quotas: 6 requests/minute and 100/day per public identity; 30/minute and 1000/day globally. Photo quotas: 3/minute and 30/day per verified user/company; 30/minute and 1000/day globally. Policy constants are explicit in the routes. Failed provider attempts still consume quota.
- Finance request DTOs validate strict unsigned decimal strings and integral 1–600-month terms. Internal money arithmetic still supports negative balances, exact BigInt cents, and null/undefined optional values as zero. Empty strings, invalid decimals, nonfinite numbers, exponent notation, and extra fractional digits yield handled 400 exceptions.
- Added explicit `busboy`, `sharp`, and `@types/busboy` dependencies and deployment settings in `.env.example`.

## Verification

- Frontend: 72 Vitest files, 474 tests passed.
- Backend: finance boundary validation plus existing finance lifecycle suite, 66 tests passed.
- Frontend and backend TypeScript checks passed.
- Focused frontend/backend ESLint and Git whitespace checks passed.
- Real isolated local Redis Lua check: 12 parallel attempts, exactly 6 allowed and 6 denied, both caller/global counters equal 6.
- No live database upload journey, Redis REST deployment, or paid AI provider invocation was run. Deployment credentials are still required.

## /home/innocent/systems/hrms/src/app/api/profile-photo-upload/route.ts

```typescript
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
      if (!['http:', 'https:'].includes(resolved.protocol) || resolved.origin !== destination.origin) {
        throw new ContractError("The upload service returned an invalid media location.");
      }
      url = resolved.toString();
    }
    return Response.json({ ...result.data, url }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = errorResponse(error);
    if (error instanceof RateLimitError) response.headers.set("Retry-After", String(error.retryAfterSeconds));
    return response;
  }
}
```

## /home/innocent/systems/hrms/src/app/api/support/chat/route.ts

```typescript
import { z } from "zod";

import { findSupportPages, localSupportAnswer, SUPPORT_KNOWLEDGE } from "@/lib/support-knowledge";
import { ContractError, HttpError, readLimitedBody } from "@/lib/server/http";
import { withRateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ChatBody = z.strictObject({
  messages: z.array(z.strictObject({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(4_000).trim().min(1),
  })).min(1).max(12).refine((messages) => messages.at(-1)?.role === "user", {
    message: "The last message must be a user question.",
  }),
  accessMode: z.enum(["admin", "employee"]).optional(),
});

const ProviderReply = z.object({
  output_text: z.string().max(32_000).optional(),
  output: z.array(z.object({
    content: z.array(z.object({ text: z.string().max(32_000).optional() }).passthrough()).max(32).optional(),
  }).passthrough()).max(32).optional(),
}).passthrough();

function readText(payload: unknown): string {
  const parsed = ProviderReply.safeParse(payload);
  if (!parsed.success) throw new ContractError("The assistant returned an invalid response.");
  const direct = parsed.data.output_text?.trim();
  if (direct) return direct;
  const parts = (parsed.data.output ?? []).flatMap((item) =>
    (item.content ?? []).map((block) => block.text?.trim() ?? "").filter(Boolean));
  const text = parts.join("\n");
  if (text.length > 32_000) throw new ContractError("The assistant response exceeds the supported length.");
  return text;
}

async function chat(request: Request): Promise<Response> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new HttpError(415, "Send a JSON question.");
  }
  const bytes = await readLimitedBody(request, 320_000);
  let body: unknown;
  try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, "Send valid JSON containing a question."); }
  const parsed = ChatBody.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, "Send 1–12 messages, each containing 1–4,000 characters, ending with a user question.");
  }
  const { messages: history, accessMode } = parsed.data;
  const userTurns = history.filter((entry) => entry.role === "user");
  const question = userTurns.at(-1)!.content;
  const previousQuestion = userTurns.at(-2)?.content ?? "";
  // accessMode only filters public guide links; it never grants authorization.
  const local = localSupportAnswer(question, previousQuestion, accessMode);
  const guide = () => Response.json({ ...local, source: "guide" }, {
    headers: { "Cache-Control": "no-store" },
  });
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) return guide();
  try {
    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-4.5",
        store: false,
        max_output_tokens: 1_024,
        input: [
          { role: "system", content: SUPPORT_KNOWLEDGE },
          ...history,
        ],
      }),
      // A strict provider deadline also aborts response body consumption.
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      return guide();
    }
    const replyBytes = await readLimitedBody(new Request("http://internal/assistant", {
      method: "POST", body: response.body, duplex: "half", signal: request.signal,
    } as RequestInit & { duplex: "half" }), 256_000);
    const payload: unknown = JSON.parse(new TextDecoder().decode(replyBytes));
    const reply = readText(payload).slice(0, 4_000);
    if (!reply) return guide();
    const links = findSupportPages(`${previousQuestion} ${question} ${reply}`, 4, accessMode)
      .map((page) => ({ title: page.title, url: page.url }));
    return Response.json({ reply, links, source: "assistant" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    // Quota was already consumed; provider errors are never retried automatically.
    return guide();
  }
}

export const POST = withRateLimit({
  name: "support-chat",
  perMinute: 6,
  perDay: 100,
  globalPerMinute: 30,
  globalPerDay: 1_000,
}, chat);
```

## /home/innocent/systems/hrms_backend/src/modules/hr/employee-finance/dto/employee-finance.dto.ts

```typescript
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsInt,
  Matches,
  Max,
  MaxLength,
  Min,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { Base64FileDto } from '../../../files/dtos/base64-file.dto';
import {
  EmployeeFinanceApprovalStageEnum,
  EmployeeFinanceInterestMethodEnum,
  EmployeeFinanceProductTypeEnum,
} from '../employee-finance.enums';

export class EmployeeFinanceQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  employee_id?: number;

  @IsOptional()
  @Type(() => Number)
  product_id?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsString()
  entity_type?: string;

  @IsOptional()
  @IsString()
  entity_id?: string;
}

export class CreateEmployeeFinanceProductDto {
  @IsEnum(EmployeeFinanceProductTypeEnum)
  product_type: EmployeeFinanceProductTypeEnum;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(EmployeeFinanceInterestMethodEnum)
  interest_method?: EmployeeFinanceInterestMethodEnum;

  @IsOptional()
  @IsString()
  annual_interest_rate?: string;

  @IsString()
  minimum_amount: string;

  @IsOptional()
  @IsString()
  maximum_amount?: string;

  @IsOptional()
  @IsString()
  maximum_salary_multiple?: string;

  @IsOptional()
  @Type(() => Number)
  minimum_term_months?: number;

  @Type(() => Number)
  @IsNumber()
  maximum_term_months: number;

  @IsOptional()
  @Type(() => Number)
  minimum_service_months?: number;

  @IsOptional()
  @IsString()
  maximum_installment_percentage?: string;

  @IsOptional()
  @Type(() => Number)
  maximum_active_accounts?: number;

  @IsOptional()
  @IsBoolean()
  requires_confirmation?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_during_probation?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_rescheduling?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_deferment?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_early_settlement?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_additional_repayment?: boolean;

  @IsOptional()
  @IsArray()
  required_document_types?: string[];

  @IsOptional()
  eligibility_configuration?: Record<string, unknown>;

  @IsOptional()
  approval_configuration?: Record<string, unknown>;

  @IsDateString()
  effective_from: string;

  @IsOptional()
  @IsDateString()
  effective_to?: string;
}

export class EvaluateEmployeeFinanceEligibilityDto {
  @Type(() => Number)
  @IsNumber()
  employee_id: number;

  @Type(() => Number)
  @IsNumber()
  product_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/)
  requested_amount?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  requested_term_months?: number;
}

export class EvaluateMyEmployeeFinanceEligibilityDto {
  @Type(() => Number)
  @IsNumber()
  product_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/)
  requested_amount?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  requested_term_months?: number;
}

export class CreateEmployeeFinanceApplicationDto {
  @Type(() => Number)
  @IsNumber()
  product_id: number;

  @IsString()
  @MaxLength(18)
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/)
  requested_amount: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  requested_term_months: number;

  @IsString()
  purpose: string;
}

export class CreateEmployeeFinanceApplicationDocumentDto {
  @IsString()
  document_type: string;

  @IsOptional()
  @Type(() => Number)
  document_id?: number;

  @IsOptional()
  @IsString()
  file_url?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UploadEmployeeFinanceApplicationDocumentDto {
  @IsString()
  document_type: string;

  @Type(() => Base64FileDto)
  file: Base64FileDto;

  @IsOptional()
  @IsDateString()
  expires_on?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class VerifyEmployeeFinanceApplicationDocumentDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class CreateEmployeeFinanceGuarantorDto {
  @Type(() => Number)
  @IsNumber()
  guarantor_employee_id: number;
}

export class DecideEmployeeFinanceGuarantorDto {
  @IsString()
  decision: string;

  @IsOptional()
  @IsString()
  comments?: string;
}

export class ApproveEmployeeFinanceApplicationDto {
  @IsEnum(EmployeeFinanceApprovalStageEnum)
  stage: EmployeeFinanceApprovalStageEnum;

  @IsString()
  snapshot_hash: string;

  @IsOptional()
  @IsString()
  approved_amount?: string;

  @IsOptional()
  @Type(() => Number)
  approved_term_months?: number;

  @IsOptional()
  @IsString()
  comments?: string;
}

export class CreateEmployeeFinanceDisbursementDto {
  @Type(() => Number)
  @IsNumber()
  account_id: number;

  @IsString()
  amount: string;

  @IsString()
  payment_reference: string;

  @IsDateString()
  payment_date: string;
}

export class CreateEmployeeFinanceRepaymentDto {
  @Type(() => Number)
  @IsNumber()
  account_id: number;

  @IsString()
  amount: string;

  @IsOptional()
  @IsString()
  payment_reference?: string;

  @IsDateString()
  payment_date: string;

  @IsOptional()
  @IsString()
  repayment_type?: string;
}

export class RequestEmployeeFinanceDefermentDto {
  @Type(() => Number)
  @IsNumber()
  installment_id: number;

  @IsString()
  reason: string;
}

export class RequestEmployeeFinanceRescheduleDto {
  @Type(() => Number)
  @IsNumber()
  new_term_months: number;

  @IsString()
  reason: string;
}

export class ImportEmployeeFinancePaymentFileDto {
  @Type(() => Base64FileDto)
  file: Base64FileDto;

  @IsOptional()
  @IsBoolean()
  dry_run?: boolean;
}

export class PostEmployeeFinanceAccountingDto {
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsBoolean()
  dry_run?: boolean;
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/employee-finance/services/employee-finance-money.util.ts

```typescript
import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';

export class EmployeeFinanceMoney {
  private static decimalOf(value: string | number | null | undefined): Decimal {
    if (value === null || value === undefined || value === '')
      return new Decimal(0);
    return new Decimal(String(value).trim() || '0');
  }

  private static fromDecimal(value: Decimal): string {
    return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  }

  static toCents(value: string | number | null | undefined): bigint {
    // Optional persisted monetary fields retain their established zero default.
    if (value === null || value === undefined) return 0n;
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new BadRequestException(
        'Money must be a decimal string or a finite number.',
      );
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new BadRequestException('Money must be finite.');
    }
    const raw = String(value);
    // Internal arithmetic may produce negative balances; request DTOs disallow them.
    // Never silently truncate excess decimal places or accept exponent notation.
    if (raw.length > 64 || !/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw)) {
      throw new BadRequestException(
        'Money must use a decimal format with at most two fractional digits.',
      );
    }
    try {
      const sign = raw.startsWith('-') ? -1n : 1n;
      const [whole, fraction = ''] = raw.replace(/^-/, '').split('.');
      const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
      // Numeric callers must not pass amounts whose integer cents lose precision.
      if (
        typeof value === 'number' &&
        cents > BigInt(Number.MAX_SAFE_INTEGER)
      ) {
        throw new BadRequestException(
          'Large monetary values must be provided as decimal strings.',
        );
      }
      return sign * cents;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Invalid monetary value.');
    }
  }

  static fromCents(cents: bigint): string {
    const sign = cents < 0n ? '-' : '';
    const absolute = cents < 0n ? -cents : cents;
    return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
  }

  static add(...values: Array<string | number | null | undefined>) {
    return this.fromCents(
      values.reduce((sum, value) => sum + this.toCents(value), 0n),
    );
  }

  static subtract(left: string | number, right: string | number) {
    return this.fromCents(this.toCents(left) - this.toCents(right));
  }

  static multiply(value: string | number, factor: string | number) {
    return this.fromDecimal(
      this.decimalOf(value).times(this.decimalOf(factor)),
    );
  }

  static multiplyPercent(value: string | number, percent: string | number) {
    return this.fromDecimal(
      this.decimalOf(value).times(this.decimalOf(percent)).div(100),
    );
  }

  static multiplyRatio(
    value: string | number,
    numerator: number | bigint,
    denominator: number | bigint,
  ) {
    const resolvedDenominator = BigInt(denominator);

    if (resolvedDenominator <= 0n) return '0.00';

    return this.fromDecimal(
      this.decimalOf(value)
        .times(String(numerator))
        .div(String(resolvedDenominator)),
    );
  }

  static divide(value: string | number, divisor: number) {
    if (divisor <= 0) return '0.00';
    return this.fromDecimal(this.decimalOf(value).div(divisor));
  }

  static min(left: string | number, right: string | number) {
    const leftCents = this.toCents(left);
    const rightCents = this.toCents(right);
    return this.fromCents(leftCents < rightCents ? leftCents : rightCents);
  }
}
```

## /home/innocent/systems/hrms/src/lib/server/http.ts

```typescript
export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export class ContractError extends HttpError {
  constructor(message: string) {
    super(502, message);
    this.name = "ContractError";
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, {
      status: error.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")) {
    return Response.json({ error: "The request timed out or was cancelled." }, {
      status: error.name === "TimeoutError" ? 504 : 408,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return Response.json({ error: "The service is temporarily unavailable." }, {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export function backendUrl(path: string): URL {
  const configured = process.env.BACKEND_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const origin = !configured || configured === "/api"
    ? process.env.APP_ENV === "uat" ? "http://127.0.0.1:9999" : "http://127.0.0.1:8888"
    : configured;
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new HttpError(503, "The backend origin is not configured correctly.");
  }
  const url = new URL(path, base.origin);
  if (!path.startsWith("/api/") || url.origin !== base.origin) {
    throw new HttpError(503, "The backend path is not configured correctly.");
  }
  return url;
}

/** Checks actual bytes before retaining each chunk; Content-Length is only an early rejection. */
export async function readLimitedBody(
  request: Request, maxBytes: number, timeoutMs = 15_000,
): Promise<Uint8Array<ArrayBuffer>> {
  const length = request.headers.get("content-length");
  if (length !== null) {
    if (!/^\d+$/.test(length)) throw new HttpError(400, "Invalid content length.");
    if (Number(length) > maxBytes) throw new HttpError(413, "Request body is too large.");
  }
  if (request.headers.get("content-encoding") &&
      request.headers.get("content-encoding")?.toLowerCase() !== "identity") {
    throw new HttpError(415, "Compressed request bodies are not supported.");
  }
  if (!request.body) throw new HttpError(400, "Request body is required.");
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]);
  signal.throwIfAborted();
  const reader = request.body.getReader();
  const cancel = () => { void reader.cancel(signal.reason).catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      if (value.byteLength > maxBytes - size) {
        await reader.cancel().catch(() => undefined);
        throw new HttpError(413, "Request body is too large.");
      }
      size += value.byteLength;
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
```

## /home/innocent/systems/hrms/src/lib/server/session.ts

```typescript
import { z } from "zod";
import { backendUrl, ContractError, HttpError, readLimitedBody } from "./http";

const Snapshot = z.object({
  id: z.number().int().positive().safe(),
  companyId: z.number().int().positive().safe().optional(),
  employeeId: z.number().int().positive().safe().optional(),
  scope: z.enum(["platform", "company"]),
  userType: z.enum(["OWNER", "COMPANY_USER"]),
  dashboardType: z.enum(["admin", "employee"]).optional(),
  roles: z.array(z.string()).max(1_000),
  permissions: z.array(z.string()).max(10_000),
});

export type ServerSession = z.infer<typeof Snapshot> & { accessToken: string };

/** Uses the live Nest JWT/session guard. Never trusts decoded JWTs or browser actor metadata. */
export async function requireSession(request: Request): Promise<ServerSession> {
  const authorization = request.headers.get("authorization");
  let token: string;
  if (authorization !== null) {
    const match = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(authorization);
    if (!match) throw new HttpError(401, "A valid bearer session is required.");
    token = match[1];
  } else {
    // Cookie-authenticated mutations require the browser's same-origin provenance.
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      throw new HttpError(403, "A same-origin request is required.");
    }
    const cookie = request.headers.get("cookie")?.split(";")
      .map((entry) => entry.trim()).find((entry) => entry.startsWith("hrms_dashboard_token="));
    try { token = cookie ? decodeURIComponent(cookie.slice("hrms_dashboard_token=".length)) : ""; }
    catch { throw new HttpError(401, "A valid session is required."); }
  }
  if (!token || token.length > 16_384) throw new HttpError(401, "Sign in to continue.");
  const response = await fetch(backendUrl("/api/auth/session"), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
  });
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(response.status, "Your session does not authorize this request.");
    }
    throw new HttpError(503, "Session verification is temporarily unavailable.");
  }
  const bytes = await readLimitedBody(new Request("http://internal/session", {
    method: "POST", body: response.body,
    duplex: "half",
  } as RequestInit & { duplex: "half" }), 512_000);
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ContractError("The session service returned an invalid response."); }
  const parsed = Snapshot.safeParse(payload);
  if (!parsed.success) throw new ContractError("The session service returned an invalid snapshot.");
  return { ...parsed.data, accessToken: token };
}
```

## /home/innocent/systems/hrms/src/lib/server/rate-limit.ts

```typescript
import { createHash } from "node:crypto";
import { z } from "zod";
import { HttpError, errorResponse } from "./http";

export interface RateLimitPolicy {
  name: string;
  perMinute: number;
  perDay: number;
  globalPerMinute: number;
  globalPerDay: number;
}

type Counter = { count: number; expiresAt: number };
const localCounters = new Map<string, Counter>();
const MAX_LOCAL_KEYS = 10_000;

// All checks/increments occur atomically across replicas. Denials consume no new slots.
const SCRIPT = `
local retry = 0
for i = 1, #KEYS do
  local current = tonumber(redis.call('GET', KEYS[i]) or '0')
  if current >= tonumber(ARGV[(i-1)*2+1]) then
    local ttl = redis.call('PTTL', KEYS[i])
    if ttl < 1 then ttl = tonumber(ARGV[(i-1)*2+2]) end
    retry = math.max(retry, ttl)
  end
end
if retry > 0 then return {0, retry} end
for i = 1, #KEYS do
  local current = redis.call('INCR', KEYS[i])
  if current == 1 then redis.call('PEXPIRE', KEYS[i], ARGV[(i-1)*2+2]) end
end
return {1, 0}
`;

export class RateLimitError extends HttpError {
  constructor(public readonly retryAfterSeconds: number) {
    super(429, "Too many requests. Please try again later.");
  }
}

/** Only use an IP header if the deployment's trusted proxy strips/replaces client copies. */
export function publicRateLimitIdentity(request: Request): string {
  const trustedHeader = process.env.RATE_LIMIT_TRUSTED_IP_HEADER?.trim();
  if (!trustedHeader) return "anonymous-shared";
  const value = request.headers.get(trustedHeader)?.trim();
  if (!value || value.length > 128 || value.includes(",")) return "anonymous-shared";
  return `public:${value}`;
}

export async function enforceRateLimit(policy: RateLimitPolicy, identity: string): Promise<void> {
  const now = Date.now();
  const digest = createHash("sha256").update(identity).digest("hex");
  const rules = [
    { scope: digest, duration: 60_000, limit: policy.perMinute },
    { scope: digest, duration: 86_400_000, limit: policy.perDay },
    { scope: "global", duration: 60_000, limit: policy.globalPerMinute },
    { scope: "global", duration: 86_400_000, limit: policy.globalPerDay },
  ].map((rule) => ({
    key: `hrms:{${policy.name}}:${rule.scope}:${rule.duration}:${Math.floor(now / rule.duration)}`,
    limit: rule.limit,
    ttl: rule.duration - (now % rule.duration),
  }));
  const restUrl = process.env.RATE_LIMIT_REDIS_REST_URL?.trim();
  const restToken = process.env.RATE_LIMIT_REDIS_REST_TOKEN?.trim();
  if (restUrl && restToken) {
    const url = new URL(restUrl);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new HttpError(503, "Rate limiting is not configured correctly.");
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${restToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", SCRIPT, rules.length, ...rules.map((rule) => rule.key),
        ...rules.flatMap((rule) => [rule.limit, rule.ttl])]),
      signal: AbortSignal.timeout(3_000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new HttpError(503, "Rate limiting is temporarily unavailable.");
    }
    const parsed = z.object({ result: z.tuple([z.union([z.literal(0), z.literal(1)]),
      z.number().int().nonnegative()]) }).safeParse(await response.json());
    if (!parsed.success) throw new HttpError(503, "Rate limiting is temporarily unavailable.");
    if (parsed.data.result[0] === 0) {
      throw new RateLimitError(Math.max(1, Math.ceil(parsed.data.result[1] / 1_000)));
    }
    return;
  }
  if (process.env.NODE_ENV === "production" || restUrl || restToken) {
    throw new HttpError(503, "Shared rate limiting must be configured before using this service.");
  }
  // Development/test only. Production never silently falls back to per-process counters.
  for (const [key, counter] of localCounters) {
    if (counter.expiresAt <= now) localCounters.delete(key);
  }
  let retry = 0;
  for (const rule of rules) {
    const counter = localCounters.get(rule.key);
    if (counter && counter.count >= rule.limit) retry = Math.max(retry, counter.expiresAt - now);
  }
  if (retry > 0) throw new RateLimitError(Math.max(1, Math.ceil(retry / 1_000)));
  const missingKeys = rules.filter((rule) => !localCounters.has(rule.key)).length;
  if (localCounters.size + missingKeys > MAX_LOCAL_KEYS) {
    throw new HttpError(503, "Rate limiting capacity is temporarily unavailable.");
  }
  for (const rule of rules) {
    const counter = localCounters.get(rule.key);
    localCounters.set(rule.key, { count: (counter?.count ?? 0) + 1, expiresAt: now + rule.ttl });
  }
}

export function withRateLimit(
  policy: RateLimitPolicy,
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      await enforceRateLimit(policy, publicRateLimitIdentity(request));
      return await handler(request);
    } catch (error) {
      const response = errorResponse(error);
      if (error instanceof RateLimitError) {
        response.headers.set("Retry-After", String(error.retryAfterSeconds));
      }
      return response;
    }
  };
}
```

## Backend integration

These adapters are already implemented in the corresponding full files.

### [auth.controller.ts](/home/innocent/systems/hrms_backend/src/modules/auth/auth.controller.ts)

Added `Header` to the existing Nest imports. The global JWT guard validates the snapshot before this method runs.

```typescript
  @Get('session')
  @Header('Cache-Control', 'no-store')
  @ApiAuthRequired()
  @ApiSuccessResponse(200, 'Verified current authentication snapshot')
  currentSession(@Req() req: ExpressRequest & { user: AuthenticatedUser }) {
    const actor = req.user;
    return {
      id: actor.id,
      companyId: actor.companyId,
      employeeId: actor.employeeId,
      scope: actor.scope,
      userType: actor.userType,
      dashboardType: actor.dashboardType,
      roles: actor.roles,
      permissions: actor.permissions,
    };
  }
```

### [employees.controller.ts](/home/innocent/systems/hrms_backend/src/modules/hr/employees/employees.controller.ts)

Added `BadRequestException` to the existing Nest imports. The adapter delegates to existing tenant/access checks, profile selection logic, database update and managed media storage.

```typescript
  @Post(':id/profile-photo')
  @UseGuards(PermissionsGuard)
  @Permissions('employees:update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
    }),
  )
  async uploadEmployeeProfilePhoto(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Param('id', ParseIntPipe) id: number,
    @CurrentAuditContext() context: AuditRequestContext,
    @UploadedFile()
    file?: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    if (!file?.buffer?.length || file.size !== file.buffer.length) {
      throw new BadRequestException('A non-empty profile image is required.');
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException(
        'Profile images must be JPEG, PNG, or WEBP.',
      );
    }
    const employee = await this.employeesService.update(
      req.user.companyId!,
      id,
      {
        default_avatar_id: null,
        profile_photo_url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      },
      req.user,
      context,
    );
    return {
      profile_photo_url: employee.profile_photo_url,
      approval_required: false,
      applied_immediately: true,
    };
  }
```

### [employees.service.ts](/home/innocent/systems/hrms_backend/src/modules/hr/employees/employees.service.ts)

The existing image-storage call in `applyProfileImageSelection` now sets `maxFileSizeBytes: 5 * 1024 * 1024` and `validateFileSignature: true`, so direct backend callers cannot bypass the Next verification by spoofing MIME metadata.

### [support-chat-widget.tsx](/home/innocent/systems/hrms/src/components/support-chat-widget.tsx)

The widget sends only `role` and `content` for the last 12 messages; it caps content at 4000 characters so historical answers and UI metadata cannot violate the strict API schema.
