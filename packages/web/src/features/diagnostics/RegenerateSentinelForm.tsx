import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

/**
 * Admin-authenticated form for regenerating the sentinel file. Shown on
 * EncryptionKeyErrorPage and DatabaseResetPage as a last-resort recovery
 * action. POSTs to /api/diagnostic/regenerate-sentinel and verifies against
 * the users table directly.
 */
export function RegenerateSentinelForm({
  confirmLabel,
  description,
}: {
  confirmLabel: string;
  description: string;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/diagnostic/regenerate-sentinel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: { message: 'request failed' } }));
        throw new Error(body.error?.message ?? 'regeneration failed');
      }
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-md border border-green-700 bg-green-950 p-4">
        <p className="text-green-200 font-semibold">Sentinel regenerated successfully.</p>
        <p className="text-sm text-green-300 mt-1">
          Restart the API container to reload with the new sentinel.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-md border border-slate-700 bg-slate-900 p-4 space-y-3">
      <p className="text-sm text-slate-300">{description}</p>
      <div>
        <label className="block text-xs uppercase text-slate-400 mb-1">Super admin email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={submitting}
        />
      </div>
      <div>
        <label className="block text-xs uppercase text-slate-400 mb-1">Password</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          disabled={submitting}
        />
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Regenerating…' : confirmLabel}
      </Button>
    </form>
  );
}
