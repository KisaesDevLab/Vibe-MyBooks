// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/forms/DatePicker';
import { X } from 'lucide-react';

interface RecurringScheduleModalProps {
  transactionId: string;
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
  const dates: string[] = [];
  const d = new Date(startDate);
  for (let i = 0; i < 5; i++) {
    dates.push(d.toISOString().split('T')[0]!);
    switch (frequency) {
      case 'daily': d.setDate(d.getDate() + interval); break;
      case 'weekly': d.setDate(d.getDate() + 7 * interval); break;
      case 'monthly': d.setMonth(d.getMonth() + interval); break;
      case 'quarterly': d.setMonth(d.getMonth() + 3 * interval); break;
      case 'annually': d.setFullYear(d.getFullYear() + interval); break;
    }
  }
  return dates;
}

export function RecurringScheduleModal({ transactionId, onClose }: RecurringScheduleModalProps) {
  const today = todayLocalISO();
  const [frequency, setFrequency] = useState('monthly');
  const [intervalValue, setIntervalValue] = useState(1);
  const [mode, setMode] = useState('auto');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');

  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: () => apiClient('/recurring', {
      method: 'POST',
      body: JSON.stringify({ templateTransactionId: transactionId, frequency, intervalValue, mode, startDate, endDate: endDate || undefined }),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurring'] }); onClose(); },
  });

  const upcoming = previewOccurrences(startDate, frequency, intervalValue);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Make Recurring</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {frequencies.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Every</label>
            <input type="number" min={1} value={intervalValue} onChange={(e) => setIntervalValue(+e.target.value)}
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
            {upcoming.map((d, i) => <p key={i} className="text-xs text-gray-600">{d}</p>)}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>Create Schedule</Button>
        </div>
      </div>
    </div>
  );
}
