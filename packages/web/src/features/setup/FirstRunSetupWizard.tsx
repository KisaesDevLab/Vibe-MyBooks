// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BUSINESS_TEMPLATES } from '@kis-books/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { CheckCircle, Eye, EyeOff, RefreshCw, Download, ChevronRight, Upload, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react';
import { useCoaTemplateOptions } from '../../api/hooks/useCoaTemplateOptions';
import {
  scorePassword,
  saveSetupProgress,
  loadSetupProgress,
  clearSetupProgress,
  friendlyErrorMessage as friendlyError,
  coaPreviewForBusinessType,
  type PersistedSetupProgress,
} from './setupHelpers';

// Subpath-aware setup API base. Vite injects import.meta.env.BASE_URL from
// the runtime sentinel `/__VIBE_BASE_PATH__/` (substituted by the web
// container's docker-entrypoint.d/40-base-path.sh hook before nginx
// starts). Single-app boots BASE_URL=`/`, multi-app boots BASE_URL=
// `/mybooks/`, so SETUP_API becomes `/api/setup` or `/mybooks/api/setup`
// without a rebuild. Without this, the wizard fetches an absolute
// /api/setup that the multi-app Caddy ingress doesn't route — operators
// installing MyBooks as the second app would never see the wizard.
const SETUP_API = `${import.meta.env.BASE_URL}api/setup`;

