// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Sparkles } from 'lucide-react';
import { useChatStatus } from '../../api/hooks/useChat';
import { useChatControllerOptional } from './ChatController';

interface ErrorHelpLinkProps {
  /** The error message the user is staring at */
  errorMessage: string;
  /** The screen they're on, e.g. "Enter Bill" */
  screenName: string;
  /** Optional surrounding context (e.g. what the user was trying to do) */
  contextNote?: string;
}

/**
 * A small inline "Ask the assistant about this error" link that
 * appears next to a validation error. Clicking it opens the chat
 * panel and pre-fills a question about the specific error so the
 * user gets a context-aware explanation.
 *
 * Hidden when chat is disabled.
 */
export function ErrorHelpLink({
  errorMessage,
  screenName,
  contextNote,
}: ErrorHelpLinkProps) {
  const { data: status } = useChatStatus();
  const controller = useChatControllerOptional();

  if (!status?.enabled) return null;
  if (!controller) return null;

  const handleClick = () => {
    const parts = [
      `I got this error on the ${screenName} screen:`,
      `"${errorMessage}"`,
    ];
    if (contextNote) parts.push(contextNote);
    parts.push('What does it mean and how do I fix it?');
    controller.openChat({ prefill: parts.join(' ') });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 hover:underline"
    >
      <Sparkles className="h-3 w-3" />
      Ask the assistant about this error
    </button>
  );
}
