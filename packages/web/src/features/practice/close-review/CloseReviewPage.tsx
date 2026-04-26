// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Settings as SettingsIcon } from 'lucide-react';
import { useCompanyContext } from '../../../providers/CompanyProvider';
import { useFeatureFlag } from '../../../api/hooks/useFeatureFlag';
import { useSummary } from '../../../api/hooks/useClassificationState';
import { buildClosePeriods, ClosePeriodSelector } from './ClosePeriodSelector';
import { BucketsTab } from './BucketsTab';
import { FindingsTab } from './FindingsTab';
import { ManualQueueTab } from './ManualQueueTab';
import { ProgressBar } from './ProgressBar';

type Tab = 'buckets' | 'findings' | 'manual';

// Close Review is the Practice tab landing page. Build plan §2.3:
//   - Company switcher at top (reuses the sidebar one via context)
//   - Close period selector (current + prior 3)
//   - Summary row (rendered inside BucketsTab so it stays co-
//     located with the bucket drill-down)
//   - Tab nav: Buckets | Findings | Manual Queue
//
// When AI_BUCKET_WORKFLOW_V1 is off, the Buckets tab is disabled
// (the feature-flag switch can be flipped per tenant). Findings
// and Manual Queue tabs remain visible so the page isn't
// completely empty under that configuration.
export function CloseReviewPage() {
  const { activeCompanyId } = useCompanyContext();
  const bucketWorkflowEnabled = useFeatureFlag('AI_BUCKET_WORKFLOW_V1');
  const periods = useMemo(() => buildClosePeriods(), []);
  const [period, setPeriod] = useState(periods[0]!);
  const [tab, setTab] = useState<Tab>(bucketWorkflowEnabled === false ? 'findings' : 'buckets');

  const { data: summary } = useSummary({
    companyId: activeCompanyId ?? null,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  });

  const totalRemaining = summary?.totalUncategorized ?? 0;
  const totalApproved = summary?.totalApproved ?? 0;
  const progressTotal = totalRemaining + totalApproved;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Close Review</h1>
          <p className="text-sm text-gray-500">
            Review AI-categorized transactions, rule-matched items, and anomalies for the close period.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ClosePeriodSelector value={period} onChange={setPeriod} />
          <Link
            to="/practice/settings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <SettingsIcon className="h-4 w-4" />
            Thresholds
          </Link>
        </div>
      </div>

      <ProgressBar
        remaining={totalRemaining}
        total={progressTotal}
        label="This close period"
      />

      <div className="flex items-center gap-1 border-b border-gray-200">
        <TabButton
          active={tab === 'buckets'}
          disabled={bucketWorkflowEnabled === false}
          onClick={() => setTab('buckets')}
          label="Buckets"
        />
        <TabButton
          active={tab === 'findings'}
          onClick={() => setTab('findings')}
          label="Findings"
        />
        <TabButton
          active={tab === 'manual'}
          onClick={() => setTab('manual')}
          label="Manual Queue"
        />
      </div>

      {tab === 'buckets' && bucketWorkflowEnabled !== false && (
        <BucketsTab
          companyId={activeCompanyId ?? null}
          period={period}
          summary={summary}
        />
      )}
      {tab === 'findings' && <FindingsTab />}
      {tab === 'manual' && <ManualQueueTab period={period} />}
    </div>
  );
}

function TabButton({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        '-mb-px inline-flex items-center gap-1 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
        disabled
          ? 'border-transparent cursor-not-allowed text-gray-300'
          : active
            ? 'border-indigo-600 text-indigo-700'
            : 'border-transparent text-gray-500 hover:text-gray-700',
      )}
      title={disabled ? 'Enable AI_BUCKET_WORKFLOW_V1 to access the Buckets tab' : undefined}
    >
      {label}
    </button>
  );
}
