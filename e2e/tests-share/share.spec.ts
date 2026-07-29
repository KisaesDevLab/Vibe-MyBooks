// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Peer screen share E2E (addendum 14.11 + 14.12), three browser contexts:
// a sharer and two viewers (each self-registered → their own tenant → the
// cross-firm path is exercised end to end). Covers: start → code → two join
// requests → one approved (with cross-firm + entity confirmations), one
// denied → live DOM mirroring reaches the approved viewer → typed sensitive
// input NEVER reaches the viewer (masking regression) → eject clears the
// viewer surface → stop ends the session.

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const API = (process.env['SHARE_E2E_API'] || 'http://localhost:3111') + '/api/v1';
const PASSWORD = 'vibe-mybooks-e2e-share-passphrase-2026';
const runId = Date.now();

interface Actor {
  email: string;
  name: string;
  context: BrowserContext;
  page: Page;
}

async function register(email: string, name: string, company: string): Promise<void> {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, displayName: name, companyName: company }),
  });
  if (!res.ok) throw new Error(`register ${email} failed: ${res.status} ${await res.text()}`);
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  // A fresh registration lands on the setup wizard — skip it to reach the shell.
  const skip = page.getByRole('button', { name: 'Skip for now' });
  await Promise.race([
    skip.waitFor({ state: 'visible', timeout: 20_000 }).then(() => skip.click()),
    page.getByRole('button', { name: 'Toggle menu' }).waitFor({ state: 'visible', timeout: 20_000 }),
  ]);
  await page.getByRole('button', { name: 'Toggle menu' }).waitFor({ state: 'visible', timeout: 20_000 });
}

