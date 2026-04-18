// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, BookOpen, ChevronRight, Plus, Pencil, Trash2, X, Eye, EyeOff } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useMe } from '../../api/hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { articles as staticArticles, categories as staticCategories } from './articles';

interface KBArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  isPublished: boolean;
  sortOrder: number;
}

export function KnowledgeBasePage() {
  const [search, setSearch] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KBArticle | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: meData } = useMe();
  const isSuperAdmin = meData?.user?.isSuperAdmin === true;
  const queryClient = useQueryClient();

  // Fetch from API if super admin (to see unpublished), otherwise published only
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['knowledge', isSuperAdmin ? 'all' : 'published'],
    queryFn: async () => {
      const endpoint = isSuperAdmin ? '/knowledge/admin/all' : '/knowledge';
      const res = await apiClient<{ articles: KBArticle[] }>(endpoint);
      return res.articles;
    },
  });

  // Fall back to static articles if API returns empty (first run before seed)
  const dbArticles = apiData && apiData.length > 0 ? apiData : null;
  const allArticles: KBArticle[] = dbArticles || staticArticles.map(a => ({
    id: a.id, slug: a.id, title: a.title, category: a.category,
    summary: a.summary, body: a.body, isPublished: true, sortOrder: 0,
  }));

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/knowledge/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      setDeleteConfirm(null);
    },
  });

  const query = search.toLowerCase().trim();
  const filtered = query
    ? allArticles.filter(a =>
        a.title.toLowerCase().includes(query) ||
        a.summary.toLowerCase().includes(query) ||
        a.category.toLowerCase().includes(query))
    : allArticles;

  // Collect unique categories preserving order
  const seenCategories = new Set<string>();
  const categories: string[] = [];
  for (const a of allArticles) {
    if (!seenCategories.has(a.category)) {
      seenCategories.add(a.category);
      categories.push(a.category);
    }
  }

  const grouped = categories
    .map(cat => ({ category: cat, items: filtered.filter(a => a.category === cat) }))
    .filter(g => g.items.length > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        </div>
        {isSuperAdmin && (
          <Button size="sm" onClick={() => { setEditingArticle(null); setShowEditor(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Article
          </Button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Learn how to use Vibe MyBooks with step-by-step guides and accounting concepts.
      </p>

      <div className="relative max-w-md mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search articles..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {grouped.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {isLoading ? 'Loading...' : search ? 'No articles match your search.' : 'No articles yet.'}
          {isSuperAdmin && !search && !isLoading && (
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={() => { setEditingArticle(null); setShowEditor(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Create your first article
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(group => (
            <div key={group.category}>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">{group.category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.items.map(article => (
                  <div key={article.id} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:border-primary-300 hover:shadow-md transition-all group relative">
                    <Link
                      to={`/help/${article.slug || article.id}`}
                      className="block p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
                              {article.title}
                            </h3>
                            {!article.isPublished && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">Draft</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
                            {article.summary}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary-500 shrink-0 mt-0.5 transition-colors" />
                      </div>
                    </Link>
                    {isSuperAdmin && (
                      <div className="absolute top-2 right-8 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.preventDefault(); setEditingArticle(article); setShowEditor(true); }}
                          className="p-1 rounded bg-white shadow border border-gray-200 hover:bg-gray-50 text-gray-500"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={e => { e.preventDefault(); setDeleteConfirm(article.id); }}
                          className="p-1 rounded bg-white shadow border border-gray-200 hover:bg-red-50 text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Article?</h3>
            <p className="text-sm text-gray-600 mb-4">This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(deleteConfirm)} loading={deleteMutation.isPending}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Article Editor Modal */}
      {showEditor && (
        <ArticleEditorModal
          article={editingArticle}
          categories={categories}
          onClose={() => { setShowEditor(false); setEditingArticle(null); }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['knowledge'] });
            setShowEditor(false);
            setEditingArticle(null);
          }}
        />
      )}
    </div>
  );
}

// ── Article Editor Modal ──

function ArticleEditorModal({ article, categories, onClose, onSaved }: {
  article: KBArticle | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!article;
  const [form, setForm] = useState({
    title: article?.title || '',
    slug: article?.slug || '',
    category: article?.category || (categories[0] || ''),
    summary: article?.summary || '',
    body: article?.body || '',
    isPublished: article?.isPublished ?? true,
    sortOrder: article?.sortOrder ?? 0,
  });
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [error, setError] = useState('');

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const category = showNewCategory ? newCategory.trim() : data.category;
      const payload = { ...data, category };
      if (isEdit) {
        return apiClient(`/knowledge/${article!.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        return apiClient('/knowledge', { method: 'POST', body: JSON.stringify(payload) });
      }
    },
    onSuccess: () => onSaved(),
    onError: (err: Error) => setError(err.message || 'Failed to save'),
  });

  // Auto-generate slug from title
  const handleTitleChange = (title: string) => {
    setForm(f => ({
      ...f,
      title,
      slug: isEdit ? f.slug : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">{isEdit ? 'Edit Article' : 'New Article'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <form
          onSubmit={e => {
            e.preventDefault();
            if (!form.title || !form.slug) { setError('Title and slug are required'); return; }
            if (!form.category && !newCategory.trim()) { setError('Category is required'); return; }
            saveMutation.mutate(form);
          }}
          className="px-6 py-4 space-y-4 overflow-y-auto flex-1"
        >
          <div className="grid grid-cols-2 gap-4">
            <Input label="Title *" value={form.title} onChange={e => handleTitleChange(e.target.value)} autoFocus />
            <Input label="Slug *" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="getting-started" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              {showNewCategory ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    placeholder="New category name"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowNewCategory(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNewCategory(true)} className="text-sm text-primary-600 hover:text-primary-700 whitespace-nowrap">+ New</button>
                </div>
              )}
            </div>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Input label="Sort Order" type="number" value={String(form.sortOrder)} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} />
              </div>
              <label className="flex items-center gap-2 pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Published</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
            <textarea
              value={form.summary}
              onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Brief description shown in the article list"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body (Markdown)</label>
            <textarea
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={14}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="## Article Content&#10;&#10;Write your article using Markdown..."
            />
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              if (!form.title || !form.slug) { setError('Title and slug are required'); return; }
              saveMutation.mutate(form);
            }}
            loading={saveMutation.isPending}
          >
            {isEdit ? 'Save Changes' : 'Create Article'}
          </Button>
        </div>
      </div>
    </div>
  );
}
