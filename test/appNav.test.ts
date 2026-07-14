import { describe, it, expect } from "vitest";
import { buildAppNav, type AppNavKey, type NavEntry } from "@/components/dashboard/appNav";

// Nav entries are either a link (has `key`) or a section header (has `section`).
type LinkEntry = Extract<NavEntry, { key: AppNavKey }>;
const links = (role: string) =>
  buildAppNav(role).filter((e): e is LinkEntry => "key" in e);
const keys = (role: string) => links(role).map((e) => e.key);
const labelFor = (role: string, key: AppNavKey) =>
  links(role).find((e) => e.key === key)?.label;

describe("buildAppNav", () => {
  describe("coaching_owner", () => {
    it('labels the classes link "Classes" (owner sees every teacher\'s batch)', () => {
      expect(labelFor("coaching_owner", "classes")).toBe("Classes");
    });

    it("exposes the owner-only surfaces", () => {
      const k = keys("coaching_owner");
      expect(k).toEqual(
        expect.arrayContaining(["teachers", "invites", "plan", "settings", "danger", "members"]),
      );
    });

    it("includes the Teachers roster link pointing at /teachers", () => {
      const teachers = links("coaching_owner").find((e) => e.key === "teachers");
      expect(teachers).toMatchObject({ label: "Teachers", href: "/teachers" });
    });
  });

  describe("teacher", () => {
    it('labels the classes link "My Classes" (teacher sees only their own)', () => {
      expect(labelFor("teacher", "classes")).toBe("My Classes");
    });

    it("does NOT expose owner-only surfaces (teachers/invites/plan/settings/danger)", () => {
      const k = keys("teacher");
      expect(k).not.toContain("teachers");
      expect(k).not.toContain("invites");
      expect(k).not.toContain("plan");
      expect(k).not.toContain("settings");
      expect(k).not.toContain("danger");
    });

    it("still gets the shared staff surfaces", () => {
      const k = keys("teacher");
      expect(k).toEqual(expect.arrayContaining(["dashboard", "classes", "exams", "question-bank", "members"]));
    });
  });

  describe("student", () => {
    it("only sees classes and exams", () => {
      expect(keys("student")).toEqual(["classes", "exams"]);
    });

    it('keeps the classes label as "My Classes"', () => {
      expect(labelFor("student", "classes")).toBe("My Classes");
    });
  });

  it("treats an unknown role like a student (least privilege)", () => {
    expect(keys("super_admin")).toEqual(["classes", "exams"]);
  });
});
