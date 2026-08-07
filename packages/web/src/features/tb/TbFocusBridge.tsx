// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Main-window side of the popout drill-down contract (6B.6): the
// popout posts focus-account messages on the company's tb channel;
// this bridge (mounted once in AppShell) navigates the main window to
// the filtered transaction list and pulls it to the foreground.
// Reads the active company from localStorage (same source the api
// client uses) so it renders safely even without CompanyProvider —
// AppShell is also mounted provider-less in unit tests.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { activeCompanyId, tbChannelName, type TbChannelMessage } from './workpaperShared';

export function TbFocusBridge() {
  const navigate = useNavigate();
  const companyId = activeCompanyId();

  useEffect(() => {
    if (!companyId || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(tbChannelName(companyId));
    ch.onmessage = (ev: MessageEvent<TbChannelMessage>) => {
      if (ev.data?.type !== 'focus-account') return;
      const params = new URLSearchParams({ account: ev.data.accountId });
      if (ev.data.column === 'aje') params.set('type', 'aje');
      if (ev.data.fyStart) params.set('from', ev.data.fyStart);
      if (ev.data.periodEnd) params.set('to', ev.data.periodEnd);
      navigate(`/transactions?${params}`);
      window.focus();
    };
    return () => ch.close();
  }, [companyId, navigate]);

  return null;
}
