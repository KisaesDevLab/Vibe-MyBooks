import { db } from '../packages/api/src/db/index.js';
import { accounts, contacts, tenants } from '../packages/api/src/db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import * as ledger from '../packages/api/src/services/ledger.service.js';
import * as contactsService from '../packages/api/src/services/contacts.service.js';

async function seed() {
  // Find demo tenant
  const user = await db.query.users.findFirst({ where: eq((await import('../packages/api/src/db/schema/index.js')).users.email, 'demo@demo.com') });
  if (!user) { console.log('demo@demo.com not found'); process.exit(1); }
  const tenantId = user.tenantId;
  console.log('Tenant:', tenantId);

  // Get account IDs
  const allAccounts = await db.select().from(accounts).where(eq(accounts.tenantId, tenantId));
  const acct = (name: string) => allAccounts.find(a => a.name.includes(name))?.id;

  const CHECKING = acct('Business Checking')!;
  const SERVICE_REV = acct('Service Revenue')!;
  const PRODUCT_REV = acct('Product Revenue')!;
  const SUPPLIES = acct('Office Supplies')!;
  const RENT = acct('Rent')!;
  const ADVERTISING = acct('Advertising')!;
  const BANK_CHARGES = acct('Bank Charges')!;
  const TRAVEL = acct('Travel')!;
  const INSURANCE = acct('Insurance')!;
  const PROFESSIONAL = acct('Professional')!;
  const UTILITIES = acct('Utilities')!;
  const TELEPHONE = acct('Telephone')!;

  // Create contacts
  const customers = [
    { contactType: 'customer' as const, displayName: 'Acme Corporation', email: 'billing@acme.com' },
    { contactType: 'customer' as const, displayName: 'Global Industries', email: 'ap@global.com' },
    { contactType: 'customer' as const, displayName: 'Smith & Associates', email: 'jane@smith.com' },
    { contactType: 'customer' as const, displayName: 'TechStart Inc', email: 'accounts@techstart.io' },
  ];
  const vendors = [
    { contactType: 'vendor' as const, displayName: 'Office Depot', email: 'orders@officedepot.com' },
    { contactType: 'vendor' as const, displayName: 'ABC Realty', email: 'rent@abcrealty.com' },
    { contactType: 'vendor' as const, displayName: 'Google Ads', email: 'ads@google.com' },
    { contactType: 'vendor' as const, displayName: 'State Farm Insurance', email: 'policy@statefarm.com' },
    { contactType: 'vendor' as const, displayName: 'City Power & Light', email: 'billing@citypower.com' },
  ];

  const createdContacts: Record<string, string> = {};
  for (const c of [...customers, ...vendors]) {
    try {
      const contact = await contactsService.create(tenantId, c);
      createdContacts[c.displayName] = contact.id;
    } catch { /* already exists */ }
  }
  console.log('Contacts created:', Object.keys(createdContacts).length);

  // Helper to post a transaction
  async function postExpense(date: string, amount: string, expenseAcct: string, memo: string, contactName?: string) {
    await ledger.postTransaction(tenantId, {
      txnType: 'expense', txnDate: date, total: amount, memo,
      contactId: contactName ? createdContacts[contactName] : undefined,
      lines: [
        { accountId: expenseAcct, debit: amount, credit: '0', description: memo },
        { accountId: CHECKING, debit: '0', credit: amount },
      ],
    });
  }

  async function postDeposit(date: string, amount: string, revenueAcct: string, memo: string, contactName?: string) {
    await ledger.postTransaction(tenantId, {
      txnType: 'deposit', txnDate: date, total: amount, memo,
      contactId: contactName ? createdContacts[contactName] : undefined,
      lines: [
        { accountId: CHECKING, debit: amount, credit: '0' },
        { accountId: revenueAcct, debit: '0', credit: amount, description: memo },
      ],
    });
  }

  console.log('Seeding 2025 transactions...');

  // === 2025 TRANSACTIONS ===
  // Monthly rent for 2025
  for (let m = 1; m <= 12; m++) {
    const date = `2025-${String(m).padStart(2, '0')}-01`;
    await postExpense(date, '2500.00', RENT, `Office rent - ${m}/2025`, 'ABC Realty');
  }

  // Monthly utilities
  for (let m = 1; m <= 12; m++) {
    const date = `2025-${String(m).padStart(2, '0')}-15`;
    const amount = (150 + Math.floor(Math.random() * 80)).toFixed(2);
    await postExpense(date, amount, UTILITIES, `Electricity - ${m}/2025`, 'City Power & Light');
  }

  // Monthly internet
  for (let m = 1; m <= 12; m++) {
    const date = `2025-${String(m).padStart(2, '0')}-10`;
    await postExpense(date, '89.99', TELEPHONE!, `Internet service - ${m}/2025`);
  }

  // Quarterly insurance
  for (const m of [1, 4, 7, 10]) {
    const date = `2025-${String(m).padStart(2, '0')}-05`;
    await postExpense(date, '1200.00', INSURANCE, `Business insurance Q${Math.ceil(m/3)}/2025`, 'State Farm Insurance');
  }

  // Monthly revenue - service
  for (let m = 1; m <= 12; m++) {
    const date = `2025-${String(m).padStart(2, '0')}-05`;
    const base = 8000 + Math.floor(Math.random() * 4000);
    await postDeposit(date, `${base}.00`, SERVICE_REV, `Consulting services - ${m}/2025`, 'Acme Corporation');
  }
  for (let m = 1; m <= 12; m++) {
    const date = `2025-${String(m).padStart(2, '0')}-20`;
    const base = 3000 + Math.floor(Math.random() * 2000);
    await postDeposit(date, `${base}.00`, SERVICE_REV, `IT support contract - ${m}/2025`, 'Global Industries');
  }

  // Periodic product sales
  for (const m of [2, 5, 8, 11]) {
    const date = `2025-${String(m).padStart(2, '0')}-15`;
    const base = 1500 + Math.floor(Math.random() * 1000);
    await postDeposit(date, `${base}.00`, PRODUCT_REV, `Software licenses - ${m}/2025`, 'TechStart Inc');
  }

  // Office supplies - quarterly
  for (const m of [1, 3, 6, 9]) {
    const date = `2025-${String(m).padStart(2, '0')}-12`;
    const amount = (200 + Math.floor(Math.random() * 150)).toFixed(2);
    await postExpense(date, amount, SUPPLIES, `Office supplies`, 'Office Depot');
  }

  // Advertising - bimonthly
  for (const m of [1, 3, 5, 7, 9, 11]) {
    const date = `2025-${String(m).padStart(2, '0')}-08`;
    const amount = (500 + Math.floor(Math.random() * 300)).toFixed(2);
    await postExpense(date, amount, ADVERTISING, `Google Ads campaign`, 'Google Ads');
  }

  // Professional fees - quarterly
  for (const m of [3, 6, 9, 12]) {
    const date = `2025-${String(m).padStart(2, '0')}-25`;
    await postExpense(date, '750.00', PROFESSIONAL, `Accounting services Q${Math.ceil(m/3)}/2025`);
  }

  // Travel - occasional
  for (const m of [2, 6, 10]) {
    const date = `2025-${String(m).padStart(2, '0')}-18`;
    const amount = (800 + Math.floor(Math.random() * 600)).toFixed(2);
    await postExpense(date, amount, TRAVEL, `Business travel`);
  }

  // Bank charges monthly
  for (let m = 1; m <= 12; m++) {
    const date = `2025-${String(m).padStart(2, '0')}-28`;
    await postExpense(date, '25.00', BANK_CHARGES, `Monthly bank fee - ${m}/2025`);
  }

  console.log('Seeding 2026 transactions...');

  // === 2026 TRANSACTIONS (Jan - Mar) ===
  for (let m = 1; m <= 3; m++) {
    const date = `2026-${String(m).padStart(2, '0')}-01`;
    await postExpense(date, '2500.00', RENT, `Office rent - ${m}/2026`, 'ABC Realty');
  }

  for (let m = 1; m <= 3; m++) {
    const date = `2026-${String(m).padStart(2, '0')}-15`;
    const amount = (160 + Math.floor(Math.random() * 80)).toFixed(2);
    await postExpense(date, amount, UTILITIES, `Electricity - ${m}/2026`, 'City Power & Light');
  }

  for (let m = 1; m <= 3; m++) {
    const date = `2026-${String(m).padStart(2, '0')}-10`;
    await postExpense(date, '89.99', TELEPHONE!, `Internet service - ${m}/2026`);
  }

  await postExpense('2026-01-05', '1200.00', INSURANCE, 'Business insurance Q1/2026', 'State Farm Insurance');

  // 2026 revenue
  for (let m = 1; m <= 3; m++) {
    const date = `2026-${String(m).padStart(2, '0')}-05`;
    const base = 9000 + Math.floor(Math.random() * 4000);
    await postDeposit(date, `${base}.00`, SERVICE_REV, `Consulting services - ${m}/2026`, 'Acme Corporation');
  }
  for (let m = 1; m <= 3; m++) {
    const date = `2026-${String(m).padStart(2, '0')}-20`;
    const base = 3500 + Math.floor(Math.random() * 2000);
    await postDeposit(date, `${base}.00`, SERVICE_REV, `IT support contract - ${m}/2026`, 'Global Industries');
  }
  await postDeposit('2026-02-15', '2200.00', PRODUCT_REV, 'Software licenses - Feb 2026', 'TechStart Inc');
  await postDeposit('2026-03-10', '1800.00', SERVICE_REV, 'Web development project', 'Smith & Associates');

  // 2026 expenses
  await postExpense('2026-01-12', '285.50', SUPPLIES, 'Printer paper and toner', 'Office Depot');
  await postExpense('2026-02-08', '650.00', ADVERTISING, 'Google Ads Q1 campaign', 'Google Ads');
  await postExpense('2026-03-25', '750.00', PROFESSIONAL, 'Quarterly accounting Q1/2026');
  await postExpense('2026-02-18', '1250.00', TRAVEL, 'Client site visit - Dallas');
  for (let m = 1; m <= 3; m++) {
    await postExpense(`2026-${String(m).padStart(2, '0')}-28`, '25.00', BANK_CHARGES, `Monthly bank fee - ${m}/2026`);
  }

  // Validate
  const validation = await ledger.validateBalance(tenantId);
  console.log('Balance validation:', validation.valid ? 'PASSED' : 'FAILED',
    `(debits: $${validation.totalDebits.toFixed(2)}, credits: $${validation.totalCredits.toFixed(2)})`);

  console.log('Done! Sample data seeded for 2025 and 2026.');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
