import { afterEach, describe, expect, it, vi } from "vitest";
import { requireSession } from "./session";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const snapshot = { id: 7, companyId: 3, employeeId: 11, scope: "company",
  userType: "COMPANY_USER", dashboardType: "employee", roles: [], permissions: [] };

describe("server authentication snapshots", () => {
  it("requires credentials and never decodes browser metadata as proof", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const request = new Request("http://localhost/upload", { headers: {
      origin: "http://localhost", cookie: "hrms_dashboard_auth=1",
    } });
    await expect(requireSession(request)).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifies credentials at an absolute backend origin even in same-origin API mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubEnv("BACKEND_ORIGIN", "http://backend:8888");
    const fetchMock = vi.fn().mockResolvedValue(Response.json(snapshot));
    vi.stubGlobal("fetch", fetchMock);
    const session = await requireSession(new Request("http://localhost/upload", { headers: { authorization: "Bearer signed-token" } }));
    expect(session.employeeId).toBe(11);
    expect(fetchMock.mock.calls[0][0].toString()).toBe("http://backend:8888/api/auth/session");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer signed-token");
  });

  it("rejects a cookie-authenticated cross-origin mutation before backend verification", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(requireSession(new Request("http://localhost/upload", { headers: {
      origin: "https://other-site.example", cookie: "hrms_dashboard_token=signed-token",
    } }))).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats an invalid authoritative snapshot as a contract failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...snapshot, permissions: "admin" })));
    await expect(requireSession(new Request("http://localhost/upload", { headers: { authorization: "Bearer signed-token" } })))
      .rejects.toMatchObject({ name: "ContractError", status: 502 });
  });
});
