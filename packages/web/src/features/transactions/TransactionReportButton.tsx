// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { AnchoredPortal } from '../../components/ui/AnchoredPortal';
import { useToast } from '../../components/ui/Toaster';
import { openReportPdf } from './openReportPdf';

// Remembered per browser: whether the main click includes the activity log.
const ACTIVITY_PREF_KEY = 'transactionReport.includeActivity';

function readActivityPref(): boolean {
  try {
    return localStorage.getItem(ACTIVITY_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

function writeActivityPref(on: boolean) {
  try {
    localStorage.setItem(ACTIVITY_PREF_KEY, on ? '1' : '0');
  } catch {
    // Storage blocked (private window) — the choice just isn't remembered.
  }
}

export function transactionReportUrl(transactionId: string, withActivity: boolean): string {
  if (!withActivity) return `/transactions/${transactionId}/report.pdf`;
  const params = new URLSearchParams({ activity: '1' });
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) params.set('tz', tz);
  } catch {
    // No Intl zone — the server prints UTC.
  }
  return `/transactions/${transactionId}/report.pdf?${params.toString()}`;
}

// Opens the Transaction Report (summary of this transaction and everything
// linked to it, followed by their attachments) in a new tab. The caret menu
// adds a variant with each transaction's activity log under its block; the
// last choice becomes the main click. The date-range version lives on
// Reports → Transaction Report and shares openReportPdf.
export function TransactionReportButton({ transactionId, size = 'sm' }: { transactionId: string; size?: 'sm' | 'md' }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [withActivity, setWithActivity] = useState(readActivityPref);
  const [menuOpen, setMenuOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (groupRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const run = async (activity: boolean) => {
    setLoading(true);
    try {
      const { skippedAttachments } = await openReportPdf(transactionReportUrl(transactionId, activity), {
        title: 'Transaction Report', fallbackFileName: 'transaction-report.pdf',
      });
      if (skippedAttachments > 0) {
        toast.info(`${skippedAttachments} attachment${skippedAttachments === 1 ? '' : 's'} could not be included`, {
          detail: 'The report lists each one and why.',
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not build the report');
    } finally {
      setLoading(false);
    }
  };

  const choose = (activity: boolean) => {
    setMenuOpen(false);
    setWithActivity(activity);
    writeActivityPref(activity);
    void run(activity);
  };

  const itemClass = 'block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50';

  return (
    <div ref={groupRef} className="inline-flex">
      <Button variant="secondary" size={size} onClick={() => run(withActivity)} loading={loading} className="rounded-r-none">
        <FileText className="h-4 w-4 mr-1" /> Transaction Report{withActivity ? ' + activity' : ''}
      </Button>
      <Button
        variant="secondary"
        size={size}
        disabled={loading}
        className="rounded-l-none border-l-0 px-2"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Transaction Report options"
        onClick={() => setMenuOpen((o) => !o)}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
      <AnchoredPortal anchorRef={groupRef} open={menuOpen} align="right" width={280} maxHeight={200} panelRef={panelRef}
        className="rounded-lg border border-gray-200 bg-white shadow-lg py-1">
        <div role="menu" aria-label="Transaction Report">
          <button type="button" role="menuitem" className={itemClass} onClick={() => choose(false)}>
            Transaction Report
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => choose(true)}>
            Transaction Report with activity log
          </button>
        </div>
      </AnchoredPortal>
    </div>
  );
}
