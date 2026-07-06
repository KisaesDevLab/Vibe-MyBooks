// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect, useId } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import {
  useAiConfig, useUpdateAiConfig, useTestAiProvider, useTestAiFunction,
  useSystemAiDisclosure, useAcceptSystemAiDisclosure, useAiPromptTaskTypes,
  useTestGlmOcr, useProviderModels, useGlmOcrModels,
} from '../../api/hooks/useAi';
import type { TaskOption, TaskOptions, AiFunctionKey, TestFunctionResult } from '../../api/hooks/useAi';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Brain, CheckCircle, AlertTriangle, XCircle, ShieldCheck, Lock } from 'lucide-react';

interface SelfTestRow {
  task: string;
  provider: string | null;
  success: boolean;
  error?: string;
  modelInfo?: string;
  latencyMs: number | null;
  skipped?: boolean;
  skipReason?: string;
}

type TestResult = { ok: boolean; msg: string };

// Maps `form` keys whose change should invalidate a cached test result
// to the provider keys it covers. A single useEffect below iterates this
// and clears any matching badges when the related fields change.
const PROVIDER_FIELD_DEPS: Array<{ fields: ReadonlyArray<string>; providers: ReadonlyArray<string> }> = [
  { fields: ['anthropicApiKey'], providers: ['anthropic'] },
  { fields: ['openaiApiKey'], providers: ['openai'] },
  { fields: ['geminiApiKey'], providers: ['gemini'] },
  { fields: ['ollamaBaseUrl'], providers: ['ollama'] },
  { fields: ['openaiCompatApiKey', 'openaiCompatBaseUrl', 'openaiCompatModel'], providers: ['openai_compat'] },
];

// Suggested self-hosted model tags. MiniCPM-V 4.5 is the default
// image-OCR model; listed first so it's the leading datalist suggestion.
const OLLAMA_MODEL_SUGGESTIONS = ['minicpm-v4.5:latest', 'qwen3.5:35b-a3b', 'llama3.2'];

