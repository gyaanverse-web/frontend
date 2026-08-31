"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useTenantSession } from "@/lib/useTenantSession";
import { useUrlState } from "@/lib/useUrlState";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Button, Badge, DataTable, Tabs, Icon, Modal, DetailRows } from "@/components/ui";
import type { Column, BadgeTone } from "@/components/ui";
import { StatusBadge, StatusTimeline, ExamReportsPanel } from "@/components/exam";
import { MathText } from "@/components/Math";
import type { ExamStatusHistoryRow } from "@/components/exam";
import {
  type ExamStatus,
  isExamEditable, canSubmitForReview, canPublishResults, canPublishResultsAsOwner, canArchive,
  hasReports,
} from "@/lib/examStatus";
import { QUESTION_TYPE_LABELS, type QuestionType } from "@/lib/questionTypes";
import {
  buildPaperStructure, partRange, partMarksEach, partNegativeEach, fmtMarks,
} from "@/lib/paperStructure";

/** Part numbering on the paper-structure table — at most 8 question types. */
const PART_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/**
 * Every tab this page can show, as the `?tab=` slug. Which of them are actually
 * offered depends on the exam and the viewer (see `tabs` in the render), so this
 * is the accepted set for the URL, not the visible set — a slug that survives a
 * status change into a tab that no longer exists falls back to Overview.
 *
 * Labels are single words, so slug ↔ label is just case.
 */
const TAB_SLUGS: readonly string[] = [
  "overview", "questions", "access", "coverage", "sessions", "reports", "timeline",
];
const labelForSlug = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1);

// ── Types ─────────────────────────────────────────────────────────────────────

type Tenant = {
  id: string;
  slug: string;
  name: string;
};

type Exam = {
  id: string;
  tenantId: string;
  createdBy: string;
  title: string;
  description: string | null;
  instructions: string | null;
  durationMins: number;
  gradeLevel: string | null;
  subjectId: string | null;
  scopeType: string;
  visibility: "private" | "public_free" | "public_paid";
  price: string | null;
  maxAttempts: number;
  status: ExamStatus;
  totalMarks: number;
  qualityScore: number | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  endsAt: string | null;
  // Approval-lifecycle audit (nullable until the relevant transition happens).
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewRemarks: string | null;
  resultsPublishedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  questions: Question[];
  // Approval/lifecycle timeline (returned by GET /tenant/exams/:id).
  statusHistory?: ExamStatusHistoryRow[];
};

type Question = {
  id: string;
  examId: string;
  order: number;
  type: QuestionType;
  difficulty: string | null;
  body: string;
  imageUrls: string[] | null;
  payload: Record<string, unknown>;
  answerKey: Record<string, unknown>;
  marks: number;
  negativeMarks: number;
  explanation: string | null;
  createdAt: string;
};

type ExamClass = {
  id: string;
  examId: string;
  classId: string;
};

type ClassItem = {
  id: string;
  name: string;
  grade: string | null;
};

type Subject = {
  id: string;
  name: string;
  gradeLevel: string | null;
};

type Chapter = {
  id: string;
  subjectId: string;
  name: string;
  order: number | null;
};

type ExamSession = {
  id: string;
  studentId: string;
  studentName?: string;
  attemptNumber: number;
  status: string;
  autoScore: number | null;
  totalMarks: number;
  createdAt: string;
};

// `GET /tenant/exams/:id/evaluation-progress`. `pending` is exactly what the
// lifecycle worker blocks on, so it is the number holding the exam back.
//
// There is no failure information here and there is not meant to be. Evaluation
// retries itself indefinitely, and the single case it cannot finish is settled
// by a Gyaanverse operator — so nothing a teacher could see would be anything a
// teacher could act on.
type EvalProgress = {
  examId: string;
  status: string;
  sessions: {
    total: number;
    inProgress: number;
    awaitingEvaluation: number;
    evaluated: number;
    abandoned: number;
  };
  pending: number;
  // Answers the AI pipeline handed to Gyaanverse for a manual read. The teacher
  // can do nothing about these and is never asked to — the only thing this
  // number does on screen is explain a held publish button. Never render it as
  // an error, and never surface which student or question it belongs to.
  underReview: number;
};

// ── DS-mapped inline styles (theme tokens) ──────────────────────────────────────

const inp: CSSProperties = {
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  padding: "9px 12px",
  background: "var(--surface-card)",
  color: "var(--text-heading)",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  outline: "none",
};

const btnS: CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  background: "var(--surface-card)", color: "var(--text-heading)", border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-pill)", padding: "8px 16px", fontFamily: "var(--font-body)",
  fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
};

const cell: CSSProperties = {
  padding: "11px 16px", borderBottom: "1px solid var(--border-default)",
  fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-heading)", verticalAlign: "middle",
};

const cardStyle: CSSProperties = {
  background: "var(--surface-card)", border: "1px solid var(--border-light)",
  borderRadius: 14, overflow: "hidden", marginBottom: 20,
};

const fieldLabel: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-muted)" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultPayload(type: QuestionType): Record<string, unknown> {
  switch (type) {
    case "mcq_single":
    case "mcq_multiple":
      return { options: [{ id: "a", text: "" }, { id: "b", text: "" }] };
    case "integer":
      return {};
    case "numerical":
      return { tolerance: 0 };
    case "subjective":
      return {};
    case "match":
      return {
        left:  [{ id: "L1", text: "" }],
        right: [{ id: "R1", text: "" }],
      };
    case "assertion_reason":
      return { assertion: "", reason: "" };
    case "fill_blanks":
      return { text: "Fill ___ the blank.", blanks: [{ id: "B1" }] };
  }
}

function defaultAnswerKey(type: QuestionType): Record<string, unknown> {
  switch (type) {
    case "mcq_single":      return { optionId: "" };
    case "mcq_multiple":    return { optionIds: [] };
    case "integer":         return { value: 0 };
    case "numerical":       return { value: 0 };
    case "subjective":      return { sampleAnswer: "" };
    case "match":           return { pairs: [] };
    case "assertion_reason":return { optionId: "" };
    case "fill_blanks":     return { answers: [] };
  }
}

// ── Question Form ─────────────────────────────────────────────────────────────

