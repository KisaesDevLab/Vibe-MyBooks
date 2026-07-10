// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useNavigate } from 'react-router-dom';
import { useDailySalesEntries, useDailySalesTemplates } from '../../api/hooks/useDailySales';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Plus, Settings, AlertTriangle, RefreshCw, FileText } from 'lucide-react';

function statusBadge(status: string): { label: string; cls: string } {
  if (status === 'posted') return { label: 'Posted', cls: 'bg-green-100 text-green-700' };
  if (status === 'void') return { label: 'Void', cls: 'bg-gray-100 text-gray-500' };
  return { label: 'Draft', cls: 'bg-amber-100 text-amber-700' };
}
const money = (s: string | null) => `$${parseFloat(s || '0').toFixed(2)}`;

export function DailySalesEntriesPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useDailySalesEntries();
  const { data: tplData } = useDailySalesTemplates();
  const entries = data?.entries ?? [];
  const hasTemplates = (tplData?.templates?.length ?? 0) > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Sales</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your POS X/Z report totals; each day posts a balanced journal entry.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/daily-sales/templates')}>
            <Settings className="h-4 w-4 mr-1" /> Templates
          </Button>
          <Button onClick={() => navigate('/daily-sales/new')} disabled={!hasTemplates}>
            <Plus className="h-4 w-4 mr-1" /> New daily entry
          </Button>
        </div>
      </div>

      {!hasTemplates && !isLoading && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm text-amber-800">
          Create a Daily Sales template first (map your Z-report lines to accounts), then you can enter daily totals.{' '}
          <button className="underline font-medium" onClick={() => navigate('/daily-sales/templates')}>Set up a template →</button>
        </div>
      )}

      {isLoading && <div className="bg-white rounded-lg border p-12 flex justify-center"><LoadingSpinner /></div>}

      {isError && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700 mb-3">Couldn’t load daily sales entries.</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-1" /> Retry</Button>
        </div>
      )}

      {!isLoading && !isError && entries.length === 0 && hasTemplates && (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No daily sales entered yet.</p>
          <div className="mt-4"><Button onClick={() => navigate('/daily-sales/new')}><Plus className="h-4 w-4 mr-1" /> New daily entry</Button></div>
        </div>
      )}

      {!isLoading && !isError && entries.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Template</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Sales</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Tax</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Over/Short</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => {
                const b = statusBadge(e.status);
                const os = parseFloat(e.overShortAmount || '0');
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{e.businessDate}</td>
                    <td className="px-4 py-2 text-gray-600">{e.templateName ?? '—'}</td>
                    <td className="px-4 py-2 text-right font-mono">{money(e.totalSales)}</td>
                    <td className="px-4 py-2 text-right font-mono">{money(e.totalTax)}</td>
                    <td className={`px-4 py-2 text-right font-mono ${os === 0 ? 'text-gray-400' : os > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {os === 0 ? '—' : money(e.overShortAmount)}
                    </td>
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span></td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/daily-sales/entries/${e.id}`)}>
                        {e.status === 'draft' ? 'Review & post' : 'View'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
