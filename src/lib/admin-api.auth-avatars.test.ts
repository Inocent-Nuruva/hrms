import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractBackupCodes,
  listMyAvailableAvatars,
  listMyAvailableAvatarsLegacy,
  listMyProfileAvatarOptions,
  listSelectableAvatarsForMe,
  readForceTwoFactor,
  regenerateMyTwoFactorBackupCodes,
  resetUserPassword,
  selectMyUserAvatar,
  setUserForceTwoFactor,
  withNormalizedTwoFactorFields,
} from "./admin-api";

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("documented auth and avatar leftovers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("regenerates 2FA backup codes with the current TOTP token", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      jsonResponse({
        backup_codes: ["ABC1-DEF2-GHI3", "JKL4-MNO5-PQR6"],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const codes = await regenerateMyTwoFactorBackupCodes("token", "123456");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/users/2fa/backup-codes/regenerate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "123456" }),
      }),
    );
    expect(codes).toEqual(["ABC1-DEF2-GHI3", "JKL4-MNO5-PQR6"]);
  });

  it("sets force-2FA on a user", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        jsonResponse({
          success: true,
          data: { userId: 12, forceTwoFactor: true },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await setUserForceTwoFactor("token", 12, true);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/users/12/two-factor/force",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ force: true }),
      }),
    );
  });

  it("resets a user password through the dedicated admin endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await resetUserPassword("token", 12, "N3wP@ssw0rd#2026");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/users/12/reset-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ new_password: "N3wP@ssw0rd#2026" }),
      }),
    );
  });

  it("lists self-service avatar catalogs and selects one", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/me/profile/avatar-options")) {
        return jsonResponse({
          data: [
            {
              id: 3,
              avatar_name: "Neutral A",
              status: "active",
              image_url: "https://cdn.example/a.png",
            },
          ],
        });
      }
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    await listMyProfileAvatarOptions("token");
    await listMyAvailableAvatars("token");
    await listMyAvailableAvatarsLegacy("token");
    await selectMyUserAvatar("token", 3);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/me/profile/avatar-options",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/users/me/available-avatars",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/users/me/avatars",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/users/me/avatar",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ avatar_id: 3 }),
      }),
    );
  });

  it("prefers employee avatar-options when building the self-service gallery", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/me/profile/avatar-options")) {
        return jsonResponse({
          data: [
            {
              id: 8,
              name: "Staff",
              status: "active",
              image_url: "https://cdn.example/staff.png",
            },
          ],
        });
      }
      return jsonResponse({
        data: [
          {
            id: 99,
            status: "active",
            image_url: "https://cdn.example/other.png",
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listSelectableAvatarsForMe("token");

    expect(rows).toEqual([expect.objectContaining({ id: 8, name: "Staff" })]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes force_two_factor onto user rows", () => {
    expect(readForceTwoFactor({ force_two_factor: true })).toBe(true);
    expect(readForceTwoFactor({ user: { forceTwoFactor: false } })).toBe(false);
    expect(
      withNormalizedTwoFactorFields({ id: 1, force_two_factor: true }),
    ).toEqual(
      expect.objectContaining({
        force_two_factor: true,
        forceTwoFactor: true,
      }),
    );
  });

  it("extracts backup codes from nested or comma-separated payloads", () => {
    expect(
      extractBackupCodes({ data: { backupCodes: ["AAAA", "BBBB"] } }),
    ).toEqual(["AAAA", "BBBB"]);
    expect(extractBackupCodes({ backup_codes: "ONE, TWO\nTHREE" })).toEqual([
      "ONE",
      "TWO",
      "THREE",
    ]);
  });
});
