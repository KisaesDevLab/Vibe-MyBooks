import { Sparkles } from 'lucide-react';
import { useChatStatus } from '../../api/hooks/useChat';
import { useChatControllerOptional } from './ChatController';

interface EmptyStateChatProps {
  /** The screen the user is on, e.g. "Bills" */
  screenName: string;
  /** Optional, the message to pre-fill if the user clicks the prompt */
  promptText?: string;
  /** Optional headline */
  headline?: string;
  /** Optional one-line subhead */
  subhead?: string;
}

/**
 * A friendly "ask the assistant" prompt for empty screens (no bills,
 * no transactions, fresh tenant). Encourages new users to talk to
 * the assistant rather than guessing where to click.
 *
 * Renders nothing when chat is disabled.
 */
export function EmptyStateChat({
  screenName,
  promptText,
  headline = 'Need help getting started?',
  subhead = 'Ask the assistant anything about how this works.',
}: EmptyStateChatProps) {
  const { data: status } = useChatStatus();
  const controller = useChatControllerOptional();

  if (!status?.enabled) return null;
  if (!controller) return null;

  const handleClick = () => {
    const prefill = promptText || `Walk me through how the ${screenName} screen works.`;
    controller.openChat({ prefill });
  };

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center gap-3">
      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
        <Sparkles className="h-5 w-5 text-purple-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-purple-900">{headline}</p>
        <p className="text-xs text-purple-700 mt-0.5">{subhead}</p>
      </div>
      <button
        type="button"
        onClick={handleClick}
        className="flex-shrink-0 inline-flex items-center gap-1 text-sm font-medium text-purple-700 hover:text-purple-800 px-3 py-1.5 rounded-lg bg-white border border-purple-200 hover:border-purple-300"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Ask the assistant
      </button>
    </div>
  );
}
