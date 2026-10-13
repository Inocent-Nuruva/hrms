# Comprehensive Project Health & Gap Report

Audit date: 12 October 2026. Frontend: `/home/innocent/systems/hrms`. Backend: `/home/innocent/systems/hrms_backend` (discovered adjacent to the frontend and inspected read-only).

## Executive assessment and scope

The application has substantial implemented functionality and useful tests, but its weak points are runtime response contracts, identity-bound state, asynchronous synchronization, and financial input/concurrency handling. The most urgent confirmed gaps are an unauthenticated filesystem upload endpoint, finance DTOs accepting malformed monetary values, and finance application numbering based on a non-atomic row count.

This report contains **22 findings**: six API/data-cycle findings, seven state/lifecycle findings, six validation/security findings, and three technical-debt findings. P1 means resolve before relying on the affected flow in production; P2 means a material correctness/reliability gap; P3 means maintainability or incomplete integration. Findings explicitly distinguish deterministic code defects from risks requiring deployment or concurrency verification. Blueprints illustrate the intended change; named helpers such as `requireSession`, `requestJson`, and `ContractError` must be implemented, not assumed to exist.

Reviewed the shared HTTP clients, authentication/session stores, dashboard permission/cache layers, finance self-service lifecycle, Next route handlers and configuration, backend bootstrap/module composition, relevant finance/performance/permissions services, and repository-wide controller parameter/TODO/module-reference inventories. This is a static audit with local checks, not a claim that every line of the 1,555 backend TypeScript files was individually reviewed. Android and Electron internals are outside the requested Next.js/NestJS scope. Existing user edits were preserved.

### Validation performed

| Check | Result |
| --- | --- |
| Frontend Vitest | 68 files, 452 tests passed |
| Frontend TypeScript | `npx tsc --noEmit --incremental false` passed |
| Frontend ESLint | `npm run lint -- --quiet` passed; warnings omitted and several lifecycle rules disabled, see finding 20 |
| Backend TypeScript | `npm run typecheck` passed |
| Backend targeted Jest | Finance core, employee KPI, and permissions guard: 3 suites, 16 tests passed |
| DTO/money reproduction | Malformed finance create/evaluate payloads had **zero validation errors**; parsing `abc` as money threw `SyntaxError` |

An initial targeted Jest invocation named two nonexistent spec files and executed zero tests; the corrected invocation used the actual three suites listed above. No database mutations, live HTTP calls, production build, browser journey, full backend test suite, or deployment validation were performed.

### Existing protections that should be retained

- Backend [main.ts](/home/innocent/systems/hrms_backend/src/main.ts) enables `whitelist`, `forbidNonWhitelisted`, transformation, a global exception filter, Helmet, CORS restrictions, and shutdown hooks.
- Backend [app.module.ts](/home/innocent/systems/hrms_backend/src/app.module.ts) registers JWT and throttler guards; [hr.module.ts](/home/innocent/systems/hrms_backend/src/modules/hr/hr.module.ts) imports the major HR feature modules. The module-reference inventory found no module class declared without another reference. That is an inventory check, not a DI boot proof.
- Many numeric controller parameters already use `ParseIntPipe`. KPI review `kind` is checked by `assertKind()` in its service; its TypeScript union is therefore not an unvalidated enum vulnerability.
- The admin client catches HTTP failures, parses validation errors, retries throttled GETs, supports cancellation, and has deduplication. The gap is not an absence of error handling everywhere.
- Installed Next 16.2.4 Proxy and Route Handler guides were read. `src/proxy.ts` and promise-valued route parameters are current conventions; mixing App and Pages routers alone is not a defect.

## 1. END-TO-END DATA CYCLES & API CONSUMPTION

Current principal cycles:

```text
Pages authentication UI → useAuth → authService → apiRequest → Nest auth/users
                        → localStorage + JS cookies + actor snapshot
App dashboard UI → admin-api → fetch /api/<domain> → Nest controller DTO
                 → tenant/permission checks → TypeORM service → UI normalization
Finance wizard → eligibility → create draft → documents → guarantors → optional submit
Notifications → shared REST/socket store → notification UI
Next /api/support/escalate → backend support service
```

### 1. P2 — Generic types do not validate successful responses

**Files:** [services/api.ts](/home/innocent/systems/hrms/src/services/api.ts:108), [admin-api.ts](/home/innocent/systems/hrms/src/lib/admin-api.ts:2920), [types/index.ts](/home/innocent/systems/hrms/src/types/index.ts).

