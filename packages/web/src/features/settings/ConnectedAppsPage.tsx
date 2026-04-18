// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Plug, Trash2 } from 'lucide-react';

interface OAuthApp {
  clientId: string;
  name: string;
  scopes: string;
  authorizedAt: string;
}

export function ConnectedAppsPage() {
  const queryClient = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState<OAuthApp | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['oauth', 'apps'],
    queryFn: async (): Promise<{ apps: OAuthApp[] }> => {
      const res = await fetch('/oauth/apps', { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });
      return res.json();
    },
  });

  const revoke = useMutation({
    mutationFn: async (clientId: string) => {
      await fetch(`/oauth/apps/${clientId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['oauth', 'apps'] }),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  const apps = data?.apps || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Connected Apps</h1>
      <p className="text-sm text-gray-500 mb-6">Third-party applications you've authorized to access your data.</p>

      {apps.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          <Plug className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No connected apps. When you authorize an application, it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((app: OAuthApp) => (
            <div key={app.clientId} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{app.name}</p>
                <p className="text-xs text-gray-500">Scopes: {app.scopes} · Authorized: {new Date(app.authorizedAt).toLocaleDateString()}</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => setRevokeTarget(app)} loading={revoke.isPending}>
                <Trash2 className="h-4 w-4 mr-1" /> Revoke
              </Button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        title={`Revoke access for ${revokeTarget?.name ?? ''}?`}
        message="The application will lose access to your data immediately. It will need to be re-authorized to reconnect."
        confirmLabel="Revoke"
        variant="danger"
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) revoke.mutate(revokeTarget.clientId);
          setRevokeTarget(null);
        }}
      />
    </div>
  );
}
