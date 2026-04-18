// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from 'react-plaid-link';
import type { PlaidAccount, PlaidItem } from '@kis-books/shared';
import { useBankConnections, useDisconnectBank } from '../../api/hooks/useBanking';
import { usePlaidItems, useCreateLinkToken, useExchangeToken, useSyncPlaidItem, useUnmapCompany, useTogglePlaidSync, usePlaidActivity } from '../../api/hooks/usePlaid';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { BankImportModal } from './BankImportModal';
import { PlaidMappingWizard } from './PlaidMappingWizard';
import { RemapAccountModal } from './RemapAccountModal';
import { DisconnectDialog } from './DisconnectDialog';
import { ExistingInstitutionDialog } from './ExistingInstitutionDialog';
import { FullDisconnectDialog } from './FullDisconnectDialog';
import { apiClient } from '../../api/client';
import { Landmark, Upload, Unplug, RefreshCw, AlertTriangle, CheckCircle, Link2, Wrench, Pencil, Share2, Clock, Trash2 } from 'lucide-react';

// The `/plaid/items/:id` detail endpoint returns the item plus its
// child accounts and the denormalised hiddenAccountCount (accounts
// visible to other tenants). Narrow locally; both of those fields
// already live on the shared PlaidItem type.
interface PlaidItemDetail {
  item?: PlaidItem;
  accounts: PlaidAccount[];
  hiddenAccountCount?: number;
}

function PlaidLinkButton({ onSuccess }: { onSuccess: (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => void }) {
  const createLink = useCreateLinkToken();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const startLink = async () => { const r = await createLink.mutateAsync(); setLinkToken(r.linkToken); };
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (pt, m) => { onSuccess(pt, m); setLinkToken(null); },
    onExit: () => setLinkToken(null),
  });
  if (linkToken && ready) setTimeout(() => open(), 0);
  return <Button size="sm" onClick={startLink} loading={createLink.isPending}><Link2 className="h-4 w-4 mr-1" /> Connect Bank</Button>;
}

const statusBadge = (s: string) => {
  if (s === 'active') return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle className="h-3 w-3" />Active</span>;
  if (s === 'login_required') return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><AlertTriangle className="h-3 w-3" />Login Required</span>;
  if (s === 'error') return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Error</span>;
  return <span className="text-xs text-gray-500">{s}</span>;
};

