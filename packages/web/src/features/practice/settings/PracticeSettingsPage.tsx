// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CLASSIFICATION_THRESHOLDS_DEFAULT } from '@kis-books/shared';
import { useThresholds, useSetThresholds } from '../../../api/hooks/usePracticeSettings';
import {
  useCheckRegistry,
  useCheckOverrides,
  useSetCheckOverride,
  useDeleteCheckOverride,
} from '../../../api/hooks/useReviewChecks';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

// Owner-only surface to override the four classification
// thresholds. PracticeLayout already gates this route by
// minRole=owner, so the page doesn't need to re-check. Empty
// values fall back to plan defaults on the server.
export function PracticeSettingsPage() {
  const { data, isLoading } = useThresholds();
  const mutation = useSetThresholds();

  const [form, setForm] = useState({
    bucket3HighConfidence: '',
    bucket3HighVendorConsistency: '',
    bucket3MediumConfidence: '',
    bucket4Floor: '',
  });
  const [error, setError] = useState<string | null>(null);

  // Depending on `data?.classificationThresholds` (the object)
  // would refire on every TanStack background refetch (each
  // refetch produces a new reference). On a fast refetch cycle
  // that turns into a setState → render → effect loop. Depend on
  // the four primitive values instead so the effect runs only
  // when a value genuinely changes.
  const high = data?.classificationThresholds?.bucket3HighConfidence;
  const highVc = data?.classificationThresholds?.bucket3HighVendorConsistency;
  const med = data?.classificationThresholds?.bucket3MediumConfidence;
  const floor = data?.classificationThresholds?.bucket4Floor;
  useEffect(() => {
    if (high === undefined) return;
    setForm({
      bucket3HighConfidence: String(high),
      bucket3HighVendorConsistency: String(highVc),
      bucket3MediumConfidence: String(med),
      bucket4Floor: String(floor),
    });
  }, [high, highVc, med, floor]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed: Record<string, number> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v === '') continue;
      const n = parseFloat(v);
      if (Number.isNaN(n) || n < 0 || n > 1) {
        setError(`Field ${k} must be a number between 0 and 1.`);
        return;
      }
      parsed[k] = n;
    }
    mutation.mutate(parsed as Parameters<typeof mutation.mutate>[0], {
      onError: (err: Error) => setError(err.message || 'Failed to save thresholds'),
    });
  };

  const handleReset = () => {
    setForm({
      bucket3HighConfidence: String(CLASSIFICATION_THRESHOLDS_DEFAULT.bucket3HighConfidence),
      bucket3HighVendorConsistency: String(CLASSIFICATION_THRESHOLDS_DEFAULT.bucket3HighVendorConsistency),
      bucket3MediumConfidence: String(CLASSIFICATION_THRESHOLDS_DEFAULT.bucket3MediumConfidence),
      bucket4Floor: String(CLASSIFICATION_THRESHOLDS_DEFAULT.bucket4Floor),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-4">
      <Link
        to="/practice/close-review"
        className="inline-flex w-fit items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Close Review
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Practice Settings</h1>
        <p className="text-sm text-gray-500">
          Classification thresholds used by the 4-bucket Close Review workflow. Values must satisfy{' '}
          <code className="rounded bg-gray-100 px-1">bucket4Floor ≤ bucket3Medium ≤ bucket3High</code>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5">
        <Field
          label="Bucket 3 High — confidence floor"
          hint="Items below this fall to Medium (default 0.95)"
          value={form.bucket3HighConfidence}
          onChange={(v) => setForm((f) => ({ ...f, bucket3HighConfidence: v }))}
        />
        <Field
          label="Bucket 3 High — vendor consistency floor"
          hint="How consistent past categorizations of this vendor must be (default 0.95)"
          value={form.bucket3HighVendorConsistency}
          onChange={(v) => setForm((f) => ({ ...f, bucket3HighVendorConsistency: v }))}
        />
        <Field
          label="Bucket 3 Medium — confidence floor"
          hint="Items below this (and above the Bucket 4 floor) are Medium (default 0.70)"
          value={form.bucket3MediumConfidence}
          onChange={(v) => setForm((f) => ({ ...f, bucket3MediumConfidence: v }))}
        />
        <Field
          label="Bucket 4 — needs-review floor"
          hint="Items with confidence below this go to Needs Review (default 0.70)"
          value={form.bucket4Floor}
          onChange={(v) => setForm((f) => ({ ...f, bucket4Floor: v }))}
        />
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={handleReset} type="button">
            Reset to defaults
          </Button>
          <Button variant="primary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>

      <ReviewCheckThresholds />
    </div>
  );
}

// Maps a check_key → which numeric param the UI exposes. Only
// the threshold-driven checks are editable here; other checks
// (duplicate detection, weekend posting, etc.) have no tunable
// numeric input or are documented in the registry but not yet
// surfaced for editing.
const TUNABLE_CHECKS: Record<string, { paramKey: string; label: string; hint: string }> = {
  transaction_above_materiality: {
    paramKey: 'thresholdAmount',
    label: 'Materiality threshold ($)',
    hint: 'Single transactions at or above this dollar amount are flagged. Default $10,000.',
  },
  round_dollar_above_threshold: {
    paramKey: 'thresholdAmount',
    label: 'Round-dollar threshold ($)',
    hint: 'Whole-dollar totals at or above this amount are flagged. Default $500.',
  },
  missing_attachment_above_threshold: {
    paramKey: 'thresholdAmount',
    label: 'Missing-attachment threshold ($)',
    hint: 'Posted transactions at or above this amount with no attached receipt are flagged. Default $75.',
  },
  vendor_1099_threshold_no_w9: {
    paramKey: 'thresholdAmount',
    label: '1099 / no-W-9 threshold ($)',
    hint: '1099-eligible vendors paid this much or more without a W-9 on file are flagged. Default $600.',
  },
};

function ReviewCheckThresholds() {
  const registryQ = useCheckRegistry();
  const overridesQ = useCheckOverrides();
  const setMutation = useSetCheckOverride();
  const deleteMutation = useDeleteCheckOverride();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loading = registryQ.isLoading || overridesQ.isLoading;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  const registry = registryQ.data?.checks ?? [];
  const overrides = overridesQ.data?.overrides ?? [];
  // Tenant-wide override row (companyId === null) is the one
  // this page edits. Per-company overrides are out of scope here
  // and stay untouched.
  const tenantOverrideByKey = new Map(
    overrides.filter((o) => o.companyId === null).map((o) => [o.checkKey, o.params]),
  );

  const tunableEntries = registry
    .filter((r) => r.checkKey in TUNABLE_CHECKS)
    .sort((a, b) => a.name.localeCompare(b.name));

  const effectiveValue = (checkKey: string): number | null => {
    const config = TUNABLE_CHECKS[checkKey]!;
    const override = tenantOverrideByKey.get(checkKey);
    const fromOverride = override ? override[config.paramKey] : undefined;
    if (typeof fromOverride === 'number') return fromOverride;
    if (typeof fromOverride === 'string') {
      const n = Number(fromOverride);
      if (Number.isFinite(n)) return n;
    }
    const entry = registry.find((r) => r.checkKey === checkKey);
    const fromDefault = entry?.defaultParams?.[config.paramKey];
    if (typeof fromDefault === 'number') return fromDefault;
    if (typeof fromDefault === 'string') {
      const n = Number(fromDefault);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };

  const isOverridden = (checkKey: string): boolean =>
    tenantOverrideByKey.has(checkKey);

  const inputValue = (checkKey: string): string => {
    if (drafts[checkKey] !== undefined) return drafts[checkKey]!;
    const v = effectiveValue(checkKey);
    return v == null ? '' : String(v);
  };

  const handleSave = (checkKey: string) => {
    setError(null);
    setSavedKey(null);
    const config = TUNABLE_CHECKS[checkKey]!;
    const raw = inputValue(checkKey);
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      setError(`${config.label} must be a non-negative number.`);
      return;
    }
    setMutation.mutate(
      { checkKey, companyId: null, params: { [config.paramKey]: n } },
      {
        onSuccess: () => {
          setSavedKey(checkKey);
          setDrafts((d) => {
            const { [checkKey]: _drop, ...rest } = d;
            return rest;
          });
          setTimeout(() => setSavedKey(null), 2500);
        },
        onError: (err: Error) => setError(err.message || 'Failed to save threshold'),
      },
    );
  };

  const handleReset = (checkKey: string) => {
    setError(null);
    setSavedKey(null);
    deleteMutation.mutate(
      { checkKey, companyId: null },
      {
        onSuccess: () => {
          setSavedKey(checkKey);
          setDrafts((d) => {
            const { [checkKey]: _drop, ...rest } = d;
            return rest;
          });
          setTimeout(() => setSavedKey(null), 2500);
        },
        onError: (err: Error) => setError(err.message || 'Failed to reset threshold'),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Reviewer check thresholds</h2>
        <p className="text-sm text-gray-500">
          Dollar cutoffs the Close Review checks use to decide what to flag. Saving a value sets a
          tenant-wide override; resetting drops the override and falls back to the registry default.
        </p>
      </div>
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="flex flex-col divide-y divide-gray-100">
        {tunableEntries.map((entry) => {
          const config = TUNABLE_CHECKS[entry.checkKey]!;
          const overridden = isOverridden(entry.checkKey);
          const defaultVal = entry.defaultParams?.[config.paramKey];
          return (
            <div key={entry.checkKey} className="flex flex-wrap items-end gap-3 py-3">
              <div className="min-w-[220px] flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{config.label}</span>
                  {overridden ? (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                      Override
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                      Default
                    </span>
                  )}
                  {savedKey === entry.checkKey && (
                    <span className="text-xs text-emerald-600">Saved</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{config.hint}</p>
                {typeof defaultVal === 'number' && (
                  <p className="text-[11px] text-gray-400">
                    Default: ${defaultVal.toLocaleString()}
                  </p>
                )}
              </div>
              <input
                type="number"
                min="0"
                step="1"
                value={inputValue(entry.checkKey)}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [entry.checkKey]: e.target.value }))
                }
                className="w-36 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-mono"
              />
              <Button
                variant="primary"
                type="button"
                onClick={() => handleSave(entry.checkKey)}
                disabled={setMutation.isPending}
              >
                Save
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={() => handleReset(entry.checkKey)}
                disabled={!overridden || deleteMutation.isPending}
              >
                Reset
              </Button>
            </div>
          );
        })}
        {tunableEntries.length === 0 && (
          <p className="py-3 text-sm text-gray-500">
            No tunable checks are registered. Run database migrations and reload.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <span className="text-xs text-gray-500">{hint}</span>
      <input
        type="number"
        step="0.01"
        min="0"
        max="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-mono"
      />
    </label>
  );
}