**Implemented:** `apiRequest<T>` casts parsed JSON to `T`; `adminRequest<T>` casts its normalized payload to `T`. Domain state frequently uses `AdminRecord = Record<string, unknown>`.

**Missing/impact:** A generic is a compile-time assertion, not runtime validation. The basic client also returns `undefined as T` for malformed/plain-text success bodies. The admin client turns non-JSON responses into message objects and can cache them as successful domain data. An HTML response or changed DTO can produce empty tables or downstream property errors instead of a contract failure.

**Blueprint:** Keep an explicit empty-success operation, but require a schema for JSON operations; validate before caching.

```ts
async function requestJson<S extends z.ZodType>(
  path: string, schema: S, init: RequestInit,
): Promise<z.output<S>> {
  const response = await fetch(path, init);
  if (!response.ok) throw await parseHttpError(response);
  const raw: unknown = await response.json(); // invalid JSON is a failure
  return schema.parse(raw);
}
// Generated OpenAPI types + endpoint-specific Zod validators, not `as T`.
```

### 2. P2 — Entity and collection normalizers guess which object is the resource

**File:** [admin-api.ts](/home/innocent/systems/hrms/src/lib/admin-api.ts:2591), scopes `normalizeSingle`, `extractListFromRecord`, `normalizeList` (line 1153), `getAttendanceResource` (around line 5758).

**Implemented:** `normalizeSingle` returns nested `data/result/item/user/company` or another nested object **before** checking root identity. Collection normalization recursively searches arrays and can select the highest-scoring nested collection.

**Missing/impact:** `{ id: 42, name: "Group", company: { id: 7 } }` resolves to company 7 rather than resource 42. A legitimate empty collection with nonempty related arrays can become a table of related entities. `getAttendanceResource` then spreads the selected child over the root, so child IDs can overwrite resource IDs. The leave-specific unwrapping code already documents and works around this class of defect; other domains still use the generic helper. Whether each endpoint currently emits the triggering relations must be contract-tested.

**Blueprint:** Unwrap only the documented envelope and validate the entity identity. Never recursively discover a resource by shape.

```ts
const Resource = z.object({ id: z.number(), name: z.string() }).passthrough();
const ResourceResponse = z.union([
  Resource,
  z.object({ data: Resource }).transform(({ data }) => data),
]);
const Page = z.object({ data: z.array(Resource), total: z.number().int() });
// `data: []` stays empty regardless of sibling relations.
```

### 3. P2 — Unauthorized/missing workflow APIs are presented as empty queues

**File:** [admin-api.ts](/home/innocent/systems/hrms/src/lib/admin-api.ts:10900), `isForbiddenOrMissingError`, `listMyOffboardingRequests/Approvals/Tasks/Clearances`; analogous onboarding helpers around line 10382.

**Implemented:** Helpers return `[]` for 401, 403, 404 and even matching human-message fragments. This is an intentional compatibility fallback.

**Missing/impact:** Expired authentication, unavailable endpoints, and lack of permission become indistinguishable from “no outstanding work.” Caller error/forbidden guards cannot react to errors swallowed here. Message matching can also hide unrelated failures.

**Blueprint:** Propagate 401, use typed status/code handling, and expose intentional permission-based absence explicitly.

```ts
type QueueResult<T> =
  | { state: "ready"; items: T[] }
  | { state: "forbidden" }
  | { state: "unsupported" };
// Catch only an explicitly optional 403/404 and render that state.
// Authentication/network/server/contract failures must reject.
```

### 4. P1 in same-origin mode — Support escalation uses a browser API base on the server

**Files:** [support/escalate/route.ts](/home/innocent/systems/hrms/src/app/api/support/escalate/route.ts:7), [env.ts](/home/innocent/systems/hrms/src/lib/env.ts), [next.config.ts](/home/innocent/systems/hrms/next.config.ts).

**Implemented:** Escalation builds `${env.NEXT_PUBLIC_API_BASE_URL}/api/support/escalate`. Environment normalization turns the explicitly supported `/api` base into an empty string. Next rewrites separately resolve a backend origin.

**Missing/impact:** In `/api`/empty-base mode the Node handler calls `fetch('/api/support/escalate')`, which has no absolute origin and fails. An absolute base pointing at the frontend can instead recurse into the same route. Browser rewrites do not solve either server-side problem.

