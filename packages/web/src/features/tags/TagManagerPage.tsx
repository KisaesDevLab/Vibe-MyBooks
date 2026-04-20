// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useTags, useTagGroups, useCreateTag, useUpdateTag, useDeleteTag, useMergeTags, useCreateTagGroup, useDeleteTagGroup, useTagUsage } from '../../api/hooks/useTags';
import { TAG_COLOR_PALETTE, type Tag } from '@kis-books/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Plus, Trash2, Edit, Merge, X, AlertTriangle } from 'lucide-react';

export function TagManagerPage() {
  const { data: tagsData, isLoading } = useTags();
  const { data: groupsData } = useTagGroups();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const mergeTags = useMergeTags();
  const createGroup = useCreateTagGroup();
  const deleteGroup = useDeleteTagGroup();

  const [showCreateTag, setShowCreateTag] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLOR_PALETTE[0]!);
  const [newTagGroupId, setNewTagGroupId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSingleSelect, setNewGroupSingleSelect] = useState(false);
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');

  if (isLoading) return <LoadingSpinner className="py-12" />;

  const allTags = tagsData?.tags || [];
  const groups = groupsData?.groups || [];
  const ungroupedTags = allTags.filter((t) => !t.groupId);

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    createTag.mutate({ name: newTagName.trim(), color: newTagColor, groupId: newTagGroupId || null }, {
      onSuccess: () => { setNewTagName(''); setShowCreateTag(false); },
    });
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    createGroup.mutate({ name: newGroupName.trim(), isSingleSelect: newGroupSingleSelect }, {
      onSuccess: () => { setNewGroupName(''); setShowCreateGroup(false); },
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tag Manager</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowMerge(true)}><Merge className="h-4 w-4 mr-1" /> Merge</Button>
          <Button variant="secondary" size="sm" onClick={() => setShowCreateGroup(true)}><Plus className="h-4 w-4 mr-1" /> New Group</Button>
          <Button size="sm" onClick={() => setShowCreateTag(true)}><Plus className="h-4 w-4 mr-1" /> New Tag</Button>
        </div>
      </div>

      {/* Create Tag Inline */}
      {showCreateTag && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-4 flex items-end gap-3">
          <Input label="Tag Name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <div className="flex gap-1">
              {TAG_COLOR_PALETTE.map((c) => (
                <button key={c} type="button" onClick={() => setNewTagColor(c)}
                  className={`w-6 h-6 rounded-full border-2 ${newTagColor === c ? 'border-gray-900' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
            <select value={newTagGroupId} onChange={(e) => setNewTagGroupId(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">— None —</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <Button onClick={handleCreateTag} loading={createTag.isPending}>Create</Button>
          <Button variant="ghost" onClick={() => setShowCreateTag(false)}>Cancel</Button>
        </div>
      )}

      {/* Create Group Inline */}
      {showCreateGroup && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-4 flex items-end gap-3">
          <Input label="Group Name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} required />
          <label className="flex items-center gap-2 text-sm pb-2">
            <input type="checkbox" checked={newGroupSingleSelect} onChange={(e) => setNewGroupSingleSelect(e.target.checked)} className="rounded" />
            Single-select
          </label>
          <Button onClick={handleCreateGroup} loading={createGroup.isPending}>Create Group</Button>
          <Button variant="ghost" onClick={() => setShowCreateGroup(false)}>Cancel</Button>
        </div>
      )}

      {/* Tag List */}
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.id} className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-800">{group.name}</h2>
                {group.isSingleSelect && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Single-select</span>}
              </div>
              <button onClick={() => deleteGroup.mutate(group.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="divide-y divide-gray-50">
              {group.tags?.map((tag) => (
                <TagRow key={tag.id} tag={tag} onDelete={() => setDeletingTagId(tag.id)} onEdit={(input) => updateTag.mutate({ id: tag.id, ...input })} />
              ))}
              {(!group.tags || group.tags.length === 0) && <div className="px-5 py-3 text-sm text-gray-400">No tags in this group</div>}
            </div>
          </div>
        ))}

        {ungroupedTags.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-500">Ungrouped</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {ungroupedTags.map((tag) => (
                <TagRow key={tag.id} tag={tag} onDelete={() => setDeletingTagId(tag.id)} onEdit={(input) => updateTag.mutate({ id: tag.id, ...input })} />
              ))}
            </div>
          </div>
        )}

        {allTags.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
            No tags yet. Create your first tag to start categorizing transactions.
          </div>
        )}
      </div>

      {/* Delete confirmation with usage pre-check (ADR 0XX §8). */}
      {deletingTagId && (
        <DeleteTagDialog
          tagId={deletingTagId}
          onClose={() => setDeletingTagId(null)}
          onOpenMerge={() => {
            setMergeSource(deletingTagId);
            setDeletingTagId(null);
            setShowMerge(true);
          }}
        />
      )}

      {/* Merge Modal */}
      {showMerge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-lg font-semibold">Merge Tags</h2>
            <p className="text-sm text-gray-600">All transactions with the source tag will be re-tagged to the target. The source tag will be deleted.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source (will be removed)</label>
              <select value={mergeSource} onChange={(e) => setMergeSource(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Select...</option>
                {allTags.filter((t) => t.id !== mergeTarget).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.usageCount} uses)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target (will keep)</label>
              <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Select...</option>
                {allTags.filter((t) => t.id !== mergeSource).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.usageCount} uses)</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowMerge(false)}>Cancel</Button>
              <Button variant="danger" disabled={!mergeSource || !mergeTarget} loading={mergeTags.isPending}
                onClick={() => mergeTags.mutate({ sourceTagId: mergeSource, targetTagId: mergeTarget }, { onSuccess: () => setShowMerge(false) })}>
                Merge
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ADR 0XX §8 / ADR 0XY §5 — deletion blocked while references exist.
// Fetches the live usage snapshot; when anything references the tag the
// Delete button stays disabled and we offer Merge instead. The server
// still returns a structured TAG_IN_USE 409 as a backstop if the user
// somehow bypasses the UI (e.g., direct API call).
function DeleteTagDialog({
  tagId,
  onClose,
  onOpenMerge,
}: {
  tagId: string;
  onClose: () => void;
  onOpenMerge: () => void;
}) {
  const { data, isLoading } = useTagUsage(tagId);
  const deleteTag = useDeleteTag();

  const usage = data?.usage;
  const inUse = (usage?.total ?? 0) > 0;

  const rows: Array<[string, number]> = usage
    ? ([
        ['Transaction lines', usage.transactionLines],
        ['Transactions (header)', usage.transactions],
        ['Budgets', usage.budgets],
        ['Item defaults', usage.items],
        ['Vendor defaults', usage.vendorContacts],
        ['Customer refs', usage.customerContacts],
        ['Bank rule assignments', usage.bankRules],
      ] satisfies Array<[string, number]>).filter(([, n]) => n > 0)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">Delete tag</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>

        {isLoading ? (
          <LoadingSpinner className="py-6" />
        ) : inUse ? (
          <>
            <div className="flex gap-2 items-start bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">“{data?.tag.name}” is still in use.</p>
                <p className="text-amber-800 mt-1">
                  Reassign or merge into another tag before deleting. History stays intact — deletion is blocked so references can't silently break.
                </p>
              </div>
            </div>
            <dl className="text-sm border border-gray-200 rounded divide-y">
              {rows.map(([label, n]) => (
                <div key={label} className="flex items-center justify-between px-3 py-1.5">
                  <dt className="text-gray-600">{label}</dt>
                  <dd className="font-mono text-gray-900">{n.toLocaleString()}</dd>
                </div>
              ))}
            </dl>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={onOpenMerge}>
                <Merge className="h-4 w-4 mr-1" /> Merge into another tag
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-700">
              Delete “{data?.tag.name}”? This tag has no references, so history stays clean.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button
                variant="danger"
                loading={deleteTag.isPending}
                onClick={() => deleteTag.mutate(tagId, { onSuccess: onClose })}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TagRow({ tag, onDelete, onEdit }: { tag: Tag; onDelete: () => void; onEdit: (input: { name?: string; isActive?: boolean }) => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-50">
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#d1d5db' }} />
        <span className={`text-sm ${tag.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{tag.name}</span>
        {tag.description && <span className="text-xs text-gray-400">{tag.description}</span>}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">{tag.usageCount} uses</span>
        <button onClick={() => onEdit({ isActive: !tag.isActive })} className="text-xs text-gray-400 hover:text-gray-600">
          {tag.isActive ? 'Deactivate' : 'Activate'}
        </button>
        <button onClick={onDelete} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}
