import { describe, it, expect } from "vitest";
import {
  buildAppNav, buildSettingsTabs, resolveDisplayRole, belongsToStudentArea,
  ACCOUNT_ENTRY, type AppNavKey, type NavEntry,
} from "@/components/dashboard/appNav";
import { NO_BILLING, type Entitlements } from "@/lib/entitlements";

// Nav entries are either a link (has `key`) or a section header (has `section`).
type LinkEntry = Extract<NavEntry, { key: AppNavKey }>;

/** Billing live. Everything else matches the default, so a test that flips this
 *  is isolating the billing switch and nothing else. */
const BILLING_ON: Entitlements = { ...NO_BILLING, billingEnabled: true };

const links = (role: string) =>
  buildAppNav(role).filter((e): e is LinkEntry => "key" in e);
const keys = (role: string) => links(role).map((e) => e.key);
const labelFor = (role: string, key: AppNavKey) =>
  links(role).find((e) => e.key === key)?.label;

const ROLES = ["coaching_owner", "teacher", "student"] as const;

describe("buildAppNav", () => {
  describe("coaching_owner", () => {
    it('labels the classes link "Classes" (owner sees every teacher\'s batch)', () => {
      expect(labelFor("coaching_owner", "classes")).toBe("Classes");
    });

    it("exposes the owner-only surfaces", () => {
      const k = keys("coaching_owner");
      expect(k).toEqual(
        expect.arrayContaining(["teachers", "invites", "settings", "members"]),
      );
    });

    // Billing and the danger zone are TABS on Settings now, not nav rows. The
    // rules that used to live here are pinned in `buildSettingsTabs` below —
    // this pair only guards against them creeping back into the sidebar.
    it("has no Plan & Billing row in the sidebar at all", () => {
      expect(keys("coaching_owner")).not.toContain("plan");
    });

    it("has no Danger Zone row in the sidebar", () => {
      // "Delete this institute" must not sit one mis-click from "Settings" in a
      // menu that is on screen all day.
      expect(keys("coaching_owner")).not.toContain("danger");
    });

    it("includes the Teachers roster link pointing at /teachers", () => {
      const teachers = links("coaching_owner").find((e) => e.key === "teachers");
      expect(teachers).toMatchObject({ label: "Teachers", href: "/coaching/teachers" });
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

  // "Settings" (the owner's institute) and "Account" (the person) are different
  // subjects. Conflating them left teachers with no route to their own profile,
  // verification state or notification preferences at all — the real preferences
  // screen was reachable only from inside the notification bell.
  describe("account entry", () => {
    // Account is pinned in the sidebar FOOTER, below the spacer, so it is not
    // part of the nav list any role builds. Every role gets the same one.
    it("is a single shared entry pointing at /account", () => {
      expect(ACCOUNT_ENTRY).toMatchObject({ key: "account", label: "Account", href: "/account" });
    });

    it("never appears in a role's nav list — it belongs to the footer", () => {
      for (const role of ROLES) {
        expect(keys(role), `${role} still lists account in the nav`).not.toContain("account");
      }
    });

    it("keeps the owner's institute Settings distinct from the account entry", () => {
      expect(keys("coaching_owner")).toContain("settings");
      expect(ACCOUNT_ENTRY.href).not.toContain("screen=Settings");
    });

    // Two identical gears one section apart is how the two meanings got confused.
    it("does not reuse one icon for two different rows, footer included", () => {
      for (const role of ROLES) {
        const icons = [...links(role).map((e) => e.icon), ACCOUNT_ENTRY.icon];
        expect(new Set(icons).size, `${role} has duplicate nav icons`).toBe(icons.length);
      }
    });
  });

  describe("student", () => {
    it("gets the student area and none of the staff surfaces", () => {
      // No "account" here: it is pinned in the sidebar footer for every role,
      // outside the nav list. See ACCOUNT_ENTRY.
      expect(keys("student")).toEqual([
        "home", "exams", "results", "classes", "marketplace",
      ]);
    });

    it('keeps the classes label as "My Classes"', () => {
      expect(labelFor("student", "classes")).toBe("My Classes");
    });

    // The student area is real routes under /student, not ?screen= on the staff
    // dashboard. /coaching/dashboard redirects students away, so a stray
    // `dash(...)` href here would bounce them out of the screen they clicked.
    it("points every student link at a real /student route", () => {
      const hrefs = Object.fromEntries(links("student").map((e) => [e.key, e.href]));
      expect(hrefs).toMatchObject({
        home: "/student",
        exams: "/student/exams",
        results: "/student/results",
        classes: "/student/classes",
        marketplace: "/student/marketplace",
      });
    });

    it("never sends a student into the coaching area", () => {
      for (const { href } of links("student")) {
        expect(href).not.toMatch(/^\/coaching/);
      }
    });
  });

  it("treats an unknown role like a student (least privilege)", () => {
    expect(keys("super_admin")).toEqual(keys("student"));
  });
});

// The billing gate did not disappear when "Plan & Billing" stopped being a nav
// row — it moved down a level, to the tabs on the Settings screen. These pin the
// same two conditions the sidebar used to encode.
describe("buildSettingsTabs", () => {
  it("gives the owner General and Danger Zone while billing is off", () => {
    expect(buildSettingsTabs("coaching_owner", NO_BILLING)).toEqual(["general", "danger"]);
  });

  it("adds Billing once the platform switch is on", () => {
    expect(buildSettingsTabs("coaching_owner", BILLING_ON)).toEqual(["general", "billing", "danger"]);
  });

  it("defaults to the billing-off answer when entitlements are not passed", () => {
    // Callable before the session resolves; the default must not flash a billing
    // tab that then vanishes.
    expect(buildSettingsTabs("coaching_owner")).not.toContain("billing");
  });

  it("gives non-owners no tabs at all — the screen is owner-only", () => {
    expect(buildSettingsTabs("teacher", BILLING_ON)).toEqual([]);
    expect(buildSettingsTabs("student", BILLING_ON)).toEqual([]);
  });

  it("always leads with General, so an unknown ?tab= falls back to something real", () => {
    expect(buildSettingsTabs("coaching_owner", BILLING_ON)[0]).toBe("general");
    expect(buildSettingsTabs("coaching_owner", NO_BILLING)[0]).toBe("general");
  });

  // Danger Zone left the sidebar but must stay reachable, or an owner has no way
  // to delete their coaching at all.
  it("still offers Danger Zone to the owner in both billing states", () => {
    expect(buildSettingsTabs("coaching_owner", NO_BILLING)).toContain("danger");
    expect(buildSettingsTabs("coaching_owner", BILLING_ON)).toContain("danger");
  });
});

// The nav itself was always right; what broke was deciding WHICH role to build
// it for. Every student screen omitted the role and the shell defaulted to
// "teacher", so students were shown Question Bank, Test Engine, Members and the
// rest of the staff menu. These pin the resolution rule that replaced it.
describe("resolveDisplayRole", () => {
  it("uses the membership role whenever there is one", () => {
    expect(resolveDisplayRole("student", false, "coaching_owner")).toBe("student");
    expect(resolveDisplayRole("teacher", false, "coaching_owner")).toBe("teacher");
  });

  it("CRITICAL: returns null while the session is still loading", () => {
    // A non-null guess here renders another role's menu for a frame — and, on
    // the screens that never passed a role at all, permanently.
    expect(resolveDisplayRole(null, false, null)).toBeNull();
  });

  it("does not let a stale account role outrank the membership role", () => {
    // Owning coaching A while being a student in coaching B must not put the
    // owner menu in front of them inside B.
    expect(resolveDisplayRole("student", false, "coaching_owner")).not.toBe("coaching_owner");
  });

  it("falls back to the account role only when there is no coaching at all", () => {
    // A student browsing public mocks before joining anything has no membership
    // role, so without this fallback their sidebar would never resolve.
    expect(resolveDisplayRole(null, true, "student")).toBe("student");
    expect(resolveDisplayRole(null, true, "coaching_owner")).toBe("coaching_owner");
  });

  it("prefers the signup intent over the placeholder 'student' account role", () => {
    // An owner who has not created their coaching yet still carries the default
    // 'student' account role — the role is only promoted BY creating one.
    expect(resolveDisplayRole(null, true, "student", "coaching_owner")).toBe("coaching_owner");
    expect(resolveDisplayRole(null, true, "student", "student")).toBe("student");
  });

  it("never lets the signup intent outrank a real role", () => {
    // Intent is a wish; role and membership are facts.
    expect(resolveDisplayRole("student", false, "student", "coaching_owner")).toBe("student");
    expect(resolveDisplayRole(null, true, "super_admin", "coaching_owner")).toBe("super_admin");
  });

  it("a resolved student never yields a nav containing staff surfaces", () => {
    const role = resolveDisplayRole("student", false, "coaching_owner");
    const k = keys(role!);
    for (const staffOnly of ["question-bank", "test-engine", "members", "plan", "approvals"]) {
      expect(k).not.toContain(staffOnly);
    }
  });
});

// Both /dashboard and useStudentSession redirect on this one function. They
// point at each other, so a disagreement between them is not a cosmetic bug —
// it is an infinite bounce between the two shells.
describe("belongsToStudentArea", () => {
  it("uses the membership role whenever there is one", () => {
    expect(belongsToStudentArea("student", "coaching_owner", "coaching_owner")).toBe(true);
    expect(belongsToStudentArea("teacher", "student", "student")).toBe(false);
    expect(belongsToStudentArea("coaching_owner", "student", "student")).toBe(false);
  });

  it("CRITICAL: a coaching owner who has not created their coaching is not a student", () => {
    // The regression this whole field exists for. Such a user has no
    // membership and the default 'student' account role, so every other signal
    // says "student" — and they get filed into /student, where nothing offers
    // to create a coaching. The verified-email owner mid-signup IS this case.
    expect(belongsToStudentArea(null, "student", "coaching_owner")).toBe(false);
  });

  it("keeps a real student in the student area with no coaching", () => {
    // Browsing public mocks before joining anything is a supported state.
    expect(belongsToStudentArea(null, "student", "student")).toBe(true);
  });

  it("keeps the super_admin out of the student area", () => {
    // No membership and no owner intent, but they are emphatically not a student.
    expect(belongsToStudentArea(null, "super_admin", "student")).toBe(false);
  });

  it("treats a missing intent as a student (least privilege)", () => {
    // Pre-existing accounts and any session that didn't carry the field.
    expect(belongsToStudentArea(null, "student", null)).toBe(true);
    expect(belongsToStudentArea(null, null, null)).toBe(true);
  });

  it("still routes an owner whose coaching was deleted to the staff side", () => {
    // Deleting a coaching resets `role` to 'student' and drops the membership;
    // the intent is what stops that from silently demoting them into /student.
    expect(belongsToStudentArea(null, "student", "coaching_owner")).toBe(false);
  });

  it("agrees with resolveDisplayRole about who gets the student nav", () => {
    // The redirect and the sidebar must not disagree: anyone sent to /student
    // has to be handed the student nav, and vice versa. Otherwise you land on a
    // screen whose menu is for somebody else.
    //
    // `super_admin` is excluded on purpose, and is the one case where the two
    // legitimately differ: it is NOT sent to the student area, but buildAppNav
    // still gives it the student nav because it has no staff membership to
    // authorise anything with (the least-privilege rule pinned above). There is
    // no super-admin portal yet, so this is unreachable in practice.
    const cases: Array<[string | null, string | null, string | null]> = [
      [null, "student", "coaching_owner"],
      [null, "student", "student"],
      [null, null, null],
      ["student", "coaching_owner", "coaching_owner"],
      ["teacher", "student", "student"],
      ["coaching_owner", "student", "student"],
    ];
    for (const [role, accountRole, intent] of cases) {
      const inStudentArea = belongsToStudentArea(role, accountRole, intent);
      const display = resolveDisplayRole(role, role === null, accountRole, intent);
      // buildAppNav treats every non-staff role as a student (least privilege),
      // so compare on the nav it actually produces rather than the role string.
      const navIsStudent = keys(display ?? "student").includes("home");
      expect(navIsStudent).toBe(inStudentArea);
    }
  });
});
