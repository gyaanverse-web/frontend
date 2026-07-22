export type PlanName = "free" | "starter" | "growth" | "pro";

export const PLAN_ORDER: PlanName[] = ["free", "starter", "growth", "pro"];

export const PLANS: Record<PlanName, {
  label: string;
  price: number;
  limits: { students: number; teachers: number; classes: number; mocks_per_month: number; ai_evaluations: number };
  features: { analytics: boolean; public_mocks: boolean; custom_branding: boolean; api_access: boolean };
}> = {
  free:    { label: "Free",    price: 0,    limits: { students: 30,    teachers: 5,     classes: 5,     mocks_per_month: 3,     ai_evaluations: 10    }, features: { analytics: false, public_mocks: false, custom_branding: false, api_access: false } },
  starter: { label: "Starter", price: 999,  limits: { students: 100,   teachers: 10,    classes: 20,    mocks_per_month: 15,    ai_evaluations: 100   }, features: { analytics: false, public_mocks: true,  custom_branding: false, api_access: false } },
  growth:  { label: "Growth",  price: 2499, limits: { students: 500,   teachers: 20,    classes: 50,    mocks_per_month: 50,    ai_evaluations: 500   }, features: { analytics: true,  public_mocks: true,  custom_branding: false, api_access: false } },
  pro:     { label: "Pro",     price: 5999, limits: { students: 99999, teachers: 99999, classes: 99999, mocks_per_month: 99999, ai_evaluations: 99999 }, features: { analytics: true,  public_mocks: true,  custom_branding: true,  api_access: true  } },
};

export function fmtLimit(n: number) { return n >= 99999 ? "Unlimited" : String(n); }

export type Role = "super_admin" | "coaching_owner" | "teacher" | "student";

export type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: Role;
  tenantId: string | null;
  isProfileComplete: boolean;
};

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  ownerId: string;
  plan: string;
  status: string;
  createdAt: string;
};

export type Member = {
  userId: string;
  name: string;
  role: string;
  joinedAt: string;
  email: string | null;
  phone: string | null;
};

export type Invite = {
  id: string;
  contact: string;
  contactType: "email" | "phone";
  role: string;
  status: "pending" | "accepted" | "revoked";
  expiresAt: string;
  createdAt: string;
};

export type CoachingJoinCode = {
  id: string;
  code: string;
  expiresAt: string | null;
  maxUses: number;
  usedCount: number;
  revoked: boolean;
  createdAt: string;
};

export type Class = {
  id: string;
  tenantId: string;
  teacherId: string;
  name: string;
  grade: string | null;
  description: string | null;
  autoApprove: boolean;
  createdAt: string;
  updatedAt: string;
  // Present on staff-facing listings (owner / teacher); absent for students.
  studentCount?: number;
  pendingCount?: number;
  // Present only on the owner's all-classes listing — who owns each batch.
  teacherName?: string | null;
};

// Lifecycle status re-exported from the single source of truth in lib/examStatus.
import type { ExamStatus } from "@/lib/examStatus";
export type { ExamStatus } from "@/lib/examStatus";

export type Exam = {
  id: string;
  title: string;
  status: ExamStatus;
  visibility: "private" | "public_free" | "public_paid";
  durationMins: number;
  totalMarks: number;
  maxAttempts: number;
  qualityScore: number | null;
  gradeLevel: string | null;
  scheduledAt: string | null;
  endsAt: string | null;
  // Approval-lifecycle audit (nullable until the relevant transition happens).
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewRemarks: string | null;
  resultsPublishedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};