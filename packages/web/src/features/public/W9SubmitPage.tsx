// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 15.2 — public W-9 collection
// page. Loaded from the magic link emailed by /api/v1/practice/1099/w9-requests.
// The token in the URL is the only auth surface; everything else
// (rate limit, expiry, single-use semantics) is enforced by
// /api/w9 on the server.

interface RequestMeta {
  requestId: string;
  contactId: string;
  contactName: string;
  expiresAt: string;
}

const TAX_CLASSIFICATIONS = [
  'Individual / sole proprietor / single-member LLC',
  'C corporation',
  'S corporation',
  'Partnership',
  'Trust / estate',
  'LLC — taxed as C corporation',
  'LLC — taxed as S corporation',
  'LLC — taxed as partnership',
  'Other',
] as const;

type Status = 'loading' | 'ready' | 'submitting' | 'submitted' | 'expired' | 'completed' | 'error';

export function W9SubmitPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [meta, setMeta] = useState<RequestMeta | null>(null);
  const [error, setError] = useState<string>('');

  // Form state
  const [legalName, setLegalName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [taxClassification, setTaxClassification] = useState<string>(TAX_CLASSIFICATIONS[0]);
  const [exemptPayeeCode, setExemptPayeeCode] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [tin, setTin] = useState('');
  const [tinType, setTinType] = useState<'SSN' | 'EIN'>('SSN');
  const [backupWithholding, setBackupWithholding] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Missing W-9 token.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/w9/${encodeURIComponent(token)}`);
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 404) {
          setStatus('error');
          setError('This W-9 link is not valid. Please request a new one from the firm that contacted you.');
          return;
        }
        if (!res.ok) {
          const code = body?.error?.code;
          if (code === 'COMPLETED') {
            setStatus('completed');
            return;
          }
          if (code === 'EXPIRED') {
            setStatus('expired');
            return;
          }
          setStatus('error');
          setError(body?.error?.message || 'Failed to load W-9 request.');
          return;
        }
        setMeta(body.request);
        setLegalName(body.request?.contactName ?? '');
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setStatus('error');
          setError('Network error. Please try again.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError('');

    const tinDigits = tin.replace(/[-\s]/g, '');
    if (!/^\d{9}$/.test(tinDigits)) {
      setError('TIN must be exactly 9 digits.');
      return;
    }
    if (!consent) {
      setError('You must check the consent box to submit.');
      return;
    }
    if (!signatureName.trim()) {
      setError('Please type your full name as your electronic signature.');
      return;
    }

    setStatus('submitting');
    try {
      const res = await fetch('/api/w9/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          legalName: legalName.trim(),
          businessName: businessName.trim() || undefined,
          taxClassification,
          exemptPayeeCode: exemptPayeeCode.trim() || undefined,
          address: {
            line1: line1.trim(),
            city: city.trim(),
            state: state.trim(),
            zip: zip.trim(),
          },
          tin: tinDigits,
          tinType,
          backupWithholding,
          signatureName: signatureName.trim(),
          consent: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = body?.error?.code;
        if (code === 'COMPLETED') {
          setStatus('completed');
          return;
        }
        if (code === 'EXPIRED') {
          setStatus('expired');
          return;
        }
        setStatus('ready');
        setError(body?.error?.message || 'Submission failed. Please review your entries.');
        return;
      }
      setStatus('submitted');
    } catch {
      setStatus('ready');
      setError('Network error. Please try again.');
    }
  };

  if (status === 'loading') {
    return (
      <Page>
        <div className="py-16 flex justify-center"><LoadingSpinner size="lg" /></div>
      </Page>
    );
  }

  if (status === 'completed') {
    return (
      <Page>
        <Card>
          <h1 className="text-xl font-semibold text-gray-900">W-9 already submitted</h1>
          <p className="mt-2 text-sm text-gray-600">
            This W-9 has already been completed. The firm has your information on file. You can close
            this window.
          </p>
        </Card>
      </Page>
    );
  }

  if (status === 'expired') {
    return (
      <Page>
        <Card>
          <h1 className="text-xl font-semibold text-gray-900">Link expired</h1>
          <p className="mt-2 text-sm text-gray-600">
            This W-9 collection link has expired for security. Please reach out to the firm that
            requested your W-9 and ask them to send a fresh link.
          </p>
        </Card>
      </Page>
    );
  }

  if (status === 'error') {
    return (
      <Page>
        <Card>
          <h1 className="text-xl font-semibold text-gray-900">Couldn&rsquo;t load this W-9 form</h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </Card>
      </Page>
    );
  }

  if (status === 'submitted') {
    return (
      <Page>
        <Card>
          <h1 className="text-xl font-semibold text-gray-900">Thank you — W-9 received</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your W-9 has been securely submitted. Your Taxpayer ID is encrypted at rest, and the firm
            will receive a confirmation copy. You can close this window.
          </p>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <form onSubmit={submit}>
        <Card>
          <h1 className="text-xl font-semibold text-gray-900">Form W-9</h1>
          <p className="mt-1 text-sm text-gray-600">
            {meta?.contactName ? `Hello ${meta.contactName}, ` : ''}please complete the fields below
            so we can issue any required 1099 forms accurately. Your Taxpayer ID is encrypted at rest
            and used only for IRS reporting.
          </p>
          {meta?.expiresAt && (
            <p className="mt-2 text-xs text-gray-500">
              This link expires on {new Date(meta.expiresAt).toLocaleString()}.
            </p>
          )}
          {error && (
            <div className="mt-4 p-3 border border-red-200 bg-red-50 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          <Section title="Name & business">
            <Field label="Legal name (as shown on your tax return)" required>
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className={inputClasses}
                maxLength={255}
              />
            </Field>
            <Field label="Business name / disregarded entity (if different)">
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className={inputClasses}
                maxLength={255}
              />
            </Field>
            <Field label="Federal tax classification" required>
              <select
                required
                value={taxClassification}
                onChange={(e) => setTaxClassification(e.target.value)}
                className={inputClasses}
              >
                {TAX_CLASSIFICATIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </Field>
            <Field label="Exempt payee code (if any)">
              <input
                type="text"
                value={exemptPayeeCode}
                onChange={(e) => setExemptPayeeCode(e.target.value)}
                className={inputClasses}
                maxLength={10}
              />
            </Field>
          </Section>

          <Section title="Address">
            <Field label="Street address" required>
              <input
                type="text"
                required
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                className={inputClasses}
                maxLength={255}
                autoComplete="address-line1"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="City" required>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputClasses}
                  maxLength={100}
                  autoComplete="address-level2"
                />
              </Field>
              <Field label="State" required>
                <input
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className={inputClasses}
                  maxLength={50}
                  autoComplete="address-level1"
                />
              </Field>
              <Field label="ZIP" required>
                <input
                  type="text"
                  required
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className={inputClasses}
                  maxLength={20}
                  autoComplete="postal-code"
                  inputMode="numeric"
                />
              </Field>
            </div>
          </Section>

          <Section title="Taxpayer Identification">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Field label="Taxpayer Identification Number (TIN)" required>
                  <input
                    type="text"
                    required
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    className={inputClasses}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={tinType === 'SSN' ? '123-45-6789' : '12-3456789'}
                    maxLength={11}
                  />
                </Field>
              </div>
              <Field label="TIN type" required>
                <select
                  value={tinType}
                  onChange={(e) => setTinType(e.target.value as 'SSN' | 'EIN')}
                  className={inputClasses}
                >
                  <option value="SSN">SSN</option>
                  <option value="EIN">EIN</option>
                </select>
              </Field>
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={backupWithholding}
                onChange={(e) => setBackupWithholding(e.target.checked)}
                className="rounded border-gray-300"
              />
              I am subject to backup withholding (IRS notification received)
            </label>
          </Section>

          <Section title="Electronic signature">
            <Field label="Type your full legal name to sign" required>
              <input
                type="text"
                required
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                className={inputClasses}
                maxLength={255}
                autoComplete="name"
              />
            </Field>
            <label className="mt-3 inline-flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 rounded border-gray-300"
                required
              />
              <span>
                Under penalties of perjury, I certify that the TIN above is correct, that I am a U.S.
                person, and (unless checked above) that I am not subject to backup withholding. I
                consent to electronic signature.
              </span>
            </label>
          </Section>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="inline-flex items-center justify-center font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-sm disabled:opacity-60"
            >
              {status === 'submitting' ? 'Submitting…' : 'Submit W-9'}
            </button>
          </div>
        </Card>
      </form>
    </Page>
  );
}

const inputClasses =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-6 text-center">
          <h2 className="text-sm font-semibold tracking-wide text-indigo-700 uppercase">
            Secure W-9 collection
          </h2>
        </div>
        {children}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">{children}</div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 pt-4 border-t border-gray-100">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="text-gray-700 font-medium">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
    </label>
  );
}

export default W9SubmitPage;
