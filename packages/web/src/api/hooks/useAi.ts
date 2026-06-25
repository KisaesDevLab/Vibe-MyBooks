// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskOption, TaskOptions, AiFunctionKey, ExtractionOptions } from '@kis-books/shared';
import { apiClient, isApiError } from '../client';
import { useToast } from '../../components/ui/Toaster';

export type { TaskOption, TaskOptions, AiFunctionKey, ExtractionOptions };

// Human-readable label per task — used as the lead-in for AI error
// toasts. Keeps the call sites terse and the toast surface uniform
// across categorization, OCR, statement parsing, and document
// classification.
type AiTaskLabel = 'AI categorization' | 'Receipt OCR' | 'Bill OCR' | 'Statement parsing' | 'Document classification';

const PROVIDER_FAILED_MSG = 'Every configured AI provider failed. Check the test buttons in System Settings → AI.';
const CONSENT_REQUIRED_MSG = 'Consent required — accept the AI disclosure on your company before this task can run.';
const BUDGET_EXCEEDED_MSG = 'Monthly AI budget exceeded. Raise the limit in System Settings → AI.';
const AI_DISABLED_MSG = 'AI is currently disabled for this workspace.';

// Translate a server-supplied error `code` into a user-facing reason.
// Unrecognised codes fall through to the verbatim server message.
const REASON_BY_CODE: Record<string, string> = {
  ai_disabled_globally: 'AI processing is disabled by an administrator.',
  ai_no_provider_configured: 'No provider is configured for this task. An administrator must pick one.',
  ai_consent_required: CONSENT_REQUIRED_MSG,
  consent_missing: CONSENT_REQUIRED_MSG,
  ai_budget_exceeded: BUDGET_EXCEEDED_MSG,
  AI_BUDGET_EXCEEDED: BUDGET_EXCEEDED_MSG,
  ai_parse_failed: 'The AI returned non-JSON. Try again, or pick a different provider in System Settings → AI.',
  ai_all_providers_failed: PROVIDER_FAILED_MSG,
  ai_provider_failed: PROVIDER_FAILED_MSG,
  ai_categorization_failed: PROVIDER_FAILED_MSG,
  AI_RATE_LIMIT: 'Too many AI requests in a short window. Slow down and retry.',
  AI_DISABLED: AI_DISABLED_MSG,
  CHAT_DISABLED: AI_DISABLED_MSG,
};

function reasonForCode(code: string | undefined, fallback: string): string {
  return (code && REASON_BY_CODE[code]) || fallback;
}

/** Shared onError factory for AI mutations. Always surfaces a toast with
 *  the resolved reason as the headline and the raw `code` as the small
 *  monospace detail line so support tickets can include it verbatim. */
function useAiErrorToast(label: AiTaskLabel) {
  const toast = useToast();
  return (err: unknown) => {
    const code = isApiError(err) ? err.code : undefined;
    const rawMessage = err instanceof Error ? err.message : String(err);
    toast.error(`${label} failed — ${reasonForCode(code, rawMessage)}`, {
      detail: code,
    });
  };
}

// ─── Admin config ────────────────────────────────────────────────
//
// /ai/admin/config returns the full per-installation AI configuration.
// The shape mirrors `getConfig()` in packages/api/src/services/ai-config.service.ts
// — if that function adds/renames fields, the server is the source of
// truth; update this interface to match.
export type AiProviderName =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'ollama'
  // Any server that exposes the OpenAI-compatible `/v1/chat/completions`
  // endpoint — Ollama's /v1 interface, llama.cpp's built-in server, LM
  // Studio, vLLM, etc. Configured via openaiCompatBaseUrl /
  // openaiCompatModel / openaiCompatApiKey.
  | 'openai_compat';
export type PiiProtectionLevel = 'strict' | 'standard' | 'permissive';
export type ChatDataAccessLevel = 'none' | 'contextual' | 'full';

/** Per-provider memo of the most recent /admin/test/:provider result.
 *  Lets the admin UI render "Last verified <relative time>" next to
 *  each provider card without re-pinging the upstream on every load. */
