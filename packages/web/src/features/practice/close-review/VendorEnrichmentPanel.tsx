// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { ExternalLink, Globe } from 'lucide-react';
import { useVendorEnrichment } from '../../../api/hooks/useClassificationState';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

interface Props {
  stateId: string;
}

// Build plan §2.6 — the "vendor info panel" for the Needs-Review
// bucket. Renders the cached enrichment when it exists; the AI
// call that populates the cache is stubbed in Phase 2a so new
// vendors get a friendly "Enrichment unavailable" state until the
// real pipeline lands.
export function VendorEnrichmentPanel({ stateId }: Props) {
  const { data, isLoading, isError } = useVendorEnrichment(stateId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Enrichment lookup failed. Try again later.
      </div>
    );
  }

  if (!data || !data.enrichment) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <div className="flex items-center gap-2 text-gray-500">
          <Globe className="h-4 w-4" />
          <span className="font-medium">Vendor enrichment unavailable</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Web-search lookups for unknown vendors will ship in a later phase. For now, pick an account and vendor manually.
        </p>
      </div>
    );
  }

  const e = data.enrichment;
  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <span className="font-semibold">{e.likelyBusinessType ?? 'Unknown business type'}</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-indigo-600">
          {data.source === 'cache' ? 'cached' : 'fresh'}
        </span>
      </div>
      {e.summary && <p className="mt-2 text-xs leading-relaxed text-indigo-800">{e.summary}</p>}
      {e.suggestedAccountType && (
        <div className="mt-2 text-xs text-indigo-800">
          Suggested account type: <span className="font-medium">{e.suggestedAccountType}</span>
        </div>
      )}
      {e.sourceUrl && (
        <a
          href={e.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Source
        </a>
      )}
    </div>
  );
}
