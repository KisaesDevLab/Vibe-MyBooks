// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import type { ClassificationBucket } from '@kis-books/shared';
import { BucketSummaryRow } from './BucketSummaryRow';
import { PotentialMatchesBucket } from './buckets/PotentialMatchesBucket';
import { RulesBucket } from './buckets/RulesBucket';
import { AutoClassificationsBucket } from './buckets/AutoClassificationsBucket';
import { NeedsReviewBucket } from './buckets/NeedsReviewBucket';
import type { ClosePeriod } from './ClosePeriodSelector';
import type { BucketSummary } from '@kis-books/shared';

interface Props {
  companyId: string | null;
  period: ClosePeriod;
  summary: BucketSummary | undefined;
}

type ActiveBucket = Exclude<ClassificationBucket, 'auto_medium'>;

// Buckets tab body — delegates to the appropriate bucket view
// based on the tile clicked. The summary row stays visible at the
// top so the bookkeeper sees the ripple of every approval.
export function BucketsTab({ companyId, period, summary }: Props) {
  const [active, setActive] = useState<ActiveBucket>('needs_review');

  return (
    <div className="flex flex-col gap-4">
      <BucketSummaryRow
        summary={summary}
        activeBucket={active === 'auto_high' ? 'auto_high' : active}
        onBucketClick={(bucket) => {
          // auto_medium shares the Bucket 3 view with auto_high
          setActive(bucket === 'auto_medium' ? 'auto_high' : (bucket as ActiveBucket));
        }}
      />
      {active === 'potential_match' && <PotentialMatchesBucket companyId={companyId} period={period} />}
      {active === 'rule' && <RulesBucket companyId={companyId} period={period} />}
      {active === 'auto_high' && (
        <AutoClassificationsBucket companyId={companyId} period={period} summary={summary} />
      )}
      {active === 'needs_review' && <NeedsReviewBucket companyId={companyId} period={period} />}
    </div>
  );
}
