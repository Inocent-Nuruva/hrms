# Batch 2 — Complete replacement files

The three requested replacements are implemented in the workspace and reproduced below in full, including every unrelated existing method in the finance service file. The sequence migration and media integration replacements are also complete. There are no abbreviated service bodies or placeholder functions.

## Deployment

1. Set `INTERNAL_BACKEND_URL` to your actual absolute backend origin. Escalation follows the requested fallback exactly: `http://127.0.0.1:4000`. Configured URLs may end in `/api`; the URL pipeline ensures the API prefix is not duplicated. Schemes other than HTTP(S), embedded credentials, query/hash configuration and self-recursing escalation targets are rejected.
2. Apply the included transactional sequence migration before running the new finance writer. From `/home/innocent/systems/hrms_backend`, run `npm run migration:run` using the intended deployment database configuration. No migration was applied to your application database during this task.
3. Deploy all finance writers together; drain the old count-based creation processes during the rollout. The migration prevents concurrent writes while initializing the sequence, but cannot make old application code use the new sequence afterward.
4. Restart/rebuild Next.js after configuring its rewrite target. `/uploads/:path*` uses a `beforeFiles` rewrite, so backend files cannot be shadowed by stale frontend public files. Existing local Next API handlers remain ahead of the API proxy.
5. `server-only` is now an explicit dependency. Existing authenticated upload routes still need the shared quota settings from Batch 1. The server HTTP helper now honors `INTERNAL_BACKEND_URL` so upload/session calls and upload proxy destinations stay aligned.

## Behavior

- Escalation authenticates before reading its bounded JSON stream, constructs an absolute backend URL using only server configuration, forwards the bearer header, rejects redirects, and applies a 15-second fetch deadline. Client 4xx messages/statuses are preserved; backend 5xx details are sanitized; malformed response contracts return 502 and timeouts return 504.
- Absolute/protocol-relative third-party media URLs retain their original host, path, query, and signature. Only explicitly known backend upload origins are eligible for rebinding. Newly uploaded photos return a browser-visible frontend-origin upload URL rather than an internal-only backend address.
- Finance creation runs inside `dataSource.transaction('READ COMMITTED', ...)`. The parent employee is selected under `setLock('pessimistic_write')` before any active-limit evaluation. READ COMMITTED allows a waiter to observe the preceding committed application once the employee lock becomes available.
- Product/eligibility reads, application insertion and audit insertion use the transaction manager. Product reads use a shared row lock. Application/audit writes roll back together.
- The cap includes drafts, returned-for-correction drafts, submitted applications and pending approval/acceptance stages. The configured cap must be a positive safe integer.
- The global PostgreSQL bigint sequence is initialized above the largest existing canonical application-number suffix across companies. The outward format remains `EFAPP-<company>-<zero-padded sequence>`. Suffixes are globally allocated rather than consecutive per company. Numbers are never recycled by subsequent deletes, rollbacks or concurrent allocations; safe gaps are expected. Previously deleted historical numbers cannot be recovered from existing rows.
- Lock waits are bounded to 5 seconds and individual SQL statements to 15 seconds. Recognized lock/deadlock/serialization/query-cancellation failures become sanitized 503s; uniqueness conflicts become 409s. Failed transactions are not automatically retried.
- Nest injects the existing TypeORM `DataSource`; no new module/entity registration is needed for a native PostgreSQL sequence. Both direct-constructor test fixtures were updated for the new dependency.

## Validation

- Frontend: 74 Vitest files / 492 tests passed, including relative-base fallback, media URL host boundaries, upload routing and unsafe-origin rejection.
- Backend finance boundary and lifecycle suites: 66 tests passed.
- Real isolated PostgreSQL tests: five cases covering 16 competing creates at a cap of one, 16 concurrent employee allocations, deletion non-reuse, atomic audit rollback with a sequence gap, and returned-for-correction cap enforcement.
- Both TypeScript checks, focused lint and Git whitespace checks passed.
- PostgreSQL verification created a temporary cluster and a unique test schema, then removed both. The application database was not used.
- No paid support provider/mail calls or production deployment were performed.

## [route.ts](/home/innocent/systems/hrms/src/app/api/support/escalate/route.ts)

Path: `/home/innocent/systems/hrms/src/app/api/support/escalate/route.ts`

```typescript
import "server-only";

import { ContractError, errorResponse, HttpError, readLimitedBody } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function escalationUrl(): URL {
  const configured = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:4000";
  let origin: URL;
  try { origin = new URL(configured); }
  catch { throw new HttpError(503, "INTERNAL_BACKEND_URL must be an absolute HTTP(S) URL."); }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password ||
      origin.search || origin.hash || !["/", "/api", "/api/"].includes(origin.pathname)) {
    throw new HttpError(503, "INTERNAL_BACKEND_URL must identify an absolute backend origin.");
  }
  const destination = new URL("/api/support/escalate", origin.origin);
  if (destination.origin !== origin.origin) throw new HttpError(503, "Invalid support service destination.");
  return destination;
}

function backendMessage(payload: Record<string, unknown>, fallback: string): string {
  for (const key of ["message", "error"]) {
    const candidate = payload[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 2_000);
    if (Array.isArray(candidate) && candidate.every((entry) => typeof entry === "string")) {
      return candidate.join(". ").slice(0, 2_000) || fallback;
    }
  }
  return fallback;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    if (!/^Bearer [A-Za-z0-9._~-]+$/i.test(authorization) || authorization.length > 16_384) {
      throw new HttpError(401, "Sign in to send this chat to IT support.");
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new HttpError(415, "Send your support request as JSON.");
    }
    const destination = escalationUrl();
    if (destination.origin === new URL(request.url).origin) {
      throw new HttpError(503, "The support backend cannot point to this frontend.");
    }
    const bytes = await readLimitedBody(request, 320_000);
    let body: unknown;
    try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new HttpError(400, "Describe what you need help with using valid JSON."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "A support request object is required.");
    }
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]);
    const response = await fetch(destination, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal,
    });
    const responseBytes = await readLimitedBody(new Request("http://internal/escalation-result", {
      method: "POST", body: response.body, signal, duplex: "half",
    } as RequestInit & { duplex: "half" }), 256_000);
    let payload: unknown;
    try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(responseBytes)); }
    catch { throw new ContractError("The support service returned an invalid response."); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new ContractError("The support service returned an invalid response.");
    }
    if (!response.ok) {
      const status = response.status >= 400 && response.status < 500 ? response.status : 502;
      const message = status === 502 ? "The support service is temporarily unavailable."
        : backendMessage(payload as Record<string, unknown>, "Could not email IT support.");
      const result = Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
      const retryAfter = response.headers.get("retry-after");
      if (status === 429 && retryAfter && /^\d{1,6}$/.test(retryAfter)) result.headers.set("Retry-After", retryAfter);
      return result;
    }
    return Response.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
```

## [next.config.ts](/home/innocent/systems/hrms/next.config.ts)

Path: `/home/innocent/systems/hrms/next.config.ts`

```typescript
import path from "node:path";
import type { NextConfig } from "next";

export function resolveBackendOrigin() {
  const configuredOrigin =
    process.env.INTERNAL_BACKEND_URL?.trim() ||
    process.env.BACKEND_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim();
  const rawValue = configuredOrigin || process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const fallback = process.env.APP_ENV?.trim().toLowerCase() === "uat"
    ? "http://127.0.0.1:9999" : "http://localhost:8888";
  const url = new URL(!rawValue || rawValue === "/api" ? fallback : rawValue);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || !["/", "/api", "/api/"].includes(url.pathname)) {
    throw new Error("The backend rewrite target must be an absolute HTTP(S) origin.");
  }
  return url.origin;
}

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.1.165"],
  bundlePagesRouterDependencies: true,
  // Dashboard routes are large. Keep only the active one resident so a long
  // dev session does not pin every visited page in memory.
  onDemandEntries: {
    maxInactiveAge: 20 * 1000,
    pagesBufferLength: 2,
  },
  experimental: {
    webpackMemoryOptimizations: true,
    // Fluent UI's barrel exports hundreds of modules. Only load the controls
    // referenced by each route so development compilation stays within the
    // memory budget.
    optimizePackageImports: [
      "@fluentui/react-components",
      "@fluentui/react-icons",
    ],
    // Avoid compiling every route into one large resident process. Routes are
    // compiled on first visit instead, keeping development memory bounded.
    preloadEntriesOnStart: false,
    // Turbopack's native compiler runs alongside Node. Keep its target below
    // the Node heap cap so a long dev session remains usable on typical PCs.
    turbopackMemoryLimit: 768 * 1024 * 1024,
  },
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  async rewrites() {
    const backendOrigin = resolveBackendOrigin();
    return {
      // Backend owns uploads; stale frontend public files must not shadow them.
      // Only this app's /uploads paths match. External media URLs stay external.
      beforeFiles: [
        {
          source: "/uploads/:path*",
          destination: `${backendOrigin}/uploads/:path*`,
        },
      ],
      // Preserve locally implemented App Router API handlers before the API proxy.
      afterFiles: [
        {
          source: "/socket.io",
          destination: `${backendOrigin}/socket.io`,
        },
        {
          source: "/socket.io/:path*",
          destination: `${backendOrigin}/socket.io/:path*`,
        },
        {
          source: "/api/:path*",
          destination: `${backendOrigin}/api/:path*`,
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
```

## [employee-finance-core.services.ts](/home/innocent/systems/hrms_backend/src/modules/hr/employee-finance/services/employee-finance-core.services.ts)

Path: `/home/innocent/systems/hrms_backend/src/modules/hr/employee-finance/services/employee-finance-core.services.ts`

