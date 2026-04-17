// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { useGenerateJE, usePostJE } from '../../api/hooks/usePayrollImport';
import type { PayrollJEPreview as JEPreviewType } from '@kis-books/shared';

interface Props {
  sessionId: string;
  importMode: string;
  onComplete: () => void;
}

export function JEPreview({ sessionId, importMode, onComplete }: Props) {
  const generateMutation = useGenerateJE();
  const postMutation = usePostJE();
  const [previews, setPreviews] = useState<JEPreviewType[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [overlaps, setOverlaps] = useState<Array<{ sessionId: string; filename: string; payPeriod: string; postedDate: string }>>([]);
  const [showOverlapWarning, setShowOverlapWarning] = useState(false);

  useEffect(() => {
    generateMutation.mutateAsync({ sessionId, options: { aggregationMode: 'summary' } })
      .then(data => setPreviews(data.previews));
  }, [sessionId]);

  const handlePost = async (forcePost = false) => {
    const result = await postMutation.mutateAsync({ sessionId, forcePost });
    if (result.requiresConfirmation && result.overlaps) {
      setOverlaps(result.overlaps);
      setShowOverlapWarning(true);
      return;
    }
    onComplete();
  };

  if (generateMutation.isPending) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        <p className="mt-4 text-gray-600">Generating journal entries...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Journal Entry Preview
          {previews.length > 1 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({previews.length} journal entries)
            </span>
          )}
        </h3>
      </div>

      {previews.map((preview, idx) => (
        <div key={idx} className="bg-white rounded-lg border border-gray-200 shadow-sm">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">
                  {previews.length > 1 && `JE ${idx + 1}: `}
                  {preview.date}
                </p>
                <p className="text-sm text-gray-600">{preview.memo}</p>
              </div>
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                preview.isBalanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {preview.isBalanced ? 'Balanced' : 'NOT BALANCED'}
              </div>
            </div>
          </div>

          {/* Lines table */}
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Description</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">Debit</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {preview.lines.map((line, li) => (
                <tr key={li} className={line.accountId ? '' : 'bg-red-50'}>
                  <td className="px-6 py-2 text-sm">
                    {line.accountId ? (
                      <span>
                        {line.accountNumber && <span className="text-gray-400 mr-1">{line.accountNumber}</span>}
                        {line.accountName}
                      </span>
                    ) : (
                      <span className="text-red-600 italic">Unmapped</span>
                    )}
                  </td>
                  <td className="px-6 py-2 text-sm text-gray-600">{line.description}</td>
                  <td className="px-6 py-2 text-sm text-right font-mono">
                    {line.debit !== '0.00' && `$${parseFloat(line.debit).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </td>
                  <td className="px-6 py-2 text-sm text-right font-mono">
                    {line.credit !== '0.00' && `$${parseFloat(line.credit).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-medium">
                <td className="px-6 py-3 text-sm" colSpan={2}>Total</td>
                <td className="px-6 py-3 text-sm text-right font-mono">
                  ${parseFloat(preview.totalDebits).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-3 text-sm text-right font-mono">
                  ${parseFloat(preview.totalCredits).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={() => window.history.back()}>Back</Button>
        <div className="flex gap-3">
          {!showConfirm ? (
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={previews.some(p => !p.isBalanced || p.lines.some(l => !l.accountId))}
            >
              Post Journal {previews.length > 1 ? 'Entries' : 'Entry'}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button onClick={() => handlePost()} loading={postMutation.isPending}>
                Confirm Post
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Overlap warning dialog */}
      {showOverlapWarning && overlaps.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">Overlapping Payroll Detected</h4>
          <p className="text-sm text-yellow-700 mb-3">
            This payroll period overlaps with previously posted imports. Posting may result in duplicate entries.
          </p>
          <ul className="space-y-1 mb-4">
            {overlaps.map(o => (
              <li key={o.sessionId} className="text-sm text-yellow-700 flex items-center gap-2">
                <span className="text-yellow-500">&#9888;</span>
                <span>
                  <strong>{o.filename}</strong> — {o.payPeriod} (posted {o.postedDate})
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setShowOverlapWarning(false); setShowConfirm(false); }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => { setShowOverlapWarning(false); handlePost(true); }}
              loading={postMutation.isPending}
            >
              I Understand, Post Anyway
            </Button>
          </div>
        </div>
      )}

      {postMutation.isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {(postMutation.error as Error).message}
        </div>
      )}
    </div>
  );
}
