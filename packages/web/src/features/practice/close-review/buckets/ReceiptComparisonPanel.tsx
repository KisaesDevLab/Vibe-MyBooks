// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Receipt, AlertTriangle, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import type { BucketReceiptOcr } from '@kis-books/shared';

interface Props {
  // OCR snapshot from the most recent attached receipt.
  ocr: BucketReceiptOcr;
  // Bank-feed amount for the row, as the absolute dollar figure.
  bankAmount: number;
  // Bank-feed descriptor + date for context.
  bankDescription: string;
  bankDate: string;
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// Inline panel that surfaces the OCR-extracted receipt fields
// alongside the bank-feed amount + date so the bookkeeper can spot
// mismatches at a glance. The `receipt_amount_mismatch` review
// check creates a finding when variance exceeds tolerance, but
// this panel renders for every attached-receipt row regardless of
// whether a finding was raised — even small matching receipts are
// useful audit context.
export function ReceiptComparisonPanel({ ocr, bankAmount, bankDescription, bankDate }: Props) {
  const ocrTotal = ocr.total ? parseFloat(ocr.total) : null;
  const variance = ocrTotal !== null ? ocrTotal - bankAmount : null;
  const tolerance = Math.max(1, Math.abs(bankAmount) * 0.02);
  const mismatch = variance !== null && Math.abs(variance) > tolerance;

  return (
    <div
      className={clsx(
        'mt-2 rounded-lg border px-3 py-2 text-xs',
        mismatch
          ? 'border-amber-200 bg-amber-50'
          : 'border-emerald-200 bg-emerald-50',
      )}
    >
      <div className="flex items-center gap-1.5 font-semibold">
        {mismatch ? (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
        )}
        <span className={mismatch ? 'text-amber-800' : 'text-emerald-800'}>
          {mismatch ? 'Receipt amount differs from bank' : 'Receipt matches bank'}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500">Bank</div>
          <div className="font-mono text-gray-900">{fmt.format(bankAmount)}</div>
          <div className="text-gray-600 truncate" title={bankDescription}>
            {bankDescription}
          </div>
          <div className="text-gray-500">{bankDate}</div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500">
            <Receipt className="h-3 w-3" />
            Receipt (OCR)
          </div>
          <div className="font-mono text-gray-900">
            {ocrTotal !== null ? fmt.format(ocrTotal) : '—'}
          </div>
          <div className="text-gray-600 truncate" title={ocr.vendor ?? ''}>
            {ocr.vendor ?? '—'}
          </div>
          <div className="text-gray-500">{ocr.date ?? '—'}</div>
        </div>
      </div>
      {variance !== null && (
        <div
          className={clsx(
            'mt-1 text-[11px]',
            mismatch ? 'text-amber-800' : 'text-emerald-800',
          )}
        >
          Variance: <span className="font-mono">{fmt.format(variance)}</span>
        </div>
      )}
    </div>
  );
}