```typescript
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import Decimal from 'decimal.js';
import ExcelJS from 'exceljs';
import { basename } from 'path';
import {
  DataSource,
  EntityManager,
  In,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { FilesService } from '../../../files/files.service';
import { EmployeeCompensationVersion } from '../../employee-movements/entities/employee-compensation-version.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { EmploymentStatusEnum } from '../../employees/enums/employment-status.enum';
import { EmployeePayrollResult } from '../../payroll/entities/payroll-run.entities';
import { PayrollPeriod } from '../../payroll/entities/payroll-configuration.entities';
import { HrAccessService } from '../../shared/hr-access.service';
import { OffboardingRequest } from '../../offboarding/entities/offboarding-request.entity';
import { OffboardingSettlementItem } from '../../offboarding/entities/offboarding-settlement-item.entity';
import { OffboardingSettlementItemTypeEnum } from '../../offboarding/enums/offboarding-settlement-item-type.enum';
import { OffboardingSettlementSourceEnum } from '../../offboarding/enums/offboarding-settlement-source.enum';
import { OffboardingSettlementStatusEnum } from '../../offboarding/enums/offboarding-settlement-status.enum';
import { EmployeePayrollResultStatusEnum } from '../../payroll/payroll.enums';
import {
  ApproveEmployeeFinanceApplicationDto,
  CreateEmployeeFinanceApplicationDocumentDto,
  CreateEmployeeFinanceApplicationDto,
  CreateEmployeeFinanceGuarantorDto,
  CreateEmployeeFinanceDisbursementDto,
  CreateEmployeeFinanceProductDto,
  CreateEmployeeFinanceRepaymentDto,
  DecideEmployeeFinanceGuarantorDto,
  EmployeeFinanceQueryDto,
  EvaluateEmployeeFinanceEligibilityDto,
  EvaluateMyEmployeeFinanceEligibilityDto,
  ImportEmployeeFinancePaymentFileDto,
  PostEmployeeFinanceAccountingDto,
  RequestEmployeeFinanceDefermentDto,
  RequestEmployeeFinanceRescheduleDto,
  UploadEmployeeFinanceApplicationDocumentDto,
  VerifyEmployeeFinanceApplicationDocumentDto,
} from '../dto/employee-finance.dto';
import {
  EmployeeFinanceApplication,
  EmployeeFinanceApplicationApproval,
  EmployeeFinanceApplicationDocument,
  EmployeeFinanceApplicationGuarantor,
  EmployeeFinanceSanctionLetter,
} from '../entities/employee-finance-application.entities';
import {
  EmployeeFinanceAccount,
  EmployeeFinanceAuditLog,
  EmployeeFinanceDefermentRequest,
  EmployeeFinanceDisbursement,
  EmployeeFinanceExitRecovery,
  EmployeeFinanceInstallment,
  EmployeeFinanceLedgerEntry,
  EmployeeFinancePayrollInstruction,
  EmployeeFinanceRepayment,
  EmployeeFinanceRepaymentAllocation,
  EmployeeFinanceReschedule,
  EmployeeFinanceSettlementQuote,
} from '../entities/employee-finance-account.entities';
import {
  EmployeeFinanceProduct,
  EmployeeFinanceProductApplicability,
} from '../entities/employee-finance-product.entities';
import { NotificationQueueService } from '../../../notifications/notification-queue.service';
import { SmsNotificationManagementService } from '../../../sms/sms-notification-management.service';
import {
  EmployeeFinanceAccountStatusEnum,
  EmployeeFinanceApplicationStatusEnum,
  EmployeeFinanceApprovalStageEnum,
  EmployeeFinanceDecisionEnum,
  EmployeeFinanceDisbursementStatusEnum,
  EmployeeFinanceInstallmentStatusEnum,
  EmployeeFinanceInterestMethodEnum,
  EmployeeFinanceLedgerEntryTypeEnum,
  EmployeeFinancePayrollInstructionStatusEnum,
  EmployeeFinanceProductTypeEnum,
  EmployeeFinanceRepaymentStatusEnum,
} from '../employee-finance.enums';
import { EmployeeFinanceMoney } from './employee-finance-money.util';

const EMPLOYEE_FINANCE_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const EMPLOYEE_FINANCE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(date: string, months: number, day = 28) {
  const source = new Date(`${date}T00:00:00.000Z`);
  const next = new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next.toISOString().slice(0, 10);
}

function addDaysString(date: string, days: number) {
  const source = new Date(`${date}T00:00:00.000Z`);
  source.setUTCDate(source.getUTCDate() + days);
  return source.toISOString().slice(0, 10);
}

function daysBetweenDates(from: string, to = todayString()) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function monthsBetween(from: string | null, to = new Date()) {
  if (!from) return 0;
  const start = new Date(`${from}T00:00:00.000Z`);
  return Math.max(
    0,
    (to.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (to.getUTCMonth() - start.getUTCMonth()),
  );
}

function activeAccountStatuses() {
  return [
    EmployeeFinanceAccountStatusEnum.ACTIVE,
    EmployeeFinanceAccountStatusEnum.DEFERRED,
    EmployeeFinanceAccountStatusEnum.IN_ARREARS,
    EmployeeFinanceAccountStatusEnum.RESTRUCTURED,
    EmployeeFinanceAccountStatusEnum.PENDING_DISBURSEMENT,
  ];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberFromPolicy(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function requiredGuarantorCount(productSnapshotValue: unknown) {
  const productSnapshot = recordValue(productSnapshotValue);
  const approval = recordValue(productSnapshot.approvalConfiguration);
  const eligibility = recordValue(productSnapshot.eligibilityConfiguration);
  return Math.max(
    numberFromPolicy(productSnapshot.requiredGuarantors),
    numberFromPolicy(productSnapshot.required_guarantors),
    numberFromPolicy(approval.required_guarantors),
    numberFromPolicy(approval.guarantor_count),
    numberFromPolicy(eligibility.required_guarantors),
    numberFromPolicy(eligibility.guarantor_count),
  );
}

function requiredDocumentTypes(
  productSnapshot: Record<string, unknown>,
  requestedAmount?: string | null,
) {
  const raw =
    productSnapshot.requiredDocumentTypes ??
    productSnapshot.required_document_types;
  const base = Array.isArray(raw)
    ? raw
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
    : [];
  const policy = recordValue(
    productSnapshot.policyConfiguration ?? productSnapshot.policy_configuration,
  );
  const collateralThreshold = numberFromPolicy(
    policy.collateral_required_above,
  );
  if (
    requestedAmount &&
    collateralThreshold > 0 &&
    Number(requestedAmount) > collateralThreshold
  ) {
    base.push('COLLATERAL');
  }
  const byAmount = Array.isArray(policy.required_documents_by_amount)
    ? policy.required_documents_by_amount
    : [];
  for (const item of byAmount) {
    const rule = recordValue(item);
    const minimumAmount = numberFromPolicy(rule.minimum_amount);
    const documents = Array.isArray(rule.documents) ? rule.documents : [];
    if (!requestedAmount || Number(requestedAmount) < minimumAmount) continue;
    for (const document of documents) {
      if (typeof document === 'string' && document.trim()) {
        base.push(document.trim().toUpperCase());
      }
    }
  }
  return Array.from(new Set(base));
}

function financePolicyConfiguration(product: EmployeeFinanceProduct) {
  return recordValue(
    (product.eligibilityConfiguration ?? {}).policy_configuration ??
      (product.eligibilityConfiguration ?? {}).policyConfiguration,
  );
}

function normalizeImportStatus(value: unknown) {
  const status =
    typeof value === 'string' || typeof value === 'number'
      ? String(value).trim().toUpperCase()
      : 'SUCCESS';
  if (
    ['PAID', 'SUCCESS', 'SUCCESSFUL', 'CONFIRMED', 'SETTLED'].includes(status)
  )
    return 'SUCCESS';
  if (['FAILED', 'REJECTED', 'RETURNED', 'REVERSAL'].includes(status))
    return 'FAILED';
  if (['PARTIAL', 'PARTIALLY_PAID', 'SHORT_PAID'].includes(status))
    return 'PARTIAL';
  return status || 'SUCCESS';
}

export type EmployeeFinanceScheduleItem = {
  installment_number: number;
  due_date: string;
  principal_due: string;
  interest_due: string;
  fee_due: string;
  total_due: string;
  outstanding_after: string;
};

type EmployeeFinanceReconciliationResult = {
  account_id: number;
  issue_count: number;
  issues: Record<string, unknown>[];
};

@Injectable()
export class EmployeeFinanceAuditService {
  constructor(
    private readonly hrAccessService: HrAccessService,
    @InjectRepository(EmployeeFinanceAuditLog)
    private readonly repository: Repository<EmployeeFinanceAuditLog>,
  ) {}

  async log(
    args: {
      actor?: AuthenticatedUser;
      companyId?: number;
      action: string;
      entityType: string;
      entityId: string | number;
      summary?: Record<string, unknown> | null;
    },
    manager?: EntityManager,
  ) {
    const companyId =
      args.companyId ?? this.hrAccessService.ensureActorCompanyId(args.actor!);
    const repository =
      manager?.getRepository(EmployeeFinanceAuditLog) ?? this.repository;
    return repository.save(
      repository.create({
        companyId,
        actorCompanyUserId: args.actor?.companyMembershipId ?? null,
        action: args.action,
        entityType: args.entityType,
        entityId: String(args.entityId),
        summary: args.summary ?? null,
      }),
    );
  }
}

@Injectable()
export class EmployeeFinanceProductService {
  constructor(
    private readonly configService: ConfigService,
    private readonly hrAccessService: HrAccessService,
    private readonly auditService: EmployeeFinanceAuditService,
    @InjectRepository(EmployeeFinanceProduct)
    private readonly repository: Repository<EmployeeFinanceProduct>,
    @InjectRepository(EmployeeFinanceApplication)
    private readonly applicationRepository: Repository<EmployeeFinanceApplication>,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateEmployeeFinanceProductDto) {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const minAmount = EmployeeFinanceMoney.toCents(dto.minimum_amount);
    const maxAmount =
      dto.maximum_amount !== undefined
        ? EmployeeFinanceMoney.toCents(dto.maximum_amount)
        : null;
    if (maxAmount !== null && minAmount > maxAmount) {
      throw new BadRequestException(
        'Minimum amount cannot exceed maximum amount.',
      );
    }
    if ((dto.minimum_term_months ?? 1) > dto.maximum_term_months) {
      throw new BadRequestException('Minimum term cannot exceed maximum term.');
    }
    if (new Decimal(dto.annual_interest_rate ?? '0').lt(0)) {
      throw new BadRequestException('Interest rate cannot be negative.');
    }

    const product = await this.repository.save(
      this.repository.create({
        companyId,
        productType: dto.product_type,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        interestMethod:
          dto.interest_method ??
          EmployeeFinanceInterestMethodEnum.ZERO_INTEREST,
        annualInterestRate: dto.annual_interest_rate ?? '0',
        minimumAmount: dto.minimum_amount,
        maximumAmount: dto.maximum_amount ?? null,
        maximumSalaryMultiple: dto.maximum_salary_multiple ?? null,
        minimumTermMonths: dto.minimum_term_months ?? 1,
        maximumTermMonths: dto.maximum_term_months,
        minimumServiceMonths: dto.minimum_service_months ?? 0,
        maximumInstallmentPercentage:
          dto.maximum_installment_percentage ??
          String(
            this.configService.get<number>(
              'EMPLOYEE_FINANCE_MAX_INSTALLMENT_PERCENT_OF_NET_PAY',
              35,
            ),
          ),
        maximumActiveAccounts: dto.maximum_active_accounts ?? 1,
        requiresConfirmation: dto.requires_confirmation ?? false,
        allowDuringProbation: dto.allow_during_probation ?? false,
        allowRescheduling: dto.allow_rescheduling ?? true,
        allowDeferment: dto.allow_deferment ?? true,
        allowEarlySettlement: dto.allow_early_settlement ?? true,
        allowAdditionalRepayment: dto.allow_additional_repayment ?? true,
        requiredDocumentTypes: dto.required_document_types ?? null,
        eligibilityConfiguration: dto.eligibility_configuration ?? {},
        approvalConfiguration: dto.approval_configuration ?? {},
        effectiveFrom: dto.effective_from,
        effectiveTo: dto.effective_to ?? null,
        status: 'ACTIVE',
      }),
    );
    await this.auditService.log({
      actor,
      action: 'finance.product.created',
      entityType: 'EMPLOYEE_FINANCE_PRODUCT',
      entityId: product.id,
      summary: { code: product.code, product_type: product.productType },
    });
    return product;
  }

  async update(
    actor: AuthenticatedUser,
    id: number,
    dto: CreateEmployeeFinanceProductDto,
  ) {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const product = await this.repository.findOne({ where: { id, companyId } });
    if (!product) throw new NotFoundException('Finance product not found.');
    const used = await this.applicationRepository.count({
      where: { companyId, productId: product.id },
    });
    if (used > 0 || product.isLocked) {
      throw new ConflictException(
        'Used finance products are immutable; create a new version.',
      );
    }
    await this.repository.remove(product);
    return this.create(actor, dto);
  }

  list(actor: AuthenticatedUser) {
    return this.repository.find({
      where: { companyId: this.hrAccessService.ensureActorCompanyId(actor) },
      order: { productType: 'ASC', code: 'ASC' },
    });
  }

  async getActive(
    companyId: number,
    productId: number,
    manager?: EntityManager,
  ) {
    const repository =
      manager?.getRepository(EmployeeFinanceProduct) ?? this.repository;
    const product = await repository.findOne({
      where: { id: productId, companyId, status: 'ACTIVE' },
      ...(manager ? { lock: { mode: 'pessimistic_read' as const } } : {}),
    });
    if (!product) throw new NotFoundException('Finance product not found.');
    return product;
  }
}

@Injectable()
export class EmployeeFinanceEligibilityService {
  constructor(
    private readonly configService: ConfigService,
    private readonly hrAccessService: HrAccessService,
    private readonly productService: EmployeeFinanceProductService,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(EmployeeCompensationVersion)
    private readonly compensationRepository: Repository<EmployeeCompensationVersion>,
    @InjectRepository(EmployeePayrollResult)
    private readonly payrollResultRepository: Repository<EmployeePayrollResult>,
    @InjectRepository(EmployeeFinanceAccount)
    private readonly accountRepository: Repository<EmployeeFinanceAccount>,
    @InjectRepository(EmployeeFinanceProductApplicability)
    private readonly applicabilityRepository: Repository<EmployeeFinanceProductApplicability>,
  ) {}

  async evaluate(
    actor: AuthenticatedUser,
    dto: EvaluateEmployeeFinanceEligibilityDto,
  ) {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const product = await this.productService.getActive(
      companyId,
      dto.product_id,
    );
    return this.evaluateEligibility(
      companyId,
      dto.employee_id,
      product,
      dto.requested_amount,
      dto.requested_term_months,
    );
  }

  async evaluateMine(
    actor: AuthenticatedUser,
    dto: EvaluateMyEmployeeFinanceEligibilityDto,
  ) {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    if (!actor.employeeId) {
      throw new ForbiddenException('Employee profile required.');
    }
    const product = await this.productService.getActive(
      companyId,
      dto.product_id,
    );
    return this.evaluateEligibility(
      companyId,
      actor.employeeId,
      product,
      dto.requested_amount,
      dto.requested_term_months,
    );
  }

  async evaluateEligibility(
    companyId: number,
    employeeId: number,
    product: EmployeeFinanceProduct,
    requestedAmount?: string,
    requestedTermMonths?: number,
    manager?: EntityManager,
  ) {
    const employeeRepository =
      manager?.getRepository(Employee) ?? this.employeeRepository;
    const compensationRepository =
      manager?.getRepository(EmployeeCompensationVersion) ??
      this.compensationRepository;
    const payrollResultRepository =
      manager?.getRepository(EmployeePayrollResult) ??
      this.payrollResultRepository;
    const accountRepository =
      manager?.getRepository(EmployeeFinanceAccount) ?? this.accountRepository;
    const employee = await employeeRepository.findOne({
      where: { id: employeeId, company_id: companyId },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
    const compensation = await compensationRepository
      .createQueryBuilder('compensation')
      .where('compensation.companyId = :companyId', { companyId })
      .andWhere('compensation.employeeId = :employeeId', { employeeId })
      .andWhere('compensation.status IN (:...statuses)', {
        statuses: ['ACTIVE', 'SCHEDULED'],
      })
      .orderBy('compensation.effectiveFrom', 'DESC')
      .getOne();
    const latestPayroll = await payrollResultRepository.findOne({
      where: {
        companyId,
        employeeId,
        status: EmployeePayrollResultStatusEnum.LOCKED,
      },
      order: { id: 'DESC' },
    });
    const activeAccounts = await accountRepository.find({
      where: {
        companyId,
        employeeId,
        productId: product.id,
        status: In(activeAccountStatuses()),
      },
    });
    const baseSalary = compensation?.baseSalary ?? '0.00';
    const netPay = latestPayroll?.netPay ?? baseSalary;
    const maximumAffordableInstallment = EmployeeFinanceMoney.multiplyPercent(
      netPay,
      product.maximumInstallmentPercentage,
    );
    const existingInstallments = activeAccounts.reduce(
      (sum, account) =>
        EmployeeFinanceMoney.add(sum, account.scheduledMonthlyInstallment),
      '0.00',
    );
    const availableInstallment = EmployeeFinanceMoney.subtract(
      maximumAffordableInstallment,
      existingInstallments,
    );
    const estimatedInstallment = this.estimateInstallment(
      product,
      requestedAmount,
      requestedTermMonths,
    );
    const estimatedNetPayAfterDeduction = estimatedInstallment
      ? EmployeeFinanceMoney.subtract(netPay, estimatedInstallment)
      : null;
    const installmentCapacityAfterRequest = estimatedInstallment
      ? EmployeeFinanceMoney.subtract(
          availableInstallment,
          estimatedInstallment,
        )
      : availableInstallment;
    const salaryMultipleLimit = product.maximumSalaryMultiple
      ? EmployeeFinanceMoney.multiply(baseSalary, product.maximumSalaryMultiple)
      : null;
    const configuredMaximum = product.maximumAmount;
    const maximumEligibleAmount =
      [salaryMultipleLimit, configuredMaximum]
        .filter((value): value is string => Boolean(value))
        .reduce(
          (current, value) =>
            current === null ? value : EmployeeFinanceMoney.min(current, value),
          null as string | null,
        ) ?? '0.00';
    const allowedGradeIds = product.eligibilityConfiguration
      .allowed_grade_ids as number[] | undefined;
    const policy = financePolicyConfiguration(product);
    const blockedEmployeeIds = Array.isArray(policy.blocked_employee_ids)
      ? policy.blocked_employee_ids.map((item) => Number(item))
      : [];
    const minimumNetPayAfterDeduction = numberFromPolicy(
      policy.minimum_net_pay_after_deduction,
    );
    const applicable = await this.isProductApplicable(
      companyId,
      employee,
      product,
      manager,
    );
    const serviceMonths = monthsBetween(employee.hire_date);
    const checks = [
      {
        code: 'EMPLOYEE_ACTIVE',
        passed: employee.employment_status === EmploymentStatusEnum.ACTIVE,
        value: employee.employment_status,
        required: EmploymentStatusEnum.ACTIVE,
        message: 'Employee must be active.',
      },
      {
        code: 'COMPENSATION_EXISTS',
        passed: Boolean(compensation),
        message: 'Employee must have active compensation.',
      },
      {
        code: 'PRODUCT_APPLICABLE',
        passed: applicable,
        message: 'Product must be applicable to employee assignment.',
      },
      {
        code: 'GRADE_ELIGIBLE',
        passed:
          !allowedGradeIds?.length ||
          allowedGradeIds.includes(employee.grade_id ?? 0),
        value: employee.grade_id,
        required: allowedGradeIds ?? null,
        message: 'Employee grade must be eligible.',
      },
      {
        code: 'MINIMUM_SERVICE',
        passed: serviceMonths >= product.minimumServiceMonths,
        value: serviceMonths,
        required: product.minimumServiceMonths,
        message: 'Employee must meet minimum service period.',
      },
      {
        code: 'ACTIVE_ACCOUNT_LIMIT',
        passed: activeAccounts.length < product.maximumActiveAccounts,
        value: activeAccounts.length,
        required: product.maximumActiveAccounts,
        message: 'Employee must be within active account limit.',
      },
      {
        code: 'REQUESTED_AMOUNT',
        passed:
          !requestedAmount ||
          (EmployeeFinanceMoney.toCents(requestedAmount) >=
            EmployeeFinanceMoney.toCents(product.minimumAmount) &&
            (EmployeeFinanceMoney.toCents(maximumEligibleAmount) === 0n ||
              EmployeeFinanceMoney.toCents(requestedAmount) <=
                EmployeeFinanceMoney.toCents(maximumEligibleAmount))),
        value: requestedAmount ?? null,
        required: {
          minimum: product.minimumAmount,
          maximum: maximumEligibleAmount,
        },
        message: 'Requested amount must fit configured eligibility limits.',
      },
      {
        code: 'REQUESTED_TERM',
        passed:
          !requestedTermMonths ||
          (requestedTermMonths >= product.minimumTermMonths &&
            requestedTermMonths <= product.maximumTermMonths),
        value: requestedTermMonths ?? null,
        required: {
          minimum: product.minimumTermMonths,
          maximum: product.maximumTermMonths,
        },
        message: 'Requested term must fit product limits.',
      },
      {
        code: 'PAYROLL_CAPACITY',
        passed:
          EmployeeFinanceMoney.toCents(installmentCapacityAfterRequest) >= 0n &&
          EmployeeFinanceMoney.toCents(availableInstallment) > 0n,
        value: {
          available_installment: availableInstallment,
          estimated_installment: estimatedInstallment,
          capacity_after_request: installmentCapacityAfterRequest,
        },
        required: '> 0',
        message:
          'Employee must have available payroll deduction capacity for the request.',
      },
      {
        code: 'POLICY_NOT_BLOCKED',
        passed: !blockedEmployeeIds.includes(employee.id),
        value: employee.id,
        required: 'not in blocked_employee_ids',
        message: 'Employee must not be blocked by loan policy.',
      },
      {
        code: 'MINIMUM_NET_PAY_AFTER_DEDUCTION',
        passed:
          minimumNetPayAfterDeduction <= 0 ||
          !estimatedNetPayAfterDeduction ||
          Number(estimatedNetPayAfterDeduction) >= minimumNetPayAfterDeduction,
        value: estimatedNetPayAfterDeduction,
        required: minimumNetPayAfterDeduction || null,
        message:
          'Employee must retain the minimum configured net pay after deduction.',
      },
    ];
    const snapshot = {
      employee_id: employee.id,
      product_id: product.id,
      base_salary: baseSalary,
      latest_net_pay: latestPayroll?.netPay ?? null,
      existing_finance_installments: existingInstallments,
      maximum_affordable_installment: maximumAffordableInstallment,
      available_installment: availableInstallment,
      estimated_installment: estimatedInstallment,
      estimated_net_pay_after_deduction: estimatedNetPayAfterDeduction,
      active_account_ids: activeAccounts.map((account) => account.id),
      service_months: serviceMonths,
      evaluated_at: new Date().toISOString(),
    };
    return {
      eligible: checks.every((check) => check.passed),
      maximumEligibleAmount,
      maximumAffordableInstallment,
      maximumTermMonths: product.maximumTermMonths,
      minimumAmount: product.minimumAmount,
      maximumAmount: product.maximumAmount,
      minimumTermMonths: product.minimumTermMonths,
      minimumServiceMonths: product.minimumServiceMonths,
      requiredDocumentTypes: requiredDocumentTypes(
        {
          requiredDocumentTypes: product.requiredDocumentTypes ?? [],
          policyConfiguration: policy,
        },
        requestedAmount,
      ),
      requiredGuarantorCount: requiredGuarantorCount(product),
      interestMethod: product.interestMethod,
      annualInterestRate: product.annualInterestRate,
      estimatedInstallment,
      estimatedNetPayAfterDeduction,
      availableInstallment,
      existingInstallments,
      currentExposure: activeAccounts.reduce(
        (sum, account) =>
          EmployeeFinanceMoney.add(sum, account.outstandingTotal),
        '0.00',
      ),
      availableExposure: maximumEligibleAmount,
      checks,
      snapshot,
      snapshotHash: hash(snapshot),
    };
  }

  private estimateInstallment(
    product: EmployeeFinanceProduct,
    requestedAmount?: string,
    requestedTermMonths?: number,
  ) {
    if (
      !requestedAmount ||
      !requestedTermMonths ||
      requestedTermMonths <= 0 ||
      EmployeeFinanceMoney.toCents(requestedAmount) <= 0n
    ) {
      return null;
    }

    const principal = new Decimal(requestedAmount);
    const annualRate = new Decimal(product.annualInterestRate || '0');

    if (
      annualRate.isZero() ||
      product.interestMethod === EmployeeFinanceInterestMethodEnum.ZERO_INTEREST
    ) {
      return EmployeeFinanceMoney.divide(requestedAmount, requestedTermMonths);
    }

    const monthlyRate = annualRate.div(100).div(12);

    if (
      product.interestMethod === EmployeeFinanceInterestMethodEnum.FLAT_RATE
    ) {
      const interest = principal.times(monthlyRate).times(requestedTermMonths);
      return EmployeeFinanceMoney.divide(
        principal.plus(interest).toString(),
        requestedTermMonths,
      );
    }

    const factor = new Decimal(1).plus(monthlyRate).pow(-requestedTermMonths);
    const denominator = new Decimal(1).minus(factor);
    if (denominator.isZero()) {
      return EmployeeFinanceMoney.divide(requestedAmount, requestedTermMonths);
    }
    return principal.times(monthlyRate).div(denominator).toFixed(2);
  }

  private async isProductApplicable(
    companyId: number,
    employee: Employee,
    product: EmployeeFinanceProduct,
    manager?: EntityManager,
  ) {
    const repository =
      manager?.getRepository(EmployeeFinanceProductApplicability) ??
      this.applicabilityRepository;
    const rules = await repository.find({
      where: { companyId, productId: product.id },
      order: { priority: 'DESC' },
    });
    if (!rules.length) return true;
    return rules.some(
      (rule) =>
        (!rule.specificEmployeeId || rule.specificEmployeeId === employee.id) &&
        (!rule.positionId ||
          rule.positionId === employee.primary_position_id) &&
        (!rule.gradeId || rule.gradeId === employee.grade_id) &&
        (!rule.departmentId ||
          rule.departmentId === employee.primary_department_id) &&
        (!rule.branchId || rule.branchId === employee.primary_branch_id) &&
        (!rule.employmentType ||
          String(rule.employmentType) === String(employee.employment_type)),
    );
  }
}

@Injectable()
export class EmployeeFinanceInterestService {
  calculateSchedule(args: {
    principal: string;
    annualInterestRate: string;
    termMonths: number;
    method: EmployeeFinanceInterestMethodEnum;
    firstRepaymentDate: string;
    repaymentDay: number;
  }) {
    const principalCents = EmployeeFinanceMoney.toCents(args.principal);
    const term = Math.max(args.termMonths, 1);
    const annualRate = new Decimal(args.annualInterestRate || '0');
    if (
      args.method === EmployeeFinanceInterestMethodEnum.ZERO_INTEREST ||
      annualRate.isZero()
    ) {
      return this.equalPrincipalSchedule(principalCents, 0n, term, args);
    }

    const monthlyRate = annualRate.div(100).div(12);

    if (args.method === EmployeeFinanceInterestMethodEnum.FLAT_RATE) {
      const interest = EmployeeFinanceMoney.toCents(
        EmployeeFinanceMoney.multiply(
          args.principal,
          monthlyRate.times(term).toString(),
        ),
      );
      return this.equalPrincipalSchedule(principalCents, interest, term, args);
    }

    let remaining = principalCents;
    const principalBase = principalCents / BigInt(term);
    const schedule: EmployeeFinanceScheduleItem[] = [];
    for (let i = 1; i <= term; i += 1) {
      const principalDue = i === term ? remaining : principalBase;
      const interestDue = EmployeeFinanceMoney.toCents(
        EmployeeFinanceMoney.multiply(
          EmployeeFinanceMoney.fromCents(remaining),
          monthlyRate.toString(),
        ),
      );
      remaining -= principalDue;
      schedule.push({
        installment_number: i,
        due_date: addMonths(args.firstRepaymentDate, i - 1, args.repaymentDay),
        principal_due: EmployeeFinanceMoney.fromCents(principalDue),
        interest_due: EmployeeFinanceMoney.fromCents(interestDue),
        fee_due: '0.00',
        total_due: EmployeeFinanceMoney.fromCents(principalDue + interestDue),
        outstanding_after: EmployeeFinanceMoney.fromCents(remaining),
      });
    }
    return schedule;
  }

  private equalPrincipalSchedule(
    principalCents: bigint,
    interestCents: bigint,
    term: number,
    args: { firstRepaymentDate: string; repaymentDay: number },
  ) {
    const principalBase = principalCents / BigInt(term);
    const interestBase = interestCents / BigInt(term);
    let principalRemaining = principalCents;
    let interestRemaining = interestCents;
    const schedule: EmployeeFinanceScheduleItem[] = [];
    for (let i = 1; i <= term; i += 1) {
      const principalDue = i === term ? principalRemaining : principalBase;
      const interestDue = i === term ? interestRemaining : interestBase;
      principalRemaining -= principalDue;
      interestRemaining -= interestDue;
      schedule.push({
        installment_number: i,
        due_date: addMonths(args.firstRepaymentDate, i - 1, args.repaymentDay),
        principal_due: EmployeeFinanceMoney.fromCents(principalDue),
        interest_due: EmployeeFinanceMoney.fromCents(interestDue),
        fee_due: '0.00',
        total_due: EmployeeFinanceMoney.fromCents(principalDue + interestDue),
        outstanding_after: EmployeeFinanceMoney.fromCents(principalRemaining),
      });
    }
    return schedule;
  }
}

@Injectable()
export class EmployeeFinanceLedgerService {
  constructor(
    @InjectRepository(EmployeeFinanceAccount)
    private readonly accountRepository: Repository<EmployeeFinanceAccount>,
    @InjectRepository(EmployeeFinanceLedgerEntry)
    private readonly ledgerRepository: Repository<EmployeeFinanceLedgerEntry>,
  ) {}

  async post(args: {
    companyId: number;
    accountId: number;
    installmentId?: number | null;
    entryType: EmployeeFinanceLedgerEntryTypeEnum;
    direction: 'DEBIT' | 'CREDIT';
    principalAmount?: string;
    interestAmount?: string;
    feeAmount?: string;
    effectiveDate: string;
    sourceType: string;
    sourceId?: string | null;
    idempotencyKey: string;
    postedByCompanyUserId?: number | null;
    description?: string | null;
  }) {
    const existing = await this.ledgerRepository.findOne({
      where: { companyId: args.companyId, idempotencyKey: args.idempotencyKey },
    });
    if (existing) return existing;
    const balance = await this.calculateBalance(args.companyId, args.accountId);
    const sign = args.direction === 'DEBIT' ? 1n : -1n;
    const nextPrincipal = EmployeeFinanceMoney.fromCents(
      EmployeeFinanceMoney.toCents(balance.principal) +
        sign * EmployeeFinanceMoney.toCents(args.principalAmount ?? '0'),
    );
    const nextInterest = EmployeeFinanceMoney.fromCents(
      EmployeeFinanceMoney.toCents(balance.interest) +
        sign * EmployeeFinanceMoney.toCents(args.interestAmount ?? '0'),
    );
    const nextFees = EmployeeFinanceMoney.fromCents(
      EmployeeFinanceMoney.toCents(balance.fees) +
        sign * EmployeeFinanceMoney.toCents(args.feeAmount ?? '0'),
    );
    const nextTotal = EmployeeFinanceMoney.add(
      nextPrincipal,
      nextInterest,
      nextFees,
    );
    const entry = await this.ledgerRepository.save(
      this.ledgerRepository.create({
        companyId: args.companyId,
        accountId: args.accountId,
        installmentId: args.installmentId ?? null,
        entryType: args.entryType,
        direction: args.direction,
        principalAmount: args.principalAmount ?? '0.00',
        interestAmount: args.interestAmount ?? '0.00',
        feeAmount: args.feeAmount ?? '0.00',
        totalAmount: EmployeeFinanceMoney.add(
          args.principalAmount,
          args.interestAmount,
          args.feeAmount,
        ),
        effectiveDate: args.effectiveDate,
        postedAt: new Date(),
        sourceType: args.sourceType,
        sourceId: args.sourceId ?? null,
        idempotencyKey: args.idempotencyKey,
        reversesEntryId: null,
        description: args.description ?? null,
        balanceSnapshot: {
          outstanding_principal: nextPrincipal,
          outstanding_interest: nextInterest,
          outstanding_fees: nextFees,
          outstanding_total: nextTotal,
        },
        postedByCompanyUserId: args.postedByCompanyUserId ?? null,
      }),
    );
    await this.accountRepository.update(
      { id: args.accountId, companyId: args.companyId },
      {
        outstandingPrincipal: nextPrincipal,
        outstandingInterest: nextInterest,
        outstandingFees: nextFees,
        outstandingTotal: nextTotal,
      },
    );
    return entry;
  }

  async calculateBalance(companyId: number, accountId: number) {
    const entries = await this.ledgerRepository.find({
      where: { companyId, accountId },
      order: { id: 'ASC' },
    });
    let principal = '0.00';
    let interest = '0.00';
    let fees = '0.00';
    for (const entry of entries) {
      const sign = entry.direction === 'DEBIT' ? 1n : -1n;
      principal = EmployeeFinanceMoney.fromCents(
        EmployeeFinanceMoney.toCents(principal) +
          sign * EmployeeFinanceMoney.toCents(entry.principalAmount),
      );
      interest = EmployeeFinanceMoney.fromCents(
        EmployeeFinanceMoney.toCents(interest) +
          sign * EmployeeFinanceMoney.toCents(entry.interestAmount),
      );
      fees = EmployeeFinanceMoney.fromCents(
        EmployeeFinanceMoney.toCents(fees) +
          sign * EmployeeFinanceMoney.toCents(entry.feeAmount),
      );
    }
    return {
      principal,
      interest,
      fees,
      total: EmployeeFinanceMoney.add(principal, interest, fees),
    };
  }
}

@Injectable()
export class EmployeeFinanceAccountService {
  constructor(
    private readonly configService: ConfigService,
    private readonly hrAccessService: HrAccessService,
    private readonly interestService: EmployeeFinanceInterestService,
    private readonly auditService: EmployeeFinanceAuditService,
    @InjectRepository(EmployeeFinanceAccount)
    private readonly accountRepository: Repository<EmployeeFinanceAccount>,
    @InjectRepository(EmployeeFinanceApplication)
    private readonly applicationRepository: Repository<EmployeeFinanceApplication>,
    @InjectRepository(EmployeeFinanceInstallment)
    private readonly installmentRepository: Repository<EmployeeFinanceInstallment>,
    @InjectRepository(EmployeeFinanceLedgerEntry)
    private readonly ledgerRepository: Repository<EmployeeFinanceLedgerEntry>,
    @InjectRepository(EmployeeFinanceDisbursement)
    private readonly disbursementRepository: Repository<EmployeeFinanceDisbursement>,
    @InjectRepository(EmployeeFinanceRepayment)
    private readonly repaymentRepository: Repository<EmployeeFinanceRepayment>,
    @InjectRepository(EmployeeFinanceDefermentRequest)
    private readonly defermentRepository: Repository<EmployeeFinanceDefermentRequest>,
    @InjectRepository(EmployeeFinanceReschedule)
    private readonly rescheduleRepository: Repository<EmployeeFinanceReschedule>,
    @InjectRepository(EmployeeFinanceSettlementQuote)
    private readonly settlementQuoteRepository: Repository<EmployeeFinanceSettlementQuote>,
  ) {}

  async createFromApplication(actor: AuthenticatedUser, applicationId: number) {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
    });
    if (!application)
      throw new NotFoundException('Finance application not found.');
    if (
      application.status !==
      EmployeeFinanceApplicationStatusEnum.PENDING_EMPLOYEE_ACCEPTANCE
    ) {
      throw new ConflictException(
        'Application must be ready for employee acceptance.',
      );
    }
    const existing = await this.accountRepository.findOne({
      where: {
        applicationId: application.id,
        companyId: application.companyId,
      },
    });
    if (existing) return existing;
    const approvedAmount =
      application.approvedAmount ?? application.requestedAmount;
    const term =
      application.approvedTermMonths ?? application.requestedTermMonths;
    const product = application.productSnapshot as unknown as {
      interestMethod: EmployeeFinanceInterestMethodEnum;
      annualInterestRate: string;
    };
    const repaymentDay = this.configService.get<number>(
      'EMPLOYEE_FINANCE_DEFAULT_REPAYMENT_DAY',
      28,
    );
    const firstRepaymentDate = addMonths(todayString(), 1, repaymentDay);
    const schedule = this.interestService.calculateSchedule({
      principal: approvedAmount,
      annualInterestRate:
        application.approvedInterestRate ?? product.annualInterestRate ?? '0',
      termMonths: term,
      method:
        product.interestMethod ??
        EmployeeFinanceInterestMethodEnum.ZERO_INTEREST,
      firstRepaymentDate,
      repaymentDay,
    });
    const interestTotal = schedule.reduce(
      (sum, item) => EmployeeFinanceMoney.add(sum, item.interest_due),
      '0.00',
    );
    const totalPayable = EmployeeFinanceMoney.add(
      approvedAmount,
      interestTotal,
    );
    const account = await this.accountRepository.save(
      this.accountRepository.create({
        companyId: application.companyId,
        employeeId: application.employeeId,
        applicationId: application.id,
        productId: application.productId,
        accountNo: `EF-${application.companyId}-${String(application.id).padStart(6, '0')}`,
        productType: application.productType,
        principalAmount: approvedAmount,
        interestAmount: interestTotal,
        feeAmount: '0.00',
        totalPayable,
        outstandingPrincipal: '0.00',
        outstandingInterest: '0.00',
        outstandingFees: '0.00',
        outstandingTotal: '0.00',
        scheduledMonthlyInstallment: schedule[0]?.total_due ?? totalPayable,
        termMonths: term,
        interestRate:
          application.approvedInterestRate ?? product.annualInterestRate ?? '0',
        firstRepaymentDate,
        maturityDate:
          schedule[schedule.length - 1]?.due_date ?? firstRepaymentDate,
        productSnapshot: application.productSnapshot,
        agreementSnapshot: {
          application_id: application.id,
          approved_amount: approvedAmount,
          approved_term_months: term,
          accepted_at: new Date().toISOString(),
        },
      }),
    );
    await this.installmentRepository.save(
      schedule.map((item) =>
        this.installmentRepository.create({
          companyId: account.companyId,
          accountId: account.id,
          employeeId: account.employeeId,
          scheduleVersion: 1,
          installmentNumber: item.installment_number,
          dueDate: item.due_date,
          principalDue: item.principal_due,
          interestDue: item.interest_due,
          feeDue: item.fee_due,
          totalDue: item.total_due,
        }),
      ),
    );
    application.employeeAcceptedAt = new Date();
    application.status = EmployeeFinanceApplicationStatusEnum.APPROVED;
    await this.applicationRepository.save(application);
    await this.auditService.log({
      actor,
      companyId: account.companyId,
      action: 'finance.account.created',
      entityType: 'EMPLOYEE_FINANCE_ACCOUNT',
      entityId: account.id,
      summary: { application_id: application.id },
    });
    return account;
  }

  list(actor: AuthenticatedUser, query: EmployeeFinanceQueryDto) {
    const where: Record<string, unknown> = {
      companyId: actor.companyId!,
    };
    if (query.employee_id) where.employeeId = query.employee_id;
    if (query.status) where.status = query.status;
    return this.accountRepository.find({ where, order: { id: 'DESC' } });
  }

  async getStatement(actor: AuthenticatedUser, accountId: number) {
    const account = await this.accountRepository.findOne({
      where: { id: accountId, companyId: actor.companyId! },
    });
    if (!account) throw new NotFoundException('Finance account not found.');
    if (actor.employeeId && actor.employeeId !== account.employeeId) {
      await this.hrAccessService.assertCanAccessEmployee(actor, {
        id: account.employeeId,
        company_id: account.companyId,
      } as Employee);
    }
    const [
      installments,
      ledger,
      disbursements,
      repayments,
      deferments,
      reschedules,
      settlementQuotes,
    ] = await Promise.all([
      this.installmentRepository.find({
        where: { companyId: account.companyId, accountId: account.id },
        order: { installmentNumber: 'ASC' },
      }),
      this.ledgerRepository.find({
        where: { companyId: account.companyId, accountId: account.id },
        order: { effectiveDate: 'ASC', id: 'ASC' },
      }),
      this.disbursementRepository.find({
        where: { companyId: account.companyId, accountId: account.id },
        order: { id: 'DESC' },
      }),
      this.repaymentRepository.find({
        where: { companyId: account.companyId, accountId: account.id },
        order: { paymentDate: 'DESC', id: 'DESC' },
      }),
      this.defermentRepository.find({
        where: { companyId: account.companyId, accountId: account.id },
        order: { id: 'DESC' },
      }),
      this.rescheduleRepository.find({
        where: { companyId: account.companyId, accountId: account.id },
        order: { id: 'DESC' },
      }),
      this.settlementQuoteRepository.find({
        where: { companyId: account.companyId, accountId: account.id },
        order: { id: 'DESC' },
      }),
    ]);
    return {
      account,
      installments,
      ledger,
      disbursements,
      repayments,
      deferments,
      reschedules,
      settlementQuotes,
    };
  }
}

@Injectable()
export class EmployeeFinanceApplicationService {
  constructor(
    private readonly configService: ConfigService,
    private readonly hrAccessService: HrAccessService,
    private readonly productService: EmployeeFinanceProductService,
    private readonly eligibilityService: EmployeeFinanceEligibilityService,
    private readonly accountService: EmployeeFinanceAccountService,
    private readonly auditService: EmployeeFinanceAuditService,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(EmployeeFinanceApplication)
    private readonly applicationRepository: Repository<EmployeeFinanceApplication>,
    @InjectRepository(EmployeeFinanceApplicationDocument)
    private readonly documentRepository: Repository<EmployeeFinanceApplicationDocument>,
    @InjectRepository(EmployeeFinanceApplicationGuarantor)
    private readonly guarantorRepository: Repository<EmployeeFinanceApplicationGuarantor>,
    @InjectRepository(EmployeeFinanceSanctionLetter)
    private readonly sanctionLetterRepository: Repository<EmployeeFinanceSanctionLetter>,
    private readonly filesService: FilesService,
    private readonly dataSource: DataSource,
  ) {}

  async createMine(
    actor: AuthenticatedUser,
    dto: CreateEmployeeFinanceApplicationDto,
  ) {
    if (!actor.employeeId)
      throw new ForbiddenException('Employee profile is required.');
    return this.createForEmployee(actor, actor.employeeId, dto);
  }

  async createForEmployee(
    actor: AuthenticatedUser,
    employeeId: number,
    dto: CreateEmployeeFinanceApplicationDto,
  ) {
    try {
      // READ COMMITTED obtains a fresh snapshot after a waiting employee lock;
      // competing creates for the same employee see the prior committed insert.
      return await this.dataSource.transaction(
        'READ COMMITTED',
        async (manager) => {
          await manager.query("SET LOCAL lock_timeout = '5s'");
          await manager.query("SET LOCAL statement_timeout = '15s'");
          const companyId = this.hrAccessService.ensureActorCompanyId(actor);
          const applicationRepository = manager.getRepository(
            EmployeeFinanceApplication,
          );
          const employee = await manager
            .getRepository(Employee)
            .createQueryBuilder('employee')
            .where('employee.id = :employeeId', { employeeId })
            .andWhere('employee.company_id = :companyId', { companyId })
            .setLock('pessimistic_write')
            .getOne();
          if (!employee) throw new NotFoundException('Employee not found.');
          if (actor.employeeId !== employeeId) {
            await this.hrAccessService.assertCanAccessEmployee(actor, employee);
          }
          const product = await this.productService.getActive(
            companyId,
            dto.product_id,
            manager,
          );
          const activeApplications = await applicationRepository.count({
            where: {
              companyId,
              employeeId,
              status: In([
                EmployeeFinanceApplicationStatusEnum.DRAFT,
                EmployeeFinanceApplicationStatusEnum.RETURNED_FOR_CORRECTION,
                EmployeeFinanceApplicationStatusEnum.SUBMITTED,
                EmployeeFinanceApplicationStatusEnum.PENDING_MANAGER_RECOMMENDATION,
                EmployeeFinanceApplicationStatusEnum.PENDING_HR_APPROVAL,
                EmployeeFinanceApplicationStatusEnum.PENDING_FINANCE_APPROVAL,
                EmployeeFinanceApplicationStatusEnum.PENDING_EMPLOYEE_ACCEPTANCE,
              ]),
            },
          });
          const maximumApplications = this.configService.get<number>(
            'EMPLOYEE_FINANCE_MAX_ACTIVE_APPLICATIONS',
            1,
          );
          if (
            !Number.isSafeInteger(maximumApplications) ||
            maximumApplications < 1
          ) {
            throw new InternalServerErrorException(
              'Finance active-application limit is invalid.',
            );
          }
          if (activeApplications >= maximumApplications) {
            throw new ConflictException(
              'Employee already has active finance applications.',
            );
          }
          const eligibility = await this.eligibilityService.evaluateEligibility(
            companyId,
            employeeId,
            product,
            dto.requested_amount,
            dto.requested_term_months,
            manager,
          );
          if (!eligibility.eligible) {
            throw new BadRequestException({
              message: 'Employee is not eligible for this product.',
              eligibility,
            });
          }
          const sequenceRows: unknown = await manager.query(
            "SELECT nextval('employee_finance_application_number_seq')::text AS application_number",
          );
          const allocatedNumber = recordValue(
            Array.isArray(sequenceRows) ? (sequenceRows as unknown[])[0] : null,
          ).application_number;
          if (
            !Array.isArray(sequenceRows) ||
            sequenceRows.length !== 1 ||
            typeof allocatedNumber !== 'string' ||
            !/^[1-9]\d*$/.test(allocatedNumber)
          ) {
            throw new InternalServerErrorException(
              'Finance application number allocation failed.',
            );
          }
          const applicationNumber = allocatedNumber;
          const productSnapshot = {
            ...product,
            requiredDocumentTypes: requiredDocumentTypes(
              {
                requiredDocumentTypes: product.requiredDocumentTypes ?? [],
                policyConfiguration: financePolicyConfiguration(product),
              },
              dto.requested_amount,
            ),
            policyConfiguration: financePolicyConfiguration(product),
          };
          const employeeSnapshot = {
            id: employee.id,
            employee_no: employee.employee_no,
            full_name: [
              employee.first_name,
              employee.middle_name,
              employee.last_name,
            ]
              .filter(Boolean)
              .join(' '),
            grade_id: employee.grade_id,
            hire_date: employee.hire_date,
          };
          const estimatedInstallment = EmployeeFinanceMoney.divide(
            dto.requested_amount,
            dto.requested_term_months,
          );
          const application = await applicationRepository.save(
            applicationRepository.create({
              companyId,
              employeeId,
              productId: product.id,
              applicationNo: `EFAPP-${companyId}-${applicationNumber.padStart(6, '0')}`,
              productType: product.productType,
              requestedAmount: dto.requested_amount,
              requestedTermMonths: dto.requested_term_months,
              purpose: dto.purpose.trim(),
              approvedAmount: null,
              approvedTermMonths: null,
              approvedInterestRate: null,
              estimatedInstallment,
              eligibilitySnapshot: eligibility,
              eligibilitySnapshotHash: eligibility.snapshotHash,
              productSnapshot,
              productSnapshotHash: hash(productSnapshot),
              employeeSnapshot,
              createdByCompanyUserId: actor.companyMembershipId ?? actor.id,
            }),
          );
          await this.auditService.log(
            {
              actor,
              action: 'finance.application.created',
              entityType: 'EMPLOYEE_FINANCE_APPLICATION',
              entityId: application.id,
              summary: {
                employee_id: employeeId,
                product_type: product.productType,
              },
            },
            manager,
          );
          return application;
        },
      );
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const code = (error.driverError as { code?: string }).code;
        if (code === '23505') {
          throw new ConflictException(
            'A conflicting finance application already exists.',
          );
        }
        if (['55P03', '40P01', '40001', '57014'].includes(code ?? '')) {
          throw new ServiceUnavailableException(
            'Finance is busy. Please retry this request shortly.',
          );
        }
      }
      throw error;
    }
  }

  async addDocument(
    actor: AuthenticatedUser,
    id: number,
    dto: CreateEmployeeFinanceApplicationDocumentDto,
  ) {
    const application = await this.getOwnedApplication(actor, id);
    if (
      ![
        EmployeeFinanceApplicationStatusEnum.DRAFT,
        EmployeeFinanceApplicationStatusEnum.RETURNED_FOR_CORRECTION,
      ].includes(application.status)
    ) {
      throw new ConflictException(
        'Documents can be added only before submission.',
      );
    }
    const document = await this.documentRepository.save(
      this.documentRepository.create({
        companyId: application.companyId,
        applicationId: application.id,
        documentType: dto.document_type.trim().toUpperCase(),
        documentId: dto.document_id ?? null,
        fileUrl: dto.file_url?.trim() ?? null,
        uploadedByCompanyUserId: actor.companyMembershipId ?? actor.id,
        status: 'UPLOADED',
        metadata: dto.metadata ?? null,
      }),
    );
    await this.auditService.log({
      actor,
      action: 'finance.application.document_added',
      entityType: 'EMPLOYEE_FINANCE_APPLICATION_DOCUMENT',
      entityId: document.id,
      summary: { application_id: application.id },
    });
    return document;
  }

  async uploadDocument(
    actor: AuthenticatedUser,
    id: number,
    dto: UploadEmployeeFinanceApplicationDocumentDto,
  ) {
    const application = await this.getOwnedApplication(actor, id);
    if (
      ![
        EmployeeFinanceApplicationStatusEnum.DRAFT,
        EmployeeFinanceApplicationStatusEnum.RETURNED_FOR_CORRECTION,
      ].includes(application.status)
    ) {
      throw new ConflictException(
        'Documents can be uploaded only before submission.',
      );
    }
    const storedFile = await this.filesService.savePrivateBase64File(dto.file, {
      directorySegments: [
        'documents',
        'employee-finance',
        `company-${application.companyId}`,
        `application-${application.id}`,
      ],
      fileNamePrefix: `finance-${application.id}-${dto.document_type.trim().toLowerCase()}`,
      allowedMimeTypes: EMPLOYEE_FINANCE_DOCUMENT_MIME_TYPES,
      maxFileSizeBytes: EMPLOYEE_FINANCE_DOCUMENT_MAX_BYTES,
      validateFileSignature: true,
    });
    const document = await this.addDocument(actor, id, {
      document_type: dto.document_type,
      file_url: storedFile.publicPath,
      metadata: {
        ...(dto.metadata ?? {}),
        file_name: storedFile.originalFileName,
        file_type: storedFile.mimeType,
        file_size: storedFile.fileSize,
        expires_on: dto.expires_on ?? null,
        storage: 'managed-private',
      },
    });
    return {
      ...document,
      fileUrl: this.documentDownloadUrl(application.id, document.id),
      file_url: this.documentDownloadUrl(application.id, document.id),
    };
  }

  async downloadDocument(
    actor: AuthenticatedUser,
    applicationId: number,
    documentId: number,
  ) {
    const application = await this.getAccessibleApplication(
      actor,
      applicationId,
    );
    const document = await this.documentRepository.findOne({
      where: {
        id: documentId,
        companyId: application.companyId,
        applicationId: application.id,
      },
    });
    if (!document) throw new NotFoundException('Finance document not found.');
    const buffer = await this.filesService.readManagedFile(document.fileUrl);
    if (!buffer) {
      throw new NotFoundException('Finance document file was not found.');
    }
    const metadata = recordValue(document.metadata);
    await this.auditService.log({
      actor,
      action: 'finance.application.document_downloaded',
      entityType: 'EMPLOYEE_FINANCE_APPLICATION_DOCUMENT',
      entityId: document.id,
      summary: { application_id: application.id },
    });
    return {
      buffer,
      fileName:
        typeof metadata.file_name === 'string' && metadata.file_name.trim()
          ? metadata.file_name
          : document.fileUrl
            ? basename(document.fileUrl)
            : `finance-document-${document.id}`,
      mimeType:
        typeof metadata.file_type === 'string' && metadata.file_type.trim()
          ? metadata.file_type
          : 'application/octet-stream',
    };
  }

  async listDocuments(actor: AuthenticatedUser, id: number) {
    const application = await this.getAccessibleApplication(actor, id);
    const documents = await this.documentRepository.find({
      where: {
        companyId: application.companyId,
        applicationId: application.id,
      },
      order: { id: 'ASC' },
    });
    return documents.map((document) => ({
      ...document,
      fileUrl: document.fileUrl
        ? this.documentDownloadUrl(application.id, document.id)
        : null,
      file_url: document.fileUrl
        ? this.documentDownloadUrl(application.id, document.id)
        : null,
    }));
  }

  async verifyDocument(
    actor: AuthenticatedUser,
    applicationId: number,
    documentId: number,
    dto: VerifyEmployeeFinanceApplicationDocumentDto,
  ) {
    const application = await this.getAccessibleApplication(
      actor,
      applicationId,
    );
    const document = await this.documentRepository.findOne({
      where: {
        id: documentId,
        companyId: application.companyId,
        applicationId: application.id,
      },
    });
    if (!document) throw new NotFoundException('Finance document not found.');
    const status = (dto.status ?? 'VERIFIED').trim().toUpperCase();
    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      throw new BadRequestException(
        'Document status must be VERIFIED or REJECTED.',
      );
    }
    document.status = status;
    document.verifiedByCompanyUserId = actor.companyMembershipId ?? actor.id;
    document.verifiedAt = new Date();
    document.metadata = {
      ...(document.metadata ?? {}),
      ...(dto.metadata ?? {}),
    };
    await this.auditService.log({
      actor,
      action: 'finance.application.document_verified',
      entityType: 'EMPLOYEE_FINANCE_APPLICATION_DOCUMENT',
      entityId: document.id,
      summary: { status, application_id: application.id },
    });
    return this.documentRepository.save(document);
  }

  async addGuarantor(
    actor: AuthenticatedUser,
    id: number,
    dto: CreateEmployeeFinanceGuarantorDto,
  ) {
    const application = await this.getOwnedApplication(actor, id);
    if (dto.guarantor_employee_id === application.employeeId) {
      throw new BadRequestException(
        'Applicant cannot guarantee their own loan.',
      );
    }
    if (
      ![
        EmployeeFinanceApplicationStatusEnum.DRAFT,
        EmployeeFinanceApplicationStatusEnum.RETURNED_FOR_CORRECTION,
      ].includes(application.status)
    ) {
      throw new ConflictException(
        'Guarantors can be added only before submission.',
      );
    }
    const guarantor = await this.employeeRepository.findOne({
      where: {
        id: dto.guarantor_employee_id,
        company_id: application.companyId,
      },
    });
    if (!guarantor)
      throw new NotFoundException('Guarantor employee not found.');
    const record = await this.guarantorRepository.save(
      this.guarantorRepository.create({
        companyId: application.companyId,
        applicationId: application.id,
        employeeId: application.employeeId,
        guarantorEmployeeId: guarantor.id,
        status: 'PENDING',
        snapshot: {
          employee_no: guarantor.employee_no,
          full_name: [
            guarantor.first_name,
            guarantor.middle_name,
            guarantor.last_name,
          ]
            .filter(Boolean)
            .join(' '),
        },
      }),
    );
    await this.auditService.log({
      actor,
      action: 'finance.application.guarantor_added',
      entityType: 'EMPLOYEE_FINANCE_APPLICATION_GUARANTOR',
      entityId: record.id,
      summary: { application_id: application.id },
    });
    return record;
  }

  async listGuarantors(actor: AuthenticatedUser, id: number) {
    const application = await this.getAccessibleApplication(actor, id);
    return this.guarantorRepository.find({
      where: {
        companyId: application.companyId,
        applicationId: application.id,
      },
      order: { id: 'ASC' },
    });
  }

  async listMyGuarantorRequests(actor: AuthenticatedUser) {
    if (!actor.employeeId) {
      throw new ForbiddenException('Employee profile is required.');
    }
    return this.guarantorRepository.find({
      where: {
        companyId: actor.companyId!,
        guarantorEmployeeId: actor.employeeId,
      },
      order: { id: 'DESC' },
    });
  }

  async decideGuarantor(
    actor: AuthenticatedUser,
    id: number,
    dto: DecideEmployeeFinanceGuarantorDto,
  ) {
    const guarantor = await this.guarantorRepository.findOne({
      where: { id, companyId: actor.companyId! },
    });
    if (!guarantor) throw new NotFoundException('Guarantor request not found.');
    if (
      actor.employeeId &&
      actor.employeeId !== guarantor.guarantorEmployeeId
    ) {
      throw new ForbiddenException(
        'Only the guarantor can decide this request.',
      );
    }
    const decision = dto.decision.trim().toUpperCase();
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      throw new BadRequestException('Decision must be APPROVED or REJECTED.');
    }
    guarantor.status = decision;
    guarantor.comments = dto.comments?.trim() ?? null;
    guarantor.decidedByCompanyUserId = actor.companyMembershipId ?? actor.id;
    guarantor.decidedAt = new Date();
    await this.auditService.log({
      actor,
      action: 'finance.application.guarantor_decided',
      entityType: 'EMPLOYEE_FINANCE_APPLICATION_GUARANTOR',
      entityId: guarantor.id,
      summary: { decision, application_id: guarantor.applicationId },
    });
    return this.guarantorRepository.save(guarantor);
  }

  async getSanctionLetter(actor: AuthenticatedUser, id: number) {
    const application = await this.getAccessibleApplication(actor, id);
    return this.sanctionLetterRepository.findOne({
      where: {
        companyId: application.companyId,
        applicationId: application.id,
      },
    });
  }

  async submitMine(actor: AuthenticatedUser, id: number) {
    const application = await this.getOwnedApplication(actor, id);
    if (application.status !== EmployeeFinanceApplicationStatusEnum.DRAFT) {
      throw new ConflictException('Only draft applications can be submitted.');
    }
    await this.assertApplicationReadyForSubmit(application);
    application.status = this.configService.get<boolean>(
      'EMPLOYEE_FINANCE_REQUIRE_MANAGER_RECOMMENDATION',
      true,
    )
      ? EmployeeFinanceApplicationStatusEnum.PENDING_MANAGER_RECOMMENDATION
      : this.configService.get<boolean>(
            'EMPLOYEE_FINANCE_REQUIRE_HR_APPROVAL',
            true,
          )
        ? EmployeeFinanceApplicationStatusEnum.PENDING_HR_APPROVAL
        : EmployeeFinanceApplicationStatusEnum.PENDING_FINANCE_APPROVAL;
    application.submittedAt = new Date();
    await this.auditService.log({
      actor,
      action: 'finance.application.submitted',
      entityType: 'EMPLOYEE_FINANCE_APPLICATION',
      entityId: application.id,
    });
    return this.applicationRepository.save(application);
  }

  async acceptMine(actor: AuthenticatedUser, id: number) {
    const application = await this.getOwnedApplication(actor, id);
    if (
      application.status !==
      EmployeeFinanceApplicationStatusEnum.PENDING_EMPLOYEE_ACCEPTANCE
    ) {
      throw new ConflictException(
        'Application is not awaiting employee acceptance.',
      );
    }
    const account = await this.accountService.createFromApplication(
      actor,
      application.id,
    );
    await this.auditService.log({
      actor,
      action: 'finance.application.accepted',
      entityType: 'EMPLOYEE_FINANCE_APPLICATION',
      entityId: application.id,
    });
    return account;
  }

  async withdrawMine(actor: AuthenticatedUser, id: number) {
    const application = await this.getOwnedApplication(actor, id);
    if (
      [
        EmployeeFinanceApplicationStatusEnum.APPROVED,
        EmployeeFinanceApplicationStatusEnum.DISBURSED,
      ].includes(application.status)
    ) {
      throw new ConflictException(
        'Approved or disbursed applications cannot be withdrawn.',
      );
    }
    application.status = EmployeeFinanceApplicationStatusEnum.WITHDRAWN;
    return this.applicationRepository.save(application);
  }

  listMine(actor: AuthenticatedUser) {
    if (!actor.employeeId)
      throw new ForbiddenException('Employee profile is required.');
    return this.applicationRepository.find({
      where: { companyId: actor.companyId!, employeeId: actor.employeeId },
      order: { id: 'DESC' },
    });
  }

  list(actor: AuthenticatedUser, query: EmployeeFinanceQueryDto) {
    const where: Record<string, unknown> = { companyId: actor.companyId! };
    if (query.employee_id) where.employeeId = query.employee_id;
    if (query.product_id) where.productId = query.product_id;
    if (query.status) where.status = query.status;
    return this.applicationRepository.find({ where, order: { id: 'DESC' } });
  }

  async getApplication(actor: AuthenticatedUser, id: number) {
    return this.getAccessibleApplication(actor, id);
  }

  private async getAccessibleApplication(actor: AuthenticatedUser, id: number) {
    const application = await this.applicationRepository.findOne({
      where: { id, companyId: actor.companyId! },
    });
    if (!application)
      throw new NotFoundException('Finance application not found.');
    if (actor.employeeId && actor.employeeId !== application.employeeId) {
      await this.hrAccessService.assertCanAccessEmployee(actor, {
        id: application.employeeId,
        company_id: application.companyId,
      } as Employee);
    }
    return application;
  }

  private async getOwnedApplication(actor: AuthenticatedUser, id: number) {
    if (!actor.employeeId)
      throw new ForbiddenException('Employee profile is required.');
    const application = await this.applicationRepository.findOne({
      where: { id, companyId: actor.companyId!, employeeId: actor.employeeId },
    });
    if (!application)
      throw new NotFoundException('Finance application not found.');
    return application;
  }

  private async assertApplicationReadyForSubmit(
    application: EmployeeFinanceApplication,
  ) {
    const productSnapshot = recordValue(application.productSnapshot);
    const requiredDocuments = requiredDocumentTypes(
      productSnapshot,
      application.requestedAmount,
    );
    const requiredGuarantors = requiredGuarantorCount(productSnapshot);
    const [documents, guarantors] = await Promise.all([
      this.documentRepository.find({
        where: {
          companyId: application.companyId,
          applicationId: application.id,
        },
      }),
      this.guarantorRepository.find({
        where: {
          companyId: application.companyId,
          applicationId: application.id,
        },
      }),
    ]);
    const uploadedTypes = new Set(
      documents
        .filter((document) => document.status !== 'REJECTED')
        .map((document) => document.documentType.trim().toUpperCase()),
    );
    const missingDocuments = requiredDocuments.filter(
      (documentType) => !uploadedTypes.has(documentType),
    );
    const activeGuarantors = guarantors.filter(
      (guarantor) => guarantor.status !== 'REJECTED',
    );
    const missingGuarantors = Math.max(
      0,
      requiredGuarantors - activeGuarantors.length,
    );
    if (missingDocuments.length > 0 || missingGuarantors > 0) {
      throw new BadRequestException({
        message: 'Finance application is missing required supporting records.',
        missing_documents: missingDocuments,
        missing_guarantors: missingGuarantors,
      });
    }
  }

  private documentDownloadUrl(applicationId: number, documentId: number) {
    return `/api/employee-finance/applications/${applicationId}/documents/${documentId}/download`;
  }
}

@Injectable()
export class EmployeeFinanceApprovalService {
  private readonly logger = new Logger(EmployeeFinanceApprovalService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly hrAccessService: HrAccessService,
    private readonly auditService: EmployeeFinanceAuditService,
    private readonly smsNotificationManagementService: SmsNotificationManagementService,
    private readonly notificationQueueService: NotificationQueueService,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(EmployeeFinanceApplication)
    private readonly applicationRepository: Repository<EmployeeFinanceApplication>,
    @InjectRepository(EmployeeFinanceApplicationApproval)
    private readonly approvalRepository: Repository<EmployeeFinanceApplicationApproval>,
    @InjectRepository(EmployeeFinanceApplicationDocument)
    private readonly documentRepository: Repository<EmployeeFinanceApplicationDocument>,
    @InjectRepository(EmployeeFinanceApplicationGuarantor)
    private readonly guarantorRepository: Repository<EmployeeFinanceApplicationGuarantor>,
    @InjectRepository(EmployeeFinanceSanctionLetter)
    private readonly sanctionLetterRepository: Repository<EmployeeFinanceSanctionLetter>,
  ) {}

  async approve(
    actor: AuthenticatedUser,
    id: number,
    dto: ApproveEmployeeFinanceApplicationDto,
  ) {
    const application = await this.applicationRepository.findOne({
      where: { id, companyId: actor.companyId! },
    });
    if (!application)
      throw new NotFoundException('Finance application not found.');
    if (actor.employeeId === application.employeeId) {
      throw new ForbiddenException(
        'Employee cannot approve their own finance application.',
      );
    }
    const expected = this.expectedStage(application.status);
    if (expected !== dto.stage) {
      throw new ConflictException(
        'Application is not waiting for this approval stage.',
      );
    }
    const currentHash = hash({
      requested_amount: application.requestedAmount,
      requested_term_months: application.requestedTermMonths,
      eligibility_hash: application.eligibilitySnapshotHash,
      product_hash: application.productSnapshotHash,
    });
    if (
      dto.snapshot_hash !== currentHash &&
      dto.snapshot_hash !== application.eligibilitySnapshotHash
    ) {
      throw new ConflictException(
        'Approval hash must match the current application snapshot.',
      );
    }
    if (dto.stage === EmployeeFinanceApprovalStageEnum.MANAGER) {
      const employee = await this.employeeRepository.findOne({
        where: {
          id: application.employeeId,
          company_id: application.companyId,
        },
      });
      if (!employee) throw new NotFoundException('Employee not found.');
      await this.hrAccessService.assertCanAccessEmployee(actor, employee);
    }
    const actorMembershipId = actor.companyMembershipId ?? actor.id;
    if (
      this.configService.get<boolean>(
        'EMPLOYEE_FINANCE_REQUIRE_DISTINCT_APPROVERS',
        true,
      )
    ) {
      const priorApproval = await this.approvalRepository.findOne({
        where: {
          companyId: application.companyId,
          applicationId: application.id,
          createdByCompanyUserId: actorMembershipId,
        },
      });
      if (priorApproval) {
        throw new ForbiddenException(
          'Finance approver cannot approve multiple stages for the same application.',
        );
      }
    }
    if (dto.approved_amount) application.approvedAmount = dto.approved_amount;
    if (dto.approved_term_months)
      application.approvedTermMonths = dto.approved_term_months;
    if (dto.stage === EmployeeFinanceApprovalStageEnum.FINANCE) {
      await this.assertFinalApprovalSupportReady(application);
    }
    const annualInterestRate =
      application.productSnapshot.annualInterestRate ?? '0';
    application.approvedInterestRate =
      application.approvedInterestRate ??
      (typeof annualInterestRate === 'string' ||
      typeof annualInterestRate === 'number'
        ? String(annualInterestRate)
        : '0');
    application.estimatedInstallment = EmployeeFinanceMoney.divide(
      application.approvedAmount ?? application.requestedAmount,
      application.approvedTermMonths ?? application.requestedTermMonths,
    );
    await this.approvalRepository.save(
      this.approvalRepository.create({
        companyId: application.companyId,
        applicationId: application.id,
        stage: dto.stage,
        decision:
          dto.stage === EmployeeFinanceApprovalStageEnum.MANAGER
            ? EmployeeFinanceDecisionEnum.RECOMMENDED
            : EmployeeFinanceDecisionEnum.APPROVED,
        snapshotHash: dto.snapshot_hash,
        approvedAmount: application.approvedAmount,
        approvedTermMonths: application.approvedTermMonths,
        createdByCompanyUserId: actorMembershipId,
        comments: dto.comments ?? null,
      }),
    );
    application.status = this.nextStatus(dto.stage);
    if (
      application.status ===
      EmployeeFinanceApplicationStatusEnum.PENDING_EMPLOYEE_ACCEPTANCE
    ) {
      application.approvedAt = new Date();
    }
    const action =
      dto.stage === EmployeeFinanceApprovalStageEnum.MANAGER
        ? 'finance.application.recommended'
        : dto.stage === EmployeeFinanceApprovalStageEnum.HR
          ? 'finance.application.hr_approved'
          : 'finance.application.finance_approved';
    await this.auditService.log({
      actor,
      action,
      entityType: 'EMPLOYEE_FINANCE_APPLICATION',
      entityId: application.id,
      summary: { stage: dto.stage },
    });
    const saved = await this.applicationRepository.save(application);

    if (
      saved.status ===
      EmployeeFinanceApplicationStatusEnum.PENDING_EMPLOYEE_ACCEPTANCE
    ) {
      await this.generateSanctionLetter(actor, saved);
      void this.notificationQueueService.enqueueSmsConfiguredNotification({
        code: 'employee_finance.application.approved',
        module: 'employee-finance',
        recipientEmployeeId: saved.employeeId,
        relatedEntityType: 'EMPLOYEE_FINANCE_APPLICATION',
        relatedEntityId: saved.id,
        actor,
        variables: {
          application_no: saved.applicationNo,
          product_type: saved.productType,
        },
      });
    }

    return saved;
  }

  private async assertFinalApprovalSupportReady(
    application: EmployeeFinanceApplication,
  ) {
    const productSnapshot = recordValue(application.productSnapshot);
    const requiredDocuments = requiredDocumentTypes(
      productSnapshot,
      application.requestedAmount,
    );
    const requiredGuarantors = requiredGuarantorCount(productSnapshot);
    const [documents, guarantors] = await Promise.all([
      this.documentRepository.find({
        where: {
          companyId: application.companyId,
          applicationId: application.id,
        },
      }),
      this.guarantorRepository.find({
        where: {
          companyId: application.companyId,
          applicationId: application.id,
        },
      }),
    ]);
    const verifiedTypes = new Set(
      documents
        .filter((document) => document.status === 'VERIFIED')
        .map((document) => document.documentType.trim().toUpperCase()),
    );
    const missingVerifiedDocuments = requiredDocuments.filter(
      (documentType) => !verifiedTypes.has(documentType),
    );
    const approvedGuarantors = guarantors.filter(
      (guarantor) => guarantor.status === 'APPROVED',
    );
    const missingApprovedGuarantors = Math.max(
      0,
      requiredGuarantors - approvedGuarantors.length,
    );
    if (missingVerifiedDocuments.length > 0 || missingApprovedGuarantors > 0) {
      throw new BadRequestException({
        message: 'Required loan documents or guarantors are not complete.',
        missing_verified_documents: missingVerifiedDocuments,
        missing_approved_guarantors: missingApprovedGuarantors,
      });
    }
  }

  private async generateSanctionLetter(
    actor: AuthenticatedUser,
    application: EmployeeFinanceApplication,
  ) {
    const existing = await this.sanctionLetterRepository.findOne({
      where: {
        companyId: application.companyId,
        applicationId: application.id,
      },
    });
    if (existing) {
      application.sanctionDocumentId = existing.id;
      await this.applicationRepository.save(application);
      return existing;
    }
    const amount = application.approvedAmount ?? application.requestedAmount;
    const term =
      application.approvedTermMonths ?? application.requestedTermMonths;
    const rate = application.approvedInterestRate ?? '0';
    const product = recordValue(application.productSnapshot);
    const employee = recordValue(application.employeeSnapshot);
    const employeeName =
      typeof employee.full_name === 'string' && employee.full_name.trim()
        ? employee.full_name
        : String(application.employeeId);
    const employeeNo =
      typeof employee.employee_no === 'string' && employee.employee_no.trim()
        ? employee.employee_no
        : String(application.employeeId);
    const productName =
      typeof product.name === 'string' && product.name.trim()
        ? product.name
        : application.productType;
    const snapshot = {
      application_id: application.id,
      application_no: application.applicationNo,
      employee,
      product_type: application.productType,
      product_name: productName,
      approved_amount: amount,
      approved_term_months: term,
      approved_interest_rate: rate,
      estimated_installment: application.estimatedInstallment,
      generated_at: new Date().toISOString(),
    };
    const content = [
      `Sanction Letter: ${application.applicationNo}`,
      `Employee: ${employeeName}`,
      `Employee No: ${employeeNo}`,
      `Loan Type: ${productName}`,
      `Approved Amount: ${amount}`,
      `Interest Rate: ${rate}`,
      `Repayment Period: ${term} months`,
      `Estimated Monthly Installment: ${application.estimatedInstallment ?? '0.00'}`,
      'Status: Approved subject to employee acceptance and disbursement confirmation.',
    ].join('\n');
    const letter = await this.sanctionLetterRepository.save(
      this.sanctionLetterRepository.create({
        companyId: application.companyId,
        applicationId: application.id,
        accountId: null,
        letterNo: `EFS-${application.companyId}-${String(application.id).padStart(6, '0')}`,
        content,
        snapshot,
        snapshotHash: hash(snapshot),
        generatedByCompanyUserId: actor.companyMembershipId ?? actor.id,
      }),
    );
    application.sanctionDocumentId = letter.id;
    await this.applicationRepository.save(application);
    await this.auditService.log({
      actor,
      action: 'finance.application.sanction_letter_generated',
      entityType: 'EMPLOYEE_FINANCE_SANCTION_LETTER',
      entityId: letter.id,
      summary: { application_id: application.id },
    });
    return letter;
  }

  private expectedStage(status: EmployeeFinanceApplicationStatusEnum) {
    if (
      status ===
      EmployeeFinanceApplicationStatusEnum.PENDING_MANAGER_RECOMMENDATION
    ) {
      return EmployeeFinanceApprovalStageEnum.MANAGER;
    }
    if (status === EmployeeFinanceApplicationStatusEnum.PENDING_HR_APPROVAL) {
      return EmployeeFinanceApprovalStageEnum.HR;
    }
    if (
      status === EmployeeFinanceApplicationStatusEnum.PENDING_FINANCE_APPROVAL
    ) {
      return EmployeeFinanceApprovalStageEnum.FINANCE;
    }
    return null;
  }

  private nextStatus(stage: EmployeeFinanceApprovalStageEnum) {
    if (stage === EmployeeFinanceApprovalStageEnum.MANAGER) {
      return this.configService.get<boolean>(
        'EMPLOYEE_FINANCE_REQUIRE_HR_APPROVAL',
        true,
      )
        ? EmployeeFinanceApplicationStatusEnum.PENDING_HR_APPROVAL
        : EmployeeFinanceApplicationStatusEnum.PENDING_FINANCE_APPROVAL;
    }
    if (stage === EmployeeFinanceApprovalStageEnum.HR) {
      return this.configService.get<boolean>(
        'EMPLOYEE_FINANCE_REQUIRE_FINANCE_APPROVAL',
        true,
      )
        ? EmployeeFinanceApplicationStatusEnum.PENDING_FINANCE_APPROVAL
        : EmployeeFinanceApplicationStatusEnum.PENDING_EMPLOYEE_ACCEPTANCE;
    }
    return EmployeeFinanceApplicationStatusEnum.PENDING_EMPLOYEE_ACCEPTANCE;
  }
}

@Injectable()
export class EmployeeFinanceDisbursementService {
  private readonly logger = new Logger(EmployeeFinanceDisbursementService.name);

  constructor(
    private readonly ledgerService: EmployeeFinanceLedgerService,
    private readonly auditService: EmployeeFinanceAuditService,
    private readonly smsNotificationManagementService: SmsNotificationManagementService,
    private readonly notificationQueueService: NotificationQueueService,
    @InjectRepository(EmployeeFinanceAccount)
    private readonly accountRepository: Repository<EmployeeFinanceAccount>,
    @InjectRepository(EmployeeFinanceApplication)
    private readonly applicationRepository: Repository<EmployeeFinanceApplication>,
    @InjectRepository(EmployeeFinanceDisbursement)
    private readonly repository: Repository<EmployeeFinanceDisbursement>,
  ) {}

  async create(
    actor: AuthenticatedUser,
    dto: CreateEmployeeFinanceDisbursementDto,
  ) {
    const account = await this.accountRepository.findOne({
      where: { id: dto.account_id, companyId: actor.companyId! },
    });
    if (!account) throw new NotFoundException('Finance account not found.');
    if (
      account.status !== EmployeeFinanceAccountStatusEnum.PENDING_DISBURSEMENT
    ) {
      throw new ConflictException('Account is not pending disbursement.');
    }
    return this.repository.save(
      this.repository.create({
        companyId: account.companyId,
        accountId: account.id,
        amount: dto.amount,
        paymentReference: dto.payment_reference.trim(),
        paymentDate: dto.payment_date,
        createdByCompanyUserId: actor.companyMembershipId ?? actor.id,
      }),
    );
  }

  async approve(actor: AuthenticatedUser, id: number) {
    const item = await this.repository.findOne({
      where: { id, companyId: actor.companyId! },
    });
    if (!item) throw new NotFoundException('Disbursement not found.');
    if (
      item.createdByCompanyUserId === (actor.companyMembershipId ?? actor.id)
    ) {
      throw new ForbiddenException('Disbursement maker cannot approve it.');
    }
    item.status = EmployeeFinanceDisbursementStatusEnum.APPROVED;
    item.approvedByCompanyUserId = actor.companyMembershipId ?? actor.id;
    return this.repository.save(item);
  }

  async confirm(actor: AuthenticatedUser, id: number) {
    const item = await this.repository.findOne({
      where: { id, companyId: actor.companyId! },
    });
    if (!item) throw new NotFoundException('Disbursement not found.');
    if (item.status === EmployeeFinanceDisbursementStatusEnum.CONFIRMED)
      return item;
    if (item.status !== EmployeeFinanceDisbursementStatusEnum.APPROVED) {
      throw new ConflictException(
        'Only approved disbursements can be confirmed.',
      );
    }
    const account = await this.accountRepository.findOne({
      where: { id: item.accountId, companyId: item.companyId },
    });
    if (!account) throw new NotFoundException('Finance account not found.');
    await this.ledgerService.post({
      companyId: item.companyId,
      accountId: item.accountId,
      entryType: EmployeeFinanceLedgerEntryTypeEnum.PRINCIPAL_DISBURSEMENT,
      direction: 'DEBIT',
      principalAmount: item.amount,
      effectiveDate: item.paymentDate,
      sourceType: 'DISBURSEMENT',
      sourceId: String(item.id),
      idempotencyKey: `disbursement:${item.id}`,
      postedByCompanyUserId: actor.companyMembershipId ?? actor.id,
    });
    item.status = EmployeeFinanceDisbursementStatusEnum.CONFIRMED;
    item.confirmedAt = new Date();
    await this.accountRepository.update(
      { id: account.id, companyId: account.companyId },
      {
        status: EmployeeFinanceAccountStatusEnum.ACTIVE,
        disbursedAt: new Date(),
      },
    );
    await this.applicationRepository.update(
      { id: account.applicationId, companyId: account.companyId },
      { status: EmployeeFinanceApplicationStatusEnum.DISBURSED },
    );
    await this.auditService.log({
      actor,
      action: 'finance.disbursement.confirmed',
      entityType: 'EMPLOYEE_FINANCE_DISBURSEMENT',
      entityId: item.id,
    });
    const saved = await this.repository.save(item);
    const application = await this.applicationRepository.findOne({
      where: { id: account.applicationId, companyId: account.companyId },
    });

    void this.notificationQueueService.enqueueSmsConfiguredNotification({
      code: 'employee_finance.disbursement.confirmed',
      module: 'employee-finance',
      recipientEmployeeId: account.employeeId,
      relatedEntityType: 'EMPLOYEE_FINANCE_DISBURSEMENT',
      relatedEntityId: saved.id,
      actor,
      variables: {
        application_no: application?.applicationNo ?? account.accountNo,
        product_type: account.productType,
      },
    });

    return saved;
  }
}

@Injectable()
export class EmployeeFinancePayrollInstructionService {
  constructor(
    private readonly ledgerService: EmployeeFinanceLedgerService,
    @InjectRepository(PayrollPeriod)
    private readonly periodRepository: Repository<PayrollPeriod>,
    @InjectRepository(EmployeeFinanceAccount)
    private readonly accountRepository: Repository<EmployeeFinanceAccount>,
    @InjectRepository(EmployeeFinanceInstallment)
    private readonly installmentRepository: Repository<EmployeeFinanceInstallment>,
    @InjectRepository(EmployeeFinancePayrollInstruction)
    private readonly instructionRepository: Repository<EmployeeFinancePayrollInstruction>,
  ) {}

  async generateForPeriod(companyId: number, payrollPeriodId: number) {
    const period = await this.periodRepository.findOne({
      where: { id: payrollPeriodId, companyId },
    });
    if (!period) throw new NotFoundException('Payroll period not found.');
    const installments = await this.installmentRepository
      .createQueryBuilder('installment')
      .innerJoin(
        EmployeeFinanceAccount,
        'account',
        'account.id = installment.accountId',
      )
      .where('installment.companyId = :companyId', { companyId })
      .andWhere('installment.dueDate <= :endDate', { endDate: period.endDate })
      .andWhere('installment.status IN (:...statuses)', {
        statuses: [
          EmployeeFinanceInstallmentStatusEnum.SCHEDULED,
          EmployeeFinanceInstallmentStatusEnum.PARTIALLY_PAID,
          EmployeeFinanceInstallmentStatusEnum.OVERDUE,
        ],
      })
      .andWhere('account.status IN (:...accountStatuses)', {
        accountStatuses: [
          EmployeeFinanceAccountStatusEnum.ACTIVE,
          EmployeeFinanceAccountStatusEnum.IN_ARREARS,
          EmployeeFinanceAccountStatusEnum.RESTRUCTURED,
        ],
      })
      .getMany();
    const instructions: EmployeeFinancePayrollInstruction[] = [];
    for (const installment of installments) {
      const existing = await this.instructionRepository.findOne({
        where: { installmentId: installment.id, payrollPeriodId },
      });
      if (existing) {
        instructions.push(existing);
        continue;
      }
      const account = await this.accountRepository.findOne({
        where: { id: installment.accountId, companyId },
      });
      if (!account) continue;
      instructions.push(
        await this.instructionRepository.save(
          this.instructionRepository.create({
            companyId,
            employeeId: installment.employeeId,
            accountId: installment.accountId,
            installmentId: installment.id,
            payrollPeriodId,
            componentCode:
              account.productType ===
              EmployeeFinanceProductTypeEnum.SALARY_ADVANCE
                ? 'SALARY_ADVANCE'
                : 'STAFF_LOAN',
            amount: EmployeeFinanceMoney.subtract(
              installment.totalDue,
              installment.paidAmount,
            ),
            snapshot: {
              account_no: account.accountNo,
              installment_number: installment.installmentNumber,
              due_date: installment.dueDate,
            },
          }),
        ),
      );
    }
    return instructions;
  }

  async reserveForPayrollRun(
    companyId: number,
    payrollPeriodId: number,
    payrollRunId: number,
    employeeId: number,
  ) {
    await this.generateForPeriod(companyId, payrollPeriodId);
    const instructions = await this.instructionRepository.find({
      where: {
        companyId,
        payrollPeriodId,
        employeeId,
        status: In([
          EmployeeFinancePayrollInstructionStatusEnum.OPEN,
          EmployeeFinancePayrollInstructionStatusEnum.RESERVED,
        ]),
      },
      order: { id: 'ASC' },
    });
    for (const instruction of instructions) {
      if (
        instruction.payrollRunId &&
        instruction.payrollRunId !== payrollRunId
      ) {
        throw new ConflictException(
          'Payroll instruction is already reserved by another run.',
        );
      }
      instruction.payrollRunId = payrollRunId;
      instruction.reservedAmount = instruction.amount;
      instruction.status = EmployeeFinancePayrollInstructionStatusEnum.RESERVED;
      await this.instructionRepository.save(instruction);
    }
    return instructions;
  }

  async setReservedAmount(
    instruction: EmployeeFinancePayrollInstruction,
    reservedAmount: string,
  ) {
    const deferredAmount = EmployeeFinanceMoney.subtract(
      instruction.amount,
      reservedAmount,
    );
    instruction.reservedAmount = reservedAmount;
    instruction.status = EmployeeFinancePayrollInstructionStatusEnum.RESERVED;
    instruction.snapshot = {
      ...(instruction.snapshot ?? {}),
      requested_amount: instruction.amount,
      reserved_amount: reservedAmount,
      deferred_amount: deferredAmount,
      deduction_shortfall: EmployeeFinanceMoney.toCents(deferredAmount) > 0n,
    };
    return this.instructionRepository.save(instruction);
  }

  async lockForPayrollRun(companyId: number, payrollRunId: number) {
    const instructions = await this.instructionRepository.find({
      where: {
        companyId,
        payrollRunId,
        status: EmployeeFinancePayrollInstructionStatusEnum.RESERVED,
      },
      order: { id: 'ASC' },
    });
    for (const instruction of instructions) {
      if (EmployeeFinanceMoney.toCents(instruction.reservedAmount) <= 0n) {
        instruction.status =
          EmployeeFinancePayrollInstructionStatusEnum.SHORTFALL;
        await this.instructionRepository.save(instruction);
        continue;
      }
      await this.postPayrollInstruction(instruction);
    }
  }

  private async postPayrollInstruction(
    instruction: EmployeeFinancePayrollInstruction,
  ) {
    const currentInstruction = await this.instructionRepository.findOne({
      where: {
        id: instruction.id,
        companyId: instruction.companyId,
      },
    });
    if (
      currentInstruction?.status ===
      EmployeeFinancePayrollInstructionStatusEnum.POSTED
    ) {
      return currentInstruction;
    }
    const installment = await this.installmentRepository.findOne({
      where: {
        id: instruction.installmentId,
        companyId: instruction.companyId,
        accountId: instruction.accountId,
      },
    });
    if (!installment)
      throw new NotFoundException('Finance installment not found.');
    const amountCents = EmployeeFinanceMoney.toCents(
      instruction.reservedAmount,
    );
    let remaining = amountCents;
    const feeCents =
      remaining < EmployeeFinanceMoney.toCents(installment.feeDue)
        ? remaining
        : EmployeeFinanceMoney.toCents(installment.feeDue);
    remaining -= feeCents;
    const interestCents =
      remaining < EmployeeFinanceMoney.toCents(installment.interestDue)
        ? remaining
        : EmployeeFinanceMoney.toCents(installment.interestDue);
    remaining -= interestCents;
    const principalCents = remaining;
    await this.ledgerService.post({
      companyId: instruction.companyId,
      accountId: instruction.accountId,
      installmentId: instruction.installmentId,
      entryType: EmployeeFinanceLedgerEntryTypeEnum.PAYROLL_REPAYMENT,
      direction: 'CREDIT',
      principalAmount: EmployeeFinanceMoney.fromCents(principalCents),
      interestAmount: EmployeeFinanceMoney.fromCents(interestCents),
      feeAmount: EmployeeFinanceMoney.fromCents(feeCents),
      effectiveDate: todayString(),
      sourceType: 'PAYROLL',
      sourceId: String(instruction.payrollRunId),
      idempotencyKey: `payroll:${instruction.payrollRunId}:${instruction.id}`,
    });
    installment.paidAmount = EmployeeFinanceMoney.add(
      installment.paidAmount,
      instruction.reservedAmount,
    );
    installment.status =
      EmployeeFinanceMoney.toCents(installment.paidAmount) >=
      EmployeeFinanceMoney.toCents(installment.totalDue)
        ? EmployeeFinanceInstallmentStatusEnum.PAID
        : EmployeeFinanceInstallmentStatusEnum.PARTIALLY_PAID;
    await this.installmentRepository.save(installment);
    instruction.postedAmount = instruction.reservedAmount;
    instruction.status = EmployeeFinancePayrollInstructionStatusEnum.POSTED;
    await this.instructionRepository.save(instruction);
  }
}

@Injectable()
export class EmployeeFinanceRepaymentService {
  constructor(
    private readonly ledgerService: EmployeeFinanceLedgerService,
    @InjectRepository(EmployeeFinanceAccount)
    private readonly accountRepository: Repository<EmployeeFinanceAccount>,
    @InjectRepository(EmployeeFinanceInstallment)
    private readonly installmentRepository: Repository<EmployeeFinanceInstallment>,
    @InjectRepository(EmployeeFinanceRepayment)
    private readonly repaymentRepository: Repository<EmployeeFinanceRepayment>,
    @InjectRepository(EmployeeFinanceRepaymentAllocation)
    private readonly allocationRepository: Repository<EmployeeFinanceRepaymentAllocation>,
  ) {}

  async create(
    actor: AuthenticatedUser,
    dto: CreateEmployeeFinanceRepaymentDto,
  ) {
    const account = await this.accountRepository.findOne({
      where: { id: dto.account_id, companyId: actor.companyId! },
    });
    if (!account) throw new NotFoundException('Finance account not found.');
    return this.repaymentRepository.save(
      this.repaymentRepository.create({
        companyId: account.companyId,
        accountId: account.id,
        repaymentType: dto.repayment_type ?? 'DIRECT_REPAYMENT',
        amount: dto.amount,
        paymentReference: dto.payment_reference ?? null,
        paymentDate: dto.payment_date,
        createdByCompanyUserId: actor.companyMembershipId ?? actor.id,
      }),
    );
  }

  async approve(actor: AuthenticatedUser, id: number) {
    const repayment = await this.repaymentRepository.findOne({
      where: { id, companyId: actor.companyId! },
    });
    if (!repayment) throw new NotFoundException('Repayment not found.');
    if (
      repayment.createdByCompanyUserId ===
      (actor.companyMembershipId ?? actor.id)
    ) {
      throw new ForbiddenException('Repayment maker cannot approve it.');
    }
    repayment.status = EmployeeFinanceRepaymentStatusEnum.APPROVED;
    repayment.approvedByCompanyUserId = actor.companyMembershipId ?? actor.id;
    await this.postRepayment(repayment);
    return this.repaymentRepository.save(repayment);
  }

  private async postRepayment(repayment: EmployeeFinanceRepayment) {
    if (repayment.status === EmployeeFinanceRepaymentStatusEnum.POSTED)
      return repayment;
    let remaining = EmployeeFinanceMoney.toCents(repayment.amount);
    const installments = await this.installmentRepository.find({
      where: {
        companyId: repayment.companyId,
        accountId: repayment.accountId,
        status: In([
          EmployeeFinanceInstallmentStatusEnum.SCHEDULED,
          EmployeeFinanceInstallmentStatusEnum.PARTIALLY_PAID,
          EmployeeFinanceInstallmentStatusEnum.OVERDUE,
        ]),
      },
      order: { dueDate: 'ASC', id: 'ASC' },
    });
    for (const installment of installments) {
      if (remaining <= 0n) break;
      const due = EmployeeFinanceMoney.toCents(
        EmployeeFinanceMoney.subtract(
          installment.totalDue,
          installment.paidAmount,
        ),
      );
      const applied = remaining > due ? due : remaining;
      remaining -= applied;
      installment.paidAmount = EmployeeFinanceMoney.add(
        installment.paidAmount,
        EmployeeFinanceMoney.fromCents(applied),
      );
      installment.status =
        EmployeeFinanceMoney.toCents(installment.paidAmount) >=
        EmployeeFinanceMoney.toCents(installment.totalDue)
          ? EmployeeFinanceInstallmentStatusEnum.PAID
          : EmployeeFinanceInstallmentStatusEnum.PARTIALLY_PAID;
      await this.installmentRepository.save(installment);
      await this.allocationRepository.save(
        this.allocationRepository.create({
          companyId: repayment.companyId,
          repaymentId: repayment.id,
          installmentId: installment.id,
          principalAmount: EmployeeFinanceMoney.fromCents(applied),
          interestAmount: '0.00',
          feeAmount: '0.00',
        }),
      );
    }
    await this.ledgerService.post({
      companyId: repayment.companyId,
      accountId: repayment.accountId,
      entryType:
        repayment.repaymentType === 'ADDITIONAL_REPAYMENT'
          ? EmployeeFinanceLedgerEntryTypeEnum.ADDITIONAL_REPAYMENT
          : EmployeeFinanceLedgerEntryTypeEnum.DIRECT_REPAYMENT,
      direction: 'CREDIT',
      principalAmount: repayment.amount,
      effectiveDate: repayment.paymentDate,
      sourceType: 'REPAYMENT',
      sourceId: String(repayment.id),
      idempotencyKey: `repayment:${repayment.id}`,
    });
    repayment.status = EmployeeFinanceRepaymentStatusEnum.POSTED;
    return repayment;
  }
}

@Injectable()
export class EmployeeFinanceSettlementService {
  constructor(
    private readonly configService: ConfigService,
    private readonly ledgerService: EmployeeFinanceLedgerService,
    @InjectRepository(EmployeeFinanceAccount)
    private readonly accountRepository: Repository<EmployeeFinanceAccount>,
    @InjectRepository(EmployeeFinanceSettlementQuote)
    private readonly quoteRepository: Repository<EmployeeFinanceSettlementQuote>,
  ) {}

  async quote(actor: AuthenticatedUser, accountId: number) {
    const account = await this.accountRepository.findOne({
      where: { id: accountId, companyId: actor.companyId! },
    });
    if (!account) throw new NotFoundException('Finance account not found.');
    const balance = await this.ledgerService.calculateBalance(
      account.companyId,
      account.id,
    );
    const validDays = this.configService.get<number>(
      'EMPLOYEE_FINANCE_SETTLEMENT_QUOTE_VALID_DAYS',
      7,
    );
    const validUntil = addDaysString(todayString(), validDays);
    const snapshot = {
      account_id: account.id,
      balance,
      generated_at: new Date().toISOString(),
    };
    return this.quoteRepository.save(
      this.quoteRepository.create({
        companyId: account.companyId,
        accountId: account.id,
        quoteNo: `EFQ-${account.companyId}-${account.id}-${Date.now()}`,
        settlementAmount: balance.total,
        validUntil,
        snapshot,
        snapshotHash: hash(snapshot),
      }),
    );
  }
}

@Injectable()
export class EmployeeFinanceDefermentService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(EmployeeFinanceProduct)
    private readonly productRepository: Repository<EmployeeFinanceProduct>,
    @InjectRepository(EmployeeFinanceAccount)
    private readonly accountRepository: Repository<EmployeeFinanceAccount>,
    @InjectRepository(EmployeeFinanceInstallment)
    private readonly installmentRepository: Repository<EmployeeFinanceInstallment>,
    @InjectRepository(EmployeeFinanceDefermentRequest)
    private readonly defermentRepository: Repository<EmployeeFinanceDefermentRequest>,
  ) {}

  async request(
    actor: AuthenticatedUser,
    accountId: number,
    dto: RequestEmployeeFinanceDefermentDto,
  ) {
    const account = await this.accountRepository.findOne({
      where: { id: accountId, companyId: actor.companyId! },
    });
    if (!account) throw new NotFoundException('Finance account not found.');
    const product = await this.productRepository.findOne({
      where: { id: account.productId, companyId: account.companyId },
    });
    if (!product?.allowDeferment) {
      throw new ConflictException(
        'This product does not allow installment deferment.',
      );
    }
    const count = await this.defermentRepository.count({
      where: { companyId: account.companyId, accountId: account.id },
    });
    if (
      count >=
      this.configService.get<number>(
        'EMPLOYEE_FINANCE_MAX_DEFERMENTS_PER_YEAR',
        2,
      )
    ) {
      throw new ConflictException('Maximum deferments reached.');
    }
    const installment = await this.installmentRepository.findOne({
      where: { id: dto.installment_id, accountId: account.id },
    });
    if (!installment) throw new NotFoundException('Installment not found.');
    if (installment.status === EmployeeFinanceInstallmentStatusEnum.PAID) {
      throw new ConflictException('Paid installments cannot be deferred.');
    }
    installment.status = EmployeeFinanceInstallmentStatusEnum.DEFERRED;
    await this.installmentRepository.save(installment);
    return this.defermentRepository.save(
      this.defermentRepository.create({
        companyId: account.companyId,
        accountId: account.id,
        installmentId: installment.id,
        reason: dto.reason,
        status: 'APPROVED',
      }),
    );
  }
}

@Injectable()
export class EmployeeFinanceRescheduleService {
  constructor(
    @InjectRepository(EmployeeFinanceProduct)
    private readonly productRepository: Repository<EmployeeFinanceProduct>,
    @InjectRepository(EmployeeFinanceAccount)
    private readonly accountRepository: Repository<EmployeeFinanceAccount>,
    @InjectRepository(EmployeeFinanceReschedule)
    private readonly rescheduleRepository: Repository<EmployeeFinanceReschedule>,
  ) {}

  async request(
    actor: AuthenticatedUser,
    accountId: number,
    dto: RequestEmployeeFinanceRescheduleDto,
  ) {
    const account = await this.accountRepository.findOne({
      where: { id: accountId, companyId: actor.companyId! },
    });
    if (!account) throw new NotFoundException('Finance account not found.');
    const product = await this.productRepository.findOne({
      where: { id: account.productId, companyId: account.companyId },
    });
    if (!product?.allowRescheduling) {
      throw new ConflictException('This product does not allow rescheduling.');
    }
    const reschedule = await this.rescheduleRepository.save(
      this.rescheduleRepository.create({
        companyId: account.companyId,
        accountId: account.id,
        oldScheduleVersion: account.scheduleVersion,
        newScheduleVersion: account.scheduleVersion + 1,
        newTermMonths: dto.new_term_months,
        reason: dto.reason,
        status: 'APPROVED',
      }),
    );
    account.scheduleVersion += 1;
    account.termMonths = dto.new_term_months;
    account.status = EmployeeFinanceAccountStatusEnum.RESTRUCTURED;
    await this.accountRepository.save(account);
    return reschedule;
  }
}

@Injectable()
export class EmployeeFinanceExitRecoveryService {
  constructor(
    @InjectRepository(EmployeeFinanceAccount)
    private readonly accountRepository: Repository<EmployeeFinanceAccount>,
    @InjectRepository(EmployeeFinanceExitRecovery)
    private readonly exitRecoveryRepository: Repository<EmployeeFinanceExitRecovery>,
    @InjectRepository(OffboardingRequest)
    private readonly offboardingRepository: Repository<OffboardingRequest>,
    @InjectRepository(OffboardingSettlementItem)
    private readonly settlementItemRepository: Repository<OffboardingSettlementItem>,
  ) {}

  async createForOffboarding(companyId: number, offboardingRequestId: number) {
    const offboarding = await this.offboardingRepository.findOne({
      where: { id: offboardingRequestId, company_id: companyId },
    });
    if (!offboarding)
      throw new NotFoundException('Offboarding request not found.');
    const accounts = await this.accountRepository.find({
      where: {
        companyId,
        employeeId: offboarding.employee_id,
        status: In(activeAccountStatuses()),
      },
    });
    const recoveries: EmployeeFinanceExitRecovery[] = [];
    for (const account of accounts) {
      const snapshot = {
        account_id: account.id,
        account_no: account.accountNo,
        product_type: account.productType,
        outstanding_total: account.outstandingTotal,
      };
      const recovery =
        (await this.exitRecoveryRepository.findOne({
          where: { offboardingRequestId, accountId: account.id },
        })) ??
        (await this.exitRecoveryRepository.save(
          this.exitRecoveryRepository.create({
            companyId,
            offboardingRequestId,
            employeeId: offboarding.employee_id,
            accountId: account.id,
            recoveryAmount: account.outstandingTotal,
            snapshot,
            snapshotHash: hash(snapshot),
          }),
        ));
      await this.settlementItemRepository.save(
        this.settlementItemRepository.create({
          company_id: companyId,
          offboarding_request_id: offboardingRequestId,
          item_type:
            account.productType ===
            EmployeeFinanceProductTypeEnum.SALARY_ADVANCE
              ? OffboardingSettlementItemTypeEnum.SALARY_ADVANCE_RECOVERY
              : OffboardingSettlementItemTypeEnum.LOAN_RECOVERY,
          title:
            account.productType ===
            EmployeeFinanceProductTypeEnum.SALARY_ADVANCE
              ? 'Salary advance recovery'
              : 'Staff loan recovery',
          status: OffboardingSettlementStatusEnum.PENDING,
          amount: account.outstandingTotal,
          currency: 'TZS',
          source_type:
            account.productType ===
            EmployeeFinanceProductTypeEnum.SALARY_ADVANCE
              ? OffboardingSettlementSourceEnum.ADVANCE_EXTERNAL
              : OffboardingSettlementSourceEnum.LOAN_EXTERNAL,
          source_reference: account.accountNo,
          calculation_snapshot: snapshot,
          metadata: { employee_finance_exit_recovery_id: recovery.id },
        }),
      );
      account.status = EmployeeFinanceAccountStatusEnum.EXIT_RECOVERY;
      await this.accountRepository.save(account);
      recoveries.push(recovery);
    }
    return recoveries;
  }
}

@Injectable()
export class EmployeeFinancePaymentImportService {
  constructor(
    private readonly configService: ConfigService,
    private readonly filesService: FilesService,
    private readonly disbursementService: EmployeeFinanceDisbursementService,
    private readonly repaymentService: EmployeeFinanceRepaymentService,
    private readonly auditService: EmployeeFinanceAuditService,
    @InjectRepository(EmployeeFinanceDisbursement)
    private readonly disbursementRepository: Repository<EmployeeFinanceDisbursement>,
    @InjectRepository(EmployeeFinanceRepayment)
    private readonly repaymentRepository: Repository<EmployeeFinanceRepayment>,
  ) {}

  async importFile(
    actor: AuthenticatedUser,
    dto: ImportEmployeeFinancePaymentFileDto,
  ) {
    const storedFile = await this.filesService.savePrivateBase64File(dto.file, {
      directorySegments: [
        'imports',
        'employee-finance',
        `company-${actor.companyId!}`,
      ],
      fileNamePrefix: 'finance-payments',
      allowedMimeTypes: [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      maxFileSizeBytes: 5 * 1024 * 1024,
    });
    const buffer = await this.filesService.readManagedFile(
      storedFile.publicPath,
    );
    const rows = await this.parsePaymentRows(
      buffer ?? Buffer.alloc(0),
      storedFile.mimeType,
      storedFile.originalFileName,
    );
    const results: Record<string, unknown>[] = [];
    for (const row of rows) {
      results.push(await this.matchRow(actor, row, dto.dry_run !== false));
    }
    const summary = {
      imported_rows: rows.length,
      matched_rows: results.filter((row) => row.matched).length,
      posted_rows: results.filter((row) => row.action === 'POSTED').length,
      issue_rows: results.filter((row) => row.issue).length,
      dry_run: dto.dry_run !== false,
      file_path: storedFile.publicPath,
    };
    await this.auditService.log({
      actor,
      action: 'finance.payment_file.imported',
      entityType: 'EMPLOYEE_FINANCE_PAYMENT_IMPORT',
      entityId: storedFile.storedFileName,
      summary,
    });
    return { summary, rows: results };
  }

  private async matchRow(
    actor: AuthenticatedUser,
    row: Record<string, string>,
    dryRun: boolean,
  ) {
    const mapping = this.bankColumnMap();
    const reference = this.firstMappedValue(row, mapping.reference).trim();
    const amount = this.firstMappedValue(row, mapping.amount).trim();
    const status = normalizeImportStatus(
      this.firstMappedValue(row, mapping.status),
    );
    if (!reference) {
      return { row, matched: false, issue: 'MISSING_REFERENCE' };
    }
    const disbursement = await this.disbursementRepository.findOne({
      where: { companyId: actor.companyId!, paymentReference: reference },
    });
    if (disbursement) {
      return this.matchDisbursement(
        actor,
        disbursement,
        amount,
        status,
        dryRun,
      );
    }
    const repayment = await this.repaymentRepository.findOne({
      where: { companyId: actor.companyId!, paymentReference: reference },
    });
    if (repayment) {
      return this.matchRepayment(actor, repayment, amount, status, dryRun);
    }
    return { row, reference, matched: false, issue: 'NO_MATCH' };
  }

  private async matchDisbursement(
    actor: AuthenticatedUser,
    disbursement: EmployeeFinanceDisbursement,
    amount: string,
    status: string,
    dryRun: boolean,
  ) {
    const issue =
      amount && amount !== disbursement.amount
        ? 'AMOUNT_MISMATCH'
        : status === 'FAILED'
          ? 'BANK_REPORTED_FAILED'
          : status === 'PARTIAL'
            ? 'BANK_REPORTED_PARTIAL'
            : null;
    if (issue || dryRun) {
      return {
        matched: true,
        entity_type: 'DISBURSEMENT',
        entity_id: disbursement.id,
        reference: disbursement.paymentReference,
        issue,
        action: dryRun ? 'DRY_RUN' : 'REVIEW_REQUIRED',
      };
    }
    if (
      disbursement.status === EmployeeFinanceDisbursementStatusEnum.APPROVED
    ) {
      try {
        await this.disbursementService.confirm(actor, disbursement.id);
        return {
          matched: true,
          entity_type: 'DISBURSEMENT',
          entity_id: disbursement.id,
          reference: disbursement.paymentReference,
          action: 'POSTED',
        };
      } catch (error) {
        return {
          matched: true,
          entity_type: 'DISBURSEMENT',
          entity_id: disbursement.id,
          reference: disbursement.paymentReference,
          issue: error instanceof Error ? error.message : 'POST_FAILED',
          action: 'REVIEW_REQUIRED',
        };
      }
    }
    return {
      matched: true,
      entity_type: 'DISBURSEMENT',
      entity_id: disbursement.id,
      reference: disbursement.paymentReference,
      issue: `UNPOSTABLE_STATUS_${disbursement.status}`,
      action: 'REVIEW_REQUIRED',
    };
  }

  private async matchRepayment(
    actor: AuthenticatedUser,
    repayment: EmployeeFinanceRepayment,
    amount: string,
    status: string,
    dryRun: boolean,
  ) {
    const issue =
      amount && amount !== repayment.amount
        ? 'AMOUNT_MISMATCH'
        : status === 'FAILED'
          ? 'BANK_REPORTED_FAILED'
          : status === 'PARTIAL'
            ? 'BANK_REPORTED_PARTIAL'
            : null;
    if (issue || dryRun) {
      return {
        matched: true,
        entity_type: 'REPAYMENT',
        entity_id: repayment.id,
        reference: repayment.paymentReference,
        issue,
        action: dryRun ? 'DRY_RUN' : 'REVIEW_REQUIRED',
      };
    }
    if (
      repayment.status === EmployeeFinanceRepaymentStatusEnum.DRAFT ||
      repayment.status === EmployeeFinanceRepaymentStatusEnum.APPROVED
    ) {
      try {
        await this.repaymentService.approve(actor, repayment.id);
        return {
          matched: true,
          entity_type: 'REPAYMENT',
          entity_id: repayment.id,
          reference: repayment.paymentReference,
          action: 'POSTED',
        };
      } catch (error) {
        return {
          matched: true,
          entity_type: 'REPAYMENT',
          entity_id: repayment.id,
          reference: repayment.paymentReference,
          issue: error instanceof Error ? error.message : 'POST_FAILED',
          action: 'REVIEW_REQUIRED',
        };
      }
    }
    return {
      matched: true,
      entity_type: 'REPAYMENT',
      entity_id: repayment.id,
      reference: repayment.paymentReference,
      issue: `UNPOSTABLE_STATUS_${repayment.status}`,
      action: 'REVIEW_REQUIRED',
    };
  }

  private async parsePaymentRows(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
  ) {
    const lowerName = fileName.toLowerCase();
    if (
      mimeType ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      lowerName.endsWith('.xlsx')
    ) {
      return this.parseXlsx(buffer);
    }
    return this.parseCsv(buffer.toString('utf8'));
  }

  private parseCsv(content: string) {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) return [];
    const headers = this.splitCsvLine(lines[0]).map((header) =>
      header.trim().toLowerCase(),
    );
    return lines.slice(1).map((line) => {
      const values = this.splitCsvLine(line);
      return Object.fromEntries(
        headers.map((header, index) => [header, values[index]?.trim() ?? '']),
      );
    });
  }

  private splitCsvLine(line: string) {
    const values: string[] = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === ',' && !quoted) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  }

  private async parseXlsx(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) return [];
    const headers = this.excelRowValues(worksheet.getRow(1)).map((header) =>
      header.trim().toLowerCase(),
    );
    const rows: Record<string, string>[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = this.excelRowValues(row);
      if (values.every((value) => !value.trim())) return;
      rows.push(
        Object.fromEntries(
          headers.map((header, index) => [header, values[index]?.trim() ?? '']),
        ),
      );
    });
    return rows;
  }

  private excelRowValues(row: ExcelJS.Row) {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    return values.map((value) => this.excelCellValueToString(value));
  }

  private excelCellValueToString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean')
      return String(value);
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if ('text' in record) return this.excelCellValueToString(record.text);
      if ('result' in record) return this.excelCellValueToString(record.result);
      if (Array.isArray(record.richText)) {
        return record.richText
          .map((entry) =>
            this.excelCellValueToString(
              (entry as Record<string, unknown>).text,
            ),
          )
          .join('');
      }
    }
    return '';
  }

  private bankColumnMap() {
    const fallback = {
      reference: ['payment_reference', 'reference', 'transaction_reference'],
      amount: ['amount', 'paid_amount', 'transaction_amount'],
      status: ['status', 'result', 'payment_status'],
    };
    const raw = this.configService.get<string>(
      'EMPLOYEE_FINANCE_BANK_IMPORT_COLUMN_MAP',
    );
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        reference: this.stringArray(parsed.reference, fallback.reference),
        amount: this.stringArray(parsed.amount, fallback.amount),
        status: this.stringArray(parsed.status, fallback.status),
      };
    } catch {
      return fallback;
    }
  }

  private stringArray(value: unknown, fallback: string[]) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : fallback;
  }

  private firstMappedValue(row: Record<string, string>, keys: string[]) {
    for (const key of keys) {
      const value = row[key.trim().toLowerCase()];
      if (value !== undefined) return value;
    }
    return '';
  }
}

@Injectable()
export class EmployeeFinanceAccountingPostingService {
  constructor(
    private readonly configService: ConfigService,
    private readonly auditService: EmployeeFinanceAuditService,
    @InjectRepository(EmployeeFinanceLedgerEntry)
    private readonly ledgerRepository: Repository<EmployeeFinanceLedgerEntry>,
  ) {}

  async post(actor: AuthenticatedUser, dto: PostEmployeeFinanceAccountingDto) {
    const companyId = actor.companyId!;
    let entries = await this.ledgerRepository.find({
      where: { companyId },
      order: { effectiveDate: 'ASC', id: 'ASC' },
    });
    entries = entries.filter((entry) => {
      if (dto.date_from && entry.effectiveDate < dto.date_from) return false;
      if (dto.date_to && entry.effectiveDate > dto.date_to) return false;
      return true;
    });
    const journals = entries.map((entry) => ({
      external_id: `employee-finance-ledger-${entry.id}`,
      account_id: entry.accountId,
      entry_type: entry.entryType,
      direction: entry.direction,
      amount: entry.totalAmount,
      principal_amount: entry.principalAmount,
      interest_amount: entry.interestAmount,
      fee_amount: entry.feeAmount,
      effective_date: entry.effectiveDate,
      source_type: entry.sourceType,
      source_id: entry.sourceId,
      idempotency_key: entry.idempotencyKey,
    }));
    const provider = dto.provider ?? 'webhook';
    const endpoint = this.configService.get<string>(
      'EMPLOYEE_FINANCE_ERP_POST_URL',
    );
    const dryRun = dto.dry_run !== false || !endpoint;
    let providerResponse: unknown = null;
    if (!dryRun && endpoint) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.erpHeaders(),
        body: JSON.stringify({ provider, company_id: companyId, journals }),
      });
      providerResponse = {
        status: response.status,
        ok: response.ok,
        body: await response.text(),
      };
      if (!response.ok) {
        throw new BadRequestException({
          message: 'ERP posting endpoint rejected the journal batch.',
          providerResponse,
        });
      }
    }
    const summary = {
      provider,
      dry_run: dryRun,
      journal_count: journals.length,
      endpoint_configured: Boolean(endpoint),
    };
    await this.auditService.log({
      actor,
      action: 'finance.accounting.posted',
      entityType: 'EMPLOYEE_FINANCE_ACCOUNTING_POST',
      entityId: `${companyId}-${Date.now()}`,
      summary,
    });
    return { summary, journals, providerResponse };
  }

  private erpHeaders() {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    const authType = (
      this.configService.get<string>('EMPLOYEE_FINANCE_ERP_AUTH_TYPE') ?? 'none'
    )
      .trim()
      .toLowerCase();
    if (authType === 'bearer') {
      const token = this.configService.get<string>(
        'EMPLOYEE_FINANCE_ERP_AUTH_TOKEN',
      );
      if (token) headers.authorization = `Bearer ${token}`;
    } else if (authType === 'api-key') {
      const header =
        this.configService.get<string>('EMPLOYEE_FINANCE_ERP_API_KEY_HEADER') ??
        'x-api-key';
      const value = this.configService.get<string>(
        'EMPLOYEE_FINANCE_ERP_API_KEY',
      );
      if (value) headers[header] = value;
    } else if (authType === 'basic') {
      const username = this.configService.get<string>(
        'EMPLOYEE_FINANCE_ERP_BASIC_USERNAME',
      );
      const password = this.configService.get<string>(
        'EMPLOYEE_FINANCE_ERP_BASIC_PASSWORD',
      );
      if (username && password) {
        headers.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
      }
    }
    return headers;
  }
}

@Injectable()
export class EmployeeFinanceReportsService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(EmployeeFinanceApplication)
    private readonly applicationRepository: Repository<EmployeeFinanceApplication>,
    @InjectRepository(EmployeeFinanceAccount)
    private readonly accountRepository: Repository<EmployeeFinanceAccount>,
    @InjectRepository(EmployeeFinanceInstallment)
    private readonly installmentRepository: Repository<EmployeeFinanceInstallment>,
    @InjectRepository(EmployeeFinanceDisbursement)
    private readonly disbursementRepository: Repository<EmployeeFinanceDisbursement>,
    @InjectRepository(EmployeeFinanceRepayment)
    private readonly repaymentRepository: Repository<EmployeeFinanceRepayment>,
    @InjectRepository(EmployeeFinanceSettlementQuote)
    private readonly settlementQuoteRepository: Repository<EmployeeFinanceSettlementQuote>,
    @InjectRepository(EmployeeFinanceAuditLog)
    private readonly auditRepository: Repository<EmployeeFinanceAuditLog>,
  ) {}

  async dashboard(actor: AuthenticatedUser) {
    const companyId = actor.companyId!;
    const [pendingApplications, activeAccounts, arrearsAccounts, accounts] =
      await Promise.all([
        this.applicationRepository.count({
          where: {
            companyId,
            status: In([
              EmployeeFinanceApplicationStatusEnum.PENDING_MANAGER_RECOMMENDATION,
              EmployeeFinanceApplicationStatusEnum.PENDING_HR_APPROVAL,
              EmployeeFinanceApplicationStatusEnum.PENDING_FINANCE_APPROVAL,
              EmployeeFinanceApplicationStatusEnum.PENDING_EMPLOYEE_ACCEPTANCE,
            ]),
          },
        }),
        this.accountRepository.count({
          where: { companyId, status: In(activeAccountStatuses()) },
        }),
        this.accountRepository.count({
          where: {
            companyId,
            status: EmployeeFinanceAccountStatusEnum.IN_ARREARS,
          },
        }),
        this.accountRepository.find({ where: { companyId } }),
      ]);
    return {
      pendingApplications,
      activeAccounts,
      arrearsAccounts,
      outstanding: accounts.reduce(
        (sum, account) =>
          EmployeeFinanceMoney.add(sum, account.outstandingTotal),
        '0.00',
      ),
    };
  }

  catalog() {
    return [
      {
        type: 'aging',
        label: 'Aging',
        description: 'Outstanding balances grouped by overdue age bucket.',
        chart: 'bucket-bar',
      },
      {
        type: 'exposure',
        label: 'Outstanding exposure',
        description: 'Loan exposure by product and account status.',
        chart: 'status-product',
      },
      {
        type: 'repayment-performance',
        label: 'Repayment performance',
        description: 'Collections, repayment rows, and collection rate.',
        chart: 'collection-rate',
      },
      {
        type: 'disbursements',
        label: 'Disbursements',
        description: 'Disbursement volume and bank reference status.',
        chart: 'amount-summary',
      },
      {
        type: 'settlements',
        label: 'Settlements',
        description: 'Settlement quote totals and validity status.',
        chart: 'amount-summary',
      },
      {
        type: 'default-risk',
        label: 'Default risk',
        description: 'Accounts with overdue schedule and risk buckets.',
        chart: 'risk-bucket',
      },
      {
        type: 'support-compliance',
        label: 'Support compliance',
        description: 'Document and guarantor completion by application.',
        chart: 'completion',
      },
    ];
  }

  notificationCatalog() {
    return [
      {
        code: 'employee_finance.application.submitted',
        channel: 'in-app/sms',
        required: true,
      },
      {
        code: 'employee_finance.application.recommended',
        channel: 'in-app/sms',
        required: true,
      },
      {
        code: 'employee_finance.application.hr_approved',
        channel: 'in-app/sms',
        required: true,
      },
      {
        code: 'employee_finance.application.approved',
        channel: 'in-app/sms',
        required: true,
      },
      {
        code: 'employee_finance.application.document_added',
        channel: 'in-app',
        required: true,
      },
      {
        code: 'employee_finance.application.guarantor_added',
        channel: 'in-app',
        required: true,
      },
      {
        code: 'employee_finance.application.guarantor_decided',
        channel: 'in-app/sms',
        required: true,
      },
      {
        code: 'employee_finance.disbursement.confirmed',
        channel: 'in-app/sms',
        required: true,
      },
      {
        code: 'employee_finance.repayment.posted',
        channel: 'in-app/sms',
        required: true,
      },
    ];
  }

  deploymentReadiness() {
    const erpUrl = this.configService.get<string>(
      'EMPLOYEE_FINANCE_ERP_POST_URL',
    );
    const bankMap = this.configService.get<string>(
      'EMPLOYEE_FINANCE_BANK_IMPORT_COLUMN_MAP',
    );
    const privateStorage =
      this.configService.get<string>('APP_PRIVATE_STORAGE_PATH') ??
      'private-uploads';
    const maxFileSize =
      this.configService.get<number>(
        'EMPLOYEE_FINANCE_DOCUMENT_MAX_FILE_SIZE_BYTES',
      ) ??
      this.configService.get<number>('MAX_UPLOAD_FILE_SIZE_BYTES') ??
      EMPLOYEE_FINANCE_DOCUMENT_MAX_BYTES;
    const checks = [
      {
        code: 'PRIVATE_STORAGE',
        status: privateStorage ? 'CONFIGURED' : 'MISSING',
        detail: privateStorage,
      },
      {
        code: 'DOCUMENT_FILE_SIZE',
        status: maxFileSize > 0 ? 'CONFIGURED' : 'MISSING',
        detail: maxFileSize,
      },
      {
        code: 'BANK_IMPORT_MAPPING',
        status: bankMap ? 'CONFIGURED' : 'DEFAULT',
        detail:
          bankMap ??
          'Using default aliases: payment_reference/reference, amount, status.',
      },
      {
        code: 'ERP_POSTING',
        status: erpUrl ? 'CONFIGURED' : 'DRY_RUN_ONLY',
        detail: erpUrl
          ? 'Posting endpoint configured.'
          : 'Set EMPLOYEE_FINANCE_ERP_POST_URL.',
      },
      {
        code: 'ERP_AUTH',
        status: (
          this.configService.get<string>('EMPLOYEE_FINANCE_ERP_AUTH_TYPE') ??
          'none'
        ).toUpperCase(),
        detail: 'none, bearer, api-key, or basic',
      },
      {
        code: 'NOTIFICATION_CATALOG',
        status: 'CONFIGURED',
        detail: `${this.notificationCatalog().length} loan notification events registered.`,
      },
    ];
    return {
      module: 'employee-finance',
      ready: checks.every((check) =>
        [
          'CONFIGURED',
          'DEFAULT',
          'NONE',
          'BEARER',
          'API-KEY',
          'BASIC',
        ].includes(String(check.status)),
      ),
      checks,
    };
  }

  async report(
    actor: AuthenticatedUser,
    reportType: string,
    query: EmployeeFinanceQueryDto,
  ) {
    const companyId = actor.companyId!;
    const type = reportType.trim().toLowerCase();
    if (type === 'aging') return this.agingReport(companyId);
    if (type === 'exposure') return this.exposureReport(companyId, query);
    if (type === 'repayment-performance')
      return this.repaymentPerformanceReport(companyId, query);
    if (type === 'disbursements')
      return this.disbursementReport(companyId, query);
    if (type === 'settlements') return this.settlementReport(companyId, query);
    if (type === 'default-risk') return this.defaultRiskReport(companyId);
    if (type === 'support-compliance')
      return this.supportComplianceReport(companyId, query);
    throw new BadRequestException('Unknown employee finance report type.');
  }

  async auditTimeline(
    actor: AuthenticatedUser,
    query: EmployeeFinanceQueryDto,
  ) {
    const where: Record<string, unknown> = { companyId: actor.companyId! };
    if (query.entity_type) where.entityType = query.entity_type;
    if (query.entity_id) where.entityId = String(query.entity_id);
    return this.auditRepository.find({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      take: Math.min(query.limit ?? 100, 500),
    });
  }

  private filterByDate<T>(
    rows: T[],
    query: EmployeeFinanceQueryDto,
    dateReader: (row: T) => string | Date | null | undefined,
  ) {
    return rows.filter((row) => {
      const raw = dateReader(row);
      if (!raw) return true;
      const value = raw instanceof Date ? raw.toISOString().slice(0, 10) : raw;
      if (query.date_from && value < query.date_from) return false;
      if (query.date_to && value > query.date_to) return false;
      return true;
    });
  }

  private async agingReport(companyId: number) {
    const accounts = await this.accountRepository.find({
      where: { companyId, status: In(activeAccountStatuses()) },
      order: { id: 'ASC' },
    });
    const accountIds = accounts.map((account) => account.id);
    const installments = accountIds.length
      ? await this.installmentRepository.find({
          where: {
            companyId,
            accountId: In(accountIds),
            status: In([
              EmployeeFinanceInstallmentStatusEnum.SCHEDULED,
              EmployeeFinanceInstallmentStatusEnum.PARTIALLY_PAID,
              EmployeeFinanceInstallmentStatusEnum.OVERDUE,
              EmployeeFinanceInstallmentStatusEnum.DEFERRED,
            ]),
          },
          order: { dueDate: 'ASC', id: 'ASC' },
        })
      : [];
    const buckets = {
      current: '0.00',
      days_1_30: '0.00',
      days_31_60: '0.00',
      days_61_90: '0.00',
      days_over_90: '0.00',
    };
    const rows = accounts.map((account) => {
      const accountInstallments = installments.filter(
        (installment) => installment.accountId === account.id,
      );
      let overdueAmount = '0.00';
      let bucket = 'current';
      for (const installment of accountInstallments) {
        const unpaid = EmployeeFinanceMoney.subtract(
          installment.totalDue,
          installment.paidAmount,
        );
        if (EmployeeFinanceMoney.toCents(unpaid) <= 0n) continue;
        const age = daysBetweenDates(installment.dueDate);
        let currentBucket: keyof typeof buckets = 'current';
        if (age > 90) currentBucket = 'days_over_90';
        else if (age > 60) currentBucket = 'days_61_90';
        else if (age > 30) currentBucket = 'days_31_60';
        else if (age > 0) currentBucket = 'days_1_30';
        buckets[currentBucket] = EmployeeFinanceMoney.add(
          buckets[currentBucket],
          unpaid,
        );
        if (currentBucket !== 'current')
          overdueAmount = EmployeeFinanceMoney.add(overdueAmount, unpaid);
        if (currentBucket !== 'current' && bucket === 'current')
          bucket = currentBucket;
      }
      return {
        account_id: account.id,
        account_no: account.accountNo,
        employee_id: account.employeeId,
        product_type: account.productType,
        status: account.status,
        outstanding_total: account.outstandingTotal,
        overdue_amount: overdueAmount,
        aging_bucket: bucket,
        next_due_date: accountInstallments[0]?.dueDate ?? null,
      };
    });
    return {
      reportType: 'aging',
      generatedAt: new Date().toISOString(),
      buckets,
      rows,
    };
  }

  private async exposureReport(
    companyId: number,
    query: EmployeeFinanceQueryDto,
  ) {
    let accounts = await this.accountRepository.find({
      where: { companyId },
      order: { id: 'ASC' },
    });
    if (query.status) {
      accounts = accounts.filter((account) => account.status === query.status);
    }
    if (query.employee_id) {
      accounts = accounts.filter(
        (account) => account.employeeId === query.employee_id,
      );
    }
    const byProduct: Record<
      string,
      { count: number; outstanding_total: string }
    > = {};
    const byStatus: Record<
      string,
      { count: number; outstanding_total: string }
    > = {};
    for (const account of accounts) {
      byProduct[account.productType] ??= {
        count: 0,
        outstanding_total: '0.00',
      };
      byStatus[account.status] ??= { count: 0, outstanding_total: '0.00' };
      byProduct[account.productType].count += 1;
      byProduct[account.productType].outstanding_total =
        EmployeeFinanceMoney.add(
          byProduct[account.productType].outstanding_total,
          account.outstandingTotal,
        );
      byStatus[account.status].count += 1;
      byStatus[account.status].outstanding_total = EmployeeFinanceMoney.add(
        byStatus[account.status].outstanding_total,
        account.outstandingTotal,
      );
    }
    return {
      reportType: 'exposure',
      generatedAt: new Date().toISOString(),
      totals: {
        account_count: accounts.length,
        outstanding_total: accounts.reduce(
          (sum, account) =>
            EmployeeFinanceMoney.add(sum, account.outstandingTotal),
          '0.00',
        ),
      },
      byProduct,
      byStatus,
      rows: accounts.map((account) => ({
        account_id: account.id,
        account_no: account.accountNo,
        employee_id: account.employeeId,
        product_type: account.productType,
        status: account.status,
        principal_amount: account.principalAmount,
        outstanding_total: account.outstandingTotal,
        scheduled_monthly_installment: account.scheduledMonthlyInstallment,
      })),
    };
  }

  private async repaymentPerformanceReport(
    companyId: number,
    query: EmployeeFinanceQueryDto,
  ) {
    const repayments = this.filterByDate(
      await this.repaymentRepository.find({
        where: { companyId },
        order: { paymentDate: 'DESC', id: 'DESC' },
      }),
      query,
      (repayment) => repayment.paymentDate,
    );
    const installments = await this.installmentRepository.find({
      where: { companyId },
    });
    const dueTotal = installments.reduce(
      (sum, installment) => EmployeeFinanceMoney.add(sum, installment.totalDue),
      '0.00',
    );
    const paidTotal = installments.reduce(
      (sum, installment) =>
        EmployeeFinanceMoney.add(sum, installment.paidAmount),
      '0.00',
    );
    return {
      reportType: 'repayment-performance',
      generatedAt: new Date().toISOString(),
      totals: {
        due_total: dueTotal,
        paid_total: paidTotal,
        collection_rate:
          EmployeeFinanceMoney.toCents(dueTotal) > 0n
            ? Number(
                (Number(EmployeeFinanceMoney.toCents(paidTotal)) /
                  Number(EmployeeFinanceMoney.toCents(dueTotal))) *
                  100,
              ).toFixed(2)
            : '0.00',
        repayment_total: repayments.reduce(
          (sum, repayment) => EmployeeFinanceMoney.add(sum, repayment.amount),
          '0.00',
        ),
      },
      rows: repayments.map((repayment) => ({
        repayment_id: repayment.id,
        account_id: repayment.accountId,
        repayment_type: repayment.repaymentType,
        amount: repayment.amount,
        payment_date: repayment.paymentDate,
        status: repayment.status,
        payment_reference: repayment.paymentReference,
      })),
    };
  }

  private async disbursementReport(
    companyId: number,
    query: EmployeeFinanceQueryDto,
  ) {
    const disbursements = this.filterByDate(
      await this.disbursementRepository.find({
        where: { companyId },
        order: { paymentDate: 'DESC', id: 'DESC' },
      }),
      query,
      (disbursement) => disbursement.paymentDate,
    );
    return {
      reportType: 'disbursements',
      generatedAt: new Date().toISOString(),
      totals: {
        count: disbursements.length,
        amount: disbursements.reduce(
          (sum, disbursement) =>
            EmployeeFinanceMoney.add(sum, disbursement.amount),
          '0.00',
        ),
      },
      rows: disbursements.map((disbursement) => ({
        disbursement_id: disbursement.id,
        account_id: disbursement.accountId,
        amount: disbursement.amount,
        payment_reference: disbursement.paymentReference,
        payment_date: disbursement.paymentDate,
        status: disbursement.status,
      })),
    };
  }

  private async settlementReport(
    companyId: number,
    query: EmployeeFinanceQueryDto,
  ) {
    const quotes = this.filterByDate(
      await this.settlementQuoteRepository.find({
        where: { companyId },
        order: { validUntil: 'DESC', id: 'DESC' },
      }),
      query,
      (quote) => quote.validUntil,
    );
    return {
      reportType: 'settlements',
      generatedAt: new Date().toISOString(),
      totals: {
        count: quotes.length,
        settlement_amount: quotes.reduce(
          (sum, quote) => EmployeeFinanceMoney.add(sum, quote.settlementAmount),
          '0.00',
        ),
      },
      rows: quotes.map((quote) => ({
        quote_id: quote.id,
        quote_no: quote.quoteNo,
        account_id: quote.accountId,
        settlement_amount: quote.settlementAmount,
        valid_until: quote.validUntil,
        status: quote.status,
      })),
    };
  }

  private async defaultRiskReport(companyId: number) {
    const aging = await this.agingReport(companyId);
    const rows = aging.rows.map((row) => {
      const overdue = EmployeeFinanceMoney.toCents(row.overdue_amount);
      const outstanding = EmployeeFinanceMoney.toCents(row.outstanding_total);
      const risk_score =
        row.aging_bucket === 'days_over_90'
          ? 100
          : row.aging_bucket === 'days_61_90'
            ? 75
            : row.aging_bucket === 'days_31_60'
              ? 50
              : row.aging_bucket === 'days_1_30'
                ? 25
                : 0;
      return {
        ...row,
        risk_score,
        overdue_ratio:
          outstanding > 0n
            ? ((Number(overdue) / Number(outstanding)) * 100).toFixed(2)
            : '0.00',
      };
    });
    return {
      reportType: 'default-risk',
      generatedAt: new Date().toISOString(),
      totals: {
        account_count: rows.length,
        high_risk_count: rows.filter((row) => row.risk_score >= 75).length,
        watchlist_count: rows.filter((row) => row.risk_score > 0).length,
      },
      rows,
    };
  }

  private async supportComplianceReport(
    companyId: number,
    query: EmployeeFinanceQueryDto,
  ) {
    let applications = await this.applicationRepository.find({
      where: { companyId },
      order: { id: 'DESC' },
    });
    if (query.status) {
      applications = applications.filter(
        (application) => application.status === query.status,
      );
    }
    const rows = await Promise.all(
      applications.map(async (application) => {
        const product = recordValue(application.productSnapshot);
        const requiredDocuments = requiredDocumentTypes(
          product,
          application.requestedAmount,
        );
        const requiredGuarantors = requiredGuarantorCount(product);
        const [documents, guarantors] = await Promise.all([
          this.auditRepository.manager
            .getRepository(EmployeeFinanceApplicationDocument)
            .find({
              where: {
                companyId,
                applicationId: application.id,
              },
            }),
          this.auditRepository.manager
            .getRepository(EmployeeFinanceApplicationGuarantor)
            .find({
              where: {
                companyId,
                applicationId: application.id,
              },
            }),
        ]);
        const verifiedDocuments = new Set(
          documents
            .filter((document) => document.status === 'VERIFIED')
            .map((document) => document.documentType),
        );
        const approvedGuarantors = guarantors.filter(
          (guarantor) => guarantor.status === 'APPROVED',
        ).length;
        return {
          application_id: application.id,
          application_no: application.applicationNo,
          employee_id: application.employeeId,
          status: application.status,
          required_documents: requiredDocuments.length,
          verified_documents: requiredDocuments.filter((documentType) =>
            verifiedDocuments.has(documentType),
          ).length,
          required_guarantors: requiredGuarantors,
          approved_guarantors: approvedGuarantors,
          complete:
            requiredDocuments.every((documentType) =>
              verifiedDocuments.has(documentType),
            ) && approvedGuarantors >= requiredGuarantors,
        };
      }),
    );
    return {
      reportType: 'support-compliance',
      generatedAt: new Date().toISOString(),
      totals: {
        application_count: rows.length,
        complete_count: rows.filter((row) => row.complete).length,
        incomplete_count: rows.filter((row) => !row.complete).length,
      },
      rows,
    };
  }
}

@Injectable()
export class EmployeeFinanceReconciliationService {
  constructor(
    @InjectRepository(EmployeeFinanceAccount)
    private readonly accountRepository: Repository<EmployeeFinanceAccount>,
    @InjectRepository(EmployeeFinanceInstallment)
    private readonly installmentRepository: Repository<EmployeeFinanceInstallment>,
    @InjectRepository(EmployeeFinancePayrollInstruction)
    private readonly instructionRepository: Repository<EmployeeFinancePayrollInstruction>,
    private readonly ledgerService: EmployeeFinanceLedgerService,
  ) {}

  @Cron(process.env.EMPLOYEE_FINANCE_RECONCILIATION_CRON || '0 30 2 * * *')
  async scheduledReconciliation() {
    const accounts = await this.accountRepository.find({ take: 100 });
    let issues = 0;
    for (const account of accounts) {
      issues += (await this.reconcileAccount(account.companyId, account.id))
        .issue_count;
    }
    return issues;
  }

  async reconcile(actor: AuthenticatedUser, accountId?: number) {
    if (accountId) return this.reconcileAccount(actor.companyId!, accountId);
    const accounts = await this.accountRepository.find({
      where: { companyId: actor.companyId! },
      order: { id: 'ASC' },
    });
    const results: EmployeeFinanceReconciliationResult[] = [];
    for (const account of accounts) {
      results.push(await this.reconcileAccount(account.companyId, account.id));
    }
    return {
      account_count: results.length,
      issue_count: results.reduce((sum, item) => sum + item.issue_count, 0),
      results,
    };
  }

  private async reconcileAccount(
    companyId: number,
    accountId: number,
  ): Promise<EmployeeFinanceReconciliationResult> {
    const issues: Record<string, unknown>[] = [];
    const account = await this.accountRepository.findOne({
      where: { companyId, id: accountId },
    });
    if (!account) throw new NotFoundException('Finance account not found.');
    const balance = await this.ledgerService.calculateBalance(
      companyId,
      accountId,
    );
    if (
      EmployeeFinanceMoney.toCents(balance.total) !==
      EmployeeFinanceMoney.toCents(account.outstandingTotal)
    ) {
      issues.push({
        code: 'ACCOUNT_BALANCE_DIFFERS_FROM_LEDGER',
        account_id: accountId,
      });
    }
    const unpaidFuture = await this.installmentRepository.count({
      where: {
        companyId,
        accountId,
        status: In([
          EmployeeFinanceInstallmentStatusEnum.SCHEDULED,
          EmployeeFinanceInstallmentStatusEnum.PARTIALLY_PAID,
          EmployeeFinanceInstallmentStatusEnum.OVERDUE,
        ]),
      },
    });
    if (
      activeAccountStatuses().includes(account.status) &&
      unpaidFuture === 0
    ) {
      issues.push({
        code: 'ACTIVE_ACCOUNT_HAS_NO_FUTURE_SCHEDULE',
        account_id: accountId,
      });
    }
    const duplicateInstructionRows = await this.instructionRepository
      .createQueryBuilder('instruction')
      .select('instruction.installmentId', 'installment_id')
      .addSelect('COUNT(*)', 'count')
      .where('instruction.companyId = :companyId', { companyId })
      .andWhere('instruction.accountId = :accountId', { accountId })
      .groupBy('instruction.installmentId')
      .having('COUNT(*) > 1')
      .getRawMany();
    if (duplicateInstructionRows.length > 0) {
      issues.push({
        code: 'PAYROLL_INSTRUCTION_INCLUDED_TWICE',
        account_id: accountId,
      });
    }
    return { account_id: accountId, issue_count: issues.length, issues };
  }
}
```

