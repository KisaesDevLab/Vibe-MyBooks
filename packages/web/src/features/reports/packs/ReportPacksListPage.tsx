// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Saved Report Packs — the list/table of a company's reusable pack templates.
//
// Row actions: Run (one-tap → create a run → go to the run page), Edit
// (builder), Duplicate, and Delete (confirm → soft delete). New Report Pack
// opens the builder in create mode.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Pencil, Copy, Trash2 } from 'lucide-react';
import type { PeriodPreset } from '@kis-books/shared';
import {
  useReportPacks,
  useDeleteReportPack,
  useDuplicateReportPack,
  useCreatePackRun,
} from '../../../api/hooks/useReportPacks';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../components/ui/Toaster';

const PRESET_LABELS: Record<PeriodPreset, string> = {
  'this-month': 'This Month',
  'last-month': 'Last Month',
  qtd: 'Quarter to Date',
  'last-quarter': 'Last Quarter',
  ytd: 'Year to Date',
  'last-year': 'Last Year',
  custom: 'Custom',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function ReportPacksListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useReportPacks();
  const deletePack = useDeleteReportPack();
  const duplicatePack = useDuplicateReportPack();
  const createRun = useCreatePackRun();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const packs = data?.packs ?? [];

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      const run = await createRun.mutateAsync({ packId: id });
      navigate(`/reports/packs/runs/${run.id}`);
    } catch (err) {
      toast.error('Could not start the run', { detail: (err as Error).message });
      setRunningId(null);
    }
  };

  const handleDuplicate = (id: string) => {
    duplicatePack.mutate(id, {
      onSuccess: () => toast.success('Report pack duplicated'),
      onError: (err: Error) => toast.error('Could not duplicate', { detail: err.message }),
    });
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    deletePack.mutate(id, {
      onSuccess: () => toast.success(`Deleted '${name}'`),
      onError: (err: Error) => toast.error('Could not delete', { detail: err.message }),
    });
    setPendingDelete(null);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Report Packs</h1>
        <Button onClick={() => navigate('/reports/packs/new')}>
          <Plus className="h-4 w-4 mr-1" /> New Report Pack
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner className="py-16" />
      ) : isError ? (
        <ErrorMessage onRetry={refetch} />
      ) : packs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
          <p className="text-gray-600 mb-4">
            No report packs yet. Bundle several reports into one combined PDF you can reuse.
          </p>
          <Button onClick={() => navigate('/reports/packs/new')}>
            <Plus className="h-4 w-4 mr-1" /> New Report Pack
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="py-3 px-4 font-medium">Name</th>
                <th className="py-3 px-4 font-medium"># Reports</th>
                <th className="py-3 px-4 font-medium">Period</th>
                <th className="py-3 px-4 font-medium">Updated</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((pack) => (
                <tr key={pack.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => navigate(`/reports/packs/${pack.id}/edit`)}
                      className="font-medium text-gray-800 hover:text-primary-600 text-left"
                    >
                      {pack.name}
                    </button>
                    {pack.description && (
                      <div className="text-xs text-gray-500 truncate max-w-xs">{pack.description}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-600">{pack.itemCount}</td>
                  <td className="py-3 px-4 text-gray-600">{PRESET_LABELS[pack.periodPreset] ?? pack.periodPreset}</td>
                  <td className="py-3 px-4 text-gray-600">{formatDate(pack.updatedAt)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRun(pack.id)}
                        loading={runningId === pack.id}
                        disabled={pack.itemCount === 0}
                      >
                        <Play className="h-4 w-4 mr-1" /> Run
                      </Button>
                      <button
                        type="button"
                        onClick={() => navigate(`/reports/packs/${pack.id}/edit`)}
                        className="p-2 text-gray-400 hover:text-gray-700"
                        aria-label={`Edit ${pack.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(pack.id)}
                        className="p-2 text-gray-400 hover:text-gray-700"
                        aria-label={`Duplicate ${pack.name}`}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ id: pack.id, name: pack.name })}
                        className="p-2 text-gray-400 hover:text-red-600"
                        aria-label={`Delete ${pack.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete report pack?"
        message={pendingDelete ? `'${pendingDelete.name}' will be removed. This cannot be undone.` : undefined}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
