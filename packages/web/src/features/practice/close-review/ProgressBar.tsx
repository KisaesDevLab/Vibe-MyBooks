// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

interface Props {
  remaining: number;
  total: number;
  label?: string;
}

// "X of Y remaining" progress surface. Build-plan §2.5 asks for
// this on the Close Review page; used here at both the top-of-
// page overall level and per-bucket.
export function ProgressBar({ remaining, total, label }: Props) {
  const completed = Math.max(0, total - remaining);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{label ?? 'Progress'}</span>
        <span>
          {remaining} of {total} remaining
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full bg-indigo-600 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