function QuestionForm({
  type,
  payload,
  answerKey,
  onPayloadChange,
  onAnswerKeyChange,
}: {
  type: QuestionType;
  payload: Record<string, unknown>;
  answerKey: Record<string, unknown>;
  onPayloadChange: (p: Record<string, unknown>) => void;
  onAnswerKeyChange: (a: Record<string, unknown>) => void;
}) {
  const setP = (k: string, v: unknown) => onPayloadChange({ ...payload, [k]: v });
  const setA = (k: string, v: unknown) => onAnswerKeyChange({ ...answerKey, [k]: v });
  const addBtn: CSSProperties = { ...btnS, fontSize: 12, padding: "6px 12px", marginTop: 6 };
  const muted = "var(--text-muted)";

  if (type === "mcq_single" || type === "mcq_multiple") {
    const options = (payload.options as { id: string; text: string }[]) ?? [];
    const correctIds: string[] = type === "mcq_single"
      ? [(answerKey.optionId as string) ?? ""]
      : (answerKey.optionIds as string[]) ?? [];

    return (
      <div>
        <div style={{ marginBottom: "6px", fontWeight: 600, fontSize: "12px", color: muted }}>Options</div>
        {options.map((opt, i) => (
          <div key={opt.id} style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px" }}>
            <input
              type={type === "mcq_single" ? "radio" : "checkbox"}
              checked={correctIds.includes(opt.id)}
              onChange={() => {
                if (type === "mcq_single") {
                  setA("optionId", opt.id);
                } else {
                  const ids = correctIds.includes(opt.id)
                    ? correctIds.filter(id => id !== opt.id)
                    : [...correctIds, opt.id];
                  setA("optionIds", ids);
                }
              }}
              style={{ accentColor: "var(--accent)" }}
              title="Mark as correct"
            />
            <span style={{ fontSize: "12px", color: muted, width: "16px" }}>{opt.id}.</span>
            <input
              value={opt.text}
              placeholder={`Option ${opt.id}`}
              onChange={e => {
                const updated = options.map((o, j) => j === i ? { ...o, text: e.target.value } : o);
                setP("options", updated);
              }}
              style={{ ...inp, flex: 1 }}
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => {
                  const updated = options.filter((_, j) => j !== i);
                  setP("options", updated);
                  if (type === "mcq_single" && answerKey.optionId === opt.id) setA("optionId", "");
                  if (type === "mcq_multiple") setA("optionIds", correctIds.filter(id => id !== opt.id));
                }}
                style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "14px", padding: "0 4px" }}
              >✕</button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const nextId = String.fromCharCode(97 + options.length);
            setP("options", [...options, { id: nextId, text: "" }]);
          }}
          style={addBtn}
        >
          + Add option
        </button>
        <div style={{ marginTop: "8px", fontSize: "12px", color: muted }}>
          {type === "mcq_single" ? "Select the correct option using the radio button." : "Check all correct options."}
        </div>
      </div>
    );
  }

  if (type === "integer") {
    return (
      <div>
        <label style={fieldLabel}>Correct integer value</label>
        <input
          type="number" step="1"
          value={(answerKey.value as number) ?? 0}
          onChange={e => setA("value", parseInt(e.target.value, 10))}
          style={{ ...inp, display: "block", marginTop: "6px", width: "120px" }}
        />
      </div>
    );
  }

  if (type === "numerical") {
    return (
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <label style={fieldLabel}>Correct value</label>
          <input
            type="number" step="any"
            value={(answerKey.value as number) ?? 0}
            onChange={e => setA("value", parseFloat(e.target.value))}
            style={{ ...inp, display: "block", marginTop: "6px", width: "120px" }}
          />
        </div>
        <div>
          <label style={fieldLabel}>Tolerance (±)</label>
          <input
            type="number" step="any" min="0"
            value={(payload.tolerance as number) ?? 0}
            onChange={e => setP("tolerance", parseFloat(e.target.value))}
            style={{ ...inp, display: "block", marginTop: "6px", width: "100px" }}
          />
        </div>
      </div>
    );
  }

  if (type === "subjective") {
    return (
      <div>
        <label style={fieldLabel}>Sample answer (optional)</label>
        <textarea
          value={(answerKey.sampleAnswer as string) ?? ""}
          onChange={e => setA("sampleAnswer", e.target.value)}
          rows={3}
          style={{ ...inp, display: "block", marginTop: "6px", width: "100%", resize: "vertical" }}
        />
        <label style={{ ...fieldLabel, display: "block", marginTop: "10px" }}>
          Word limit (optional)
        </label>
        <input
          type="number" min="0"
          value={(payload.wordLimit as number) ?? ""}
          onChange={e => setP("wordLimit", e.target.value ? parseInt(e.target.value, 10) : undefined)}
          style={{ ...inp, display: "block", marginTop: "6px", width: "100px" }}
        />
      </div>
    );
  }

  if (type === "match") {
    const left  = (payload.left  as { id: string; text: string }[]) ?? [];
    const right = (payload.right as { id: string; text: string }[]) ?? [];
    const pairs = (answerKey.pairs as { leftId: string; rightId: string }[]) ?? [];

    return (
      <div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "160px" }}>
            <div style={{ fontWeight: 600, fontSize: "12px", color: muted, marginBottom: "6px" }}>Column A (Left)</div>
            {left.map((item, i) => (
              <div key={item.id} style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", color: muted, width: "20px", paddingTop: "9px" }}>{item.id}</span>
                <input
                  value={item.text}
                  placeholder={`Item ${item.id}`}
                  onChange={e => {
                    const updated = left.map((l, j) => j === i ? { ...l, text: e.target.value } : l);
                    setP("left", updated);
                  }}
                  style={{ ...inp, flex: 1 }}
                />
              </div>
            ))}
            <button type="button" onClick={() => setP("left", [...left, { id: `L${left.length + 1}`, text: "" }])} style={addBtn}>+ Left</button>
          </div>
          <div style={{ flex: 1, minWidth: "160px" }}>
            <div style={{ fontWeight: 600, fontSize: "12px", color: muted, marginBottom: "6px" }}>Column B (Right)</div>
            {right.map((item, i) => (
              <div key={item.id} style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", color: muted, width: "20px", paddingTop: "9px" }}>{item.id}</span>
                <input
                  value={item.text}
                  placeholder={`Item ${item.id}`}
                  onChange={e => {
                    const updated = right.map((r, j) => j === i ? { ...r, text: e.target.value } : r);
                    setP("right", updated);
                  }}
                  style={{ ...inp, flex: 1 }}
                />
              </div>
            ))}
            <button type="button" onClick={() => setP("right", [...right, { id: `R${right.length + 1}`, text: "" }])} style={addBtn}>+ Right</button>
          </div>
        </div>
        <div style={{ marginTop: "12px" }}>
          <div style={{ fontWeight: 600, fontSize: "12px", color: muted, marginBottom: "6px" }}>Correct matches</div>
          {left.map(lItem => {
            const pair = pairs.find(p => p.leftId === lItem.id);
            return (
              <div key={lItem.id} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px", fontSize: "12px" }}>
                <span style={{ width: "90px", fontWeight: 500, color: "var(--text-heading)" }}>{lItem.id}: {lItem.text}</span>
                <span style={{ color: muted }}>→</span>
                <select
                  value={pair?.rightId ?? ""}
                  onChange={e => {
                    const updated = pairs.filter(p => p.leftId !== lItem.id);
                    if (e.target.value) updated.push({ leftId: lItem.id, rightId: e.target.value });
                    setA("pairs", updated);
                  }}
                  style={{ ...inp, fontSize: "12px" }}
                >
                  <option value="">-- select --</option>
                  {right.map(r => <option key={r.id} value={r.id}>{r.id}: {r.text}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "assertion_reason") {
    const AR_OPTIONS = [
      { id: "A", text: "Both A and R are true and R is the correct explanation of A." },
      { id: "B", text: "Both A and R are true but R is not the correct explanation of A." },
      { id: "C", text: "A is true but R is false." },
      { id: "D", text: "A is false but R is true." },
    ];
    return (
      <div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <label style={fieldLabel}>Assertion (A)</label>
            <textarea
              value={(payload.assertion as string) ?? ""}
              onChange={e => setP("assertion", e.target.value)}
              rows={2}
              style={{ ...inp, display: "block", width: "100%", marginTop: "6px", resize: "vertical" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <label style={fieldLabel}>Reason (R)</label>
            <textarea
              value={(payload.reason as string) ?? ""}
              onChange={e => setP("reason", e.target.value)}
              rows={2}
              style={{ ...inp, display: "block", width: "100%", marginTop: "6px", resize: "vertical" }}
            />
          </div>
        </div>
        <div style={{ fontSize: "12px", fontWeight: 600, color: muted, marginBottom: "6px" }}>Correct option</div>
        {AR_OPTIONS.map(opt => (
          <label key={opt.id} style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "6px", cursor: "pointer", fontSize: "13px", color: "var(--text-heading)" }}>
            <input
              type="radio"
              checked={answerKey.optionId === opt.id}
              onChange={() => setA("optionId", opt.id)}
              style={{ marginTop: "3px", accentColor: "var(--accent)" }}
            />
            <span><strong>{opt.id}.</strong> {opt.text}</span>
          </label>
        ))}
      </div>
    );
  }

  if (type === "fill_blanks") {
    const blanks = (payload.blanks as { id: string }[]) ?? [];
    const answers = (answerKey.answers as { blankId: string; value: string }[]) ?? [];

    return (
      <div>
        <label style={fieldLabel}>
          Question text (use ___ for blanks)
        </label>
        <textarea
          value={(payload.text as string) ?? ""}
          onChange={e => setP("text", e.target.value)}
          rows={2}
          style={{ ...inp, display: "block", width: "100%", marginTop: "6px", resize: "vertical" }}
        />
        <div style={{ marginTop: "10px", fontWeight: 600, fontSize: "12px", color: muted }}>Answers for each blank</div>
        {blanks.map((blank) => {
          const ans = answers.find(a => a.blankId === blank.id);
          return (
            <div key={blank.id} style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "6px" }}>
              <span style={{ fontSize: "12px", color: muted, width: "32px" }}>{blank.id}:</span>
              <input
                value={ans?.value ?? ""}
                placeholder="Correct answer"
                onChange={e => {
                  const updated = answers.filter(a => a.blankId !== blank.id);
                  updated.push({ blankId: blank.id, value: e.target.value });
                  setA("answers", updated);
                }}
                style={{ ...inp, flex: 1 }}
              />
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => {
            const newId = `B${blanks.length + 1}`;
            setP("blanks", [...blanks, { id: newId }]);
          }}
          style={addBtn}
        >
          + Add blank
        </button>
      </div>
    );
  }

  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────

function ExamDetailInner() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  // Everything role-gated below (`isOwner`, the review + live controls) keys off
  // the role held in THIS coaching — the same value the API authorises against.
  const { loading: sessionLoading, user, tenant, role, isOwner } =
    useTenantSession<Tenant>({
      allow: ["coaching_owner", "teacher"],
      denyRedirect: `/student/coaching/exams/${examId}/intro`,
    });

  const [exam, setExam]     = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  // Opens on the paper overview, never straight into the question list — the
  // same "read the cover page first" rule the student instruction sheet follows.
  // In the URL as `?tab=questions`, so a reload (or a link sent to the owner
  // reviewing the paper) keeps the panel that was being read.
  const [tabSlug, setTabSlug] = useUrlState("tab", TAB_SLUGS, "overview");
  const tab = labelForSlug(tabSlug);
  const setTab = useCallback((label: string) => setTabSlug(label.toLowerCase()), [setTabSlug]);

  // edit mode
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "", description: "", instructions: "",
    durationMins: "60", gradeLevel: "", visibility: "private" as Exam["visibility"],
    price: "", maxAttempts: "1", scheduledAt: "", endsAt: "",
    subjectId: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editErr, setEditErr]         = useState("");

  // publish / archive
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg]         = useState("");
  const [actionErr, setActionErr]         = useState("");

  // questions
  const [addQMode, setAddQMode]         = useState(false);
  const [qType, setQType]               = useState<QuestionType>("mcq_single");
  const [qBody, setQBody]               = useState("");
  const [qMarks, setQMarks]             = useState("4");
  const [qNeg, setQNeg]                 = useState("1");
  const [qExplanation, setQExplanation] = useState("");
  const [qPayload, setQPayload]         = useState<Record<string, unknown>>(defaultPayload("mcq_single"));
  const [qAnswerKey, setQAnswerKey]     = useState<Record<string, unknown>>(defaultAnswerKey("mcq_single"));
  const [qLoading, setQLoading]         = useState(false);
  const [qErr, setQErr]                 = useState("");
  const [confirmRemoveQId, setConfirmRemoveQId] = useState<string | null>(null);

  // edit question
  const [editQId, setEditQId]             = useState<string | null>(null);
  const [editQBody, setEditQBody]         = useState("");
  const [editQMarks, setEditQMarks]       = useState("4");
  const [editQNeg, setEditQNeg]           = useState("1");
  const [editQExpl, setEditQExpl]         = useState("");
  const [editQPayload, setEditQPayload]   = useState<Record<string, unknown>>({});
  const [editQAnswerKey, setEditQAnswerKey] = useState<Record<string, unknown>>({});
  const [editQLoading, setEditQLoading]   = useState(false);
  const [editQErr, setEditQErr]           = useState("");

  // class linking
  const [linkedClasses, setLinkedClasses] = useState<ExamClass[]>([]);
  const [allClasses, setAllClasses]       = useState<ClassItem[]>([]);
  const [linkClassId, setLinkClassId]     = useState("");
  const [linkLoading, setLinkLoading]     = useState(false);
  const [linkErr, setLinkErr]             = useState("");
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);

  // subjects & chapters
  const [subjects, setSubjects]         = useState<Subject[]>([]);
  const [chapters, setChapters]         = useState<Chapter[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [chapterSaving, setChapterSaving] = useState(false);
  const [chapterErr, setChapterErr]     = useState("");
  const [chapterSaved, setChapterSaved] = useState(false);

  // evaluation progress (drives the under_evaluation stall panel)
  const [evalProgress, setEvalProgress] = useState<EvalProgress | null>(null);

  // sessions
  const [sessions, setSessions]         = useState<ExamSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsErr, setSessionsErr]   = useState("");
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  // ── Admin (owner) review + live controls ────────────────────────────────────
  type AdminModal = null | "schedule" | "request-changes" | "reject" | "extend";
  const [adminModal, setAdminModal]     = useState<AdminModal>(null);
  const [adminBusy, setAdminBusy]       = useState(false);
  const [adminErr, setAdminErr]         = useState("");
  const [remarks, setRemarks]           = useState("");
  const [addMinutes, setAddMinutes]     = useState("15");
  const [schedForm, setSchedForm]       = useState({ classIds: [] as string[], scheduledAt: "", endsAt: "" });

  const loadExam = useCallback(async (slug: string): Promise<Exam | null> => {
    try {
      const data = await api.get<{ exam: Exam }>(`/tenant/exams/${examId}`, { tenant: slug });
      setExam(data.exam);
      return data.exam;
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to load exam");
      return null;
    }
  }, [examId]);

  const loadLinkedClasses = useCallback(async (slug: string) => {
    try {
      const data = await api.get<{ classes: ExamClass[] }>(`/tenant/exams/${examId}/classes`, { tenant: slug });
      setLinkedClasses(data.classes);
    } catch { /* non-critical */ }
  }, [examId]);

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    const slug = tenant.slug;

    (async () => {
      const examData = await loadExam(slug);
      if (cancelled) return;
      loadLinkedClasses(slug);

      // load classes for linking
      try {
        const cd = await api.get<{ classes: ClassItem[] }>("/tenant/classes", { tenant: slug });
        if (!cancelled) setAllClasses(cd.classes);
      } catch { /* ok */ }

      // load subjects
      try {
        const sd = await api.get<{ subjects: Subject[] }>("/tenant/subjects", { tenant: slug });
        if (!cancelled) setSubjects(sd.subjects);
      } catch { /* ok */ }

      // load chapters for the exam's subject
      if (examData?.subjectId) {
        try {
          const cd = await api.get<{ chapters: Chapter[] }>(`/tenant/subjects/${examData.subjectId}/chapters`, { tenant: slug });
          if (!cancelled) setChapters(cd.chapters);
        } catch { /* ok */ }
      }

      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [tenant, loadExam, loadLinkedClasses]);

  // ── Actions ────────────────────────────────────────────────────────────────

  function openEdit() {
    if (!exam) return;
    setEditForm({
      title: exam.title,
      description: exam.description ?? "",
      instructions: exam.instructions ?? "",
      durationMins: String(exam.durationMins),
      gradeLevel: exam.gradeLevel ?? "",
      visibility: exam.visibility,
      price: exam.price ?? "",
      maxAttempts: String(exam.maxAttempts),
      scheduledAt: exam.scheduledAt ? exam.scheduledAt.slice(0, 16) : "",
      endsAt: exam.endsAt ? exam.endsAt.slice(0, 16) : "",
      subjectId: exam.subjectId ?? "",
    });
    setEditErr("");
    setEditMode(true);
  }

  async function handleEditSave() {
    if (!tenant || !exam) return;
    setEditErr(""); setEditLoading(true);
    try {
      const prevSubjectId = exam.subjectId;
      const body: Record<string, unknown> = {
        title: editForm.title,
        durationMins: parseInt(editForm.durationMins, 10),
        visibility: editForm.visibility,
        maxAttempts: parseInt(editForm.maxAttempts, 10),
        description: editForm.description || null,
        instructions: editForm.instructions || null,
        gradeLevel: editForm.gradeLevel || null,
        price: editForm.price || null,
        subjectId: editForm.subjectId || null,
        scheduledAt: editForm.scheduledAt ? new Date(editForm.scheduledAt).toISOString() : null,
        endsAt: editForm.endsAt ? new Date(editForm.endsAt).toISOString() : null,
      };
      const res = await api.patch<{ exam: Exam }>(`/tenant/exams/${exam.id}`, body, { tenant: tenant.slug });
      setExam(prev => prev ? { ...prev, ...res.exam } : res.exam);
      // reload chapters if subject changed
      const newSubjectId = res.exam.subjectId;
      if (newSubjectId && newSubjectId !== prevSubjectId) {
        try {
          const cd = await api.get<{ chapters: Chapter[] }>(`/tenant/subjects/${newSubjectId}/chapters`, { tenant: tenant.slug });
          setChapters(cd.chapters);
          setSelectedChapterIds([]);
        } catch { /* non-critical */ }
      } else if (!newSubjectId) {
        setChapters([]);
        setSelectedChapterIds([]);
      }
      setEditMode(false);
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : "Failed to update exam");
    } finally {
      setEditLoading(false);
    }
  }

  // Teacher submit-for-review: draft|changes_requested → under_review. This is
  // also the moment the paper stops being private to its author and appears in
  // the owner's approval queue.
  async function handleSubmit() {
    if (!tenant || !exam) return;
    setActionErr(""); setActionMsg(""); setActionLoading("submit");
    try {
      const res = await api.post<{ exam: Exam }>(`/tenant/exams/${exam.id}/submit`, {}, { tenant: tenant.slug });
      setExam(prev => prev ? { ...prev, ...res.exam } : res.exam);
      setActionMsg("Submitted for review. Your admin will review it — you can't edit it until they respond.");
      await loadExam(tenant.slug);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Failed to submit for review");
    } finally {
      setActionLoading(null);
    }
  }

  // Publish results — ready_to_publish → completed. Reachable only once every
  // session is evaluated, so the teacher has already been able to review the
  // reports below before releasing them.
  async function handlePublishResults() {
    if (!tenant || !exam) return;
    setActionErr(""); setActionMsg(""); setActionLoading("publish-results");
    try {
      const res = await api.post<{ exam: Exam }>(`/tenant/exams/${exam.id}/publish-results`, {}, { tenant: tenant.slug });
      setExam(prev => prev ? { ...prev, ...res.exam } : res.exam);
      setActionMsg("Results published — students can now see their scores & reports.");
      await loadExam(tenant.slug);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Failed to publish results");
    } finally {
      setActionLoading(null);
    }
  }

  // Clone into a fresh draft owned by the requester, then jump to it.
  async function handleDuplicate() {
    if (!tenant || !exam) return;
    setActionErr(""); setActionMsg(""); setActionLoading("duplicate");
    try {
      const res = await api.post<{ exam: Exam }>(`/tenant/exams/${exam.id}/duplicate`, {}, { tenant: tenant.slug });
      router.push(`/coaching/exams/${res.exam.id}`);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Failed to duplicate exam");
      setActionLoading(null);
    }
  }

  async function handleArchive() {
    if (!tenant || !exam) return;
    setActionErr(""); setActionMsg(""); setActionLoading("archive");
    try {
      const res = await api.post<{ exam: Exam }>(`/tenant/exams/${exam.id}/archive`, {}, { tenant: tenant.slug });
      setExam(prev => prev ? { ...prev, ...res.exam } : res.exam);
      setActionMsg("Exam archived.");
      await loadExam(tenant.slug);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Failed to archive");
    } finally {
      setActionLoading(null);
    }
  }

  // Open the Schedule modal — pre-fill classes with current links and times with
  // any already-set window (so re-scheduling starts from what is there today).
  function openSchedule() {
    if (!exam) return;
    setAdminErr(""); setRemarks("");
    setSchedForm({
      classIds: linkedClasses.map(lc => lc.classId),
      scheduledAt: exam.scheduledAt ? exam.scheduledAt.slice(0, 16) : "",
      endsAt: exam.endsAt ? exam.endsAt.slice(0, 16) : "",
    });
    setAdminModal("schedule");
  }

  async function refreshAfterAdmin() {
    if (!tenant) return;
    await loadExam(tenant.slug);
    loadLinkedClasses(tenant.slug);
  }

  // Approval is a verdict on the paper, nothing more — no dates, no classes.
  // Scheduling is a separate decision the admin makes whenever a slot is free,
  // so this is a one-click action rather than a modal.
  async function handleApprove() {
    if (!tenant || !exam) return;
    setActionErr(""); setActionMsg(""); setActionLoading("approve");
    try {
      await api.post(`/tenant/exams/${exam.id}/approve`, {}, { tenant: tenant.slug });
      setActionMsg("Approved. Schedule it whenever you're ready.");
      await refreshAfterAdmin();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSchedule() {
    if (!tenant || !exam) return;
    setAdminErr(""); setAdminBusy(true);
    try {
      if (!schedForm.scheduledAt) throw new Error("Pick a start time");
      const body: Record<string, unknown> = {
        scheduledAt: new Date(schedForm.scheduledAt).toISOString(),
      };
      if (schedForm.classIds.length > 0) body.classIds = schedForm.classIds;
      if (schedForm.endsAt) body.endsAt = new Date(schedForm.endsAt).toISOString();
      await api.post(`/tenant/exams/${exam.id}/schedule`, body, { tenant: tenant.slug });
      setActionMsg("Scheduled.");
      setAdminModal(null);
      await refreshAfterAdmin();
    } catch (err) {
      setAdminErr(err instanceof Error ? err.message : "Failed to schedule");
    } finally {
      setAdminBusy(false);
    }
  }

  async function handleReviewDecision(kind: "request-changes" | "reject") {
    if (!tenant || !exam) return;
    setAdminErr(""); setAdminBusy(true);
    try {
      await api.post(`/tenant/exams/${exam.id}/${kind}`, { remarks }, { tenant: tenant.slug });
      setActionMsg(kind === "reject" ? "Exam rejected." : "Changes requested — sent back to the teacher.");
      setAdminModal(null); setRemarks("");
      await refreshAfterAdmin();
    } catch (err) {
      setAdminErr(err instanceof Error ? err.message : "Failed to submit decision");
    } finally {
      setAdminBusy(false);
    }
  }

  // Live controls — no body, act on `live`/`scheduled`.
  async function handleLiveAction(kind: "go-live" | "end" | "force-submit") {
    if (!tenant || !exam) return;
    setActionErr(""); setActionMsg(""); setActionLoading(kind);
    try {
      await api.post(`/tenant/exams/${exam.id}/${kind}`, {}, { tenant: tenant.slug });
      setActionMsg(
        kind === "go-live" ? "Exam is now live." :
        kind === "end" ? "Exam ended — active sessions were force-submitted." :
        "All active sessions were force-submitted.",
      );
      await refreshAfterAdmin();
      if (sessionsLoaded) loadSessions();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Live control failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExtend() {
    if (!tenant || !exam) return;
    setAdminErr(""); setAdminBusy(true);
    try {
      await api.post(`/tenant/exams/${exam.id}/extend-time`, { addMinutes: parseInt(addMinutes, 10) }, { tenant: tenant.slug });
      setActionMsg(`Extended by ${addMinutes} minutes.`);
      setAdminModal(null);
      await refreshAfterAdmin();
    } catch (err) {
      setAdminErr(err instanceof Error ? err.message : "Failed to extend time");
    } finally {
      setAdminBusy(false);
    }
  }

  function handleQTypeChange(t: QuestionType) {
    setQType(t);
    setQPayload(defaultPayload(t));
    setQAnswerKey(defaultAnswerKey(t));
    setQErr("");
  }

  async function handleAddQuestion() {
    if (!tenant || !exam) return;
    setQErr(""); setQLoading(true);
    try {
      const body = {
        type: qType,
        body: qBody,
        payload: qPayload,
        answerKey: qAnswerKey,
        marks: parseInt(qMarks, 10),
        negativeMarks: parseInt(qNeg, 10) || 0,
        explanation: qExplanation || undefined,
      };
      const res = await api.post<{ question: Question }>(`/tenant/exams/${exam.id}/questions`, body, { tenant: tenant.slug });
      setExam(prev => prev ? { ...prev, questions: [...prev.questions, res.question], totalMarks: prev.totalMarks + res.question.marks } : prev);
      setQBody(""); setQMarks("4"); setQNeg("1"); setQExplanation("");
      setQPayload(defaultPayload(qType)); setQAnswerKey(defaultAnswerKey(qType));
      setAddQMode(false);
    } catch (err) {
      setQErr(err instanceof Error ? err.message : "Failed to add question");
    } finally {
      setQLoading(false);
    }
  }

  function openEditQ(q: Question) {
    setEditQId(q.id);
    setEditQBody(q.body);
    setEditQMarks(String(q.marks));
    setEditQNeg(String(q.negativeMarks));
    setEditQExpl(q.explanation ?? "");
    setEditQPayload({ ...q.payload });
    setEditQAnswerKey({ ...q.answerKey });
    setEditQErr("");
  }

  async function handleUpdateQ() {
    if (!tenant || !exam || !editQId) return;
    setEditQErr(""); setEditQLoading(true);
    try {
      const body = {
        body: editQBody,
        payload: editQPayload,
        answerKey: editQAnswerKey,
        marks: parseInt(editQMarks, 10),
        negativeMarks: parseInt(editQNeg, 10) || 0,
        explanation: editQExpl || null,
      };
      const res = await api.patch<{ question: Question }>(`/tenant/exams/${exam.id}/questions/${editQId}`, body, { tenant: tenant.slug });
      setExam(prev => {
        if (!prev) return prev;
        const questions = prev.questions.map(q => q.id === editQId ? res.question : q);
        const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
        return { ...prev, questions, totalMarks };
      });
      setEditQId(null);
    } catch (err) {
      setEditQErr(err instanceof Error ? err.message : "Failed to update question");
    } finally {
      setEditQLoading(false);
    }
  }

  async function handleRemoveQ(qid: string) {
    if (!tenant || !exam) return;
    setConfirmRemoveQId(null);
    try {
      await api.delete(`/tenant/exams/${exam.id}/questions/${qid}`, { tenant: tenant.slug });
      setExam(prev => {
        if (!prev) return prev;
        const questions = prev.questions.filter(q => q.id !== qid);
        const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
        return { ...prev, questions, totalMarks };
      });
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to remove question");
    }
  }

  async function handleLinkClass() {
    if (!tenant || !exam || !linkClassId) return;
    setLinkErr(""); setLinkLoading(true);
    try {
      const res = await api.post<{ examClass: ExamClass }>(`/tenant/exams/${exam.id}/classes`, { classId: linkClassId }, { tenant: tenant.slug });
      setLinkedClasses(prev => [...prev, res.examClass]);
      setLinkClassId("");
    } catch (err) {
      setLinkErr(err instanceof Error ? err.message : "Failed to link class");
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleUnlinkClass(classId: string) {
    if (!tenant || !exam) return;
    setConfirmUnlinkId(null);
    try {
      await api.delete(`/tenant/exams/${exam.id}/classes/${classId}`, { tenant: tenant.slug });
      setLinkedClasses(prev => prev.filter(lc => lc.classId !== classId));
    } catch (err) {
      setLinkErr(err instanceof Error ? err.message : "Failed to unlink class");
    }
  }

  async function handleSaveChapters() {
    if (!tenant || !exam) return;
    setChapterErr(""); setChapterSaving(true); setChapterSaved(false);
    try {
      await api.put(`/tenant/exams/${exam.id}/chapters`, { chapterIds: selectedChapterIds }, { tenant: tenant.slug });
      setChapterSaved(true);
      setTimeout(() => setChapterSaved(false), 3000);
    } catch (err) {
      setChapterErr(err instanceof Error ? err.message : "Failed to save chapters");
    } finally {
      setChapterSaving(false);
    }
  }

  async function handleReorderQ(fromIdx: number, toIdx: number) {
    if (!tenant || !exam) return;
    const reordered = [...exam.questions];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setExam(prev => prev ? { ...prev, questions: reordered } : prev);
    try {
      const res = await api.put<{ questions: Question[] }>(
        `/tenant/exams/${exam.id}/questions/reorder`,
        { orderedIds: reordered.map(q => q.id) },
        { tenant: tenant.slug }
      );
      setExam(prev => prev ? { ...prev, questions: res.questions } : prev);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to reorder questions");
      await loadExam(tenant.slug);
    }
  }

  const loadSessions = useCallback(async () => {
    if (!tenant || !exam) return;
    setSessionsLoading(true); setSessionsErr(""); setSessionsLoaded(true);
    try {
      const data = await api.get<{ sessions: ExamSession[] }>(`/tenant/exams/${exam.id}/sessions`, { tenant: tenant.slug });
      setSessions(data.sessions);
    } catch (err) {
      setSessionsErr(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setSessionsLoading(false);
    }
  }, [tenant, exam]);

  // Sessions load lazily on the tab click. Landing on `?tab=sessions` directly —
  // a reload, a bookmark, a link from the approvals hub — is the one path with
  // no click to hang that off, so the tab has to ask for its own data.
  useEffect(() => {
    if (tabSlug === "sessions" && exam && !sessionsLoaded) loadSessions();
  }, [tabSlug, exam, sessionsLoaded, loadSessions]);

  // ── Evaluation progress (under_evaluation only) ────────────────────────────
  //
  // An exam leaves `under_evaluation` only when EVERY session is settled, so
  // this is how far along the cohort is — and, via `underReview`, the only
  // explanation the teacher gets for a publish button they cannot press.
  // Returns rather than sets, so every caller can reuse it without owning the
  // state write.
  const fetchEvalProgress = useCallback(async (): Promise<EvalProgress | null> => {
    if (!tenant || !exam) return null;
    try {
      return await api.get<EvalProgress>(
        `/tenant/exams/${exam.id}/evaluation-progress`,
        { tenant: tenant.slug },
      );
    } catch {
      // Non-critical: the panel just stays hidden rather than breaking the page.
      return null;
    }
  }, [tenant, exam]);

  // Matches the mount effect above: the async IIFE + `cancelled` guard keeps the
  // setState out of the effect body and drops a late response if the exam
  // changes underneath us.
  // Also fetched in `ready_to_publish`, not just `under_evaluation`: that is
  // where `underReview` matters. An exam can be fully evaluated and still have
  // an answer with Gyaanverse, and the publish button has to know before the
  // teacher presses it and gets a 422 back.
  useEffect(() => {
    if (exam?.status !== "under_evaluation" && exam?.status !== "ready_to_publish") return;
    let cancelled = false;
    (async () => {
      const data = await fetchEvalProgress();
      if (!cancelled) setEvalProgress(data);
    })();
    return () => { cancelled = true; };
  }, [exam?.status, fetchEvalProgress]);

  // There is deliberately no `handleRetryEvaluations` here. A teacher-facing
  // retry was a teacher-facing failure — it could not exist without telling them
  // the AI had broken — and it is now redundant besides: BullMQ's ladder, the
  // reconciler and the backstop between them re-run everything that can be
  // re-run. What they cannot finish goes to Gyaanverse, and shows up above only
  // as `underReview`.

  // ── Render ─────────────────────────────────────────────────────────────────

  if (sessionLoading || loading || !user || !tenant) return <PageLoading />;

  if (pageError && !exam) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "var(--bg-page)" }}>
        <p style={{ color: "var(--danger)", fontSize: 14 }}>{pageError}</p>
        <Button variant="secondary" onClick={() => router.push("/coaching/exams")}>← Back to Exams</Button>
      </div>
    );
  }

  if (!exam) return null;

  // Authoring is the teacher's job and only for papers they wrote. The coaching
  // owner reviews, schedules and archives — they never get an edit, submit or
  // duplicate control, because every one of those endpoints is
  // `requireTenantRole('teacher')` and would 403 for them.
  //
  // Publish-results is the one exception: the endpoint accepts the owner as an
  // audited break-glass, so it is rendered separately rather than under
  // `canEdit`. See `canPublishResultsAsOwner`.
  const canEdit = role === "teacher" && exam.createdBy === user.id;
  const editable = canEdit && isExamEditable(exam.status);
  const unlinkedClasses = allClasses.filter(c => !linkedClasses.some(lc => lc.classId === c.id));

  const tabs = ["Overview", "Questions"];
  if (exam.visibility === "private") tabs.push("Access");
  if (canEdit && exam.subjectId && chapters.length > 0) tabs.push("Coverage");
  tabs.push("Sessions");
  // The pre-publish review surface. Only the authoring teacher and the owner can
  // read it (`listReportsForExam` 403s for anyone else), so it is not offered to
  // a teacher browsing someone else's paper.
  const canSeeReports = (canEdit || isOwner) && hasReports(exam.status);
  if (canSeeReports) tabs.push("Reports");
  tabs.push("Timeline");
  const activeTab = tabs.includes(tab) ? tab : "Overview";

  // The backstop's publish hold. `publishResults` refuses with a 422 while any
  // answer on this paper is still with a Gyaanverse operator, so the button is
  // disabled rather than letting the teacher press it and read an error — a
  // rejected click is a failure they experienced, which is the thing we are
  // avoiding, and this way the copy is ours rather than the API's.
  //
  // Defaults to false when progress has not loaded: an unreachable
  // evaluation-progress call must never silently block a legitimate publish.
  const reviewHold = (evalProgress?.underReview ?? 0) > 0;

  const headerActions = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <StatusBadge status={exam.status} />
      {canEdit && !editMode && isExamEditable(exam.status) && (
        <Button variant="secondary" onClick={openEdit}>Edit details</Button>
      )}
      {canEdit && (
        <Button variant="ghost" disabled={actionLoading !== null} onClick={handleDuplicate}>
          {actionLoading === "duplicate" ? "Duplicating…" : "Duplicate"}
        </Button>
      )}
      {canEdit && canSubmitForReview(exam.status) && (
        <Button variant="app" disabled={actionLoading !== null} onClick={handleSubmit}>
          {actionLoading === "submit" ? "Submitting…" : "Submit for review →"}
        </Button>
      )}
      {canEdit && canPublishResults(exam.status) && (
        <Button
          variant="app"
          disabled={actionLoading !== null || reviewHold}
          onClick={handlePublishResults}
        >
          {actionLoading === "publish-results" ? "Publishing…" : "Publish results →"}
        </Button>
      )}
      {/* Owner break-glass. Publishing is the teacher's call, so this is styled
          as a secondary action and labelled to make clear it is standing in for
          them — it exists so an absent teacher can't strand computed marks.
          The review hold applies here too: it is not a permissions problem the
          owner can outrank, it is a mark that does not exist yet. */}
      {isOwner && canPublishResultsAsOwner(exam.status) && (
        <Button
          variant="secondary"
          disabled={actionLoading !== null || reviewHold}
          onClick={handlePublishResults}
        >
          {actionLoading === "publish-results" ? "Publishing…" : "Publish on teacher's behalf"}
        </Button>
      )}
      {/* The only place `underReview` is rendered. Neutral by design: it names
          Gyaanverse as the party doing the work and asks nothing of the teacher.
          No error styling, no counts of what "failed", no retry — the whole
          point is that this reads as a step in the process, not a fault. */}
      {reviewHold && (
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--text-muted)",
            maxWidth: 320,
          }}
        >
          {evalProgress!.underReview === 1 ? "1 answer is" : `${evalProgress!.underReview} answers are`}{" "}
          getting a final check from Gyaanverse. Publishing unlocks automatically
          when that finishes — nothing for you to do.
        </span>
      )}
      {isOwner && canArchive(exam.status) && (
        <Button variant="danger" disabled={actionLoading !== null} onClick={handleArchive}>
          {actionLoading === "archive" ? "Archiving…" : "Archive"}
        </Button>
      )}

      {/* ── Admin (owner) review + live controls ─────────────────────────── */}
      {isOwner && exam.status === "under_review" && (
        <>
          <Button variant="ghost" onClick={() => { setRemarks(""); setAdminErr(""); setAdminModal("reject"); }}>Reject</Button>
          <Button variant="secondary" onClick={() => { setRemarks(""); setAdminErr(""); setAdminModal("request-changes"); }}>Request changes</Button>
          <Button variant="app" disabled={actionLoading !== null} onClick={handleApprove}>
            {actionLoading === "approve" ? "Approving…" : "Approve →"}
          </Button>
        </>
      )}
      {/* Approved but undated: scheduling is the outstanding decision, so it is
          the primary action. Once scheduled it stays available as a way to move
          the window, alongside starting early. */}
      {isOwner && exam.status === "approved" && (
        <Button variant="app" onClick={openSchedule}>Schedule →</Button>
      )}
      {isOwner && exam.status === "scheduled" && (
        <>
          <Button variant="secondary" onClick={openSchedule}>Reschedule</Button>
          <Button variant="app" disabled={actionLoading !== null} onClick={() => handleLiveAction("go-live")}>
            {actionLoading === "go-live" ? "Starting…" : "Go live now →"}
          </Button>
        </>
      )}
      {isOwner && exam.status === "live" && (
        <>
          <Button variant="secondary" onClick={() => { setAddMinutes("15"); setAdminErr(""); setAdminModal("extend"); }}>Extend time</Button>
          <Button variant="secondary" disabled={actionLoading !== null} onClick={() => handleLiveAction("force-submit")}>
            {actionLoading === "force-submit" ? "Submitting…" : "Force-submit all"}
          </Button>
          <Button variant="danger" disabled={actionLoading !== null} onClick={() => handleLiveAction("end")}>
            {actionLoading === "end" ? "Ending…" : "End now"}
          </Button>
        </>
      )}
    </div>
  );

  // ── Exam info / edit card ──────────────────────────────────────────────────
  //
  // One card, one row order, in both modes. Edit used to replace this whole card
  // with a differently-shaped form carrying a different field set — the stat
  // strip vanished, Duration went from a big number to a table input, and Price
  // and Subject appeared out of nowhere. See `DetailRows`.
  //
  // The split now follows a rule instead of an accident: the strip holds facts
  // *computed from* the paper, which nobody edits and which therefore look the
  // same either way; every stored setting is a row, and rows grow controls.
  const infoCard = (
    <div style={cardStyle}>
      <div style={{ padding: "18px 20px", display: "flex", gap: 28, flexWrap: "wrap" }}>
        {[
          ["Questions", exam.questions.length],
          ["Total marks", exam.totalMarks],
          ...(exam.qualityScore != null ? [["Quality", `${exam.qualityScore}%`] as [string, string | number]] : []),
        ].map(([l, v]) => (
          <div key={l as string}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 700, color: "var(--text-heading)", lineHeight: 1.1 }}>{v}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--border-light)" }}>
        <DetailRows
          editing={editMode}
          labelWidth={170}
          rows={[
            {
              label: "Title",
              value: exam.title,
              edit: <input className="gv-input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />,
            },
            {
              label: "Duration",
              value: `${exam.durationMins} min`,
              edit: <input className="gv-input" type="number" value={editForm.durationMins} onChange={e => setEditForm(f => ({ ...f, durationMins: e.target.value }))} />,
              help: editMode ? "Minutes." : undefined,
            },
            {
              label: "Max attempts",
              value: exam.maxAttempts,
              edit: <input className="gv-input" type="number" value={editForm.maxAttempts} onChange={e => setEditForm(f => ({ ...f, maxAttempts: e.target.value }))} />,
            },
            {
              label: "Visibility",
              value: exam.visibility.replace("_", " "),
              edit: (
                <select className="gv-select" value={editForm.visibility} onChange={e => setEditForm(f => ({ ...f, visibility: e.target.value as Exam["visibility"] }))}>
                  <option value="private">Private</option>
                  <option value="public_free">Public Free</option>
                  <option value="public_paid">Public Paid</option>
                </select>
              ),
            },
            {
              label: "Subject",
              value: subjects.find(s => s.id === exam.subjectId)?.name ?? "—",
              edit: (
                <select className="gv-select" value={editForm.subjectId} onChange={e => setEditForm(f => ({ ...f, subjectId: e.target.value }))}>
                  <option value="">— None —</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.gradeLevel ? ` (Grade ${s.gradeLevel})` : ""}</option>
                  ))}
                </select>
              ),
            },
            {
              label: "Grade level",
              value: exam.gradeLevel ?? "—",
              hidden: !exam.gradeLevel,
              edit: <input className="gv-input" value={editForm.gradeLevel} onChange={e => setEditForm(f => ({ ...f, gradeLevel: e.target.value }))} />,
            },
            {
              label: "Price",
              value: exam.price ?? "—",
              hidden: !exam.price,
              edit: <input className="gv-input" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />,
              help: editMode ? "Only applies when visibility is Public Paid." : undefined,
            },
            {
              label: "Description",
              value: <span style={{ whiteSpace: "pre-wrap" }}>{exam.description}</span>,
              hidden: !exam.description,
              edit: <textarea className="gv-textarea" rows={2} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />,
            },
            {
              label: "Instructions",
              value: <span style={{ whiteSpace: "pre-wrap" }}>{exam.instructions}</span>,
              hidden: !exam.instructions,
              edit: <textarea className="gv-textarea" rows={3} value={editForm.instructions} onChange={e => setEditForm(f => ({ ...f, instructions: e.target.value }))} />,
            },
            {
              label: "Opens at",
              value: exam.scheduledAt ? new Date(exam.scheduledAt).toLocaleString() : "—",
              hidden: !exam.scheduledAt,
              edit: <input className="gv-input" type="datetime-local" value={editForm.scheduledAt} onChange={e => setEditForm(f => ({ ...f, scheduledAt: e.target.value }))} />,
            },
            {
              label: "Closes at",
              value: exam.endsAt ? new Date(exam.endsAt).toLocaleString() : "—",
              hidden: !exam.endsAt,
              edit: <input className="gv-input" type="datetime-local" value={editForm.endsAt} onChange={e => setEditForm(f => ({ ...f, endsAt: e.target.value }))} />,
            },
          ]}
        />
      </div>

      {editMode && (
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border-default)" }}>
          {editErr && <p style={{ margin: "0 0 10px", color: "var(--danger)", fontSize: 13 }}>{editErr}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="app" disabled={editLoading} onClick={handleEditSave}>{editLoading ? "Saving…" : "Save changes"}</Button>
            <Button variant="ghost" onClick={() => { setEditMode(false); setEditErr(""); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Questions panel ─────────────────────────────────────────────────────────
  // ── Overview: what this paper actually contains ────────────────────────────
  // Answers "what am I about to open?" before the question list does. Same
  // aggregation the student instruction sheet uses, so the two can never
  // disagree about counts or marks.
  const structure = buildPaperStructure(exam.questions);
  const overviewPanel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={cardStyle}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-light)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-heading)" }}>Paper structure</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
            Parts are grouped by question type, in the order they appear in the paper.
          </div>
        </div>
        {structure.parts.length === 0 ? (
          <p style={{ margin: 0, padding: "18px 20px", fontSize: 13.5, color: "var(--text-muted)" }}>
            This paper has no questions yet. Add questions under the <strong>Questions</strong> tab.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
              <thead>
                <tr style={{ background: "var(--surface-inset)" }}>
                  {["Part", "Question type", "Questions", "Marks each", "Negative", "Total"].map((h, i) => (
                    <th key={h} style={{
                      textAlign: i >= 2 ? "right" : "left", padding: "9px 16px",
                      fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                      color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {structure.parts.map((p, i) => (
                  <tr key={p.type} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 700, color: "var(--text-heading)" }}>{PART_NUMERALS[i] ?? String(i + 1)}</td>
                    <td style={{ padding: "10px 16px", color: "var(--text-heading)" }}>
                      {p.label}
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{partRange(p)}</span>
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>{p.count}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>{partMarksEach(p)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: p.negativeEach ? "var(--danger)" : "var(--text-muted)" }}>{partNegativeEach(p)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "var(--text-heading)" }}>{fmtMarks(p.totalMarks)}</td>
                  </tr>
                ))}
                <tr style={{ background: "var(--surface-inset)" }}>
                  <td colSpan={2} style={{ padding: "10px 16px", fontWeight: 700, color: "var(--text-heading)" }}>Total</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "var(--text-heading)" }}>{structure.totalQuestions}</td>
                  <td />
                  <td />
                  <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "var(--text-heading)" }}>{fmtMarks(structure.totalMarks)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {/* Flags a paper whose question marks don't add up to the stored total. */}
        {structure.parts.length > 0 && structure.totalMarks !== exam.totalMarks && (
          <p style={{
            margin: 0, padding: "11px 16px", fontSize: 12.5, color: "var(--warning)",
            borderTop: "1px solid var(--border-light)",
          }}>
            The questions in this paper add up to {fmtMarks(structure.totalMarks)} marks, but the exam is
            recorded as {fmtMarks(exam.totalMarks)}. Students are marked out of the recorded total.
          </p>
        )}
      </div>

      {structure.difficultyMix.length > 0 && (
        <div style={cardStyle}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-light)", fontWeight: 700, fontSize: 14, color: "var(--text-heading)" }}>
            Difficulty mix
          </div>
          <div style={{ padding: "16px 20px", display: "flex", gap: 28, flexWrap: "wrap" }}>
            {structure.difficultyMix.map(({ level, count }) => (
              <div key={level}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 700, color: "var(--text-heading)", lineHeight: 1.1 }}>
                  {count}
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", marginLeft: 5 }}>
                    ({Math.round((count / structure.totalQuestions) * 100)}%)
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 3 }}>{level}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-light)", fontWeight: 700, fontSize: 14, color: "var(--text-heading)" }}>
          What candidates see before starting
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "var(--text-body)" }}>
            Every candidate must read an instruction sheet and accept a declaration before the paper opens.
            It states the duration, the marking scheme above, the attempt limit, and the palette legend —
            all generated from this exam&apos;s configuration.
            {exam.instructions?.trim()
              ? " Your additional instructions are shown alongside them."
              : " You have not added any instructions of your own; add them from the edit panel above if this paper needs specific directions."}
          </p>
          {exam.instructions?.trim() && (
            <div style={{
              background: "var(--surface-inset)", border: "1px solid var(--border-light)",
              borderRadius: 10, padding: 14, fontSize: 13, lineHeight: 1.65,
              whiteSpace: "pre-wrap", color: "var(--text-body)",
            }}>{exam.instructions}</div>
          )}
          <div>
            <Button variant="secondary" size="sm" onClick={() => setTab("Questions")}>View questions →</Button>
          </div>
        </div>
      </div>
    </div>
  );

  const questionsPanel = (
    <div>
      {editable && (
        <div style={{ marginBottom: 16 }}>
          {!addQMode ? (
            <Button variant="app" icon={<Icon name="plus" size={15} />} onClick={() => setAddQMode(true)}>Add question</Button>
          ) : (
            <div style={cardStyle}>
              <div style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-heading)", marginBottom: 12 }}>New question</div>
                <div style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={fieldLabel}>Type</label>
                  <select value={qType} onChange={e => handleQTypeChange(e.target.value as QuestionType)} style={inp}>
                    {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map(t => (
                      <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={fieldLabel}>Question body *</label>
                  <textarea required value={qBody} onChange={e => setQBody(e.target.value)} rows={3} placeholder="Enter the question text…"
                    style={{ ...inp, display: "block", width: "100%", marginTop: 6, resize: "vertical" }} />
                </div>
                <div style={{ background: "var(--surface-inset)", border: "1px solid var(--border-light)", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                    {QUESTION_TYPE_LABELS[qType]} — payload &amp; answer key
                  </div>
                  <QuestionForm type={qType} payload={qPayload} answerKey={qAnswerKey} onPayloadChange={setQPayload} onAnswerKeyChange={setQAnswerKey} />
                </div>
                <div style={{ display: "flex", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
                  <div>
                    <label style={fieldLabel}>Marks *</label>
                    <input type="number" min="1" max="1000" value={qMarks} onChange={e => setQMarks(e.target.value)} style={{ ...inp, display: "block", marginTop: 6, width: 90 }} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Negative marks</label>
                    <input type="number" min="0" max="1000" value={qNeg} onChange={e => setQNeg(e.target.value)} style={{ ...inp, display: "block", marginTop: 6, width: 90 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={fieldLabel}>Explanation (optional)</label>
                    <input value={qExplanation} onChange={e => setQExplanation(e.target.value)} style={{ ...inp, display: "block", width: "100%", marginTop: 6 }} />
                  </div>
                </div>
                {qErr && <p style={{ margin: "4px 0", color: "var(--danger)", fontSize: 12 }}>{qErr}</p>}
                <div style={{ display: "flex", gap: 10 }}>
                  <Button variant="app" disabled={qLoading || !qBody.trim()} onClick={handleAddQuestion}>{qLoading ? "Adding…" : "Add question"}</Button>
                  <Button variant="ghost" onClick={() => { setAddQMode(false); setQErr(""); }}>Cancel</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {exam.questions.length === 0 ? (
        <div className="gv-card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          No questions yet.{editable ? " Add one above, or generate a paper from the question bank." : ""}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {exam.questions.map((q, idx) => (
            <div key={q.id} className="gv-card" style={{ padding: 0, overflow: "hidden" }}>
              {editQId === q.id ? (
                <div style={{ padding: 16, background: "var(--warning-soft)" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-heading)", marginBottom: 10 }}>
                    Editing Q{idx + 1} — {QUESTION_TYPE_LABELS[q.type]}
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={fieldLabel}>Body</label>
                    <textarea value={editQBody} onChange={e => setEditQBody(e.target.value)} rows={3} style={{ ...inp, display: "block", width: "100%", marginTop: 6, resize: "vertical" }} />
                  </div>
                  <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{QUESTION_TYPE_LABELS[q.type]}</div>
                    <QuestionForm type={q.type} payload={editQPayload} answerKey={editQAnswerKey} onPayloadChange={setEditQPayload} onAnswerKeyChange={setEditQAnswerKey} />
                  </div>
                  <div style={{ display: "flex", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
                    <div>
                      <label style={fieldLabel}>Marks</label>
                      <input type="number" min="1" value={editQMarks} onChange={e => setEditQMarks(e.target.value)} style={{ ...inp, display: "block", marginTop: 6, width: 90 }} />
                    </div>
                    <div>
                      <label style={fieldLabel}>Negative marks</label>
                      <input type="number" min="0" value={editQNeg} onChange={e => setEditQNeg(e.target.value)} style={{ ...inp, display: "block", marginTop: 6, width: 90 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <label style={fieldLabel}>Explanation</label>
                      <input value={editQExpl} onChange={e => setEditQExpl(e.target.value)} style={{ ...inp, display: "block", width: "100%", marginTop: 6 }} />
                    </div>
                  </div>
                  {editQErr && <p style={{ margin: "4px 0", color: "var(--danger)", fontSize: 12 }}>{editQErr}</p>}
                  <div style={{ display: "flex", gap: 10 }}>
                    <Button variant="app" disabled={editQLoading} onClick={handleUpdateQ}>{editQLoading ? "Saving…" : "Save"}</Button>
                    <Button variant="ghost" onClick={() => { setEditQId(null); setEditQErr(""); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", minWidth: 28, paddingTop: 3 }}>Q{idx + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
                      <Badge tone="accent">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{q.marks} marks{q.negativeMarks > 0 ? ` · −${q.negativeMarks}` : ""}</span>
                      {q.explanation && <span style={{ fontSize: 12, color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="check-circle" size={12} /> Explanation</span>}
                    </div>
                    <MathText text={q.body} style={{ display: "block", fontSize: 14, lineHeight: 1.45, color: "var(--text-heading)" }} />
                  </div>
                  {editable && (
                    <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <button onClick={() => handleReorderQ(idx, idx - 1)} disabled={idx === 0} title="Move up"
                          style={{ background: "transparent", border: "1px solid var(--border-default)", borderRadius: 6, cursor: idx === 0 ? "not-allowed" : "pointer", fontSize: 11, padding: "1px 6px", color: "var(--text-muted)", opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                        <button onClick={() => handleReorderQ(idx, idx + 1)} disabled={idx === exam.questions.length - 1} title="Move down"
                          style={{ background: "transparent", border: "1px solid var(--border-default)", borderRadius: 6, cursor: idx === exam.questions.length - 1 ? "not-allowed" : "pointer", fontSize: 11, padding: "1px 6px", color: "var(--text-muted)", opacity: idx === exam.questions.length - 1 ? 0.3 : 1 }}>▼</button>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openEditQ(q)}>Edit</Button>
                      {confirmRemoveQId === q.id ? (
                        <>
                          <Button variant="danger" size="sm" onClick={() => handleRemoveQ(q.id)}>Confirm</Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmRemoveQId(null)}>✕</Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="sm" style={{ color: "var(--danger)" }} onClick={() => setConfirmRemoveQId(q.id)}>Remove</Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Access panel (private exams) ────────────────────────────────────────────
  const accessPanel = (
    <div>
      {editable && unlinkedClasses.length > 0 && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <select value={linkClassId} onChange={e => setLinkClassId(e.target.value)} style={{ ...inp, minWidth: 240 }}>
            <option value="">— select a class —</option>
            {unlinkedClasses.map(c => <option key={c.id} value={c.id}>{c.name}{c.grade ? ` (${c.grade})` : ""}</option>)}
          </select>
          <Button variant="app" disabled={linkLoading || !linkClassId} onClick={handleLinkClass}>{linkLoading ? "Linking…" : "Link class"}</Button>
        </div>
      )}
      {linkErr && <p style={{ margin: "0 0 10px", color: "var(--danger)", fontSize: 12 }}>{linkErr}</p>}
      {linkedClasses.length === 0 ? (
        <div className="gv-card" style={{ padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          No classes linked. Students in linked classes can take this exam.
        </div>
      ) : (
        <div className="gv-card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {linkedClasses.map(lc => {
                const cls = allClasses.find(c => c.id === lc.classId);
                return (
                  <tr key={lc.id}>
                    <td style={cell}>{cls?.name ?? lc.classId}</td>
                    <td style={{ ...cell, color: "var(--text-muted)", fontSize: 13 }}>{cls?.grade ?? ""}</td>
                    <td style={{ ...cell, textAlign: "right" }}>
                      {canEdit && (
                        confirmUnlinkId === lc.classId ? (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <Button variant="danger" size="sm" onClick={() => handleUnlinkClass(lc.classId)}>Confirm</Button>
                            <Button variant="ghost" size="sm" onClick={() => setConfirmUnlinkId(null)}>✕</Button>
                          </span>
                        ) : (
                          <Button variant="ghost" size="sm" style={{ color: "var(--danger)" }} onClick={() => setConfirmUnlinkId(lc.classId)}>Unlink</Button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── Coverage panel ──────────────────────────────────────────────────────────
  const coveragePanel = (
    <div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-muted)" }}>
        Select the chapters this exam covers. This helps students and analytics understand exam scope.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {chapters.map(ch => (
          <label key={ch.id} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 14, color: "var(--text-heading)" }}>
            <input type="checkbox" checked={selectedChapterIds.includes(ch.id)} style={{ accentColor: "var(--accent)", width: 15, height: 15 }}
              onChange={() => setSelectedChapterIds(prev => prev.includes(ch.id) ? prev.filter(id => id !== ch.id) : [...prev, ch.id])} />
            {ch.name}
          </label>
        ))}
      </div>
      {chapterErr && <p style={{ margin: "0 0 8px", color: "var(--danger)", fontSize: 12 }}>{chapterErr}</p>}
      {chapterSaved && <p style={{ margin: "0 0 8px", color: "var(--success)", fontSize: 12 }}>Chapter coverage saved.</p>}
      <Button variant="app" disabled={chapterSaving} onClick={handleSaveChapters}>{chapterSaving ? "Saving…" : "Save coverage"}</Button>
    </div>
  );

  // ── Sessions panel ──────────────────────────────────────────────────────────
  const sessionColumns: Column<ExamSession>[] = [
    { key: "student", label: "Student", render: (s) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>{s.studentName ?? `${s.studentId.slice(0, 8)}…`}</span> },
    { key: "attempt", label: "Attempt", width: 90, render: (s) => <span style={{ fontSize: 13 }}>{s.attemptNumber}</span> },
    { key: "status", label: "Status", width: 120, render: (s) => {
      const tone: BadgeTone = s.status === "submitted" ? "success" : s.status === "expired" ? "danger" : "warning";
      return <Badge tone={tone}>{s.status}</Badge>;
    } },
    { key: "score", label: "Score", width: 110, render: (s) => <span style={{ fontSize: 13 }}>{s.autoScore !== null ? `${s.autoScore} / ${s.totalMarks}` : "—"}</span> },
    { key: "started", label: "Started", width: 120, render: (s) => <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{new Date(s.createdAt).toLocaleDateString()}</span> },
  ];

  const sessionsPanel = (
    <div>
      {sessionsLoading ? (
        <div className="gv-card" style={{ padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading sessions…</div>
      ) : sessionsErr ? (
        <p style={{ color: "var(--danger)", fontSize: 13 }}>{sessionsErr}</p>
      ) : sessions.length === 0 ? (
        <div className="gv-card" style={{ padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No student sessions yet.</div>
      ) : (
        <DataTable columns={sessionColumns} rows={sessions} />
      )}
    </div>
  );

  // ── Timeline panel ──────────────────────────────────────────────────────────
  const timelinePanel = (
    <div className="gv-card" style={{ padding: "20px 22px" }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
        Approval &amp; lifecycle history for this exam.
      </div>
      <StatusTimeline history={exam.statusHistory ?? []} />
    </div>
  );

  // ── Admin modals (owner) ────────────────────────────────────────────────────
  const adminModals = (
    <>
      {/* Schedule / reschedule an already-approved exam */}
      <Modal
        open={adminModal === "schedule"}
        onClose={() => !adminBusy && setAdminModal(null)}
        title={exam.status === "scheduled" ? "Reschedule exam" : "Schedule exam"}
        width={520}
      >
        <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Set which classes sit this exam and when it runs. It goes live
          automatically at the start time (or use “Go live now”).
        </p>
        {exam.visibility === "private" && (
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Classes / batches</label>
            <div style={{ marginTop: 6, maxHeight: 160, overflowY: "auto", border: "1px solid var(--border-default)", borderRadius: 10, padding: "6px 10px" }}>
              {allClasses.length === 0 ? (
                <p style={{ margin: "6px 0", fontSize: 13, color: "var(--text-muted)" }}>No classes available.</p>
              ) : allClasses.map(c => (
                <label key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 14, color: "var(--text-heading)", padding: "4px 0" }}>
                  <input
                    type="checkbox"
                    checked={schedForm.classIds.includes(c.id)}
                    style={{ accentColor: "var(--accent)", width: 15, height: 15 }}
                    onChange={() => setSchedForm(f => ({ ...f, classIds: f.classIds.includes(c.id) ? f.classIds.filter(id => id !== c.id) : [...f.classIds, c.id] }))}
                  />
                  {c.name}{c.grade ? ` (${c.grade})` : ""}
                </label>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={fieldLabel}>Starts at</label>
            <input type="datetime-local" value={schedForm.scheduledAt} onChange={e => setSchedForm(f => ({ ...f, scheduledAt: e.target.value }))} style={{ ...inp, display: "block", marginTop: 6, width: "100%" }} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={fieldLabel}>Ends at</label>
            <input type="datetime-local" value={schedForm.endsAt} onChange={e => setSchedForm(f => ({ ...f, endsAt: e.target.value }))} style={{ ...inp, display: "block", marginTop: 6, width: "100%" }} />
          </div>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>
          A start time is required and must be in the future. Leave “Ends at” blank
          to close the exam manually with “End now”.
        </p>
        {adminErr && <p style={{ margin: "0 0 10px", color: "var(--danger)", fontSize: 13 }}>{adminErr}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="ghost" disabled={adminBusy} onClick={() => setAdminModal(null)}>Cancel</Button>
          <Button variant="app" disabled={adminBusy || !schedForm.scheduledAt} onClick={handleSchedule}>
            {adminBusy ? "Scheduling…" : exam.status === "scheduled" ? "Reschedule" : "Schedule"}
          </Button>
        </div>
      </Modal>

      {/* Request changes / Reject (shared remarks form) */}
      <Modal
        open={adminModal === "request-changes" || adminModal === "reject"}
        onClose={() => !adminBusy && setAdminModal(null)}
        title={adminModal === "reject" ? "Reject exam" : "Request changes"}
      >
        <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {adminModal === "reject"
            ? "The exam is rejected and returned to the teacher. Add a reason."
            : "Send the exam back to the teacher with notes on what to change."}
        </p>
        <label style={fieldLabel}>Remarks *</label>
        <textarea
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          rows={4}
          placeholder="Explain what needs to change…"
          style={{ ...inp, display: "block", width: "100%", marginTop: 6, resize: "vertical" }}
        />
        {adminErr && <p style={{ margin: "8px 0 0", color: "var(--danger)", fontSize: 13 }}>{adminErr}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
          <Button variant="ghost" disabled={adminBusy} onClick={() => setAdminModal(null)}>Cancel</Button>
          <Button
            variant={adminModal === "reject" ? "danger" : "app"}
            disabled={adminBusy || !remarks.trim()}
            onClick={() => handleReviewDecision(adminModal === "reject" ? "reject" : "request-changes")}
          >
            {adminBusy ? "Working…" : adminModal === "reject" ? "Reject exam" : "Request changes"}
          </Button>
        </div>
      </Modal>

      {/* Extend live time */}
      <Modal open={adminModal === "extend"} onClose={() => !adminBusy && setAdminModal(null)} title="Extend time" width={380}>
        <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Pushes back the exam’s end time and every in-progress session’s expiry.
        </p>
        <label style={fieldLabel}>Add minutes</label>
        <input type="number" min={1} max={600} value={addMinutes} onChange={e => setAddMinutes(e.target.value)} style={{ ...inp, display: "block", marginTop: 6, width: 120 }} />
        {adminErr && <p style={{ margin: "8px 0 0", color: "var(--danger)", fontSize: 13 }}>{adminErr}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
          <Button variant="ghost" disabled={adminBusy} onClick={() => setAdminModal(null)}>Cancel</Button>
          <Button variant="app" disabled={adminBusy || !(parseInt(addMinutes, 10) > 0)} onClick={handleExtend}>{adminBusy ? "Extending…" : "Extend"}</Button>
        </div>
      </Modal>
    </>
  );

  return (
    <TeacherShell
      tenant={tenant}
      user={user}
      role={role}
      active="exams"
      eyebrow={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => router.push("/coaching/exams")} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontWeight: 600, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", padding: 0 }}>← Exams</button>
      </span>}
      title={exam.title}
      action={headerActions}
    >
      {pageError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>{pageError}</p>
      )}
      {actionErr && <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{actionErr}</p>}
      {actionMsg && <p style={{ color: "var(--success)", fontSize: 13, marginBottom: 12 }}>{actionMsg}</p>}

      {/* Admin review remarks — surfaced when the exam was bounced or rejected. */}
      {(exam.status === "changes_requested" || exam.status === "rejected") && exam.reviewRemarks && (
        <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: "var(--radius-md)", border: `1px solid ${exam.status === "rejected" ? "rgba(244,63,94,0.35)" : "rgba(245,158,11,0.4)"}`, background: exam.status === "rejected" ? "var(--danger-soft)" : "var(--warning-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: exam.status === "rejected" ? "var(--danger)" : "var(--warning)", marginBottom: 6 }}>
            <Icon name="alert-triangle" size={14} />
            {exam.status === "rejected" ? "Rejected by admin" : "Changes requested"}
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-heading)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{exam.reviewRemarks}</p>
          {exam.status === "changes_requested" && (
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>Make the changes, then re-submit for review.</p>
          )}
          {exam.status === "rejected" && (
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
              A rejected paper is closed — it can&rsquo;t be edited or re-submitted. Use <strong>Duplicate</strong> to start a fresh draft from it.
            </p>
          )}
        </div>
      )}

      {/* Results-visibility hints for the evaluation / published states. */}
      {exam.status === "under_evaluation" && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12, paddingLeft: 12, borderLeft: "3px solid var(--warning)" }}>
          <p style={{ margin: 0 }}>
            Sessions are being evaluated. Once every session is done this exam moves to <strong>Ready to Publish</strong>, where you review the reports before releasing them.
          </p>
          {/* Progress, and nothing else. The count of sessions already done is
              reassuring; the count still outstanding was read as a stall, and
              the failure count and its retry button are gone entirely — see the
              note on `EvalProgress`. */}
          {evalProgress && (
            <p style={{ margin: "6px 0 0" }}>
              {evalProgress.sessions.evaluated} of {evalProgress.sessions.total} evaluated
            </p>
          )}
        </div>
      )}
      {canEdit && exam.status === "ready_to_publish" && (
        <div style={{ marginBottom: 12, paddingLeft: 12, borderLeft: "3px solid var(--accent)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            Every session has been evaluated. Check the AI&rsquo;s marking under <strong>Reports</strong>, then <strong>Publish results</strong> — nothing is visible to students until you do.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setTab("Reports")}>Review reports →</Button>
        </div>
      )}
      {canEdit && exam.status === "completed" && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12, paddingLeft: 12, borderLeft: "3px solid var(--success)" }}>
          Results are published — students can see their scores &amp; reports.
        </p>
      )}
      {editable && exam.visibility === "private" && linkedClasses.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12, paddingLeft: 12, borderLeft: "3px solid var(--border-default)" }}>
          Link at least one class under the <strong>Access</strong> tab before submitting for review.
        </p>
      )}

      {infoCard}

      <Tabs
        tabs={tabs}
        value={activeTab}
        onChange={setTab}
        style={{ marginBottom: 20 }}
      />

      {activeTab === "Overview" && overviewPanel}
      {activeTab === "Questions" && questionsPanel}
      {activeTab === "Access" && accessPanel}
      {activeTab === "Coverage" && coveragePanel}
      {activeTab === "Sessions" && sessionsPanel}
      {activeTab === "Reports" && (
        <ExamReportsPanel
          examId={exam.id}
          tenantSlug={tenant.slug}
          questions={exam.questions}
          published={exam.status === "completed"}
        />
      )}
      {activeTab === "Timeline" && timelinePanel}

      {adminModals}
    </TeacherShell>
  );
}

// ── Suspense wrapper (required for useSearchParams) ──────────────────────────

export default function ExamDetailPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ExamDetailInner />
    </Suspense>
  );
}

function PageLoading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text-muted)" }}>
      Loading…
    </div>
  );
}
