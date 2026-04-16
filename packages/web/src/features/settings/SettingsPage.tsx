import { Link } from 'react-router-dom';
import {
  SlidersHorizontal,
  Building2,
  FileText,
  Users,
  Printer,
  Tag,
  HardDrive,
  ScrollText,
  Download,
  Scale,
  Mail,
  Key,
  Shield,
  FileArchive,
  Upload,
  Cloud,
  CreditCard,
  Brain,
} from 'lucide-react';

const settingsCards = [
  {
    to: '/settings/preferences',
    icon: SlidersHorizontal,
    title: 'Preferences',
    description: 'Accounting method, fiscal year, tax rate, currency, and display options',
  },
  {
    to: '/settings/company',
    icon: Building2,
    title: 'Company Profile',
    description: 'Business name, address, phone, and logo',
  },
  {
    to: '/settings/invoice-template',
    icon: FileText,
    title: 'Invoice Template',
    description: 'Customize invoice layout and appearance',
  },
  {
    to: '/settings/email',
    icon: Mail,
    title: 'Email (SMTP)',
    description: 'Configure outbound email for invoices and notifications',
  },
  {
    to: '/settings/ai',
    icon: Brain,
    title: 'AI Processing',
    description: 'Review and consent to AI-assisted categorization, receipt OCR, and statement parsing',
  },
  {
    to: '/settings/report-labels',
    icon: FileText,
    title: 'Report Headings',
    description: 'Customize Profit & Loss section headings for the view, CSV, and PDF',
  },
  {
    to: '/settings/online-payments',
    icon: CreditCard,
    title: 'Online Payments (Stripe)',
    description: 'Accept credit card and digital wallet payments on invoice links',
  },
  {
    to: '/settings/check-printing',
    icon: Printer,
    title: 'Check Printing',
    description: 'Check layout, formatting, and print settings',
  },
  {
    to: '/settings/tags',
    icon: Tag,
    title: 'Tags',
    description: 'Manage tag groups and tags for categorizing transactions',
  },
  {
    to: '/settings/backup',
    icon: HardDrive,
    title: 'Backup & Restore',
    description: 'Create backups and restore from previous snapshots',
  },
  {
    to: '/settings/audit-log',
    icon: ScrollText,
    title: 'Audit Log',
    description: 'View a log of all changes made to your data',
  },
  {
    to: '/settings/export',
    icon: Download,
    title: 'Export Data',
    description: 'Export transactions, contacts, and accounts to CSV',
  },
  {
    to: '/settings/opening-balances',
    icon: Scale,
    title: 'Opening Balances',
    description: 'Set starting balances when migrating from another system',
  },
  {
    to: '/settings/tenant-export',
    icon: FileArchive,
    title: 'Export Company Data',
    description: 'Export your company data as an encrypted file for your accountant',
  },
  {
    to: '/settings/tenant-import',
    icon: Upload,
    title: 'Import Client Data',
    description: 'Import a client\'s company data from another Vibe MyBooks installation',
  },
  {
    to: '/settings/remote-backup',
    icon: Cloud,
    title: 'Remote Backups',
    description: 'Schedule automatic backups to SFTP, WebDAV, or email',
  },
];

export function SettingsPage() {
  const allCards = [
    ...settingsCards,
    {
      to: '/settings/team',
      icon: Users,
      title: 'Team',
      description: 'Manage users who have access to your books',
    },
    {
      to: '/settings/security',
      icon: Shield,
      title: 'Security (2FA)',
      description: 'Two-factor authentication and trusted devices',
    },
    {
      to: '/settings/api-keys',
      icon: Key,
      title: 'API Keys',
      description: 'Generate keys for external integrations and automation',
    },
    {
      to: '/settings/connected-apps',
      icon: Key,
      title: 'Connected Apps',
      description: 'Manage third-party apps authorized to access your data',
    },
    {
      to: '/settings/storage',
      icon: HardDrive,
      title: 'File Storage',
      description: 'Configure where uploaded files are stored (local, cloud, S3)',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-sm text-gray-500 mb-6">Manage your company configuration, data, and preferences.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        {allCards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 hover:border-primary-300 hover:shadow-md transition-all flex items-start gap-4 group"
          >
            <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-primary-50 transition-colors">
              <card.icon className="h-5 w-5 text-gray-600 group-hover:text-primary-600 transition-colors" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
                {card.title}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
