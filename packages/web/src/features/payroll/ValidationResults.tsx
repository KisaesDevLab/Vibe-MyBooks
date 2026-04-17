// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { useValidateSession } from '../../api/hooks/usePayrollImport';
import type { PayrollValidationSummary, PayrollValidationMessage } from '@kis-books/shared';

interface Props {
  sessionId: string;
  importMode: string;
  onComplete: () => void;
}

export function ValidationResults({ sessionId, importMode, onComplete }: Props) {
  const validateMutation = useValidateSession();
  const [result, setResult] = useState<PayrollValidationSummary | null>(null);

  useEffect(() => {
    validateMutation.mutateAsync(sessionId).then(setResult);
  }, [sessionId]);

  if (validateMutation.isPending) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        <p className="mt-4 text-gray-600">Validating payroll data...</p>
      </div>
    );
  }

  if (!result) return null;

  const errors = result.messages.filter(m => m.severity === 'error');
  const warnings = result.messages.filter(m => m.severity === 'warning');
  const hasErrors = errors.length > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <h3 className="text-lg font-medium mb-4">Validation Results</h3>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-3 bg-gray-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-gray-900">{result.totalRows}</p>
          <p className="text-xs text-gray-500">Total Rows</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600">{result.validRows}</p>
          <p className="text-xs text-green-700">Valid</p>
        </div>
        <div className="p-3 bg-yellow-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-yellow-600">{result.warningRows}</p>
          <p className="text-xs text-yellow-700">Warnings</p>
        </div>
        <div className="p-3 bg-red-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-red-600">{result.errorRows}</p>
          <p className="text-xs text-red-700">Errors</p>
        </div>
      </div>

      {/* Errors table */}
      {errors.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-red-700 mb-2">Errors ({errors.length})</h4>
          <div className="border border-red-200 rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-red-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-red-700">Code</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-red-700">Field</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-red-700">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {errors.slice(0, 50).map((e, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-3 py-2 font-mono text-xs text-red-600">{e.code}</td>
                    <td className="px-3 py-2 text-gray-700">{e.field}</td>
                    <td className="px-3 py-2 text-gray-600">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {errors.length > 50 && (
              <div className="px-3 py-2 bg-red-50 text-xs text-red-600">
                ...and {errors.length - 50} more errors
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warnings table (collapsible) */}
      {warnings.length > 0 && (
        <details className="mb-6">
          <summary className="cursor-pointer text-sm font-medium text-yellow-700 mb-2">
            Warnings ({warnings.length}) — click to expand
          </summary>
          <div className="border border-yellow-200 rounded-lg overflow-hidden mt-2">
            <table className="min-w-full text-sm">
              <thead className="bg-yellow-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-yellow-700">Code</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-yellow-700">Field</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-yellow-700">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yellow-100">
                {warnings.slice(0, 50).map((w, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-3 py-2 font-mono text-xs text-yellow-600">{w.code}</td>
                    <td className="px-3 py-2 text-gray-700">{w.field}</td>
                    <td className="px-3 py-2 text-gray-600">{w.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={() => window.history.back()}>Back</Button>
        <div className="flex gap-3">
          {hasErrors ? (
            <p className="text-sm text-red-600 self-center">Fix errors before proceeding</p>
          ) : warnings.length > 0 ? (
            <Button onClick={onComplete}>
              Continue with Warnings
            </Button>
          ) : (
            <Button onClick={onComplete}>
              Continue to Preview
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
