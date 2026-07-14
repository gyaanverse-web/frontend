"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { HierarchyPicker, deepestId, type HierarchyPath } from "@/components/HierarchyPicker";
import { HierarchyTree, type HNode } from "@/components/HierarchyTree";
import {
  QUESTION_TYPES, TYPE_LABEL, DIFFICULTIES, Field, QuestionEditor,
  buildPayloadAnswer, parseToEditor, emptyEditor, type EditorState,
} from "@/components/QuestionEditor";
import {
  QuestionClassification, buildClassification, parseClassification,
  emptyClassification, type Classification,
} from "@/components/QuestionClassification";
import { ImageUpload, makeTenantUploadSigner } from "@/components/ImageUpload";
import { QuestionPreview } from "@/components/QuestionPreview";
import { MathText } from "@/components/Math";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { HierarchyManager } from "@/components/HierarchyManager";
import { Button, Badge, DataTable, Select, Icon, KebabMenu } from "@/components/ui";
import type { Column, BadgeTone, KebabItem } from "@/components/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "super_admin" | "coaching_owner" | "teacher" | "student";
type User = { id: string; name: string; role: Role };
type Tenant = { id: string; slug: string; name: string };
type Subject = { id: string; name: string; gradeLevel: string | null };

type BankStatus = "draft" | "active" | "flagged" | "archived";

type BankQuestion = {
  id: string;
  tenantId: string | null;
  subjectId: string;
  type: string;
  difficulty: string;
  body: string;
  defaultMarks: number;
  defaultNegativeMarks: number;
  status: BankStatus;
  isVerified: boolean;
  tags: string[] | null;
};

type BankQuestionFull = BankQuestion & {
  payload: Record<string, unknown>;
  answerKey: Record<string, unknown>;
  explanation: string | null;
  source: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  imageUrls: string[] | null;
};

const STATUSES: BankStatus[] = ["draft", "active", "flagged", "archived"];

// Rows shown per page — sized to fit a laptop screen without vertical scrolling.
const PAGE_SIZE = 8;

const STATUS_TONE: Record<BankStatus, BadgeTone> = {
  active: "success",
  flagged: "danger",
  archived: "neutral",
  draft: "warning",
};

const DIFF_TONE: Record<string, BadgeTone> = {
  easy: "success",
  moderate: "warning",
  medium: "warning",
  hard: "danger",
};

