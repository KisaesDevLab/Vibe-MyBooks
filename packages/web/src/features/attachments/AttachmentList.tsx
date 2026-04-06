import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Paperclip, Download, Trash2 } from 'lucide-react';

interface AttachmentListProps {
  attachableType: string;
  attachableId: string;
}

interface Attachment {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  ocrStatus: string | null;
  ocrVendor: string | null;
  ocrTotal: string | null;
  createdAt: string;
}

export function AttachmentList({ attachableType, attachableId }: AttachmentListProps) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['attachments', attachableType, attachableId],
    queryFn: () => apiClient<{ data: Attachment[]; total: number }>(`/attachments?attachable_type=${attachableType}&attachable_id=${attachableId}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/attachments/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments'] }),
  });

  const attachments = data?.data || [];
  if (attachments.length === 0) return null;

  return (
    <div className="space-y-2">
      {attachments.map((a) => (
        <div key={a.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-700 truncate">{a.fileName}</span>
            {a.fileSize && <span className="text-xs text-gray-400 flex-shrink-0">{(a.fileSize / 1024).toFixed(0)}KB</span>}
            {a.ocrStatus === 'complete' && a.ocrTotal && (
              <span className="text-xs text-green-600 flex-shrink-0">OCR: ${parseFloat(a.ocrTotal).toFixed(2)}</span>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <a href={`/api/v1/attachments/${a.id}/download`} className="text-gray-400 hover:text-primary-600">
              <Download className="h-4 w-4" />
            </a>
            <button onClick={() => deleteMutation.mutate(a.id)} className="text-gray-400 hover:text-red-500">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
