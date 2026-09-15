// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { FirmCapabilityKey, FirmCapabilityMap, FirmUserWithProfile } from '@kis-books/shared';
import { FIRM_CAPABILITIES, FIRM_CAPABILITY_GROUPS } from '@kis-books/shared';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { isApiError } from '../../api/client';
import { useMe } from '../../api/hooks/useAuth';
import { useFirmUserCapabilities, useSetFirmUserCapabilities } from '../../api/hooks/useFirms';

// Per-member access rights editor (Firm → Staff → Access rights; Admin →
// Firms → Members). Renders the shared FIRM_CAPABILITIES catalog grouped
// into "Client settings" (owner parity on managed clients the member can
// already reach) and "Administration" (a firm-scoped slice of Admin).
//
//   - firm_readonly members are ineligible: everything disabled + notice
//   - on a super-admin-managed firm only a super admin may edit
//   - "Using role defaults" vs "Customized" badge; "Reset to role defaults"
//     PUTs null so the member follows their firm role again
export function FirmMemberCapabilitiesDrawer({
  firmId,
  firmUser,
  superAdminManaged,
  onClose,
}: {
  firmId: string;
  firmUser: FirmUserWithProfile;
  superAdminManaged: boolean;
  onClose: () => void;
}) {
  const { data: meData } = useMe();
  const isSuperAdmin = meData?.user?.isSuperAdmin === true;
  const isSelf = meData?.user?.id === firmUser.userId;
  const { data, isLoading, error: loadError } = useFirmUserCapabilities(firmId, firmUser.id);
  const save = useSetFirmUserCapabilities(firmId);
  const [draft, setDraft] = useState<FirmCapabilityMap>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setDraft({ ...data.capabilities });
  }, [data]);

  const ineligible = firmUser.firmRole === 'firm_readonly';
  const locked = superAdminManaged && !isSuperAdmin;
  const canEdit = !ineligible && !locked;

  const friendly = (err: unknown): string => {
    if (isApiError(err) && err.code === 'FIRM_SUPER_ADMIN_MANAGED') {
      return 'This firm is managed by the system administrator; only they can change member access rights.';
    }
    if (isApiError(err) && err.code === 'FIRM_ROLE_INELIGIBLE') {
      return 'Read-only firm members can\'t hold access rights. Change their firm role to firm_staff first.';
    }
    return err instanceof Error ? err.message : 'Could not save access rights';
  };

  const submit = async (capabilities: FirmCapabilityMap | null) => {
    setError(null);
    try {
      await save.mutateAsync({ firmUserId: firmUser.id, capabilities, isSelf });
      onClose();
    } catch (err) {
      setError(friendly(err));
    }
  };

  const toggle = (key: FirmCapabilityKey, checked: boolean) =>
    setDraft((d) => ({ ...d, [key]: checked }));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Access rights">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col gap-3 p-5" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary-700" />
            <h2 className="text-lg font-semibold text-gray-900">Access rights</h2>
            {data && (
              <span
                className={
                  'ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                  (data.capabilitiesCustomized ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600')
                }
              >
                {data.capabilitiesCustomized ? 'Customized' : 'Using role defaults'}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {firmUser.displayName ? `${firmUser.displayName} · ` : ''}{firmUser.email} · {firmUser.firmRole}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Client settings apply on companies the firm manages <em>and</em> this member already has access to.
            Administration rights open a slice of the Admin area limited to the firm&apos;s own clients.
          </p>
          {ineligible && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              Read-only firm members can&apos;t hold access rights. Change their firm role to firm_staff first.
            </div>
          )}
          {!ineligible && locked && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              This firm is managed by the system administrator; only they can change member access rights.
            </div>
          )}
        </div>

        {isLoading ? (
          <LoadingSpinner size="md" />
        ) : loadError ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{friendly(loadError)}</p>
        ) : (
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
            {FIRM_CAPABILITY_GROUPS.map((group) => (
              <fieldset key={group} className="rounded-md border border-gray-200 p-3">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">{group}</legend>
                {FIRM_CAPABILITIES.filter((c) => c.group === group).map((c) => (
                  <label key={c.key} className="flex items-start gap-2 py-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
                      checked={draft[c.key] === true}
                      disabled={!canEdit || save.isPending}
                      onChange={(e) => toggle(c.key, e.target.checked)}
                      aria-label={c.label}
                    />
                    <span>
                      <span className="text-sm text-gray-900">{c.label}</span>
                      <span className="block text-xs text-gray-500">{c.description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-rose-700">{error}</p>}

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            variant="secondary"
            onClick={() => submit(null)}
            disabled={!canEdit || isLoading || save.isPending || !data?.capabilitiesCustomized}
            title="Follow the firm role's default rights again"
          >
            Reset to role defaults
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => submit(draft)} disabled={!canEdit || isLoading || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
