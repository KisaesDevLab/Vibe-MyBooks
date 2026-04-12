import { DiagnosticFrame } from './DiagnosticFrame';
import { RegenerateSentinelForm } from './RegenerateSentinelForm';
import type { SentinelHeaderDTO } from './types';

interface Props {
  header: SentinelHeaderDTO | null;
  details: string;
  corrupt?: boolean;
}

/**
 * Shown when the sentinel file exists but either:
 *   (a) decryption fails — wrong ENCRYPTION_KEY or tampered ciphertext, or
 *   (b) the sentinel is byte-level corrupt (CRC / magic / truncation).
 * Both cases need the same remediation: restore the env file, OR regenerate
 * the sentinel (which requires valid admin credentials + working env vars).
 */
export function EncryptionKeyErrorPage({ header, details, corrupt }: Props) {
  return (
    <DiagnosticFrame
      title={corrupt ? 'Sentinel File Corrupted' : 'Encryption Key Mismatch'}
      code={corrupt ? 'SENTINEL_CORRUPT' : 'SENTINEL_DECRYPT_FAILED'}
    >
      <div className="rounded-md bg-slate-900 border border-slate-700 p-4 space-y-2">
        {corrupt ? (
          <p>
            The sentinel file at <code className="bg-slate-800 px-1 rounded">/data/.sentinel</code>{' '}
            is damaged — the file bytes no longer match their checksum. This can happen after a
            disk failure, filesystem corruption, or an incomplete write. Decryption is not even
            being attempted.
          </p>
        ) : (
          <p>
            The sentinel file exists but cannot be decrypted. Either the{' '}
            <code className="bg-slate-800 px-1 rounded">ENCRYPTION_KEY</code> in your{' '}
            <code className="bg-slate-800 px-1 rounded">.env</code> no longer matches the key used at
            setup time, or the ciphertext was tampered with.
          </p>
        )}
        {header && (
          <dl className="text-sm grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 mt-3 font-mono">
            <dt className="text-slate-400">Installation ID:</dt>
            <dd>{header.installationId}</dd>
            <dt className="text-slate-400">Set up on:</dt>
            <dd>{new Date(header.createdAt).toLocaleString()}</dd>
            <dt className="text-slate-400">Set up by:</dt>
            <dd>{header.adminEmail}</dd>
          </dl>
        )}
        <p className="text-xs text-slate-500 mt-2 font-mono">{details}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100">Recovery options</h2>

        <div className="rounded-md bg-slate-900 border border-slate-700 p-4">
          <h3 className="font-semibold text-slate-100">1. Restore the correct .env file</h3>
          <p className="text-sm text-slate-300 mt-1">
            If you have a backup of your <code className="bg-slate-800 px-1 rounded">.env</code> or
            know the original value of{' '}
            <code className="bg-slate-800 px-1 rounded">ENCRYPTION_KEY</code>, restore it to{' '}
            <code className="bg-slate-800 px-1 rounded">/data/config/.env</code> and restart the container.
          </p>
          <p className="text-sm text-yellow-200 mt-2">
            <strong>Do NOT</strong> generate a new ENCRYPTION_KEY — a new key cannot decrypt the
            existing sentinel.
          </p>
        </div>

        <div className="rounded-md bg-slate-900 border border-slate-700 p-4">
          <h3 className="font-semibold text-slate-100">2. Regenerate the sentinel</h3>
          <p className="text-sm text-slate-300 mt-1">
            If you have valid super-admin credentials and a working{' '}
            <code className="bg-slate-800 px-1 rounded">ENCRYPTION_KEY</code>, you can regenerate the
            sentinel from the current database state. The existing installation ID in
            system_settings will be reused if present.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <RegenerateSentinelForm
          confirmLabel="Authenticate and regenerate"
          description="Requires super admin email + password. Authenticates directly against the users table."
        />
      </section>
    </DiagnosticFrame>
  );
}
