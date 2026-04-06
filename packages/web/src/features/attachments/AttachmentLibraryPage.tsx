import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Paperclip, Download, Trash2 } from 'lucide-react';

interface Attachment {
  id: string; fileName: string; fileSize: number | null; mimeType: string | null;
  attachableType: string; attachableId: string; ocrStatus: string | null; createdAt: string;
}

export function AttachmentLibraryPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['attachments', 'all'],
    queryFn: () => apiClient<{ data: Attachment[]; total: number }>('/attachments?limit=100'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/attachments/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments'] }),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  const attachments = data?.data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Attachment Library</h1>
      {attachments.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center text-gray-500">No attachments yet.</div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Attached To</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {attachments.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-gray-400" />
                    {a.fileName}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{a.mimeType || '—'}</td>
                  <td className="px-4 py-2 text-gray-500 capitalize">{a.attachableType}</td>
                  <td className="px-4 py-2 text-gray-500">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-2 justify-end">
                      <a href={`/api/v1/attachments/${a.id}/download`} className="text-gray-400 hover:text-primary-600"><Download className="h-4 w-4" /></a>
                      <button onClick={() => deleteMutation.mutate(a.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-gray-500 mt-2">{data?.total ?? 0} attachments</p>
    </div>
  );
}
