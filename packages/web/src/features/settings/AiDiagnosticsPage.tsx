// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Brain, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { useAiDiagnostics } from '../../api/hooks/useAi';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

/**
 * Non-admin diagnostics page. Shows whether each AI task is wired up
 * and whether the most recent admin-side test succeeded — so a company
 * owner can self-diagnose ("why isn't receipt OCR auto-filling?")
 * before contacting the super admin.
 *
 * Read-only: pulls from the cached provider_test_history and never
 * pings upstream. Use the admin self-test button to refresh.
 */
export function AiDiagnosticsPage() {
  const { data, isLoading, isError, refetch } = useAiDiagnostics();

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError || !data) return <ErrorMessage message="Failed to load diagnostics." onRetry={() => refetch()} />;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">AI Diagnostics</h1>
      </div>

      <p className="text-sm text-gray-600">
        Status of each AI feature for your workspace. This view reflects the most recent
        administrator test result — it does not ping the AI provider when you load this
        page. Ask your administrator to re-run the self-test from System Settings if you
        suspect something has changed.
      </p>

      {!data.systemEnabled && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          AI processing is currently disabled by your administrator. No tasks below will
          run regardless of their configured state.
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">AI task readiness by configured provider</caption>
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Task</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Provider</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Last verified</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-2 text-gray-800 font-medium">{labelForTask(row.task)}</td>
                <td className="px-3 py-2 text-gray-600">
                  {row.provider || <span className="text-gray-400 italic">(not configured)</span>}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge row={row} />
                </td>
                <td className="px-3 py-2 text-gray-500">
                  {row.lastVerifiedAt
                    ? new Date(row.lastVerifiedAt).toLocaleString()
                    : <span className="text-gray-400 italic">never</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        A failed status here doesn't necessarily mean an outage — it just means the most
        recent administrator-side test for that provider returned an error. Ask your
        administrator to re-run the self-test for an up-to-date check.
      </p>
    </div>
  );
}

function labelForTask(task: string): string {
  switch (task) {
    case 'categorization': return 'Transaction categorization';
    case 'ocr': return 'Receipt / bill OCR';
    case 'document_classification': return 'Document classification';
    case 'chat': return 'Chat assistant';
    default: return task;
  }
}

function StatusBadge({ row }: { row: { status: string; error?: string; modelInfo?: string } }) {
  switch (row.status) {
    case 'ok':
      return (
        <span className="inline-flex items-center gap-1 text-green-700">
          <CheckCircle className="h-3.5 w-3.5" />
          OK{row.modelInfo ? ` — ${row.modelInfo}` : ''}
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 text-red-600">
          <XCircle className="h-3.5 w-3.5" />
          {row.error || 'Failed'}
        </span>
      );
    case 'untested':
      return (
        <span className="inline-flex items-center gap-1 text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          Not yet verified
        </span>
      );
    case 'not_configured':
      return <span className="text-gray-500 italic">Not configured</span>;
    default:
      return <span className="text-gray-500">{row.status}</span>;
  }
}
