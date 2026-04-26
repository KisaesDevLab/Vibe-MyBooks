// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, FileText, MessageSquare, Upload, Clock, CheckCircle2 } from 'lucide-react';
import { usePortal } from './PortalLayout';

interface PortalDocRequest {
  id: string;
  description: string;
  documentType: string;
  periodLabel: string;
  requestedAt: string;
  dueDate: string | null;
  status: string;
}

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 9.6 — portal dashboard.
// Live counts pulled from the question, receipt, and financials
// endpoints; tiles double as nav links to the corresponding pages.

interface DashboardCounts {
  openQuestions: number | null;
  receiptsThisMonth: number | null;
  publishedReports: number | null;
}

export function PortalDashboardPage() {
  const { me, fullName, activeCompanyId } = usePortal();
  const activeCompany = me.contact.companies.find((c) => c.companyId === activeCompanyId);
  const firstName = me.contact.firstName ?? fullName.split(' ')[0] ?? '';
  const filesEnabled =
    !!me.contact.companies.find((c) => c.companyId === activeCompanyId)?.filesAccess;
  const financialsEnabled =
    !!me.contact.companies.find((c) => c.companyId === activeCompanyId)?.financialsAccess;
  const questionsEnabled =
    !!me.contact.companies.find((c) => c.companyId === activeCompanyId)?.questionsForUsAccess;

  const [counts, setCounts] = useState<DashboardCounts>({
    openQuestions: null,
    receiptsThisMonth: null,
    publishedReports: null,
  });
  const [docRequests, setDocRequests] = useState<PortalDocRequest[] | null>(null);

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    const load = async () => {
      const [questions, receipts, reports] = await Promise.allSettled([
        fetch(`/api/portal/questions?companyId=${activeCompanyId}`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/portal/receipts?companyId=${activeCompanyId}`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/portal/financials?companyId=${activeCompanyId}`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null)),
      ]);
      if (cancelled) return;
      setCounts({
        openQuestions:
          questions.status === 'fulfilled' && questions.value && Array.isArray(questions.value.open)
            ? questions.value.open.length
            : 0,
        receiptsThisMonth:
          receipts.status === 'fulfilled' && receipts.value && Array.isArray(receipts.value.receipts)
            ? receipts.value.receipts.length
            : 0,
        publishedReports:
          reports.status === 'fulfilled' && reports.value && Array.isArray(reports.value.reports)
            ? reports.value.reports.length
            : 0,
      });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId]);

  // RECURRING_DOC_REQUESTS_V1 — separate request because the response
  // shape includes a featureEnabled flag we need on the panel itself.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/portal/document-requests', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        if (body.featureEnabled === false) {
          setDocRequests(null);
          return;
        }
        setDocRequests(Array.isArray(body.items) ? body.items : []);
      })
      .catch(() => { /* feature off or transport error — hide panel */ });
    return () => { cancelled = true; };
  }, [activeCompanyId]);

  const reloadDocRequests = async () => {
    try {
      const r = await fetch('/api/portal/document-requests', { credentials: 'include' });
      if (!r.ok) return;
      const body = await r.json();
      if (body.featureEnabled === false) return;
      setDocRequests(Array.isArray(body.items) ? body.items : []);
    } catch {
      // ignore
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">
        Welcome{firstName ? `, ${firstName}` : ''}.
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {activeCompany
          ? `You're viewing ${activeCompany.companyName}.`
          : 'Select a company to get started.'}
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/portal/questions" className="block">
          <Tile
            icon={MessageSquare}
            title="Open questions"
            value={counts.openQuestions ?? 0}
            description={
              counts.openQuestions === 0
                ? 'Nothing waiting'
                : 'From your bookkeeper — tap to answer'
            }
          />
        </Link>
        {filesEnabled ? (
          <Link to="/portal/capture" className="block">
            <Tile
              icon={Camera}
              title="Receipts uploaded"
              value={counts.receiptsThisMonth ?? 0}
              description="Tap to capture a new one"
            />
          </Link>
        ) : (
          <Tile
            icon={Camera}
            title="Receipts"
            value={0}
            description="Ask your bookkeeper to enable file uploads"
            muted
          />
        )}
        <Link to="/portal/financials" className="block">
          <Tile
            icon={FileText}
            title="Published reports"
            value={counts.publishedReports ?? 0}
            description={
              financialsEnabled
                ? counts.publishedReports === 0
                  ? 'No reports yet'
                  : 'Tap to view'
                : 'Tap to request access'
            }
            muted={!financialsEnabled}
          />
        </Link>
      </div>

      {docRequests && docRequests.length > 0 && filesEnabled && activeCompanyId && (
        <section className="mt-8 bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Documents requested</h2>
          <ul className="space-y-2">
            {docRequests.map((r) => (
              <DocRequestRow
                key={r.id}
                req={r}
                companyId={activeCompanyId}
                onUploaded={() => void reloadDocRequests()}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          to="/portal/questions"
          className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
        >
          <p className="text-sm font-medium text-gray-900">Answer questions</p>
          <p className="text-xs text-gray-500 mt-1">
            See what your bookkeeper has flagged and reply with context.
          </p>
        </Link>
        {questionsEnabled && (
          <Link
            to="/portal/questions"
            className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <p className="text-sm font-medium text-gray-900">Ask a question</p>
            <p className="text-xs text-gray-500 mt-1">
              Send something to your bookkeeper from this side.
            </p>
          </Link>
        )}
        {filesEnabled && (
          <Link
            to="/portal/capture"
            className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <p className="text-sm font-medium text-gray-900">Snap a receipt</p>
            <p className="text-xs text-gray-500 mt-1">
              Camera capture works offline — items sync when you're back online.
            </p>
          </Link>
        )}
        {financialsEnabled && (
          <Link
            to="/portal/financials"
            className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <p className="text-sm font-medium text-gray-900">View financials</p>
            <p className="text-xs text-gray-500 mt-1">
              Browse published reports your bookkeeper has shared.
            </p>
          </Link>
        )}
      </section>
    </div>
  );
}

function Tile({
  icon: Icon,
  title,
  value,
  description,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: number;
  description: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`bg-white border rounded-lg p-5 shadow-sm transition-colors ${
        muted ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:border-indigo-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-400" />
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
      </div>
      <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </div>
  );
}

function DocRequestRow({
  req,
  companyId,
  onUploaded,
}: {
  req: PortalDocRequest;
  companyId: string;
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const overdue = req.dueDate ? new Date(req.dueDate) < new Date() : false;

  const onFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('companyId', companyId);
      fd.append('documentRequestId', req.id);
      const res = await fetch('/api/portal/receipts/upload', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      setDone(true);
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <li className="border border-gray-200 rounded-md p-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {done ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <Clock className={`h-4 w-4 shrink-0 ${overdue ? 'text-red-600' : 'text-amber-600'}`} />}
          <p className="text-sm font-medium text-gray-900 truncate">{req.description}</p>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          For {req.periodLabel}
          {req.dueDate && ` · due ${new Date(req.dueDate).toLocaleDateString()}`}
          {overdue && ' (overdue)'}
        </p>
        {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
      </div>
      <div className="shrink-0">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <button
          type="button"
          disabled={uploading || done}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {done ? 'Uploaded' : uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </li>
  );
}

export default PortalDashboardPage;
