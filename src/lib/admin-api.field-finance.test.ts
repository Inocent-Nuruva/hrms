import { afterEach, describe, expect, it, vi } from "vitest";

import {
  approveEmployeeFinanceApplication,
  addMyFinanceApplicationDocument,
  addMyFinanceApplicationGuarantor,
  checkInMyFieldVisit,
  createEmployeeFinanceProduct,
  createFieldParty,
  createMyFinanceApplication,
  decideMyFinanceGuarantorRequest,
  evaluateMyFinanceEligibility,
  getEmployeeFinanceAccountStatement,
  getEmployeeFinanceReadiness,
  getEmployeeFinanceSanctionLetter,
  createMyFieldVisitPlan,
  getEmployeeFinanceDashboard,
  getEmployeeFinanceReport,
  getManagerFieldVisitDashboard,
  importEmployeeFinancePayments,
  listEmployeeFinanceAuditTimeline,
  listEmployeeFinanceApplicationDocuments,
  listEmployeeFinanceApplicationGuarantors,
  listHrFieldVisits,
  listMyFieldVisits,
  listMyFinanceApplications,
  listMyFinanceGuarantorRequests,
  reviewManagerFieldVisit,
  submitMyFinanceApplication,
  uploadMyFinanceApplicationDocument,
  verifyEmployeeFinanceApplicationDocument,
  postEmployeeFinanceAccounting,
} from "./admin-api";

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("field and finance admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists HR field visits with the documented filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          items: [
            { id: 9, status: "IN_PROGRESS", visit_type: "CUSTOMER_VISIT" },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listHrFieldVisits("token", {
      page: 1,
      status: "IN_PROGRESS",
      date_from: "2026-08-01",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/hr/field-visits?page=1&status=IN_PROGRESS&date_from=2026-08-01",
      expect.objectContaining({ method: "GET" }),
    );
    expect(rows).toEqual([expect.objectContaining({ id: 9 })]);
  });

  it("creates a party, a visit plan, and checks in", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { id: 3 } }, { status: 201 }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 12 } }, { status: 201 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 44, status: "CHECKED_IN" } }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { open_visits: 2 } }))
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 44 }] } }));
    vi.stubGlobal("fetch", fetchMock);

    await createFieldParty("token", { party_type: "CUSTOMER", name: "Acme" });
    await createMyFieldVisitPlan("token", {
      visit_date: "2026-08-18",
      items: [{ visit_type: "CUSTOMER_VISIT", purpose: "Renewal" }],
    });
    await checkInMyFieldVisit("token", 44, {
      client_request_id: "11111111-1111-1111-1111-111111111111",
      captured_at: "2026-08-18T08:00:00.000Z",
      latitude: -6.8,
      longitude: 39.2,
    });
    await getManagerFieldVisitDashboard("token");
    await listMyFieldVisits("token", { status: "CHECKED_IN" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/field-parties",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/me/field-visits/44/check-in",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("reviews a visit and runs employee finance product and application flows", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 44, status: "APPROVED" } }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { open_accounts: 3 } }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 7, code: "SL-01" } }, { status: 201 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: { eligible: true, estimated_installment: "41666.67" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { items: [{ id: 21, status: "DRAFT" }] } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 21, status: "DRAFT" } }, { status: 201 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 21, status: "SUBMITTED" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 21, status: "APPROVED" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await reviewManagerFieldVisit("token", 44, {
      decision: "APPROVE",
      comments: "Good visit.",
    });
    await getEmployeeFinanceDashboard("token");
    await createEmployeeFinanceProduct("token", {
      product_type: "STAFF_LOAN",
      code: "SL-01",
      name: "Staff loan",
      description: "Configurable staff loan product",
      interest_method: "FLAT_RATE",
      annual_interest_rate: "12",
      minimum_amount: "100000",
      maximum_amount: "1000000",
      maximum_salary_multiple: "3",
      minimum_term_months: 1,
      maximum_term_months: 12,
      minimum_service_months: 6,
      maximum_installment_percentage: "35",
      maximum_active_accounts: 1,
      requires_confirmation: true,
      allow_rescheduling: true,
      allow_deferment: true,
      allow_early_settlement: true,
      allow_additional_repayment: true,
      required_document_types: ["PAYSLIP", "ID_COPY"],
      approval_configuration: { required_guarantors: 1 },
      effective_from: "2026-01-01",
    });
    await evaluateMyFinanceEligibility("token", {
      product_id: 7,
      requested_amount: "250000",
      requested_term_months: 6,
    });
    const mine = await listMyFinanceApplications("token");
    await createMyFinanceApplication("token", {
      product_id: 7,
      requested_amount: "250000",
      requested_term_months: 6,
      purpose: "School fees",
    });
    await submitMyFinanceApplication("token", 21);
    await approveEmployeeFinanceApplication("token", 21);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/manager/field-visits/44/review",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/employee-finance/products",
      expect.objectContaining({ method: "POST" }),
    );
    const productRequest = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(JSON.parse(String(productRequest.body))).toEqual(
      expect.objectContaining({
        annual_interest_rate: "12",
        interest_method: "FLAT_RATE",
        required_document_types: ["PAYSLIP", "ID_COPY"],
        approval_configuration: { required_guarantors: 1 },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/me/finance/eligibility",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mine).toEqual([expect.objectContaining({ id: 21 })]);
  });

  it("manages employee finance documents, guarantors, and sanction letters", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 5, status: "UPLOADED" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 6, status: "PENDING" } }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 6 }] } }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 6, status: "APPROVED" } }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 5 }] } }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 5, status: "VERIFIED" } }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 6 }] } }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 9, letter_no: "EFS-1" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await addMyFinanceApplicationDocument("token", 21, {
      document_type: "PAYSLIP",
      file_url: "https://example.test/payslip.pdf",
    });
    await addMyFinanceApplicationGuarantor("token", 21, {
      guarantor_employee_id: 30,
    });
    await listMyFinanceGuarantorRequests("token");
    await decideMyFinanceGuarantorRequest("token", 6, { decision: "APPROVED" });
    await listEmployeeFinanceApplicationDocuments("token", 21);
    await verifyEmployeeFinanceApplicationDocument("token", 21, 5);
    await listEmployeeFinanceApplicationGuarantors("token", 21);
    await getEmployeeFinanceSanctionLetter("token", 21);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/me/finance/applications/21/documents",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/me/finance/guarantor-requests/6/decide",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "http://localhost:8888/api/employee-finance/applications/21/documents/5/verify",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      "http://localhost:8888/api/employee-finance/applications/21/sanction-letter",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("loads the finance account statement for operations", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: {
          account: { id: 12, account_no: "EF-1" },
          installments: [{ id: 1 }],
          ledger: [{ id: 2 }],
          disbursements: [{ id: 3 }],
          repayments: [{ id: 4 }],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const statement = await getEmployeeFinanceAccountStatement("token", 12);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/finance/employee-finance/accounts/12/statement",
      expect.objectContaining({ method: "GET" }),
    );
    expect(statement).toEqual(
      expect.objectContaining({ account: expect.objectContaining({ id: 12 }) }),
    );
  });

  it("loads employee finance reports and audit timeline", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { reportType: "aging", rows: [] } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: { items: [{ id: 1, action: "finance.account.created" }] },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { ready: true, checks: [] } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await getEmployeeFinanceReport("token", "aging", {
      date_from: "2026-01-01",
    });
    const audit = await listEmployeeFinanceAuditTimeline("token", {
      entity_type: "EMPLOYEE_FINANCE_ACCOUNT",
    });
    const readiness = await getEmployeeFinanceReadiness("token");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/employee-finance/reports/aging?date_from=2026-01-01",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/employee-finance/reports/audit?entity_type=EMPLOYEE_FINANCE_ACCOUNT",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/employee-finance/reports/readiness",
      expect.objectContaining({ method: "GET" }),
    );
    expect(audit).toEqual([expect.objectContaining({ id: 1 })]);
    expect(readiness).toEqual(expect.objectContaining({ ready: true }));
  });

  it("uploads finance documents and runs payment import/accounting posting", async () => {
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      readAsDataURL() {
        this.result =
          "data:text/csv;base64,cGF5bWVudF9yZWZlcmVuY2UsYW1vdW50LHN0YXR1cwpCQU5LLTEsMTAwLFNVQ0NFU1M=";
        this.onload?.();
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 10, status: "UPLOADED" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { summary: { posted_rows: 1 } } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { summary: { journal_count: 2 } } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await uploadMyFinanceApplicationDocument("token", 21, {
      document_type: "PAYSLIP",
      file: {
        fileName: "payslip.pdf",
        fileSize: 10,
        mimeType: "application/pdf",
        fileString: "cGRm",
      },
    });
    await importEmployeeFinancePayments(
      "token",
      new File(["x"], "payments.csv", { type: "text/csv" }),
      {
        dryRun: false,
      },
    );
    await postEmployeeFinanceAccounting("token", { dry_run: false });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/me/finance/applications/21/documents/upload",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/finance/employee-finance/payments/import",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/finance/employee-finance/accounting/post",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
