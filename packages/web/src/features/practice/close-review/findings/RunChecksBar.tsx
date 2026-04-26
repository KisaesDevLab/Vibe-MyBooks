// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { Play, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import type { CheckRun } from '@kis-books/shared';
import {
  useCheckRuns,
  useRunChecks,
  useRunAiJudgment,
} from '../../../../api/hooks/useReviewChecks';
import { useFeatureFlag } from '../../../../api/hooks/useFeatureFlag';
import { Button } from '../../../../components/ui/Button';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';

interface Props {
  companyId: string | null;
}

// Build plan §7.1 + AI expansion phase:
//   - "Run checks now" — fires the deterministic 14 stock checks.
//   - "Run AI judgment" — fires the AI handlers (`category=
//     'judgment'`). Shown only when AI_JUDGMENT_CHECKS_V1 is on.
//     Confirm dialog reminds the bookkeeper that AI credits will
//     be consumed.
export function RunChecksBar({ companyId }: Props) {
  const { data: runsData } = useCheckRuns(5);
  const runChecks = useRunChecks();
  const runAiJudgment = useRunAiJudgment();
  const aiJudgmentEnabled = useFeatureFlag('AI_JUDGMENT_CHECKS_V1');
  const [aiConfirmOpen, setAiConfirmOpen] = useState(false);

  const runs = runsData?.runs ?? [];
  const lastRun: CheckRun | undefined = runs[0];

  const lastRunLabel = lastRun?.completedAt
    ? `Last run ${formatRelative(new Date(lastRun.completedAt))}`
    : lastRun
      ? 'Last run still in progress…'
      : 'No runs yet — kick one off to populate findings.';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-col gap-0.5 text-sm">
        <span className="font-medium text-gray-900">Review checks</span>
        <span className="text-xs text-gray-500">
          {lastRunLabel}
          {lastRun?.findingsCreated !== undefined &&
            lastRun.findingsCreated > 0 &&
            lastRun.completedAt && (
              <>
                {' · '}
                <span className="font-medium text-gray-700">
                  {lastRun.findingsCreated} new finding{lastRun.findingsCreated === 1 ? '' : 's'}
                </span>
              </>
            )}
          {lastRun?.truncated && (
            <>
              {' · '}
              <span className="text-amber-700">truncated at run cap</span>
            </>
          )}
        </span>
        {lastRun?.error && (
          <div className="mt-1 inline-flex items-center gap-1 text-xs text-rose-700">
            <AlertCircle className="h-3.5 w-3.5" />
            {lastRun.error}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {aiJudgmentEnabled && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAiConfirmOpen(true)}
            disabled={runAiJudgment.isPending}
            title="Use AI to flag personal-looking expenses (uses AI credits)"
          >
            {runAiJudgment.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1.5" />
            )}
            Run AI judgment
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={() => runChecks.mutate({ companyId: companyId ?? undefined })}
          disabled={runChecks.isPending}
        >
          {runChecks.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-1.5" />
          )}
          Run checks now
        </Button>
      </div>
      <ConfirmDialog
        open={aiConfirmOpen}
        title="Run AI judgment review?"
        message="This will use AI credits. The AI reviews up to 100 of your largest recent expenses (≥ $25, last 30 days) and flags anything that looks personal rather than business. Each transaction is one AI call."
        confirmLabel="Run AI review"
        variant="primary"
        onConfirm={() => {
          setAiConfirmOpen(false);
          runAiJudgment.mutate({ companyId: companyId ?? undefined });
        }}
        onCancel={() => setAiConfirmOpen(false)}
      />
    </div>
  );
}

// "Last run 3 minutes ago" — compact relative formatter. Locale-
// aware via Intl.RelativeTimeFormat so non-en builds don't have
// to ship a translation table.
function formatRelative(then: Date): string {
  const diffMs = Date.now() - then.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (sec < 3600) return rtf.format(-Math.floor(sec / 60), 'minute');
  if (sec < 86400) return rtf.format(-Math.floor(sec / 3600), 'hour');
  return rtf.format(-Math.floor(sec / 86400), 'day');
}