**Blueprint:** Centralize server-only backend-origin resolution, sharing its semantics with configuration; require an absolute backend origin.

```ts
import "server-only";
const backend = new URL(process.env.BACKEND_ORIGIN!);
const url = new URL("/api/support/escalate", backend);
await fetch(url, { method: "POST", body: JSON.stringify(body), headers,
  signal: AbortSignal.timeout(15_000) });
```

### 5. P2 in same-origin mode — Backend media URLs resolve to the frontend without an upload rewrite

**Files:** [backend-media-url.ts](/home/innocent/systems/hrms/src/lib/backend-media-url.ts), [next.config.ts](/home/innocent/systems/hrms/next.config.ts), backend [main.ts](/home/innocent/systems/hrms_backend/src/main.ts), local [profile-photo-upload/route.ts](/home/innocent/systems/hrms/src/app/api/profile-photo-upload/route.ts).

**Implemented:** Backend upload URLs are rewritten against the normalized public API base. With an empty base they become `/uploads/...`. Backend serves upload folders, while Next rewrites only API/socket routes. Next also owns a separate local profile-photo directory.

**Missing/impact:** Backend photos/default avatars hit frontend static storage and can 404 under same-origin configuration. Absolute URLs from any host containing those upload paths are also rewritten, potentially moving externally stored media to the wrong host. Two photo-storage owners make routing ambiguous.

**Blueprint:** Choose one authoritative upload service, then proxy its media or expose a specific media origin.

```ts
// next.config.ts, after migrating local photo ownership to the backend
{ source: "/uploads/:path*", destination: `${backendOrigin}/uploads/:path*` }
// Rewrite only URLs whose origin belongs to the configured backend.
```

### 6. P2 — Shared requests lack a deadline and request-triggered refresh coordination

**Files:** [services/api.ts](/home/innocent/systems/hrms/src/services/api.ts), [admin-api.ts](/home/innocent/systems/hrms/src/lib/admin-api.ts:2920), [session-expiry-guard.tsx](/home/innocent/systems/hrms/src/components/auth/session-expiry-guard.tsx).

**Implemented:** Calls accept an optional signal; admin GETs retry 429. Session refresh runs on a timer/focus and in `useAuth`.

**Missing/impact:** Most calls have no application deadline, so pending promises keep loading/saving states unresolved until the underlying transport fails. A request that uses an expiring token is not coordinated with timer refresh; its 401 reaches the view. Different clients also use different error status fields (`statusCode` versus `status`).

**Blueprint:** Use one transport with a deadline, a shared single-flight refresh promise, and one error type. Automatically retry only safe requests; mutations require an idempotency policy.

```ts
const signal = callerSignal
  ? AbortSignal.any([callerSignal, AbortSignal.timeout(20_000)])
  : AbortSignal.timeout(20_000);
// For eligible GET 401: await refreshOnce(); reread token; retry once.
// Refresh failures retain structured status/code rather than string matching.
```

## 2. STATE MANAGEMENT & LIFECYCLE FLOWS

### 7. P2 — Authentication storage is neither reactive nor hydration-safe

**Files:** [useLocalStorage.ts](/home/innocent/systems/hrms/src/hooks/useLocalStorage.ts), [useAuth.ts](/home/innocent/systems/hrms/src/hooks/useAuth.ts), [session-client.ts](/home/innocent/systems/hrms/src/lib/session-client.ts), [session-expiry-guard.tsx](/home/innocent/systems/hrms/src/components/auth/session-expiry-guard.tsx).

**Implemented:** Each `useLocalStorage` instance initializes its own React state from browser storage. Session guard/token helpers also write storage directly.

**Missing/impact:** A refresh, another hook instance, or another tab can change tokens without updating mounted `useAuth` state. Subsequent actions can send the old token. No native `storage` or same-tab subscription exists. SSR initializes to the default while the first browser render reads persisted data, creating a hydration-risk pattern. Storage writes can throw after React state already changed.

**Blueprint:** One auth external store with a stable server snapshot, validated persistence, a same-tab event, and cross-tab storage subscription.

```ts
const session = useSyncExternalStore(
  sessionStore.subscribe, sessionStore.getSnapshot, sessionStore.getServerSnapshot,
);
// All persistence/clear/refresh/switch operations call sessionStore.set().
// Subscribe to `storage`; catch persistence errors and report them coherently.
```

### 8. P1 — Dashboard warm snapshots are not bound to a user/company, and memory bypasses expiry

