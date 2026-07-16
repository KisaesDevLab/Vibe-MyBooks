// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { ReactNode } from 'react';
import { useBranding } from '../../api/hooks/useBranding';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const { appName } = useBranding();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{appName}</h1>
          <h2 className="mt-2 text-xl font-semibold text-gray-700">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
