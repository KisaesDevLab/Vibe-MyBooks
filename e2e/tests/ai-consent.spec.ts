import { test, expect, request as pwRequest } from '@playwright/test';

// End-to-end smoke test for the two-tier AI consent flow.
//
// The critical invariants from AI_PII_PROTECTION_ADDENDUM.md:
//   - No AI job can start until BOTH tiers are on
//   - Company owner sees a dynamic disclosure listing the actual
//     provider + PII level in effect
//   - Stale-config flag re-appears when the admin loosens data handling
//
// Super-admin endpoints (enabling AI system-wide) require the
// isSuperAdmin flag, which normal `/auth/register` doesn't set —
// setup.service does. These tests therefore focus on the tenant-side
// flow + verifying that tenant requests fail cleanly while AI is off.
// The full happy path is covered by ai-consent.service.test.ts against
// an in-process DB.

const API = 'http://localhost:3001/api/v1';
const uniqueEmail = `e2e-ai-${Date.now()}@test.com`;
let token = '';
let companyId = '';

test.describe.serial('AI consent — tenant-side flow', () => {
  test('register a tenant user', async ({ request }) => {
    const res = await request.post(`${API}/auth/register`, {
      data: { email: uniqueEmail, password: 'TestPass123!', displayName: 'AI E2E', companyName: 'AI E2E Corp' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    token = body.tokens.accessToken;
    expect(token).toBeTruthy();
  });

  test('GET /ai/consent returns system-disabled shape', async ({ request }) => {
    const res = await request.get(`${API}/ai/consent`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.systemEnabled).toBe(false);
    expect(Array.isArray(body.companies)).toBe(true);
    expect(body.companies.length).toBeGreaterThan(0);
    companyId = body.companies[0].id;
    // Default company state: not opted in, no accepted version.
    expect(body.companies[0].aiEnabled).toBe(false);
    expect(body.companies[0].acceptedVersion).toBeNull();
  });

  test('company disclosure request works even with system off', async ({ request }) => {
    const res = await request.get(`${API}/ai/consent/${companyId}/disclosure`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.companyId).toBe(companyId);
    expect(body.aiEnabled).toBe(false);
    // Disclosure text is generated dynamically and must reference the company.
    expect(body.text).toContain('AI Processing Consent');
  });

  test('accepting company disclosure fails while system AI is off', async ({ request }) => {
    const res = await request.post(`${API}/ai/consent/${companyId}/accept`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBe(false);
    const body = await res.json();
    // Exact error text from ai-consent.service.acceptCompanyDisclosure.
    expect(JSON.stringify(body)).toMatch(/not enabled at the system level/i);
  });

  test('cross-tenant guard — 404 when companyId is from a different tenant', async ({ request }) => {
    // Register a second tenant and try to hit their companyId with
    // the original token. /ai/consent endpoints assert the companyId
    // belongs to the authenticated tenant before proceeding.
    const otherReq = await pwRequest.newContext();
    const otherReg = await otherReq.post(`${API}/auth/register`, {
      data: { email: `other-${Date.now()}@test.com`, password: 'TestPass123!', displayName: 'Other', companyName: 'Other Co' },
    });
    const otherBody = await otherReg.json();
    const otherToken = otherBody.tokens.accessToken;
    const otherConsent = await otherReq.get(`${API}/ai/consent`, { headers: { Authorization: `Bearer ${otherToken}` } });
    const otherJson = await otherConsent.json();
    const otherCompanyId = otherJson.companies[0].id;
    await otherReq.dispose();

    // Original token tries to touch the other tenant's company.
    const res = await request.get(`${API}/ai/consent/${otherCompanyId}/disclosure`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(404);
  });
});
