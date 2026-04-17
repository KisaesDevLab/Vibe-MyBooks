// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { Brain, ShieldCheck, AlertTriangle, CheckCircle, Lock, Undo2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  useAiConsentStatus, useCompanyAiDisclosure,
  useAcceptCompanyAiDisclosure, useRevokeCompanyAiConsent, useSetCompanyAiTasks,
  type AiTaskKey,
} from '../../api/hooks/useAi';

const TASK_LABELS: Array<{ key: AiTaskKey; label: string; desc: string }> = [
  { key: 'categorization', label: 'Auto-categorize bank feed transactions', desc: 'Suggest expense/income categories for imported transactions.' },
  { key: 'receipt_ocr', label: 'Process uploaded receipts with OCR', desc: 'Extract vendor, amount, and line items from receipts and bills.' },
  { key: 'statement_parsing', label: 'Parse uploaded bank statements', desc: 'Extract transactions from bank statement PDFs and images.' },
  { key: 'document_classification', label: 'Auto-classify uploaded documents', desc: 'Identify whether an attachment is a receipt, invoice, statement, or tax form.' },
];

export function CompanyAiSettingsPage() {
  const { data: status, isLoading } = useAiConsentStatus();

  // Pick the first company in the tenant. Most installs have one
  // primary company per tenant — if multiple exist we show them all
  // stacked below the first one's controls.
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const companyId = activeCompanyId ?? status?.companies[0]?.id ?? null;

  if (isLoading || !status) {
    return <LoadingSpinner className="py-12" />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">AI Processing</h1>
      </div>

      {!status.systemEnabled && (
        <div className="max-w-2xl flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <Lock className="h-5 w-5 text-amber-700 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-900">AI processing is not available.</p>
            <p className="text-xs text-amber-800 mt-1">Your system administrator has not enabled AI processing for this installation. Contact them if you'd like to use AI features.</p>
          </div>
        </div>
      )}

      {status.systemEnabled && status.companies.length > 1 && (
        <div className="max-w-2xl">
          <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
          <select
            value={companyId ?? ''}
            onChange={(e) => setActiveCompanyId(e.target.value)}
            className="block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {status.companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {status.systemEnabled && companyId && (
        <CompanyConsentPanel companyId={companyId} />
      )}
    </div>
  );
}

