// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useRef, useEffect } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';

// PORTAL_IDENTITY_LINKING_V1 — in-portal firm switcher.
//
// Renders only when the portal session is bound to an identity that
// has more than one linked contact. PortalLayout gates rendering on
// linkedContacts.length > 1 so this component can assume it's running
// with real choices to offer.
//
// On select, posts /api/portal/auth/switch and then does a full-page
// reload — same approach as the main-app tenant-switch flow at
// packages/web/src/components/layout/CompanySwitcher.tsx:198. The
// cookie rotates server-side; reloading drops every React Query cache
// and closed-over reference to the previous tenant's data.

export interface LinkedContact {
  contactId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  displayName: string;
  status: string;
}

interface PortalFirmSwitcherProps {
  linkedContacts: LinkedContact[];
  activeContactId: string;
}

export function PortalFirmSwitcher({ linkedContacts, activeContactId }: PortalFirmSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const active = linkedContacts.find((c) => c.contactId === activeContactId);

  const handleSwitch = async (targetContactId: string) => {
    if (targetContactId === activeContactId) return;
    setSwitching(targetContactId);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/auth/switch`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetContactId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
        throw new Error(body?.error?.message || `Switch failed (${res.status})`);
      }
      // Cookie has rotated; full-page reload so every cached request
      // and React Query closure picks up the new firm cleanly. Using
      // BASE_URL keeps the appliance subpath install working.
      window.location.assign(`${import.meta.env.BASE_URL}portal`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PortalFirmSwitcher] switch failed', err);
      setError(err instanceof Error ? err.message : 'Could not switch firm.');
      setSwitching(null);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          if (!isOpen) setError('');
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1.5 text-sm border border-gray-300 rounded-md px-2 py-1 bg-white hover:bg-gray-50"
        title="Switch firm"
      >
        <Building2 className="h-3.5 w-3.5 text-gray-500" />
        <span className="truncate max-w-[140px]">{active?.tenantName ?? 'Switch firm'}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-1 min-w-[220px] rounded-md border border-gray-200 bg-white shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-1.5 text-xs font-semibold uppercase text-gray-500">
            Your firms
          </div>
          {error && (
            <div className="mx-2 mb-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700" role="alert">
              {error}
            </div>
          )}
          {linkedContacts.map((c) => {
            const isActive = c.contactId === activeContactId;
            const isSwitching = switching === c.contactId;
            return (
              <button
                key={c.contactId}
                onClick={() => handleSwitch(c.contactId)}
                disabled={isActive || !!switching}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:hover:bg-transparent text-left"
              >
                <span className="truncate">{c.tenantName}</span>
                {isSwitching ? (
                  <span className="text-xs text-gray-500">switching…</span>
                ) : isActive ? (
                  <Check className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
