// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/forms/DatePicker';
import { X } from 'lucide-react';

export interface EditableSchedule {
  id: string;
  name?: string | null;
  frequency: string;
  intervalValue: number;
  mode: string;
  startDate: string;
  endDate?: string | null;
}

interface RecurringScheduleModalProps {
  // Create mode: build a schedule from this transaction.
  transactionId?: string;
  // Edit mode: an existing schedule to update.
  schedule?: EditableSchedule;
  onClose: () => void;
}

const frequencies = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

function previewOccurrences(startDate: string, frequency: string, interval: number): string[] {
  const d = new Date(startDate);
  // Guard against an empty / half-typed / invalid date — calling toISOString()
  // on an Invalid Date throws "RangeError: Invalid time value", which used to
  // crash the whole modal while the user was changing the date.
  if (Number.isNaN(d.getTime())) return [];
  const step = Math.max(1, Math.floor(interval) || 1);
  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    dates.push(d.toISOString().split('T')[0]!);
    switch (frequency) {
      case 'daily': d.setDate(d.getDate() + step); break;
      case 'weekly': d.setDate(d.getDate() + 7 * step); break;
      case 'monthly': d.setMonth(d.getMonth() + step); break;
      case 'quarterly': d.setMonth(d.getMonth() + 3 * step); break;
      case 'annually': d.setFullYear(d.getFullYear() + step); break;
    }
  }
  return dates;
}

export function RecurringScheduleModal({ transactionId, schedule, onClose }: RecurringScheduleModalProps) {
  const isEdit = !!schedule;
  const today = todayLocalISO();
  const [name, setName] = useState(schedule?.name ?? '');
  const [frequency, setFrequency] = useState(schedule?.frequency ?? 'monthly');
  const [intervalValue, setIntervalValue] = useState(schedule?.intervalValue ?? 1);
  const [mode, setMode] = useState(schedule?.mode ?? 'auto');
  const [startDate, setStartDate] = useState(schedule?.startDate ?? today);
  const [endDate, setEndDate] = useState(schedule?.endDate ?? '');

  const queryClient = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: () => isEdit
      ? apiClient(`/recurring/${schedule!.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: name.trim() || null, frequency, intervalValue, mode, startDate, endDate: endDate || null }),
        })
      : apiClient('/recurring', {
          method: 'POST',
          body: JSON.stringify({ templateTransactionId: transactionId, name: name.trim() || undefined, frequency, intervalValue, mode, startDate, endDate: endDate || undefined }),
        }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurring'] }); onClose(); },
  });

  const upcoming = previewOccurrences(startDate, frequency, intervalValue);

  const submit = (e: FormEvent) => { e.preventDefault(); if (startDate) saveMutation.mutate(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={submit} className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Recurring Schedule' : 'Make Recurring'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly rent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {frequencies.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Every</label>
            <input type="number" min={1} value={intervalValue}
              onChange={(e) => setIntervalValue(Math.max(1, Number(e.target.value) || 1))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="auto">Auto-post</option>
              <option value="reminder">Reminder only</option>
            </select>
          </div>
          <DatePicker label="Start Date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <DatePicker label="End Date (optional)" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Next 5 occurrences:</p>
            {upcoming.length > 0
              ? upcoming.map((d, i) => <p key={i} className="text-xs text-gray-600">{d}</p>)
              : <p className="text-xs text-gray-400">Pick a valid start date to preview.</p>}
          </div>

          {saveMutation.error && (
            <p className="text-sm text-red-600">{saveMutation.error instanceof Error ? saveMutation.error.message : 'Could not save the schedule.'}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saveMutation.isPending} disabled={!startDate}>
            {isEdit ? 'Save Changes' : 'Create Schedule'}
          </Button>
        </div>
      </form>
    </div>
  );
}
