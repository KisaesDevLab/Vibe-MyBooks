// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getAccessToken } from '../../api/client';
import { Paperclip, Download, Trash2, Eye, X } from 'lucide-react';

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

function isPreviewable(mime: string | null): boolean {
  if (!mime) return false;
  return mime.startsWith('image/') || mime === 'application/pdf';
}

function downloadUrl(id: string, inline?: boolean): string {
  const token = getAccessToken();
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (inline) params.set('inline', '1');
  return `/api/v1/attachments/${id}/download?${params.toString()}`;
}

export function AttachmentList({ attachableType, attachableId }: AttachmentListProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);
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
        <div key={a.id}>
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 min-w-0">
              <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 truncate">{a.fileName}</span>
              {a.fileSize && <span className="text-xs text-gray-400 flex-shrink-0">{(a.fileSize / 1024).toFixed(0)}KB</span>}
              {a.ocrStatus === 'complete' && a.ocrTotal && (
                <span className="text-xs text-green-600 flex-shrink-0">OCR: ${parseFloat(a.ocrTotal).toFixed(2)}</span>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {isPreviewable(a.mimeType) && (
                <button
                  onClick={() => setPreviewId(previewId === a.id ? null : a.id)}
                  className={`${previewId === a.id ? 'text-primary-600' : 'text-gray-400 hover:text-primary-600'}`}
                  title="Preview inline"
                >
                  <Eye className="h-4 w-4" />
                </button>
              )}
              <a href={downloadUrl(a.id)} className="text-gray-400 hover:text-primary-600" title="Download">
                <Download className="h-4 w-4" />
              </a>
              <button onClick={() => deleteMutation.mutate(a.id)} className="text-gray-400 hover:text-red-500" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Inline preview */}
          {previewId === a.id && a.mimeType && (
            <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
                <span className="text-xs text-gray-500">{a.fileName}</span>
                <button onClick={() => setPreviewId(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {a.mimeType.startsWith('image/') ? (
                <img
                  src={downloadUrl(a.id, true)}
                  alt={a.fileName}
                  className="max-w-full max-h-[500px] object-contain mx-auto p-2"
                />
              ) : a.mimeType === 'application/pdf' ? (
                <iframe
                  src={downloadUrl(a.id, true)}
                  title={a.fileName}
                  className="w-full h-[600px]"
                />
              ) : null}
            </div>
          )}
        </div>
      ))}


    </div>
  );
}