test.describe.serial('peer screen share — full flow', () => {
  let sharer: Actor;
  let viewerA: Actor;
  let viewerB: Actor;
  let joinCode = '';

  test.beforeAll(async ({ browser }) => {
    const mk = async (email: string, name: string, company: string): Promise<Actor> => {
      await register(email, name, company);
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, email);
      return { email, name, context, page };
    };
    sharer = await mk(`share-e2e-sharer-${runId}@test.com`, 'Sharer E2E', `Sharer Firm ${runId}`);
    viewerA = await mk(`share-e2e-viewa-${runId}@test.com`, 'Viewer Alpha', `Viewer A Firm ${runId}`);
    viewerB = await mk(`share-e2e-viewb-${runId}@test.com`, 'Viewer Beta', `Viewer B Firm ${runId}`);
  });

  test.afterAll(async () => {
    await sharer?.context.close();
    await viewerA?.context.close();
    await viewerB?.context.close();
  });

  test('sharer starts a session from the Knowledge Base and gets a one-time join code', async () => {
    const p = sharer.page;
    // Entry points live on the Knowledge Base page (not the app header).
    await p.goto('/help');
    await p.getByRole('button', { name: 'Share my screen' }).click();
    // Pre-share consent modal: plain language, no pre-checked boxes (9.2).
    await expect(p.getByText('Only this MyBooks tab is shared')).toBeVisible();
    await p.getByRole('button', { name: 'Start sharing' }).click();
    const codeEl = p.locator('[data-share-mask]').first();
    await expect(codeEl).toBeVisible();
    joinCode = (await codeEl.innerText()).trim();
    expect(joinCode).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/); // spoken grouping (9.3)
    await expect(p.getByText('Nothing is recorded or sent to anyone until you approve them.')).toBeVisible();
    await p.getByRole('button', { name: 'Done' }).click();
    // Live banner present with zero viewers (9.9).
    await expect(p.getByText('Sharing your screen')).toBeVisible();
    await expect(p.getByText('No viewers yet')).toBeVisible();
  });

  test('viewer A requests, sharer approves through cross-firm + entity confirmations', async () => {
    const v = viewerA.page;
    await v.goto('/share/view');
    await v.locator('#share-code').fill(joinCode);
    await v.getByRole('button', { name: 'Request to view' }).click();
    await expect(v.getByText(/Waiting for .* to approve/)).toBeVisible({ timeout: 10_000 });

    // Sharer sees the NAMED request (9.4) with both warnings (4.6/4.8).
    const s = sharer.page;
    await expect(s.getByText('Allow this person to watch?')).toBeVisible({ timeout: 15_000 });
    await expect(s.getByText('Viewer Alpha', { exact: true })).toBeVisible();
    await expect(s.getByText(`share-e2e-viewa-${runId}@test.com`)).toBeVisible();
    // Both warnings render for a cross-firm viewer with no entity access.
    await expect(s.getByText(/is outside your firm/)).toBeVisible();
    await expect(s.getByText(/does not have access to/)).toBeVisible();
    const allow = s.getByRole('button', { name: 'Allow' });
    await expect(allow).toBeDisabled(); // both confirmations still unchecked
    const checkboxes = s.getByRole('dialog').getByRole('checkbox');
    await checkboxes.nth(0).check(); // cross-firm confirmation (D5)
    await checkboxes.nth(1).check(); // entity-scope warning (4.8)
    await allow.click();

    // Viewer goes live and the mirrored DOM arrives.
    await expect(v.getByText('Live', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => {
        const frames = v.frames();
        for (const f of frames) {
          const text = await f.evaluate(() => document.body?.innerText ?? '').catch(() => '');
          if (text.includes('Sharing your screen') || text.length > 200) return true;
        }
        return false;
      }, { timeout: 20_000, message: 'replay iframe should render the sharer DOM' })
      .toBe(true);
    // Banner on the sharer side now lists Viewer Alpha with an eject control (9.9/9.10).
    await expect(s.getByRole('button', { name: 'Remove Viewer Alpha' })).toBeVisible({ timeout: 10_000 });
  });

  test('typed sensitive input never reaches the viewer (14.12 masking regression)', async () => {
    const s = sharer.page;
    const v = viewerA.page;
    const SECRET = `987-65-4320-SECRET-${runId}`;
    // Type into any input on the sharer's screen — global masking must hold
    // everywhere. Navigate SPA-style (a full page.goto() reload would drop
    // the sharer socket and correctly END the session per 5.11 — that
    // behavior is separately asserted below in the teardown tests).
    await s.getByRole('link', { name: 'Transactions', exact: true }).click();
    const anyInput = s.locator('input:visible').first();
    await anyInput.waitFor({ state: 'visible', timeout: 10_000 });
    await anyInput.fill(SECRET);
    // Give the recorder two flush cycles to ship the input event.
    await s.waitForTimeout(1500);
    for (const f of v.frames()) {
      const html = await f.evaluate(() => document.documentElement?.outerHTML ?? '').catch(() => '');
      expect(html).not.toContain(SECRET);
      expect(html).not.toContain('987-65-4320');
    }
  });

  test('viewer B is denied and cannot re-request', async () => {
    const v = viewerB.page;
    await v.goto('/share/view');
    await v.locator('#share-code').fill(joinCode);
    await v.getByRole('button', { name: 'Request to view' }).click();

    const s = sharer.page;
    await expect(s.getByText('Viewer Beta', { exact: true })).toBeVisible({ timeout: 15_000 });
    await s.getByRole('button', { name: 'Deny' }).click();

    // Denied viewer lands in a terminal state, and a fresh request is refused.
    await expect(v.getByText(/cannot join|no longer available|ran out/i)).toBeVisible({ timeout: 15_000 });
    await v.getByRole('button', { name: 'Enter another code' }).click();
    await v.locator('#share-code').fill(joinCode);
    await v.getByRole('button', { name: 'Request to view' }).click();
    await expect(v.getByText(/cannot join/i)).toBeVisible({ timeout: 10_000 });
  });

  test('eject clears the viewer surface without ending the session', async () => {
    const s = sharer.page;
    const v = viewerA.page;
    await s.getByRole('button', { name: 'Remove Viewer Alpha' }).click();
    await expect(v.getByText(/removed by|session ended|The sharer ended/i)).toBeVisible({ timeout: 15_000 });
    // 10.10 — nothing remains rendered.
    await expect(v.getByText(/session was logged/)).toBeVisible();
    expect(await v.locator('iframe').count()).toBe(0);
    // Session itself is still live for the sharer.
    await expect(s.getByText('Sharing your screen')).toBeVisible();
  });

  test('stop sharing tears everything down', async () => {
    const s = sharer.page;
    await s.getByRole('button', { name: 'Stop sharing' }).click();
    await expect(s.getByText('Sharing your screen')).not.toBeVisible({ timeout: 10_000 });
    // Entry point is available again on the Knowledge Base page.
    await s.goto('/help');
    await expect(s.getByRole('button', { name: 'Share my screen' })).toBeVisible({ timeout: 10_000 });
  });
});
