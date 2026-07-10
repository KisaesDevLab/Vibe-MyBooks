// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import clsx from 'clsx';
import {
  PERMISSION_RESOURCES,
  PERMISSION_GROUPS,
  type ResourceKey,
  type PermissionMap,
  type AccessLevel,
} from '@kis-books/shared';

// Controlled matrix editor shared by the template editor and the
// per-user override editor. Each resource row offers None / View / Full
// (Full hidden on read-only resources). Absent keys render as None.

const LEVELS: AccessLevel[] = ['none', 'view', 'full'];
const LABEL: Record<AccessLevel, string> = { none: 'None', view: 'View', full: 'Full' };

function activeClass(level: AccessLevel): string {
  switch (level) {
    case 'full': return 'bg-green-600 text-white';
    case 'view': return 'bg-blue-600 text-white';
    default: return 'bg-gray-300 text-gray-800';
  }
}

export function PermissionsGrid({
  value,
  onChange,
  disabled = false,
}: {
  value: PermissionMap;
  onChange: (next: PermissionMap) => void;
  disabled?: boolean;
}) {
  const setLevel = (key: ResourceKey, level: AccessLevel) => {
    if (disabled) return;
    onChange({ ...value, [key]: level });
  };

  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((group) => (
        <div key={group}>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">{group}</h4>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {PERMISSION_RESOURCES.filter((r) => r.group === group).map((r) => {
              const current: AccessLevel = value[r.key] ?? 'none';
              return (
                <div key={r.key} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-800">{r.label}</span>
                  <div className="inline-flex gap-1">
                    {LEVELS.map((lvl) => {
                      if (lvl === 'full' && !r.writable) return null;
                      const active = current === lvl;
                      return (
                        <button
                          key={lvl}
                          type="button"
                          disabled={disabled}
                          onClick={() => setLevel(r.key, lvl)}
                          className={clsx(
                            'text-xs font-medium px-2.5 py-1 rounded-full transition-colors',
                            active ? activeClass(lvl) : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                            disabled && 'opacity-60 cursor-not-allowed',
                          )}
                        >
                          {LABEL[lvl]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
