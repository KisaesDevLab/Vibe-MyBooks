import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChatMessage as ChatMessageType } from '../../api/hooks/useChat';
import { Sparkles, User, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ChatMessageProps {
  message: Pick<ChatMessageType, 'role' | 'content'> & { id?: string };
}

/**
 * Render a single chat message bubble with very-light Markdown
 * formatting (bold, lists, inline code) and clickable in-app links.
 *
 * Links use the convention from the system prompt: anywhere the
 * assistant writes "Go to <Screen Name> →" we render the text up to
 * the arrow as a clickable link that navigates within the app.
 *
 * We deliberately avoid pulling in a full markdown library — the
 * assistant outputs short answers and we want this component to
 * stay lightweight and dependency-free.
 */
export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const blocks = useMemo(() => parseMessage(message.content), [message.content]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(message.content).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => { /* clipboard write failed (insecure context) — ignore */ },
    );
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'} group`}>
      <div className={`
        flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
        ${isUser ? 'bg-primary-100 text-primary-600' : 'bg-purple-100 text-purple-600'}
      `}>
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className={`
        flex-1 min-w-0 max-w-[85%]
        ${isUser ? 'flex flex-col items-end' : ''}
      `}>
        <div className={`
          inline-block rounded-2xl px-3 py-2 text-sm
          ${isUser
            ? 'bg-primary-600 text-white'
            : 'bg-white border border-gray-200 text-gray-800'}
        `}>
          {blocks.map((block, i) => (
            <BlockRenderer
              key={i}
              block={block}
              onNavigate={handleNavigate}
              isUser={isUser}
            />
          ))}
        </div>
        {!isUser && (
          <button
            type="button"
            onClick={handleCopy}
            className="mt-1 text-xs text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
            title="Copy message"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Lightweight markdown / link parser ─────────────────────────

type Block =
  | { type: 'paragraph'; segments: Segment[] }
  | { type: 'bullet'; items: Segment[][] };

type Segment =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; path: string };

function parseMessage(content: string): Block[] {
  // Split into "blocks" by blank lines. Within a block, group
  // consecutive bullet lines into one bullet block; everything else
  // is a paragraph.
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let currentBullets: string[] | null = null;
  let currentParagraph: string[] | null = null;

  const flush = () => {
    if (currentBullets) {
      blocks.push({
        type: 'bullet',
        items: currentBullets.map((line) => parseSegments(line.replace(/^[-*]\s+/, ''))),
      });
      currentBullets = null;
    }
    if (currentParagraph) {
      const text = currentParagraph.join(' ').trim();
      if (text) blocks.push({ type: 'paragraph', segments: parseSegments(text) });
      currentParagraph = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (currentParagraph) flush();
      currentBullets = currentBullets || [];
      currentBullets.push(line);
    } else {
      if (currentBullets) flush();
      currentParagraph = currentParagraph || [];
      currentParagraph.push(line);
    }
  }
  flush();

  return blocks;
}

const NAV_PATHS: Record<string, string> = {
  // The keys are lowercased screen names; values are app routes.
  'pay bills': '/pay-bills',
  'enter bill': '/bills/new',
  'bills': '/bills',
  'print checks': '/print-checks',
  'bank feed': '/banking/feed',
  'reconciliation': '/banking/reconciliation',
  'banking': '/banking',
  'invoices': '/invoices',
  'new invoice': '/invoices/new',
  'reports': '/reports',
  'profit and loss': '/reports/profit-loss',
  'p&l': '/reports/profit-loss',
  'balance sheet': '/reports/balance-sheet',
  'ap aging summary': '/reports/ap-aging',
  'ap aging': '/reports/ap-aging',
  'ar aging summary': '/reports/ar-aging',
  'ar aging': '/reports/ar-aging',
  'trial balance': '/reports/trial-balance',
  'general ledger': '/reports/general-ledger',
  'dashboard': '/',
  'admin': '/admin',
  'admin → ai processing': '/admin/ai',
  'ai processing': '/admin/ai',
  'admin → coa templates': '/admin/coa-templates',
  'coa templates': '/admin/coa-templates',
  'settings': '/settings',
  'settings → closing date': '/settings',
  'closing date': '/settings',
  'company settings': '/settings/company',
  'contacts': '/contacts',
  'accounts': '/accounts',
};

function parseSegments(text: string): Segment[] {
  // Parser order matters: links first (they have the most specific
  // syntax), then bold, then inline code, then plain text.
  const segments: Segment[] = [];
  // "Go to <Name> →" pattern. Greedy match up to the arrow.
  // Also support "**Go to <Name> →**" and "<Name> →".
  const linkPattern = /(\*\*)?(?:Go to\s+)?([A-Za-z][A-Za-z0-9 &/→\-]*?)\s*→(\*\*)?/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(...parseInline(text.slice(lastIndex, match.index)));
    }
    const linkText = match[2]!.trim();
    const path = NAV_PATHS[linkText.toLowerCase()];
    if (path) {
      segments.push({ type: 'link', text: linkText, path });
    } else {
      // Not in our nav map — render as plain text so we don't
      // mislead the user with a non-functional link.
      segments.push(...parseInline(match[0]));
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push(...parseInline(text.slice(lastIndex)));
  }
  return segments;
}

function parseInline(text: string): Segment[] {
  const segments: Segment[] = [];
  // Bold: **text**
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ type: 'bold', text: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ type: 'code', text: match[2] });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }
  return segments;
}

interface BlockRendererProps {
  block: Block;
  onNavigate: (path: string) => void;
  isUser: boolean;
}

function BlockRenderer({ block, onNavigate, isUser }: BlockRendererProps) {
  if (block.type === 'paragraph') {
    return (
      <p className="mb-2 last:mb-0 leading-relaxed">
        {block.segments.map((seg, i) => (
          <SegmentRenderer key={i} segment={seg} onNavigate={onNavigate} isUser={isUser} />
        ))}
      </p>
    );
  }
  return (
    <ul className="list-disc list-inside mb-2 last:mb-0 space-y-0.5">
      {block.items.map((item, i) => (
        <li key={i} className="leading-relaxed">
          {item.map((seg, j) => (
            <SegmentRenderer key={j} segment={seg} onNavigate={onNavigate} isUser={isUser} />
          ))}
        </li>
      ))}
    </ul>
  );
}

interface SegmentRendererProps {
  segment: Segment;
  onNavigate: (path: string) => void;
  isUser: boolean;
}

function SegmentRenderer({ segment, onNavigate, isUser }: SegmentRendererProps) {
  switch (segment.type) {
    case 'text':
      return <>{segment.text}</>;
    case 'bold':
      return <strong>{segment.text}</strong>;
    case 'code':
      return (
        <code className={`px-1 py-0.5 rounded text-xs font-mono ${
          isUser ? 'bg-primary-700' : 'bg-gray-100'
        }`}>
          {segment.text}
        </code>
      );
    case 'link':
      return (
        <button
          type="button"
          onClick={() => onNavigate(segment.path)}
          className={`underline font-medium ${
            isUser ? 'text-white hover:text-primary-100' : 'text-primary-600 hover:text-primary-700'
          }`}
        >
          Go to {segment.text} →
        </button>
      );
  }
}
