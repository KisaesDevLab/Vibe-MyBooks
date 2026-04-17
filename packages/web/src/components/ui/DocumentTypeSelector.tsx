// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { FileText, Receipt, Landmark, FileWarning, HelpCircle } from 'lucide-react';

/**
 * Manual document type selector — shown as a fallback when the AI
 * document classifier returns 'other' or low confidence (< 0.6).
 *
 * See Build Plans/AI_PII_PROTECTION_ADDENDUM.md §Document
 * classification uncertain.
 *
 * Usage:
 *   <DocumentTypeSelector
 *     onSelect={(type) => routeToProcessingPipeline(type, attachmentId)}
 *   />
 */
export type DocumentType = 'receipt' | 'invoice' | 'bank_statement' | 'tax_form' | 'other';

const options: Array<{ type: DocumentType; label: string; desc: string; icon: typeof FileText }> = [
  { type: 'receipt', label: 'Receipt', desc: 'A purchase receipt from a store or vendor', icon: Receipt },
  { type: 'invoice', label: 'Invoice / Bill', desc: 'A vendor invoice or bill for goods/services', icon: FileText },
  { type: 'bank_statement', label: 'Bank Statement', desc: 'A monthly account statement from a bank', icon: Landmark },
  { type: 'tax_form', label: 'Tax Form', desc: 'W-2, 1099, or other IRS/state tax document', icon: FileWarning },
  { type: 'other', label: 'Other / Skip', desc: 'Not a financial document, or skip classification', icon: HelpCircle },
];

export function DocumentTypeSelector({ onSelect }: { onSelect: (type: DocumentType) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">What type of document is this?</p>
      <p className="text-xs text-gray-500">We couldn't determine the document type automatically. Select one to continue processing.</p>
      <div className="grid grid-cols-1 gap-2 mt-3">
        {options.map((opt) => (
          <button
            key={opt.type}
            type="button"
            onClick={() => onSelect(opt.type)}
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition-colors text-left group"
          >
            <div className="p-2 rounded bg-gray-100 group-hover:bg-primary-100 transition-colors">
              <opt.icon className="h-4 w-4 text-gray-600 group-hover:text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 group-hover:text-primary-700">{opt.label}</p>
              <p className="text-xs text-gray-500">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default DocumentTypeSelector;
