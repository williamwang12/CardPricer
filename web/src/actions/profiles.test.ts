import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getUserEmail: vi.fn(),
  requireRealUser: vi.fn(),
  ensureProfile: vi.fn(),
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
  sharesApprovedShow: vi.fn(),
  uploadImage: vi.fn(),
  publicUrl: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/guards", () => ({
  getUserEmail: h.getUserEmail,
  requireRealUser: h.requireRealUser,
}));
vi.mock("@/lib/db/profiles", () => ({
  ensureProfile: h.ensureProfile,
  getProfile: h.getProfile,
  saveProfile: h.saveProfile,
  sharesApprovedShow: h.sharesApprovedShow,
}));
vi.mock("@/lib/storage", () => ({
  uploadImage: h.uploadImage,
  publicUrl: h.publicUrl,
}));

import {
  getMyProfileAction,
  saveProfileAction,
  uploadAvatarAction,
  getPublicProfileAction,
} from "./profiles";

beforeEach(() => {
  vi.clearAllMocks();
  h.requireRealUser.mockResolvedValue("me@gmail.com");
  h.getUserEmail.mockResolvedValue("viewer@gmail.com");
  h.saveProfile.mockImplementation((email, input) => ({ user_email: email, ...input }));
});

describe("getMyProfileAction", () => {
  it("bootstraps via ensureProfile for a real user", async () => {
    h.ensureProfile.mockResolvedValue({ user_email: "me@gmail.com" });
    const p = await getMyProfileAction();
    expect(p.user_email).toBe("me@gmail.com");
    expect(h.ensureProfile).toHaveBeenCalledWith("me@gmail.com");
  });

  it("rejects a guest", async () => {
    h.requireRealUser.mockRejectedValue(new Error("Sign in"));
    await expect(getMyProfileAction()).rejects.toThrow(/Sign in/);
  });
});

describe("saveProfileAction", () => {
  it("never lets the client set avatar_path directly", async () => {
    await saveProfileAction({
      store_name: "My Store",
      // A malicious client trying to point their avatar at someone else's file:
      avatar_path: "someone_else/avatar.png",
    });
    const [, passed] = h.saveProfile.mock.calls[0];
    expect(passed.store_name).toBe("My Store");
    expect(passed).not.toHaveProperty("avatar_path");
  });

  it("requires a real user", async () => {
    h.requireRealUser.mockRejectedValue(new Error("Sign in"));
    await expect(saveProfileAction({ store_name: "x" })).rejects.toThrow(/Sign in/);
    expect(h.saveProfile).not.toHaveBeenCalled();
  });
});

describe("uploadAvatarAction", () => {
  function fd(file: unknown) {
    const form = new FormData();
    if (file !== undefined) form.append("avatar", file as Blob);
    return form;
  }

  it("rejects when no file is provided", async () => {
    await expect(uploadAvatarAction(fd(undefined))).rejects.toThrow(/No image/);
  });

  it("rejects an empty file", async () => {
    await expect(
      uploadAvatarAction(fd(new File([], "a.png", { type: "image/png" })))
    ).rejects.toThrow(/No image/);
  });

  it("rejects a non-image", async () => {
    await expect(
      uploadAvatarAction(fd(new File(["hi"], "a.txt", { type: "text/plain" })))
    ).rejects.toThrow(/must be an image/);
  });

  it("rejects an image over 5 MB", async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "a.png", {
      type: "image/png",
    });
    await expect(uploadAvatarAction(fd(big))).rejects.toThrow(/under 5 MB/);
    expect(h.uploadImage).not.toHaveBeenCalled();
  });

  it("uploads a valid image and returns a cache-busted url", async () => {
    h.uploadImage.mockResolvedValue("me_gmail_com/avatar.png");
    h.saveProfile.mockResolvedValue({
      user_email: "me@gmail.com",
      avatar_path: "me_gmail_com/avatar.png",
    });
    h.publicUrl.mockReturnValue("https://cdn/avatar.png");
    const result = await uploadAvatarAction(
      fd(new File(["img"], "a.png", { type: "image/png" }))
    );
    expect(h.uploadImage).toHaveBeenCalledWith("avatars", "me@gmail.com", expect.any(File));
    expect(result.avatarUrl).toMatch(/^https:\/\/cdn\/avatar\.png\?t=\d+$/);
  });
});

describe("getPublicProfileAction (visibility privacy boundary)", () => {
  const showConnected = {
    user_email: "target@gmail.com",
    profile_visibility: "show_connected",
  };
  const everyone = {
    user_email: "target@gmail.com",
    profile_visibility: "everyone",
  };

  it("returns null for a nonexistent profile", async () => {
    h.getProfile.mockResolvedValue(null);
    expect(await getPublicProfileAction("target@gmail.com")).toBeNull();
  });

  it("always shows a user their own profile, even if show_connected", async () => {
    h.getUserEmail.mockResolvedValue("target@gmail.com");
    h.getProfile.mockResolvedValue(showConnected);
    const p = await getPublicProfileAction("target@gmail.com");
    expect(p).toEqual(showConnected);
    expect(h.sharesApprovedShow).not.toHaveBeenCalled();
  });

  it("shows an 'everyone' profile without a connection check", async () => {
    h.getProfile.mockResolvedValue(everyone);
    expect(await getPublicProfileAction("target@gmail.com")).toEqual(everyone);
    expect(h.sharesApprovedShow).not.toHaveBeenCalled();
  });

  it("shows a 'show_connected' profile only to a shared-show viewer", async () => {
    h.getProfile.mockResolvedValue(showConnected);
    h.sharesApprovedShow.mockResolvedValue(true);
    expect(await getPublicProfileAction("target@gmail.com")).toEqual(showConnected);
  });

  it("hides a 'show_connected' profile from an unconnected viewer", async () => {
    h.getProfile.mockResolvedValue(showConnected);
    h.sharesApprovedShow.mockResolvedValue(false);
    expect(await getPublicProfileAction("target@gmail.com")).toBeNull();
  });
});
