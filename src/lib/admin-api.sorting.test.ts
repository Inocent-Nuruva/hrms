import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getMyAttendanceOverview,
  listMyActionItems,
  listMyAttendanceCorrectionRequests,
  listMyAttendancePunches,
  listUsers,
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

describe("shared admin API sort guards", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("drops sortValue from user list requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { items: [], page: 1, limit: 20, total: 0, totalPages: 0 } }));
    vi.stubGlobal("fetch", fetchMock);

    await listUsers("token", {
      page: 1,
      limit: 20,
      sortBy: "sortValue",
      sortOrder: "DESC",
      search: "Ann",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/users?page=1&limit=20&search=Ann",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("drops sortValue from self-service attendance overview requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { items: [] } }));
    vi.stubGlobal("fetch", fetchMock);

    await getMyAttendanceOverview("token", {
      page: 1,
      limit: 20,
      sortBy: "sortValue",
      sortOrder: "DESC",
      from_date: "2026-08-01",
      to_date: "2026-08-21",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/me/attendance/overview?page=1&limit=20&from_date=2026-08-01&to_date=2026-08-21",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("drops sortValue from self-service attendance punches requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { items: [], page: 1, limit: 50, total: 0, totalPages: 0 } }));
    vi.stubGlobal("fetch", fetchMock);

    await listMyAttendancePunches("token", {
      page: 1,
      limit: 50,
      sortBy: "sortValue",
      sortOrder: "DESC",
      dateFrom: "2026-08-21",
      dateTo: "2026-08-21",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/me/attendance/punches?page=1&limit=50&dateFrom=2026-08-21&dateTo=2026-08-21",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("drops sortValue from self-service request lists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { items: [], page: 1, limit: 5, total: 0, totalPages: 0 } }));
    vi.stubGlobal("fetch", fetchMock);

    await listMyAttendanceCorrectionRequests("token", {
      page: 1,
      limit: 5,
      sortBy: "sortValue",
      sortOrder: "DESC",
      status: "PENDING",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/me/attendance/correction-requests?page=1&limit=5&status=PENDING",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("drops sortValue from generic record-query helpers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await listMyActionItems("token", {
      limit: 20,
      sortBy: "sortValue",
      sortOrder: "DESC",
      status: "OPEN",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/me/action-items?limit=20&status=OPEN",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
