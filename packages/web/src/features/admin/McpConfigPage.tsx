// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Plug, CheckCircle } from 'lucide-react';

export function McpConfigPage() {
  const queryClient = useQueryClient();

  // MCP config doesn't have a dedicated admin endpoint yet — use system settings pattern
  const [form, setForm] = useState({
    isEnabled: false,
    maxKeysPerUser: 5,
    systemRateLimitPerMinute: 500,
    oauthEnabled: false,
    requireKeyExpiration: false,
    maxKeyLifetimeDays: '',
  });
  const [saved, setSaved] = useState(false);

  // Load config
  const { data: configData, isLoading } = useQuery({
    queryKey: ['admin', 'mcp-config'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/v1/admin/mcp/config', { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });
        return res.ok ? res.json() : null;
      } catch { return null; }
    },
  });

  useEffect(() => {
    if (configData) {
      setForm({
        isEnabled: configData.isEnabled ?? false,
        maxKeysPerUser: configData.maxKeysPerUser ?? 5,
        systemRateLimitPerMinute: configData.systemRateLimitPerMinute ?? 500,
        oauthEnabled: configData.oauthEnabled ?? false,
        requireKeyExpiration: configData.requireKeyExpiration ?? false,
        maxKeyLifetimeDays: configData.maxKeyLifetimeDays ? String(configData.maxKeyLifetimeDays) : '',
      });
    }
  }, [configData]);

  // Request log
  const { data: logData } = useQuery({
    queryKey: ['admin', 'mcp-log'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/v1/admin/mcp/log', { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });
        return res.ok ? res.json() : { logs: [] };
      } catch { return { logs: [] }; }
    },
  });

  const handleSave = async () => {
    await fetch('/api/v1/admin/mcp/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      body: JSON.stringify({ ...form, maxKeyLifetimeDays: form.maxKeyLifetimeDays ? parseInt(form.maxKeyLifetimeDays) : null }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    queryClient.invalidateQueries({ queryKey: ['admin', 'mcp-config'] });
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Plug className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">MCP / API Access</h1>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 max-w-2xl">
          <CheckCircle className="h-4 w-4" /> Configuration saved
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        {/* Master Switch */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">MCP Server</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isEnabled}
              onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-5 w-5" />
            <div>
              <span className="text-sm font-medium text-gray-700">Enable MCP / API Access</span>
              <p className="text-xs text-gray-500">Allow users to create API keys and connect AI assistants via MCP</p>
            </div>
          </label>
        </div>

        {/* Key Policies */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Key Policies</h2>
          <Input label="Max API keys per user" type="number" value={String(form.maxKeysPerUser)}
            onChange={(e) => setForm((f) => ({ ...f, maxKeysPerUser: parseInt(e.target.value) || 5 }))} />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.requireKeyExpiration}
              onChange={(e) => setForm((f) => ({ ...f, requireKeyExpiration: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 h-4 w-4" />
            <span className="text-sm text-gray-700">Require expiration on all API keys</span>
          </label>
          {form.requireKeyExpiration && (
            <Input label="Max key lifetime (days)" type="number" value={form.maxKeyLifetimeDays}
              onChange={(e) => setForm((f) => ({ ...f, maxKeyLifetimeDays: e.target.value }))}
              placeholder="Leave empty for unlimited" />
          )}
        </div>

        {/* Rate Limits */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Rate Limits</h2>
          <Input label="System-wide max requests per minute" type="number" value={String(form.systemRateLimitPerMinute)}
            onChange={(e) => setForm((f) => ({ ...f, systemRateLimitPerMinute: parseInt(e.target.value) || 500 }))} />
        </div>

        {/* OAuth */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">OAuth 2.0</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.oauthEnabled}
              onChange={(e) => setForm((f) => ({ ...f, oauthEnabled: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 h-4 w-4" />
            <div>
              <span className="text-sm text-gray-700">Enable OAuth 2.0</span>
              <p className="text-xs text-gray-500">Allow third-party applications to request user authorization</p>
            </div>
          </label>
        </div>

        <Button onClick={handleSave}>Save Configuration</Button>

        {/* Request Log */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-4 border-b"><h2 className="text-lg font-semibold text-gray-800">Recent MCP Requests</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Time</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Tool</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(logData?.logs || []).map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-600">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2 font-mono text-xs">{log.toolName || log.resourceUri || '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${log.status === 'success' ? 'bg-green-100 text-green-700' : log.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{log.durationMs ? `${log.durationMs}ms` : '—'}</td>
                  </tr>
                ))}
                {(!logData?.logs || logData.logs.length === 0) && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No MCP requests recorded</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
