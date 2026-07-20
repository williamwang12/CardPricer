import { describe, it, expect, vi } from "vitest";

// Mock auth module before importing admin
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { isAdmin } from "./admin";

describe("isAdmin", () => {
  it("returns true for admin email", () => {
    expect(isAdmin("admin@example.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isAdmin("ADMIN@EXAMPLE.COM")).toBe(true);
  });

  it("returns true for second admin email", () => {
    expect(isAdmin("boss@example.com")).toBe(true);
  });

  it("returns false for unknown email", () => {
    expect(isAdmin("nobody@example.com")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAdmin(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAdmin(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isAdmin("")).toBe(false);
  });
});
