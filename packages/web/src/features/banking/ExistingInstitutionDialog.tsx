// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Button } from '../../components/ui/Button';
import { AlertTriangle, Link2, Plus } from 'lucide-react';

interface Props {
  institutionName: string;
  existingAccountCount: number;
  hiddenAccountCount: number;
  onUseShared: () => void;
  onConnectSeparately: () => void;
  onCancel: () => void;
}

export function ExistingInstitutionDialog({ institutionName, existingAccountCount, hiddenAccountCount, onUseShared, onConnectSeparately, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold text-gray-900">{institutionName} is already connected</h3>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          This institution already has an active connection in the system with {existingAccountCount} account{existingAccountCount !== 1 ? 's' : ''}.
          {hiddenAccountCount > 0 && ` (${hiddenAccountCount} assigned to other companies)`}
        </p>

        <div className="space-y-3">
          <button onClick={onUseShared}
            className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-primary-300 hover:bg-primary-50/30 transition-colors">
            <div className="flex items-center gap-3">
              <Link2 className="h-5 w-5 text-primary-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Use the existing connection</p>
                <p className="text-xs text-gray-500">Map unassigned accounts to your company. No duplicate bank connections.</p>
              </div>
            </div>
          </button>

          <button onClick={onConnectSeparately}
            className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
            <div className="flex items-center gap-3">
              <Plus className="h-5 w-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Connect separately</p>
                <p className="text-xs text-gray-500">Create an independent connection. Use this if you need a separate login or different accounts.</p>
              </div>
            </div>
          </button>
        </div>

        <div className="flex justify-end mt-4">
          <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
