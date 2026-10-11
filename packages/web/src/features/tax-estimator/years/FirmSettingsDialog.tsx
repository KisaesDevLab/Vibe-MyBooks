// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useState } from 'react';
import { PORTAL_SHOWS, SAFE_HARBOR_OVERRIDES, type FirmSettingsDTO, type PortalShows, type SafeHarborOverride, type UpsertFirmSettingsInput } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { SAFE_HARBOR_LABELS, SELECT_CLASS } from '../taxpayers/labels';

interface Props {
  open: boolean;
  settings: FirmSettingsDTO | undefined;
  loading?: boolean;
  saving?: boolean;
  error?: string;
  onClose: () => void;
  onSave: (input: UpsertFirmSettingsInput) => void;
}

/** Firm-wide estimator defaults. Opened only for firm admins (the server enforces it). */
export function FirmSettingsDialog({ open, settings, loading, saving, error, onClose, onSave }: Props) {
  const [harbor, setHarbor] = useState<SafeHarborOverride>('lesser_of');
  const [disclaimer, setDisclaimer] = useState('');
  const [portal, setPortal] = useState<PortalShows>('live');
  useEffect(() => {
    if (settings) { setHarbor(settings.safeHarborDefault); setDisclaimer(settings.disclaimerText ?? ''); setPortal(settings.portalShows); }
  }, [settings]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="firm-settings-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200"><h3 id="firm-settings-title" className="text-lg font-semibold text-gray-900">Firm estimator settings</h3></div>
        <div className="px-6 py-4 space-y-4">
          {loading || !settings ? <p className="text-sm text-gray-500">Loading…</p> : (
            <>
              <div>
                <label htmlFor="fs-harbor" className="block text-sm font-medium text-gray-700 mb-1">Safe-harbor default</label>
                <select id="fs-harbor" className={SELECT_CLASS} value={harbor} onChange={(e) => setHarbor(e.target.value as SafeHarborOverride)}>
                  {SAFE_HARBOR_OVERRIDES.map((s) => <option key={s} value={s}>{SAFE_HARBOR_LABELS[s]}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-500">Used when a taxpayer or year has no override.</p>
              </div>
              <div>
                <label htmlFor="fs-portal" className="block text-sm font-medium text-gray-700 mb-1">Client portal shows</label>
                <select id="fs-portal" className={SELECT_CLASS} value={portal} onChange={(e) => setPortal(e.target.value as PortalShows)}>
                  {PORTAL_SHOWS.map((s) => <option key={s} value={s}>{s === 'live' ? 'Live estimate' : 'Latest finalized snapshot'}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="fs-disclaimer" className="block text-sm font-medium text-gray-700 mb-1">Disclaimer text</label>
                <textarea id="fs-disclaimer" rows={4} maxLength={4000} className={SELECT_CLASS} value={disclaimer} onChange={(e) => setDisclaimer(e.target.value)} />
                <p className="mt-1 text-xs text-gray-500">Leave blank to use: {settings.effectiveDisclaimerText === (settings.disclaimerText ?? '') ? 'the shipped text' : settings.effectiveDisclaimerText}</p>
              </div>
            </>
          )}
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button loading={saving} disabled={!settings} onClick={() => onSave({ safeHarborDefault: harbor, portalShows: portal, disclaimerText: disclaimer.trim() === '' ? null : disclaimer })}>Save settings</Button>
        </div>
      </div>
    </div>
  );
}