export interface ProviderTestRecord {
  verifiedAt: string;
  success: boolean;
  modelInfo?: string;
  error?: string;
}

export interface AiConfigDto {
  /** Persisted test results keyed by provider name. */
  providerTestHistory: Record<string, ProviderTestRecord>;
  isEnabled: boolean;
  categorizationProvider: AiProviderName | null;
  categorizationModel: string | null;
  ocrProvider: AiProviderName | null;
  ocrModel: string | null;
  documentClassificationProvider: AiProviderName | null;
  documentClassificationModel: string | null;
  fallbackChain: string[];
  hasAnthropicKey: boolean;
  hasOpenaiKey: boolean;
  hasGeminiKey: boolean;
  ollamaBaseUrl: string | null;
  openaiCompatBaseUrl: string | null;
  openaiCompatModel: string | null;
  openaiCompatMode?: 'auto' | 'native' | 'compat';
  hasOpenaiCompatKey: boolean;
  // GLM-OCR engine (statement-import pipeline). Dedicated llama.cpp OCR server.
  glmOcrEnabled: boolean;
  glmOcrBaseUrl: string | null;
  glmOcrModel: string | null;
  glmOcrPrompt: string | null;
  glmOcrTimeoutMs: number | null;
  glmOcrConcurrency: number | null;
  glmOcrForceOcr: boolean;
  glmOcrRenderDpi: number | null;
  hasGlmOcrKey: boolean;
  // Stage-2 statement extraction LLM (OCR markdown → JSON).
  statementExtractionProvider: 'local' | 'anthropic';
  statementExtractionModel: string | null;
  autoCategorizeOnImport: boolean;
  autoOcrOnUpload: boolean;
  categorizationConfidenceThreshold: number;
  maxConcurrentJobs: number;
  trackUsage: boolean;
  monthlyBudgetLimit: number | null;
  chatSupportEnabled: boolean;
  chatProvider: AiProviderName | null;
  chatModel: string | null;
  chatMaxHistory: number;
  chatDataAccessLevel: ChatDataAccessLevel;
  piiProtectionLevel: PiiProtectionLevel;
  cloudVisionEnabled: boolean;
  /** Per-function ("task") settings overlay, keyed by AI function.
   *  Each field is a nullable OVERRIDE — null/absent means "use the
   *  built-in default". Stored server-side in ai_config.task_options. */
  taskOptions: TaskOptions;
  /** Top-level overrides for the local document-extraction pipeline
   *  (DOCUMENT_EXTRACTION_V1). Each field is a nullable OVERRIDE —
   *  null/absent means "use the server's EXTRACTION_* env default".
   *  Separate from per-function taskOptions. */
  extractionOptions: ExtractionOptions;
  adminDisclosureAcceptedAt: string | null;
  adminDisclosureAcceptedBy: string | null;
  disclosureVersion: number;
}

