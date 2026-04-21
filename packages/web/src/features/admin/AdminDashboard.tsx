// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { CloudflaredStatusCard } from './CloudflaredStatusCard';
import { UpdateCheckCard } from './UpdateCheckCard';
import {
  Building2,
  Users,
  UserCheck,
  ShieldCheck,
  Briefcase,
  ArrowLeftRight,
  Key,
  Database,
  Mail,
  Server,
  HardDrive,
  Upload,
} from 'lucide-react';

interface AdminStats {
  totalTenants: number;
  totalUsers: number;
  activeUsers: number;
  superAdmins: number;
  totalCompanies: number;
  totalTransactions: number;
  activeSessions: number;
  databaseSizeMB: number;
}

interface AdminSettings {
  smtpConfigured: boolean;
  nodeEnv: string;
  backupDir: string;
  uploadDir: string;
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <Icon className="h-5 w-5 text-gray-400" />
      <span className="text-sm text-gray-600 w-32">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export function AdminDashboard() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => apiClient<AdminStats>('/admin/stats'),
  });

  const { data: settings, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => apiClient<AdminSettings>('/admin/settings'),
  });

  if (statsLoading || settingsLoading) {
    return <LoadingSpinner className="py-12" />;
  }

  if (statsError || settingsError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load admin data. {(statsError as Error)?.message || (settingsError as Error)?.message}
          <button
            onClick={() => window.location.reload()}
            className="ml-4 text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">System-wide overview and settings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Tenants" value={stats?.totalTenants ?? 0} icon={Building2} color="bg-blue-500" />
        <StatCard title="Total Users" value={stats?.totalUsers ?? 0} icon={Users} color="bg-green-500" />
        <StatCard title="Active Users" value={stats?.activeUsers ?? 0} icon={UserCheck} color="bg-emerald-500" />
        <StatCard title="Super Admins" value={stats?.superAdmins ?? 0} icon={ShieldCheck} color="bg-purple-500" />
        <StatCard title="Total Companies" value={stats?.totalCompanies ?? 0} icon={Briefcase} color="bg-indigo-500" />
        <StatCard title="Total Transactions" value={stats?.totalTransactions ?? 0} icon={ArrowLeftRight} color="bg-orange-500" />
        <StatCard title="Active Sessions" value={stats?.activeSessions ?? 0} icon={Key} color="bg-yellow-500" />
        <StatCard
          title="Database Size (MB)"
          value={stats?.databaseSizeMB?.toFixed(1) ?? '0'}
          icon={Database}
          color="bg-red-500"
        />
      </div>

      <UpdateCheckCard />

      <CloudflaredStatusCard />

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Global Settings</h2>
        </div>
        <div className="px-6 py-2">
          <SettingRow
            label="SMTP"
            value={settings?.smtpConfigured ? 'Configured' : 'Not Configured'}
            icon={Mail}
          />
          <SettingRow label="Node Env" value={settings?.nodeEnv ?? 'unknown'} icon={Server} />
          <SettingRow label="Backup Dir" value={settings?.backupDir ?? 'N/A'} icon={HardDrive} />
          <SettingRow label="Upload Dir" value={settings?.uploadDir ?? 'N/A'} icon={Upload} />
        </div>
      </div>
    </div>
  );
}
