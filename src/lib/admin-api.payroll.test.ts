import { afterEach, describe, expect, it, vi } from "vitest";

import {
  approvePayrollInput,
  approvePayrollRun,
  createPayrollInput,
  downloadMyPayslip,
  downloadPayrollBankingBatch,
  exportPayrollAccountingJournal,
  generatePayrollPeriod,
  getPayrollIntegrationCatalog,
  getPayrollNotificationCatalog,
  getPayrollRunReconciliation,
  getPayrollReadiness,
  getMyPayslip,
  importPayrollBankStatement,
  importPayrollSources,
  listPayrollComponents,
  listPayrollRuns,
  listMyPayslips,
  postPayrollAccountingJournal,
} from "./admin-api";

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
    ...init,
  });
}

describe("payroll admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists payroll runs with supported filters and pagination", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          items: [
            {
              id: 41,
              run_type: "REGULAR",
              status: "PENDING",
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listPayrollRuns("token", {
      page: 1,
      limit: 20,
      search: "August",
      status: "PENDING",
      payroll_period_id: 8,
      sortBy: "created_at",
      sortOrder: "DESC",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/payroll/runs?page=1&limit=20&sortBy=created_at&sortOrder=DESC&search=August&payroll_period_id=8&status=PENDING",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    );
    expect(result.rows).toEqual([
      expect.objectContaining({
        id: 41,
        status: "PENDING",
      }),
    ]);
    expect(result.total).toBe(1);
  });

  it("lists employee payroll profiles without requiring a user sort field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ id: 3, payroll_number: "PN-1", employee_id: 1 }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { listEmployeePayrollProfiles } = await import("./admin-api");
    const result = await listEmployeePayrollProfiles("token", {
      page: 1,
      limit: 100,
      search: "PN",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/payroll/employees/profiles?page=1&limit=100&search=PN",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(result.rows).toEqual([
      expect.objectContaining({
        id: 3,
        payroll_number: "PN-1",
      }),
    ]);
  });

  it("creates inputs and approves payroll records with POST actions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 77, amount: "125000" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 77, status: "APPROVED" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 41, status: "APPROVED" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await createPayrollInput("token", {
      payroll_period_id: 9,
      employee_id: 120,
      component_code: "OVERTIME",
      amount: "125000",
    });
    await approvePayrollInput("token", 77);
    await approvePayrollRun("token", 41, {
      stage: "HR",
      calculation_hash: "hash-123",
      comments: "Ready for finance sign-off.",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/payroll/inputs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          payroll_period_id: 9,
          employee_id: 120,
          component_code: "OVERTIME",
          amount: "125000",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/payroll/inputs/77/approve",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/payroll/runs/41/approve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          stage: "HR",
          calculation_hash: "hash-123",
          comments: "Ready for finance sign-off.",
        }),
      }),
    );
  });

  it("generates payroll periods and unwraps configuration lists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 12, month: 8, year: 2026 } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 1,
              code: "BASIC",
              component_type: "EARNING",
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const generated = await generatePayrollPeriod("token", {
      payroll_calendar_id: 2,
      year: 2026,
      month: 8,
    });
    const components = await listPayrollComponents("token");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/payroll/configuration/periods/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          payroll_calendar_id: 2,
          year: 2026,
          month: 8,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/payroll/configuration/components",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(generated).toEqual(
      expect.objectContaining({ data: expect.anything() }),
    );
    expect(components).toEqual([
      expect.objectContaining({
        code: "BASIC",
      }),
    ]);
  });

  it("downloads generated bank batches and preserves the filename", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("batch-bytes", {
        status: 200,
        headers: {
          "content-type": "text/csv",
          "content-disposition":
            'attachment; filename="payroll-batch-aug-2026.csv"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadPayrollBankingBatch("token", 55);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/payroll/banking/batches/55/download",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    );
    expect(result.filename).toBe("payroll-batch-aug-2026.csv");
    expect(result.contentType).toBe("text/csv");
  });

  it("imports payroll sources and bank statement rows", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { count: 1 } }))
      .mockResolvedValueOnce(jsonResponse({ data: { import: { id: 8 } } }));
    vi.stubGlobal("fetch", fetchMock);

    await importPayrollSources("token", {
      payroll_period_id: 4,
      source_type: "COMMISSION",
      file_text: "employee_id,component_code,amount\n12,COMMISSION,90000",
      auto_approve: true,
    });
    await importPayrollBankStatement("token", {
      payroll_run_id: 9,
      file_text: "employee_id,amount,status\n12,1200000,PAID",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/payroll/sources/import",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          payroll_period_id: 4,
          source_type: "COMMISSION",
          file_text: "employee_id,component_code,amount\n12,COMMISSION,90000",
          auto_approve: true,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/payroll/banking/imports",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          payroll_run_id: 9,
          file_text: "employee_id,amount,status\n12,1200000,PAID",
        }),
      }),
    );
  });

  it("exports and posts payroll accounting journals", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          file_name: "PJ-2026-08.csv",
          mime_type: "text/csv",
          content: "debit,credit,amount\n5000,2000,100",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 22, status: "POSTED" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const exported = await exportPayrollAccountingJournal("token", 22);
    const posted = await postPayrollAccountingJournal("token", 22, {
      provider_key: "XERO",
      external_reference: "XERO-55",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/payroll/accounting/journals/22/export?format=csv",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/payroll/accounting/journals/22/post",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          provider_key: "XERO",
          external_reference: "XERO-55",
        }),
      }),
    );
    expect(exported.filename).toBe("PJ-2026-08.csv");
    expect(posted).toEqual(
      expect.objectContaining({ id: 22, status: "POSTED" }),
    );
  });

  it("loads payroll readiness, integrations, and notification catalog", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            module: "payroll",
            ready: false,
            checks: [{ code: "ERP_POSTING", status: "DRY_RUN_ONLY" }],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            module: "payroll",
            providers: [{ code: "erp-accounting", configured: false }],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ code: "payroll.run.created", channel: "in-app" }],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const readiness = await getPayrollReadiness("token");
    const integrations = await getPayrollIntegrationCatalog("token");
    const notifications = await getPayrollNotificationCatalog("token");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/payroll/reports/readiness",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/payroll/reports/integrations/catalog",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/payroll/reports/notifications/catalog",
      expect.objectContaining({ method: "GET" }),
    );
    expect(readiness).toEqual(
      expect.objectContaining({
        module: "payroll",
        ready: false,
      }),
    );
    expect(integrations).toEqual(
      expect.objectContaining({
        providers: [expect.objectContaining({ code: "erp-accounting" })],
      }),
    );
    expect(notifications).toEqual([
      expect.objectContaining({ code: "payroll.run.created" }),
    ]);
  });

  it("loads the run reconciliation report with payroll run scope", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: {
          code: "payroll-run-reconciliation",
          summary: { issue_count: 0, shortfall_count: 1 },
          rows: [{ instruction_id: 9, reserved_amount: "100.00" }],
          shortfalls: [{ id: 3, deferred_amount: "50.00" }],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPayrollRunReconciliation("token", 41);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/payroll/reports/payroll-run-reconciliation?payroll_run_id=41",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        code: "payroll-run-reconciliation",
        rows: [expect.objectContaining({ instruction_id: 9 })],
      }),
    );
  });

  it("lists, fetches, and downloads my payslips", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 18,
              payslip_number: "PS-2026-08-18",
              net_pay: "1450000",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 18,
            payslip_number: "PS-2026-08-18",
            gross_pay: "1800000",
            net_pay: "1450000",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response("pdf-bytes", {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition":
              'attachment; filename="payslip-august-2026.pdf"',
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listMyPayslips("token");
    const detail = await getMyPayslip("token", 18);
    const download = await downloadMyPayslip("token", 18);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/me/payslips",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/me/payslips/18",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/me/payslips/18/download",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        id: 18,
        payslip_number: "PS-2026-08-18",
      }),
    ]);
    expect(detail).toEqual(
      expect.objectContaining({
        id: 18,
        gross_pay: "1800000",
      }),
    );
    expect(download.filename).toBe("payslip-august-2026.pdf");
    expect(download.contentType).toBe("application/pdf");
  });
});
