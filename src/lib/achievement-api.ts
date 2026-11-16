import { adminRequest } from "@/lib/admin-api";
import type { KpiAssignment } from "@/lib/kpi-api";

export type AchievementEvidence = {
  id: number;
  revisionId: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
};
export type AchievementActivityEvidence = Omit<AchievementEvidence, "revisionId"> & {
  activityId: number;
};
export type AchievementActivity = {
  id: number;
  companyId: number;
  assignmentId: number;
  revisionId: number;
  employeeId: number;
  periodId: number;
  activityDate: string;
  title: string;
  details: string;
  measurableResult: unknown | null;
  comments: string | null;
  rowVersion: number;
  status: string;
  evidence: AchievementActivityEvidence[];
};
export type AchievementRevision = {
  id: number;
  revision: number;
  status: string;
  effectiveStatus: string;
  actual: unknown | null;
  comments: string | null;
  rowVersion: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  evidenceRequired: boolean;
  evidence: AchievementEvidence[];
  activities?: AchievementActivity[];
};
export type AchievementEvent = {
  id: number;
  action: string;
  actorId: number;
  revisionId: number;
  createdAt: string;
  details: Record<string, unknown>;
};
export type Achievement = {
  id: number;
  assignmentId: number;
  approvedRevisionId: number | null;
  assignment: KpiAssignment;
  current: AchievementRevision;
  revisions: AchievementRevision[];
  history: AchievementEvent[];
};
const root = "/api/hr/kpi";

export const achievementApi = {
  mine: (token: string) =>
    adminRequest<Achievement[]>(`${root}/me/achievements`, {
      token,
      dedupe: false,
    }),
  pending: (token: string, status = "") =>
    adminRequest<Achievement[]>(
      `${root}/achievements/pending${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      { token, dedupe: false },
    ),
  get: (token: string, id: number) =>
    adminRequest<Achievement>(`${root}/achievements/${id}`, {
      token,
      dedupe: false,
    }),
  create: (
    token: string,
    assignmentId: number,
    actual?: unknown,
    comments?: string,
  ) =>
    adminRequest<Achievement>(`${root}/achievements`, {
      token,
      method: "POST",
      body: { assignmentId, actual, comments },
    }),
  update: (
    token: string,
    id: number,
    rowVersion: number,
    actual: unknown,
    comments: string,
  ) =>
    adminRequest<Achievement>(`${root}/achievements/${id}/draft`, {
      token,
      method: "PATCH",
      body: { rowVersion, actual, comments },
    }),
  submit: (token: string, id: number, rowVersion: number) =>
    adminRequest<Achievement>(`${root}/achievements/${id}/submit`, {
      token,
      method: "POST",
      body: { rowVersion },
    }),
  review: (token: string, id: number, rowVersion: number) =>
    adminRequest<Achievement>(`${root}/achievements/${id}/review`, {
      token,
      method: "POST",
      body: { rowVersion },
    }),
  decide: (
    token: string,
    id: number,
    decision: "approve" | "return" | "reject",
    rowVersion: number,
    comments: string,
  ) =>
    adminRequest<Achievement>(`${root}/achievements/${id}/${decision}`, {
      token,
      method: "POST",
      body: { rowVersion, comments },
    }),
  correction: (token: string, id: number) =>
    adminRequest<Achievement>(`${root}/achievements/${id}/correction`, {
      token,
      method: "POST",
    }),
  addActivity: (
    token: string,
    id: number,
    activity: Pick<AchievementActivity, "activityDate" | "title" | "details" | "measurableResult" | "comments">,
  ) => adminRequest<Achievement>(`${root}/achievements/${id}/activities`, {
    token,
    method: "POST",
    body: activity,
  }),
  updateActivity: (
    token: string,
    id: number,
    activityId: number,
    activity: Pick<AchievementActivity, "activityDate" | "title" | "details" | "measurableResult" | "comments" | "rowVersion">,
  ) => adminRequest<Achievement>(`${root}/achievements/${id}/activities/${activityId}`, {
    token,
    method: "PATCH",
    body: activity,
  }),
  removeActivity: (token: string, id: number, activityId: number, rowVersion: number) =>
    adminRequest<Achievement>(`${root}/achievements/${id}/activities/${activityId}`, {
      token,
      method: "DELETE",
      body: { rowVersion },
    }),
  uploadActivityEvidence: (
    token: string,
    id: number,
    activityId: number,
    rowVersion: number,
    file: { fileName: string; fileSize: number; mimeType: string; fileString: string },
  ) => adminRequest<Achievement>(`${root}/achievements/${id}/activities/${activityId}/evidence`, {
    token,
    method: "POST",
    body: { rowVersion, file },
  }),
  upload: (
    token: string,
    id: number,
    rowVersion: number,
    file: {
      fileName: string;
      fileSize: number;
      mimeType: string;
      fileString: string;
    },
  ) =>
    adminRequest<Achievement>(`${root}/achievements/${id}/evidence`, {
      token,
      method: "POST",
      body: { rowVersion, file },
    }),
  evidenceRule: (
    token: string,
    definitionVersionId: number,
    required: boolean,
  ) =>
    adminRequest(
      `${root}/definition-versions/${definitionVersionId}/evidence-rule`,
      { token, method: "PUT", body: { required } },
    ),
  async download(
    token: string,
    achievementId: number,
    evidence: AchievementEvidence,
  ) {
    const response = await fetch(
      `${root}/achievements/${achievementId}/evidence/${evidence.id}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(`Unable to download evidence (${response.status})`);
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = evidence.fileName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  async downloadActivityEvidence(
    token: string,
    achievementId: number,
    activity: AchievementActivity,
    evidence: AchievementActivityEvidence,
  ) {
    const response = await fetch(
      `${root}/achievements/${achievementId}/activities/${activity.id}/evidence/${evidence.id}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(`Unable to download activity evidence (${response.status})`);
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = evidence.fileName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};