**Files:** [dashboard-warm-cache.ts](/home/innocent/systems/hrms/src/lib/dashboard-warm-cache.ts), [hr-analytics-dashboard.tsx](/home/innocent/systems/hrms/src/components/dashboard/hr-analytics-dashboard.tsx:1230), [session-client.ts](/home/innocent/systems/hrms/src/lib/session-client.ts).

**Implemented:** A fixed sessionStorage key holds employee/leave/attendance snapshots. Module memory is returned immediately on later reads. Storage reads check a 90-second TTL.

**Missing/impact:** The snapshot carries no actor/company identity; logout/company switch do not reset this cache or its memory. Once populated, the memory branch never rechecks TTL. Within a surviving client runtime, another company/account can receive the previous snapshot as initial dashboard data. Full-page navigation may reset memory, but is not a reliable identity boundary.

**Blueprint:** Scope snapshots to a validated identity, check TTL on every read, reset storage and module memory on all identity transitions, and reject late prefetch completions from the old session.

```ts
type WarmSnapshot = { subject: string; companyId: number; savedAt: number; /* slices */ };
if (snapshot.subject !== session.subject || snapshot.companyId !== session.companyId
    || Date.now() - snapshot.savedAt > WARM_TTL_MS) return null;
// SESSION_CLEARED + company-switch => resetWarmCache(); bump generation.
```

### 9. P2 — Warm prefetch failures are marked as successful empty dashboard slices

**Files:** [dashboard-warm-cache.ts](/home/innocent/systems/hrms/src/lib/dashboard-warm-cache.ts:69), [hr-analytics-dashboard.tsx](/home/innocent/systems/hrms/src/components/dashboard/hr-analytics-dashboard.tsx:1248).

**Implemented:** Every failed prefetch becomes `emptyPage`; any warm snapshot initializes all slices as ready.

**Missing/impact:** A failed employee or leave request paints zero data and a ready dashboard with no indication that its slice failed. The subsequent live refresh may repair it, but the first paint misrepresents unknown data as zero.

**Blueprint:** Persist per-slice results; seed only successful slices and keep failures loading/error-aware.

```ts
type Slice<T> = { state: "ready"; data: T } | { state: "failed"; message: string };
const results = await Promise.allSettled(loaders);
// sliceReady[name] = results[name].status === "fulfilled";
// Failed data is unknown, not zero.
```

### 10. P2 — Cache invalidation permits stale in-flight reads to repopulate the cache

**File:** [admin-api.ts](/home/innocent/systems/hrms/src/lib/admin-api.ts:2920), maps and `invalidateAdminGetCache` near the top.

**Implemented:** A non-GET clears the GET cache before executing. Pending GET promises remain registered and later store their responses.

**Missing/impact:** An older GET can finish after a mutation and refill the cache with pre-mutation data. Reads issued during the mutation may also observe/cache the old state. Invalidation does not refresh mounted consumers, and cache entries retain token-bearing keys until requested/cleared.

**Blueprint:** Use a cache generation and invalidate affected resource keys after mutation success. Refresh subscribers. Expired entries need bounded eviction.

```ts
const startedAtGeneration = cacheGeneration;
const result = await fetchAndParse();
if (startedAtGeneration === cacheGeneration) cache.set(key, result);
// Successful mutation: ++cacheGeneration; invalidateAffectedKeys(); notifyViews();
// Do not let post-invalidation callers dedupe against an old-generation GET.
```

### 11. P2 — Finance eligibility and list effects allow outdated results to overwrite current state

**File:** [finance-self-view.tsx](/home/innocent/systems/hrms/src/components/dashboard/finance-self-view.tsx:218), eligibility effect and `load`.

**Implemented:** Eligibility is debounced 450 ms; cleanup only clears the timer. List loading launches three requests that directly set state. Products/guarantor errors become empty lists.

**Missing/impact:** Once a request starts, changing amount/product/term cannot stop its completion from writing eligibility for older inputs. Old results can also update errors/loading after closing the wizard. Overlapping reloads can overwrite newer lists; an unavailable product service looks like no products.

**Blueprint:** Associate results with an input key and effect generation; pass cancellation into API wrappers where possible. Keep a separate error state per list. Clear eligibility as soon as inputs change.

