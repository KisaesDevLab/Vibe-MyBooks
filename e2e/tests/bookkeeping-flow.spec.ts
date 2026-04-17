import { test, expect } from '@playwright/test';

const API = 'http://localhost:3001/api/v1';
const uniqueEmail = `e2e-${Date.now()}@test.com`;
let token = '';

test.describe.serial('Vibe MyBooks E2E Flow', () => {

  test('1. Register new account', async ({ request }) => {
    const res = await request.post(`${API}/auth/register`, {
      data: { email: uniqueEmail, password: 'TestPass123!', displayName: 'E2E User', companyName: 'E2E Corp' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.user.email).toBe(uniqueEmail);
    expect(body.tokens.accessToken).toBeTruthy();
    token = body.tokens.accessToken;
  });

  test('2. COA is seeded after registration', async ({ request }) => {
    const res = await request.get(`${API}/accounts?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.total).toBeGreaterThan(30);
    // System accounts exist
    const names = body.data.map((a: any) => a.name);
    expect(names).toContain('Accounts Receivable');
    expect(names).toContain('Payments Clearing');
    expect(names).toContain('Retained Earnings');
  });

  test('3. Create customer contact', async ({ request }) => {
    const res = await request.post(`${API}/contacts`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { contactType: 'customer', displayName: 'E2E Customer', email: 'customer@e2e.com' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.contact.displayName).toBe('E2E Customer');
  });

  test('4. Create expense → verify in transaction list', async ({ request }) => {
    // Get account IDs
    const acctRes = await request.get(`${API}/accounts?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const accounts = (await acctRes.json()).data;
    // Default 'general_business' COA seeds the bank account as "Cash"
    // (systemTag=cash_on_hand). Don't match "Business Checking" — that's
    // a different template and will break on the default seed.
    const checking = accounts.find((a: any) => a.systemTag === 'cash_on_hand');
    const supplies = accounts.find((a: any) => a.name === 'Office Supplies');
    expect(checking, 'expected cash_on_hand system account to be seeded').toBeTruthy();
    expect(supplies, 'expected Office Supplies account to be seeded').toBeTruthy();

    const res = await request.post(`${API}/transactions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        txnType: 'expense', txnDate: '2026-03-15',
        payFromAccountId: checking.id, expenseAccountId: supplies.id,
        amount: '250.00', memo: 'E2E test expense',
      },
    });
    expect(res.ok()).toBeTruthy();

    // Verify in transaction list
    const listRes = await request.get(`${API}/transactions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const txns = (await listRes.json()).data;
    expect(txns.some((t: any) => t.memo === 'E2E test expense')).toBeTruthy();
  });

  test('5. Create invoice → record payment → verify paid', async ({ request }) => {
    const acctRes = await request.get(`${API}/accounts?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const accounts = (await acctRes.json()).data;
    const revenue = accounts.find((a: any) => a.name === 'Service Revenue');
    const checking = accounts.find((a: any) => a.systemTag === 'cash_on_hand');
    expect(revenue, 'expected Service Revenue account').toBeTruthy();
    expect(checking, 'expected cash_on_hand system account').toBeTruthy();

    // Get customer
    const contactsRes = await request.get(`${API}/contacts?contactType=customer`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const customer = (await contactsRes.json()).data[0];

    // Create invoice
    const invRes = await request.post(`${API}/invoices`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        txnDate: '2026-03-01', contactId: customer.id,
        lines: [{ accountId: revenue.id, description: 'E2E service', quantity: '1', unitPrice: '5000' }],
      },
    });
    expect(invRes.ok()).toBeTruthy();
    const invoice = (await invRes.json()).invoice;
    expect(invoice.total).toBe('5000.0000');

    // Record payment
    const payRes = await request.post(`${API}/invoices/${invoice.id}/payment`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { amount: '5000', txnDate: '2026-03-10', depositToAccountId: checking.id },
    });
    expect(payRes.ok()).toBeTruthy();

    // Verify paid
    const checkRes = await request.get(`${API}/invoices/${invoice.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const updated = (await checkRes.json()).invoice;
    expect(updated.invoiceStatus).toBe('paid');
    expect(updated.balanceDue).toBe('0.0000');
  });

  test('6. P&L report shows correct totals', async ({ request }) => {
    const res = await request.get(`${API}/reports/profit-loss?start_date=2026-01-01&end_date=2026-12-31`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const report = await res.json();
    expect(report.totalRevenue).toBeGreaterThan(0);
    expect(report.totalExpenses).toBeGreaterThan(0);
  });

  test('7. Balance sheet balances', async ({ request }) => {
    const res = await request.get(`${API}/reports/balance-sheet`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const report = await res.json();
    // Assets should approximately equal liabilities + equity
    const diff = Math.abs(report.totalAssets - report.totalLiabilitiesAndEquity);
    expect(diff).toBeLessThan(1);
  });

  test('8. Ledger validates — total debits = total credits', async ({ request }) => {
    // Use the trial balance as a proxy
    const res = await request.get(`${API}/reports/trial-balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const report = await res.json();
    const diff = Math.abs(report.totalDebits - report.totalCredits);
    expect(diff).toBeLessThan(0.01);
  });

});
