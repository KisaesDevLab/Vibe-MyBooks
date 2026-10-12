// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Display helpers for the estimate screens. Engine money is a decimal string in whole dollars;
// everything here only formats — no tax math (rule: the UI never recomputes the engine).
import { formatMoneyWith } from '../../../utils/money';

export const dollars = (v: string | number | null | undefined): string => formatMoneyWith(v ?? 0, { decimals: 0 });
export const dollarsOrDash = (v: string | number | null | undefined): string => (v == null ? '—' : dollars(v));

/** Fraction string -> "22%" / "18.8%". */
export function pct(v: string | number | null | undefined, places = 1): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '—';
  const s = (n * 100).toFixed(places);
  return `${s.replace(/\.0+$/, '')}%`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 'YYYY-MM-DD' -> 'Jan 15, 2027' (no timezone conversion). */
export function fmtDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return '—';
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}, ${m[1]}`;
}
/** 'YYYY-MM' -> 'Sep 2026'. */
export function fmtMonth(ym: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(ym ?? '');
  return m ? `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}` : '—';
}
/** Whole days from `today` to the ISO date (negative = past). */
export function daysUntil(iso: string, today: Date = new Date()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return 0;
  const a = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / 86_400_000);
}

export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : 'Request failed');

export const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const JURISDICTION_LABEL = (j: string): string => (j === 'federal' ? 'Federal' : j);