```ts
useEffect(() => {
  let active = true;
  setEligibility(null);
  const timer = setTimeout(async () => {
    setEligibilityLoading(true);
    try { const next = await evaluate(inputs); if (active) setEligibility(next); }
    catch (e) { if (active) setFormError(message(e)); }
    finally { if (active) setEligibilityLoading(false); }
  }, 450);
  return () => { active = false; clearTimeout(timer); };
}, [inputKey, createOpen]);
// Creation eligibility remains enforced on the backend; UI freshness still matters.
```

### 12. P2 — Finance creation has no recovery path for a partially completed workflow

**File:** [finance-self-view.tsx](/home/innocent/systems/hrms/src/components/dashboard/finance-self-view.tsx:264), `onCreate`; backend [employee-finance-core.services.ts](/home/innocent/systems/hrms_backend/src/modules/hr/employee-finance/services/employee-finance-core.services.ts:1230).

**Implemented:** Create draft → upload each document → add each guarantor → optionally submit. A later failure returns a generic form error; the newly created application ID is only a local variable.

**Missing/impact:** If an upload fails, the draft remains but the wizard retries creation from scratch. The backend active-application limit can then reject the retry. Duplicate guarantor IDs can pass the frontend count, followed by a later duplicate-operation failure.

**Blueprint:** Persist draft ID and completed steps in wizard state; retry only incomplete operations. Use idempotency keys and resume/edit semantics; do not delete a valid draft automatically.

```ts
const id = draftId ?? await createDraftOnce(idempotencyKey, payload);
setDraftId(id);
for (const step of pendingSteps) {
  await executeIdempotentStep(id, step);
  markCompleted(step.key);
}
// Unique guarantor IDs: [...new Set(parsedIds)]. Require positive safe integers.
```

### 13. P2 — Authentication failure policy logs users out on temporary outages

**Files:** [useAuth.ts](/home/innocent/systems/hrms/src/hooks/useAuth.ts), `refreshCurrentUser`; [session-expiry-guard.tsx](/home/innocent/systems/hrms/src/components/auth/session-expiry-guard.tsx), token refresh catch.

**Implemented:** `refreshCurrentUser` clears the session on every error. Token refresh also expires it on every error, whereas access-context synchronization already distinguishes 401 from transient failures.

**Missing/impact:** A network outage or backend 500 destroys usable refresh credentials and requires sign-in. This behavior is inconsistent across the same auth lifecycle and undermines offline/transient-failure handling. It does not imply expired access tokens should continue authorizing calls.

**Blueprint:** Clear only when the server definitively rejects credentials/session. On temporary failure keep credentials, mark session degraded, retry with backoff, and pause protected actions once access expires.

```ts
catch (error) {
  if (isDefinitiveSessionRejection(error)) clearSession();
  else { sessionStore.setHealth("degraded"); scheduleBoundedRetry(); }
}
// Use stable server codes; a blanket `status === 400` can be too broad.
```

## 3. DATA VALIDATION & SECURITY GAP ANALYSIS

### 14. P1 — Photo upload writes unauthenticated arbitrary image-labelled bytes to public storage

**File:** [profile-photo-upload/route.ts](/home/innocent/systems/hrms/src/app/api/profile-photo-upload/route.ts:37).

**Implemented:** Parses multipart data, trusts `File.type` plus filename extension, limits each file to 5 MB, writes beneath `public/uploads/profile-photos`, and returns a URL. No authentication/ownership/rate check occurs.

**Missing/impact:** An anonymous caller can write repeated files to disk. The size check occurs after multipart parsing and is not a request-body resource limit. MIME/extension checks do not prove image bytes are valid. Local files lack retention/deletion and shared-storage behavior; read-only or multi-instance deployments may fail or serve inconsistent URLs. Random filenames prevent name collisions but do not authorize uploads.

**Blueprint:** Prefer the backend's authenticated upload service. Enforce identity, ownership, upload quotas and body limits before expensive processing; decode/re-encode accepted formats and store in durable storage.

```ts
const actor = await requireSession(request); // verify, not cookie presence
await assertCanUpdateProfile(actor, employeeId);
await enforceUploadQuota(actor.id);
const image = await decodeAndReencodeImage(bytes, { maxPixels: 20_000_000 });
return Response.json(await mediaStore.saveProfileImage(actor, image));
```

### 15. P1 — Public support chat can spend server API credentials without bounded inputs

**File:** [support/chat/route.ts](/home/innocent/systems/hrms/src/app/api/support/chat/route.ts).

