/**
 * What the signed-in coaching is allowed to do, as answered by the server.
 *
 * Mirrors `Entitlements` in `backend/src/modules/billing/billing.service.ts` and
 * arrives on `GET /tenants/me`, so it is already in the shared session cache —
 * `useTenantSession().entitlements`.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * The dashboard used to import the plan matrix itself (`PLANS` in
 * `app/coaching/dashboard/types.ts`) and recompute limits in the browser. That
 * is a second copy of pricing that drifts from `config/plans.ts` the first time
 * a number changes on one side only — and, worse, it cannot represent a coaching
 * whose entitlements are not purely a function of its plan name. Per-tenant
 * grants are coming; a client-side lookup table has nowhere to put them.
 *
 * So: the server resolves, the client renders. Read limits from here, never from
 * a local table.
 *
 * ── The rule for using it ────────────────────────────────────────────────────
 *
 * These values decide what to SHOW. They never decide what is allowed — the API
 * re-checks every one of them, because anything gated only in the browser is not
 * gated. A screen hidden here and unguarded there is a bug, not a feature flag.
 */
export interface Entitlements {
  /**
   * Is the billing product live at all?
   *
   * `false` is the MVP posture: no limits enforced, no features gated, billing
   * routes return 404, and all plan/billing UI is hidden. Gate billing chrome on
   * this rather than on the plan name — during MVP every coaching resolves to an
   * unmetered plan, so "is this the free tier?" is not the question to ask.
   */
  billingEnabled: boolean;
  plan: { name: string; label: string; price_inr: number };
  features: {
    analytics: boolean;
    public_mocks: boolean;
    custom_branding: boolean;
    api_access: boolean;
  };
  /** `99999` means unmetered — render it through `fmtLimit`, never raw. */
  limits: {
    students: number;
    mocks_per_month: number;
    ai_evaluations: number;
    teachers: number;
    classes: number;
  };
}

/**
 * What to assume before the server has answered, or for a user with no coaching.
 *
 * Billing OFF and everything permitted, deliberately. The alternative — assume
 * billing is on and the plan is `free` — would flash upgrade prompts and locked
 * controls for a frame on every page load of a product that has no billing, and
 * would show a coaching on a paid plan a downgraded dashboard while it loads.
 *
 * Permissive is also the safe direction here precisely because none of this
 * authorises anything: the worst case is a control that renders and then 403s,
 * against a best case of no phantom paywall anyone has to explain.
 */
export const NO_BILLING: Entitlements = {
  billingEnabled: false,
  plan: { name: "free", label: "Unlimited", price_inr: 0 },
  features: {
    analytics: true,
    public_mocks: true,
    custom_branding: true,
    api_access: true,
  },
  limits: {
    students: 99999,
    mocks_per_month: 99999,
    ai_evaluations: 99999,
    teachers: 99999,
    classes: 99999,
  },
};

/** `99999` is the unmetered sentinel on both sides of the wire. */
export function fmtLimit(n: number): string {
  return n >= 99999 ? "Unlimited" : String(n);
}