async function setupFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const res = await fetch(`${SETUP_API}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(err.error?.message || 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Four-step happy path. Database, Network, and Security are no longer
// dedicated steps — they auto-populate from the install script (DB creds
// minted by install.sh and fetched via /api/setup/db-defaults, secrets
// generated server-side on mount) and sit behind a collapsible "Advanced"
// section on the Review step for technical operators who need to tune them.
// The hidden "Finalizing" phase runs after the user clicks "Complete Setup"
// on Review and is never exposed as a step label in the progress bar.
const stepLabels = [
  'Welcome',
  'Admin & Company',
  'Email',
  'Review',
];
const FINALIZING_STEP = 4; // rendered after Review but not shown in the progress bar

const smtpPresets: Record<string, { host: string; port: string }> = {
  gmail: { host: 'smtp.gmail.com', port: '587' },
  outlook: { host: 'smtp-mail.outlook.com', port: '587' },
  sendgrid: { host: 'smtp.sendgrid.net', port: '587' },
  custom: { host: '', port: '587' },
};

interface FormState {
  // Database
  dbHost: string;
  dbPort: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  // Ports
  apiPort: string;
  frontendPort: string;
  redisHost: string;
  redisPort: string;
  // Security
  jwtSecret: string;
  backupKey: string;
  encryptionKey: string;
  // plaidEncryptionKey is intentionally absent from FormState. The server
  // still requires it (env.ts validates it on boot), but the wizard lets
  // the setup-service generate it automatically during /initialize — the
  // user never sees it and never needs to save it. The recovery-key flow
  // protects it via /data/.env.recovery.
  // Email
  skipEmail: boolean;
  smtpPreset: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  // Admin
  adminEmail: string;
  adminDisplayName: string;
  adminPassword: string;
  adminPasswordConfirm: string;
  // Company
  businessName: string;
  entityType: string;
  businessType: string;
  // Optional demo data
  createDemoCompany: boolean;
}

function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let result = '';
  const array = new Uint32Array(16);
  crypto.getRandomValues(array);
  for (let i = 0; i < 16; i++) {
    result += chars[(array[i] as number) % chars.length];
  }
  return result;
}

function RestoreChecklist({ items }: { items: Record<string, { status: string; message: string }> }) {
  return (
    <div className="space-y-2 mt-4">
      <h3 className="text-sm font-semibold text-gray-700">Post-Restore Checklist</h3>
      {Object.entries(items).map(([key, item]) => (
        <div key={key} className="flex items-start gap-2 text-sm">
          {item.status === 'ok' ? (
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          )}
          <span className={item.status === 'ok' ? 'text-green-700' : 'text-amber-700'}>
            {item.message}
          </span>
        </div>
      ))}
    </div>
  );
}

export function FirstRunSetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const businessTypeOptions = useCoaTemplateOptions();

  // Bootstrap state: poll /api/setup/status on mount so we can (a) refuse
  // to render the wizard at all on an already-initialized system and
  // (b) explicitly surface a "waiting for database" state instead of
  // letting the operator click through a form that will then fail.
  const [bootstrapState, setBootstrapState] = useState<
    'checking' | 'ready' | 'already-complete' | 'db-unavailable' | 'error' | 'pending-recovery-key'
  >('checking');
  const [bootstrapError, setBootstrapError] = useState('');
  const [pendingInstallationId, setPendingInstallationId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${SETUP_API}/status`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const status = await res.json();
        if (cancelled) return;
        // F22: setup is done but the recovery key was never acknowledged —
        // re-fetch it from the server-side pending map and render the
        // recovery-key screen.
        if (status.setupComplete && status.pendingRecoveryKey && status.installationId) {
          try {
            const pendingRes = await fetch(
              `${SETUP_API}/pending-recovery-key?installationId=${encodeURIComponent(status.installationId)}`,
            );
            if (pendingRes.ok) {
              const body = await pendingRes.json();
              if (!cancelled && body?.recoveryKey) {
                setRecoveryKey(body.recoveryKey);
                setPendingInstallationId(status.installationId);
                setBootstrapState('pending-recovery-key');
                return;
              }
            }
          } catch {
            // Fall through to already-complete handling if pending lookup fails.
          }
        }
        if (status.setupComplete && !status.statusCheckFailed) {
          setBootstrapState('already-complete');
          return;
        }
        if (status.statusCheckFailed) {
          setBootstrapState('db-unavailable');
          return;
        }
        setBootstrapState('ready');
      } catch (err) {
        if (cancelled) return;
        setBootstrapError(err instanceof Error ? err.message : 'Unable to contact the server');
        setBootstrapState('error');
      }
    };
    check();
    return () => {
      cancelled = true;
    };
    // `setRecoveryKey` / `setPendingInstallationId` are stable setters so an
    // empty deps array still matches React's exhaustive-deps expectations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore from backup state
  const [restoreMode, setRestoreMode] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [showRestorePassphrase, setShowRestorePassphrase] = useState(false);
  const [restoreValidation, setRestoreValidation] = useState<Record<string, unknown> | null>(null);
  const [restoreValidating, setRestoreValidating] = useState(false);
  const [restoreExecuting, setRestoreExecuting] = useState(false);
  const [restoreResult, setRestoreResult] = useState<Record<string, unknown> | null>(null);
  const [restoreError, setRestoreError] = useState('');
  const restoreFileRef = useRef<HTMLInputElement>(null);

  const handleRestoreFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setRestoreFile(e.target.files?.[0] ?? null);
    setRestoreValidation(null);
    setRestoreResult(null);
    setRestoreError('');
  };

  const handleRestoreValidate = async () => {
    if (!restoreFile || !restorePassphrase) return;
    setRestoreValidating(true);
    setRestoreError('');
    try {
      const formData = new FormData();
      formData.append('file', restoreFile);
      formData.append('passphrase', restorePassphrase);
      const res = await fetch(`${SETUP_API}/restore/validate`, { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Validation failed' } }));
        throw new Error(err.error?.message || 'Validation failed');
      }
      const data = await res.json();
      setRestoreValidation(data);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setRestoreValidating(false);
    }
  };

  const handleRestoreExecute = async () => {
    if (!restoreFile || !restorePassphrase) return;
    setRestoreExecuting(true);
    setRestoreError('');
    try {
      const formData = new FormData();
      formData.append('file', restoreFile);
      formData.append('passphrase', restorePassphrase);
      const res = await fetch(`${SETUP_API}/restore/execute`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Restore failed' } }));
        throw new Error(err.error?.message || 'Restore failed');
      }
      const data = await res.json();
      setRestoreResult(data);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setRestoreExecuting(false);
    }
  };

  const [form, setForm] = useState<FormState>({
    // Defaults match the Docker Compose install (the `db` and `redis`
    // service names in docker-compose.yml, and the default POSTGRES_USER
    // / POSTGRES_DB values). These get overwritten on mount by the
    // /api/setup/db-defaults call below so they reflect whatever
    // DATABASE_URL the API container actually received from compose —
    // including the auto-generated POSTGRES_PASSWORD that install.sh /
    // install.ps1 minted and wrote to the host .env. End users never see
    // that password and can't be expected to type it back; auto-fill
    // here lets them click straight through the Database step.
    dbHost: 'db',
    dbPort: '5432',
    dbName: 'kisbooks',
    dbUser: 'kisbooks',
    dbPassword: '',
    apiPort: '3001',
    frontendPort: '5173',
    redisHost: 'redis',
    redisPort: '6379',
    jwtSecret: '',
    backupKey: '',
    encryptionKey: '',
    skipEmail: true,
    smtpPreset: 'custom',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    smtpFrom: 'noreply@example.com',
    adminEmail: '',
    adminDisplayName: '',
    adminPassword: '',
    adminPasswordConfirm: '',
    businessName: '',
    entityType: 'sole_prop',
    businessType: 'general_business',
    createDemoCompany: false,
  });

  // On mount, pull the real DATABASE_URL components (including the
  // auto-generated POSTGRES_PASSWORD) from the API so the Advanced /
  // Database panel is fully pre-filled and most users never even need to
  // open it. This is the entire point of the setup UX for non-technical
  // users: they run install.sh, it mints a random DB password, and the
  // wizard fills it in for them so they never have to open .env. Also
  // immediately fetches fresh security keys so the Review step can show
  // "✓ Security keys generated" without the user ever seeing raw secrets.
  //
  // Best-effort — if an endpoint isn't available we fall back to useState
  // defaults + client-side secret generation.
  const [dbDefaultsSource, setDbDefaultsSource] = useState<'env' | 'fallback' | 'unknown'>('unknown');
  const [dbPasswordAutoDetected, setDbPasswordAutoDetected] = useState(false);

  // Restore previously-saved wizard progress on mount. Only non-secret
  // fields survive the round-trip (saveSetupProgress whitelists them), so
  // the user sees their email / business name / SMTP host etc. already
  // filled in but has to re-enter their password — which is what we want:
  // passwords in localStorage would be a real credential-leak risk.
  const [resumedFromStorage, setResumedFromStorage] = useState(false);
  useEffect(() => {
    const saved = loadSetupProgress();
    if (saved && typeof saved === 'object') {
      setForm((f) => ({
        ...f,
        ...(saved.adminEmail ? { adminEmail: saved.adminEmail } : {}),
        ...(saved.adminDisplayName ? { adminDisplayName: saved.adminDisplayName } : {}),
        ...(saved.businessName ? { businessName: saved.businessName } : {}),
        ...(saved.entityType ? { entityType: saved.entityType } : {}),
        ...(saved.businessType ? { businessType: saved.businessType } : {}),
        ...(saved.smtpPreset ? { smtpPreset: saved.smtpPreset } : {}),
        ...(saved.smtpHost ? { smtpHost: saved.smtpHost } : {}),
        ...(saved.smtpPort ? { smtpPort: saved.smtpPort } : {}),
        ...(saved.smtpUser ? { smtpUser: saved.smtpUser } : {}),
        ...(saved.smtpFrom ? { smtpFrom: saved.smtpFrom } : {}),
        ...(typeof saved.skipEmail === 'boolean' ? { skipEmail: saved.skipEmail } : {}),
        ...(typeof saved.createDemoCompany === 'boolean' ? { createDemoCompany: saved.createDemoCompany } : {}),
        ...(saved.apiPort ? { apiPort: saved.apiPort } : {}),
        ...(saved.frontendPort ? { frontendPort: saved.frontendPort } : {}),
        ...(saved.redisHost ? { redisHost: saved.redisHost } : {}),
        ...(saved.redisPort ? { redisPort: saved.redisPort } : {}),
        ...(saved.dbHost ? { dbHost: saved.dbHost } : {}),
        ...(saved.dbPort ? { dbPort: saved.dbPort } : {}),
        ...(saved.dbName ? { dbName: saved.dbName } : {}),
        ...(saved.dbUser ? { dbUser: saved.dbUser } : {}),
      }));
      if (typeof saved.step === 'number' && saved.step >= 0 && saved.step < FINALIZING_STEP) {
        // Keep the user on the step they were on so they don't have to
        // click through again — but don't jump them into the Finalizing
        // phase, which expects live state we never persist.
        setStep(saved.step);
      }
      setResumedFromStorage(true);
    }
  }, []);

  // Auto-save progress on every form / step change. The helper itself is
  // a best-effort localStorage write; failures (quota, private browsing)
  // are silent. We skip saving once the user has reached the Finalizing
  // phase — at that point the wizard is done and any future session
  // should start clean.
  useEffect(() => {
    if (step >= FINALIZING_STEP) return;
    const payload: PersistedSetupProgress = {
      step,
      adminEmail: form.adminEmail,
      adminDisplayName: form.adminDisplayName,
      businessName: form.businessName,
      entityType: form.entityType,
      businessType: form.businessType,
      smtpPreset: form.smtpPreset,
      smtpHost: form.smtpHost,
      smtpPort: form.smtpPort,
      smtpUser: form.smtpUser,
      smtpFrom: form.smtpFrom,
      skipEmail: form.skipEmail,
      createDemoCompany: form.createDemoCompany,
      apiPort: form.apiPort,
      frontendPort: form.frontendPort,
      redisHost: form.redisHost,
      redisPort: form.redisPort,
      dbHost: form.dbHost,
      dbPort: form.dbPort,
      dbName: form.dbName,
      dbUser: form.dbUser,
    };
    saveSetupProgress(payload);
  }, [step, form.adminEmail, form.adminDisplayName, form.businessName, form.entityType,
      form.businessType, form.smtpPreset, form.smtpHost, form.smtpPort,
      form.smtpUser, form.smtpFrom, form.skipEmail, form.createDemoCompany,
      form.apiPort, form.frontendPort, form.redisHost, form.redisPort,
      form.dbHost, form.dbPort, form.dbName, form.dbUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${SETUP_API}/db-defaults`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          host?: string;
          port?: number;
          database?: string;
          username?: string;
          password?: string;
          passwordAutoDetected?: boolean;
          source?: 'env' | 'fallback';
        };
        if (cancelled) return;
        setForm((f) => ({
          ...f,
          dbHost: data.host || f.dbHost,
          dbPort: data.port ? String(data.port) : f.dbPort,
          dbName: data.database || f.dbName,
          dbUser: data.username || f.dbUser,
          // Only overwrite the password when the server actually has one
          // to hand us — otherwise leave the (blank) user-typed value
          // alone so we don't accidentally clobber input.
          dbPassword: data.password && data.password.length > 0 ? data.password : f.dbPassword,
        }));
        setDbDefaultsSource(data.source || 'unknown');
        setDbPasswordAutoDetected(!!data.passwordAutoDetected);
      } catch {
        // Ignore — defaults already populated from useState initializer.
      }

      // Generate security keys up front so the Review step just shows
      // "✓ Security keys generated" and the user never has to stare at raw
      // secrets unless they expand Advanced. Runs in parallel with the
      // db-defaults fetch above because it's independent.
      // The plaidEncryptionKey is deliberately NOT requested or stored
      // client-side. setup.service generates it on the server during
      // /initialize and writes it straight to .env, so the user never sees
      // the field and doesn't have to save it anywhere — the recovery-key
      // flow covers it via /data/.env.recovery.
      try {
        const secrets = await setupFetch<{
          jwtSecret: string; backupKey: string; encryptionKey: string;
        }>('/generate-secrets', { method: 'POST' });
        if (cancelled) return;
        setForm((f) => ({
          ...f,
          // Only write if the user hasn't manually typed something.
          jwtSecret: f.jwtSecret || secrets.jwtSecret,
          backupKey: f.backupKey || secrets.backupKey,
          encryptionKey: f.encryptionKey || secrets.encryptionKey,
        }));
      } catch {
        // Fallback — client-side crypto.getRandomValues via
        // generateRandomPassword (double-length for ≥32 chars).
        if (cancelled) return;
        setForm((f) => ({
          ...f,
          jwtSecret: f.jwtSecret || (generateRandomPassword() + generateRandomPassword()),
          backupKey: f.backupKey || (generateRandomPassword() + generateRandomPassword()),
          encryptionKey: f.encryptionKey || (generateRandomPassword() + generateRandomPassword()),
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Visibility toggles
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [showJwtSecret, setShowJwtSecret] = useState(false);
  const [showBackupKey, setShowBackupKey] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  // Connection test states
  const [dbTestStatus, setDbTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dbTestError, setDbTestError] = useState('');
  const [smtpTestStatus, setSmtpTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [smtpTestError, setSmtpTestError] = useState('');

  // Review step: advanced section collapsed by default (non-technical users
  // never expand it); "I've saved credentials" checkbox; track that the
  // user actually fired at least one credential-save action (print or copy)
  // before allowing them to tick it.
  const [savedCredentials, setSavedCredentials] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [credentialsActionFired, setCredentialsActionFired] = useState(false);
  // Recovery-key screen: require an actual copy or print click, not just a
  // checkbox tick. This closes the "user rushed the checkbox and lost the
  // key" footgun we had before.
  const [recoveryKeyActionFired, setRecoveryKeyActionFired] = useState(false);

  // Finalizing step
  const [finalizeStatus, setFinalizeStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [finalizeError, setFinalizeError] = useState('');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryKeySaved, setRecoveryKeySaved] = useState(false);
  const [finalizeSteps, setFinalizeSteps] = useState([
    { label: 'Writing configuration', status: 'pending' as 'pending' | 'active' | 'done' | 'error' },
    { label: 'Connecting to database', status: 'pending' as 'pending' | 'active' | 'done' | 'error' },
    { label: 'Creating admin account', status: 'pending' as 'pending' | 'active' | 'done' | 'error' },
    { label: 'Seeding chart of accounts', status: 'pending' as 'pending' | 'active' | 'done' | 'error' },
    { label: 'Done', status: 'pending' as 'pending' | 'active' | 'done' | 'error' },
  ]);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const setChecked = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.checked }));

  // --- Step handlers ---

  const handleTestDatabase = async () => {
    setDbTestStatus('testing');
    setDbTestError('');
    try {
      await setupFetch('/test-database', {
        method: 'POST',
        body: JSON.stringify({
          host: form.dbHost,
          port: Number(form.dbPort),
          database: form.dbName,
          username: form.dbUser,
          password: form.dbPassword,
        }),
      });
      setDbTestStatus('success');
    } catch (err) {
      setDbTestStatus('error');
      setDbTestError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const handleGenerateSecrets = async () => {
    // plaidEncryptionKey is intentionally omitted — see the comment on the
    // initial mount effect. Server-side setup.service still mints it.
    try {
      const data = await setupFetch<{ jwtSecret: string; backupKey: string; encryptionKey: string }>(
        '/generate-secrets',
        { method: 'POST' },
      );
      setForm((f) => ({
        ...f,
        jwtSecret: data.jwtSecret,
        backupKey: data.backupKey,
        encryptionKey: data.encryptionKey,
      }));
    } catch {
      // Fallback to client-side generation
      setForm((f) => ({
        ...f,
        jwtSecret: generateRandomPassword() + generateRandomPassword(),
        backupKey: generateRandomPassword() + generateRandomPassword(),
        encryptionKey: generateRandomPassword() + generateRandomPassword(),
      }));
    }
  };

  const handleSmtpPresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = e.target.value;
    const config = smtpPresets[preset];
    setForm((f) => ({
      ...f,
      smtpPreset: preset,
      smtpHost: config?.host || f.smtpHost,
      smtpPort: config?.port || f.smtpPort,
    }));
  };

  const handleTestSmtp = async () => {
    setSmtpTestStatus('testing');
    setSmtpTestError('');
    try {
      // Pass `testEmail` so the backend actually sends a real message to
      // the admin address, not just opens the SMTP connection. Previously
      // the test only verified reachability, so users saw "Email sent ✓"
      // with an auth config that would still silently fail later when real
      // invoices tried to go out. Requires the admin email to be set.
      await setupFetch('/test-smtp', {
        method: 'POST',
        body: JSON.stringify({
          host: form.smtpHost,
          port: Number(form.smtpPort),
          username: form.smtpUser,
          password: form.smtpPass,
          from: form.smtpFrom,
          testEmail: form.adminEmail || undefined,
        }),
      });
      setSmtpTestStatus('success');
    } catch (err) {
      setSmtpTestStatus('error');
      setSmtpTestError(err instanceof Error ? err.message : 'SMTP test failed');
    }
  };

  const handleGenerateAdminPassword = () => {
    const pw = generateRandomPassword();
    setForm((f) => ({ ...f, adminPassword: pw, adminPasswordConfirm: pw }));
    setShowAdminPassword(true);
  };

  // Build the credential summary as an array of labeled lines. Used by the
  // Print and Copy-to-clipboard flows; we deliberately no longer offer a
  // .txt download — plaintext credentials sitting in ~/Downloads indefinitely
  // was the main security footgun of the old wizard. Printing routes
  // through window.print() so the file never hits disk unless the user
  // explicitly saves to PDF.
  const buildCredentialLines = (): string[] => [
    '=== Vibe MyBooks Credentials ===',
    `Generated: ${new Date().toLocaleString()}`,
    '',
    '--- Admin Account ---',
    `Email: ${form.adminEmail}`,
    `Password: ${form.adminPassword}`,
    '',
    '--- Database ---',
    `Host: ${form.dbHost}:${form.dbPort}`,
    `Database: ${form.dbName}`,
    `Username: ${form.dbUser}`,
    `Password: ${form.dbPassword}`,
    '',
    '--- Security ---',
    `JWT Secret: ${form.jwtSecret}`,
    `Backup Encryption Key: ${form.backupKey}`,
    `Installation Encryption Key: ${form.encryptionKey}`,
    '',
    ...(form.skipEmail ? [] : [
      '--- SMTP ---',
      `Host: ${form.smtpHost}:${form.smtpPort}`,
      `Username: ${form.smtpUser}`,
      `Password: ${form.smtpPass}`,
      `From: ${form.smtpFrom}`,
      '',
    ]),
    '--- Company ---',
    `Business Name: ${form.businessName}`,
    `Entity Type: ${form.entityType}`,
    '',
    'IMPORTANT: Store these credentials in a password manager. Losing them',
    'may require restoring from backup to regain access.',
  ];

  const handlePrintCredentials = () => {
    const content = buildCredentialLines().join('\n');
    const win = window.open('', '_blank', 'width=700,height=800');
    if (!win) return;
    // Escape the content for HTML — the user's business name / email /
    // password could all legitimately contain characters that would break
    // rendering if injected raw.
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    win.document.write(
      `<html><head><title>Vibe MyBooks Credentials</title>` +
      `<style>body{font-family:ui-monospace,Menlo,monospace;padding:2em;line-height:1.5;white-space:pre-wrap}</style>` +
      `</head><body>${esc(content)}</body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  };

  const copyCredentialsToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(buildCredentialLines().join('\n'));
    } catch {
      // Older browser / missing clipboard permission — fall back to a
      // legacy textarea-select flow so the user isn't stuck. The main
      // flow already covers modern Chrome/Safari/Firefox.
      const ta = document.createElement('textarea');
      ta.value = buildCredentialLines().join('\n');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* give up quietly */ }
      document.body.removeChild(ta);
    }
  };

  // friendlyErrorMessage lives in ./setupHelpers — aliased as `friendlyError`
  // in the import at the top of this file so it can be used directly in
  // JSX without this local shim.

  const handleFinalize = async () => {
    setFinalizeStatus('running');
    setFinalizeError('');

    const updateStep = (index: number, status: 'pending' | 'active' | 'done' | 'error') => {
      setFinalizeSteps((prev) =>
        prev.map((s, i) => (i === index ? { ...s, status } : s)),
      );
    };

    try {
      // Step 0: Writing config
      updateStep(0, 'active');
      await new Promise((r) => setTimeout(r, 500));
      updateStep(0, 'done');

      // Step 1: Connecting to database
      updateStep(1, 'active');
      await new Promise((r) => setTimeout(r, 300));
      updateStep(1, 'done');

      // Step 2: Creating admin
      updateStep(2, 'active');
      await new Promise((r) => setTimeout(r, 300));
      updateStep(2, 'done');

      // Step 3: Seeding COA
      updateStep(3, 'active');

      // The actual API call
      const initResult = await setupFetch<{ recoveryKey?: string; installationId?: string }>('/initialize', {
        method: 'POST',
        body: JSON.stringify({
          db: {
            host: form.dbHost,
            port: Number(form.dbPort),
            database: form.dbName,
            username: form.dbUser,
            password: form.dbPassword,
          },
          redis: {
            host: form.redisHost,
            port: Number(form.redisPort),
          },
          jwtSecret: form.jwtSecret,
          backupKey: form.backupKey,
          encryptionKey: form.encryptionKey,
          ports: {
            api: Number(form.apiPort),
            frontend: Number(form.frontendPort),
          },
          smtp: form.skipEmail
            ? undefined
            : {
                host: form.smtpHost,
                port: Number(form.smtpPort),
                username: form.smtpUser,
                password: form.smtpPass,
                from: form.smtpFrom,
              },
          admin: {
            email: form.adminEmail,
            displayName: form.adminDisplayName,
            password: form.adminPassword,
          },
          company: {
            name: form.businessName,
            entityType: form.entityType,
            businessType: form.businessType,
          },
          createDemoCompany: form.createDemoCompany,
        }),
      });

      updateStep(3, 'done');

      // Step 4: Done
      updateStep(4, 'done');
      setFinalizeStatus('done');

      // Capture the recovery key surfaced by /initialize. The server writes
      // /data/.env.recovery before this response lands, so the key is the
      // ONLY way the operator can ever decrypt that file — we must display
      // it before letting them navigate away.
      if (initResult?.recoveryKey) {
        setRecoveryKey(initResult.recoveryKey);
      }
      if ((initResult as { installationId?: string })?.installationId) {
        setPendingInstallationId((initResult as { installationId?: string }).installationId!);
      }

      // Setup is committed. Wipe the localStorage progress snapshot so a
      // second install on the same browser (rare but possible — DB
      // reset, reinstall) doesn't auto-fill someone else's answers.
      clearSetupProgress();
    } catch (err) {
      const message: string = err instanceof Error ? err.message : 'Setup failed';
      setFinalizeError(message);
      setFinalizeStatus('error');

      // Attribute the error to the step that actually failed. The API
      // prefixes its error messages with [step:<name>] so we don't have
      // to guess. Fall back to a heuristic on the message body for older
      // server builds that don't include the prefix — in particular, the
      // "password authentication failed" error originates from the
      // database-test step, NOT the seed-COA step we would otherwise
      // have marked as active.
      let failingIndex = -1;
      const tagMatch = /\[step:([a-z]+)\]/i.exec(message);
      const tag = tagMatch?.[1]?.toLowerCase();
      if (tag === 'database' || /password authentication failed|database connection failed|econnrefused/i.test(message)) {
        failingIndex = 1; // Connecting to database
      } else if (tag === 'admin' || /admin|tenant/i.test(message)) {
        failingIndex = 2; // Creating admin account
      } else if (tag === 'seed' || /chart of accounts|seedfromtemplate/i.test(message)) {
        failingIndex = 3; // Seeding chart of accounts
      }

      setFinalizeSteps((prev) =>
        prev.map((s, i) => {
          if (failingIndex >= 0) {
            if (i === failingIndex) return { ...s, status: 'error' };
            // Steps after the failing one have not actually run — reset
            // any prematurely-marked "done" status so the UI doesn't
            // imply they succeeded.
            if (i > failingIndex) return { ...s, status: 'pending' };
            return s;
          }
          // Unknown failure location — fall back to marking whichever
          // step the UI had flagged active.
          return s.status === 'active' ? { ...s, status: 'error' } : s;
        }),
      );
    }
  };

  // Port availability state
  const [portStatus, setPortStatus] = useState<Record<string, 'idle' | 'checking' | 'available' | 'in_use'>>({});

  const checkPort = async (port: string, key: string) => {
    const portNum = parseInt(port);
    if (!portNum || portNum < 1 || portNum > 65535) return;
    setPortStatus((p) => ({ ...p, [key]: 'checking' }));
    try {
      const result = await setupFetch<{ port: number; available: boolean }>('/check-port', {
        method: 'POST', body: JSON.stringify({ port: portNum }),
      });
      setPortStatus((p) => ({ ...p, [key]: result.available ? 'available' : 'in_use' }));
    } catch {
      setPortStatus((p) => ({ ...p, [key]: 'idle' }));
    }
  };

  // New simplified step transitions:
  //   Welcome (0) → Admin & Company (1) → Email (2) → Review (3) → Finalizing (4)
  const handleNext = () => {
    if (step === 3) {
      // Moving from Review to the hidden Finalizing phase.
      setStep(FINALIZING_STEP);
      setTimeout(() => handleFinalize(), 200);
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return true;
      case 1:
        // Combined Admin + Company: validate all user-entered fields.
        return !!(
          form.adminEmail &&
          form.adminDisplayName &&
          form.adminPassword &&
          form.adminPassword.length >= 12 &&
          form.adminPassword === form.adminPasswordConfirm &&
          form.businessName
        );
      case 2:
        // Email is optional — either skipped or fully configured.
        return form.skipEmail || !!(form.smtpHost && form.smtpPort && form.smtpFrom);
      case 3:
        // Review: confirm the user has saved their credentials. Everything
        // else (DB/network/security) is either auto-detected or available
        // in the Advanced expander on this same step.
        return (
          savedCredentials &&
          !!(form.dbHost && form.dbPort && form.dbName && form.dbUser && form.dbPassword) &&
          !!(form.apiPort && form.frontendPort && form.redisPort) &&
          !!(form.jwtSecret && form.backupKey && form.encryptionKey)
        );
      default: return false;
    }
  };

  // Masked display helper
  const masked = (val: string) => (val ? '\u2022'.repeat(Math.min(val.length, 20)) : '(not set)');

  const entityTypeLabels: Record<string, string> = {
    sole_prop: 'Sole Proprietorship',
    single_member_llc: 'Single Member LLC',
    s_corp: 'S Corporation',
    c_corp: 'C Corporation',
    partnership: 'Partnership',
  };

  // --- Bootstrap gates --------------------------------------------------
  // Render blocking screens before the real wizard whenever we can't be
  // sure the wizard is safe to use. These are the outermost line of
  // defense against the user clicking through a form that would fail or,
  // worse, succeed against an already-initialized system.
  if (bootstrapState === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-3 text-sm text-gray-600">Checking installation state...</p>
        </div>
      </div>
    );
  }

  if (bootstrapState === 'already-complete') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center space-y-4">
          <ShieldCheck className="h-10 w-10 text-green-600 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Setup already complete</h2>
          <p className="text-sm text-gray-600">
            This Vibe MyBooks instance is already configured. The first-run setup wizard is disabled.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full">
            Go to login
          </Button>
        </div>
      </div>
    );
  }

  // F22: the wizard previously completed but the operator never clicked
  // "I have saved this" on the recovery-key screen. The key is still held
  // server-side in the pending map — re-display it here and gate progress
  // on a successful acknowledgement call.
  if (bootstrapState === 'pending-recovery-key' && recoveryKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-lg border-2 border-amber-400 shadow-md p-6 space-y-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-8 w-8 text-amber-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold text-amber-900">Save your recovery key before continuing</h2>
              <p className="text-sm text-amber-800 mt-1">
                Setup has finished but the previous session never confirmed the recovery key was
                saved. The key is cached server-side for a few more minutes — this is your last
                chance to save it before it expires.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-300 rounded p-4">
            <p className="font-mono text-xl tracking-wider text-center text-gray-900 select-all break-all">
              {recoveryKey}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try { await navigator.clipboard.writeText(recoveryKey); } catch { /* ignore */ }
                setRecoveryKeyActionFired(true);
              }}
            >
              Copy to clipboard
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const win = window.open('', '_blank', 'width=500,height=400');
                if (!win) return;
                win.document.write(
                  `<html><head><title>KIS Books Recovery Key</title></head>` +
                    `<body style="font-family:monospace;padding:2em;">` +
                    `<h2>KIS Books Recovery Key</h2>` +
                    `<p style="font-size:1.5em;letter-spacing:0.1em;background:#fef3c7;padding:1em;border:2px solid #f59e0b;">${recoveryKey}</p>` +
                    `</body></html>`,
                );
                win.document.close();
                win.print();
                setRecoveryKeyActionFired(true);
              }}
            >
              Print
            </Button>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={recoveryKeySaved}
              onChange={(e) => setRecoveryKeySaved(e.target.checked)}
              disabled={!recoveryKeyActionFired}
              className="mt-1 disabled:opacity-50"
            />
            <span className={`text-sm ${recoveryKeyActionFired ? 'text-amber-900' : 'text-amber-900/60'}`}>
              I have saved this recovery key. I understand it will not be shown again.
              {!recoveryKeyActionFired && ' (Click Copy or Print first.)'}
            </span>
          </label>

          <Button
            className="w-full"
            disabled={!recoveryKeySaved || !recoveryKeyActionFired}
            onClick={async () => {
              if (pendingInstallationId) {
                try {
                  await fetch(`${SETUP_API}/acknowledge-recovery-key`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ installationId: pendingInstallationId }),
                  });
                } catch {
                  // Ignore — acknowledgement is best-effort; the TTL will
                  // clear it soon enough either way.
                }
              }
              navigate('/login');
            }}
          >
            Continue to login
          </Button>
        </div>
      </div>
    );
  }

  if (bootstrapState === 'db-unavailable') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg border border-amber-200 shadow-sm p-6 text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-amber-600 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Database not yet reachable</h2>
          <p className="text-sm text-gray-600">
            The API couldn't verify the database state. Setup is disabled until the database is reachable — this prevents a transient outage from allowing destructive operations.
          </p>
          <p className="text-xs text-gray-500">
            If Postgres is still starting, wait a few seconds and refresh. If it's down, check the database container logs.
          </p>
          <Button onClick={() => window.location.reload()} className="w-full">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (bootstrapState === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg border border-red-200 shadow-sm p-6 text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-red-600 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Unable to reach the API</h2>
          <p className="text-sm text-gray-600">{bootstrapError}</p>
          <Button onClick={() => window.location.reload()} className="w-full">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header. During the hidden Finalizing phase we clamp the counter to
          the last real step so the user doesn't see "Step 5 of 4". */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Vibe MyBooks Setup</h1>
          <span className="text-sm text-gray-500">
            Step {Math.min(step, stepLabels.length - 1) + 1} of {stepLabels.length}
          </span>
        </div>
      </div>

      {/* Step indicator — only shows the four labeled steps; the hidden
          Finalizing phase (step === FINALIZING_STEP) renders under the last
          label with all prior steps marked complete. */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-1 overflow-x-auto">
            {stepLabels.map((label, i) => (
              <div key={i} className="flex items-center">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                      i < step
                        ? 'bg-green-500 text-white'
                        : i === step
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
                  </div>
                  <span
                    className={`text-xs ${
                      i === step ? 'font-semibold text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < stepLabels.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-gray-300 mx-1 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resume banner — shown once when the wizard picks up localStorage
          state from an earlier session. Lets the user know their progress
          wasn't lost but also gives them a one-click reset in case they
          want to start over. */}
      {resumedFromStorage && step > 0 && step < FINALIZING_STEP && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <span className="text-sm text-blue-900">
              Picked up where you left off. Your password wasn&apos;t saved — re-enter it when you get there.
            </span>
            <button
              type="button"
              onClick={() => {
                clearSetupProgress();
                setResumedFromStorage(false);
                window.location.reload();
              }}
              className="text-xs font-medium text-blue-900 underline whitespace-nowrap"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            {/* Step 0: Welcome */}
            {step === 0 && !restoreMode && !restoreResult && (
              <div className="text-center py-8 space-y-6">
                <h2 className="text-3xl font-bold text-gray-900">Welcome to Vibe MyBooks</h2>
                <p className="text-lg text-gray-600 max-w-md mx-auto">
                  Your self-hosted bookkeeping solution. Choose how you&apos;d like to get started.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-2">
                  <button
                    onClick={() => setStep(1)}
                    className="p-5 rounded-lg border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-all text-left group"
                  >
                    <ChevronRight className="h-6 w-6 text-primary-600 mb-2" />
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-700">New installation</h3>
                    <p className="text-xs text-gray-500 mt-1">Set up a fresh instance from scratch — this is what most people want.</p>
                  </button>
                  <button
                    onClick={() => {
                      // Demo mode: fill in sensible placeholders and jump
                      // straight to Review so the user can verify + commit
                      // with one more click. The generated admin password
                      // is surfaced on the Review step's Print/Copy button
                      // so the user gets the same credential-save prompt
                      // as the manual flow. createDemoCompany=true seeds
                      // the tenant with ~200 sample transactions.
                      const demoPassword = generateRandomPassword();
                      setForm((f) => ({
                        ...f,
                        adminEmail: 'demo@example.com',
                        adminDisplayName: 'Demo Admin',
                        adminPassword: demoPassword,
                        adminPasswordConfirm: demoPassword,
                        businessName: 'Demo Bookkeeping Co',
                        entityType: 'single_member_llc',
                        businessType: 'general_business',
                        skipEmail: true,
                        createDemoCompany: true,
                      }));
                      setShowAdminPassword(true);
                      setStep(3);
                    }}
                    className="p-5 rounded-lg border-2 border-emerald-200 bg-emerald-50/40 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left group"
                  >
                    <Sparkles className="h-6 w-6 text-emerald-600 mb-2" />
                    <h3 className="font-semibold text-gray-900 group-hover:text-emerald-700">Try the demo</h3>
                    <p className="text-xs text-gray-500 mt-1">Skip setup — we&apos;ll create a demo company with sample transactions in one click.</p>
                  </button>
                  <button
                    onClick={() => setRestoreMode(true)}
                    className="p-5 rounded-lg border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all text-left group"
                  >
                    <Upload className="h-6 w-6 text-amber-600 mb-2" />
                    <h3 className="font-semibold text-gray-900 group-hover:text-amber-700">Restore from backup</h3>
                    <p className="text-xs text-gray-500 mt-1">Upload a .vmb backup file from a previous installation.</p>
                  </button>
                </div>
              </div>
            )}

            {/* Restore from backup flow */}
            {step === 0 && restoreMode && !restoreResult && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Upload className="h-5 w-5 text-amber-600" />
                  Restore from Backup
                </h2>
                <p className="text-sm text-gray-500">
                  Upload a .vmb backup file and enter the passphrase to restore your data.
                </p>

                {restoreError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {restoreError}
                  </div>
                )}

                <div className="space-y-3 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Backup File (.vmb)</label>
                    <input
                      ref={restoreFileRef}
                      type="file"
                      accept=".vmb,.kbk"
                      onChange={handleRestoreFileChange}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-50"
                    />
                  </div>

                  {restoreFile && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Passphrase</label>
                      <div className="relative">
                        <input
                          type={showRestorePassphrase ? 'text' : 'password'}
                          value={restorePassphrase}
                          onChange={(e) => setRestorePassphrase(e.target.value)}
                          placeholder="Enter backup passphrase"
                          className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <button type="button" onClick={() => setShowRestorePassphrase(!showRestorePassphrase)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showRestorePassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {!restoreValidation && (
                    <div className="flex gap-3">
                      <Button variant="secondary" onClick={() => { setRestoreMode(false); setRestoreFile(null); setRestorePassphrase(''); }}>
                        Back
                      </Button>
                      <Button onClick={handleRestoreValidate} loading={restoreValidating}
                        disabled={!restoreFile || !restorePassphrase}>
                        Validate Backup
                      </Button>
                    </div>
                  )}

                  {/* Validation result */}
                  {restoreValidation && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-800">Backup Validated</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <span className="text-gray-600">Type:</span>
                        <span className="text-gray-900 capitalize">{String(restoreValidation['backup_type'])} backup</span>
                        <span className="text-gray-600">Version:</span>
                        <span className="text-gray-900">{String((restoreValidation['metadata'] as Record<string, unknown>)?.['source_version'] || 'unknown')}</span>
                        <span className="text-gray-600">Created:</span>
                        <span className="text-gray-900">{new Date(String((restoreValidation['metadata'] as Record<string, unknown>)?.['created_at'] || '')).toLocaleDateString()}</span>
                        <span className="text-gray-600">Companies:</span>
                        <span className="text-gray-900">{String((restoreValidation['metadata'] as Record<string, unknown>)?.['tenant_count'] || 1)}</span>
                        <span className="text-gray-600">Users:</span>
                        <span className="text-gray-900">{String((restoreValidation['metadata'] as Record<string, unknown>)?.['user_count'] || 0)}</span>
                        <span className="text-gray-600">Transactions:</span>
                        <span className="text-gray-900">{Number((restoreValidation['metadata'] as Record<string, unknown>)?.['transaction_count'] || 0).toLocaleString()}</span>
                      </div>

                      <div className="mt-4 flex gap-3">
                        <Button variant="secondary" onClick={() => { setRestoreValidation(null); }}>
                          Back
                        </Button>
                        <Button onClick={handleRestoreExecute} loading={restoreExecuting}>
                          Restore Now
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Post-restore checklist */}
            {step === 0 && restoreResult && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <h2 className="text-lg font-semibold text-gray-800">Restore Complete</h2>
                </div>
                <p className="text-sm text-gray-600">{String(restoreResult['message'])}</p>

                {/* Checklist */}
                {restoreResult['checklist'] != null && (
                  <RestoreChecklist items={restoreResult['checklist'] as Record<string, { status: string; message: string }>} />
                )}

                <div className="pt-4 border-t border-gray-100">
                  <Button onClick={() => navigate('/login')}>
                    Go to Login <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 1: Admin & Company (combined). Everything a non-technical
                user needs to type lives here. Database, ports, security keys,
                and Redis all sit behind the Advanced expander on the Review
                step and are pre-populated from install.sh defaults. */}
            {step === 1 && (
              <div className="space-y-6">
                {/* Admin section */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800">Your admin account</h2>
                  <p className="text-sm text-gray-500">
                    This is the account you&apos;ll use to sign in. You can add more users later
                    from Settings → Team.
                  </p>
                  <Input
                    label="Email"
                    type="email"
                    value={form.adminEmail}
                    onChange={set('adminEmail')}
                    required
                    autoComplete="email"
                  />
                  <Input
                    label="Your name"
                    value={form.adminDisplayName}
                    onChange={set('adminDisplayName')}
                    required
                    autoComplete="name"
                  />
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Password (12+ characters)</label>
                    <div className="relative">
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        value={form.adminPassword}
                        onChange={set('adminPassword')}
                        minLength={12}
                        autoComplete="new-password"
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {form.adminPassword && (() => {
                      // Four-segment strength meter. `level` 0 = empty (not
                      // shown), 1 = weak, 4 = strong. Colors match the
                      // score helper so a Strong password paints all four
                      // segments green. Hints list tells the user exactly
                      // what's still missing.
                      const score = scorePassword(form.adminPassword);
                      if (score.level === 0) return null;
                      const barColor = {
                        gray: 'bg-gray-300',
                        red: 'bg-red-500',
                        orange: 'bg-orange-500',
                        yellow: 'bg-yellow-500',
                        green: 'bg-green-500',
                      }[score.color];
                      const textColor = {
                        gray: 'text-gray-500',
                        red: 'text-red-600',
                        orange: 'text-orange-600',
                        yellow: 'text-yellow-700',
                        green: 'text-green-700',
                      }[score.color];
                      return (
                        <div className="space-y-1 pt-1" role="status" aria-live="polite">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className={`h-1.5 flex-1 rounded ${
                                  i <= score.level ? barColor : 'bg-gray-200'
                                }`}
                              />
                            ))}
                          </div>
                          <p className={`text-xs font-medium ${textColor}`}>{score.label}</p>
                          {score.hints.length > 0 && (
                            <ul className="text-xs text-gray-500 list-disc ml-4 space-y-0.5">
                              {score.hints.map((h) => (
                                <li key={h}>{h}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <Input
                    label="Confirm password"
                    type="password"
                    value={form.adminPasswordConfirm}
                    onChange={set('adminPasswordConfirm')}
                    autoComplete="new-password"
                    error={
                      form.adminPasswordConfirm && form.adminPassword !== form.adminPasswordConfirm
                        ? 'Passwords do not match'
                        : undefined
                    }
                  />
                  <Button variant="secondary" onClick={handleGenerateAdminPassword}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Generate a strong password
                  </Button>
                </div>

                {/* Company section */}
                <div className="pt-4 border-t border-gray-200 space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800">Your company</h2>
                  <p className="text-sm text-gray-500">
                    This information appears on invoices and reports. You can update it later
                    from Settings → Company.
                  </p>
                  <Input
                    label="Business name"
                    value={form.businessName}
                    onChange={set('businessName')}
                    required
                    autoComplete="organization"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Entity type</label>
                    <select
                      value={form.entityType}
                      onChange={set('entityType')}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="sole_prop">Sole Proprietorship</option>
                      <option value="single_member_llc">Single Member LLC</option>
                      <option value="s_corp">S Corporation</option>
                      <option value="c_corp">C Corporation</option>
                      <option value="partnership">Partnership</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business type</label>
                    <select value={form.businessType} onChange={set('businessType')}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                      {businessTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Determines the chart of accounts we&apos;ll create for you.</p>
                    {/* Preview the accounts this template creates so the
                        user can compare before committing. Account names
                        and category counts come from the same constant the
                        backend seeds from, so what shows here is what they
                        actually get. */}
                    {(() => {
                      const preview = coaPreviewForBusinessType(form.businessType);
                      if (!preview) return null;
                      return (
                        <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
                          <p className="text-xs font-medium text-gray-700">
                            We&apos;ll create {preview.total} accounts for you, including:
                          </p>
                          <ul className="flex flex-wrap gap-1">
                            {preview.sample.map((name) => (
                              <li
                                key={name}
                                className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700"
                              >
                                {name}
                              </li>
                            ))}
                          </ul>
                          <p className="text-[11px] text-gray-500">
                            Categories:{' '}
                            {Object.entries(preview.byCategory)
                              .map(([cat, count]) => `${count} ${cat.toLowerCase()}`)
                              .join(' · ')}
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.createDemoCompany}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, createDemoCompany: e.target.checked }))
                        }
                        className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-700">
                          Also create a demo company with sample data
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Spins up a second company called <strong>Demo Bookkeeping Co</strong> with
                          ~200 realistic transactions so you can explore the app without touching
                          your real books. You can delete it any time from Settings → Team.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Email (optional — unchanged behavior, renumbered) */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Email (optional)</h2>
                <p className="text-sm text-gray-500">
                  Connect an email account so Vibe MyBooks can send invoices and payment
                  reminders. You can skip this and configure it later from Settings → Email.
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.skipEmail}
                    onChange={setChecked('skipEmail')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Skip email for now</span>
                </label>

                {!form.skipEmail && (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Provider preset</label>
                      <select
                        value={form.smtpPreset}
                        onChange={handleSmtpPresetChange}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="gmail">Gmail (smtp.gmail.com:587)</option>
                        <option value="outlook">Outlook (smtp-mail.outlook.com:587)</option>
                        <option value="sendgrid">SendGrid (smtp.sendgrid.net:587)</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <Input label="SMTP host" value={form.smtpHost} onChange={set('smtpHost')} />
                      </div>
                      <Input label="Port" value={form.smtpPort} onChange={set('smtpPort')} type="number" />
                    </div>
                    <Input label="Username" value={form.smtpUser} onChange={set('smtpUser')} />
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">Password</label>
                      <div className="relative">
                        <input
                          type={showSmtpPass ? 'text' : 'password'}
                          value={form.smtpPass}
                          onChange={set('smtpPass')}
                          className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmtpPass(!showSmtpPass)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Input label="From address" value={form.smtpFrom} onChange={set('smtpFrom')} type="email" />
                    <div className="flex items-center gap-3">
                      <Button variant="secondary" onClick={handleTestSmtp} loading={smtpTestStatus === 'testing'} disabled={!form.adminEmail}>
                        Send test email
                      </Button>
                      {smtpTestStatus === 'success' && (
                        <span className="flex items-center gap-1 text-sm text-green-600">
                          <CheckCircle className="h-4 w-4" /> Test email sent to {form.adminEmail}
                        </span>
                      )}
                      {smtpTestStatus === 'error' && (
                        <span className="text-sm text-red-600">{smtpTestError ? friendlyError(smtpTestError) : 'SMTP test failed'}</span>
                      )}
                    </div>
                    {!form.adminEmail && (
                      <p className="text-xs text-gray-500">
                        The test email is sent to your admin address — go back to step 1 and enter
                        your email first.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review + Advanced expander. The Advanced panel contains
                the three old steps (Database, Network, Security) for operators
                who need to change defaults. Non-technical users never open it. */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Review and finish</h2>
                <p className="text-sm text-gray-500">
                  Here&apos;s a summary of what we&apos;ll set up. Save your admin credentials
                  before clicking Complete Setup.
                </p>

                {/* Admin */}
                <div className="border border-gray-200 rounded-lg p-4 space-y-1">
                  <h3 className="text-sm font-semibold text-gray-700">Admin account</h3>
                  <p className="text-sm text-gray-600">{form.adminEmail || '(not set)'}</p>
                  <p className="text-sm text-gray-600">{form.adminDisplayName || '(not set)'}</p>
                  <p className="text-sm text-gray-500">Password: {masked(form.adminPassword)}</p>
                </div>

                {/* Company */}
                <div className="border border-gray-200 rounded-lg p-4 space-y-1">
                  <h3 className="text-sm font-semibold text-gray-700">Company</h3>
                  <p className="text-sm text-gray-600">{form.businessName || '(not set)'}</p>
                  <p className="text-sm text-gray-500">
                    {entityTypeLabels[form.entityType] || form.entityType}
                  </p>
                </div>

                {/* Email */}
                <div className="border border-gray-200 rounded-lg p-4 space-y-1">
                  <h3 className="text-sm font-semibold text-gray-700">Email</h3>
                  {form.skipEmail ? (
                    <p className="text-sm text-gray-500 italic">Skipped — configure later in Settings → Email.</p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">{form.smtpHost}:{form.smtpPort}</p>
                      <p className="text-sm text-gray-500">From: {form.smtpFrom}</p>
                    </>
                  )}
                </div>

                {/* Security — summary tile (details live under Advanced) */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <h3 className="text-sm font-semibold text-gray-700">Security keys generated</h3>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Encryption keys for tokens, backups, and Plaid are ready. Print or save them
                    from the button below before you finish.
                  </p>
                </div>

                {/* Print credentials (no .txt download — those linger on disk). */}
                <div className="pt-2 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => {
                      handlePrintCredentials();
                      setCredentialsActionFired(true);
                    }}>
                      <Download className="h-4 w-4 mr-1" /> Print credentials
                    </Button>
                    <Button variant="secondary" onClick={async () => {
                      await copyCredentialsToClipboard();
                      setCredentialsActionFired(true);
                    }}>
                      Copy to clipboard
                    </Button>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={savedCredentials}
                      onChange={(e) => setSavedCredentials(e.target.checked)}
                      disabled={!credentialsActionFired}
                      className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                    />
                    <span className={`text-sm ${credentialsActionFired ? 'text-gray-700' : 'text-gray-400'}`}>
                      I have saved my admin password somewhere safe.
                      {!credentialsActionFired && ' (Click Print or Copy first.)'}
                    </span>
                  </label>
                </div>

                {/* Advanced expander — Database, Network, Security fields. */}
                <div className="pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <ChevronRight className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-90' : ''}`} />
                    Advanced settings
                    <span className="text-xs text-gray-500 font-normal">
                      (database, ports, encryption keys — auto-configured, most users can skip)
                    </span>
                  </button>

                  {advancedOpen && (
                    <div className="mt-4 space-y-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
                      {/* Database */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-700">Database</h4>
                        {dbPasswordAutoDetected && (
                          <p className="text-xs text-green-700 flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Auto-detected from your Docker install.
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <Input label="Host" value={form.dbHost} onChange={set('dbHost')} />
                          <Input label="Port" value={form.dbPort} onChange={set('dbPort')} type="number" />
                        </div>
                        <Input label="Database name" value={form.dbName} onChange={set('dbName')} />
                        <Input label="Username" value={form.dbUser} onChange={set('dbUser')} />
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">Password</label>
                          <div className="relative">
                            <input
                              type={showDbPassword ? 'text' : 'password'}
                              value={form.dbPassword}
                              onChange={set('dbPassword')}
                              className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShowDbPassword(!showDbPassword)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showDbPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button variant="secondary" onClick={handleTestDatabase} loading={dbTestStatus === 'testing'}>
                            Test connection
                          </Button>
                          {dbTestStatus === 'success' && (
                            <span className="flex items-center gap-1 text-sm text-green-600">
                              <CheckCircle className="h-4 w-4" /> Connected
                            </span>
                          )}
                          {dbTestStatus === 'error' && (
                            <span className="text-sm text-red-600">{friendlyError(dbTestError)}</span>
                          )}
                        </div>
                      </div>

                      {/* Network / Ports */}
                      <div className="space-y-3 pt-3 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700">Ports</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">API</label>
                            <input type="number" value={form.apiPort}
                              onChange={(e) => { set('apiPort')(e); setPortStatus((p) => ({ ...p, api: 'idle' })); }}
                              onBlur={() => checkPort(form.apiPort, 'api')}
                              className="block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                            {portStatus['api'] === 'in_use' && <span className="text-xs text-red-600">In use</span>}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Frontend</label>
                            <input type="number" value={form.frontendPort}
                              onChange={(e) => { set('frontendPort')(e); setPortStatus((p) => ({ ...p, frontend: 'idle' })); }}
                              onBlur={() => checkPort(form.frontendPort, 'frontend')}
                              className="block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                            {portStatus['frontend'] === 'in_use' && <span className="text-xs text-red-600">In use</span>}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Redis</label>
                            <input type="number" value={form.redisPort}
                              onChange={(e) => { set('redisPort')(e); setPortStatus((p) => ({ ...p, redis: 'idle' })); }}
                              onBlur={() => checkPort(form.redisPort, 'redis')}
                              className="block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                            {portStatus['redis'] === 'in_use' && <span className="text-xs text-red-600">In use</span>}
                          </div>
                        </div>
                      </div>

                      {/* Security keys */}
                      <div className="space-y-3 pt-3 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700">Security keys</h4>
                        <p className="text-xs text-gray-500">
                          Generated for you. Keep them safe — they&apos;re in the Print/Copy output above.
                        </p>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-gray-700">JWT secret</label>
                          <div className="relative">
                            <input
                              type={showJwtSecret ? 'text' : 'password'}
                              value={form.jwtSecret}
                              onChange={set('jwtSecret')}
                              className="block w-full rounded-lg border border-gray-300 px-3 py-1.5 pr-10 text-xs font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShowJwtSecret(!showJwtSecret)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showJwtSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-gray-700">Backup encryption key</label>
                          <div className="relative">
                            <input
                              type={showBackupKey ? 'text' : 'password'}
                              value={form.backupKey}
                              onChange={set('backupKey')}
                              className="block w-full rounded-lg border border-gray-300 px-3 py-1.5 pr-10 text-xs font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShowBackupKey(!showBackupKey)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showBackupKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <Button variant="secondary" size="sm" onClick={handleGenerateSecrets}>
                          <RefreshCw className="h-4 w-4 mr-1" /> Regenerate all keys
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Finalizing step (hidden from the progress bar) */}
            {step === FINALIZING_STEP && (
              <div className="space-y-6 py-4">
                <h2 className="text-lg font-semibold text-gray-800 text-center">
                  {finalizeStatus === 'done' ? 'Setup Complete!' : 'Setting up Vibe MyBooks...'}
                </h2>

                <div className="space-y-3">
                  {finalizeSteps.map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {s.status === 'done' && (
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      )}
                      {s.status === 'active' && (
                        <LoadingSpinner size="sm" />
                      )}
                      {s.status === 'pending' && (
                        <div className="h-5 w-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                      )}
                      {s.status === 'error' && (
                        <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">!</span>
                        </div>
                      )}
                      <span
                        className={`text-sm ${
                          s.status === 'done'
                            ? 'text-green-700'
                            : s.status === 'active'
                              ? 'text-gray-900 font-medium'
                              : s.status === 'error'
                                ? 'text-red-600'
                                : 'text-gray-400'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>

                {finalizeError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {friendlyError(finalizeError)}
                  </div>
                )}

                {finalizeStatus === 'done' && (
                  <div className="pt-4 space-y-5">
                    {recoveryKey && (
                      <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-5 space-y-4">
                        <div className="flex items-start gap-3">
                          <ShieldCheck className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <h3 className="font-bold text-amber-900">Recovery Key — save this now</h3>
                            <p className="text-sm text-amber-800 mt-1">
                              This key is the only way to recover your installation if you lose the
                              contents of <code className="bg-amber-100 px-1 rounded">/data/config/.env</code>.
                              It will be shown exactly once and never stored in plaintext on the server.
                            </p>
                          </div>
                        </div>

                        <div className="bg-white border border-amber-300 rounded p-4">
                          <p className="font-mono text-xl tracking-wider text-center text-gray-900 select-all break-all">
                            {recoveryKey}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              try { await navigator.clipboard.writeText(recoveryKey); } catch { /* ignore */ }
                              setRecoveryKeyActionFired(true);
                            }}
                          >
                            Copy to Clipboard
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const win = window.open('', '_blank', 'width=500,height=400');
                              if (!win) return;
                              win.document.write(
                                `<html><head><title>KIS Books Recovery Key</title></head>` +
                                  `<body style="font-family:monospace;padding:2em;">` +
                                  `<h2>KIS Books Recovery Key</h2>` +
                                  `<p>Installation date: ${new Date().toLocaleString()}</p>` +
                                  `<p style="font-size:1.5em;letter-spacing:0.1em;background:#fef3c7;padding:1em;border:2px solid #f59e0b;">${recoveryKey}</p>` +
                                  `<p>Keep this in a secure location. It is the only way to recover your .env file if it is lost.</p>` +
                                  `</body></html>`,
                              );
                              win.document.close();
                              win.print();
                              setRecoveryKeyActionFired(true);
                            }}
                          >
                            Print
                          </Button>
                        </div>

                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={recoveryKeySaved}
                            onChange={(e) => setRecoveryKeySaved(e.target.checked)}
                            disabled={!recoveryKeyActionFired}
                            className="mt-1 rounded border-amber-400 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
                          />
                          <span className={`text-sm ${recoveryKeyActionFired ? 'text-amber-900' : 'text-amber-900/60'}`}>
                            I have saved this recovery key in a secure location. I understand it will
                            not be shown again, and that losing it along with my <code>.env</code> file
                            means encrypted data (Plaid tokens, 2FA secrets) becomes unrecoverable.
                            {!recoveryKeyActionFired && ' (Click Copy or Print first.)'}
                          </span>
                        </label>
                      </div>
                    )}

                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-4">
                        Your Vibe MyBooks installation is ready. You can now log in with your admin
                        credentials.
                      </p>
                      <Button
                        onClick={async () => {
                          // F22: acknowledge the pending key server-side so a
                          // refresh of the wizard URL no longer shows the
                          // recovery screen.
                          if (recoveryKey && pendingInstallationId) {
                            try {
                              await fetch(`${SETUP_API}/acknowledge-recovery-key`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ installationId: pendingInstallationId }),
                              });
                            } catch {
                              // Non-fatal — TTL will clean up.
                            }
                          }
                          navigate('/login');
                        }}
                        disabled={!!recoveryKey && (!recoveryKeySaved || !recoveryKeyActionFired)}
                      >
                        {recoveryKey && (!recoveryKeySaved || !recoveryKeyActionFired)
                          ? 'Save and confirm the key first'
                          : 'Go to Login'}
                      </Button>
                    </div>
                  </div>
                )}

                {finalizeStatus === 'error' && (
                  <div className="text-center pt-2">
                    <Button variant="secondary" onClick={handleFinalize}>
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Navigation buttons — hidden on the Welcome step (it has its
                own New Install / Restore buttons) and on the hidden
                Finalizing phase (which has its own "Go to Login" / "Retry"
                controls). Shown on the intermediate steps with Back + Next,
                and on Review with Back + Complete Setup. */}
            {step < FINALIZING_STEP && step > 0 && !restoreMode && !restoreResult && (
              <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
                <Button variant="secondary" onClick={handleBack}>
                  Back
                </Button>
                <Button onClick={handleNext} disabled={!canProceed()}>
                  {step === 3 ? 'Complete Setup' : 'Next'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
