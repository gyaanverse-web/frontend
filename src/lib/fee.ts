import type { BadgeTone } from "@/components/ui";

/**
 * Types + display helpers for the fee module, mirroring
 * `backend/src/modules/fee/fee.types.ts` and `fee.schema.ts`.
 *
 * All money fields are paise (integers), exactly as the API returns them —
 * `formatPaise` is the only place that divides by 100. Every money *input* is
 * the opposite: the routes take rupees and convert server-side, so forms submit
 * the rupee number as-is. Keep the two directions straight: read paise, write
 * rupees.
 */

export function formatPaise(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  });
}

/** Paise → a rupee number for pre-filling an input (which the API reads as rupees). */
export const paiseToRupees = (paise: number): number => paise / 100;

export type FeeHeadCategory =
  | "tuition" | "admission" | "transport" | "exam" | "material" | "penalty" | "other";
export type FeeHeadStatus = "active" | "archived";
export type FeeStructureStatus = "draft" | "published" | "archived";
export type FeeAssignmentStatus = "active" | "completed" | "withdrawn";
export type FeeConcessionType = "scholarship" | "sibling" | "staff_ward" | "merit" | "need_based" | "other";
export type FeeConcessionMode = "percent" | "amount";
export type GstMode = "none" | "registered";
export type FeeInvoiceStatus = "draft" | "issued" | "partially_paid" | "paid" | "waived" | "cancelled";
export type FeeInvoiceKind = "installment" | "charge";
export type FeePaymentMode = "cash" | "upi" | "bank_transfer" | "cheque" | "dd" | "card" | "other";
export type FeePaymentStatus = "recorded" | "reversed";
export type FeeClearanceStatus = "cleared" | "pending" | "bounced";
export type FeeAdjustmentType = "late_fee" | "bounce_charge" | "opening_balance" | "waiver" | "write_off" | "credit_note";
/** The adjustment types an owner may enter by hand — `bounce_charge` is only ever levied by a bounce. */
export type ManualAdjustmentType = Exclude<FeeAdjustmentType, "bounce_charge">;

export const FEE_HEAD_CATEGORIES: FeeHeadCategory[] =
  ["tuition", "admission", "transport", "exam", "material", "penalty", "other"];
export const FEE_CONCESSION_TYPES: FeeConcessionType[] =
  ["scholarship", "sibling", "staff_ward", "merit", "need_based", "other"];
export const FEE_PAYMENT_MODES: FeePaymentMode[] = ["cash", "upi", "bank_transfer", "cheque", "dd", "card", "other"];
/** Instruments that can bounce — recorded pending clearance, and need their instrument number. */
export const CLEARABLE_MODES: FeePaymentMode[] = ["cheque", "dd"];

export const PAYMENT_MODE_LABEL: Record<FeePaymentMode, string> = {
  cash: "Cash", upi: "UPI", bank_transfer: "Bank transfer", cheque: "Cheque", dd: "Demand draft", card: "Card", other: "Other",
};

export const CONCESSION_TYPE_LABEL: Record<FeeConcessionType, string> = {
  scholarship: "Scholarship", sibling: "Sibling", staff_ward: "Staff ward", merit: "Merit", need_based: "Need based", other: "Other",
};

export const ADJUSTMENT_TYPE_LABEL: Record<FeeAdjustmentType, string> = {
  late_fee: "Late fee",
  bounce_charge: "Bounce charge",
  opening_balance: "Opening balance",
  waiver: "Waiver",
  write_off: "Write-off",
  credit_note: "Credit note",
};

/** Relief types reduce one open invoice; the others raise a new charge. */
export const RELIEF_ADJUSTMENT_TYPES: ManualAdjustmentType[] = ["waiver", "write_off", "credit_note"];

export interface LateFeePolicy {
  enabled: boolean;
  graceDays: number;
  mode: "percent" | "amount";
  /** A percentage when mode='percent', PAISE when mode='amount' (as stored). */
  value: number;
  /** Paise, as stored. */
  capAmount: number | null;
}

export interface ReminderPolicy {
  enabled: boolean;
  offsetsDays: number[];
  channels: ("email" | "sms")[];
}

export interface FeeSettings {
  tenantId: string;
  gstMode: GstMode;
  gstin: string | null;
  placeOfSupplyCode: string | null;
  receiptPrefix: string;
  financialYearStartMonth: number;
  lateFeePolicy: LateFeePolicy;
  reminderPolicy: ReminderPolicy;
  bounceChargeAmount: number;
  updatedAt: string;
}

