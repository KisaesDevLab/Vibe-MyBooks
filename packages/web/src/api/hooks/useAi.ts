// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

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
  | 'glm'
  // Second self-hosted option: any server that exposes the
  // OpenAI-compatible `/v1/chat/completions` endpoint — Ollama's /v1
  // interface, llama.cpp's built-in server, LM Studio, vLLM, etc.
  // Configured via openaiCompatBaseUrl / openaiCompatModel / key.
  | 'openai_compat';
export type PiiProtectionLevel = 'strict' | 'redact_sensitive' | 'allow_raw';
export type ChatDataAccessLevel = 'none' | 'contextual' | 'full';

export interface AiConfigDto {
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
  hasGlmOcrKey: boolean;
  glmOcrBaseUrl: string | null;
  openaiCompatBaseUrl: string | null;
  openaiCompatModel: string | null;
  hasOpenaiCompatKey: boolean;
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
  adminDisclosureAcceptedAt: string | null;
  adminDisclosureAcceptedBy: string | null;
  disclosureVersion: number;
}

// Mutation input mirrors `updateConfig()` — every field is optional;
// unset keys mean "don't touch" on the server. Plaintext API keys are
// write-only (the server encrypts; reads return `hasXKey` booleans).
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
  glmOcrApiKey?: string | null;
  glmOcrBaseUrl?: string | null;
  openaiCompatApiKey?: string | null;
  openaiCompatBaseUrl?: string | null;
  openaiCompatModel?: string | null;
  autoCategorizeOnImport?: boolean;
  autoOcrOnUpload?: boolean;
  categorizationConfidenceThreshold?: number;
  maxConcurrentJobs?: number;
  trackUsage?: boolean;
  monthlyBudgetLimit?: number | null;
  chatSupportEnabled?: boolean;
  chatProvider?: AiProviderName | null;
  chatModel?: string | null;
  chatMaxHistory?: number;
  chatDataAccessLevel?: ChatDataAccessLevel;
  piiProtectionLevel?: PiiProtectionLevel;
  cloudVisionEnabled?: boolean;
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
  return useMutation({
    mutationFn: (provider: AiProviderName | string) =>
      apiClient<TestProviderResult>(`/ai/admin/test/${provider}`, { method: 'POST' }),
  });
}

export function useAiCategorize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (feedItemId: string) => apiClient('/ai/categorize', { method: 'POST', body: JSON.stringify({ feedItemId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-feed'] }),
  });
}

export function useAiBatchCategorize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (feedItemIds: string[]) => apiClient('/ai/categorize/batch', { method: 'POST', body: JSON.stringify({ feedItemIds }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-feed'] }),
  });
}

export function useAiOcrReceipt() {
  return useMutation({
    mutationFn: (attachmentId: string) => apiClient('/ai/ocr/receipt', { method: 'POST', body: JSON.stringify({ attachmentId }) }),
  });
}

export function useAiParseStatement() {
  return useMutation({
    mutationFn: (attachmentId: string) => apiClient('/ai/parse/statement', { method: 'POST', body: JSON.stringify({ attachmentId }) }),
  });
}

export function useAiClassify() {
  return useMutation({
    mutationFn: (attachmentId: string) => apiClient('/ai/classify', { method: 'POST', body: JSON.stringify({ attachmentId }) }),
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
    queryFn: () => apiClient<TenantConsentStatusDto>('/ai/consent'),
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
