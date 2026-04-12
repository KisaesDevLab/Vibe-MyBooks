import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useAiConfig, useUpdateAiConfig, useTestAiProvider } from '../../api/hooks/useAi';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Brain, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

const PROVIDERS = [
  { key: 'anthropic', label: 'Anthropic (Claude)', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'] },
  { key: 'openai', label: 'OpenAI (GPT)', models: ['gpt-4o', 'gpt-4o-mini'] },
  { key: 'gemini', label: 'Google (Gemini)', models: ['gemini-2.5-flash', 'gemini-2.5-pro'] },
  { key: 'ollama', label: 'Ollama (Self-Hosted)', models: [] },
  { key: 'glm_ocr_cloud', label: 'GLM-OCR (Cloud)', models: ['glm-ocr'] },
  { key: 'glm_ocr_local', label: 'GLM-OCR (Local/Ollama)', models: ['glm-ocr'] },
];

export function AiConfigPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useAiConfig();
  const updateConfig = useUpdateAiConfig();
  const testProvider = useTestAiProvider();

  const [form, setForm] = useState<any>({
    isEnabled: false,
    categorizationProvider: '',
    categorizationModel: '',
    ocrProvider: '',
    ocrModel: '',
    anthropicApiKey: '',
    openaiApiKey: '',
    geminiApiKey: '',
    ollamaBaseUrl: '',
    glmOcrApiKey: '',
    glmOcrBaseUrl: '',
    autoCategorizeOnImport: true,
    autoOcrOnUpload: true,
    categorizationConfidenceThreshold: 0.7,
    maxConcurrentJobs: 5,
    monthlyBudgetLimit: null as number | null,
  });
  const [saved, setSaved] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  useEffect(() => {
    if (data) {
      setForm((f: any) => ({
        ...f,
        isEnabled: data.isEnabled,
        categorizationProvider: data.categorizationProvider || '',
        categorizationModel: data.categorizationModel || '',
        ocrProvider: data.ocrProvider || '',
        ocrModel: data.ocrModel || '',
        ollamaBaseUrl: data.ollamaBaseUrl || '',
        glmOcrBaseUrl: data.glmOcrBaseUrl || '',
        autoCategorizeOnImport: data.autoCategorizeOnImport,
        autoOcrOnUpload: data.autoOcrOnUpload,
        categorizationConfidenceThreshold: data.categorizationConfidenceThreshold,
        maxConcurrentJobs: data.maxConcurrentJobs,
        monthlyBudgetLimit: data.monthlyBudgetLimit,
      }));
    }
  }, [data]);

  const handleTest = async (provider: string) => {
    try {
      const result = await testProvider.mutateAsync(provider);
      setTestResults((r) => ({ ...r, [provider]: { ok: result.success, msg: result.modelInfo || result.error || '' } }));
    } catch (e: any) {
      setTestResults((r) => ({ ...r, [provider]: { ok: false, msg: e.message } }));
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
        {/* Master Switch */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isEnabled}
              onChange={(e) => setForm((f: any) => ({ ...f, isEnabled: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-5 w-5" />
            <div>
              <span className="text-sm font-medium text-gray-700">Enable AI Processing</span>
              <p className="text-xs text-gray-500">Enables AI-powered categorization, OCR, and document classification</p>
            </div>
          </label>
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
                <Input label={p.label} type="password" value={form[p.field]}
                  onChange={(e) => setForm((f: any) => ({ ...f, [p.field]: e.target.value }))}
                  placeholder={p.hasKey ? '••••••••••• (configured)' : `Enter ${p.label}`} />
                <div className="pt-5">
                  <Button variant="secondary" size="sm" onClick={() => handleTest(p.key)}>Test</Button>
                </div>
              </div>
              {testResults[p.key] && (
                <p className={`text-xs ${testResults[p.key]!.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {testResults[p.key]!.ok ? <CheckCircle className="h-3 w-3 inline mr-1" /> : <XCircle className="h-3 w-3 inline mr-1" />}
                  {testResults[p.key]!.msg}
                </p>
              )}
            </div>
          ))}
          <Input label="Ollama Base URL" value={form.ollamaBaseUrl}
            onChange={(e) => setForm((f: any) => ({ ...f, ollamaBaseUrl: e.target.value }))}
            placeholder="http://localhost:11434" />
          <Input label="GLM-OCR API Key" type="password" value={form.glmOcrApiKey}
            onChange={(e) => setForm((f: any) => ({ ...f, glmOcrApiKey: e.target.value }))}
            placeholder={data?.hasGlmOcrKey ? '••••••••••• (configured)' : 'Enter GLM-OCR API Key'} />
          <Input label="GLM-OCR Base URL (local)" value={form.glmOcrBaseUrl}
            onChange={(e) => setForm((f: any) => ({ ...f, glmOcrBaseUrl: e.target.value }))}
            placeholder="http://localhost:11434" />
        </div>

        {/* Task Assignment */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Task Assignment</h2>
          {[
            { label: 'Categorization', providerField: 'categorizationProvider', modelField: 'categorizationModel' },
            { label: 'OCR / Document Parsing', providerField: 'ocrProvider', modelField: 'ocrModel' },
          ].map((task) => (
            <div key={task.providerField} className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{task.label} Provider</label>
                <select value={form[task.providerField]} onChange={(e) => setForm((f: any) => ({ ...f, [task.providerField]: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Not configured</option>
                  {PROVIDERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <input className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form[task.modelField]} onChange={(e) => setForm((f: any) => ({ ...f, [task.modelField]: e.target.value }))}
                  placeholder="e.g., claude-sonnet-4-20250514" />
              </div>
            </div>
          ))}
        </div>

        {/* Settings */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.autoCategorizeOnImport}
              onChange={(e) => setForm((f: any) => ({ ...f, autoCategorizeOnImport: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 h-4 w-4" />
            <span className="text-sm text-gray-700">Auto-categorize bank feed items on import</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.autoOcrOnUpload}
              onChange={(e) => setForm((f: any) => ({ ...f, autoOcrOnUpload: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 h-4 w-4" />
            <span className="text-sm text-gray-700">Auto-OCR receipts on upload</span>
          </label>
          <Input label="Confidence Threshold" type="number" step="0.05" min="0" max="1"
            value={String(form.categorizationConfidenceThreshold)}
            onChange={(e) => setForm((f: any) => ({ ...f, categorizationConfidenceThreshold: parseFloat(e.target.value) }))} />
          <Input label="Monthly Budget Limit ($)" type="number" step="1" min="0"
            value={form.monthlyBudgetLimit != null ? String(form.monthlyBudgetLimit) : ''}
            onChange={(e) => setForm((f: any) => ({ ...f, monthlyBudgetLimit: e.target.value ? parseFloat(e.target.value) : null }))}
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
                  const d = await res.json() as any;
                  setOllamaModels((d.models || []).map((m: any) => m.name));
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

        {updateConfig.error && <p className="text-sm text-red-600">{(updateConfig.error as any).message}</p>}
        <Button onClick={() => { updateConfig.mutate(form); setSaved(true); setTimeout(() => setSaved(false), 3000); }} loading={updateConfig.isPending}>
          Save Configuration
        </Button>
      </div>
    </div>
  );
}

function UsageSummarySection() {
  const { data } = useQuery({ queryKey: ['ai', 'admin-usage'], queryFn: () => apiClient<any>('/ai/admin/usage?months=1') });
  const rows = (data?.rows || []) as any[];
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

function PromptEditorSection() {
  const { data } = useQuery({ queryKey: ['ai', 'prompts'], queryFn: () => apiClient<any>('/ai/admin/prompts') });
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [newPrompt, setNewPrompt] = useState(false);
  const [form, setForm] = useState({ taskType: 'categorize', systemPrompt: '', userPromptTemplate: '', notes: '' });

  const saveMutation = useMutation({
    mutationFn: (input: any) => editing
      ? apiClient(`/ai/admin/prompts/${editing.id}`, { method: 'PUT', body: JSON.stringify(input) })
      : apiClient('/ai/admin/prompts', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { setEditing(null); setNewPrompt(false); queryClient.invalidateQueries({ queryKey: ['ai', 'prompts'] }); },
  });

  const prompts = data?.prompts || [];

  return (
    <div className="space-y-3">
      {prompts.filter((p: any) => p.isActive).map((p: any) => (
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
            <select value={form.taskType} onChange={(e) => setForm((f) => ({ ...f, taskType: e.target.value }))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="categorize">Categorize</option>
              <option value="ocr_receipt">Receipt OCR</option>
              <option value="ocr_statement">Statement Parsing</option>
              <option value="classify_document">Document Classification</option>
            </select>
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
      setTimeout(() => setSavedNote(false), 3000);
    },
  });

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
