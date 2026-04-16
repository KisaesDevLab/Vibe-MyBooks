import { Link } from 'react-router-dom';
import { Brain } from 'lucide-react';
import { useAiConsentStatus } from '../../api/hooks/useAi';

/**
 * Subtle footer line that surfaces AI status on the dashboard
 * whenever any AI task is active for this tenant.
 *
 * See Build Plans/AI_PII_PROTECTION_ADDENDUM.md §On-Screen AI Usage
 * Disclosure — "Dashboard: Subtle footer text: 'AI processing is
 * active for this company. [View settings]'"
 */
export function DashboardAiFooter() {
  const { data: status } = useAiConsentStatus();
  if (!status?.systemEnabled) return null;
  const activeCompany = status.companies.find(
    (c) => c.aiEnabled && !c.isStale && c.tasks && Object.values(c.tasks).some(Boolean),
  );
  if (!activeCompany) return null;

  return (
    <div className="mt-6 text-xs text-gray-400 flex items-center justify-center gap-1.5">
      <Brain className="h-3 w-3" />
      <span>AI processing is active for this company.</span>
      <Link to="/settings/ai" className="text-primary-600 hover:text-primary-700 hover:underline">View settings</Link>
    </div>
  );
}
