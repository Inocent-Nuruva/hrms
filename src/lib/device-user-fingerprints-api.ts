import { z } from "zod";
import { adminRequest } from "@/lib/admin-api";

const deviceUserFingerprintsSchema = z.object({
  assignment_id: z.number(),
  device_id: z.number(),
  device_employee_no: z.string(),
  device_user_name: z.string().nullable(),
  hr_employee_id: z.number().nullable(),
  fingerprints: z.array(z.object({
    id: z.number(),
    fingerprint_id: z.string().nullable(),
    card_reader_no: z.number().nullable(),
    status: z.string(),
    source: z.string().nullable(),
    last_synced_at: z.string().nullable(),
  })),
});

export type DeviceUserFingerprints = z.infer<typeof deviceUserFingerprintsSchema>;

export function getDeviceUserFingerprints(token: string, deviceId: string | number, assignmentId: number) {
  return adminRequest(
    `/api/access-control/attendance-devices/${encodeURIComponent(String(deviceId))}/users/${assignmentId}/fingerprints`,
    deviceUserFingerprintsSchema,
    { token },
  );
}