export interface FeeHead {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  category: FeeHeadCategory;
  isRefundable: boolean;
  taxRatePct: string | null;
  sacCode: string | null;
  status: FeeHeadStatus;
  createdAt: string;
}

export interface FeeStructure {
  id: string;
  tenantId: string;
  name: string;
  academicYear: string;
  version: number;
  supersededById: string | null;
  status: FeeStructureStatus;
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface FeeStructureItem {
  id: string;
  structureId: string;
  headId: string;
  amount: number;
  order: number;
}

export interface FeeStructureInstallment {
  id: string;
  structureId: string;
  seq: number;
  label: string;
  dueDate: string;
  sharePct: string;
}

export interface StudentFeeAssignment {
  id: string;
  tenantId: string;
  studentId: string;
  classId: string;
  structureId: string;
  academicYear: string;
  grossAmount: number;
  concessionAmount: number;
  netAmount: number;
  status: FeeAssignmentStatus;
  effectiveFrom: string;
  withdrawnAt: string | null;
  createdAt: string;
}

export interface FeeConcession {
  id: string;
  assignmentId: string;
  headId: string | null;
  type: FeeConcessionType;
  mode: FeeConcessionMode;
  value: string;
  /** Negative on a reversing row. */
  computedAmount: number;
  reason: string | null;
  approvedBy: string;
  approvedAt: string;
  /** A reversing row (computedAmount < 0). */
  isReversal: boolean;
  /** A grant that a later reversing row has cancelled. */
  reversed: boolean;
}

export interface FeeInvoice {
  id: string;
  tenantId: string;
  kind: FeeInvoiceKind;
  assignmentId: string | null;
  studentId: string;
  installmentSeq: number | null;
  label: string;
  invoiceNo: string | null;
  issueDate: string;
  dueDate: string;
  grossAmount: number;
  concessionAmount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  waivedAmount: number;
  status: FeeInvoiceStatus;
  createdAt: string;
  /** Derived server-side: total − paid − waived, floored at 0. */
  outstanding: number;
  /** Derived server-side — never stored (LLD §4). */
  overdue: boolean;
}

export interface FeePaymentAllocation {
  id: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  createdAt: string;
}

export interface FeePayment {
  id: string;
  tenantId: string;
  studentId: string;
  receiptNo: string;
  financialYear: string;
  amount: number;
  mode: FeePaymentMode;
  reference: string | null;
  instrumentDate: string | null;
  bankName: string | null;
  receivedAt: string;
  clearanceStatus: FeeClearanceStatus;
  clearedAt: string | null;
  bouncedAt: string | null;
  bounceReason: string | null;
  status: FeePaymentStatus;
  reversedAt: string | null;
  reversalReason: string | null;
  recordedBy: string;
  createdAt: string;
}

/** A payment as the student ledger returns it — with its allocation rows. */
export interface LedgerPayment extends FeePayment {
  allocations: FeePaymentAllocation[];
}

/** A payment as the tenant-wide payments list returns it. */
export interface PaymentListItem extends FeePayment {
  studentName: string;
}

export interface FeeAdjustment {
  id: string;
  tenantId: string;
  studentId: string;
  type: FeeAdjustmentType;
  /** Signed paise: charges positive, relief negative. A reversal is the opposite sign. */
  amount: number;
  invoiceId: string | null;
  sourceInvoiceId: string | null;
  paymentId: string | null;
  reversesId: string | null;
  reason: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface FeeGuardian {
  id: string;
  tenantId: string;
  studentId: string;
  name: string;
  relation: string;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface StudentLedger {
  assignments: StudentFeeAssignment[];
  concessions: FeeConcession[];
  invoices: FeeInvoice[];
  payments: LedgerPayment[];
  adjustments: FeeAdjustment[];
  guardians: FeeGuardian[];
  creditBalance: number;
}

export interface FeesSummary {
  totalBilled: number;
  totalPaid: number;
  totalWaived: number;
  balance: number;
  overdueAmount: number;
  creditBalance: number;
  nextDue: { invoiceId: string; label: string; dueDate: string; amount: number } | null;
  invoices: FeeInvoice[];
}

export interface StudentReceiptItem {
  paymentId: string;
  receiptNo: string;
  amount: number;
  mode: FeePaymentMode;
  receivedAt: string;
  clearanceStatus: FeeClearanceStatus;
  stamp: string | null;
}

export interface TaxInvoiceLine {
  description: string;
  sacCode: string | null;
  grossAmount: number;
  concessionAmount: number;
  taxableAmount: number;
  taxRatePct: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
  totalAmount: number;
}

export interface TaxInvoice {
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  label: string;
  supplier: { name: string; gstin: string | null; placeOfSupplyCode: string | null };
  recipient: { name: string; email: string | null; phone: string | null };
  placeOfSupplyCode: string | null;
  supplyType: "intra_state" | "inter_state";
  lines: TaxInvoiceLine[];
  totals: { taxableAmount: number; cgst: number; sgst: number; igst: number; taxAmount: number; totalAmount: number };
  status: FeeInvoiceStatus;
}

export interface DaybookRow {
  id: string;
  receiptNo: string;
  studentId: string;
  studentName: string;
  amount: number;
  mode: FeePaymentMode;
  reference: string | null;
  receivedAt: string;
  clearanceStatus: FeeClearanceStatus;
  status: FeePaymentStatus;
  reversedAt: string | null;
  reversalReason: string | null;
  bouncedAt: string | null;
  bounceReason: string | null;
}

export interface Daybook {
  date: string;
  collections: DaybookRow[];
  totalsByMode: Partial<Record<FeePaymentMode, number>>;
  totalCollected: number;
  pendingClearance: number;
  reversals: DaybookRow[];
  bounces: DaybookRow[];
}

export interface DefaulterRow {
  studentId: string;
  name: string;
  email: string | null;
  phone: string | null;
  invoiceCount: number;
  overdueAmount: number;
  oldestDueDate: string;
  daysOverdue: number;
  guardian: { name: string; relation: string; phone: string | null; email: string | null } | null;
}

export interface DefaultersReport {
  asOf: string;
  totalStudents: number;
  totalOverdue: number;
  items: DefaulterRow[];
  nextCursor: string | null;
}

export interface HeadWiseRow {
  headId: string;
  code: string;
  name: string;
  category: string;
  grossAmount: number;
  concessionAmount: number;
  taxAmount: number;
  billed: number;
  collected: number;
  waived: number;
  outstanding: number;
}

export interface HeadWiseReport {
  academicYear: string;
  heads: HeadWiseRow[];
  totals: { billed: number; collected: number; waived: number; outstanding: number; concessionAmount: number; taxAmount: number };
}

export const STRUCTURE_STATUS_TONE: Record<FeeStructureStatus, BadgeTone> = {
  draft: "warning",
  published: "success",
  archived: "neutral",
};

export const ASSIGNMENT_STATUS_TONE: Record<FeeAssignmentStatus, BadgeTone> = {
  active: "success",
  completed: "neutral",
  withdrawn: "danger",
};

export const INVOICE_STATUS_TONE: Record<FeeInvoiceStatus, BadgeTone> = {
  draft: "neutral",
  issued: "accent",
  partially_paid: "warning",
  paid: "success",
  waived: "neutral",
  cancelled: "danger",
};

export const INVOICE_STATUS_LABEL: Record<FeeInvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  partially_paid: "Partly paid",
  paid: "Paid",
  waived: "Waived",
  cancelled: "Cancelled",
};

/** An invoice money can still be allocated to, or relieved against. */
export const isOpenInvoice = (i: Pick<FeeInvoice, "status">): boolean =>
  i.status === "issued" || i.status === "partially_paid";

/**
 * One badge for a payment's state. Reversal wins over clearance: a reversed
 * cheque is simply reversed, whatever the bank later said.
 */
export function paymentBadge(p: Pick<FeePayment, "status" | "clearanceStatus">): { tone: BadgeTone; label: string } {
  if (p.status === "reversed") return { tone: "neutral", label: "Reversed" };
  if (p.clearanceStatus === "bounced") return { tone: "danger", label: "Bounced" };
  if (p.clearanceStatus === "pending") return { tone: "warning", label: "Pending clearance" };
  return { tone: "success", label: "Recorded" };
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
  });
}

/** Today's calendar date in India as YYYY-MM-DD — the backend's `todayIST()`. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** The academic year containing today, e.g. "2026-27" for an April-start year. */
export function currentAcademicYear(startMonth = 4, today: string = todayIST()): string {
  const [y, m] = today.split("-").map(Number);
  const start = m >= startMonth ? y : y - 1;
  if (startMonth === 1) return String(start);
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** A fresh key for `POST /tenant/fees/payments` (8-64 chars). */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** True once a 404 comes back from a `/tenant/fees/*` or `/fees/*` call — the
 *  platform switch (`fees_enabled`, ops-panel only, off by default) is off,
 *  so the route doesn't exist rather than being forbidden. Screens show a
 *  dedicated empty state for this instead of a generic error banner. */
export function isFeesDisabledError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "status" in err && (err as { status: unknown }).status === 404;
}

export const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;