**Implemented:** Accepts user-supplied roles/content, keeps the last 12 messages, and invokes xAI when a server key exists. Provider failures fall back to local guide answers.

**Missing/impact:** No authentication, rate/quota control, content-length bound, request-body bound, or provider timeout exists in this handler. A caller can submit very long messages or repeatedly invoke the paid service. Nest's throttler does not protect a locally handled Next route. Deployment-level protections were not verified. This is a cost/resource abuse issue; no arbitrary tool execution was found.

**Blueprint:** Require an appropriate session or deliberately designed public quota; validate before invocation and limit output/deadline.

```ts
const Message = z.object({ role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4_000) });
const Body = z.object({ messages: z.array(Message).min(1).max(12) });
await rateLimitVerifiedCaller(request);
const input = Body.parse(await readSizeLimitedJson(request, 64_000));
// Provider fetch: timeout + max_output_tokens + server-enforced usage quota.
```

### 16. P1 — Financial DTO validation accepts invalid amounts and fractional/NaN terms

**Files:** backend [employee-finance.dto.ts](/home/innocent/systems/hrms_backend/src/modules/hr/employee-finance/dto/employee-finance.dto.ts:144), [employee-finance-money.util.ts](/home/innocent/systems/hrms_backend/src/modules/hr/employee-finance/services/employee-finance-money.util.ts:14), frontend [finance-self-view.tsx](/home/innocent/systems/hrms/src/components/dashboard/finance-self-view.tsx:264).

**Implemented:** Create amount uses only `@IsString`; IDs/term use `@IsNumber` without positivity/integer bounds. Eligibility term has `@IsOptional` and numeric transformation but no numeric validator. Purpose uses only `@IsString`. Frontend checks mostly nonempty fields.

**Confirmed reproduction:** Create `{ product_id: 1, requested_amount: 'abc', requested_term_months: 1.5, purpose: '' }` validates with no errors. Eligibility `{ product_id: 1, requested_amount: 'abc', requested_term_months: 'banana' }` also has no errors after transformation. `EmployeeFinanceMoney.toCents('abc')` throws `SyntaxError`; the global filter turns non-HTTP errors into 500s. This is a validation-to-money-parser gap, not just a typing preference.

**Blueprint:** Reuse validated money/integer constraints in create/evaluate DTOs and matching frontend schemas; catch invalid internal monetary values defensively. Preserve decimal strings rather than floating-point amounts.

```ts
@Type(() => Number) @IsInt() @Min(1)
product_id: number;
@IsString() @MaxLength(18) @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/)
requested_amount: string; // additional positive-money validator
@Type(() => Number) @IsInt() @Min(1) @Max(600)
requested_term_months: number; // choose a documented domain upper bound
@Transform(({ value }) => typeof value === "string" ? value.trim() : value)
@IsString() @IsNotEmpty() @MaxLength(2_000)
purpose: string;
// Optional eligibility fields use the same validators + @IsOptional().
```

### 17. P2 — KPI period query parameters bypass DTO validation and can silently drop the filter

**Files:** backend [performance-self-service.controller.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/controllers/performance-self-service.controller.ts:78), [performance-manager.controller.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/controllers/performance-manager.controller.ts:53), [employee-kpi-cycle-review.service.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/employee-kpi-cycle-review.service.ts:140).

**Implemented:** `@Query('period_id')` is a string converted by `Number()`. Service spreads the filter only when `periodId` is truthy. Mutation IDs already use `ParseIntPipe`, and review kinds are validated in the service.

**Missing/impact:** `period_id=abc` becomes NaN and drops the filter; `0` also drops it. Invalid input returns all actor-authorized reviews rather than a 400. Fractions/negative values are not rejected at the boundary. Tenant/employee checks still apply; this is not evidence of a tenant authorization bypass.

**Blueprint:** Validate the query DTO separately from the body and route ID.

```ts
class KpiReviewQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  period_id?: number;
}
listKpiReviews(@Req() req: AuthedRequest, @Query() query: KpiReviewQueryDto) {
  return service.listOwn(req.user, query.period_id);
}
// Service: `periodId !== undefined`, not truthiness.
```

### 18. P2 — Database constraint errors become generic 500s

**Files:** backend [http-exception.filter.ts](/home/innocent/systems/hrms_backend/src/common/filters/http-exception.filter.ts:64), [permissions.service.ts](/home/innocent/systems/hrms_backend/src/modules/permissions/permissions.service.ts:57), [permission.entity.ts](/home/innocent/systems/hrms_backend/src/modules/permissions/entities/permission.entity.ts:19), [employee-grades.service.ts](/home/innocent/systems/hrms_backend/src/modules/hr/grades/employee-grades.service.ts).

