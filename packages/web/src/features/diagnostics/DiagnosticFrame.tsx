// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  title: string;
  code: string;
  children: ReactNode;
}

/**
 * Shared chrome for every diagnostic page. Full-viewport, dark-red header to
 * make it instantly clear this is NOT a normal page of the app.
 */
export function DiagnosticFrame({ title, code, children }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="bg-red-950 border-b-4 border-red-700 px-8 py-6">
        <div className="max-w-4xl mx-auto flex items-start gap-4">
          <AlertTriangle className="h-10 w-10 text-red-300 flex-shrink-0 mt-1" />
          <div>
            <h1 className="text-2xl font-bold text-red-100">{title}</h1>
            <p className="mt-1 text-sm text-red-300 font-mono">
              Installation state: <span className="font-bold">{code}</span>
            </p>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-8 py-10 space-y-6">{children}</main>
    </div>
  );
}
