// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Owner-only management of the check signature library (rendered inside
// CheckPrintSettingsPage; the parent gates on the owner role). Uploads are
// prechecked client-side against the shared 600×200 pixel cap — the server
// re-validates and is the authority.

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CHECK_SIGNATURE_MAX_WIDTH, CHECK_SIGNATURE_MAX_HEIGHT, type CheckSignature } from '@kis-books/shared';
import { apiClient } from '../../api/client';
import {
  useSignatures, useCreateSignature, useReplaceSignatureImage,
  useUpdateSignature, useSetSignatureUsers, useDeleteSignature, useSignatureImage,
} from '../../api/hooks/useCheckSignatures';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PenLine, Trash2, Users, ImageUp } from 'lucide-react';

interface TeamUser { id: string; displayName: string; email: string; isActive: boolean }

/** Reject non-PNG/JPEG and oversized images before any bytes leave the browser. */
function precheckImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      resolve('Signature must be a PNG or JPEG image');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth > CHECK_SIGNATURE_MAX_WIDTH || img.naturalHeight > CHECK_SIGNATURE_MAX_HEIGHT) {
        resolve(`Image is ${img.naturalWidth}×${img.naturalHeight}px — the maximum is ${CHECK_SIGNATURE_MAX_WIDTH}×${CHECK_SIGNATURE_MAX_HEIGHT}px. Please resize it first.`);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve('Could not read that image file'); };
    img.src = url;
  });
}

function SignaturePreview({ id }: { id: string }) {
  const url = useSignatureImage(id);
  if (!url) return <div className="h-12 w-36 rounded border border-dashed border-gray-200 bg-gray-50" />;
  return <img src={url} alt="Signature" className="h-12 w-36 object-contain rounded border border-gray-200 bg-white" />;
}

