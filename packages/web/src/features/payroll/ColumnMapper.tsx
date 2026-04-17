// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { PAYROLL_STANDARD_FIELDS } from '@kis-books/shared';
import { Button } from '../../components/ui/Button';
import { useApplyMapping } from '../../api/hooks/usePayrollImport';

interface Props {
  sessionId: string;
  headers: string[];
  sampleRows: string[][];
  onComplete: () => void;
}

export function ColumnMapper({ sessionId, headers, sampleRows, onComplete }: Props) {
  const applyMutation = useApplyMapping();
  const standardFields = Object.entries(PAYROLL_STANDARD_FIELDS);
  const requiredFields = standardFields.filter(([, v]) => v.required).map(([k]) => k);

  // Initialize mapping state
  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    // Auto-map by fuzzy name matching
    for (const [field, meta] of standardFields) {
      const match = headers.find(h =>
        h.toLowerCase().replace(/[^a-z0-9]/g, '') === field.replace(/_/g, '') ||
        h.toLowerCase().includes(meta.label.toLowerCase()) ||
        meta.label.toLowerCase().includes(h.toLowerCase())
      );
      if (match) initial[field] = match;
    }
    return initial;
  });

  const [headerRow, setHeaderRow] = useState(0);
  const [dataStartRow, setDataStartRow] = useState(1);
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');

  const setMapping = (field: string, source: string) => {
    setMappings(prev => {
      const next = { ...prev };
      if (source === '') {
        delete next[field];
      } else {
        next[field] = source;
      }
      return next;
    });
  };

  const unmappedRequired = requiredFields.filter(f => !mappings[f]);
  const canProceed = unmappedRequired.length === 0;

  const handleApply = async () => {
    const config = {
      header_row: headerRow,
      data_start_row: dataStartRow,
      date_format: dateFormat,
      mappings: Object.fromEntries(
        Object.entries(mappings).map(([field, source]) => [field, { source }])
      ),
      skip_rules: [
        { type: 'blank_field' as const, field: 'employee_name' },
        { type: 'value_match' as const, field: 'employee_name', values: ['Total', 'Grand Total', 'Totals'] },
      ],
    };
    await applyMutation.mutateAsync({ sessionId, config });
    onComplete();
  };

  // Get sample values for a header
  const getSamples = (header: string) => {
    const idx = headers.indexOf(header);
    if (idx < 0) return [];
    return sampleRows.slice(0, 3).map(r => r[idx] || '').filter(Boolean);
  };

  // Group fields by category
  const categories = [
    { key: 'identity', label: 'Identity' },
    { key: 'pay_period', label: 'Pay Period' },
    { key: 'gross', label: 'Gross Pay' },
    { key: 'ee_tax', label: 'Employee Taxes' },
    { key: 'ee_deduction', label: 'Employee Deductions' },
    { key: 'net', label: 'Net Pay' },
    { key: 'er_tax', label: 'Employer Taxes' },
    { key: 'er_benefit', label: 'Employer Benefits' },
    { key: 'contractor', label: 'Contractor' },
    { key: 'other', label: 'Other' },
  ];

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Column Mapping</h3>

      {/* Settings */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Header Row</label>
          <input type="number" min={0} value={headerRow} onChange={e => setHeaderRow(Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data Start Row</label>
          <input type="number" min={0} value={dataStartRow} onChange={e => setDataStartRow(Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date Format</label>
          <select value={dateFormat} onChange={e => setDateFormat(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm">
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          </select>
        </div>
      </div>

      {/* Mapping table by category */}
      {categories.map(cat => {
        const fields = standardFields.filter(([, v]) => v.category === cat.key);
        if (fields.length === 0) return null;
        return (
          <div key={cat.key} className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">{cat.label}</h4>
            <div className="space-y-1">
              {fields.map(([field, meta]) => {
                const mapped = mappings[field];
                const isRequired = meta.required;
                const isMapped = !!mapped;
                return (
                  <div key={field} className="flex items-center gap-3 py-1">
                    <div className="w-6 text-center">
                      {isMapped ? (
                        <span className="text-green-500 text-sm">&#10003;</span>
                      ) : isRequired ? (
                        <span className="text-red-500 text-sm">&#10007;</span>
                      ) : (
                        <span className="text-gray-300 text-sm">&#8211;</span>
                      )}
                    </div>
                    <div className="w-48 text-sm">
                      <span className={isRequired ? 'font-medium' : ''}>{meta.label}</span>
                      {isRequired && <span className="text-red-500 ml-1">*</span>}
                    </div>
                    <select
                      className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                      value={mapped || ''}
                      onChange={e => setMapping(field, e.target.value)}
                    >
                      <option value="">— Skip —</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <div className="w-40 text-xs text-gray-400 truncate">
                      {mapped && getSamples(mapped).join(', ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {!canProceed && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Missing required mappings: {unmappedRequired.join(', ')}
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={() => window.history.back()}>Back</Button>
        <Button onClick={handleApply} loading={applyMutation.isPending} disabled={!canProceed}>
          Apply Mapping & Continue
        </Button>
      </div>
    </div>
  );
}