**Implemented:** Catch-all filter responds to every uncaught exception, so errors do not simply leave HTTP clients hanging. Permissions save directly into a unique name index. Grades pre-check uniqueness before saving.

**Missing/impact:** Non-HTTP TypeORM/PostgreSQL errors are mapped to 500. Duplicate permission names and race-time grade collisions are conflicts, not internal errors. Pre-checks cannot replace handling database uniqueness. Production DEBUG mode can expose the underlying exception message because of the filter's explicit debug branch.

**Blueprint:** Translate known PostgreSQL codes into stable sanitized application errors. Keep unknown failures as logged 500s and never expose raw SQL/driver messages in production.

```ts
if (error instanceof QueryFailedError) {
  const code = (error.driverError as { code?: string }).code;
  if (code === "23505") throw new ConflictException({
    code: "RESOURCE_ALREADY_EXISTS", message: "This record already exists." });
  if (code === "23503") throw new ConflictException({
    code: "RESOURCE_IN_USE", message: "A related record prevents this change." });
  if (code === "23502" || code === "22P02")
    throw new BadRequestException("Invalid record data.");
}
// Prefer domain-specific field errors where constraint identity is known.
```

### 19. P1 — Finance numbering and active-application limits are non-atomic

**Files:** backend [employee-finance-core.services.ts](/home/innocent/systems/hrms_backend/src/modules/hr/employee-finance/services/employee-finance-core.services.ts:1255), [employee-finance-application.entities.ts](/home/innocent/systems/hrms_backend/src/modules/hr/employee-finance/entities/employee-finance-application.entities.ts:19).

**Implemented:** Counts active applications, checks the configured maximum, counts all company applications, then saves `EFAPP-<company>-<count + 1>`. A database unique company/application-number constraint exists.

**Missing/impact:** Concurrent creates can both pass the active limit and allocate the same number. Different employees in the same company can collide on numbering. The unique constraint prevents duplicate numbers but yields a generic 500 without the translation above. Count-based numbering can also reuse a number after deletions. This conclusion follows from the separate reads/save; concurrent database reproduction was not run.

**Blueprint:** Inside a transaction, lock a stable employee/company membership row before checking active limits. Use a database sequence or atomically incremented company counter, and an idempotency key for retries.

```ts
await dataSource.transaction(async (manager) => {
  await lockEmployeeRow(manager, companyId, employeeId);
  await assertActiveApplicationLimit(manager, companyId, employeeId);
  const number = await allocateCompanySequence(manager, companyId);
  return manager.save(Application, buildApplication(number, validatedDto));
});
// Allocation and application insert must share transaction ownership.
```

## 4. ACCUMULATED TECH DEBT & TODOs

### 20. P2 — Lifecycle lint rules are disabled across the largest feature area

**File:** [eslint.config.mjs](/home/innocent/systems/hrms/eslint.config.mjs).

**Implemented:** Dashboard-wide overrides disable `react-hooks/exhaustive-deps` and unused-variable checks. `react-hooks/set-state-in-effect` is disabled globally.

**Missing/impact:** A passing lint run does not verify stale closure/dependency correctness in dashboard components. Blanket exceptions conceal unfinished integration and make future lifecycle regressions harder to detect. Not every effect state update is wrong; narrowly justify necessary exceptions.

**Blueprint:** Restore dependency checking incrementally, starting with auth and finance flows; scope unavoidable suppressions to a line with a reason.

```js
{
  files: ["src/components/dashboard/**/*.tsx"],
  rules: {
    "react-hooks/exhaustive-deps": "warn", // ratchet to error after cleanup
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  },
}
// Do not add unstable dependencies blindly; stabilize callbacks or relocate work.
```

### 21. P3 — Central API and view files combine many unrelated domains

**Files:** [admin-api.ts](/home/innocent/systems/hrms/src/lib/admin-api.ts) **20,533 lines**; [leave-management-view.tsx](/home/innocent/systems/hrms/src/components/dashboard/leave-management-view.tsx) **6,227**; [employee-profile-page.tsx](/home/innocent/systems/hrms/src/components/dashboard/employee-profile-page.tsx) **5,843**; [attendance-management-view.tsx](/home/innocent/systems/hrms/src/components/dashboard/attendance-management-view.tsx) **3,804**; [schedule-management-view.tsx](/home/innocent/systems/hrms/src/components/dashboard/schedule-management-view.tsx) **3,240**.