## [1791900000000-AddFinanceApplicationNumberSequence.ts](/home/innocent/systems/hrms_backend/src/database/migrations/1791900000000-AddFinanceApplicationNumberSequence.ts)

Path: `/home/innocent/systems/hrms_backend/src/database/migrations/1791900000000-AddFinanceApplicationNumberSequence.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFinanceApplicationNumberSequence1791900000000 implements MigrationInterface {
  name = 'AddFinanceApplicationNumberSequence1791900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error(
        'Finance sequence initialization requires a transactional migration.',
      );
    }
    // Block legacy writers while the initial high-water mark is captured.
    await queryRunner.query(
      'LOCK TABLE "employee_finance_applications" IN SHARE ROW EXCLUSIVE MODE',
    );
    await queryRunner.query(`
      CREATE SEQUENCE "employee_finance_application_number_seq"
      AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 NO CYCLE CACHE 1
    `);
    await queryRunner.query(`
      SELECT setval(
        'employee_finance_application_number_seq',
        GREATEST(COALESCE(MAX(substring("application_no" FROM '^EFAPP-[0-9]+-([0-9]+)$')::bigint), 0), 1),
        COALESCE(MAX(substring("application_no" FROM '^EFAPP-[0-9]+-([0-9]+)$')::bigint), 0) > 0
      )
      FROM "employee_finance_applications"
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP SEQUENCE "employee_finance_application_number_seq"',
    );
  }
}
```

## [backend-media-url.ts](/home/innocent/systems/hrms/src/lib/backend-media-url.ts)

Path: `/home/innocent/systems/hrms/src/lib/backend-media-url.ts`

```typescript
import { env } from "@/lib/env"