function ActivityLog({ itemId }: { itemId: string }) {
  const { data } = usePlaidActivity(itemId);
  const logs = data?.activity || [];
  return (
    <div className="border-t border-gray-100 pt-3 mt-2">
      <p className="text-xs font-medium text-gray-500 mb-2">Activity</p>
      {logs.length === 0 ? <p className="text-xs text-gray-400">No activity recorded.</p> : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {logs.map((l) => (
            <div key={l.id} className="text-xs text-gray-600 flex justify-between">
              <span>{l.action.replace(/_/g, ' ')} {l.performedByName && `by ${l.performedByName}`}</span>
              <span className="text-gray-400">{new Date(l.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BankConnectionsPage() {
  const navigate = useNavigate();
  const { data: legacyData, isLoading: legacyLoading } = useBankConnections();
  const { data: plaidData, isLoading: plaidLoading, refetch } = usePlaidItems();
  const disconnect = useDisconnectBank();
  const exchangeToken = useExchangeToken();
  const syncItem = useSyncPlaidItem();
  const unmapCompany = useUnmapCompany();
  const [showImport, setShowImport] = useState(false);
  const [mappingData, setMappingData] = useState<{ accounts: PlaidAccount[]; hiddenAccountCount: number } | null>(null);
  const [remapAccount, setRemapAccount] = useState<PlaidAccount | null>(null);
  const [disconnectItem, setDisconnectItem] = useState<{ id: string; name: string } | null>(null);
  const [showActivity, setShowActivity] = useState<string | null>(null);
  const [existingInstitution, setExistingInstitution] = useState<{ publicToken: string; metadata: PlaidLinkOnSuccessMetadata; item: PlaidItem; accounts: PlaidAccount[]; hiddenCount: number } | null>(null);
  const [fullDisconnect, setFullDisconnect] = useState<{ id: string; name: string; accounts: PlaidAccount[]; hiddenCount: number } | null>(null);
  const [unmapCompanyId, setUnmapCompanyId] = useState<string | null>(null);

  const handlePlaidSuccess = useCallback(async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
    const result = await exchangeToken.mutateAsync({
      publicToken,
      institutionId: metadata.institution?.institution_id,
      institutionName: metadata.institution?.name,
      accounts: metadata.accounts,
      linkSessionId: metadata.link_session_id,
    });

    // If existing institution was detected, show the choice dialog
    if (result.isExisting && result.item) {
      const detail = await apiClient<PlaidItemDetail>(`/plaid/items/${result.item.id}`);
      setExistingInstitution({
        publicToken,
        metadata,
        item: result.item,
        accounts: detail.accounts || [],
        hiddenCount: detail.hiddenAccountCount || 0,
      });
      return;
    }

    if (result.item?.id) {
      const detail = await apiClient<PlaidItemDetail>(`/plaid/items/${result.item.id}`);
      setMappingData({ accounts: detail.accounts || [], hiddenAccountCount: detail.hiddenAccountCount || 0 });
    }
  }, [exchangeToken]);

  if (legacyLoading || plaidLoading) return <LoadingSpinner className="py-12" />;
  const legacyConnections = legacyData?.connections || [];
  const plaidItems = plaidData?.items || [];
  const needsAttention = plaidItems.filter((i) => ['login_required', 'pending_disconnect', 'error'].includes(i.itemStatus));

  return (
    <div>
      <ConfirmDialog
        open={!!unmapCompanyId}
        title="Disconnect this company?"
        message="Other companies using this connection are not affected. You can reconnect at any time."
        confirmLabel="Disconnect"
        variant="danger"
        onCancel={() => setUnmapCompanyId(null)}
        onConfirm={() => {
          if (unmapCompanyId) unmapCompany.mutate({ itemId: unmapCompanyId });
          setUnmapCompanyId(null);
        }}
      />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bank Connections</h1>
        <div className="flex gap-2">
          <PlaidLinkButton onSuccess={handlePlaidSuccess} />
          <Button size="sm" variant="secondary" onClick={() => setShowImport(true)}><Upload className="h-4 w-4 mr-1" /> Import File</Button>
        </div>
      </div>

      {needsAttention.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">{needsAttention.length} connection{needsAttention.length > 1 ? 's' : ''} need attention</p>
          </div>
          {needsAttention.map((item) => (
            <div key={item.id} className="mt-2 flex items-center justify-between">
              <span className="text-sm text-amber-700">{item.institutionName} — {item.errorMessage || item.itemStatus.replace(/_/g, ' ')}</span>
              <Button size="sm" variant="secondary"><Wrench className="h-3.5 w-3.5 mr-1" />Fix Now</Button>
            </div>
          ))}
        </div>
      )}

      {plaidItems.length > 0 && (
        <div className="space-y-3 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Connected via Plaid</h2>
          {plaidItems.map((item) => {
            const myAccounts = (item.accounts || []).filter((a) => a.mapping);
            const unassigned = (item.accounts || []).filter((a) => !a.mapping);
            const isShared = (item.hiddenAccountCount || 0) > 0;

            return (
              <div key={item.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Landmark className="h-8 w-8 text-primary-600" />
                    <div>
                      <p className="font-medium text-gray-900 flex items-center gap-2">
                        {item.institutionName || 'Bank'}
                        {isShared && <span className="text-xs text-gray-400 flex items-center gap-0.5"><Share2 className="h-3 w-3" />Shared</span>}
                      </p>
                      <p className="text-xs text-gray-500">
                        {myAccounts.length} mapped{unassigned.length > 0 && ` · ${unassigned.length} unassigned`}
                        {(item.hiddenAccountCount ?? 0) > 0 && ` · ${item.hiddenAccountCount} in other companies`}
                        {' · '}Last sync: {item.lastSyncAt ? new Date(item.lastSyncAt).toLocaleString() : 'Never'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(item.itemStatus)}
                    <Button variant="ghost" size="sm" onClick={() => syncItem.mutate(item.id)} loading={syncItem.isPending} title="Sync"><RefreshCw className="h-4 w-4" /></Button>
                    {unassigned.length > 0 && (
                      <Button variant="secondary" size="sm" onClick={() => setMappingData({ accounts: item.accounts ?? [], hiddenAccountCount: item.hiddenAccountCount || 0 })}>Map</Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setShowActivity(showActivity === item.id ? null : item.id)} title="Activity"><Clock className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setUnmapCompanyId(item.id)} title="Disconnect company">
                      <Unplug className="h-4 w-4 text-amber-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setFullDisconnect({ id: item.id, name: item.institutionName || 'Bank', accounts: item.accounts || [], hiddenCount: item.hiddenAccountCount || 0 })} title="Delete entire connection">
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>

                {myAccounts.length > 0 && (
                  <div className="border-t border-gray-100 pt-2 space-y-1">
                    {myAccounts.map((acct) => (
                      <div key={acct.id} className="flex items-center justify-between text-sm py-1.5">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={acct.mapping?.isSyncEnabled !== false}
                            onChange={(e) => apiClient(`/plaid/accounts/${acct.id}/sync-toggle`, { method: 'PUT', body: JSON.stringify({ enabled: e.target.checked }) }).then(() => refetch())}
                            className="rounded border-gray-300 text-primary-600 h-3.5 w-3.5" />
                          <span className="text-gray-700">{acct.name} {acct.mask && `(****${acct.mask})`}</span>
                          {acct.mapping?.syncStartDate && <span className="text-xs text-gray-400">from {acct.mapping.syncStartDate}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-600">Mapped</span>
                          <button onClick={() => setRemapAccount(acct)} className="text-gray-400 hover:text-primary-600"><Pencil className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {unassigned.length > 0 && (
                  <div className="border-t border-gray-100 pt-2 mt-1">
                    <p className="text-xs text-gray-400 mb-1">Unassigned:</p>
                    {unassigned.map((acct) => (
                      <div key={acct.id} className="flex items-center justify-between text-sm py-1 text-gray-500">
                        <span>{acct.name} {acct.mask && `(****${acct.mask})`} · {acct.accountSubtype}</span>
                        <span className="text-xs text-amber-600">Not mapped</span>
                      </div>
                    ))}
                  </div>
                )}

                {showActivity === item.id && <ActivityLog itemId={item.id} />}
              </div>
            );
          })}
        </div>
      )}

      {legacyConnections.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">File Imports</h2>
          {legacyConnections.map((conn) => (
            <div key={conn.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
              onClick={() => navigate('/banking/feed')}>
              <div className="flex items-center gap-3">
                <Landmark className="h-8 w-8 text-gray-400" />
                <div><p className="font-medium text-gray-900">{conn.accountName || conn.institutionName || 'Bank Account'}</p>
                  <p className="text-sm text-gray-500">{conn.provider === 'manual' ? 'File Import' : conn.provider}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); navigate('/banking/feed'); }}>Review Feed</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {plaidItems.length === 0 && legacyConnections.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          <Landmark className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="mb-2">No bank connections yet.</p>
          <p className="text-sm">Connect your bank via Plaid or import a CSV/OFX file.</p>
        </div>
      )}

      {showImport && <BankImportModal onClose={() => setShowImport(false)} />}
      {mappingData && <PlaidMappingWizard accounts={mappingData.accounts} hiddenAccountCount={mappingData.hiddenAccountCount} onClose={() => setMappingData(null)} onComplete={() => { setMappingData(null); refetch(); }} />}
      {remapAccount && <RemapAccountModal account={remapAccount} onClose={() => setRemapAccount(null)} onSaved={() => { setRemapAccount(null); refetch(); }} />}
      {disconnectItem && <DisconnectDialog itemId={disconnectItem.id} institutionName={disconnectItem.name} onClose={() => setDisconnectItem(null)} onRemoved={() => { setDisconnectItem(null); refetch(); }} />}
      {fullDisconnect && (
        <FullDisconnectDialog
          itemId={fullDisconnect.id}
          institutionName={fullDisconnect.name}
          accounts={fullDisconnect.accounts}
          hiddenAccountCount={fullDisconnect.hiddenCount}
          onClose={() => setFullDisconnect(null)}
          onRemoved={() => { setFullDisconnect(null); refetch(); }}
        />
      )}
      {existingInstitution && (
        <ExistingInstitutionDialog
          institutionName={existingInstitution.metadata.institution?.name || 'Bank'}
          existingAccountCount={existingInstitution.accounts.length}
          hiddenAccountCount={existingInstitution.hiddenCount}
          onUseShared={() => {
            // Open mapping wizard for the existing item's unassigned accounts
            setMappingData({ accounts: existingInstitution.accounts, hiddenAccountCount: existingInstitution.hiddenCount });
            setExistingInstitution(null);
          }}
          onConnectSeparately={async () => {
            // Force create a new independent connection
            const result = await exchangeToken.mutateAsync({
              publicToken: existingInstitution.publicToken,
              institutionId: existingInstitution.metadata.institution?.institution_id,
              institutionName: existingInstitution.metadata.institution?.name,
              accounts: existingInstitution.metadata.accounts,
              linkSessionId: existingInstitution.metadata.link_session_id,
              forceNew: true,
            });
            if (result.item?.id) {
              const detail = await apiClient<PlaidItemDetail>(`/plaid/items/${result.item.id}`);
              setMappingData({ accounts: detail.accounts || [], hiddenAccountCount: detail.hiddenAccountCount || 0 });
            }
            setExistingInstitution(null);
          }}
          onCancel={() => setExistingInstitution(null)}
        />
      )}
    </div>
  );
}
