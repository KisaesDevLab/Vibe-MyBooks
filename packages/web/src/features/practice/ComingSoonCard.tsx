// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Sparkles } from 'lucide-react';

interface ComingSoonCardProps {
  feature: string;
  description: string;
  buildPhase: string;
}

// Placeholder card rendered by every Practice route until the
// backing phase ships. Kept deliberately plain so later phases
// can swap in real surfaces without having to unwind styling.
export function ComingSoonCard({ feature, description, buildPhase }: ComingSoonCardProps) {
  return (
    <div className="max-w-2xl mx-auto mt-8 bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-indigo-50">
          <Sparkles className="h-6 w-6 text-indigo-600" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">{feature}</h1>
      </div>
      <p className="text-gray-600 mb-6 leading-relaxed">{description}</p>
      <div className="border-t border-gray-100 pt-4 text-sm text-gray-500">
        <span className="font-medium text-gray-700">Coming soon.</span>{' '}
        Ships in {buildPhase}.
      </div>
    </div>
  );
}
