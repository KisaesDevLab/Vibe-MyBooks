// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { HelpCircle } from 'lucide-react';
import { useChatStatus } from '../../api/hooks/useChat';
import { useChatControllerOptional } from './ChatController';

interface FieldHelpIconProps {
  /** The user-facing name of the field, e.g. "Payment Terms" */
  fieldName: string;
  /** The screen the field lives on, e.g. "Enter Bill" */
  screenName: string;
  /** Optional extra context appended to the question */
  contextNote?: string;
  /** Tooltip text shown on hover */
  title?: string;
  className?: string;
}

/**
 * A small "?" button that lives next to a complex field. Clicking it
 * opens the chat panel and pre-fills the input with a question
 * specifically about that field, ready for the user to send (or
 * edit first).
 *
 * Hidden when chat is disabled at either the system or company level
 * — same gating as ChatFab — so users on installs without AI never
 * see broken-looking icons.
 */
export function FieldHelpIcon({
  fieldName,
  screenName,
  contextNote,
  title,
  className,
}: FieldHelpIconProps) {
  const { data: status } = useChatStatus();
  const controller = useChatControllerOptional();

  if (!status?.enabled) return null;
  if (!controller) return null;

  const handleClick = () => {
    const base = `What does the "${fieldName}" field on the ${screenName} screen mean?`;
    const prefill = contextNote ? `${base} ${contextNote}` : base;
    controller.openChat({ prefill });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center text-gray-400 hover:text-purple-600 transition-colors ${className || ''}`}
      title={title || `Ask about ${fieldName}`}
      aria-label={`Ask about ${fieldName}`}
    >
      <HelpCircle className="h-3.5 w-3.5" />
    </button>
  );
}
