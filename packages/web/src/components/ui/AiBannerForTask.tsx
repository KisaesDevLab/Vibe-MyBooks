import { useAiConsentStatus, type AiTaskKey } from '../../api/hooks/useAi';
import { AiDisclosureBadge } from './AiDisclosureBadge';

/**
 * Surface-level helper that looks up system + tenant consent state and
 * renders an `AiDisclosureBadge` when AI is actively available for a
 * given task in the current tenant.
 *
 * Uses the tenant-scoped /ai/consent endpoint (not the admin-only
 * /ai/admin/config), so it works for all authenticated users.
 */
export function AiBannerForTask({ task }: { task: AiTaskKey }) {
  const { data: status } = useAiConsentStatus();

  if (!status?.systemEnabled) return null;
  const activeCompany = status.companies.find((c) => c.aiEnabled && !c.isStale && c.tasks?.[task]);
  if (!activeCompany) return null;

  const providerName = task === 'categorization'
    ? status.categorizationProvider
    : task === 'document_classification'
      ? status.documentClassificationProvider || status.categorizationProvider
      : status.ocrProvider || status.categorizationProvider;

  const selfHosted = providerName === 'ollama' || providerName === 'glm_ocr_local';

  return (
    <AiDisclosureBadge
      provider={labelForProvider(providerName)}
      piiLevel={status.piiProtectionLevel || 'strict'}
      selfHosted={selfHosted}
    />
  );
}

function labelForProvider(p: string | null | undefined): string | null {
  if (!p) return null;
  switch (p) {
    case 'anthropic': return 'Anthropic';
    case 'openai': return 'OpenAI';
    case 'gemini': return 'Gemini';
    case 'ollama': return 'Ollama (local)';
    case 'glm_ocr_local': return 'GLM-OCR (local)';
    case 'glm_ocr_cloud': return 'GLM-OCR Cloud';
    default: return p;
  }
}
