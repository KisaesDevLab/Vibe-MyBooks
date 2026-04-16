import { useState, type ReactNode } from 'react';
import { Brain } from 'lucide-react';

/**
 * Small pill badge that marks a screen (or row) as AI-assisted.
 *
 * See Build Plans/AI_PII_PROTECTION_ADDENDUM.md §On-Screen AI Usage
 * Disclosure. The badge is intentionally unobtrusive — the user sees a
 * compact marker indicating AI is active, and clicks through for
 * details about what data was sent and to whom.
 */
export interface AiDisclosureBadgeProps {
  /** Provider label (e.g. "Anthropic Claude"). Omit when unknown. */
  provider?: string | null;
  /** PII protection level: 'strict' / 'standard' / 'permissive'. */
  piiLevel?: string | null;
  /**
   * When true, all processing happened locally — the popover shows
   * the "no data sent externally" variant.
   */
  selfHosted?: boolean;
  /** Optional list of redacted PII categories to display in the popover. */
  piiRedacted?: string[];
  /** Optional quality warnings (e.g. "tesseract_local_ocr"). */
  qualityWarnings?: string[];
  /** Compact mode — single-icon, no text. Use inside a cramped table row. */
  compact?: boolean;
  /** Additional content inside the popover. */
  children?: ReactNode;
}

const LEVEL_COPY: Record<string, { whatSent: string[]; whatNotSent: string[] }> = {
  strict: {
    whatSent: [
      'Sanitized transaction descriptions, amounts, and dates',
      'OCR-extracted text (images stay on your server)',
      'Your chart of accounts names',
    ],
    whatNotSent: [
      'Account numbers or routing numbers',
      'Personal names in Venmo / Zelle / PayPal / Cash App descriptions',
      'Raw document images',
      'Aggregate balances or reports',
    ],
  },
  standard: {
    whatSent: [
      'Sanitized transaction descriptions, amounts, and dates',
      'OCR-extracted text (images stay on your server for most documents)',
      'Your chart of accounts names',
    ],
    whatNotSent: [
      'Account numbers or routing numbers',
      'Personal names in Venmo / Zelle / PayPal / Cash App descriptions',
      'Raw bank statement images',
    ],
  },
  permissive: {
    whatSent: [
      'Sanitized transaction descriptions, amounts, and dates',
      'OCR-extracted text',
      'Document images when local OCR is insufficient (cloud vision enabled)',
      'Your chart of accounts names',
    ],
    whatNotSent: [
      'Personal names in Venmo / Zelle / PayPal / Cash App descriptions',
      'SSN and EIN values',
    ],
  },
};

export function AiDisclosureBadge({
  provider,
  piiLevel,
  selfHosted,
  piiRedacted,
  qualityWarnings,
  compact,
  children,
}: AiDisclosureBadgeProps) {
  const [open, setOpen] = useState(false);
  const levelKey = (piiLevel || 'strict').toLowerCase();
  const copy = LEVEL_COPY[levelKey] ?? LEVEL_COPY['strict']!;

  const label = selfHosted
    ? `AI-assisted \u00b7 local`
    : `AI-assisted${piiLevel ? ` \u00b7 ${piiLevel}` : ''}${provider ? ` \u00b7 ${provider}` : ''}`;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700 hover:bg-primary-100 transition-colors ${compact ? '' : ''}`}
        aria-label="AI processing details"
      >
        <Brain className="h-3 w-3" />
        {!compact && <span>{label}</span>}
      </button>

      {open && (
        <div className="absolute z-40 top-full mt-1 left-0 w-80 rounded-lg border border-gray-200 bg-white shadow-lg p-4 text-sm text-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">AI Processing Details</h3>
          {selfHosted ? (
            <>
              <p className="text-xs text-gray-600">Provider: <span className="font-medium text-gray-800">{provider || 'Self-hosted'}</span></p>
              <p className="text-xs text-gray-600 mt-1">PII Protection: <span className="font-medium text-gray-800">N/A (local processing)</span></p>
              <div className="mt-3 bg-green-50 border border-green-200 rounded p-2 text-xs text-green-900">
                All processing was performed locally on your server. No data was sent to any external service.
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-600">Provider: <span className="font-medium text-gray-800">{provider || 'Configured cloud provider'}</span></p>
              <p className="text-xs text-gray-600 mt-1">PII Protection: <span className="font-medium text-gray-800 capitalize">{piiLevel || 'strict'}</span></p>

              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">What was sent</p>
                <ul className="mt-1 space-y-0.5 text-xs text-gray-700 list-disc list-inside">
                  {copy.whatSent.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>

              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">What was NOT sent</p>
                <ul className="mt-1 space-y-0.5 text-xs text-gray-700 list-disc list-inside">
                  {copy.whatNotSent.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>

              {piiRedacted && piiRedacted.length > 0 && (
                <div className="mt-3 text-xs">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Redacted on this request</p>
                  <p className="text-gray-700 mt-0.5">{piiRedacted.join(', ')}</p>
                </div>
              )}
            </>
          )}

          {qualityWarnings && qualityWarnings.length > 0 && (
            <div className="mt-3 text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-900">
              {qualityWarnings.includes('tesseract_local_ocr') && (
                <p>Local Tesseract OCR was used. For better accuracy on scanned documents, ask your administrator to enable GLM-OCR.</p>
              )}
              {qualityWarnings.includes('cloud_vision_used') && (
                <p>Cloud vision was used because local OCR was insufficient. The raw document image was sent to the cloud provider.</p>
              )}
            </div>
          )}

          {children}

          <div className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
            Manage AI settings in Settings &rarr; AI Processing.
          </div>
        </div>
      )}
    </span>
  );
}

export default AiDisclosureBadge;
