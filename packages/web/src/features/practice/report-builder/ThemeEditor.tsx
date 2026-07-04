// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { apiClient } from '../../../api/client';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 16.9 — theme editor.
// Edits the per-practice portal branding (logo URL, primary color)
// AND the per-template themeJsonb. The editor saves both in one
// pass so the published PDF + portal share a coherent look.

// Shared api client: credentials, X-Company-Id, 401 → refresh → retry,
// and server error messages surfaced via ApiError (extends Error).
const api = apiClient;

interface Theme {
  primaryColor: string;
  secondaryColor: string;
  font: string;
  headerText: string;
  footerText: string;
  brandingLogoUrl: string;
}

const DEFAULT_THEME: Theme = {
  primaryColor: '#4f46e5',
  secondaryColor: '#0ea5e9',
  font: 'Inter',
  headerText: '',
  footerText: 'Powered by Vibe MyBooks',
  brandingLogoUrl: '',
};

interface PracticeSettings {
  brandingLogoUrl: string | null;
  brandingPrimaryColor: string | null;
}

interface Template {
  id: string;
  name: string;
  themeJsonb?: Record<string, unknown>;
}

export function ThemeEditor({ onClose }: { onClose: () => void }) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings | null>(null);
  const [scope, setScope] = useState<'practice' | string>('practice'); // template id or 'practice'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<{ settings: PracticeSettings }>('/practice/portal/settings/practice'),
      api<{ templates: Template[] }>('/practice/reports/templates'),
    ])
      .then(([s, t]) => {
        setTemplates(t.templates);
        setPracticeSettings(s.settings);
      })
      .catch(() => setError('Failed to load theme.'))
      .finally(() => setLoading(false));
  }, []);

  // A "Saved at" stamp belongs to the scope it was saved in — clear it
  // when the user switches scopes. (Separate effect from hydration below,
  // which also re-runs when local data is synced after a save.)
  useEffect(() => {
    setSavedAt(null);
  }, [scope]);

  // Hydrate the form whenever the scope changes (and once the data
  // arrives). Always reset to DEFAULT_THEME first so values edited in
  // one scope never leak into another.
  useEffect(() => {
    if (scope === 'practice') {
      setTheme({
        ...DEFAULT_THEME,
        primaryColor: practiceSettings?.brandingPrimaryColor ?? DEFAULT_THEME.primaryColor,
        brandingLogoUrl: practiceSettings?.brandingLogoUrl ?? '',
      });
      return;
    }
    const tpl = templates.find((t) => t.id === scope);
    setTheme({ ...DEFAULT_THEME, ...((tpl?.themeJsonb as Partial<Theme>) ?? {}) });
  }, [scope, templates, practiceSettings]);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      if (scope === 'practice') {
        // The practice branding endpoint only persists the primary color
        // and logo URL (see portal-contacts.routes.ts) — the secondary
        // color field is hidden in this scope so nothing is silently lost.
        await api('/practice/portal/settings/practice', {
          method: 'PUT',
          body: JSON.stringify({
            brandingPrimaryColor: theme.primaryColor,
            brandingLogoUrl: theme.brandingLogoUrl || null,
          }),
        });
        setPracticeSettings({
          brandingPrimaryColor: theme.primaryColor,
          brandingLogoUrl: theme.brandingLogoUrl || null,
        });
      } else {
        // Per-template override.
        await api(`/practice/reports/templates/${scope}`, {
          method: 'PUT',
          body: JSON.stringify({ theme }),
        });
        // Keep the local template list in sync so switching scopes away
        // and back shows the values that were just saved.
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === scope ? { ...t, themeJsonb: { ...theme } as Record<string, unknown> } : t,
          ),
        );
      }
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Modal title="Theme editor" onClose={onClose}>
        <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>
      </Modal>
    );
  }

  return (
    <Modal title="Theme editor" onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm">
          <span className="block text-gray-800 mb-1 font-medium">Scope</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="practice">Practice-wide (all templates)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                Template: {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ColorField
            label="Primary color"
            value={theme.primaryColor}
            onChange={(v) => setTheme({ ...theme, primaryColor: v })}
          />
          {scope !== 'practice' ? (
            <ColorField
              label="Secondary color"
              value={theme.secondaryColor}
              onChange={(v) => setTheme({ ...theme, secondaryColor: v })}
            />
          ) : (
            // Practice-wide branding only stores the primary color and
            // logo; the secondary color lives on each template's theme.
            <p className="text-xs text-gray-500 self-end pb-1">
              Secondary color is set per template — pick a template scope to edit it.
            </p>
          )}
        </div>

        <TextField
          label="Logo URL"
          value={theme.brandingLogoUrl}
          onChange={(v) => setTheme({ ...theme, brandingLogoUrl: v })}
          placeholder="https://yourfirm.com/logo.png"
        />

        {scope !== 'practice' && (
          <>
            <TextField
              label="Font family"
              value={theme.font}
              onChange={(v) => setTheme({ ...theme, font: v })}
            />
            <TextField
              label="Header text"
              value={theme.headerText}
              onChange={(v) => setTheme({ ...theme, headerText: v })}
              placeholder="Optional"
            />
            <TextField
              label="Footer text"
              value={theme.footerText}
              onChange={(v) => setTheme({ ...theme, footerText: v })}
            />
          </>
        )}

        <div className="rounded-md border border-gray-200 overflow-hidden">
          <div
            className="px-4 py-3 text-white text-sm font-semibold"
            style={{ background: theme.primaryColor }}
          >
            {theme.brandingLogoUrl ? (
              <img
                src={theme.brandingLogoUrl}
                alt="Logo preview"
                className="h-6 inline-block mr-2 align-middle"
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            ) : null}
            Preview header
          </div>
          <div className="px-4 py-3 text-sm" style={{ fontFamily: theme.font }}>
            <p className="font-semibold text-gray-900">{theme.headerText || 'Sample report'}</p>
            <p className="text-gray-600 mt-1">Body text in {theme.font}.</p>
            <span
              className="inline-block mt-2 px-2 py-0.5 rounded text-xs"
              style={{ background: theme.secondaryColor, color: '#fff' }}
            >
              Accent
            </span>
          </div>
          <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-200">
            {theme.footerText}
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        {savedAt && (
          <div className="text-sm text-green-700">Saved at {savedAt}.</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Close
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md"
          >
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-gray-800 mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 border border-gray-300 rounded"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm font-mono"
        />
      </div>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-gray-800 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
      />
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm">
            ×
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default ThemeEditor;
