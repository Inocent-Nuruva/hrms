import { describe, expect, it, vi } from "vitest";
import {
  resumeFinanceDraft,
  type FinanceCheckpoint,
  type FinanceWorkflowApi,
} from "./finance-draft-workflow";

function checkpoint(): FinanceCheckpoint {
  return {
    payload: {
      product_id: 1,
      requested_amount: "100",
      requested_term_months: 6,
      purpose: "Travel",
    },
    form: {},
    requiredDocuments: ["ID", "CONTRACT"],
    guarantorIds: [2],
    autoSubmit: true,
    draftId: null,
    startedAt: Date.now(),
    creationPending: false,
    completedDocuments: [],
    completedGuarantors: [],
    submitted: false,
  };
}
function api(): FinanceWorkflowApi {
  return {
    create: vi.fn().mockResolvedValue("99"),
    applications: vi
      .fn()
      .mockResolvedValue([
        {
          id: 99,
          status: "DRAFT",
          productId: 1,
          requestedAmount: "100.00",
          requestedTermMonths: 6,
          purpose: "Travel",
          createdAt: new Date().toISOString(),
        },
      ]),
    documents: vi.fn().mockResolvedValue([]),
    guarantors: vi.fn().mockResolvedValue([]),
    upload: vi.fn().mockResolvedValue({ id: 1 }),
    addGuarantor: vi.fn().mockResolvedValue({ id: 2 }),
    submit: vi.fn().mockResolvedValue({ id: 99 }),
  };
}
const files = {
  ID: new File(["id"], "id.pdf"),
  CONTRACT: new File(["contract"], "contract.pdf"),
};

describe("recoverable finance workflow", () => {
  it("retains the draft and retries only unfinished steps after an upload failure", async () => {
    const service = api();
    let saved = checkpoint();
    let uploaded = false;
    service.upload = vi.fn().mockImplementation(async (_id, type) => {
      if (type === "ID") {
        uploaded = true;
        return {};
      }
      throw new Error("Upload disconnected");
    });
    service.documents = vi
      .fn()
      .mockImplementation(async () =>
        uploaded ? [{ documentType: "ID", status: "UPLOADED" }] : [],
      );
    await expect(
      resumeFinanceDraft(
        saved,
        files,
        service,
        (next) => {
          saved = next;
        },
        () => true,
      ),
    ).rejects.toThrow("Upload disconnected");
    expect(saved.draftId).toBe("99");
    expect(saved.completedDocuments).toEqual(["ID"]);
    service.upload = vi.fn().mockResolvedValue({});
    await resumeFinanceDraft(
      saved,
      { CONTRACT: files.CONTRACT },
      service,
      (next) => {
        saved = next;
      },
      () => true,
    );
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(service.upload).toHaveBeenCalledTimes(1);
    expect(service.upload).toHaveBeenCalledWith(
      "99",
      "CONTRACT",
      files.CONTRACT,
    );
    expect(service.submit).toHaveBeenCalledTimes(1);
  });
  it("reconciles already-completed server steps after a lost response", async () => {
    const service = api();
    const saved = { ...checkpoint(), draftId: "99" };
    vi.mocked(service.documents).mockResolvedValue([
      { documentType: "ID" },
      { documentType: "CONTRACT" },
    ]);
    vi.mocked(service.guarantors).mockResolvedValue([
      { guarantorEmployeeId: 2 },
    ]);
    await resumeFinanceDraft(
      saved,
      {},
      service,
      () => undefined,
      () => true,
    );
    expect(service.upload).not.toHaveBeenCalled();
    expect(service.addGuarantor).not.toHaveBeenCalled();
    expect(service.create).not.toHaveBeenCalled();
    expect(service.submit).toHaveBeenCalledTimes(1);
  });
  it("tracks a separate guarantor form for each selected employee", async () => {
    const service = api();
    const saved = {
      ...checkpoint(),
      draftId: "99",
      requiredDocuments: ["GUARANTOR_FORM::2", "GUARANTOR_FORM::3"],
      guarantorIds: [2, 3],
    };
    vi.mocked(service.documents).mockResolvedValue([
      {
        documentType: "GUARANTOR_FORM",
        status: "UPLOADED",
        metadata: { guarantor_employee_id: 2 },
      },
    ]);
    vi.mocked(service.guarantors).mockResolvedValue([
      { guarantorEmployeeId: 2 },
      { guarantorEmployeeId: 3 },
    ]);
    const secondForm = new File(["signed"], "guarantor-3.pdf");

    await resumeFinanceDraft(
      saved,
      { "GUARANTOR_FORM::3": secondForm },
      service,
      () => undefined,
      () => true,
    );

    expect(service.upload).toHaveBeenCalledTimes(1);
    expect(service.upload).toHaveBeenCalledWith(
      "99",
      "GUARANTOR_FORM::3",
      secondForm,
    );
  });
  it("recovers an uncertain create using exact decimal equivalence without posting a duplicate", async () => {
    const service = api();
    const saved = {
      ...checkpoint(),
      creationPending: true,
      requiredDocuments: [],
      guarantorIds: [],
    };
    const completed = await resumeFinanceDraft(
      saved,
      {},
      service,
      () => undefined,
      () => true,
    );
    expect(completed.draftId).toBe("99");
    expect(service.create).not.toHaveBeenCalled();
  });
  it("blocks another create when the previous result is still uncertain", async () => {
    const service = api();
    vi.mocked(service.applications).mockResolvedValue([]);
    await expect(
      resumeFinanceDraft(
        { ...checkpoint(), creationPending: true },
        files,
        service,
        () => undefined,
        () => true,
      ),
    ).rejects.toThrow("unconfirmed");
    expect(service.create).not.toHaveBeenCalled();
  });
  it("recognizes a completed submit after the acknowledgement was lost", async () => {
    const service = api();
    vi.mocked(service.applications).mockResolvedValue([
      { id: 99, status: "PENDING_HR_APPROVAL" },
    ]);
    const result = await resumeFinanceDraft(
      { ...checkpoint(), draftId: "99" },
      {},
      service,
      () => undefined,
      () => true,
    );
    expect(result.submitted).toBe(true);
    expect(service.submit).not.toHaveBeenCalled();
  });
  it("stops checkpoint updates and remaining mutations when the view identity changes", async () => {
    const service = api();
    let active = true;
    service.create = vi.fn().mockImplementation(async () => {
      active = false;
      return "99";
    });
    const save = vi.fn();
    await expect(
      resumeFinanceDraft(checkpoint(), files, service, save, () => active),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(save).toHaveBeenCalledTimes(1);
    expect(service.upload).not.toHaveBeenCalled();
  });
});