function getApiOrigin() {
  return env.NEXT_PUBLIC_API_BASE_URL.replace(/\/api$/i, "")
}

/**
 * Resolve backend-hosted media (uploads, avatars, profile photos) against
 * the active API origin. Kept outside admin-api so the dashboard shell does
 * not have to parse that module just to show a photo.
 */
export function resolveBackendMediaUrl(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null
  const raw = value.trim()
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return raw

  const base = getApiOrigin().replace(/\/$/, "")

  // Absolute third-party media is never rebound merely because its path says uploads.
  if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
    const knownOrigins = [env.NEXT_PUBLIC_API_BASE_URL, process.env.NEXT_PUBLIC_BACKEND_ORIGIN]
      .filter((value): value is string => Boolean(value && /^https?:\/\//i.test(value)));
    const backendOrigins = knownOrigins.map((value) => {
      try { return new URL(value).origin; } catch { return null; }
    }).filter((value): value is string => value !== null);
    try {
      const protocol = backendOrigins[0] ? new URL(backendOrigins[0]).protocol : "https:";
      const url = new URL(raw, `${protocol}//media.invalid`);
      if (backendOrigins.includes(url.origin) && url.pathname.startsWith("/uploads/")) {
        return `${base}${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      return raw;
    }
    return raw;
  }

  let path = raw.replace(/\\/g, "/")
  if (!path.startsWith("/")) {
    if (
      path.startsWith("uploads/") ||
      path.startsWith("default-avatars/") ||
      path.startsWith("profile-photos/")
    ) {
      path = path.startsWith("uploads/") ? `/${path}` : `/uploads/${path}`
    } else {
      path = `/${path}`
    }
  }
  return `${base}${path}`
}
```

## [http.ts](/home/innocent/systems/hrms/src/lib/server/http.ts)

Path: `/home/innocent/systems/hrms/src/lib/server/http.ts`

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
  const configured = process.env.INTERNAL_BACKEND_URL?.trim() ||
    process.env.BACKEND_ORIGIN?.trim() ||
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

## [route.ts](/home/innocent/systems/hrms/src/app/api/profile-photo-upload/route.ts)

Path: `/home/innocent/systems/hrms/src/app/api/profile-photo-upload/route.ts`

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
```

## Supporting tests and fixtures

- [Next rewrite checks](/home/innocent/systems/hrms/next.config.test.ts)
- [Media origin tests](/home/innocent/systems/hrms/src/lib/backend-media-url.test.ts)
- [Escalation tests](/home/innocent/systems/hrms/src/app/api/support/escalate/route.test.ts)
- [PostgreSQL concurrency tests](/home/innocent/systems/hrms_backend/src/modules/hr/employee-finance/services/employee-finance-concurrency.postgres.spec.ts)
- [Finance lifecycle unit fixture](/home/innocent/systems/hrms_backend/src/modules/hr/employee-finance/services/employee-finance-core.services.spec.ts)
- [Existing finance end-to-end fixture](/home/innocent/systems/hrms_backend/test/employee-finance.e2e-spec.ts)

To rerun PostgreSQL concurrency verification, set `HRMS_FINANCE_CONCURRENCY_DATABASE_URL` to a dedicated test database ending in `_e2e` or `_test_db`, then run:

```sh
npm test -- --runInBand --runTestsByPath src/modules/hr/employee-finance/services/employee-finance-concurrency.postgres.spec.ts
```

The test suite creates and drops only its own unique schema.
