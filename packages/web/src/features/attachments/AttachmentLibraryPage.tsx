import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getAccessToken } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Paperclip, Download, Trash2, Eye, X, ChevronRight, User, FileText, FolderOpen } from 'lucide-react';

interface LibraryAttachment {
  id: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  attachableType: string;
  attachableId: string;
  ocrStatus: string | null;
  ocrTotal: string | null;
  createdAt: string;
  txnDate: string | null;
  txnType: string | null;
  txnMemo: string | null;
  contactId: string | null;
  contactName: string | null;
}

const txnTypeLabels: Record<string, string> = {
  invoice: 'Invoice', customer_payment: 'Payment', cash_sale: 'Cash Sale',
  expense: 'Expense', deposit: 'Deposit', transfer: 'Transfer',
  journal_entry: 'Journal Entry', credit_memo: 'Credit Memo', customer_refund: 'Refund',
  draft: 'Draft', receipt: 'Receipt',
};

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

function fmtSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

type Tab = 'contact' | 'type';

export function AttachmentLibraryPage() {
  const [tab, setTab] = useState<Tab>('contact');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['attachments', 'library'],
    queryFn: () => apiClient<{ data: LibraryAttachment[] }>('/attachments/library'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/attachments/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments'] }),
  });

  const all = data?.data || [];

  // Group by contact
  const byContact = useMemo(() => {
    const map = new Map<string, { name: string; items: LibraryAttachment[] }>();
    for (const a of all) {
      const key = a.contactId || '__none__';
      const name = a.contactName || 'No Contact';
      if (!map.has(key)) map.set(key, { name, items: [] });
      map.get(key)!.items.push(a);
    }
    return Array.from(map.entries())
      .sort((a, b) => {
        if (a[0] === '__none__') return 1;
        if (b[0] === '__none__') return -1;
        return a[1].name.localeCompare(b[1].name);
      });
  }, [all]);

  // Group by transaction type
  const byType = useMemo(() => {
    const map = new Map<string, LibraryAttachment[]>();
    for (const a of all) {
      const key = a.attachableType || 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries())
      .sort((a, b) => (txnTypeLabels[a[0]] || a[0]).localeCompare(txnTypeLabels[b[0]] || b[0]));
  }, [all]);

  const toggleGroup = (key: string) => {
    setExpandedGroup(expandedGroup === key ? null : key);
    setPreviewId(null);
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;

  const previewAttachment = previewId ? all.find((a) => a.id === previewId) : null;

  const groups = tab === 'contact' ? byContact.map(([key, { name, items }]) => ({ key, label: name, items, count: items.length }))
    : byType.map(([key, items]) => ({ key, label: txnTypeLabels[key] || key, items, count: items.length }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Attachment Library</h1>
        <span className="text-sm text-gray-500">{all.length} files</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => { setTab('contact'); setExpandedGroup(null); setPreviewId(null); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'contact' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <User className="h-4 w-4" />
          By Contact
        </button>
        <button
          onClick={() => { setTab('type'); setExpandedGroup(null); setPreviewId(null); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'type' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          By Transaction Type
        </button>
      </div>

      {all.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center text-gray-500">No attachments yet.</div>
      ) : (
        <div className="flex gap-4">
          {/* Left panel — folder tree */}
          <div className="w-72 flex-shrink-0 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {tab === 'contact' ? 'Contacts' : 'Transaction Types'}
              </span>
            </div>
            <div className="divide-y divide-gray-100 max-h-[calc(100vh-260px)] overflow-y-auto">
              {groups.map((g) => (
                <button
                  key={g.key}
                  onClick={() => toggleGroup(g.key)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                    expandedGroup === g.key
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <FolderOpen className={`h-4 w-4 flex-shrink-0 ${expandedGroup === g.key ? 'text-primary-500' : 'text-gray-400'}`} />
                  <span className="truncate flex-1">{g.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    expandedGroup === g.key ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {g.count}
                  </span>
                  <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${
                    expandedGroup === g.key ? 'rotate-90 text-primary-500' : 'text-gray-300'
                  }`} />
                </button>
              ))}
            </div>
          </div>

          {/* Right panel — file list + preview */}
          <div className="flex-1 min-w-0">
            {!expandedGroup ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center text-gray-400">
                <FolderOpen className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Select a {tab === 'contact' ? 'contact' : 'transaction type'} to view attachments</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {/* File table */}
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                      {tab === 'contact' && (
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      )}
                      {tab === 'type' && (
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                      )}
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Memo</th>
                      <th className="px-4 py-2 w-28" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groups.find((g) => g.key === expandedGroup)?.items.map((a) => (
                      <tr key={a.id} className={`hover:bg-gray-50 ${previewId === a.id ? 'bg-primary-50' : ''}`}>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            {a.mimeType?.startsWith('image/') ? (
                              <img
                                src={downloadUrl(a.id, true)}
                                alt=""
                                className="h-8 w-8 rounded object-cover border border-gray-200 flex-shrink-0"
                              />
                            ) : (
                              <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            )}
                            <span className="truncate text-gray-700">{a.fileName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{fmtSize(a.fileSize)}</td>
                        {tab === 'contact' && (
                          <td className="px-4 py-2 text-gray-500">
                            <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs capitalize">
                              {txnTypeLabels[a.attachableType] || a.attachableType}
                            </span>
                          </td>
                        )}
                        {tab === 'type' && (
                          <td className="px-4 py-2 text-gray-500 truncate max-w-[140px]">
                            {a.contactName || '—'}
                          </td>
                        )}
                        <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                          {a.txnDate || new Date(a.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-gray-500 truncate max-w-[160px]">{a.txnMemo || ''}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex gap-1.5 justify-end">
                            {isPreviewable(a.mimeType) && (
                              <button
                                onClick={() => setPreviewId(previewId === a.id ? null : a.id)}
                                className={previewId === a.id ? 'text-primary-600' : 'text-gray-400 hover:text-primary-600'}
                                title="Preview"
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Inline preview */}
                {previewAttachment && previewAttachment.mimeType && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{previewAttachment.fileName}</span>
                      <button onClick={() => setPreviewId(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      {previewAttachment.mimeType.startsWith('image/') ? (
                        <img
                          src={downloadUrl(previewAttachment.id, true)}
                          alt={previewAttachment.fileName}
                          className="max-w-full max-h-[500px] object-contain mx-auto p-2"
                        />
                      ) : previewAttachment.mimeType === 'application/pdf' ? (
                        <iframe
                          src={downloadUrl(previewAttachment.id, true)}
                          title={previewAttachment.fileName}
                          className="w-full h-[600px]"
                        />
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