function SignatureRow({ sig, onAssign }: { sig: CheckSignature; onAssign: (sig: CheckSignature) => void }) {
  const replaceImage = useReplaceSignatureImage();
  const updateSignature = useUpdateSignature();
  const deleteSignature = useDeleteSignature();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const handleReplace = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    const problem = await precheckImage(file);
    if (problem) { setError(problem); return; }
    try { await replaceImage.mutateAsync({ id: sig.id, image: file }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Replace failed'); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete the signature "${sig.label}"? Users assigned to it will print blank checks.`)) return;
    try { await deleteSignature.mutateAsync(sig.id); }
    catch (err) { setError(err instanceof Error ? err.message : 'Delete failed'); }
  };

  const handleCapBlur = async (value: string) => {
    const trimmed = value.trim();
    if (trimmed === (sig.maxAmount ? String(Number(sig.maxAmount)) : '')) return;
    if (trimmed && !/^\d+(\.\d{1,4})?$/.test(trimmed)) { setError('Cap must be a positive amount'); return; }
    setError('');
    try { await updateSignature.mutateAsync({ id: sig.id, maxAmount: trimmed || null }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Update failed'); }
  };

  return (
    <div className="flex flex-wrap items-center gap-4 py-3 border-b border-gray-100 last:border-b-0">
      <SignaturePreview id={sig.id} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{sig.label}</p>
        <p className="text-xs text-gray-500">
          {sig.width}×{sig.height}px
          {sig.users.length > 0
            ? ` · ${sig.users.map((u) => u.displayName).join(', ')}`
            : ' · no users assigned'}
        </p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <div className="w-36">
        <Input
          label="Max amount"
          type="text"
          placeholder="No cap"
          defaultValue={sig.maxAmount ? String(Number(sig.maxAmount)) : ''}
          onBlur={(e) => handleCapBlur(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => onAssign(sig)} title="Choose which users may print with this signature">
          <Users className="h-4 w-4 mr-1" /> Users
        </Button>
        <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} loading={replaceImage.isPending}>
          <ImageUp className="h-4 w-4 mr-1" /> Replace
        </Button>
        <Button type="button" variant="danger" onClick={handleDelete} loading={deleteSignature.isPending}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden"
        onChange={(e) => { void handleReplace(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

function AssignUsersModal({ sig, onClose }: { sig: CheckSignature; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['company-users'],
    queryFn: () => apiClient<{ users: TeamUser[] }>('/company/users'),
  });
  const setUsers = useSetSignatureUsers();
  const [selected, setSelected] = useState<Set<string>>(new Set(sig.users.map((u) => u.id)));
  const [error, setError] = useState('');

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleSave = async () => {
    setError('');
    try {
      await setUsers.mutateAsync({ id: sig.id, userIds: Array.from(selected) });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const activeUsers = (data?.users || []).filter((u) => u.isActive);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900">Who can print with “{sig.label}”?</h2>
        <p className="text-sm text-gray-600">
          Selected users can apply this signature when printing checks. Everyone else prints with a blank signature line.
        </p>
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
          {activeUsers.map((u) => (
            <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50">
              <input type="checkbox" className="rounded" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
              <span className="text-sm text-gray-900">{u.displayName}</span>
              <span className="text-xs text-gray-500 truncate">{u.email}</span>
            </label>
          ))}
          {activeUsers.length === 0 && <p className="px-4 py-3 text-sm text-gray-500">No active users.</p>}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={handleSave} loading={setUsers.isPending}>Save</Button>
        </div>
      </div>
    </div>
  );
}

export function CheckSignaturesSection() {
  const { data, isLoading } = useSignatures(true);
  const createSignature = useCreateSignature();
  const [label, setLabel] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [assigning, setAssigning] = useState<CheckSignature | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File | undefined) => {
    setFormError('');
    if (!f) { setFile(null); return; }
    const problem = await precheckImage(f);
    if (problem) { setFormError(problem); setFile(null); if (fileRef.current) fileRef.current.value = ''; return; }
    setFile(f);
  };

  const handleAdd = async () => {
    if (!label.trim() || !file) { setFormError('A name and an image are required'); return; }
    if (maxAmount && !/^\d+(\.\d{1,4})?$/.test(maxAmount)) { setFormError('Cap must be a positive amount'); return; }
    setFormError('');
    try {
      await createSignature.mutateAsync({ image: file, label: label.trim(), ...(maxAmount ? { maxAmount } : {}) });
      setLabel(''); setMaxAmount(''); setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const signatures = data?.signatures || [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <PenLine className="h-5 w-5 text-gray-500" /> Check Signatures
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload signature images (PNG or JPEG, up to {CHECK_SIGNATURE_MAX_WIDTH}×{CHECK_SIGNATURE_MAX_HEIGHT}px) and choose
          who may print with each. Images are stored encrypted, and printing with a signature always requires the user to
          re-enter their password or authenticator code. Checks above a signature’s max amount print with a blank line instead.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : signatures.length > 0 ? (
        <div>{signatures.map((sig) => <SignatureRow key={sig.id} sig={sig} onAssign={setAssigning} />)}</div>
      ) : (
        <p className="text-sm text-gray-500">No signatures uploaded yet.</p>
      )}

      <div className="border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-[1fr_10rem_auto_auto] gap-3 items-end">
        <Input label="Signature name" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Kurt W" />
        <Input label="Max amount (optional)" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="No cap" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg"
            onChange={(e) => { void handleFile(e.target.files?.[0]); }}
            className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border file:border-gray-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-gray-700 hover:file:bg-gray-50" />
        </div>
        <Button type="button" onClick={handleAdd} loading={createSignature.isPending} disabled={!label.trim() || !file}>
          Add Signature
        </Button>
      </div>
      {formError && <p className="text-sm text-red-600">{formError}</p>}

      {assigning && <AssignUsersModal sig={assigning} onClose={() => setAssigning(null)} />}
    </div>
  );
}
