import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '../../api/client';
import { articles as staticArticles } from './articles';

export function ArticlePage() {
  const { id } = useParams<{ id: string }>();

  // Try API first, fall back to static
  const { data: apiArticle } = useQuery({
    queryKey: ['knowledge', 'article', id],
    queryFn: async () => {
      const res = await apiClient<{ article: { title: string; category: string; body: string } }>(`/knowledge/${id}`);
      return res.article;
    },
    retry: false,
  });

  const staticArticle = staticArticles.find(a => a.id === id);
  const article = apiArticle || staticArticle;

  if (!article) {
    return (
      <div>
        <Link to="/help" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Knowledge Base
        </Link>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-yellow-800">
          Article not found.
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link to="/help" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Knowledge Base
      </Link>

      <div className="mb-2">
        <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
          {article.category}
        </span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 md:p-8 max-w-3xl">
        <div className="prose prose-sm prose-gray max-w-none">
          <ArticleContent body={article.body} />
        </div>
      </div>
    </div>
  );
}

function ArticleContent({ body }: { body: string }) {
  const lines = body.trim().split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-xl font-bold text-gray-900 mt-0 mb-4">{line.slice(3)}</h2>);
      i++; continue;
    }
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-semibold text-gray-800 mt-6 mb-2">{line.slice(4)}</h3>);
      i++; continue;
    }

    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) { tableLines.push(lines[i]!); i++; }
      elements.push(<MarkdownTable key={`table-${i}`} lines={tableLines} />);
      continue;
    }

    if (line.trimStart().startsWith('- ')) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i]!.trimStart().startsWith('- ')) { listItems.push(lines[i]!.trimStart().slice(2)); i++; }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 space-y-1 my-2 text-sm text-gray-700">
          {listItems.map((item, j) => <li key={j}><InlineFormat text={item} /></li>)}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s/.test(line.trimStart())) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i]!.trimStart())) { listItems.push(lines[i]!.trimStart().replace(/^\d+\.\s/, '')); i++; }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal pl-5 space-y-1 my-2 text-sm text-gray-700">
          {listItems.map((item, j) => <li key={j}><InlineFormat text={item} /></li>)}
        </ol>,
      );
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    elements.push(<p key={i} className="text-sm text-gray-700 my-2 leading-relaxed"><InlineFormat text={line} /></p>);
    i++;
  }

  return <>{elements}</>;
}

function InlineFormat({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`(.+?)`/);

    let earliest: { type: 'bold' | 'code'; index: number; full: string; inner: string } | null = null;
    if (boldMatch && boldMatch.index !== undefined) earliest = { type: 'bold', index: boldMatch.index, full: boldMatch[0], inner: boldMatch[1]! };
    if (codeMatch && codeMatch.index !== undefined && (!earliest || codeMatch.index < earliest.index)) earliest = { type: 'code', index: codeMatch.index, full: codeMatch[0], inner: codeMatch[1]! };

    if (!earliest) { parts.push(<span key={key++}>{remaining}</span>); break; }
    if (earliest.index > 0) parts.push(<span key={key++}>{remaining.slice(0, earliest.index)}</span>);

    if (earliest.type === 'bold') parts.push(<strong key={key++} className="font-semibold text-gray-900">{earliest.inner}</strong>);
    else parts.push(<code key={key++} className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-gray-800">{earliest.inner}</code>);

    remaining = remaining.slice(earliest.index + earliest.full.length);
  }

  return <>{parts}</>;
}

function MarkdownTable({ lines }: { lines: string[] }) {
  if (lines.length < 2) return null;
  const parseRow = (line: string) => line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(cell => cell.trim());
  const headers = parseRow(lines[0]!);
  const rows = lines.slice(2).map(parseRow);

  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border border-gray-200 rounded-lg">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {headers.map((h, i) => <th key={i} className="text-left px-3 py-2 font-medium text-gray-600 text-xs"><InlineFormat text={h} /></th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-100">
              {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-gray-700 text-xs"><InlineFormat text={cell} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
