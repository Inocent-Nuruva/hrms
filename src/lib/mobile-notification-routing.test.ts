import { describe, expect, it } from 'vitest'
import {
  resolveNotificationResponseDestination,
  serializeNotificationDestination,
  resolveNotificationDestination,
} from '../../android/src/lib/mobile-notification-routing'

describe('mobile notification response routing', () => {
  it('opens the allowlisted destination carried by a local notification', () => {
    const serialized = serializeNotificationDestination(
      resolveNotificationDestination({ category: 'leave', action_url: '/dashboard/me/leave/requests?request_id=52' }),
    )

    expect(resolveNotificationResponseDestination({ notificationId: 52, ...serialized })).toEqual({
      pathname: '/(tabs)/leave',
      params: { tab: 'requests', requestId: '52' },
    })
  })

  it('resolves a remote notification ID against loaded notification records', () => {
    expect(resolveNotificationResponseDestination(
      { notificationId: 'n-7' },
      [{ id: 'n-7', category: 'daily activity report submitted' }],
    )).toEqual({ pathname: '/activities', params: { view: 'reports' } })
  })

  it('resolves notification content in the remote payload and ignores unknown payloads', () => {
    expect(resolveNotificationResponseDestination({ notification: { title: 'Attendance correction', date: '2026-10-20' } }))
      .toEqual({ pathname: '/my-attendance', params: { date: '2026-10-20' } })
    expect(resolveNotificationResponseDestination({ notificationId: 'not-loaded-yet' })).toBeNull()
  })

  it('falls back to home for a serialized route outside the mobile allowlist', () => {
    expect(resolveNotificationResponseDestination({ destinationPathname: '/api/admin/users' }))
      .toEqual({ pathname: '/(tabs)/home', params: undefined })
  })
})
