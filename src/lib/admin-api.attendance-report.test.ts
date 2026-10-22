import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadAttendanceReport } from './admin-api'

describe('attendance report download API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('serializes late, early and overtime filters together', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('report', {
        status: 200,
        headers: {
          'content-type': 'text/csv',
          'content-disposition': 'attachment; filename="attendance.csv"',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await downloadAttendanceReport('test-token', {
      from_date: '2026-10-01',
      to_date: '2026-10-31',
      late_only: true,
      early_departure_only: true,
      overtime_only: true,
      format: 'csv',
    })

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    const query = new URL(url).searchParams
    expect(query.get('late_only')).toBe('true')
    expect(query.get('early_departure_only')).toBe('true')
    expect(query.get('overtime_only')).toBe('true')
    expect(query.get('from_date')).toBe('2026-10-01')
    expect(query.get('to_date')).toBe('2026-10-31')
    expect(query.get('format')).toBe('csv')
    expect(new Headers(request.headers).get('authorization')).toBe('Bearer test-token')
  })
})
