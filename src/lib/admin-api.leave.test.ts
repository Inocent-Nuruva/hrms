import { afterEach, describe, expect, it, vi } from "vitest"
import { createMyLeaveRequest, uploadMyLeaveRequestDocument, extendLeaveEvidenceDeadline, retryLeaveRouting, downloadMyLeaveRequestDocument, patchMyLeaveRequestMedicalDetail } from "./admin-api"

describe("employee leave request API", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("forwards half-day and short-leave fields to self-service request creation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 42, status: "draft" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await createMyLeaveRequest("access-token", {
      leave_type_id: 7,
      duration_type: "SHORT_LEAVE",
      start_date: "2026-10-12",
      end_date: "2026-10-12",
      start_time: "09:15",
      end_time: "11:45",
      reason: "Medical appointment",
      submit: false,
    })

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(options.body))).toMatchObject({
      duration_type: "SHORT_LEAVE",
      start_time: "09:15",
      end_time: "11:45",
      submit: false,
    })
    expect(new Headers(options.headers).get("authorization")).toBe("Bearer access-token")
  })

  it("uploads employee leave evidence using the backend base64 file DTO", async () => {
    class TestFileReader {
      result: string | ArrayBuffer | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL(file: File) {
        this.result = `data:${file.type};base64,dGVzdA==`
        this.onload?.()
      }
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 91 }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("FileReader", TestFileReader)
    const file = { name: "medical-note.pdf", type: "application/pdf", size: 4 } as File

    await uploadMyLeaveRequestDocument("access-token", 42, file)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(options.body))
    expect(url).toContain("/api/me/leave/requests/42/documents")
    expect(body.file).toMatchObject({
      fileName: "medical-note.pdf",
      fileSize: 4,
      mimeType: "application/pdf",
      fileString: "dGVzdA==",
    })
  })
  it("sends deadline extensions and routing retries to their authenticated endpoints", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ id: 42 }), { status: 201, headers: { "Content-Type": "application/json" } })))
    vi.stubGlobal("fetch", fetchMock)
    await extendLeaveEvidenceDeadline("access-token", 42, "2026-11-01T12:00:00Z", "Hospital report pending")
    await retryLeaveRouting("access-token", 42)
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/api/leave/requests/42/evidence-deadline")
    expect(JSON.parse(String(options.body))).toEqual({ evidence_due_at: "2026-11-01T12:00:00Z", reason: "Hospital report pending" })
    expect(fetchMock.mock.calls[1][0]).toContain("/api/leave/requests/42/retry-routing")
    expect(new Headers(options.headers).get("authorization")).toBe("Bearer access-token")
  })

  it("downloads employee evidence using authentication on the self-service endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("evidence", { status: 200, headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="note.pdf"' } }))
    vi.stubGlobal("fetch", fetchMock)
    const result = await downloadMyLeaveRequestDocument("access-token", 42, 9)
    expect(fetchMock.mock.calls[0][0]).toContain("/api/me/leave/requests/42/documents/9/download")
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("authorization")).toBe("Bearer access-token")
    expect(result.filename).toBe("note.pdf")
  })
  it("saves medical details through the employee-owned endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)
    await patchMyLeaveRequestMedicalDetail("access-token", 42, { doctor_name: "Doctor" })
    expect(fetchMock.mock.calls[0][0]).toContain("/api/me/leave/requests/42/medical-detail")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ doctor_name: "Doctor" })
  })

})
