import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/server/http";

vi.mock("@/lib/server/session", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/server/rate-limit", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/server/rate-limit")>();
  return { ...original, enforceRateLimit: vi.fn().mockResolvedValue(undefined) };
});
import { requireSession } from "@/lib/server/session";
import { POST } from "./route";

const actor = { id: 5, employeeId: 10, companyId: 7, scope: "company" as const,
  userType: "COMPANY_USER" as const, dashboardType: "employee" as const,
  roles: [], permissions: [], accessToken: "verified-token" };

function uploadRequest(bytes: Uint8Array<ArrayBuffer>, employeeId?: number, mime = "image/png") {
  const body = new FormData();
  body.set("file", new Blob([bytes], { type: mime }), "photo.png");
  return new Request(`http://localhost/api/profile-photo-upload${employeeId ? `?employeeId=${employeeId}` : ""}`, {
    method: "POST", body,
  });
}

afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("authenticated media pipeline", () => {
  it("rejects anonymous requests before consuming their body", async () => {
    vi.mocked(requireSession).mockRejectedValue(new HttpError(401, "Sign in."));
    const request = new Request("http://localhost/api/profile-photo-upload", { method: "POST", body: "arbitrary" });
    expect((await POST(request)).status).toBe(401);
    expect(request.bodyUsed).toBe(false);
  });

  it("rejects another employee before consuming multipart bytes", async () => {
    vi.mocked(requireSession).mockResolvedValue(actor);
    const request = uploadRequest(new Uint8Array([1]), 99);
    expect((await POST(request)).status).toBe(403);
    expect(request.bodyUsed).toBe(false);
  });

  it("rejects spoofed image MIME bytes without contacting the upload engine", async () => {
    vi.mocked(requireSession).mockResolvedValue(actor);
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await POST(uploadRequest(new TextEncoder().encode("not a PNG")))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects oversized chunked uploads", async () => {
    vi.mocked(requireSession).mockResolvedValue(actor);
    expect((await POST(uploadRequest(new Uint8Array(5 * 1024 * 1024 + 1)))).status).toBe(413);
  });

  it("forwards only decoded, sanitized images using the authenticated self engine", async () => {
    vi.mocked(requireSession).mockResolvedValue(actor);
    vi.stubEnv("BACKEND_ORIGIN", "http://backend:8888");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ profile_photo_url: "/uploads/profile-photos/test.webp",
      approval_required: false, applied_immediately: true }));
    vi.stubGlobal("fetch", fetchMock);
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
    const response = await POST(uploadRequest(Uint8Array.from(png)));
    expect(response.status).toBe(201);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("http://backend:8888/api/me/profile/photo");
    expect(init.headers.Authorization).toBe("Bearer verified-token");
    const file = init.body.get("file") as File;
    expect(file.type).toBe("image/webp");
    const metadata = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
    expect(metadata.format).toBe("webp");
    expect((await response.json()).url).toBe("http://localhost/uploads/profile-photos/test.webp");
  });

  it("routes an explicitly authorized admin to the target employee engine", async () => {
    vi.mocked(requireSession).mockResolvedValue({ ...actor, dashboardType: "admin", permissions: ["employees:update"] });
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ profile_photo_url: "/uploads/test.webp" }));
    vi.stubGlobal("fetch", fetchMock);
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer();
    expect((await POST(uploadRequest(Uint8Array.from(png), 99))).status).toBe(201);
    expect(fetchMock.mock.calls[0][0].pathname).toBe("/api/employees/99/profile-photo");
  });
});
