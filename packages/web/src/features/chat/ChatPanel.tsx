import { useState, useEffect, useRef, useMemo, type FormEvent, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  X, Send, Plus, Sparkles, MessageSquare, Trash2, ChevronLeft, MapPin,
} from 'lucide-react';
import {
  useChatConversations,
  useChatConversation,
  useSendChatMessage,
  useDeleteChatConversation,
  useChatSuggestions,
} from '../../api/hooks/useChat';
import type { ChatMessage as ChatMessageType } from '../../api/hooks/useChat';
import { ChatMessage } from './ChatMessage';
import { deriveScreenContext } from './screenContext';
import { useChatController } from './ChatController';

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-out chat panel. Lives at the right edge of the viewport on
 * desktop and as a full-screen overlay on mobile.
 *
 * State machine:
 *   - "list view" (showHistory = true): scrollable list of past
 *     conversations + a button to start a new one.
 *   - "conversation view" (default): the active conversation's
 *     messages, suggestions, and input.
 *
 * Active conversation id is held locally so the user can switch
 * between conversations without losing the current one. New
 * conversations are not created until the user actually sends a
 * message — that's handled server-side by sendMessage when no
 * conversationId is supplied.
 */
export function ChatPanel({ open, onClose }: ChatPanelProps) {
  const location = useLocation();
  const screenCtx = useMemo(() => deriveScreenContext(location.pathname), [location.pathname]);
  const { prefill, autoSendOnNextOpen, consumePrefill } = useChatController();

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const { data: conversationsData } = useChatConversations();
  const { data: activeData } = useChatConversation(activeConversationId);
  const { data: suggestionsData } = useChatSuggestions(screenCtx.screenId);
  const sendMessage = useSendChatMessage();
  const deleteConv = useDeleteChatConversation();

  const messages: ChatMessageType[] = useMemo(() => {
    if (!activeData?.conversation) return [];
    return activeData.conversation.messages || [];
  }, [activeData]);

  // Auto-scroll on new messages
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sendMessage.isPending]);

  // Reset to a fresh state when the panel re-opens
  useEffect(() => {
    if (open) {
      setShowHistory(false);
    }
  }, [open]);

  // Pickup pending prefill from the controller (set by FieldHelpIcon
  // / ErrorHelpLink / EmptyStateChat). Only fires when the panel is
  // open and a prefill is waiting. If autoSend was requested, fire
  // it immediately; otherwise just populate the input so the user
  // can edit before sending.
  useEffect(() => {
    if (!open || prefill === null) return;
    if (autoSendOnNextOpen) {
      handleSend(prefill);
    } else {
      setInputValue(prefill);
    }
    consumePrefill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill, autoSendOnNextOpen]);

  if (!open) return null;

  const handleSend = (text: string) => {
    const message = text.trim();
    if (!message) return;
    sendMessage.mutate(
      {
        conversationId: activeConversationId,
        message,
        context: {
          current_screen: screenCtx.screenId,
          current_path: screenCtx.path,
          entity_type: screenCtx.entityType,
          entity_id: screenCtx.entityId,
        },
      },
      {
        onSuccess: (data) => {
          setActiveConversationId(data.conversationId);
        },
      },
    );
    setInputValue('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend(inputValue);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputValue);
    }
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setShowHistory(false);
  };

  const handleDelete = (id: string) => {
    deleteConv.mutate(id);
    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        onClick={onClose}
      />

      {/* Panel — slides in from the right on desktop, full screen on mobile */}
      <aside className="
        fixed inset-y-0 right-0 z-50 w-full lg:w-[420px] bg-gray-50
        border-l border-gray-200 shadow-2xl flex flex-col
      ">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 min-w-0">
            {showHistory ? (
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="p-1 rounded hover:bg-gray-100"
                title="Back to conversation"
              >
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
            ) : (
              <Sparkles className="h-5 w-5 text-purple-600" />
            )}
            <h2 className="font-semibold text-gray-800 truncate">
              {showHistory ? 'Conversations' : 'Vibe MyBooks Assistant'}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {!showHistory && (
              <>
                <button
                  type="button"
                  onClick={startNewConversation}
                  className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  title="New conversation"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowHistory(true)}
                  className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  title="Conversation history"
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {showHistory ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {conversationsData?.conversations?.length ? (
              conversationsData.conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${
                    conv.id === activeConversationId
                      ? 'bg-purple-50 border border-purple-200'
                      : 'hover:bg-white border border-transparent'
                  }`}
                  onClick={() => {
                    setActiveConversationId(conv.id);
                    setShowHistory(false);
                  }}
                >
                  <MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {conv.title || '(Untitled conversation)'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {conv.messageCount} message{conv.messageCount === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center mt-8">
                No conversations yet.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Context indicator */}
            <div className="px-3 py-1.5 bg-purple-50/50 border-b border-purple-100 flex items-center gap-2">
              <MapPin className="h-3 w-3 text-purple-500 flex-shrink-0" />
              <span className="text-xs text-purple-700 truncate">
                Viewing: <strong>{screenCtx.screenId}</strong>
                {screenCtx.entityType && ` · ${screenCtx.entityType}`}
              </span>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 && !sendMessage.isPending ? (
                <EmptyConversation
                  suggestions={suggestionsData?.suggestions || []}
                  onPick={handleSend}
                />
              ) : (
                messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))
              )}
              {sendMessage.isPending && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                  </div>
                  Thinking…
                </div>
              )}
              {sendMessage.error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                  {(sendMessage.error as Error).message || 'Something went wrong'}
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  placeholder="Ask about Vibe MyBooks or accounting…"
                  className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={sendMessage.isPending}
                />
                <button
                  type="submit"
                  disabled={sendMessage.isPending || !inputValue.trim()}
                  className="
                    flex-shrink-0 p-2 rounded-lg bg-purple-600 text-white
                    hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                  "
                  title="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-gray-400">
                Assistant may be wrong. Verify important answers and consult your accountant for tax advice.
              </p>
            </form>
          </>
        )}
      </aside>
    </>
  );
}

interface EmptyConversationProps {
  suggestions: string[];
  onPick: (text: string) => void;
}

function EmptyConversation({ suggestions, onPick }: EmptyConversationProps) {
  return (
    <div className="text-center py-6">
      <Sparkles className="h-10 w-10 text-purple-500 mx-auto mb-2" />
      <h3 className="text-sm font-semibold text-gray-800">
        How can I help you?
      </h3>
      <p className="text-xs text-gray-500 mt-1 mb-4 px-4">
        Ask about a screen, an accounting concept, or a workflow.
      </p>
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-1.5 max-w-sm mx-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onPick(s)}
              className="text-left text-xs text-gray-700 bg-white border border-gray-200 hover:border-purple-300 hover:bg-purple-50 rounded-lg px-3 py-2 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
