// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { AlertTriangle, Info } from 'lucide-react';

/**
 * Renders an amber notice when the AI job used a lower-quality local
 * OCR path (Tesseract) or fell through to cloud vision. Silent when
 * no warnings are present.
 *
 * Warning codes are emitted by the API's `withAiMetadata` helper —
 * see ai-orchestrator.service.ts / ai-receipt-ocr.service.ts.
 */
export function OcrQualityNotice({ warnings }: { warnings: string[] | undefined | null }) {
  if (!warnings || warnings.length === 0) return null;

  if (warnings.includes('cloud_vision_used')) {
    return (
      <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          Cloud vision was used because local OCR could not process this document. The raw image was sent to the configured cloud provider per your administrator's Permissive PII settings.
        </div>
      </div>
    );
  }

  if (warnings.includes('tesseract_local_ocr')) {
    return (
      <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          Processed with local Tesseract OCR. Some values may be inaccurate — double-check the vendor, amounts, and dates before saving. For better accuracy, ask your administrator to configure GLM-OCR.
        </div>
      </div>
    );
  }

  if (warnings.includes('scanned_statement_quality_reduced')) {
    return (
      <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          This scanned statement was processed locally. Accuracy is reduced for table-heavy documents — review every row before importing.
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
      <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <div>Processing notes: {warnings.join(', ')}</div>
    </div>
  );
}
