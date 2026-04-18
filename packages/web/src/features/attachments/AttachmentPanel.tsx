// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Paperclip, FolderOpen } from 'lucide-react';
import { AttachmentUploader } from './AttachmentUploader';
import { AttachmentList } from './AttachmentList';
import { AttachmentPickerModal } from './AttachmentPickerModal';

interface AttachmentPanelProps {
  attachableType: string;
  attachableId: string;
  compact?: boolean;
}

export function AttachmentPanel({ attachableType, attachableId, compact }: AttachmentPanelProps) {
  const [showPicker, setShowPicker] = useState(false);

  // We only consume `total` from this response — the list items are
  // re-fetched by AttachmentList with its own typed hook. Keep the row
  // shape permissive so future fields on the attachments endpoint don't
  // force a cascade of edits here.
  const { data } = useQuery({
    queryKey: ['attachments', attachableType, attachableId],
    queryFn: () => apiClient<{ data: Array<{ id: string }>; total: number }>(`/attachments?attachable_type=${attachableType}&attachable_id=${attachableId}`),
  });

  const count = data?.total ?? 0;

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">
            Attachments{count > 0 ? ` (${count})` : ''}
          </span>
        </div>
        <AttachmentList attachableType={attachableType} attachableId={attachableId} />
        <AttachmentUploader attachableType={attachableType} attachableId={attachableId} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-800">
            Attachments{count > 0 ? ` (${count})` : ''}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700"
        >
          <FolderOpen className="h-4 w-4" />
          Attach Existing
        </button>
      </div>
      <AttachmentList attachableType={attachableType} attachableId={attachableId} />
      <AttachmentUploader attachableType={attachableType} attachableId={attachableId} />

      {showPicker && (
        <AttachmentPickerModal
          attachableType={attachableType}
          attachableId={attachableId}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
