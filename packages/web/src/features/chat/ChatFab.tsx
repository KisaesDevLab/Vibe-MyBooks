// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Sparkles } from 'lucide-react';
import { useChatStatus } from '../../api/hooks/useChat';
import { ChatPanel } from './ChatPanel';
import { useChatController } from './ChatController';

/**
 * Floating action button + slide-out panel container.
 *
 * Mounted once at the AppShell level so the chat is available from
 * every authenticated screen. Hides itself when chat is disabled at
 * either the system or company level (per the two-tier consent
 * model in AI_CHAT_SUPPORT_PLAN.md §8.1).
 *
 * Open/closed state lives in the ChatController context so help
 * components elsewhere in the tree (FieldHelpIcon, ErrorHelpLink,
 * EmptyStateChat) can also open the panel and pre-fill it.
 */
export function ChatFab() {
  const { open, openChat, closeChat } = useChatController();
  const { data: status } = useChatStatus();

  if (!status?.enabled) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => openChat()}
          className="
            fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full
            bg-purple-600 text-white shadow-lg
            hover:bg-purple-700 hover:scale-105 transition-all
            flex items-center justify-center
          "
          title="Open assistant"
          aria-label="Open AI assistant"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}
      <ChatPanel open={open} onClose={closeChat} />
    </>
  );
}
