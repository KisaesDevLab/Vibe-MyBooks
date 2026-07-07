// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, FileText } from 'lucide-react';
import { ReportSnapshot } from '../portal/PortalFinancialsPage';

// Anonymous public view of a PUBLISHED financial report, reached via a
// copy-paste share link (/reports/view/:token). No auth: the token in the
// URL is the bearer credential. Backed by the rate-limited public router
// at /api/reports/public/:token. Archived/unpublished tokens 404 → we
// show a friendly "no longer available" message (no login redirect).
// Reuses the same snapshot renderer the signed-in portal uses.

interface PublicReport {
  layout: unknown[];
  data: Record<string, unknown> | null;
  companyName: string;
  periodStart: string;
  periodEnd: string;
  version: number;
  publishedAt: string | null;
  hasPdf: boolean;
}

type PageState = 'loading' | 'ok' | 'error';

export function PublicReportPage() {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<PublicReport | null>(null);
  const [state, setState] = useState<PageState>('loading');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    // BASE_URL prefix keeps this working on appliance subpath installs,
    // matching every other public fetch (see PublicInvoicePage).
    fetch(`${import.meta.env.BASE_URL}api/reports/public/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled) {
          setReport(d.report as PublicReport);
          setState('ok');
        }
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (state === 'error' || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Report unavailable</h1>
          <p className="text-sm text-gray-600">This report link is no longer available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{report.companyName}</h1>
              <p className="text-sm text-gray-600 mt-0.5">
                {report.periodStart} → {report.periodEnd}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {report.publishedAt
                  ? `Published ${new Date(report.publishedAt).toLocaleDateString()} · v${report.version}`
                  : `v${report.version}`}
              </p>
            </div>
            {report.hasPdf && (
              <a
                href={`${import.meta.env.BASE_URL}api/reports/public/${token}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline flex-shrink-0"
              >
                <Download className="h-4 w-4" /> PDF
              </a>
            )}
          </div>
          <div className="p-5">
            {report.data ? (
              <ReportSnapshot data={report.data} layout={report.layout ?? []} />
            ) : (
              <p className="text-sm text-gray-500">This report has no content to display.</p>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          Shared securely by your bookkeeper.
        </p>
      </div>
    </div>
  );
}

export default PublicReportPage;
