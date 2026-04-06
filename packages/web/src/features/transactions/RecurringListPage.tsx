import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Play, Pause } from 'lucide-react';

interface RecurringSchedule {
  id: string; templateTransactionId: string; frequency: string;
  intervalValue: number; mode: string; startDate: string; endDate: string | null;
  nextOccurrence: string; isActive: string; lastPostedAt: string | null;
}

export function RecurringListPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['recurring'],
    queryFn: () => apiClient<{ schedules: RecurringSchedule[] }>('/recurring'),
  });

  const postNow = useMutation({
    mutationFn: (id: string) => apiClient(`/recurring/${id}/post-now`, { method: 'POST' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurring'] }); queryClient.invalidateQueries({ queryKey: ['transactions'] }); },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => apiClient(`/recurring/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  const schedules = data?.schedules || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Recurring Transactions</h1>

      {schedules.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center text-gray-500">
          No recurring transactions. Set one up from a transaction's detail page.
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Next Occurrence</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Last Posted</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 capitalize">{s.frequency}{s.intervalValue > 1 ? ` (every ${s.intervalValue})` : ''}</td>
                  <td className="px-4 py-2 capitalize">{s.mode}</td>
                  <td className="px-4 py-2">{s.nextOccurrence}</td>
                  <td className="px-4 py-2 text-gray-500">{s.lastPostedAt ? new Date(s.lastPostedAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.isActive === 'true' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.isActive === 'true' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => postNow.mutate(s.id)} loading={postNow.isPending}>
                        <Play className="h-3 w-3 mr-1" /> Post Now
                      </Button>
                      {s.isActive === 'true' && (
                        <Button variant="ghost" size="sm" onClick={() => deactivate.mutate(s.id)}>
                          <Pause className="h-3 w-3 mr-1" /> Stop
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
