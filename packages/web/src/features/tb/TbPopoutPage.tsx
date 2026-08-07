// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// TB popout window (Phase 6B, ADR-TB-06): minimal chrome, live grid
// that refreshes while book work happens in the main window. One
// mutation affordance (owner-requested): clicking an Adjusted/Tax
// amount opens the tickmark popup for that cell.
// Refresh layers: BroadcastChannel (same browser, instant) → SSE stamp
// stream (other users/devices/background jobs) → 15s /tb/version poll
// fallback. Changed rows flash on refresh; drill-down clicks focus the
// main window instead of navigating here (6B.6).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { TbWorkpaperGrid, type TbGridColumn, type TbGridPrefs } from './TbWorkpaperGrid';
import { buildCellMarks, TickmarkCellPicker } from './TickmarkCellPicker';
import {
  activeCompanyId, tbChannelName, useWorkpaper, type TbChannelMessage, type TbWorkpaper,
} from './workpaperShared';
import { useActivityUnits } from '../../api/hooks/useTb';
import { useTbProfile } from '../../api/hooks/useTb';

const APP_BASE = import.meta.env.BASE_URL;

export function TbPopoutPage() {
  const queryClient = useQueryClient();
  const companyId = activeCompanyId();
  const { data: profileData } = useTbProfile();
  const periodEnd = profileData?.fiscal.currentFiscalYearEnd ?? `${new Date().getFullYear()}-12-31`;

  const [prefs, setPrefs] = useState<TbGridPrefs>({
    drCrMode: false, showPy: false, showTax: true, nonZeroOnly: false, activityView: '',
  });
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [lastUpdate, setLastUpdate] = useState<{ at: Date; changed: number } | null>(null);
  const [authLost, setAuthLost] = useState(false);

  const { data: wpData, isLoading } = useWorkpaper(periodEnd, 'accrual');
  const { data: unitsData } = useActivityUnits();

  // Tickmark popup on Adjusted/Tax amount clicks.
  const taxYear = wpData?.workpaper.taxYear ?? new Date().getFullYear();
  const [pickCell, setPickCell] = useState<{ accountId: string; accountName: string; column: 'adjusted' | 'tax' } | null>(null);
  const { data: marksLib } = useQuery({
    queryKey: ['tb', 'tickmarks'],
    queryFn: () => apiClient<{ tickmarks: Array<{ id: string; symbol: string; description: string; color: string | null }> }>('/tb/tickmarks'),
  });
  const { data: appsData } = useQuery({
    queryKey: ['tb', 'tickmark-applications', taxYear],
    enabled: !!wpData,
    queryFn: () => apiClient<{ applications: Array<{ id: string; accountId: string; column: string; tickmarkId: string }> }>(`/tb/tickmark-applications?taxYear=${taxYear}`),
  });
  const cellMarks = useMemo(
    () => buildCellMarks(appsData?.applications, marksLib?.tickmarks),
    [appsData, marksLib],
  );
  const prevRows = useRef<Map<string, TbWorkpaper['rows'][number]> | null>(null);

  // Diff-and-flash (6B.5): compare incoming rows against the previous
  // dataset and highlight what moved.
  useEffect(() => {
    if (!wpData) return;
    const next = new Map(wpData.workpaper.rows.map((r) => [r.accountId, r]));
    if (prevRows.current) {
      const changed = new Set<string>();
      for (const [id, row] of next) {
        const prev = prevRows.current.get(id);
        if (!prev || prev.unadjusted !== row.unadjusted || prev.aje !== row.aje ||
            prev.taxRje !== row.taxRje || prev.adjusted !== row.adjusted || prev.tax !== row.tax) {
          changed.add(id);
        }
      }
      for (const id of prevRows.current.keys()) {
        if (!next.has(id)) changed.add(id);
      }
      if (changed.size > 0) {
        setFlashIds(changed);
        setLastUpdate({ at: new Date(), changed: changed.size });
        const t = setTimeout(() => setFlashIds(new Set()), 2500);
        return () => clearTimeout(t);
      }
      // Zero-delta refetch (e.g. a stamp bump outside the period): make
      // sure a previous flash doesn't stick after its timer was
      // cancelled by this effect re-run.
      setFlashIds((prev) => (prev.size ? new Set() : prev));
    }
    prevRows.current = next;
    return undefined;
  }, [wpData]);
  useEffect(() => {
    if (wpData) prevRows.current = new Map(wpData.workpaper.rows.map((r) => [r.accountId, r]));
  }, [wpData]);

  const refresh = useMemo(() => () => {
    queryClient.invalidateQueries({ queryKey: ['tb', 'workpaper'] });
  }, [queryClient]);

  // Layer 1: BroadcastChannel from the main window.
  useEffect(() => {
    if (!companyId || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(tbChannelName(companyId));
    ch.onmessage = (ev: MessageEvent<TbChannelMessage>) => {
      if (ev.data?.type === 'changed') refresh();
    };
    return () => ch.close();
  }, [companyId, refresh]);

  // Layer 2: SSE stamp stream (fetch-reader — EventSource can't send
  // the Bearer header). Layer 3: 15s /tb/version poll when SSE is down.
  const lastStamp = useRef<number>(0);
  useEffect(() => {
    let stopped = false;
    let sseHealthy = false;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${APP_BASE}api/v1/tb/stream`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'text/event-stream',
            'X-Company-Id': companyId ?? '',
          },
          signal: controller.signal,
          credentials: 'include',
        });
        if (res.status === 401 || res.status === 403) {
          setAuthLost(true);
          return;
        }
        if (!res.ok || !res.body) return;
        sseHealthy = true;
        const reader = res.body.getReader();
        try {
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done || stopped) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';
          for (const evt of events) {
            const dataLine = evt.split('\n').find((l) => l.startsWith('data: '));
            if (!dataLine) continue;
            try {
              const payload = JSON.parse(dataLine.slice(6)) as { glVersionStamp?: number };
              if (payload.glVersionStamp && payload.glVersionStamp !== lastStamp.current) {
                lastStamp.current = payload.glVersionStamp;
                refresh();
              }
            } catch {
              // malformed frame — skip
            }
          }
        }
        } finally {
          // Clean server close (30-min ceiling) or abort: hand off to
          // the 15s poll so long-lived popouts keep refreshing.
          sseHealthy = false;
        }
      } catch {
        sseHealthy = false;
      }
    })();

    const poll = setInterval(async () => {
      if (sseHealthy || stopped) return;
      try {
        const { glVersionStamp } = await apiClient<{ glVersionStamp: number }>('/tb/version');
        if (glVersionStamp !== lastStamp.current) {
          lastStamp.current = glVersionStamp;
          refresh();
        }
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 401) setAuthLost(true);
      }
    }, 15000);

    return () => {
      stopped = true;
      controller.abort();
      clearInterval(poll);
    };
  }, [companyId, refresh]);

  // 6B.6: drill-down focuses the main window at the account.
  const focusMain = (accountId: string, column: 'unadjusted' | 'aje') => {
    if (!companyId || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(tbChannelName(companyId));
    ch.postMessage({
      type: 'focus-account', accountId, column,
      fyStart: wpData?.workpaper.fyStart, periodEnd: wpData?.workpaper.periodEnd,
    } satisfies TbChannelMessage);
    ch.close();
  };

  const unitNames = useMemo(() => new Map((unitsData?.units ?? []).map((u) => [u.id, u.displayName])), [unitsData]);

  if (authLost) {
    return (
      <div className="p-10 text-center text-sm text-gray-600">
        <p className="mb-2 font-medium">Session ended</p>
        <p>Sign in again in the main MyBooks window, then reopen the popout.</p>
      </div>
    );
  }

  return (
    <div className="p-4 min-h-screen bg-gray-50">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">Trial Balance <span className="text-xs font-normal text-gray-400">live view</span></h1>
          {lastUpdate && (
            <span className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              updated {lastUpdate.at.toLocaleTimeString()} — {lastUpdate.changed} account{lastUpdate.changed === 1 ? '' : 's'} changed
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={prefs.drCrMode} onChange={(e) => setPrefs({ ...prefs, drCrMode: e.target.checked })} />
            DR/CR
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={prefs.showTax} onChange={(e) => setPrefs({ ...prefs, showTax: e.target.checked })} />
            Tax
          </label>
          <select value={prefs.activityView} aria-label="Activity view"
            onChange={(e) => setPrefs({ ...prefs, activityView: e.target.value })}
            className="rounded border border-gray-300 px-1.5 py-1">
            <option value="">Consolidated</option>
            {(unitsData?.units ?? []).map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
          </select>
        </div>
      </div>
      {isLoading && <LoadingSpinner className="py-16" />}
      {!isLoading && !wpData && (
        <p className="py-16 text-center text-sm text-gray-500">
          Couldn’t load the trial balance. Check that the module is enabled for this client, then reopen the popout.
        </p>
      )}
      {wpData && (
        <TbWorkpaperGrid
          workpaper={wpData.workpaper}
          prefs={prefs}
          search=""
          typeFilter=""
          flashIds={flashIds}
          unitNames={unitNames}
          clickableColumns={['unadjusted', 'aje', 'adjusted', 'tax']}
          cellMarks={cellMarks}
          onAmountClick={(row, column: TbGridColumn) => {
            if (column === 'adjusted' || column === 'tax') {
              setPickCell({ accountId: row.accountId, accountName: row.name, column });
            } else if (column === 'unadjusted' || column === 'aje') {
              focusMain(row.accountId, column);
            }
          }}
        />
      )}
      {pickCell && (
        <TickmarkCellPicker
          accountId={pickCell.accountId}
          accountName={pickCell.accountName}
          taxYear={taxYear}
          initialColumn={pickCell.column}
          onClose={() => setPickCell(null)}
        />
      )}
      <p className="mt-2 text-[11px] text-gray-400">Unadjusted/AJE clicks focus the main window; Adjusted/Tax clicks open the tickmark popup. Updates arrive automatically as book work posts.</p>
    </div>
  );
}
