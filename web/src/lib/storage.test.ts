import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({ upload: h.upload, getPublicUrl: h.getPublicUrl }),
    },
  },
}));
vi.mock("@/lib/db/profiles", () => ({ getProfile: h.getProfile }));

import { publicUrl, uploadImage, avatarUrlForEmail } from "./storage";

beforeEach(() => {
  vi.clearAllMocks();
  h.upload.mockResolvedValue({ error: null });
  h.getPublicUrl.mockImplementation((path: string) => ({
    data: { publicUrl: `https://cdn/${path}` },
  }));
});

describe("publicUrl", () => {
  it("returns null for a null path", () => {
    expect(publicUrl("avatars", null)).toBeNull();
  });
  it("builds a URL for a path", () => {
    expect(publicUrl("avatars", "a/b.png")).toBe("https://cdn/a/b.png");
  });
});

describe("uploadImage", () => {
  it("namespaces the path by a sanitized email and keeps the extension", async () => {
    const file = new File(["x"], "MyPhoto.JPG", { type: "image/jpeg" });
    const path = await uploadImage("avatars", "Me.Name+tag@Gmail.com", file);
    expect(path).toBe("me_name_tag_gmail_com/avatar.jpg");
    expect(h.upload).toHaveBeenCalledWith(path, file, expect.objectContaining({ upsert: true }));
  });

  it("defaults the extension to png when the filename has none", async () => {
    const file = new File(["x"], "avatar", { type: "image/png" });
    const path = await uploadImage("avatars", "a@b.com", file);
    expect(path).toBe("a_b_com/avatar.png");
  });

  it("throws if storage returns an error", async () => {
    h.upload.mockResolvedValue({ error: { message: "denied" } });
    await expect(
      uploadImage("avatars", "a@b.com", new File(["x"], "a.png", { type: "image/png" }))
    ).rejects.toEqual({ message: "denied" });
  });
});

describe("avatarUrlForEmail", () => {
  it("returns null without an email", async () => {
    expect(await avatarUrlForEmail(null)).toBeNull();
  });

  it("returns null when the profile has no avatar", async () => {
    h.getProfile.mockResolvedValue({ avatar_path: null });
    expect(await avatarUrlForEmail("a@b.com")).toBeNull();
  });

  it("cache-busts the URL with the profile's updated_at", async () => {
    h.getProfile.mockResolvedValue({
      avatar_path: "a_b_com/avatar.png",
      updated_at: "2026-07-21T00:00:00.000Z",
    });
    const url = await avatarUrlForEmail("a@b.com");
    expect(url).toBe(
      `https://cdn/a_b_com/avatar.png?t=${Date.parse("2026-07-21T00:00:00.000Z")}`
    );
  });
});
