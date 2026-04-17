// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Paperclip, X, Check } from 'lucide-react';

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  attachableType: string;
  createdAt: string;
}

interface AttachmentPickerModalProps {
  attachableType: string;
  attachableId: string;
  onClose: () => void;
}

export function AttachmentPickerModal({ attachableType, attachableId, onClose }: AttachmentPickerModalProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['attachments', 'unlinked'],
    queryFn: () => apiClient<{ data: Attachment[] }>('/attachments/unlinked'),
  });

  const linkMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await apiClient(`/attachments/${id}/link`, {
          method: 'POST',
          body: JSON.stringify({ attachableType, attachableId }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
      onClose();
    },
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const files = data?.data || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Attach Existing File</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {isLoading && <p className="text-sm text-gray-500 text-center py-8">Loading...</p>}

          {!isLoading && files.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No unattached files found.</p>
          )}

          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggle(f.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    selected.has(f.id) ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                    selected.has(f.id) ? 'bg-primary-600 border-primary-600' : 'border-gray-300'
                  }`}>
                    {selected.has(f.id) && <Check className="h-3.5 w-3.5 text-white" />}
                  </div>
                  <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 truncate">{f.fileName}</p>
                    <p className="text-xs text-gray-400">
                      {f.fileSize ? `${(f.fileSize / 1024).toFixed(0)} KB` : ''}
                      {f.attachableType === 'receipt' ? ' \u00b7 Receipt' : ''}
                      {' \u00b7 '}{new Date(f.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t">
          <span className="text-xs text-gray-500">{selected.size} selected</span>
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" disabled={selected.size === 0} loading={linkMutation.isPending}
              onClick={() => linkMutation.mutate(Array.from(selected))}>
              Attach Selected
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
