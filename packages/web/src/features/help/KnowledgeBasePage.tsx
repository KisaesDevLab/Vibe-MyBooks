import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, BookOpen, ChevronRight } from 'lucide-react';
import { articles, categories } from './articles';

export function KnowledgeBasePage() {
  const [search, setSearch] = useState('');

  const query = search.toLowerCase().trim();
  const filtered = query
    ? articles.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          a.summary.toLowerCase().includes(query) ||
          a.category.toLowerCase().includes(query),
      )
    : articles;

  const grouped = categories
    .map((cat) => ({
      category: cat,
      items: filtered.filter((a) => a.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <BookOpen className="h-7 w-7 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Learn how to use Vibe MyBooks with step-by-step guides and accounting concepts.
      </p>

      {/* Search */}
      <div className="relative max-w-md mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search articles..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {grouped.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No articles match your search.
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.category}>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">{group.category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.items.map((article) => (
                  <Link
                    key={article.id}
                    to={`/help/${article.id}`}
                    className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 hover:border-primary-300 hover:shadow-md transition-all group flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
                        {article.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
                        {article.summary}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary-500 shrink-0 mt-0.5 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
