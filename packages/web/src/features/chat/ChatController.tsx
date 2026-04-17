// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/**
 * Chat panel state held in a React context so any component in the
 * tree can request the panel be opened — optionally with a pre-filled
 * message.
 *
 * Without this lift, only the ChatFab knew about the open/closed
 * state. The help-integration components from §5.3 of the plan
 * (FieldHelpIcon, ErrorHelpLink, EmptyStateChat) all need to be able
 * to open the panel from anywhere in the app, so we centralise it
 * here.
 *
 * The provider is mounted in `AppShell` so it wraps everything
 * authenticated. ChatFab + ChatPanel are children of the provider.
 */

export interface OpenChatOptions {
  /** Pre-fill the input box with this text. The user can edit before sending. */
  prefill?: string;
  /** Auto-send the prefill instead of populating the input. Use sparingly. */
  autoSend?: boolean;
}

interface ChatControllerValue {
  open: boolean;
  prefill: string | null;
  autoSendOnNextOpen: boolean;
  /** Open the chat panel. Acts as a toggle if no options supplied. */
  openChat: (opts?: OpenChatOptions) => void;
  closeChat: () => void;
  /** Called by ChatPanel after it consumes the prefill, to clear it. */
  consumePrefill: () => void;
}

const ChatControllerContext = createContext<ChatControllerValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<string | null>(null);
  const [autoSendOnNextOpen, setAutoSendOnNextOpen] = useState(false);

  const openChat = useCallback((opts?: OpenChatOptions) => {
    setOpen(true);
    if (opts?.prefill !== undefined) setPrefill(opts.prefill);
    setAutoSendOnNextOpen(opts?.autoSend === true);
  }, []);

  const closeChat = useCallback(() => {
    setOpen(false);
  }, []);

  const consumePrefill = useCallback(() => {
    setPrefill(null);
    setAutoSendOnNextOpen(false);
  }, []);

  return (
    <ChatControllerContext.Provider
      value={{ open, prefill, autoSendOnNextOpen, openChat, closeChat, consumePrefill }}
    >
      {children}
    </ChatControllerContext.Provider>
  );
}

/**
 * Get the chat controller. Throws if called outside of a ChatProvider.
 * If you want a no-op fallback (e.g., for unauthenticated pages), use
 * `useChatControllerOptional()` instead.
 */
export function useChatController(): ChatControllerValue {
  const ctx = useContext(ChatControllerContext);
  if (!ctx) throw new Error('useChatController must be used inside <ChatProvider>');
  return ctx;
}

/**
 * Same as useChatController() but returns null instead of throwing
 * if there's no provider. Useful for shared components that may
 * render in places where chat isn't mounted.
 */
export function useChatControllerOptional(): ChatControllerValue | null {
  return useContext(ChatControllerContext);
}
