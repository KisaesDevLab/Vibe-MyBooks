import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

// ─── Types ─────────────────────────────────────────────────────

export interface ChatStatus {
  enabled: boolean;
  systemEnabled: boolean;
  companyEnabled: boolean;
  reason?: string;
}

export interface ChatContext {
  current_screen?: string;
  current_path?: string;
  entity_type?: string;
  entity_id?: string;
  entity_summary?: string;
  form_fields?: Record<string, unknown>;
  form_errors?: string[];
}

export interface ChatConversation {
  id: string;
  tenantId: string;
  userId: string;
  title: string | null;
  status: string;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  screenContext: string | null;
  entityContext: Record<string, unknown> | null;
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
  createdAt: string;
}

export interface SendMessageInput {
  conversationId?: string | null;
  message: string;
  context?: ChatContext;
}

export interface SendMessageResponse {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  assistantMessage: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

// ─── Hooks ─────────────────────────────────────────────────────

/**
 * Lightweight availability check. The frontend uses this to decide
 * whether to render the floating chat button at all. Cached for the
 * session — chat enable/disable doesn't flip mid-session in practice.
 */
export function useChatStatus() {
  return useQuery({
    queryKey: ['chat', 'status'],
    queryFn: () => apiClient<ChatStatus>('/chat/status'),
    staleTime: 60_000,
    // Don't show errors in the UI for the status probe — if the
    // endpoint 403s or 500s we just hide the chat button.
    retry: false,
  });
}

export function useChatConversations() {
  return useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: () => apiClient<{ conversations: ChatConversation[] }>('/chat/conversations'),
  });
}

export function useChatConversation(conversationId: string | null) {
  return useQuery({
    queryKey: ['chat', 'conversations', conversationId],
    queryFn: () => apiClient<{ conversation: ChatConversation & { messages: ChatMessage[] } }>(
      `/chat/conversations/${conversationId}`,
    ),
    enabled: !!conversationId,
  });
}

export function useSendChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMessageInput) => apiClient<SendMessageResponse>('/chat/message', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
    onSuccess: (data) => {
      // Refresh the affected conversation + the list
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations', data.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
  });
}

export function useDeleteChatConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/chat/conversations/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] }),
  });
}

export function useChatSuggestions(screenId?: string) {
  return useQuery({
    queryKey: ['chat', 'suggestions', screenId || 'default'],
    queryFn: () => apiClient<{ suggestions: string[] }>(
      `/chat/suggestions${screenId ? `?screen=${encodeURIComponent(screenId)}` : ''}`,
    ),
    staleTime: 5 * 60_000,
  });
}
