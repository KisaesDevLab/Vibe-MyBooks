// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

/**
 * Footnote block rendered below the three financial-statement reports
 * (P&L, Balance Sheet, Cash Flow). Mirrors the styling used by the PDF
 * exporter so the on-screen and printed views match. Renders nothing
 * when the tenant hasn't configured a footer.
 */
export function ReportFooter({ text }: { text?: string | null }) {
  const value = (text ?? '').trim();
  if (value.length === 0) return null;
  return (
    <div className="mt-6 pt-3 border-t border-gray-200 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
      {value}
    </div>
  );
}
