// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { useMe } from '../../api/hooks/useAuth';
import { apiClient, setTokens } from '../../api/client';
import { AlertCircle, ChevronDown, Plus, Building2, Check, Users, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCoaTemplateOptions } from '../../api/hooks/useCoaTemplateOptions';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toaster';

// Temporarily disabled: "New Company (current)" (create a second company in the
// current tenant) doesn't behave as intended yet — banking is tenant-wide, so a
// new company doesn't get its own banking screen, which confuses operators.
// Hidden until that flow is reworked. Flip to true to restore. "New Company
// (no owner)" (the practice/client flow) is unaffected.
const NEW_COMPANY_CURRENT_ENABLED = false;

interface AddCompanyModalProps {
  mode: 'company' | 'client';
  onClose: () => void;
  onCreated: (companyId?: string) => void;
}

function AddCompanyModal({ mode, onClose, onCreated }: AddCompanyModalProps) {
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState('sole_prop');
  const [businessType, setBusinessType] = useState('general_business');
  const [systemAccountsOnly, setSystemAccountsOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const businessTypeOptions = useCoaTemplateOptions();

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      // Use apiClient (not raw fetch) so requests inherit the BASE_URL
      // prefix, X-App-Base header, auth token, and graceful non-JSON
      // error handling. A bare fetch('/api/v1/...') 404s on subpath
      // appliance installs (BASE_URL='/mybooks/') because the front
      // proxy only routes the prefixed path — the raw path fell through
      // to the proxy's plain-text "Not found", which then blew up
      // res.json() with "Unexpected token 'N'".
      if (mode === 'client') {
        // Create new tenant + company
        await apiClient('/auth/create-client', {
          method: 'POST',
          body: JSON.stringify({ companyName: name, entityType, businessType, systemAccountsOnly }),
        });
        onCreated();
      } else {
        // Create company in current tenant
        const data = await apiClient<{ company: { id: string } }>('/company/create', {
          method: 'POST',
          body: JSON.stringify({ businessName: name, entityType, businessType }),
        });
        onCreated(data.company.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()} style={{ color: '#111827' }}>
        <h2 className="text-lg font-semibold mb-4">
          {mode === 'client' ? 'New Company (no owner)' : 'New Company (current)'}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              {mode === 'client' ? 'Client / Business Name' : 'Business Name'}
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Entity Type</label>
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="sole_prop">Sole Proprietorship</option>
              <option value="single_member_llc">Single Member LLC</option>
              <option value="s_corp">S Corporation</option>
              <option value="c_corp">C Corporation</option>
              <option value="partnership">Partnership</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Business Type</label>
            <select value={businessType} onChange={(e) => setBusinessType(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {businessTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {mode === 'client' && (
            <>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={systemAccountsOnly}
                  onChange={(e) => setSystemAccountsOnly(e.target.checked)}
                  className="mt-0.5 text-primary-600 focus:ring-primary-500" />
                <span className="text-xs text-gray-600">
                  <span className="font-medium text-gray-700">Set up required accounts only</span>
                  {' — '}skip the full chart of accounts and create just the system accounts (A/R, A/P, Payments Clearing, Sales Tax, Opening Balances, Retained Earnings, Cash). Add the rest later or import your own.
                </span>
              </label>
              <p className="text-xs text-gray-500">
                This creates a new company with its own workspace{systemAccountsOnly ? '' : ' and chart of accounts'}. No users are added — you can invite an owner or bookkeeper from Settings &gt; Team after switching to it.
              </p>
            </>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">Cancel</button>
          <button onClick={handleSubmit} disabled={!name.trim() || loading}
            className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {loading ? 'Creating...' : mode === 'client' ? 'Create' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CompanySwitcher() {
  const { activeCompanyId, companies, activeCompanyName, setActiveCompany, refreshCompanies, clearActiveCompany } = useCompanyContext();
  const { data: meData } = useMe();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState<'company' | 'client' | null>(null);
  const [switchError, setSwitchError] = useState('');
  const [switchingTenantId, setSwitchingTenantId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; businessName: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const handleDeleteCompany = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient(`/company/${deleteTarget.id}`, { method: 'DELETE' });
      // If we deleted the active company, switch to another one first.
      if (deleteTarget.id === activeCompanyId) {
        const next = companies.find((c) => c.id !== deleteTarget.id);
        if (next) setActiveCompany(next.id);
      }
      refreshCompanies();
      toast.success(`Deleted "${deleteTarget.businessName}".`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the company.');
    } finally {
      setDeleting(false);
    }
  };

  const navigate = useNavigate();
  const accessibleTenants = meData?.accessibleTenants || [];
  const activeTenantId = meData?.activeTenantId;
  const hasMultipleTenants = accessibleTenants.length > 1;
  // The dropdown surfaces only the 10 most-recently-used tenants (the backend
  // returns them ordered most-recent-first). The active tenant is always shown,
  // and the full searchable/sortable list lives on the "View all clients" page.
  const RECENT_LIMIT = 10;
  const recentTenants = useMemo(() => {
    const active = accessibleTenants.filter((t) => t.tenantId === activeTenantId);
    const rest = accessibleTenants.filter((t) => t.tenantId !== activeTenantId);
    return [...active, ...rest].slice(0, RECENT_LIMIT);
  }, [accessibleTenants, activeTenantId]);
  const userRole = meData?.user?.role;
  const canCreateClient = userRole === 'accountant' || userRole === 'bookkeeper' || meData?.user?.isSuperAdmin;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  if (companies.length === 0 && !hasMultipleTenants) return null;

  const handleCompanyCreated = (newCompanyId?: string) => {
    setShowAddModal(null);
    if (newCompanyId) {
      refreshCompanies();
      setActiveCompany(newCompanyId);
    } else {
      // Client created — refresh me to get updated tenant list
      queryClient.invalidateQueries({ queryKey: ['me'] });
    }
  };

  const handleSwitchTenant = async (tenantId: string) => {
    setSwitchError('');
    setSwitchingTenantId(tenantId);
    try {
      const result = await apiClient<{ tokens: { accessToken: string } }>('/auth/switch-tenant', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
      });
      if (!result?.tokens?.accessToken) {
        throw new Error('Server did not return new access tokens.');
      }
      setTokens(result.tokens);
      // CRITICAL: drop the stored activeCompanyId before reloading. It
      // belongs to the previous tenant — keeping it causes every X-Company-Id
      // header on the new tenant's first page load to fail companyContext
      // validation with 403 ("Company not found or access denied"), which
      // looks like the switch itself failed.
      clearActiveCompany();
      queryClient.clear();
      setIsOpen(false);

      // Force a full-page navigation so every cached component, provider,
      // and closed-over access token gets rebuilt with the new tenant's
      // context. Three known footguns we've hit and now defend against:
      //
      //  1. `window.location.href = '/'` is a no-op when the user is
      //     already at `/`. Earlier fix used replaceState+reload to
      //     work around this.
      //  2. `window.location.reload()` is silently blocked when ANY
      //     `beforeunload` handler in the tree returns truthy — e.g.
      //     the dirty-layout warning in LayoutEditor. The symptom was
      //     "switching…" spinner that never resolves.
      //  3. Even when reload fires, an aggressive service-worker cache
      //     can serve a stale shell that re-mounts CompanyProvider
      //     before localStorage's new state is read.
      //
      // The cache-busting query param + .assign() avoids all three:
      // assign() always navigates (no same-URL no-op), the unique
      // query string defeats SW cache, and full navigation drops
      // every in-memory closure including any beforeunload prompts.
      // BASE_URL (not `/`) — appliance mounts the SPA under a subpath and
      // hardcoding root lands on the host's landing page.
      const targetUrl = `${window.location.origin}${import.meta.env.BASE_URL}?_switch=${Date.now()}`;
      // Suppress any beforeunload prompt the current page may have
      // wired up — they're for "unsaved work" dialogs that don't
      // apply when the user is intentionally switching firms.
      window.onbeforeunload = null;
      window.location.assign(targetUrl);
    } catch (err) {
      // Surface the real reason instead of a generic message. The user
      // could be hitting "no access to this tenant", a network failure, or
      // a server error — each needs different action.
      // eslint-disable-next-line no-console
      console.error('[CompanySwitcher] tenant switch failed:', err);
      const message = err instanceof Error ? err.message : 'Could not switch tenant.';
      setSwitchError(
        message === 'Request failed'
          ? 'Could not switch tenant. Please try again or sign out and back in.'
          : message,
      );
      setSwitchingTenantId(null);
    }
  };

  const activeTenantName = accessibleTenants.find((t) => t.tenantId === activeTenantId)?.tenantName || '';

  return (
    <>
      <div className="px-3 py-2 relative" ref={dropdownRef} style={{ borderBottom: '1px solid #374151' }}>
        <button
          onClick={() => { if (!isOpen) setSwitchError(''); setIsOpen(!isOpen); }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ color: '#E5E7EB', backgroundColor: isOpen ? '#1F2937' : 'transparent' }}
          onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.backgroundColor = '#1F2937'; }}
          onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.backgroundColor = ''; }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 flex-shrink-0" style={{ color: '#9CA3AF' }} />
            <span className="truncate">{activeCompanyName || 'Select Company'}</span>
          </div>
          <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: '#6B7280' }} />
        </button>

        {isOpen && (
          <div className="absolute left-3 right-3 mt-1 rounded-lg shadow-lg z-50 overflow-hidden max-h-96 overflow-y-auto" style={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}>
            {/* Tenant switcher — only if multiple tenants */}
            {hasMultipleTenants && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold uppercase" style={{ color: '#6B7280' }}>
                  Switch Client
                </div>
                {switchError && (
                  <div className="mx-3 mb-2 flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs"
                    role="alert"
                    style={{ borderColor: '#7F1D1D', backgroundColor: '#450A0A', color: '#FCA5A5' }}>
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>{switchError}</span>
                  </div>
                )}
                {recentTenants.map((t) => {
                  const isActive = t.tenantId === activeTenantId;
                  const isSwitching = switchingTenantId === t.tenantId;
                  const disabled = isActive || switchingTenantId !== null;
                  return (
                    <button
                      key={t.tenantId}
                      onClick={() => { if (!disabled) handleSwitchTenant(t.tenantId); }}
                      disabled={disabled}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed"
                      style={{
                        color: isActive ? '#FFFFFF' : (switchingTenantId !== null && !isSwitching ? '#6B7280' : '#D1D5DB'),
                        backgroundColor: isActive ? '#374151' : 'transparent',
                        opacity: switchingTenantId !== null && !isActive && !isSwitching ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = '#374151'; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = ''; }}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5" style={{ color: '#6B7280' }} />
                        <span className="truncate">{t.tenantName}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#374151', color: '#9CA3AF' }}>{t.role}</span>
                      </div>
                      {isSwitching ? (
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>switching…</span>
                      ) : isActive ? (
                        <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#60A5FA' }} />
                      ) : null}
                    </button>
                  );
                })}
                <button
                  onClick={() => { setIsOpen(false); navigate('/clients'); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
                  style={{ color: '#9CA3AF' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#374151'; e.currentTarget.style.color = '#FFFFFF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = '#9CA3AF'; }}
                >
                  <Users className="h-3.5 w-3.5" style={{ color: '#6B7280' }} />
                  <span>View all clients{accessibleTenants.length > RECENT_LIMIT ? ` (${accessibleTenants.length})` : ''}…</span>
                </button>
                <div style={{ borderTop: '1px solid #374151' }} />
                <div className="px-3 py-1.5 text-xs font-semibold uppercase" style={{ color: '#6B7280' }}>
                  {activeTenantName} Companies
                </div>
              </>
            )}

            {/* Company list */}
            {companies.map((company) => (
              <div
                key={company.id}
                className="group w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors"
                style={{ color: company.id === activeCompanyId ? '#FFFFFF' : '#D1D5DB', backgroundColor: company.id === activeCompanyId ? '#374151' : 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#374151'; }}
                onMouseLeave={(e) => { if (company.id !== activeCompanyId) e.currentTarget.style.backgroundColor = ''; }}
              >
                <button
                  onClick={() => { setActiveCompany(company.id); setIsOpen(false); }}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  style={{ color: 'inherit', backgroundColor: 'transparent' }}
                >
                  <span className="truncate">{company.businessName}</span>
                  {company.id === activeCompanyId && <Check className="h-4 w-4 flex-shrink-0" style={{ color: '#60A5FA' }} />}
                </button>
                {/* Owner-only delete for a non-last company. Server also guards
                    against deleting the last company or one with activity. */}
                {userRole === 'owner' && companies.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: company.id, businessName: company.businessName }); }}
                    title="Delete company"
                    aria-label={`Delete ${company.businessName}`}
                    className="ml-2 flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: 'transparent' }}
                  >
                    <Trash2 className="h-4 w-4" style={{ color: '#F87171' }} />
                  </button>
                )}
              </div>
            ))}

            {/* Actions */}
            {(NEW_COMPANY_CURRENT_ENABLED || canCreateClient) && (
            <div style={{ borderTop: '1px solid #374151' }}>
              {NEW_COMPANY_CURRENT_ENABLED && (
              <button
                onClick={() => { setIsOpen(false); setShowAddModal('company'); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors"
                style={{ color: '#60A5FA' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#374151'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
              >
                <Plus className="h-4 w-4" />
                New Company (current)
              </button>
              )}
              {canCreateClient && (
                <button
                  onClick={() => { setIsOpen(false); setShowAddModal('client'); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors"
                  style={{ color: '#34D399' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#374151'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                >
                  <Plus className="h-4 w-4" />
                  New Company (no owner)
                </button>
              )}
            </div>
            )}
          </div>
        )}
      </div>

      {showAddModal && <AddCompanyModal mode={showAddModal} onClose={() => setShowAddModal(null)} onCreated={handleCompanyCreated} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete company?"
        message={`Permanently delete "${deleteTarget?.businessName}" from this tenant? This is only allowed when the company has no transactions, bank feed items, or bank connections. The tenant's chart of accounts (shared across companies) is not affected.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete company'}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteCompany}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />
    </>
  );
}
