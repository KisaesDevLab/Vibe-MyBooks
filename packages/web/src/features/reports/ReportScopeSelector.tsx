import { useCompanyContext } from '../../providers/CompanyProvider';

interface ReportScopeSelectorProps {
  scope: 'company' | 'consolidated';
  onScopeChange: (scope: 'company' | 'consolidated') => void;
}

export function ReportScopeSelector({ scope, onScopeChange }: ReportScopeSelectorProps) {
  const { companies, activeCompanyName } = useCompanyContext();

  if (companies.length <= 1) return null;

  return (
    <select
      value={scope}
      onChange={(e) => onScopeChange(e.target.value as 'company' | 'consolidated')}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white"
    >
      <option value="company">{activeCompanyName}</option>
      <option value="consolidated">All Companies (Consolidated)</option>
    </select>
  );
}