function CompanyConsentPanel({ companyId }: { companyId: string }) {
  const { data: disclosure, isLoading } = useCompanyAiDisclosure(companyId);
  const accept = useAcceptCompanyAiDisclosure();
  const revoke = useRevokeCompanyAiConsent();
  const setTasks = useSetCompanyAiTasks();

  const [showDisclosure, setShowDisclosure] = useState(false);
  const [revoking, setRevoking] = useState(false);

  if (isLoading || !disclosure) return <LoadingSpinner className="py-6" />;

  const cfg = disclosure.currentConfig;

  return (
    <div className="max-w-2xl space-y-4">
      {/* Status card */}
      <div className={`rounded-lg border shadow-sm p-5 ${disclosure.aiEnabled && !disclosure.isStale ? 'bg-green-50/50 border-green-200' : 'bg-white border-gray-200'}`}>
        <div className="flex items-start gap-3">
          {disclosure.aiEnabled && !disclosure.isStale ? (
            <CheckCircle className="h-5 w-5 text-green-700 mt-0.5" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-gray-500 mt-0.5" />
          )}
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-900">
              {disclosure.aiEnabled && !disclosure.isStale
                ? `AI processing is active for ${disclosure.companyName}`
                : disclosure.isStale
                  ? `AI paused — configuration changed`
                  : `AI processing is available for ${disclosure.companyName}`}
            </h2>
            {disclosure.aiEnabled && !disclosure.isStale && disclosure.acceptedAt && (
              <p className="text-xs text-gray-600 mt-1">
                Consent accepted {new Date(disclosure.acceptedAt).toLocaleString()}. System config version {disclosure.acceptedVersion}.
              </p>
            )}
            {disclosure.isStale && (
              <p className="text-xs text-amber-800 mt-1">
                Your system administrator changed an AI setting that affects how your data is handled. Review and re-accept the disclosure below to resume AI processing.
              </p>
            )}
            {!disclosure.aiEnabled && (
              <p className="text-xs text-gray-600 mt-1">
                Enable AI processing to automate categorization, receipt OCR, and bank statement parsing for this company.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {!disclosure.aiEnabled || disclosure.isStale ? (
            <Button onClick={() => setShowDisclosure(true)}>
              {disclosure.isStale ? 'Review updated disclosure' : 'Enable AI processing'}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setShowDisclosure(true)}>View disclosure</Button>
          )}
          {disclosure.aiEnabled && !revoking && (
            <Button variant="secondary" onClick={() => setRevoking(true)}>
              <Undo2 className="h-4 w-4 mr-1" /> Revoke consent
            </Button>
          )}
        </div>
      </div>

      {revoking && (
        <div className="bg-white rounded-lg border border-red-200 shadow-sm p-5">
          <p className="text-sm font-medium text-gray-900">Revoke AI consent for {disclosure.companyName}?</p>
          <p className="text-xs text-gray-600 mt-1">AI features will stop. Your existing transactions and bookkeeping data are not affected. You can re-accept at any time.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={() => setRevoking(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                await revoke.mutateAsync(companyId);
                setRevoking(false);
              }}
              loading={revoke.isPending}
            >
              Revoke consent
            </Button>
          </div>
        </div>
      )}

      {/* Per-task toggles — only visible once opted in */}
      {disclosure.aiEnabled && !disclosure.isStale && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">AI features</h3>
          <p className="text-xs text-gray-500 -mt-2">Toggle individual AI tasks independently. Each task still requires your review before affecting your books.</p>
          {TASK_LABELS.map((t) => {
            const checked = !!disclosure.enabledTasks[t.key];
            return (
              <label key={t.key} className="flex items-start gap-3 py-2 border-t first:border-t-0 border-gray-100">
                <input type="checkbox" className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                  checked={checked}
                  onChange={(e) => setTasks.mutate({ companyId, tasks: { [t.key]: e.target.checked } })}
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.label}</p>
                  <p className="text-xs text-gray-500">{t.desc}</p>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {/* Current configuration summary */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">Current system configuration</h3>
        <dl className="text-xs text-gray-700 grid grid-cols-2 gap-y-1">
          <dt className="text-gray-500">PII Protection</dt>
          <dd className="font-medium text-gray-900 capitalize">{cfg.piiProtectionLevel}</dd>
          <dt className="text-gray-500">Categorization provider</dt>
          <dd>{cfg.categorizationProvider ?? <span className="text-gray-400">not configured</span>}</dd>
          <dt className="text-gray-500">OCR provider</dt>
          <dd>{cfg.ocrProvider ?? <span className="text-gray-400">not configured</span>}</dd>
          <dt className="text-gray-500">Classifier provider</dt>
          <dd>{cfg.documentClassificationProvider ?? <span className="text-gray-400">not configured</span>}</dd>
        </dl>
      </div>

      {showDisclosure && (
        <CompanyDisclosureModal
          text={disclosure.text}
          aiEnabled={disclosure.aiEnabled && !disclosure.isStale}
          onClose={() => setShowDisclosure(false)}
          onAccept={async () => {
            await accept.mutateAsync(companyId);
            setShowDisclosure(false);
          }}
          saving={accept.isPending}
        />
      )}
    </div>
  );
}

function CompanyDisclosureModal({ text, aiEnabled, onClose, onAccept, saving }: {
  text: string; aiEnabled: boolean; onClose: () => void; onAccept: () => void; saving: boolean;
}) {
  const [ack, setAck] = useState(aiEnabled);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">AI Processing Consent</h2>
        </div>
        <div className="p-5 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap font-sans">
          {text}
        </div>
        {!aiEnabled && (
          <div className="px-5 py-3 border-t border-gray-200">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span>I consent to AI processing for this company as described above.</span>
            </label>
          </div>
        )}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{aiEnabled ? 'Close' : 'Cancel'}</Button>
          {!aiEnabled && (
            <Button onClick={onAccept} disabled={!ack} loading={saving}>Accept and enable</Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CompanyAiSettingsPage;