**Implemented:** Broad endpoint adapters, heuristic parsing, transport/cache logic, form configuration, mutations, and presentation coexist in very large modules. Unit tests cover many endpoint mappings but do not enforce live DTO compatibility or rendered lifecycle behavior.

**Missing/impact:** Domain ownership and contracts are hard to review; common changes have a large regression surface. File size alone does not prove a bundle-performance defect; measure bundles before making that claim.

**Blueprint:** Extract shared transport first, then domain schemas/adapters, hooks, and focused presentation components. Preserve the existing exports temporarily through a migration facade.

```text
src/lib/api/{transport,error,cache}.ts
src/features/finance/{schemas,api,use-finance-applications}.ts
src/features/finance/components/{application-wizard,application-table}.tsx
src/features/leave/{schemas,api,hooks,components}/
src/lib/admin-api.ts → compatibility exports → remove after caller migration
```

Prioritize behavioral tests for reversed eligibility responses, logout/switch cache isolation, partial-finance retry, malformed envelopes, and concurrent application creation. Do not merely mirror endpoint string construction.

### 22. P3 — Unsupported credential stubs and missing route error recovery remain

**Files:** [admin-api.ts](/home/innocent/systems/hrms/src/lib/admin-api.ts:7625), `createEmployeeAccessCredentials/updateEmployeeAccessCredentials`; [src/app/dashboard](/home/innocent/systems/hrms/src/app/dashboard), [src/app](/home/innocent/systems/hrms/src/app).

**Implemented:** Two exported credential mutation functions always throw an “unavailable” error. No callers were found outside their declaration file. The dashboard has `loading.tsx` and Suspense but no `error.tsx` or global error boundary file.

**Missing/impact:** The credential API surface advertises unavailable mutations, though no broken visible button was confirmed. Loading boundaries do not catch unexpected render errors; a response-contract or render failure lacks a local recovery experience. Credential implementation should follow actual device/backend capabilities rather than fabricating a generic endpoint.

**Blueprint:** Remove unused unsupported exports or expose explicit capability metadata. Add a real dashboard error boundary with reset and telemetry; implement credential mutations only against supported backend endpoints.

```tsx
// src/app/dashboard/error.tsx
"use client";
export default function DashboardError({ reset }: { reset: () => void }) {
  return <div role="alert">
    <p>We could not load this view.</p>
    <button onClick={reset}>Try again</button>
  </div>;
}
// credentials.capabilities = { create: false, update: false };
```

### TODO/placeholder/module inventory: what was not a gap

- No empty source files were found in either source tree.
- No genuine `TODO`/`FIXME` implementation comments were identified by the scan. `TODO` strings in employee requests are workflow statuses, not unfinished code.
- Backend analytics' `Report "..." is not implemented` occurs in the unknown-report definition guard; it is not evidence that an advertised report is a placeholder.
- Input `placeholder` attributes and legacy redirect pages are intentional UI/navigation constructs, not missing implementations.
- The module-reference scan and `AppModule`/`HrModule` inspection did not identify an obviously abandoned module. Queue enable/disable and Redis worker registration still need live startup/shutdown integration tests; no broken worker lifecycle is asserted from static inspection alone.

## Refactoring order and completion criteria

1. **Fix P1 boundaries:** authenticate/restrict photo uploads; bound public chat; validate money/terms; atomically allocate finance numbers; identity-scope warm caches. Verify invalid finance payloads return 400 and concurrent creation respects limits without duplicate numbers.
2. **Repair API contracts:** one typed error/transport layer, schema validation, exact envelope adapters, absolute server backend URL, intentional media routing. Verify same-origin and direct-backend configurations and non-JSON backend failures.
3. **Repair state cycles:** reactive auth store, generation-aware GET cache, cancellation/latest-result guards, finance draft recovery, explicit unavailable/error slice states. Test account/company switches and delayed/reversed responses.
4. **Reduce debt:** restore lifecycle lint coverage, split domains gradually, add route recovery, remove unsupported exports. Expand tests around user behavior rather than adding tests that duplicate implementation.

The passing checks establish compile/unit consistency. They do not establish production readiness for the affected flows until browser/API/database integration checks above pass.