// Language variants are entered one per line as "lang: translated text".
function parseLangVariants(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const lang = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    if (lang && val) out[lang] = val;
  }
  return out;
}
function serializeLangVariants(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  return Object.entries(v as Record<string, string>).map(([k, t]) => `${k}: ${t}`).join("\n");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QuestionBankPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showHierarchy, setShowHierarchy] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // filters
  const [selNode, setSelNode] = useState<HNode | null>(null); // selected hierarchy node (null = all subjects)
  const [treeVersion, setTreeVersion] = useState(0); // bumped when the hierarchy is edited, to refresh the tree
  const [fType, setFType] = useState("");
  const [fDiff, setFDiff] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fVerified, setFVerified] = useState(false);
  const [fSearch, setFSearch] = useState("");

  // create form
  const [showCreate, setShowCreate] = useState(false);
  const [cPath, setCPath] = useState<HierarchyPath>({});
  const [cType, setCType] = useState("mcq_single");
  const [cDiff, setCDiff] = useState("easy");
  const [cBody, setCBody] = useState("");
  const [cMarks, setCMarks] = useState("4");
  const [cNeg, setCNeg] = useState("0");
  const [cExplain, setCExplain] = useState("");
  const [cTags, setCTags] = useState("");
  const [cClass, setCClass] = useState<Classification>(emptyClassification);
  const [cImageUrl, setCImageUrl] = useState("");
  const [cLangVariants, setCLangVariants] = useState("");
  const [ed, setEd] = useState<EditorState>(emptyEditor);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [createMsg, setCreateMsg] = useState("");

  // edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eType, setEType] = useState("mcq_single");
  const [eDiff, setEDiff] = useState("easy");
  const [eBody, setEBody] = useState("");
  const [eMarks, setEMarks] = useState("4");
  const [eNeg, setENeg] = useState("0");
  const [eExplain, setEExplain] = useState("");
  const [eTags, setETags] = useState("");
  const [eEd, setEEd] = useState<EditorState>(emptyEditor);
  const [eClass, setEClass] = useState<Classification>(emptyClassification);
  const [eImageUrl, setEImageUrl] = useState("");
  const [eLangVariants, setELangVariants] = useState("");
  const [eMetadata, setEMetadata] = useState<Record<string, unknown> | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editErr, setEditErr] = useState("");

  // preview (read-only, KaTeX-rendered view)
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewQ, setPreviewQ] = useState<BankQuestionFull | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.allSettled([
      api.get<{ user: User }>("/api/auth/get-session"),
      api.get<{ tenant: Tenant }>("/tenants/me"),
    ]).then(([sr, tr]) => {
      if (sr.status === "rejected") { router.push("/login"); return; }
      const u = sr.value?.user;
      if (!u) { router.push("/login"); return; }
      if (u.role === "student") { router.push("/dashboard"); return; }
      setUser(u);
      if (tr.status === "rejected") { router.push("/dashboard"); return; }
      const t = tr.value.tenant;
      setTenant(t);
      loadSubjects(t.slug);
      loadCounts(t.slug);
      // The live-filter effect below performs the first question load once
      // `tenant` is set, so we don't fetch the list here.
      setLoading(false);
      // Deep link from the dashboard "Manage catalog" button opens the drawer.
      if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("manage") === "hierarchy") {
        setShowHierarchy(true);
      }
    });
  }, [router]);

  function loadSubjects(slug: string) {
    api.get<{ subjects: Subject[] }>("/tenant/subjects", { tenant: slug })
      .then((d) => setSubjects(d.subjects))
      .catch(() => {});
  }

  // ── Load / filter ───────────────────────────────────────────────────────────

  async function loadQuestions(slug: string, f: { subjectId?: string; moduleId?: string; chapterId?: string; sectionId?: string; conceptId?: string; type?: string; difficulty?: string; status?: string; isVerified?: boolean; search?: string }) {
    setListLoading(true); setPageError("");
    try {
      const qs = new URLSearchParams();
      if (f.subjectId) qs.set("subjectId", f.subjectId);
      if (f.moduleId) qs.set("moduleId", f.moduleId);
      if (f.chapterId) qs.set("chapterId", f.chapterId);
      if (f.sectionId) qs.set("sectionId", f.sectionId);
      if (f.conceptId) qs.set("conceptId", f.conceptId);
      if (f.type) qs.set("type", f.type);
      if (f.difficulty) qs.set("difficulty", f.difficulty);
      if (f.status) qs.set("status", f.status);
      if (f.isVerified) qs.set("isVerified", "true");
      if (f.search) qs.set("search", f.search);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      const data = await api.get<{ questions: BankQuestion[] }>(`/tenant/question-bank${suffix}`, { tenant: slug });
      setQuestions(data.questions);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to load questions");
    } finally {
      setListLoading(false);
    }
  }

  // Per-subject totals, fetched once and after a create — independent of the
  // active list filters, so the sidebar numbers stay stable while you browse.
  async function loadCounts(slug: string) {
    try {
      const data = await api.get<{ counts: { subjectId: string; count: number }[] }>("/tenant/question-bank/counts", { tenant: slug });
      const map: Record<string, number> = {};
      for (const c of data.counts) map[c.subjectId] = c.count;
      setCounts(map);
    } catch {
      // counts are non-critical — leave the previous values on failure
    }
  }

  // Live filtering: whenever any filter (subject, type, difficulty, status,
  // verified, search) changes, reload the list. Debounced so typing in the
  // search box doesn't fire a request per keystroke. This also runs the first
  // load once `tenant` is resolved. Every change resets to page 1.
  useEffect(() => {
    if (!tenant) return;
    const handle = setTimeout(() => {
      setPage(1);
      const node = selNode ? { [`${selNode.level}Id`]: selNode.id } : {};
      loadQuestions(tenant.slug, { ...node, type: fType, difficulty: fDiff, status: fStatus, isVerified: fVerified, search: fSearch });
    }, 300);
    return () => clearTimeout(handle);
  }, [tenant, selNode, fType, fDiff, fStatus, fVerified, fSearch]);

  function clearFilters() {
    setFType(""); setFDiff(""); setFStatus(""); setFVerified(false); setFSearch("");
  }

  // ── Row actions ─────────────────────────────────────────────────────────────

  async function rowAction(q: BankQuestion, action: "verify" | "archive") {
    if (!tenant) return;
    setActingId(q.id);
    try {
      const res = await api.post<{ question: BankQuestion }>(`/tenant/question-bank/${q.id}/${action}`, {}, { tenant: tenant.slug });
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? res.question : x)));
    } catch (err) {
      setPageError(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setActingId(null);
    }
  }

  async function flagRow(q: BankQuestion) {
    if (!tenant) return;
    const reason = window.prompt("Reason for flagging this question?");
    if (!reason || !reason.trim()) return;
    setActingId(q.id);
    try {
      const res = await api.post<{ question: BankQuestion }>(`/tenant/question-bank/${q.id}/flag`, { reason: reason.trim() }, { tenant: tenant.slug });
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? res.question : x)));
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to flag");
    } finally {
      setActingId(null);
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null);
    setCreateErr(""); setCreateMsg("");
    setShowCreate(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setCreateErr(""); setCreateMsg("");
    const dz = deepestId(cPath);
    if (!dz) { setCreateErr("Pick a subject"); return; }
    if (!cBody.trim()) { setCreateErr("Enter the question text"); return; }

    const built = buildPayloadAnswer(cType, ed);
    if ("error" in built) { setCreateErr(built.error); return; }

    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        hierarchy: { [dz.key]: dz.id },
        type: cType,
        difficulty: cDiff,
        body: cBody.trim(),
        payload: built.payload,
        answerKey: built.answerKey,
        defaultMarks: parseInt(cMarks, 10) || 1,
        defaultNegativeMarks: parseInt(cNeg, 10) || 0,
      };
      if (cExplain.trim()) body.explanation = cExplain.trim();
      const tags = cTags.split(",").map((t) => t.trim()).filter(Boolean);
      if (tags.length) body.tags = tags;
      const { source, cognitiveLevel } = buildClassification(cClass);
      if (source) body.source = source;
      const meta: Record<string, unknown> = {};
      if (cognitiveLevel) meta.cognitiveLevel = cognitiveLevel;
      const lv = parseLangVariants(cLangVariants);
      if (Object.keys(lv).length) meta.languageVariants = lv;
      if (Object.keys(meta).length) body.metadata = meta;
      if (cImageUrl) body.imageUrls = [cImageUrl];

      const res = await api.post<{ question: BankQuestion }>("/tenant/question-bank", body, { tenant: tenant.slug });
      setQuestions((prev) => [res.question, ...prev]);
      loadCounts(tenant.slug);
      setCreateMsg("Question added as draft. Verify it to make it available for generation.");
      setCBody(""); setCExplain(""); setCTags(""); setEd(emptyEditor); setCClass(emptyClassification); setCImageUrl(""); setCLangVariants("");
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Failed to create question");
    } finally {
      setCreating(false);
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────────

  async function startEdit(id: string) {
    if (!tenant) return;
    setShowCreate(false);
    setEditingId(id); setEditErr(""); setEditLoading(true);
    try {
      const { question: q } = await api.get<{ question: BankQuestionFull }>(`/tenant/question-bank/${id}`, { tenant: tenant.slug });
      setEType(q.type); setEDiff(q.difficulty); setEBody(q.body);
      setEMarks(String(q.defaultMarks)); setENeg(String(q.defaultNegativeMarks));
      setEExplain(q.explanation ?? ""); setETags((q.tags ?? []).join(", "));
      setEEd(parseToEditor(q.type, q.payload, q.answerKey));
      setEClass(parseClassification(q.source, q.metadata));
      setEMetadata(q.metadata ?? null);
      setEImageUrl(q.imageUrls?.[0] ?? "");
      setELangVariants(serializeLangVariants(q.metadata?.languageVariants));
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : "Failed to load question");
    } finally {
      setEditLoading(false);
    }
  }

  function cancelEdit() {
    setEditingId(null); setEditErr("");
  }

  // ── Preview (read-only) ─────────────────────────────────────────────────────────

  async function openPreview(id: string) {
    if (!tenant) return;
    setPreviewId(id); setPreviewQ(null); setPreviewLoading(true);
    try {
      const { question } = await api.get<{ question: BankQuestionFull }>(`/tenant/question-bank/${id}`, { tenant: tenant.slug });
      setPreviewQ(question);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to load question");
      setPreviewId(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !editingId) return;
    setEditErr("");
    if (!eBody.trim()) { setEditErr("Enter the question text"); return; }
    const built = buildPayloadAnswer(eType, eEd);
    if ("error" in built) { setEditErr(built.error); return; }

    setEditLoading(true);
    try {
      const body: Record<string, unknown> = {
        difficulty: eDiff,
        body: eBody.trim(),
        payload: built.payload,
        answerKey: built.answerKey,
        defaultMarks: parseInt(eMarks, 10) || 1,
        defaultNegativeMarks: parseInt(eNeg, 10) || 0,
        explanation: eExplain.trim() || null,
        tags: eTags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      const { source, cognitiveLevel } = buildClassification(eClass);
      body.source = source ?? null;
      const meta = { ...(eMetadata ?? {}) };
      if (cognitiveLevel) meta.cognitiveLevel = cognitiveLevel;
      else delete meta.cognitiveLevel;
      const lv = parseLangVariants(eLangVariants);
      if (Object.keys(lv).length) meta.languageVariants = lv;
      else delete meta.languageVariants;
      body.metadata = Object.keys(meta).length ? meta : null;
      body.imageUrls = eImageUrl ? [eImageUrl] : null;

      const res = await api.patch<{ question: BankQuestion }>(`/tenant/question-bank/${editingId}`, body, { tenant: tenant.slug });
      setQuestions((prev) => prev.map((x) => (x.id === editingId ? res.question : x)));
      setEditingId(null);
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : "Failed to save question");
    } finally {
      setEditLoading(false);
    }
  }

  // ── Table columns ─────────────────────────────────────────────────────────────

  const columns: Column<BankQuestion>[] = [
    {
      key: "q",
      label: "Question",
      render: (q) => (
        <div style={{ maxWidth: 460 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
            <Badge tone="accent">{TYPE_LABEL[q.type] ?? q.type}</Badge>
            <Badge tone={DIFF_TONE[q.difficulty.toLowerCase()] ?? "neutral"}>{q.difficulty}</Badge>
            {q.isVerified && (
              <span style={{ fontSize: 10, color: "var(--success)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <Icon name="check-circle" size={12} /> Verified
              </span>
            )}
            {q.tenantId === null && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>(global)</span>}
          </div>
          <div style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 13.5, lineHeight: 1.5, color: "var(--text-heading)" }}>
            <MathText text={q.body} />
          </div>
        </div>
      ),
    },
    { key: "status", label: "Status", width: 100, render: (q) => <Badge tone={STATUS_TONE[q.status]}>{q.status}</Badge> },
    {
      key: "act",
      label: "",
      width: 48,
      render: (q) => {
        const owned = tenant ? q.tenantId === tenant.id : false;
        const acting = actingId === q.id;
        const items: KebabItem[] = [
          { label: "View", icon: "file-text", onClick: () => openPreview(q.id) },
        ];
        if (owned) {
          items.push({ label: "Edit", icon: "settings", disabled: acting, onClick: () => startEdit(q.id) });
          if (q.status !== "active") items.push({ label: "Verify", icon: "check-circle", disabled: acting, onClick: () => rowAction(q, "verify") });
          if (q.status !== "flagged") items.push({ label: "Flag", icon: "bell", disabled: acting, onClick: () => flagRow(q) });
          if (q.status !== "archived") items.push({ label: "Archive", icon: "log-out", danger: true, disabled: acting, onClick: () => rowAction(q, "archive") });
        }
        return (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <KebabMenu items={items} ariaLabel="Question actions" />
          </div>
        );
      },
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading || !user || !tenant) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text-muted)" }}>
        Loading…
      </div>
    );
  }

  const modalOpen = showCreate || editingId !== null;
  const canEdit = user.role === "coaching_owner" || user.role === "teacher";
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  // Client-side pagination over the filtered result set.
  const pageCount = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = questions.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <TeacherShell tenant={tenant} user={user} active="question-bank" headerless>
      <div style={{ position: "absolute", inset: 0, display: "flex", minHeight: 0 }}>
        {/* Left: subject filter (collapsible) */}
        {sidebarOpen ? (
          <aside style={{ width: 270, flexShrink: 0, borderRight: "1px solid var(--border-light)", background: "var(--surface-card)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-muted)" }}>Hierarchy</div>
              <button
                onClick={() => setSidebarOpen(false)}
                title="Collapse subjects"
                aria-label="Collapse subjects"
                style={{ width: 26, height: 26, border: "1px solid var(--border-light)", borderRadius: 6, background: "var(--surface-card)", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Icon name="chevron-down" size={15} style={{ transform: "rotate(90deg)" }} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 8px" }}>
              <HierarchyTree
                key={treeVersion}
                tenantSlug={tenant.slug}
                subjects={subjects}
                counts={counts}
                totalCount={totalCount}
                selected={selNode}
                onSelect={setSelNode}
              />
            </div>
            <div style={{ padding: 10, borderTop: "1px solid var(--border-light)", flexShrink: 0 }}>
              <Button variant="secondary" size="sm" onClick={() => setShowHierarchy(true)} style={{ width: "100%" }}>Manage hierarchy</Button>
            </div>
          </aside>
        ) : (
          <div style={{ width: 46, flexShrink: 0, borderRight: "1px solid var(--border-light)", background: "var(--surface-card)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12, gap: 12 }}>
            <button
              onClick={() => setSidebarOpen(true)}
              title="Expand subjects"
              aria-label="Expand subjects"
              style={{ width: 30, height: 30, border: "1px solid var(--border-light)", borderRadius: 6, background: "var(--surface-card)", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Icon name="chevron-down" size={16} style={{ transform: "rotate(-90deg)" }} />
            </button>
            <div style={{ writingMode: "vertical-rl", fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-muted)" }}>Hierarchy</div>
          </div>
        )}

        {/* Right: toolbar + filters + table */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <div style={{ padding: "13px 24px", borderBottom: "1px solid var(--border-light)", background: "var(--surface-card)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-muted)" }}>Content</div>
              <h2 style={{ margin: 0, fontSize: 20, letterSpacing: "-0.02em" }}>Question Bank</h2>
            </div>
            <Button variant="app" size="sm" icon={<Icon name="plus" size={14} />} onClick={openCreate}>Add question</Button>
          </div>

          <div style={{ padding: "10px 24px", borderBottom: "1px solid var(--border-light)", background: "var(--paper-50)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
            <Select value={fType} onChange={(e) => setFType(e.target.value)} wrapperStyle={{ width: 160 }}
              options={[{ value: "", label: "All types" }, ...QUESTION_TYPES.map(([k, l]) => ({ value: k, label: l }))]} />
            <Select value={fDiff} onChange={(e) => setFDiff(e.target.value)} wrapperStyle={{ width: 150 }}
              options={[{ value: "", label: "All difficulty" }, ...DIFFICULTIES.map((d) => ({ value: d, label: d }))]} />
            <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} wrapperStyle={{ width: 140 }}
              options={[{ value: "", label: "All status" }, ...STATUSES.map((s) => ({ value: s, label: s }))]} />
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-body)", cursor: "pointer", whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={fVerified} onChange={(e) => setFVerified(e.target.checked)} style={{ accentColor: "var(--accent)", width: 15, height: 15 }} /> Verified only
            </label>
            <div style={{ position: "relative", flex: 1, minWidth: 180, maxWidth: 260 }}>
              <Icon name="search" size={14} style={{ position: "absolute", left: 10, top: 12, color: "var(--text-muted)", pointerEvents: "none" }} />
              <input
                className="gv-input"
                placeholder="Search questions…"
                value={fSearch}
                onChange={(e) => setFSearch(e.target.value)}
                style={{ height: 36, paddingLeft: 30, fontSize: 13 }}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
            {selNode && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "var(--accent-soft)", borderRadius: 999, padding: "4px 6px 4px 11px" }}>
                <span style={{ opacity: 0.7, textTransform: "capitalize", fontWeight: 500 }}>{selNode.level}:</span>
                <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selNode.name}</span>
                <button onClick={() => setSelNode(null)} title="Clear scope" aria-label="Clear hierarchy scope" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--accent)", fontSize: 15, lineHeight: 1, display: "flex", alignItems: "center", padding: "0 2px" }}>×</button>
              </span>
            )}
            <div style={{ flex: 1 }} />
            {listLoading && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</span>}
            <Badge tone="neutral">{questions.length} questions</Badge>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 24px" }}>
            {pageError && (
              <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>{pageError}</p>
            )}
            {listLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading questions…</div>
            ) : questions.length === 0 ? (
              <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No questions match. Add one to get started.</div>
            ) : (
              <>
                <DataTable columns={columns} rows={pageRows} onRowClick={(q) => openPreview(q.id)} />
                {pageCount > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
                    <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                      Showing {pageStart + 1}–{pageStart + pageRows.length} of {questions.length}
                    </span>
                    <div style={{ flex: 1 }} />
                    <Button variant="secondary" size="sm" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      <Icon name="chevron-down" size={14} style={{ transform: "rotate(90deg)" }} /> Prev
                    </Button>
                    <span style={{ fontSize: 12.5, color: "var(--text-body)", whiteSpace: "nowrap" }}>Page {safePage} of {pageCount}</span>
                    <Button variant="secondary" size="sm" disabled={safePage >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
                      Next <Icon name="chevron-down" size={14} style={{ transform: "rotate(-90deg)" }} />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => { setShowCreate(false); cancelEdit(); }} style={{ position: "absolute", inset: 0, background: "rgba(11,16,32,.55)" }} />
          <div style={{ position: "relative", zIndex: 1, width: 760, maxWidth: "92vw", maxHeight: "90vh", background: "var(--surface-card)", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,.32)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
              <h4 style={{ margin: 0, flex: 1, fontSize: 17, color: "var(--text-heading)" }}>{editingId ? "Edit question" : "Add question"}</h4>
              <button onClick={() => { setShowCreate(false); cancelEdit(); }} style={{ width: 30, height: 30, border: "1px solid var(--border-light)", borderRadius: 6, background: "var(--surface-card)", cursor: "pointer", fontSize: 18, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
            </div>

            {editingId ? (
              editLoading && !eBody ? (
                <div style={{ padding: 24, fontSize: 13, color: "var(--text-muted)" }}>Loading…</div>
              ) : (
                <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                  <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <Field label="Type"><input value={TYPE_LABEL[eType] ?? eType} disabled className="gv-input" style={{ height: 36, background: "var(--surface-inset)" }} /></Field>
                      <Field label="Difficulty">
                        <select value={eDiff} onChange={(e) => setEDiff(e.target.value)} className="gv-select" style={{ height: 36 }}>
                          {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </Field>
                      <Field label="Marks"><input type="number" min={1} max={1000} value={eMarks} onChange={(e) => setEMarks(e.target.value)} className="gv-input" style={{ width: 70, height: 36 }} /></Field>
                      <Field label="Neg."><input type="number" min={0} max={1000} value={eNeg} onChange={(e) => setENeg(e.target.value)} className="gv-input" style={{ width: 70, height: 36 }} /></Field>
                    </div>
                    <div>
                      <span className="gv-label">Question text *</span>
                      <textarea value={eBody} onChange={(e) => setEBody(e.target.value)} rows={3} className="gv-input" style={{ height: "auto", padding: "10px 14px", resize: "vertical" }} />
                    </div>
                    <QuestionEditor type={eType} ed={eEd} setEd={setEEd} />
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <Field label="Explanation (optional)"><input value={eExplain} onChange={(e) => setEExplain(e.target.value)} className="gv-input" style={{ width: 320, height: 36 }} /></Field>
                      <Field label="Tags (comma separated)"><input value={eTags} onChange={(e) => setETags(e.target.value)} className="gv-input" style={{ width: 220, height: 36 }} /></Field>
                    </div>
                    <QuestionClassification value={eClass} onChange={setEClass} />
                    <ImageUpload label="Question image (optional)" getSignature={makeTenantUploadSigner("question", editingId ?? "bank")} value={eImageUrl || null} onChange={(url) => setEImageUrl(url)} />
                    <Field label="Language variants (optional — one per line, e.g. “hi: …”)">
                      <textarea value={eLangVariants} onChange={(e) => setELangVariants(e.target.value)} rows={2} className="gv-input" style={{ width: 420, height: "auto", padding: "8px 12px", resize: "vertical" }} />
                    </Field>
                    <p style={{ fontSize: 12, color: "#b45309", margin: 0 }}>Editing the options/answer clears verification — you&apos;ll need to re-verify before it re-enters generation.</p>
                  </div>
                  <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-light)", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                    {editErr && <span style={{ fontSize: 12, color: "var(--danger)" }}>{editErr}</span>}
                    <div style={{ flex: 1 }} />
                    <Button type="button" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                    <Button type="submit" variant="app" disabled={editLoading}>{editLoading ? "Saving…" : "Save changes"}</Button>
                  </div>
                </form>
              )
            ) : (
              <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
                  <div>
                    <span className="gv-label">Hierarchy *</span>
                    <HierarchyPicker tenantSlug={tenant.slug} subjects={subjects} value={cPath} onChange={setCPath} />
                    <p className="gv-help">Subject is required. Tagging down to a chapter/concept lets you generate concept-specific tests later.</p>
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <Field label="Type">
                      <select value={cType} onChange={(e) => { setCType(e.target.value); setEd(emptyEditor); }} className="gv-select" style={{ height: 36 }}>
                        {QUESTION_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </Field>
                    <Field label="Difficulty">
                      <select value={cDiff} onChange={(e) => setCDiff(e.target.value)} className="gv-select" style={{ height: 36 }}>
                        {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </Field>
                    <Field label="Marks"><input type="number" min={1} max={1000} value={cMarks} onChange={(e) => setCMarks(e.target.value)} className="gv-input" style={{ width: 70, height: 36 }} /></Field>
                    <Field label="Neg."><input type="number" min={0} max={1000} value={cNeg} onChange={(e) => setCNeg(e.target.value)} className="gv-input" style={{ width: 70, height: 36 }} /></Field>
                  </div>
                  <div>
                    <span className="gv-label">Question text *</span>
                    <textarea value={cBody} onChange={(e) => setCBody(e.target.value)} rows={3} className="gv-input" style={{ height: "auto", padding: "10px 14px", resize: "vertical" }} />
                  </div>
                  <QuestionEditor type={cType} ed={ed} setEd={setEd} />
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <Field label="Explanation (optional)"><input value={cExplain} onChange={(e) => setCExplain(e.target.value)} className="gv-input" style={{ width: 320, height: 36 }} /></Field>
                    <Field label="Tags (comma separated)"><input value={cTags} onChange={(e) => setCTags(e.target.value)} placeholder="jee, formula" className="gv-input" style={{ width: 220, height: 36 }} /></Field>
                  </div>
                  <QuestionClassification value={cClass} onChange={setCClass} />
                  <ImageUpload label="Question image (optional)" getSignature={makeTenantUploadSigner("question", deepestId(cPath)?.id ?? "bank")} value={cImageUrl || null} onChange={(url) => setCImageUrl(url)} />
                  <Field label="Language variants (optional — one per line, e.g. “hi: …”)">
                    <textarea value={cLangVariants} onChange={(e) => setCLangVariants(e.target.value)} rows={2} placeholder="hi: प्रश्न का अनुवाद" className="gv-input" style={{ width: 420, height: "auto", padding: "8px 12px", resize: "vertical" }} />
                  </Field>
                </div>
                <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-light)", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                  {createErr && <span style={{ fontSize: 12, color: "var(--danger)" }}>{createErr}</span>}
                  {createMsg && <span style={{ fontSize: 12, color: "var(--success)" }}>{createMsg}</span>}
                  <div style={{ flex: 1 }} />
                  <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Close</Button>
                  <Button type="submit" variant="app" disabled={creating}>{creating ? "Adding…" : "Add question"}</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Question preview (read-only, KaTeX-rendered) */}
      {previewId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setPreviewId(null)} style={{ position: "absolute", inset: 0, background: "rgba(11,16,32,.55)" }} />
          <div style={{ position: "relative", zIndex: 1, width: 720, maxWidth: "92vw", maxHeight: "90vh", background: "var(--surface-card)", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,.32)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
              <h4 style={{ margin: 0, flex: 1, fontSize: 16, color: "var(--text-heading)" }}>Question preview</h4>
              {previewQ && previewQ.tenantId === tenant.id && (
                <Button variant="secondary" size="sm" onClick={() => { const id = previewId; setPreviewId(null); if (id) startEdit(id); }}>Edit</Button>
              )}
              <button onClick={() => setPreviewId(null)} style={{ width: 30, height: 30, border: "1px solid var(--border-light)", borderRadius: 6, background: "var(--surface-card)", cursor: "pointer", fontSize: 18, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: "22px 24px", overflowY: "auto" }}>
              {previewLoading || !previewQ ? (
                <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>
              ) : (
                <QuestionPreview
                  q={{
                    type: previewQ.type,
                    body: previewQ.body,
                    payload: previewQ.payload,
                    answerKey: previewQ.answerKey,
                    difficulty: previewQ.difficulty,
                    marks: previewQ.defaultMarks,
                    negativeMarks: previewQ.defaultNegativeMarks,
                    explanation: previewQ.explanation,
                    imageUrls: previewQ.imageUrls,
                    isVerified: previewQ.isVerified,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manage hierarchy drawer (Subject → Module → Chapter → Section → Concept) */}
      {showHierarchy && (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={() => setShowHierarchy(false)} style={{ position: "absolute", inset: 0, background: "rgba(11,16,32,.55)" }} />
          <div style={{ position: "relative", zIndex: 1, width: 640, maxWidth: "94vw", height: "100vh", background: "var(--bg-page)", boxShadow: "-24px 0 80px rgba(0,0,0,.32)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-light)", background: "var(--surface-card)", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-muted)" }}>Content</div>
                <h3 style={{ margin: 0, fontSize: 18, letterSpacing: "-0.02em", color: "var(--text-heading)" }}>Subjects &amp; Hierarchy</h3>
              </div>
              <button onClick={() => setShowHierarchy(false)} title="Close" style={{ width: 30, height: 30, border: "1px solid var(--border-light)", borderRadius: 6, background: "var(--surface-card)", cursor: "pointer", fontSize: 18, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
              <HierarchyManager
                tenantSlug={tenant.slug}
                canEdit={canEdit}
                onSubjectsChange={() => { loadSubjects(tenant.slug); loadCounts(tenant.slug); setTreeVersion((v) => v + 1); }}
              />
            </div>
          </div>
        </div>
      )}
    </TeacherShell>
  );
}
