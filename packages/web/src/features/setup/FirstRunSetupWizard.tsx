import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { CheckCircle, Eye, EyeOff, RefreshCw, Download, ChevronRight, Upload, AlertTriangle, ShieldCheck, Lock } from 'lucide-react';
import { useCoaTemplateOptions } from '../../api/hooks/useCoaTemplateOptions';

const SETUP_API = '/api/setup';

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

const stepLabels = [
  'Welcome',
  'Database',
  'Network',
  'Security',
  'Email',
  'Admin Account',
  'Company',
  'Review',
  'Finalizing',
];

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
  industry: string;
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
  const [bootstrapState, setBootstrapState] = useState<'checking' | 'ready' | 'already-complete' | 'db-unavailable' | 'error'>('checking');
  const [bootstrapError, setBootstrapError] = useState('');

  // Setup token state: required before the user can initiate a new install
  // or restore a backup. The token is printed to the server console on
  // first boot and verified via /api/setup/validate-token.
  const [setupToken, setSetupToken] = useState('');
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenChecking, setTokenChecking] = useState(false);
  const [tokenError, setTokenError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('/api/setup/status');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const status = await res.json();
        if (cancelled) return;
        if (status.setupComplete && !status.statusCheckFailed) {
          setBootstrapState('already-complete');
          return;
        }
        if (status.statusCheckFailed) {
          setBootstrapState('db-unavailable');
          return;
        }
        setBootstrapState('ready');
      } catch (err: any) {
        if (cancelled) return;
        setBootstrapError(err?.message || 'Unable to contact the server');
        setBootstrapState('error');
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleValidateToken = async () => {
    if (!setupToken.trim()) {
      setTokenError('Enter the setup token printed in the server console');
      return;
    }
    setTokenChecking(true);
    setTokenError('');
    try {
      const res = await fetch('/api/setup/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: setupToken.trim() }),
      });
      const data = await res.json();
      if (data.valid === true) {
        setTokenValid(true);
        setTokenError('');
      } else {
        setTokenValid(false);
        setTokenError('Invalid token. Check the server console output for the token printed during startup.');
      }
    } catch (err: any) {
      setTokenValid(false);
      setTokenError(err?.message || 'Unable to validate token');
    } finally {
      setTokenChecking(false);
    }
  };

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
      const res = await fetch('/api/setup/restore/validate', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Validation failed' } }));
        throw new Error(err.error?.message || 'Validation failed');
      }
      const data = await res.json();
      setRestoreValidation(data);
    } catch (err: any) {
      setRestoreError(err.message || 'Validation failed');
    } finally {
      setRestoreValidating(false);
    }
  };

  const handleRestoreExecute = async () => {
    if (!restoreFile || !restorePassphrase) return;
    if (!tokenValid) {
      setRestoreError('Setup token must be verified before restoring');
      return;
    }
    setRestoreExecuting(true);
    setRestoreError('');
    try {
      const formData = new FormData();
      formData.append('file', restoreFile);
      formData.append('passphrase', restorePassphrase);
      const res = await fetch('/api/setup/restore/execute', {
        method: 'POST',
        headers: { 'X-Setup-Token': setupToken.trim() },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Restore failed' } }));
        throw new Error(err.error?.message || 'Restore failed');
      }
      const data = await res.json();
      setRestoreResult(data);
    } catch (err: any) {
      setRestoreError(err.message || 'Restore failed');
    } finally {
      setRestoreExecuting(false);
    }
  };

  const [form, setForm] = useState<FormState>({
    // Defaults match the Docker Compose install (the `db` and `redis`
    // service names in docker-compose.yml, and the default password set
    // by the postgres service). From inside the api container `localhost`
    // resolves to the api container itself, NOT to Postgres, so the old
    // `localhost` default made the wizard's test-connection step fail
    // every time. Likewise the old `generateRandomPassword()` default
    // generated a fresh random string on each page load that had zero
    // chance of matching the running Postgres instance.
    //
    // If you're running against an external Postgres / Redis, change
    // these in the wizard UI; the defaults are just the docker-compose
    // install's working values.
    dbHost: 'db',
    dbPort: '5432',
    dbName: 'kisbooks',
    dbUser: 'kisbooks',
    dbPassword: 'kisbooks',
    apiPort: '3001',
    frontendPort: '5173',
    redisHost: 'redis',
    redisPort: '6379',
    jwtSecret: '',
    backupKey: '',
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
    industry: '',
    businessType: 'general_business',
    createDemoCompany: false,
  });

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

  // Review step
  const [savedCredentials, setSavedCredentials] = useState(false);

  // Finalizing step
  const [finalizeStatus, setFinalizeStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [finalizeError, setFinalizeError] = useState('');
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
    } catch (err: any) {
      setDbTestStatus('error');
      setDbTestError(err.message || 'Connection failed');
    }
  };

  const handleGenerateSecrets = async () => {
    try {
      const data = await setupFetch<{ jwtSecret: string; backupKey: string }>('/generate-secrets', {
        method: 'POST',
      });
      setForm((f) => ({
        ...f,
        jwtSecret: data.jwtSecret,
        backupKey: data.backupKey,
      }));
    } catch {
      // Fallback to client-side generation
      setForm((f) => ({
        ...f,
        jwtSecret: generateRandomPassword() + generateRandomPassword(),
        backupKey: generateRandomPassword() + generateRandomPassword(),
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
      await setupFetch('/test-smtp', {
        method: 'POST',
        body: JSON.stringify({
          host: form.smtpHost,
          port: Number(form.smtpPort),
          username: form.smtpUser,
          password: form.smtpPass,
          from: form.smtpFrom,
        }),
      });
      setSmtpTestStatus('success');
    } catch (err: any) {
      setSmtpTestStatus('error');
      setSmtpTestError(err.message || 'SMTP test failed');
    }
  };

  const handleGenerateAdminPassword = () => {
    const pw = generateRandomPassword();
    setForm((f) => ({ ...f, adminPassword: pw, adminPasswordConfirm: pw }));
    setShowAdminPassword(true);
  };

  const handleDownloadCredentials = () => {
    const content = [
      '=== Vibe MyBooks Credentials ===',
      `Generated: ${new Date().toISOString()}`,
      '',
      '--- Database ---',
      `Host: ${form.dbHost}`,
      `Port: ${form.dbPort}`,
      `Database: ${form.dbName}`,
      `Username: ${form.dbUser}`,
      `Password: ${form.dbPassword}`,
      '',
      '--- Security ---',
      `JWT Secret: ${form.jwtSecret}`,
      `Backup Encryption Key: ${form.backupKey}`,
      '',
      '--- Admin Account ---',
      `Email: ${form.adminEmail}`,
      `Password: ${form.adminPassword}`,
      '',
      ...(form.skipEmail ? [] : [
        '--- SMTP ---',
        `Host: ${form.smtpHost}`,
        `Port: ${form.smtpPort}`,
        `Username: ${form.smtpUser}`,
        `Password: ${form.smtpPass}`,
        `From: ${form.smtpFrom}`,
        '',
      ]),
      '--- Company ---',
      `Business Name: ${form.businessName}`,
      `Entity Type: ${form.entityType}`,
      `Industry: ${form.industry || 'N/A'}`,
      '',
      'IMPORTANT: Store this file securely and delete it after saving credentials to a password manager.',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kisbooks-credentials.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

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
      if (!tokenValid) {
        throw new Error('Setup token must be verified before finalizing');
      }
      await setupFetch('/initialize', {
        method: 'POST',
        headers: { 'X-Setup-Token': setupToken.trim() },
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
            industry: form.industry || null,
            businessType: form.businessType,
          },
          createDemoCompany: form.createDemoCompany,
        }),
      });

      updateStep(3, 'done');

      // Step 4: Done
      updateStep(4, 'done');
      setFinalizeStatus('done');
    } catch (err: any) {
      setFinalizeError(err.message || 'Setup failed');
      setFinalizeStatus('error');
      // Mark current active step as error
      setFinalizeSteps((prev) =>
        prev.map((s) => (s.status === 'active' ? { ...s, status: 'error' } : s)),
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

  // Auto-generate secrets when reaching step 3 (Security)
  const handleNext = () => {
    if (step === 2) {
      // Moving from Network to Security
      if (!form.jwtSecret || !form.backupKey) {
        handleGenerateSecrets();
      }
    }
    if (step === 7) {
      // Moving from Review to Finalizing
      setStep(8);
      setTimeout(() => handleFinalize(), 200);
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => s - 1);

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return true;
      case 1: return !!(form.dbHost && form.dbPort && form.dbName && form.dbUser && form.dbPassword);
      case 2: return !!(form.apiPort && form.frontendPort && form.redisPort);
      case 3: return !!(form.jwtSecret && form.backupKey);
      case 4: return form.skipEmail || !!(form.smtpHost && form.smtpPort && form.smtpFrom);
      case 5:
        return !!(
          form.adminEmail &&
          form.adminDisplayName &&
          form.adminPassword &&
          form.adminPassword.length >= 8 &&
          form.adminPassword === form.adminPasswordConfirm
        );
      case 6: return !!form.businessName;
      case 7: return savedCredentials;
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Vibe MyBooks Setup</h1>
          <span className="text-sm text-gray-500">
            Step {step + 1} of {stepLabels.length}
          </span>
        </div>
      </div>

      {/* Step indicator */}
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

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            {/* Step 0: Welcome */}
            {step === 0 && !restoreMode && !restoreResult && (
              <div className="text-center py-8 space-y-6">
                <h2 className="text-3xl font-bold text-gray-900">Welcome to Vibe MyBooks</h2>
                <p className="text-lg text-gray-600 max-w-md mx-auto">
                  Your self-hosted bookkeeping solution. Choose how you'd like to get started.
                </p>

                {/* Setup token gate — must be verified before any destructive
                    action is permitted. The token is printed to the API
                    server console on first boot. */}
                <div className="max-w-lg mx-auto text-left bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <Lock className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-amber-900 text-sm">Setup Token Required</h3>
                      <p className="text-xs text-amber-800 mt-1">
                        Paste the setup token from the API server console. It is also saved
                        to <code className="bg-amber-100 px-1 rounded">/data/config/.setup-token</code> on
                        the API container.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Paste setup token"
                      value={setupToken}
                      onChange={(e) => {
                        setSetupToken(e.target.value);
                        setTokenValid(false);
                        setTokenError('');
                      }}
                      disabled={tokenValid}
                      className="flex-1 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      onClick={handleValidateToken}
                      disabled={tokenChecking || tokenValid || !setupToken.trim()}
                    >
                      {tokenValid ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" /> Verified
                        </span>
                      ) : tokenChecking ? 'Checking...' : 'Verify'}
                    </Button>
                  </div>
                  {tokenError && (
                    <p className="text-xs text-red-700">{tokenError}</p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto pt-2">
                  <button
                    onClick={() => setStep(1)}
                    disabled={!tokenValid}
                    className="flex-1 p-5 rounded-lg border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-transparent"
                  >
                    <ChevronRight className="h-6 w-6 text-primary-600 mb-2" />
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-700">New Installation</h3>
                    <p className="text-xs text-gray-500 mt-1">Set up a fresh Vibe MyBooks instance from scratch</p>
                  </button>
                  <button
                    onClick={() => setRestoreMode(true)}
                    disabled={!tokenValid}
                    className="flex-1 p-5 rounded-lg border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-transparent"
                  >
                    <Upload className="h-6 w-6 text-amber-600 mb-2" />
                    <h3 className="font-semibold text-gray-900 group-hover:text-amber-700">Restore from Backup</h3>
                    <p className="text-xs text-gray-500 mt-1">Restore a previous installation from a .vmb backup file</p>
                  </button>
                </div>
                {!tokenValid && (
                  <p className="text-xs text-gray-500">Verify the setup token to continue.</p>
                )}
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

            {/* Step 1: Database */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Database Connection</h2>
                <p className="text-sm text-gray-500">
                  Configure the PostgreSQL database connection. The defaults work with the included
                  Docker Compose setup.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Host" value={form.dbHost} onChange={set('dbHost')} />
                  <Input label="Port" value={form.dbPort} onChange={set('dbPort')} type="number" />
                </div>
                <Input label="Database Name" value={form.dbName} onChange={set('dbName')} />
                <Input label="Username" value={form.dbUser} onChange={set('dbUser')} />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <div className="relative">
                    <input
                      type={showDbPassword ? 'text' : 'password'}
                      value={form.dbPassword}
                      onChange={set('dbPassword')}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                    Test Connection
                  </Button>
                  {dbTestStatus === 'success' && (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" /> Connected
                    </span>
                  )}
                  {dbTestStatus === 'error' && (
                    <span className="text-sm text-red-600">{dbTestError || 'Connection failed'}</span>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Network / Ports */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Network & Ports</h2>
                <p className="text-sm text-gray-500">
                  Configure which ports the application services will use. Change these if another application is already using the default ports.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Server Port</label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={form.apiPort} onChange={(e) => { set('apiPort')(e); setPortStatus((p) => ({ ...p, api: 'idle' })); }}
                        onBlur={() => checkPort(form.apiPort, 'api')}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                      {portStatus['api'] === 'checking' && <span className="text-xs text-gray-400">Checking...</span>}
                      {portStatus['api'] === 'available' && <span className="text-xs text-green-600">Available</span>}
                      {portStatus['api'] === 'in_use' && <span className="text-xs text-red-600">In use</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frontend Port</label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={form.frontendPort} onChange={(e) => { set('frontendPort')(e); setPortStatus((p) => ({ ...p, frontend: 'idle' })); }}
                        onBlur={() => checkPort(form.frontendPort, 'frontend')}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                      {portStatus['frontend'] === 'checking' && <span className="text-xs text-gray-400">Checking...</span>}
                      {portStatus['frontend'] === 'available' && <span className="text-xs text-green-600">Available</span>}
                      {portStatus['frontend'] === 'in_use' && <span className="text-xs text-red-600">In use</span>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Redis Host" value={form.redisHost} onChange={set('redisHost')} />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Redis Port</label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={form.redisPort} onChange={(e) => { set('redisPort')(e); setPortStatus((p) => ({ ...p, redis: 'idle' })); }}
                        onBlur={() => checkPort(form.redisPort, 'redis')}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                      {portStatus['redis'] === 'checking' && <span className="text-xs text-gray-400">Checking...</span>}
                      {portStatus['redis'] === 'available' && <span className="text-xs text-green-600">Available</span>}
                      {portStatus['redis'] === 'in_use' && <span className="text-xs text-red-600">In use</span>}
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800">
                  Default ports: API 3001, Frontend 5173, Redis 6379. Change only if another application is using these ports.
                </div>
              </div>
            )}

            {/* Step 3: Security */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Security Keys</h2>
                <p className="text-sm text-gray-500">
                  These keys are used to sign authentication tokens and encrypt backups. They have
                  been auto-generated for you. Save them securely -- you'll need them if you ever
                  move or restore your installation.
                </p>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">JWT Secret</label>
                  <div className="relative">
                    <input
                      type={showJwtSecret ? 'text' : 'password'}
                      value={form.jwtSecret}
                      onChange={set('jwtSecret')}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
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
                  <label className="block text-sm font-medium text-gray-700">Backup Encryption Key</label>
                  <div className="relative">
                    <input
                      type={showBackupKey ? 'text' : 'password'}
                      value={form.backupKey}
                      onChange={set('backupKey')}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
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
                <Button variant="secondary" onClick={handleGenerateSecrets}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Regenerate
                </Button>
              </div>
            )}

            {/* Step 4: Email */}
            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Email Configuration (Optional)</h2>
                <p className="text-sm text-gray-500">
                  Configure SMTP to send invoices and notifications by email. You can skip this and
                  set it up later.
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.skipEmail}
                    onChange={setChecked('skipEmail')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Skip email configuration</span>
                </label>

                {!form.skipEmail && (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Provider Preset</label>
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
                        <Input label="SMTP Host" value={form.smtpHost} onChange={set('smtpHost')} />
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
                    <Input label="From Address" value={form.smtpFrom} onChange={set('smtpFrom')} type="email" />
                    <div className="flex items-center gap-3">
                      <Button variant="secondary" onClick={handleTestSmtp} loading={smtpTestStatus === 'testing'}>
                        Test Email
                      </Button>
                      {smtpTestStatus === 'success' && (
                        <span className="flex items-center gap-1 text-sm text-green-600">
                          <CheckCircle className="h-4 w-4" /> Email sent
                        </span>
                      )}
                      {smtpTestStatus === 'error' && (
                        <span className="text-sm text-red-600">{smtpTestError || 'SMTP test failed'}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Admin Account */}
            {step === 5 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Admin Account</h2>
                <p className="text-sm text-gray-500">
                  Create the first admin user who will have full access to the application.
                </p>
                <Input
                  label="Email"
                  type="email"
                  value={form.adminEmail}
                  onChange={set('adminEmail')}
                  required
                />
                <Input
                  label="Display Name"
                  value={form.adminDisplayName}
                  onChange={set('adminDisplayName')}
                  required
                />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Password (min 8 characters)</label>
                  <div className="relative">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      value={form.adminPassword}
                      onChange={set('adminPassword')}
                      minLength={8}
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
                  {form.adminPassword && form.adminPassword.length < 8 && (
                    <p className="text-sm text-red-600">Password must be at least 8 characters</p>
                  )}
                </div>
                <Input
                  label="Confirm Password"
                  type="password"
                  value={form.adminPasswordConfirm}
                  onChange={set('adminPasswordConfirm')}
                  error={
                    form.adminPasswordConfirm && form.adminPassword !== form.adminPasswordConfirm
                      ? 'Passwords do not match'
                      : undefined
                  }
                />
                <Button variant="secondary" onClick={handleGenerateAdminPassword}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Generate Password
                </Button>
              </div>
            )}

            {/* Step 6: Company */}
            {step === 6 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Company Information</h2>
                <p className="text-sm text-gray-500">
                  Tell us about your business. This information will appear on invoices and reports.
                </p>
                <Input
                  label="Business Name"
                  value={form.businessName}
                  onChange={set('businessName')}
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                  <select value={form.businessType} onChange={set('businessType')}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    {businessTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Determines the chart of accounts template for your company.</p>
                </div>
                <Input
                  label="Industry (Optional)"
                  value={form.industry}
                  onChange={set('industry')}
                  placeholder="e.g., Consulting, Retail, Service"
                />

                {/* Optional demo data */}
                <div className="pt-2 border-t border-gray-200">
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
                        Also create a Demo Bookkeeping Co tenant with sample data
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Creates a second tenant named <strong>Demo Bookkeeping Co</strong>{' '}
                        populated with ~200 realistic transactions (invoices, customer
                        payments, cash sales, expenses, bank deposits, transfers, and
                        payroll) spanning the current year and the prior year. Useful for
                        exploring the app and testing reports without touching your real
                        books. You can switch between the two tenants from the app UI.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Step 7: Review */}
            {step === 7 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Review Configuration</h2>
                <p className="text-sm text-gray-500">
                  Please review your settings before completing setup. Download your credentials
                  file and store it securely.
                </p>

                {/* Database */}
                <div className="border border-gray-200 rounded-lg p-4 space-y-1">
                  <h3 className="text-sm font-semibold text-gray-700">Database</h3>
                  <p className="text-sm text-gray-600">
                    {form.dbUser}@{form.dbHost}:{form.dbPort}/{form.dbName}
                  </p>
                  <p className="text-sm text-gray-500">Password: {masked(form.dbPassword)}</p>
                </div>

                {/* Security */}
                <div className="border border-gray-200 rounded-lg p-4 space-y-1">
                  <h3 className="text-sm font-semibold text-gray-700">Security</h3>
                  <p className="text-sm text-gray-500">JWT Secret: {masked(form.jwtSecret)}</p>
                  <p className="text-sm text-gray-500">Backup Key: {masked(form.backupKey)}</p>
                </div>

                {/* Email */}
                <div className="border border-gray-200 rounded-lg p-4 space-y-1">
                  <h3 className="text-sm font-semibold text-gray-700">Email</h3>
                  {form.skipEmail ? (
                    <p className="text-sm text-gray-500 italic">Skipped</p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">{form.smtpHost}:{form.smtpPort}</p>
                      <p className="text-sm text-gray-500">From: {form.smtpFrom}</p>
                    </>
                  )}
                </div>

                {/* Admin */}
                <div className="border border-gray-200 rounded-lg p-4 space-y-1">
                  <h3 className="text-sm font-semibold text-gray-700">Admin Account</h3>
                  <p className="text-sm text-gray-600">{form.adminEmail}</p>
                  <p className="text-sm text-gray-600">{form.adminDisplayName}</p>
                  <p className="text-sm text-gray-500">Password: {masked(form.adminPassword)}</p>
                </div>

                {/* Company */}
                <div className="border border-gray-200 rounded-lg p-4 space-y-1">
                  <h3 className="text-sm font-semibold text-gray-700">Company</h3>
                  <p className="text-sm text-gray-600">{form.businessName}</p>
                  <p className="text-sm text-gray-500">
                    {entityTypeLabels[form.entityType] || form.entityType}
                  </p>
                  {form.industry && (
                    <p className="text-sm text-gray-500">Industry: {form.industry}</p>
                  )}
                </div>

                {/* Download & Confirm */}
                <div className="pt-2 space-y-3">
                  <Button variant="secondary" onClick={handleDownloadCredentials}>
                    <Download className="h-4 w-4 mr-1" /> Download Credentials
                  </Button>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={savedCredentials}
                      onChange={(e) => setSavedCredentials(e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">I have saved my credentials</span>
                  </label>
                </div>
              </div>
            )}

            {/* Step 8: Finalizing */}
            {step === 8 && (
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
                    {finalizeError}
                  </div>
                )}

                {finalizeStatus === 'done' && (
                  <div className="text-center pt-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Your Vibe MyBooks installation is ready. You can now log in with your admin
                      credentials.
                    </p>
                    <Button onClick={() => navigate('/login')}>Go to Login</Button>
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

            {/* Navigation buttons — hidden only on the Finalizing step (8),
                which has its own "Go to Login" / "Retry" controls. The bar
                DOES render on step 7 (Review) with a "Complete Setup"
                button; previously it was hidden on step 7 too, leaving
                users stranded with no way to finish the wizard. */}
            {step < 8 && step > 0 && !restoreMode && !restoreResult && (
              <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
                {step > 0 ? (
                  <Button variant="secondary" onClick={handleBack}>
                    Back
                  </Button>
                ) : (
                  <div />
                )}
                <Button onClick={handleNext} disabled={!canProceed()}>
                  {step === 7 ? 'Complete Setup' : 'Next'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