// Mutation input mirrors the server's `aiConfigUpdateSchema` (shared/
// schemas/ai.ts). Every field is optional; unset keys mean "don't
// touch" on the server. Plaintext API keys are write-only (the server
// encrypts; reads return `hasXKey` booleans).
//
// Chat settings are intentionally NOT part of this payload — they flow
// through the separate `PUT /chat/admin/config` endpoint (see
// ChatSettingsSection in AiConfigPage). Adding them here would make
// them round-trip through `/ai/admin/config` where the Zod schema
// strips unknown keys.
export interface UpdateAiConfigInput {
  isEnabled?: boolean;
  categorizationProvider?: AiProviderName | null;
  categorizationModel?: string | null;
  ocrProvider?: AiProviderName | null;
  ocrModel?: string | null;
  documentClassificationProvider?: AiProviderName | null;
  documentClassificationModel?: string | null;
  fallbackChain?: string[];
  anthropicApiKey?: string | null;
  openaiApiKey?: string | null;
  geminiApiKey?: string | null;
  ollamaBaseUrl?: string | null;
  openaiCompatApiKey?: string | null;
  openaiCompatBaseUrl?: string | null;
  openaiCompatModel?: string | null;
  openaiCompatMode?: 'auto' | 'native' | 'compat';
  // GLM-OCR engine. apiKey is write-only (3-state: null clears, blank no-op).
  glmOcrEnabled?: boolean;
  glmOcrBaseUrl?: string | null;
  glmOcrApiKey?: string | null;
  glmOcrModel?: string | null;
  glmOcrPrompt?: string | null;
  glmOcrTimeoutMs?: number | null;
  glmOcrConcurrency?: number | null;
  glmOcrForceOcr?: boolean;
  glmOcrRenderDpi?: number | null;
  statementExtractionProvider?: 'local' | 'anthropic';
  statementExtractionModel?: string | null;
  autoCategorizeOnImport?: boolean;
  autoOcrOnUpload?: boolean;
  categorizationConfidenceThreshold?: number;
  maxConcurrentJobs?: number;
  trackUsage?: boolean;
  monthlyBudgetLimit?: number | null;
  piiProtectionLevel?: PiiProtectionLevel;
  cloudVisionEnabled?: boolean;
  // Per-function overrides; deep-merged server-side. Send only the
  // changed function/keys. Blank inputs should be sent as null (or
  // omitted) to preserve "use the built-in default" semantics.
  taskOptions?: TaskOptions;
  // Document-extraction pipeline overrides; shallow-merged server-side.
  // Blank inputs should be sent as null to preserve "use the server's
  // environment default" semantics.
  extractionOptions?: ExtractionOptions;
}

export function useAiConfig() {
  return useQuery({
    queryKey: ['ai', 'config'],
    queryFn: () => apiClient<AiConfigDto>('/ai/admin/config'),
  });
}

/**
 * Feature-availability hook for AI features, safe for ALL authenticated
 * users (unlike useAiConfig which hits the super-admin-only endpoint).
 *
 * Returns booleans for each AI feature so pages can decide whether to
 * render the associated UI (bill OCR drop zone, receipt camera, etc.)
 * without needing to know about API keys or provider configuration.
 */
export interface AiStatus {
  isEnabled: boolean;
  hasBillOcr: boolean;
  hasReceiptOcr: boolean;
  hasCategorization: boolean;
  hasStatementParser: boolean;
  hasDocumentClassifier: boolean;
}

export function useAiStatus() {
  return useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => apiClient<AiStatus>('/ai/status'),
    // Status rarely changes during a session, so a longer stale time
    // avoids hammering the endpoint on every page navigation.
    staleTime: 60_000,
  });
}

// Per-task, per-provider readiness view for company owners. Pulled from
// the cached `provider_test_history` (no upstream calls), so the page
// is safe to surface to non-admin users.
export interface AiDiagnosticsRow {
  task: 'categorization' | 'ocr' | 'document_classification' | 'chat';
  provider: string | null;
  status: 'configured' | 'not_configured' | 'untested' | 'ok' | 'failed';
  lastVerifiedAt?: string;
  modelInfo?: string;
  error?: string;
}
export interface AiDiagnosticsDto {
  systemEnabled: boolean;
  rows: AiDiagnosticsRow[];
}
export function useAiDiagnostics() {
  return useQuery({
    queryKey: ['ai', 'diagnostics'],
    queryFn: () => apiClient<AiDiagnosticsDto>('/ai/diagnostics'),
    staleTime: 30_000,
  });
}

export function useUpdateAiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAiConfigInput) =>
      apiClient<AiConfigDto>('/ai/admin/config', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai'] }),
  });
}

// Shape from ai-providers/ai-provider.interface.ts → testConnection()
export interface TestProviderResult {
  success: boolean;
  error?: string;
  modelInfo?: string;
}

export function useTestAiProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: AiProviderName | string) =>
      apiClient<TestProviderResult>(`/ai/admin/test/${provider}`, { method: 'POST' }),
    // Persist the result to provider_test_history server-side, then
    // invalidate the diagnostics + config queries so the non-admin
    // /settings/ai/diagnostics page and the admin's "Last verified …"
    // line both reflect the fresh result without a manual refresh.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai', 'config'] });
      qc.invalidateQueries({ queryKey: ['ai', 'diagnostics'] });
    },
  });
}

