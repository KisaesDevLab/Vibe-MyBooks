import { useState, useCallback, type ChangeEvent, type DragEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';

interface AttachmentUploaderProps {
  attachableType: string;
  attachableId: string;
}

export function AttachmentUploader({ attachableType, attachableId }: AttachmentUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('attachableType', attachableType);
      formData.append('attachableId', attachableId);
      const res = await fetch('/api/v1/attachments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments'] }),
  });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      uploadMutation.mutate(files[i]!);
    }
  };

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
        dragging ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
      }`}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input id="file-input" type="file" multiple className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)} />
      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
      <p className="text-sm text-gray-500">
        {uploadMutation.isPending ? 'Uploading...' : 'Drop files here or click to upload'}
      </p>
    </div>
  );
}