const PROVIDERS = [
  { key: 'anthropic', label: 'Anthropic (Claude)', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'] },
  { key: 'openai', label: 'OpenAI (GPT)', models: ['gpt-4o', 'gpt-4o-mini'] },
  { key: 'gemini', label: 'Google (Gemini)', models: ['gemini-2.5-flash', 'gemini-2.5-pro'] },
  { key: 'ollama', label: 'Ollama (Self-Hosted)', models: OLLAMA_MODEL_SUGGESTIONS },
  // Generic OpenAI-compatible endpoint (Ollama /v1, llama.cpp server, LM
  // Studio, vLLM, or any cloud proxy that speaks the OpenAI chat API).
  // Model name is free-form and configured in the credentials section.
  { key: 'openai_compat', label: 'OpenAI-compatible (custom)', models: OLLAMA_MODEL_SUGGESTIONS },
];

// A model field: a free-text input backed by a datalist of REAL models fetched
// from the provider (so you can pick from a dropdown or type a custom id). The
// list is presentational; callers fetch it (useProviderModels / useGlmOcrModels)
// and pass it in, since hooks can't be called conditionally in a loop.
function ModelInput({ value, onChange, models, loading, listError, label, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  models: string[];
  loading?: boolean;
  listError?: string;
  label?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      {label !== undefined && label !== '' && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <input
        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={models.length > 0 ? id : undefined}
        placeholder={placeholder}
      />
      {models.length > 0 && <datalist id={id}>{models.map((m) => <option key={m} value={m} />)}</datalist>}
      <p className="text-xs text-gray-400 mt-1">
        {loading
          ? 'Loading models…'
          : models.length > 0
            ? `${models.length} model${models.length === 1 ? '' : 's'} available — pick or type a custom id`
            : listError
              ? 'Could not list models (check provider credentials/URL) — type a model id'
              : 'Type a model id'}
      </p>
    </div>
  );
}

// Task Assignment model field: calls the per-provider models hook for THIS
// row's provider and renders the ModelInput. Separate component so the hook
// isn't called inside the task .map().
function TaskModelField({ provider, value, onChange }: {
  provider: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { data, isFetching } = useProviderModels(provider || null);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
      <ModelInput
        value={value}
        onChange={onChange}
        models={data?.models ?? []}
        loading={isFetching}
        listError={data?.error}
        placeholder="pick or type a model id"
      />
    </div>
  );
}

// The four configurable AI functions ("tasks"). `showThreshold` gates the
// Confidence threshold control — chat has no confidence concept.
const TASK_FUNCTIONS: ReadonlyArray<{ key: AiFunctionKey; label: string; showThreshold: boolean }> = [
  // Display label only — the underlying task KEY stays `categorization`.
  { key: 'categorization', label: 'Transaction Categorization & Name Cleanup', showThreshold: true },
  { key: 'ocr', label: 'OCR', showThreshold: true },
  { key: 'document_classification', label: 'Document Classification', showThreshold: true },
  { key: 'chat', label: 'Chat', showThreshold: false },
];

// Coerce a per-function override draft into a clean payload: blank/unset
// numeric and text inputs become `null` (= "use the built-in default")
// rather than 0 or "". Booleans and selected enums pass through as-is.
// Returns null for a function with no overrides so it can be dropped.
function normalizeTaskOption(opt: TaskOption | undefined): TaskOption | null {
  if (!opt) return null;
  const normalized: TaskOption = {
    maxTokens: opt.maxTokens ?? null,
    temperature: opt.temperature ?? null,
    thinking: opt.thinking ?? null,
    timeoutMs: opt.timeoutMs ?? null,
    fallbackChain: opt.fallbackChain && opt.fallbackChain.length > 0 ? opt.fallbackChain : null,
    threshold: opt.threshold ?? null,
    piiLevel: opt.piiLevel ?? null,
    numCtx: opt.numCtx ?? null,
    // Batched categorization chunk size (categorization only); null = default.
    batchSize: opt.batchSize ?? null,
  };
  // Only include boolean overrides when explicitly set (a checkbox the
  // admin actually toggled) so we don't clobber the default with false.
  if (opt.enabled !== undefined && opt.enabled !== null) normalized.enabled = opt.enabled;
  if (opt.autoTrigger !== undefined && opt.autoTrigger !== null) normalized.autoTrigger = opt.autoTrigger;
  return normalized;
}

function normalizeTaskOptions(opts: TaskOptions): TaskOptions {
  const out: TaskOptions = {};
  for (const fn of TASK_FUNCTIONS) {
    const n = normalizeTaskOption(opts[fn.key]);
    if (n) out[fn.key] = n;
  }
  return out;
}

export function AiConfigPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useAiConfig();
  const updateConfig = useUpdateAiConfig();
  const testProvider = useTestAiProvider();
  const testGlmOcr = useTestGlmOcr();

  type PiiLevel = 'strict' | 'standard' | 'permissive';
  interface AiConfigFormState {
    isEnabled: boolean;
    categorizationProvider: string;
    categorizationModel: string;
    ocrProvider: string;
    ocrModel: string;
    anthropicApiKey: string;
    openaiApiKey: string;
    geminiApiKey: string;
    ollamaBaseUrl: string;
    openaiCompatBaseUrl: string;
    openaiCompatModel: string;
    openaiCompatApiKey: string;
    openaiCompatMode: 'auto' | 'native' | 'compat';
    glmOcrEnabled: boolean;
    glmOcrBaseUrl: string;
    glmOcrApiKey: string;
    glmOcrModel: string;
    glmOcrPrompt: string;
    glmOcrTimeoutMs: number | null;
    glmOcrConcurrency: number | null;
    glmOcrForceOcr: boolean;
    glmOcrRenderDpi: number | null;
    statementExtractionProvider: 'local' | 'anthropic';
    statementExtractionModel: string;
    autoCategorizeOnImport: boolean;
    autoOcrOnUpload: boolean;
    categorizationConfidenceThreshold: number;
    maxConcurrentJobs: number;
    monthlyBudgetLimit: number | null;
    piiProtectionLevel: PiiLevel;
    cloudVisionEnabled: boolean;
  }

  const [form, setForm] = useState<AiConfigFormState>({
    isEnabled: false,
    categorizationProvider: '',
    categorizationModel: '',
    ocrProvider: '',
    ocrModel: '',
    anthropicApiKey: '',
    openaiApiKey: '',
    geminiApiKey: '',
    ollamaBaseUrl: '',
    openaiCompatBaseUrl: '',
    openaiCompatModel: '',
    openaiCompatApiKey: '',
    openaiCompatMode: 'auto',
    glmOcrEnabled: false,
    glmOcrBaseUrl: '',
    glmOcrApiKey: '',
    glmOcrModel: '',
    glmOcrPrompt: '',
    glmOcrTimeoutMs: null,
    glmOcrConcurrency: null,
    glmOcrForceOcr: false,
    glmOcrRenderDpi: null,
    statementExtractionProvider: 'local',
    statementExtractionModel: '',
    autoCategorizeOnImport: true,
    autoOcrOnUpload: true,
    categorizationConfidenceThreshold: 0.7,
    maxConcurrentJobs: 5,
    monthlyBudgetLimit: null,
    piiProtectionLevel: 'strict',
    cloudVisionEnabled: false,
  });
  const [saved, setSaved] = useState(false);
  // Per-function ("task") override drafts, keyed by AiFunctionKey. Edited
  // by the Task Settings section below; merged into the save payload.
  const [taskOptions, setTaskOptions] = useState<TaskOptions>({});
  // Top-level document-extraction overrides (separate from per-function
  // taskOptions). Empty/unset fields mean "use the server default".
  const [testResults, setTestResults] = useState<Record<string, TestResult | undefined>>({});
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [permissiveAckOpen, setPermissiveAckOpen] = useState(false);

  const { data: disclosure } = useSystemAiDisclosure();
  const acceptDisclosure = useAcceptSystemAiDisclosure();

  useEffect(() => {
    if (data) {
      setForm((f) => ({
        ...f,
        isEnabled: data.isEnabled,
        categorizationProvider: data.categorizationProvider || '',
        categorizationModel: data.categorizationModel || '',
        ocrProvider: data.ocrProvider || '',
        ocrModel: data.ocrModel || '',
        ollamaBaseUrl: data.ollamaBaseUrl || '',
        openaiCompatBaseUrl: data.openaiCompatBaseUrl || '',
        openaiCompatModel: data.openaiCompatModel || '',
        openaiCompatMode: data.openaiCompatMode || 'auto',
        glmOcrEnabled: !!data.glmOcrEnabled,
        glmOcrBaseUrl: data.glmOcrBaseUrl || '',
        glmOcrModel: data.glmOcrModel || '',
        glmOcrPrompt: data.glmOcrPrompt || '',
        glmOcrTimeoutMs: data.glmOcrTimeoutMs,
        glmOcrConcurrency: data.glmOcrConcurrency,
        glmOcrForceOcr: !!data.glmOcrForceOcr,
        glmOcrRenderDpi: data.glmOcrRenderDpi,
        statementExtractionProvider: data.statementExtractionProvider || 'local',
        statementExtractionModel: data.statementExtractionModel || '',
        autoCategorizeOnImport: data.autoCategorizeOnImport,
        autoOcrOnUpload: data.autoOcrOnUpload,
        categorizationConfidenceThreshold: data.categorizationConfidenceThreshold,
        maxConcurrentJobs: data.maxConcurrentJobs,
        monthlyBudgetLimit: data.monthlyBudgetLimit,
        piiProtectionLevel: (data.piiProtectionLevel || 'strict') as PiiLevel,
        cloudVisionEnabled: !!data.cloudVisionEnabled,
      }));
      setTaskOptions(data.taskOptions || {});
    }
  }, [data]);

  const handleTest = async (provider: string) => {
    try {
      const result = await testProvider.mutateAsync(provider);
      setTestResults((r) => ({ ...r, [provider]: { ok: result.success, msg: result.modelInfo || result.error || '' } }));
    } catch (e) {
      setTestResults((r) => ({ ...r, [provider]: { ok: false, msg: e instanceof Error ? e.message : 'Test failed' } }));
    }
  };

  const handleTestGlmOcr = async () => {
    try {
      const result = await testGlmOcr.mutateAsync();
      setTestResults((r) => ({ ...r, glm_ocr: { ok: result.success, msg: result.modelInfo || result.error || '' } }));
    } catch (e) {
      setTestResults((r) => ({ ...r, glm_ocr: { ok: false, msg: e instanceof Error ? e.message : 'Test failed' } }));
    }
  };

  // Drop any cached test badge for providers whose editable fields
  // changed — otherwise admins see a green badge over a key they just
  // edited, or a red badge for a config they already fixed.
  useEffect(() => {
    setTestResults((r) => {
      let next: Record<string, TestResult | undefined> | null = null;
      for (const { providers } of PROVIDER_FIELD_DEPS) {
        for (const p of providers) {
          if (r[p] !== undefined) {
            if (!next) next = { ...r };
            next[p] = undefined;
          }
        }
      }
      return next ?? r;
    });
    // The deps array is the flattened union of every field that should
    // invalidate any badge. Ordered for stable identity across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.anthropicApiKey, form.openaiApiKey, form.geminiApiKey,
    form.ollamaBaseUrl,
    form.openaiCompatApiKey, form.openaiCompatBaseUrl, form.openaiCompatModel,
  ]);

  const [selfTest, setSelfTest] = useState<{ rows: SelfTestRow[]; runAt: string } | null>(null);
  const [selfTestRunning, setSelfTestRunning] = useState(false);
  const [selfTestError, setSelfTestError] = useState<string | null>(null);

  // Model lists for the GLM-OCR engine and the statement-extraction LLM. The
  // statement extractor resolves to Anthropic (cloud) or the configured local
  // provider, so list models for whichever is selected.
  const glmModels = useGlmOcrModels();
  const stmtModelProvider =
    form.statementExtractionProvider === 'anthropic'
      ? 'anthropic'
      : (form.ocrProvider || form.categorizationProvider || 'openai_compat');
  const stmtModels = useProviderModels(stmtModelProvider);

  const doSave = () => {
    // Merge the per-function override drafts into the form payload. The
    // server deep-merges taskOptions, and each TaskOption field is built
    // so blank inputs are null/omitted (see normalizeTaskOptions) to
    // preserve "use the built-in default" semantics.
    const payload = {
      ...form,
      taskOptions: normalizeTaskOptions(taskOptions),
    };
    updateConfig.mutate(payload as unknown as Parameters<typeof updateConfig.mutate>[0]);
    setSaved(true);
  };
  const failingProviders = [form.categorizationProvider, form.ocrProvider]
    .filter(Boolean)
    .filter((p) => testResults[p] && !testResults[p]!.ok);
  const [confirmFailingOpen, setConfirmFailingOpen] = useState(false);
  const handleSaveClick = () => {
    if (failingProviders.length > 0) {
      setConfirmFailingOpen(true);
      return;
    }
    doSave();
  };
  const runSelfTest = async () => {
    setSelfTestRunning(true);
    setSelfTestError(null);
    try {
      const result = await apiClient<{ rows: SelfTestRow[]; runAt: string }>(
        '/ai/admin/test-all',
        { method: 'POST', body: JSON.stringify({}) },
      );
      setSelfTest(result);
    } catch (e) {
      setSelfTest(null);
      setSelfTestError(e instanceof Error ? e.message : 'Self-test failed');
    } finally {
      setSelfTestRunning(false);
    }
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">AI Processing</h1>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 max-w-2xl">
          <CheckCircle className="h-4 w-4" /> Configuration saved
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        {/* System disclosure — tier 1 of two-tier consent. AI cannot
            be enabled until an admin accepts this. */}
        <div className={`rounded-lg border shadow-sm p-6 ${disclosure?.acceptedAt ? 'bg-green-50/50 border-green-200' : 'bg-amber-50 border-amber-300'}`}>
          <div className="flex items-start gap-3">
            <ShieldCheck className={`h-5 w-5 mt-0.5 ${disclosure?.acceptedAt ? 'text-green-700' : 'text-amber-700'}`} />
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-gray-900">AI Processing Disclosure</h2>
              {disclosure?.acceptedAt ? (
                <p className="text-xs text-gray-600 mt-1">
                  Accepted {new Date(disclosure.acceptedAt).toLocaleString()}{disclosure.acceptedBy ? ` by admin ${disclosure.acceptedBy.slice(0, 8)}` : ''}. Disclosure version {disclosure.version}.
                </p>
              ) : (
                <p className="text-xs text-amber-800 mt-1">
                  Accept the system AI disclosure before AI can be enabled. This captures that the administrator has acknowledged what data may be sent to configured cloud providers.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setShowDisclosure(true)}>
                  {disclosure?.acceptedAt ? 'Review disclosure' : 'Review and accept'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Read-only matrix that pings every task's configured provider so
            admins can sanity-check the whole system in one click. */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Self-test</h2>
              <p className="text-xs text-gray-500">Pings every task's configured provider with a minimal request. Use after editing keys to confirm the system is healthy end-to-end.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={runSelfTest} loading={selfTestRunning}>
              Run self-test
            </Button>
          </div>
          {selfTestError && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
              <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Self-test failed: {selfTestError}</span>
            </div>
          )}
          {selfTest && (
            <div className="border border-gray-200 rounded overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">AI self-test results — task, provider, status, latency</caption>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Task</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Provider</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {selfTest.rows.map((row, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-1.5 text-gray-700">{row.task}</td>
                      <td className="px-3 py-1.5 text-gray-600">{row.provider || <span className="text-gray-400 italic">(not configured)</span>}</td>
                      <td className="px-3 py-1.5">
                        {row.skipped ? (
                          <span className="inline-flex items-center gap-1 text-gray-400"><AlertTriangle className="h-3 w-3" /> Skipped</span>
                        ) : row.success ? (
                          <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle className="h-3 w-3" /> OK{row.modelInfo ? ` — ${row.modelInfo}` : ''}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="h-3 w-3" /> {row.error || 'Failed'}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-500 font-mono">
                        {row.latencyMs !== null ? `${row.latencyMs}ms` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">
                Last run {new Date(selfTest.runAt).toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>

        {/* Master Switch */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <label className={`flex items-center gap-3 ${disclosure?.acceptedAt ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
            <input type="checkbox" checked={form.isEnabled} disabled={!disclosure?.acceptedAt}
              onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-5 w-5 disabled:cursor-not-allowed" />
            <div>
              <span className="text-sm font-medium text-gray-700">Enable AI Processing</span>
              <p className="text-xs text-gray-500">Enables AI-powered categorization, OCR, and document classification</p>
              {!disclosure?.acceptedAt && (
                <p className="text-xs text-amber-700 mt-1 flex items-center gap-1"><Lock className="h-3 w-3" /> Accept the disclosure above to enable.</p>
              )}
            </div>
          </label>
        </div>

        {/* PII Protection */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Privacy & Data Handling</h2>
            <p className="text-xs text-gray-500 mt-1">Controls what data is sent to cloud AI providers. Changes that loosen data handling will pause per-company AI consent until companies re-accept.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">PII Protection Level</label>
            <div className="space-y-2">
              {[
                { key: 'strict', label: 'Strict (recommended)', desc: 'Images never leave your server. All cloud AI calls receive sanitized text only. Requires local OCR (Tesseract) for document processing.' },
                { key: 'standard', label: 'Standard', desc: 'Sanitized text only, with softer redaction on low-risk documents (receipts).' },
                { key: 'permissive', label: 'Permissive (use with caution)', desc: 'Cloud vision may be enabled as a fallback when local OCR is insufficient. Requires a separate acknowledgment below.' },
              ].map((opt) => (
                <label key={opt.key} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="radio" name="pii-level" value={opt.key} checked={form.piiProtectionLevel === opt.key}
                    onChange={() => setForm((f) => ({ ...f, piiProtectionLevel: opt.key as PiiLevel, cloudVisionEnabled: opt.key === 'permissive' ? f.cloudVisionEnabled : false }))}
                    className="mt-0.5 text-primary-600 focus:ring-primary-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className={`border rounded-lg p-3 ${form.piiProtectionLevel === 'permissive' ? 'border-gray-200' : 'border-gray-100 bg-gray-50/50'}`}>
            <label className={`flex items-start gap-3 ${form.piiProtectionLevel === 'permissive' ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
              <input type="checkbox" checked={form.cloudVisionEnabled}
                disabled={form.piiProtectionLevel !== 'permissive'}
                onChange={(e) => {
                  if (e.target.checked) { setPermissiveAckOpen(true); }
                  else setForm((f) => ({ ...f, cloudVisionEnabled: false }));
                }}
                className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4" />
              <div>
                <p className="text-sm font-medium text-gray-800 flex items-center gap-1">
                  <AlertTriangle className={`h-4 w-4 ${form.cloudVisionEnabled ? 'text-amber-600' : 'text-gray-400'}`} />
                  Enable cloud vision (raw images sent to cloud provider)
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Only relevant under Permissive. When off, images never leave your server regardless of provider.</p>
              </div>
            </label>
          </div>

          {/* Per-provider data policy links — required by the addendum
              so the admin can open each provider's policy before
              accepting on behalf of the installation. Self-hosted
              entries document the "data stays local" guarantee. */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-600 mb-2">Provider data handling policies</p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li className="flex items-center justify-between gap-3">
                <span>Anthropic Claude</span>
                <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Privacy policy &rarr;</a>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>OpenAI</span>
                <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Privacy policy &rarr;</a>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>Google Gemini</span>
                <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">API terms &rarr;</a>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>Ollama (self-hosted)</span>
                <span className="text-green-700">Data stays on your server</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Provider Credentials */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Provider Credentials</h2>
          {[
            { key: 'anthropic', label: 'Anthropic API Key', field: 'anthropicApiKey', hasKey: data?.hasAnthropicKey },
            { key: 'openai', label: 'OpenAI API Key', field: 'openaiApiKey', hasKey: data?.hasOpenaiKey },
            { key: 'gemini', label: 'Gemini API Key', field: 'geminiApiKey', hasKey: data?.hasGeminiKey },
          ].map((p) => (
            <div key={p.key} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Input label={p.label} type="password" value={form[p.field as keyof AiConfigFormState] as string}
                    onChange={(e) => setForm((f) => ({ ...f, [p.field]: e.target.value }))}
                    placeholder={p.hasKey ? '••••••••••• (configured)' : `Enter ${p.label}`} />
                </div>
                <div className="pt-5">
                  <Button variant="secondary" size="sm" onClick={() => handleTest(p.key)}>Test</Button>
                </div>
              </div>
              <LastVerifiedLine provider={p.key} history={data?.providerTestHistory} inSession={testResults[p.key]} />
              {p.hasKey && (
                // Send { field: null } directly — the backend treats null as
                // explicit clear. Skip the React Query mutation to avoid
                // submitting the rest of the form (which has separate edits).
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Clear stored ${p.label}?`)) return;
                    await apiClient('/ai/admin/config', {
                      method: 'PUT',
                      body: JSON.stringify({ [p.field]: null }),
                    });
                    queryClient.invalidateQueries({ queryKey: ['ai', 'admin', 'config'] });
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Clear stored key
                </button>
              )}
              {testResults[p.key] && (
                <p className={`text-xs ${testResults[p.key]!.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {testResults[p.key]!.ok ? <CheckCircle className="h-3 w-3 inline mr-1" /> : <XCircle className="h-3 w-3 inline mr-1" />}
                  {testResults[p.key]!.msg}
                </p>
              )}
            </div>
          ))}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Input label="Ollama Base URL" value={form.ollamaBaseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, ollamaBaseUrl: e.target.value }))}
                  placeholder="http://localhost:11434" />
              </div>
              <div className="pt-5">
                <Button variant="secondary" size="sm" onClick={() => handleTest('ollama')}
                  disabled={!form.ollamaBaseUrl && !data?.ollamaBaseUrl}>Test</Button>
              </div>
            </div>
            {testResults['ollama'] && (
              <p className={`text-xs ${testResults['ollama']!.ok ? 'text-green-600' : 'text-red-600'}`}>
                {testResults['ollama']!.ok ? <CheckCircle className="h-3 w-3 inline mr-1" /> : <XCircle className="h-3 w-3 inline mr-1" />}
                {testResults['ollama']!.msg}
              </p>
            )}
          </div>
          {/* Generic OpenAI-compatible endpoint. Point this at Ollama's
              /v1, a llama.cpp server, LM Studio, vLLM, or any hosted
              proxy that speaks the OpenAI chat API. A local URL keeps
              the PII sanitizer in self-hosted mode; a public URL still
              engages sanitization. */}
          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500">
              OpenAI-compatible endpoint — generic <code>/v1/chat/completions</code> target.
              Use a local URL (loopback, private IP, <code>.local</code>, Compose short name) to keep data on-server.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Input label="OpenAI-compat Base URL" value={form.openaiCompatBaseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, openaiCompatBaseUrl: e.target.value }))}
                  placeholder="http://localhost:11434 or https://api.example.com" />
              </div>
              <div className="pt-5">
                <Button variant="secondary" size="sm" onClick={() => handleTest('openai_compat')}
                  disabled={!form.openaiCompatBaseUrl && !data?.openaiCompatBaseUrl}>Test</Button>
              </div>
            </div>
            <Input label="OpenAI-compat Model" value={form.openaiCompatModel}
              onChange={(e) => setForm((f) => ({ ...f, openaiCompatModel: e.target.value }))}
              list="openai-compat-model-suggestions"
              placeholder="e.g. minicpm-v4.5:latest, qwen3.5:35b-a3b" />
            <datalist id="openai-compat-model-suggestions">
              {OLLAMA_MODEL_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
            </datalist>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint mode</label>
              <select value={form.openaiCompatMode}
                onChange={(e) => setForm((f) => ({ ...f, openaiCompatMode: e.target.value as 'auto' | 'native' | 'compat' }))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="auto">Auto (detect Ollama)</option>
                <option value="native">Native Ollama (/api/chat)</option>
                <option value="compat">OpenAI-compatible (/v1)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Ollama (incl. thinking models like Qwen) must use the native method. 'Auto' detects Ollama by its :11434 port. Choose 'OpenAI-compatible' only for vLLM / llama.cpp / LM Studio.
              </p>
            </div>
            <Input label="OpenAI-compat API Key (optional)" type="password" value={form.openaiCompatApiKey}
              onChange={(e) => setForm((f) => ({ ...f, openaiCompatApiKey: e.target.value }))}
              placeholder={data?.hasOpenaiCompatKey ? '••••••••••• (configured)' : 'Leave blank if the server is open'} />
            {data?.hasOpenaiCompatKey && (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Clear stored OpenAI-compat API Key?')) return;
                  await apiClient('/ai/admin/config', { method: 'PUT', body: JSON.stringify({ openaiCompatApiKey: null }) });
                  queryClient.invalidateQueries({ queryKey: ['ai', 'admin', 'config'] });
                }}
                className="text-xs text-red-600 hover:underline"
              >
                Clear stored key
              </button>
            )}
            {testResults['openai_compat'] && (
              <p className={`text-xs ${testResults['openai_compat']!.ok ? 'text-green-600' : 'text-red-600'}`}>
                {testResults['openai_compat']!.ok ? <CheckCircle className="h-3 w-3 inline mr-1" /> : <XCircle className="h-3 w-3 inline mr-1" />}
                {testResults['openai_compat']!.msg}
              </p>
            )}
          </div>

          {/* GLM-OCR engine — dedicated llama.cpp OCR server for the
              statement-import pipeline (detect → OCR → extract → reconcile).
              Separate from the chat/vision providers above; only used to
              transcribe scanned/image statement pages to markdown. */}
          <div className="space-y-2 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">GLM-OCR Engine (Statement Import)</h3>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.glmOcrEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, glmOcrEnabled: e.target.checked }))} className="rounded" />
                <span>Enabled</span>
              </label>
            </div>
            <p className="text-xs text-gray-500">
              A dedicated llama.cpp <code>llama-server</code> hosting GLM-OCR (OpenAI-compatible chat API).
              Used to OCR scanned/image bank-statement pages; text-layer PDFs skip it. Keep the base URL on the LAN to stay on-server.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Input label="GLM-OCR Base URL" value={form.glmOcrBaseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, glmOcrBaseUrl: e.target.value }))}
                  placeholder="http://vibe-glm-ocr:8090 or http://192.168.x.x:8082" />
              </div>
              <div className="pt-5">
                <Button variant="secondary" size="sm" onClick={handleTestGlmOcr}
                  loading={testGlmOcr.isPending}
                  disabled={!form.glmOcrBaseUrl && !data?.glmOcrBaseUrl}>Test</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ModelInput label="Model" value={form.glmOcrModel}
                onChange={(v) => setForm((f) => ({ ...f, glmOcrModel: v }))}
                models={glmModels.data?.models ?? []} loading={glmModels.isFetching} listError={glmModels.data?.error}
                placeholder="glm-ocr" />
              <Input label="Prompt" value={form.glmOcrPrompt}
                onChange={(e) => setForm((f) => ({ ...f, glmOcrPrompt: e.target.value }))}
                placeholder="OCR:  (or 'Table Recognition:')" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Timeout (ms)" type="number" value={form.glmOcrTimeoutMs ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, glmOcrTimeoutMs: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="120000" />
              <Input label="Concurrency" type="number" value={form.glmOcrConcurrency ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, glmOcrConcurrency: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="2" />
            </div>
            <div className="grid grid-cols-2 gap-2 items-end">
              <Input label="Render DPI" type="number" value={form.glmOcrRenderDpi ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, glmOcrRenderDpi: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="200 (blank = server default)" />
              <label className="flex items-center gap-2 text-sm pb-2">
                <input type="checkbox" checked={form.glmOcrForceOcr}
                  onChange={(e) => setForm((f) => ({ ...f, glmOcrForceOcr: e.target.checked }))} className="rounded" />
                <span title="OCR every page even when the PDF has a text layer">Force OCR (skip text-layer fast path)</span>
              </label>
            </div>
            <Input label="GLM-OCR API Key (optional)" type="password" value={form.glmOcrApiKey}
              onChange={(e) => setForm((f) => ({ ...f, glmOcrApiKey: e.target.value }))}
              placeholder={data?.hasGlmOcrKey ? '••••••••••• (configured)' : 'Leave blank if the server is open'} />
            {data?.hasGlmOcrKey && (
              <button type="button"
                onClick={async () => {
                  if (!confirm('Clear stored GLM-OCR API Key?')) return;
                  await apiClient('/ai/admin/config', { method: 'PUT', body: JSON.stringify({ glmOcrApiKey: null }) });
                  queryClient.invalidateQueries({ queryKey: ['ai', 'config'] });
                }}
                className="text-xs text-red-600 hover:underline">
                Clear stored key
              </button>
            )}
            {testResults['glm_ocr'] && (
              <p className={`text-xs ${testResults['glm_ocr']!.ok ? 'text-green-600' : 'text-red-600'}`}>
                {testResults['glm_ocr']!.ok ? <CheckCircle className="h-3 w-3 inline mr-1" /> : <XCircle className="h-3 w-3 inline mr-1" />}
                {testResults['glm_ocr']!.msg}
              </p>
            )}

            {/* Stage-2 extraction LLM: turns the OCR'd markdown into structured
                transactions. Independent of the OCR engine above. */}
            <div className="border-t border-gray-100 pt-3 mt-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Statement extraction LLM</label>
              <p className="text-xs text-gray-500 mb-2">
                Which model turns the OCR'd statement text into structured transactions.
                <strong> Local</strong> keeps data on-server; <strong>Anthropic</strong> sends PII-sanitized text to the cloud.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select value={form.statementExtractionProvider}
                  onChange={(e) => setForm((f) => ({ ...f, statementExtractionProvider: e.target.value as 'local' | 'anthropic' }))}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="local">Local LLM (self-hosted)</option>
                  <option value="anthropic">Anthropic (cloud)</option>
                </select>
                <ModelInput value={form.statementExtractionModel}
                  onChange={(v) => setForm((f) => ({ ...f, statementExtractionModel: v }))}
                  models={stmtModels.data?.models ?? []} loading={stmtModels.isFetching} listError={stmtModels.data?.error}
                  placeholder={form.statementExtractionProvider === 'anthropic' ? 'blank = default' : 'blank = OCR/local default'} />
              </div>
              {form.statementExtractionProvider === 'anthropic' && !data?.hasAnthropicKey && (
                <p className="text-xs text-amber-600 mt-1">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  No Anthropic API key configured — set one above or extraction will fail.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Task Assignment */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Task Assignment</h2>
          {/* Issue B: bank-feed name cleanup has no separate function key — it
              runs through the same categorize() path, so it resolves the
              Categorization provider/model below. Say so, so an admin knows
              setting Categorization also controls name cleanup. */}
          <p className="text-xs text-gray-500 -mt-1">
            The <span className="font-medium text-gray-700">Transaction Categorization &amp; Name Cleanup</span> model
            both categorizes bank-feed transactions AND cleans up their names — it&apos;s a single AI call, so one
            model covers both. There is no separate name-cleanup model.
          </p>
          {[
            { label: 'Transaction Categorization & Name Cleanup', providerField: 'categorizationProvider', modelField: 'categorizationModel' },
            { label: 'OCR / Document Parsing', providerField: 'ocrProvider', modelField: 'ocrModel' },
          ].map((task) => {
            const selectedProvider = form[task.providerField as keyof AiConfigFormState] as string;
            return (
            <div key={task.providerField} className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{task.label} Provider</label>
                <select value={selectedProvider} onChange={(e) => setForm((f) => ({ ...f, [task.providerField]: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Not configured</option>
                  {PROVIDERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <TaskModelField
                provider={selectedProvider}
                value={form[task.modelField as keyof AiConfigFormState] as string}
                onChange={(v) => setForm((f) => ({ ...f, [task.modelField]: v }))}
              />
            </div>
            );
          })}
        </div>

        {/* Per-function Task Settings — one collapsible card per AI
            function. Each lets the admin override that function's
            TaskOption (token ceiling, thinking, timeout, temperature,
            confidence threshold, fallback chain, auto-trigger, enable).
            Empty inputs mean "use the built-in default". */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Task Settings</h2>
            <p className="text-xs text-gray-500 mt-1">Per-function overrides. Leave a field blank to use the built-in default — only changed values are sent.</p>
          </div>
          {TASK_FUNCTIONS.map((fn) => (
            <TaskSettingsCard
              key={fn.key}
              fnKey={fn.key}
              label={fn.label}
              showThreshold={fn.showThreshold}
              value={taskOptions[fn.key]}
              onChange={(next) => setTaskOptions((prev) => ({ ...prev, [fn.key]: next }))}
            />
          ))}
        </div>

        {/* Settings */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.autoCategorizeOnImport}
              onChange={(e) => setForm((f) => ({ ...f, autoCategorizeOnImport: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 h-4 w-4" />
            <span className="text-sm text-gray-700">Auto-categorize bank feed items on import</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.autoOcrOnUpload}
              onChange={(e) => setForm((f) => ({ ...f, autoOcrOnUpload: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 h-4 w-4" />
            <span className="text-sm text-gray-700">Auto-OCR receipts on upload</span>
          </label>
          <Input label="Confidence Threshold" type="number" step="0.05" min="0" max="1"
            value={String(form.categorizationConfidenceThreshold)}
            onChange={(e) => setForm((f) => ({ ...f, categorizationConfidenceThreshold: parseFloat(e.target.value) }))} />
          <Input label="Monthly Budget Limit ($)" type="number" step="1" min="0"
            value={form.monthlyBudgetLimit != null ? String(form.monthlyBudgetLimit) : ''}
            onChange={(e) => setForm((f) => ({ ...f, monthlyBudgetLimit: e.target.value ? parseFloat(e.target.value) : null }))}
            placeholder="Unlimited" />
        </div>

        {/* Ollama Models */}
        {form.ollamaBaseUrl && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Ollama Models</h2>
              <Button variant="secondary" size="sm" onClick={async () => {
                try {
                  const res = await fetch(`${form.ollamaBaseUrl}/api/tags`);
                  const d = await res.json() as { models?: Array<{ name: string }> };
                  setOllamaModels((d.models || []).map((m) => m.name));
                } catch { setOllamaModels([]); }
              }}>Refresh</Button>
            </div>
            {ollamaModels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {ollamaModels.map((m) => (
                  <span key={m} className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-700 font-mono">{m}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Click Refresh to list available Ollama models</p>
            )}
          </div>
        )}

        {/* Usage Summary */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Usage (Last 30 Days)</h2>
          <UsageSummarySection />
        </div>

        {/* Prompt Templates */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Prompt Templates</h2>
          <PromptEditorSection />
        </div>

        {/* Chat Support — see AI_CHAT_SUPPORT_PLAN.md */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Chat Assistant</h2>
          <ChatSettingsSection />
        </div>

        {updateConfig.error && <p className="text-sm text-red-600">{updateConfig.error.message}</p>}
        <Button onClick={handleSaveClick} loading={updateConfig.isPending}>
          Save Configuration
        </Button>
      </div>

      <ConfirmDialog
        open={confirmFailingOpen && failingProviders.length > 0}
        title="Save with failing providers?"
        message={`One or more providers you've selected failed their connection test: ${failingProviders.join(', ')}. Save anyway?`}
        confirmLabel="Save anyway"
        cancelLabel="Re-test first"
        variant="danger"
        onConfirm={() => {
          setConfirmFailingOpen(false);
          doSave();
        }}
        onCancel={() => setConfirmFailingOpen(false)}
      />

      {showDisclosure && disclosure && (
        <DisclosureModal
          text={disclosure.text}
          accepted={!!disclosure.acceptedAt}
          onClose={() => setShowDisclosure(false)}
          onAccept={async () => { await acceptDisclosure.mutateAsync(); setShowDisclosure(false); }}
          saving={acceptDisclosure.isPending}
        />
      )}

      {permissiveAckOpen && (
        <PermissiveAckModal
          onCancel={() => setPermissiveAckOpen(false)}
          onConfirm={() => { setForm((f) => ({ ...f, cloudVisionEnabled: true })); setPermissiveAckOpen(false); }}
        />
      )}
    </div>
  );
}

// ─── Per-function Task Settings card ─────────────────────────────
//
// One collapsible card per AI function. Edits the function's TaskOption
// override draft (lifted to AiConfigPage state). Number/text fields use
// empty-string-as-"unset": the control writes `null` to the draft when
// cleared, so normalizeTaskOptions sends null (= built-in default) on
// save. The "Test this function" button runs a real end-to-end
// completion and renders the actual provider error on failure.

// String<->number helpers so a blank input maps to a null override.
function numToStr(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v);
}
function strToNum(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function TaskSettingsCard({
  fnKey, label, showThreshold, value, onChange,
}: {
  fnKey: AiFunctionKey;
  label: string;
  showThreshold: boolean;
  value: TaskOption | undefined;
  onChange: (next: TaskOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const testFn = useTestAiFunction();
  const [testResult, setTestResult] = useState<TestFunctionResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const opt: TaskOption = value ?? {};
  const patch = (changes: Partial<TaskOption>) => onChange({ ...opt, ...changes });

  // Batched AI categorization is a categorization-only concept.
  const showBatchSize = fnKey === 'categorization';

  // Fallback chain is edited as a comma-separated list of provider keys.
  const fallbackText = (opt.fallbackChain ?? []).join(', ');

  const runTest = async () => {
    setTestError(null);
    setTestResult(null);
    try {
      const result = await testFn.mutateAsync(fnKey);
      setTestResult(result);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Test failed');
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className="text-xs text-gray-400">{open ? 'Hide' : 'Edit'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {showBatchSize && (
            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              This model both categorizes bank-feed transactions AND cleans up their names — it&apos;s a
              single AI call, so one model covers both.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Max tokens"
              type="number"
              min="1"
              value={numToStr(opt.maxTokens)}
              onChange={(e) => patch({ maxTokens: strToNum(e.target.value) })}
              placeholder="Default"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thinking</label>
              <select
                value={opt.thinking ?? ''}
                onChange={(e) => patch({ thinking: e.target.value === '' ? null : (e.target.value as 'on' | 'off') })}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Default</option>
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Thinking on/off is applied for self-hosted providers (Ollama uses think=false). For cloud providers it currently has no effect.
              </p>
            </div>
            <Input
              label="Timeout (ms)"
              type="number"
              min="1"
              value={numToStr(opt.timeoutMs)}
              onChange={(e) => patch({ timeoutMs: strToNum(e.target.value) })}
              placeholder="Default 60000"
            />
            <Input
              label="Temperature"
              type="number"
              step="0.1"
              min="0"
              value={numToStr(opt.temperature)}
              onChange={(e) => patch({ temperature: strToNum(e.target.value) })}
              placeholder="Default"
            />
            <div>
              <Input
                label="Context window (num_ctx)"
                type="number"
                min="1"
                value={numToStr(opt.numCtx)}
                onChange={(e) => patch({ numCtx: strToNum(e.target.value) })}
                placeholder="Default"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ollama context window for this function. Leave blank to use the global default.
              </p>
            </div>
            {showThreshold && (
              <Input
                label="Confidence threshold"
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={numToStr(opt.threshold)}
                onChange={(e) => patch({ threshold: strToNum(e.target.value) })}
                placeholder="Default"
              />
            )}
            {showBatchSize && (
              <div className="col-span-2">
                <Input
                  label="Transactions per AI call (batch size)"
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  value={numToStr(opt.batchSize)}
                  onChange={(e) => patch({ batchSize: strToNum(e.target.value) })}
                  placeholder="Default 15"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How many bank-feed transactions to categorize in a single AI request.
                  Higher = fewer API calls and lower cost, but larger prompts; lower = simpler
                  prompts. 1 sends each transaction separately. Range 1–50; default 15.
                </p>
              </div>
            )}
          </div>

          <div>
            <Input
              label="Fallback chain (provider keys, comma-separated)"
              value={fallbackText}
              onChange={(e) => {
                const chain = e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                patch({ fallbackChain: chain.length > 0 ? chain : null });
              }}
              placeholder="Leave blank to use the global chain"
            />
            <p className="text-xs text-gray-500 mt-1">
              Valid keys: {PROVIDERS.map((p) => p.key).join(', ')}
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={opt.enabled ?? true}
                onChange={(e) => patch({ enabled: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
              />
              <span className="text-sm text-gray-700">Enable this function</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={opt.autoTrigger ?? false}
                onChange={(e) => patch({ autoTrigger: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
              />
              <span className="text-sm text-gray-700">Auto-trigger</span>
            </label>
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <Button size="sm" variant="secondary" onClick={runTest} loading={testFn.isPending}>
              Test this function
            </Button>
            {testResult && (
              testResult.success ? (
                <p className="text-xs text-green-600 flex items-start gap-1">
                  <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>
                    OK{testResult.provider ? ` via ${testResult.provider}` : ''}
                    {testResult.modelInfo ? ` — ${testResult.modelInfo}` : ''} ({testResult.durationMs}ms)
                  </span>
                </p>
              ) : (
                <p className="text-xs text-red-600 flex items-start gap-1">
                  <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span className="break-words">
                    {testResult.provider ? `${testResult.provider}: ` : ''}{testResult.error || 'Failed'} ({testResult.durationMs}ms)
                  </span>
                </p>
              )
            )}
            {testError && (
              <p className="text-xs text-red-600 flex items-start gap-1">
                <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="break-words">{testError}</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Document Extraction settings card ───────────────────────────
//
// Top-level overrides for the local document-extraction pipeline
// (DOCUMENT_EXTRACTION_V1), edited as a single ExtractionOptions draft
// lifted to AiConfigPage state. Number/text fields use empty-as-"unset"
// (null on save); tri-state selects map Default→null, Yes→true, No→false.

// Tri-state boolean <-> select value. '' = use server default (null).
function boolToSelect(v: boolean | null | undefined): string {
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return '';
}
function selectToBool(v: string): boolean | null {
  if (v === 'yes') return true;
  if (v === 'no') return false;
  return null;
}

/**
 * Renders the "Last verified <relative time>" line under each provider
 * card. Prefers the in-session `testResults` entry (the admin just
 * clicked Test) and falls back to the persisted `providerTestHistory`
 * for prior sessions. Returns null when nothing is known so the layout
 * doesn't get a stray empty line.
 */
function LastVerifiedLine({
  provider, history, inSession,
}: {
  provider: string;
  history?: Record<string, { verifiedAt: string; success: boolean; modelInfo?: string; error?: string }>;
  inSession?: { ok: boolean; msg: string };
}) {
  // In-session result takes precedence — it's always "just now".
  if (inSession) return null;
  const record = history?.[provider];
  if (!record) return null;
  const ago = relativeTime(record.verifiedAt);
  return (
    <p className={`text-xs ${record.success ? 'text-gray-500' : 'text-red-600'}`}>
      Last verified {ago} — {record.success
        ? (record.modelInfo || 'OK')
        : (record.error || 'failed')}
    </p>
  );
}

// Compact "Nm ago / Nh ago / Nd ago" formatter. Keeps the UI calm —
// "yesterday at 3:42 PM" is too much for a status line.
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const sec = Math.max(0, Math.round(diffMs / 1000));
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}

function DisclosureModal({ text, accepted, onClose, onAccept, saving }: {
  text: string; accepted: boolean; onClose: () => void; onAccept: () => void; saving: boolean;
}) {
  const [ack, setAck] = useState(accepted);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">AI Processing Disclosure</h2>
        </div>
        <div className="p-5 overflow-y-auto prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap font-sans">
          {text}
        </div>
        {!accepted && (
          <div className="px-5 py-3 border-t border-gray-200">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              I have read and accept this disclosure on behalf of this Vibe MyBooks installation.
            </label>
          </div>
        )}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {!accepted && (
            <Button onClick={onAccept} disabled={!ack} loading={saving}>Accept disclosure</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PermissiveAckModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [ack, setAck] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-5 border-b border-gray-200 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-gray-900">Enable cloud vision?</h2>
        </div>
        <div className="p-5 text-sm text-gray-700 space-y-3">
          <p>When enabled, Vibe MyBooks may send document images (receipts, bank statements, invoices) to your configured cloud AI provider when local OCR (Tesseract) cannot adequately process them.</p>
          <p className="text-gray-600">Cloud providers (Anthropic, OpenAI, Google) may process and temporarily store these images per their data policies. Bank statements and tax documents may contain account numbers, names, addresses, and other sensitive information.</p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
            <span>I understand the PII implications and accept the risk of sending document images to the configured cloud AI provider.</span>
          </label>
        </div>
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} disabled={!ack}>Enable cloud vision</Button>
        </div>
      </div>
    </div>
  );
}

interface AiUsageRow {
  provider: string;
  calls: string;
  cost?: string;
}

function UsageSummarySection() {
  const { data } = useQuery({
    queryKey: ['ai', 'admin-usage'],
    queryFn: () => apiClient<{ rows: AiUsageRow[] }>('/ai/admin/usage?months=1'),
  });
  const rows = data?.rows || [];
  if (rows.length === 0) return <p className="text-sm text-gray-400">No AI usage recorded yet.</p>;

  const byProvider: Record<string, { calls: number; cost: number }> = {};
  for (const row of rows) {
    const p = row.provider;
    if (!byProvider[p]) byProvider[p] = { calls: 0, cost: 0 };
    byProvider[p]!.calls += parseInt(row.calls);
    byProvider[p]!.cost += parseFloat(row.cost || '0');
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(byProvider).map(([provider, stats]) => (
        <div key={provider} className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 capitalize">{provider}</p>
          <p className="text-lg font-semibold text-gray-900">{stats.calls} <span className="text-sm font-normal text-gray-500">calls</span></p>
          <p className="text-xs text-gray-500">${stats.cost.toFixed(4)} estimated cost</p>
        </div>
      ))}
    </div>
  );
}

interface AiPromptTemplate {
  id: string;
  taskType: string;
  provider?: string | null;
  version: number;
  isActive: boolean;
  systemPrompt: string;
  userPromptTemplate: string;
  notes?: string | null;
}

interface AiPromptInput {
  taskType: string;
  systemPrompt: string;
  userPromptTemplate: string;
  notes?: string;
}

function PromptEditorSection() {
  const { data } = useQuery({
    queryKey: ['ai', 'prompts'],
    queryFn: () => apiClient<{ prompts: AiPromptTemplate[] }>('/ai/admin/prompts'),
  });
  // Known customizable functions for the taskType dropdown. Falls back to
  // the prior default ('categorize') when the list hasn't loaded yet.
  const { data: taskTypesData } = useAiPromptTaskTypes();
  const taskTypes = taskTypesData?.taskTypes ?? [];
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AiPromptTemplate | null>(null);
  const [newPrompt, setNewPrompt] = useState(false);
  const [form, setForm] = useState({ taskType: 'categorize', systemPrompt: '', userPromptTemplate: '', notes: '' });

  const saveMutation = useMutation({
    mutationFn: (input: AiPromptInput) => editing
      ? apiClient(`/ai/admin/prompts/${editing.id}`, { method: 'PUT', body: JSON.stringify(input) })
      : apiClient('/ai/admin/prompts', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { setEditing(null); setNewPrompt(false); queryClient.invalidateQueries({ queryKey: ['ai', 'prompts'] }); },
  });

  const prompts = data?.prompts || [];

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Leave a function without a custom prompt to use its built-in default. A saved
        prompt here overrides the built-in system prompt for that function.
      </p>
      {prompts.filter((p) => p.isActive).map((p) => (
        <div key={p.id} className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-800">{p.taskType} {p.provider && `(${p.provider})`} v{p.version}</span>
            <button onClick={() => { setEditing(p); setForm({ taskType: p.taskType, systemPrompt: p.systemPrompt, userPromptTemplate: p.userPromptTemplate, notes: p.notes || '' }); }}
              className="text-xs text-primary-600 hover:underline">Edit</button>
          </div>
          <p className="text-xs text-gray-500 truncate">{p.systemPrompt.slice(0, 100)}...</p>
        </div>
      ))}
      {prompts.length === 0 && <p className="text-sm text-gray-400">No prompt templates. Create one to customize AI behavior.</p>}

      {(editing || newPrompt) && (
        <div className="border border-primary-200 rounded-lg p-4 bg-primary-50/30 space-y-3">
          {!editing && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Function</label>
              <select value={form.taskType} onChange={(e) => setForm((f) => ({ ...f, taskType: e.target.value }))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {taskTypes.length === 0 ? (
                  <option value={form.taskType}>{form.taskType}</option>
                ) : (
                  taskTypes.map((t) => (
                    <option key={t.taskType} value={t.taskType}>{t.label}</option>
                  ))
                )}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">System Prompt</label>
            <textarea rows={3} value={form.systemPrompt} onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">User Prompt Template <span className="text-gray-400">(use {"{{variable}}"} for substitution)</span></label>
            <textarea rows={3} value={form.userPromptTemplate} onChange={(e) => setForm((f) => ({ ...f, userPromptTemplate: e.target.value }))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => saveMutation.mutate(form)} loading={saveMutation.isPending}>Save</Button>
            <Button size="sm" variant="secondary" onClick={() => { setEditing(null); setNewPrompt(false); }}>Cancel</Button>
          </div>
        </div>
      )}

      {!editing && !newPrompt && (
        <Button size="sm" variant="secondary" onClick={() => { setNewPrompt(true); setForm({ taskType: 'categorize', systemPrompt: '', userPromptTemplate: '', notes: '' }); }}>
          + New Template
        </Button>
      )}
    </div>
  );
}

// ─── Chat Assistant Settings ────────────────────────────────────

interface ChatConfigDto {
  chatSupportEnabled: boolean;
  chatProvider: string | null;
  chatModel: string | null;
  chatMaxHistory: number;
  chatDataAccessLevel: 'none' | 'contextual' | 'full';
  isEnabled: boolean;
  hasAnthropicKey?: boolean;
  hasOpenaiKey?: boolean;
  hasGeminiKey?: boolean;
  ollamaBaseUrl?: string | null;
}

interface KnowledgeStatusDto {
  byteLength: number;
  estimatedTokens: number;
  hasPromptFile: boolean;
  hasDataFile: boolean;
  promptFilePath: string;
  dataFilePath: string;
  screenCount: number | null;
  workflowCount: number | null;
  termCount: number | null;
  curatedFileCount: number | null;
  generatedAt: string | null;
}

interface ChatStatsDto {
  conversationsThisMonth: number;
  messagesThisMonth: number;
  estimatedCostThisMonth: number;
}

function ChatSettingsSection() {
  const queryClient = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ['chat', 'admin', 'config'],
    queryFn: () => apiClient<ChatConfigDto>('/chat/admin/config'),
  });
  const { data: knowledge } = useQuery({
    queryKey: ['chat', 'admin', 'knowledge-status'],
    queryFn: () => apiClient<KnowledgeStatusDto>('/chat/admin/knowledge-status'),
  });
  const { data: stats } = useQuery({
    queryKey: ['chat', 'admin', 'stats'],
    queryFn: () => apiClient<ChatStatsDto>('/chat/admin/stats'),
  });

  const [form, setForm] = useState<{
    chatSupportEnabled: boolean;
    chatProvider: string;
    chatModel: string;
    chatMaxHistory: number;
    chatDataAccessLevel: 'none' | 'contextual' | 'full';
  }>({
    chatSupportEnabled: false,
    chatProvider: '',
    chatModel: '',
    chatMaxHistory: 50,
    chatDataAccessLevel: 'contextual',
  });
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        chatSupportEnabled: config.chatSupportEnabled,
        chatProvider: config.chatProvider || '',
        chatModel: config.chatModel || '',
        chatMaxHistory: config.chatMaxHistory,
        chatDataAccessLevel: config.chatDataAccessLevel,
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (input: typeof form) => apiClient('/chat/admin/config', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'admin', 'config'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'status'] });
      setSavedNote(true);
    },
  });

  // Clear the "saved" pill 3s after it appears — useEffect-driven for
  // unmount safety.
  useEffect(() => {
    if (!savedNote) return;
    const t = setTimeout(() => setSavedNote(false), 3000);
    return () => clearTimeout(t);
  }, [savedNote]);

  const regenMutation = useMutation({
    mutationFn: () => apiClient('/chat/admin/regenerate-knowledge', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat', 'admin', 'knowledge-status'] }),
  });

  const providerOptions: Array<{ value: string; label: string; available: boolean }> = [
    { value: 'anthropic', label: 'Anthropic', available: !!config?.hasAnthropicKey },
    { value: 'openai', label: 'OpenAI', available: !!config?.hasOpenaiKey },
    { value: 'gemini', label: 'Gemini', available: !!config?.hasGeminiKey },
    { value: 'ollama', label: 'Ollama (local)', available: !!config?.ollamaBaseUrl },
  ];

  const aiSystemReady = !!config?.isEnabled;

  return (
    <div className="space-y-4">
      {!aiSystemReady && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          AI processing is not enabled at the system level. Enable the master AI switch above before turning on the chat assistant.
        </div>
      )}

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.chatSupportEnabled}
          onChange={(e) => setForm((f) => ({ ...f, chatSupportEnabled: e.target.checked }))}
          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 h-5 w-5"
        />
        <div>
          <span className="text-sm font-medium text-gray-700">Enable chat assistant</span>
          <p className="text-xs text-gray-500">Adds a slide-out chat panel accessible from every screen for opted-in companies.</p>
        </div>
      </label>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Chat Provider</label>
        <select
          value={form.chatProvider}
          onChange={(e) => setForm((f) => ({ ...f, chatProvider: e.target.value }))}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">— Use categorization provider —</option>
          {providerOptions.map((p) => (
            <option key={p.value} value={p.value} disabled={!p.available}>
              {p.label}{!p.available ? ' (not configured)' : ''}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          For best chat quality, use a model with strong instruction following (Claude Sonnet, GPT-4o, Gemini Pro). If left blank, falls back to your categorization provider.
        </p>
      </div>

      <Input
        label="Chat Model"
        value={form.chatModel}
        onChange={(e) => setForm((f) => ({ ...f, chatModel: e.target.value }))}
        placeholder="e.g. claude-sonnet-4-20250514"
      />

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Data Access Level</label>
        <select
          value={form.chatDataAccessLevel}
          onChange={(e) => setForm((f) => ({ ...f, chatDataAccessLevel: e.target.value as 'none' | 'contextual' | 'full' }))}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="none">None — help and concepts only</option>
          <option value="contextual">Contextual — current screen context</option>
          <option value="full">Full — read-only data lookup (coming soon)</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Controls how much of the user's data the assistant can see. Contextual is the recommended default.
        </p>
      </div>

      <Input
        label="Max Conversation History"
        type="number"
        min="10"
        max="200"
        value={String(form.chatMaxHistory)}
        onChange={(e) => setForm((f) => ({ ...f, chatMaxHistory: parseInt(e.target.value) || 50 }))}
      />

      {/* Knowledge base status */}
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Knowledge Base</h3>
        {knowledge ? (
          <div className="text-xs text-gray-600 space-y-0.5">
            <p>
              Status:{' '}
              {knowledge.hasPromptFile
                ? <span className="text-green-700">loaded</span>
                : <span className="text-red-700">missing — run regenerate</span>}
            </p>
            {knowledge.generatedAt && (
              <p>Generated: {new Date(knowledge.generatedAt).toLocaleString()}</p>
            )}
            {knowledge.screenCount !== null && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                <div className="bg-gray-50 rounded p-1.5 text-center">
                  <p className="text-[10px] text-gray-500 uppercase">Screens</p>
                  <p className="text-sm font-semibold text-gray-900">{knowledge.screenCount}</p>
                </div>
                <div className="bg-gray-50 rounded p-1.5 text-center">
                  <p className="text-[10px] text-gray-500 uppercase">Workflows</p>
                  <p className="text-sm font-semibold text-gray-900">{knowledge.workflowCount}</p>
                </div>
                <div className="bg-gray-50 rounded p-1.5 text-center">
                  <p className="text-[10px] text-gray-500 uppercase">Terms</p>
                  <p className="text-sm font-semibold text-gray-900">{knowledge.termCount}</p>
                </div>
                <div className="bg-gray-50 rounded p-1.5 text-center">
                  <p className="text-[10px] text-gray-500 uppercase">Sources</p>
                  <p className="text-sm font-semibold text-gray-900">{knowledge.curatedFileCount}</p>
                </div>
              </div>
            )}
            <p className="mt-1">Prompt size: ~{knowledge.estimatedTokens.toLocaleString()} tokens, {(knowledge.byteLength / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Loading…</p>
        )}
        <Button
          size="sm"
          variant="secondary"
          className="mt-2"
          loading={regenMutation.isPending}
          onClick={() => regenMutation.mutate()}
        >
          Regenerate from sources
        </Button>
      </div>

      {/* Usage stats */}
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Usage This Month</h3>
        {stats ? (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">Conversations</p>
              <p className="text-lg font-semibold text-gray-900">{stats.conversationsThisMonth}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">Messages</p>
              <p className="text-lg font-semibold text-gray-900">{stats.messagesThisMonth}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">Est. Cost</p>
              <p className="text-lg font-semibold text-gray-900">${stats.estimatedCostThisMonth.toFixed(2)}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Loading…</p>
        )}
      </div>

      {savedNote && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">
          Chat settings saved.
        </div>
      )}
      {saveMutation.error && (
        <p className="text-sm text-red-600">{(saveMutation.error as Error).message}</p>
      )}

      <Button
        size="sm"
        loading={saveMutation.isPending}
        onClick={() => saveMutation.mutate(form)}
      >
        Save Chat Settings
      </Button>
    </div>
  );
}