// Test the GLM-OCR statement engine (health probe + 1-page sample OCR).
export function useTestGlmOcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient<TestProviderResult>('/ai/admin/test-glm-ocr', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai', 'config'] });
      qc.invalidateQueries({ queryKey: ['ai', 'diagnostics'] });
    },
  });
}

// Shape from POST /ai/admin/test-function/:fn — runs a REAL end-to-end
// completion for the given function (unlike test/:provider which only
// checks reachability). `error` surfaces the actual per-provider failure
// detail so the admin can see why a function isn't working.
export interface TestFunctionResult {
  success: boolean;
  provider: string | null;
  error?: string;
  modelInfo?: string;
  durationMs: number;
}

export function useTestAiFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fn: AiFunctionKey) =>
      apiClient<TestFunctionResult>(`/ai/admin/test-function/${fn}`, { method: 'POST' }),
    // Mirror useTestAiProvider: the server records the result, so refresh
    // the config + diagnostics views to reflect the fresh outcome.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai', 'config'] });
      qc.invalidateQueries({ queryKey: ['ai', 'diagnostics'] });
    },
  });
}

export function useAiCategorize() {
  const qc = useQueryClient();
  const onError = useAiErrorToast('AI categorization');
  return useMutation({
    mutationFn: (feedItemId: string) => apiClient('/ai/categorize', { method: 'POST', body: JSON.stringify({ feedItemId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-feed'] }),
    onError,
  });
}

export function useAiBatchCategorize() {
  const qc = useQueryClient();
  const onError = useAiErrorToast('AI categorization');
  return useMutation({
    mutationFn: (feedItemIds: string[]) => apiClient('/ai/categorize/batch', { method: 'POST', body: JSON.stringify({ feedItemIds }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-feed'] }),
    onError,
  });
}

export interface OcrReceiptResult {
  vendor?: string;
  date?: string;
  total?: string;
  tax?: string;
  confidence?: number | null;
  qualityWarnings?: string[];
  /** 'ok' when fields were extracted; 'ocr_only' when only `rawText`
   *  is available (OCR ran without a downstream text LLM). The
   *  ReceiptCaptureModal renders `rawText` in a textarea so the user can
   *  still complete the expense manually. */
  status?: 'ok' | 'ocr_only';
  rawText?: string;
}

export function useAiOcrReceipt() {
  const onError = useAiErrorToast('Receipt OCR');
  return useMutation({
    mutationFn: (attachmentId: string) =>
      apiClient<OcrReceiptResult>('/ai/ocr/receipt', { method: 'POST', body: JSON.stringify({ attachmentId }) }),
    onError,
  });
}

export interface ParsedStatementTransaction {
  date: string;
  description: string;
  amount: string;
  type?: string;
  [key: string]: unknown;
}

export interface StatementReconciliationDto {
  status: 'verified' | 'discrepancy' | 'skipped';
  deltaCents: number;
  expectedClosingCents: number | null;
  actualClosingCents: number | null;
  repaired: boolean;
  fixDescription?: string;
}

export interface ParsedStatement {
  transactions?: ParsedStatementTransaction[];
  accountNumberMasked?: string | null;
  statementPeriod?: { start?: string; end?: string } | string | null;
  openingBalance?: string | null;
  closingBalance?: string | null;
  confidence?: number | null;
  qualityWarnings?: string[];
  // Statement-import redesign: detect→OCR→extract→reconcile signals.
  extractionSource?: string;
  reconciliation?: StatementReconciliationDto;
  suspectRows?: Array<{ index: number; deltaCents: number }>;
  notes?: string | null;
}

export function useAiParseStatement() {
  const onError = useAiErrorToast('Statement parsing');
  return useMutation({
    mutationFn: (attachmentId: string) =>
      apiClient<ParsedStatement>('/ai/parse/statement', { method: 'POST', body: JSON.stringify({ attachmentId }) }),
    onError,
  });
}

// Async statement parse: returns a jobId the caller follows over SSE.
export function useStartStatementParse() {
  return useMutation({
    mutationFn: (attachmentId: string) =>
      apiClient<{ jobId: string }>('/ai/parse/statement', { method: 'POST', body: JSON.stringify({ attachmentId }) }),
  });
}

export interface StatementProgressSnapshot {
  status: 'pending' | 'processing' | 'complete' | 'failed' | 'cancelled';
  stage: string | null;
  confidence: number | null;
  error: string | null;
  /** Present only on the terminal `complete` snapshot. */
  result: ParsedStatement | null;
}

/**
 * Consume the statement-parse SSE progress stream with fetch + a ReadableStream
 * reader (not EventSource, which can't send the Bearer auth header). Invokes
 * `onSnapshot` for each status snapshot; resolves when the stream closes.
 */
export async function streamStatementProgress(
  jobId: string,
  onSnapshot: (s: StatementProgressSnapshot) => void,
  signal?: AbortSignal,
  // Injectable for tests; defaults to the global fetch.
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const token = localStorage.getItem('accessToken');
  const res = await fetchImpl(`/api/v1/ai/parse/statement/${jobId}/progress`, {
    headers: { Authorization: `Bearer ${token ?? ''}`, Accept: 'text/event-stream' },
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Progress stream failed (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    // SSE frames are separated by a blank line ("\n\n").
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith(':')) continue; // heartbeat comment
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
      }
      if (dataLines.length === 0) continue;
      const payload = dataLines.join('\n');
      if (event === 'error') throw new Error(safeMessage(payload, 'Progress error'));
      if (event === 'timeout') throw new Error('Parsing timed out — please retry.');
      try {
        onSnapshot(JSON.parse(payload) as StatementProgressSnapshot);
      } catch {
        /* ignore an unparseable frame */
      }
    }
  }
}

/**
 * Poll the job status endpoint until terminal. Proxy-safe everywhere (plain
 * JSON GETs), unlike the SSE stream which a reverse proxy or the compression
 * middleware can buffer — so this is what the UI uses by default.
 */
export async function pollStatementProgress(
  jobId: string,
  onSnapshot: (s: StatementProgressSnapshot) => void,
  signal?: AbortSignal,
  intervalMs = 1200,
): Promise<void> {
  for (;;) {
    if (signal?.aborted) return;
    const snap = await apiClient<StatementProgressSnapshot>(`/ai/parse/statement/${jobId}/status`);
    if (signal?.aborted) return;
    onSnapshot(snap);
    if (snap.status === 'complete' || snap.status === 'failed' || snap.status === 'cancelled') return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

function safeMessage(json: string, fallback: string): string {
  try {
    const m = (JSON.parse(json) as { message?: string }).message;
    return m || fallback;
  } catch {
    return fallback;
  }
}

export interface ClassifiedDocument {
  documentType?: string;
  confidence?: number;
  [key: string]: unknown;
}

export function useAiClassify() {
  const onError = useAiErrorToast('Document classification');
  return useMutation({
    mutationFn: (attachmentId: string) =>
      apiClient<ClassifiedDocument>('/ai/classify', { method: 'POST', body: JSON.stringify({ attachmentId }) }),
    onError,
  });
}

// Shape from ai-orchestrator.service.getUsageSummary().
export interface AiUsageCounter { calls: number; cost: number }
export interface AiUsageDto {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  byProvider: Record<string, AiUsageCounter>;
  byJobType: Record<string, AiUsageCounter>;
}

export function useAiUsage(months?: number) {
  return useQuery({
    queryKey: ['ai', 'usage', months],
    queryFn: () => apiClient<AiUsageDto>(`/ai/usage?months=${months || 1}`),
  });
}

// Shape from ai-prompt.service.listPrompts() → ai_prompt_templates row.
// Kept loose on the less-critical fields — tsc won't complain if the
// admin UI only reads the ones it cares about.
export interface AiPromptTemplateRow {
  id: string;
  taskType: string;
  provider: string | null;
  version: number;
  systemPrompt: string;
  userPromptTemplate: string;
  outputSchema: unknown;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiPromptsDto {
  prompts: AiPromptTemplateRow[];
}

export function useAiPrompts() {
  return useQuery({
    queryKey: ['ai', 'prompts'],
    queryFn: () => apiClient<AiPromptsDto>('/ai/admin/prompts'),
  });
}

// The set of AI functions whose built-in system prompt can be overridden
// via a custom template. Shape from GET /ai/admin/prompts/task-types.
export interface AiPromptTaskType {
  taskType: string;
  label: string;
}

export interface AiPromptTaskTypesDto {
  taskTypes: AiPromptTaskType[];
}

export function useAiPromptTaskTypes() {
  return useQuery({
    queryKey: ['ai', 'prompt-task-types'],
    queryFn: () => apiClient<AiPromptTaskTypesDto>('/ai/admin/prompts/task-types'),
    // The list is static per build; cache aggressively to avoid refetching
    // on every open of the prompt editor.
    staleTime: 5 * 60_000,
  });
}

// ─── AI Disclosure / Consent (AI_PII_PROTECTION_ADDENDUM) ────────

export interface SystemDisclosureDto {
  version: number;
  textVersion: number;
  text: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
}

export function useSystemAiDisclosure() {
  return useQuery({
    queryKey: ['ai', 'admin', 'disclosure'],
    queryFn: () => apiClient<SystemDisclosureDto>('/ai/admin/disclosure'),
    staleTime: 60_000,
  });
}

export function useAcceptSystemAiDisclosure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient<SystemDisclosureDto>('/ai/admin/disclosure/accept', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai'] }),
  });
}

export type AiTaskKey = 'categorization' | 'receipt_ocr' | 'statement_parsing' | 'document_classification';

export interface TenantConsentCompanyRow {
  id: string;
  name: string;
  aiEnabled: boolean;
  acceptedVersion: number | null;
  acceptedAt: string | null;
  tasks: Record<AiTaskKey, boolean> | null;
  isStale: boolean;
}

export interface TenantConsentStatusDto {
  systemEnabled: boolean;
  systemDisclosureAccepted: boolean;
  systemVersion: number;
  piiProtectionLevel: string;
  categorizationProvider: string | null;
  ocrProvider: string | null;
  documentClassificationProvider: string | null;
  companies: TenantConsentCompanyRow[];
}

export function useAiConsentStatus() {
  return useQuery({
    queryKey: ['ai', 'consent'],
    queryFn: async () => (await apiClient<TenantConsentStatusDto>('/ai/consent')) ?? null,
    staleTime: 60_000,
  });
}

export interface CompanyDisclosureDto {
  companyId: string;
  companyName: string;
  systemVersion: number;
  acceptedVersion: number | null;
  acceptedAt: string | null;
  acceptedBy: string | null;
  aiEnabled: boolean;
  enabledTasks: Record<AiTaskKey, boolean>;
  currentConfig: {
    piiProtectionLevel: string;
    categorizationProvider: string | null;
    ocrProvider: string | null;
    documentClassificationProvider: string | null;
  };
  text: string;
  isStale: boolean;
}

export function useCompanyAiDisclosure(companyId: string | null) {
  return useQuery({
    queryKey: ['ai', 'consent', companyId, 'disclosure'],
    queryFn: () => apiClient<CompanyDisclosureDto>(`/ai/consent/${companyId}/disclosure`),
    enabled: !!companyId,
  });
}

export function useAcceptCompanyAiDisclosure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (companyId: string) =>
      apiClient<CompanyDisclosureDto>(`/ai/consent/${companyId}/accept`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai'] }),
  });
}

export function useRevokeCompanyAiConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (companyId: string) =>
      apiClient(`/ai/consent/${companyId}/revoke`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai'] }),
  });
}

export function useSetCompanyAiTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, tasks }: { companyId: string; tasks: Partial<Record<AiTaskKey, boolean>> }) =>
      apiClient<{ tasks: Record<AiTaskKey, boolean> }>(`/ai/consent/${companyId}/tasks`, {
        method: 'PATCH',
        body: JSON.stringify(tasks),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai'] }),
  });
}
