import { useState, useRef, useEffect } from 'react';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { useMe } from '../../api/hooks/useAuth';
import { apiClient, setTokens } from '../../api/client';
import { ChevronDown, Plus, Building2, Check, Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { BUSINESS_TYPE_OPTIONS } from '@kis-books/shared';

interface AddCompanyModalProps {
  mode: 'company' | 'client';
  onClose: () => void;
  onCreated: (companyId?: string) => void;
}

function AddCompanyModal({ mode, onClose, onCreated }: AddCompanyModalProps) {
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState('sole_prop');
  const [industry, setIndustry] = useState('');
  const [businessType, setBusinessType] = useState('general_business');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      if (mode === 'client') {
        // Create new tenant + company
        const res = await fetch('/api/v1/auth/create-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ companyName: name, entityType, industry: industry || undefined, businessType }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || 'Failed'); }
        onCreated();
      } else {
        // Create company in current tenant
        const res = await fetch('/api/v1/company/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ businessName: name, entityType, industry: industry || undefined, businessType }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || 'Failed'); }
        const data = await res.json();
        onCreated(data.company.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
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
              {BUSINESS_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {mode === 'client' && (
            <p className="text-xs text-gray-500">
              This creates a new company with its own workspace and chart of accounts. No users are added — you can invite an owner or bookkeeper from Settings &gt; Team after switching to it.
            </p>
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
  const { activeCompanyId, companies, activeCompanyName, setActiveCompany, refreshCompanies } = useCompanyContext();
  const { data: meData } = useMe();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState<'company' | 'client' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const accessibleTenants = (meData as any)?.accessibleTenants || [];
  const activeTenantId = (meData as any)?.activeTenantId;
  const hasMultipleTenants = accessibleTenants.length > 1;
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
    setIsOpen(false);
    try {
      const result = await apiClient<{ tokens: { accessToken: string; refreshToken: string } }>('/auth/switch-tenant', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
      });
      setTokens(result.tokens);
      // Clear all caches and reload
      queryClient.clear();
      window.location.href = '/';
    } catch {
      alert('Failed to switch tenant');
    }
  };

  const activeTenantName = accessibleTenants.find((t: any) => t.tenantId === activeTenantId)?.tenantName || '';

  return (
    <>
      <div className="px-3 py-2 relative" ref={dropdownRef} style={{ borderBottom: '1px solid #374151' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
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
                {accessibleTenants.map((t: any) => (
                  <button
                    key={t.tenantId}
                    onClick={() => t.tenantId === activeTenantId ? null : handleSwitchTenant(t.tenantId)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm transition-colors"
                    style={{ color: t.tenantId === activeTenantId ? '#FFFFFF' : '#D1D5DB', backgroundColor: t.tenantId === activeTenantId ? '#374151' : 'transparent' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#374151'; }}
                    onMouseLeave={(e) => { if (t.tenantId !== activeTenantId) e.currentTarget.style.backgroundColor = ''; }}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" style={{ color: '#6B7280' }} />
                      <span className="truncate">{t.tenantName}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#374151', color: '#9CA3AF' }}>{t.role}</span>
                    </div>
                    {t.tenantId === activeTenantId && <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#60A5FA' }} />}
                  </button>
                ))}
                <div style={{ borderTop: '1px solid #374151' }} />
                <div className="px-3 py-1.5 text-xs font-semibold uppercase" style={{ color: '#6B7280' }}>
                  {activeTenantName} Companies
                </div>
              </>
            )}

            {/* Company list */}
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => { setActiveCompany(company.id); setIsOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors"
                style={{ color: company.id === activeCompanyId ? '#FFFFFF' : '#D1D5DB', backgroundColor: company.id === activeCompanyId ? '#374151' : 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#374151'; }}
                onMouseLeave={(e) => { if (company.id !== activeCompanyId) e.currentTarget.style.backgroundColor = ''; }}
              >
                <span className="truncate">{company.businessName}</span>
                {company.id === activeCompanyId && <Check className="h-4 w-4 flex-shrink-0" style={{ color: '#60A5FA' }} />}
              </button>
            ))}

            {/* Actions */}
            <div style={{ borderTop: '1px solid #374151' }}>
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
          </div>
        )}
      </div>

      {showAddModal && <AddCompanyModal mode={showAddModal} onClose={() => setShowAddModal(null)} onCreated={handleCompanyCreated} />}
    </>
  );
}
