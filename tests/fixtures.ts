import { test as base, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { FakeSupabase, makeSession, SUPABASE_URL, type FakeUser } from './helpers/fakeSupabaseBackend';

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];

const VENDORED_SUPABASE_JS = fs.readFileSync(path.join(__dirname, 'vendor/supabase-js.umd.js'), 'utf8');

// Every test — local or mocked-auth — gets the CDN supabase-js script served
// from a vendored local copy, so the suite never depends on network access to
// jsdelivr and stays fast/deterministic in CI or offline.
async function stubSupabaseCdn(page: Page) {
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: VENDORED_SUPABASE_JS }),
  );
}

// The suggest-modal calls the Anthropic API directly from the browser for
// AI-generated to-do suggestions. There's no key configured in tests, so it
// would fail anyway and fall back — but stub it so we don't depend on (or
// wait on a timeout from) a real network call, and so tests can control what
// "AI" suggested.
async function stubAnthropicApi(page: Page, suggestions: string[] | 'error' = ['Pack it', 'Check it works']) {
  await page.route('https://api.anthropic.com/v1/messages', (route) => {
    // openSuggestModal()'s catch block only fires on a network-level failure
    // (fetch() doesn't reject on HTTP error statuses), so abort rather than
    // fulfill with a non-2xx status to simulate a real failure.
    if (suggestions === 'error') return route.abort('failed');
    return route.fulfill({
      status: 200,
      json: { content: [{ type: 'text', text: JSON.stringify(suggestions) }] },
    });
  });
}

type Fixtures = {
  /**
   * A page loaded in the app's built-in local-only mode: the SUPABASE_URL
   * constant is patched (only inside the served response, not on disk) so
   * SUPABASE_CONFIGURED is false and startup() skips auth entirely, going
   * straight to init(). No network calls, no auth overlay, fully offline.
   * Use this for everything that isn't specifically testing auth/sync.
   */
  localPage: Page;
  /** In-memory fake Supabase backend — seed users/tables before navigating mockPage. */
  fakeSupabase: FakeSupabase;
  /**
   * A page loaded with the app's real (unmodified) Supabase config, but every
   * auth/v1 and rest/v1 request is served by `fakeSupabase` instead of the
   * real project. Use for auth and cloud-sync tests. Does NOT auto-navigate —
   * seed fakeSupabase first, then `await mockPage.goto('/trips-app.html')`.
   */
  mockPage: Page;
  /** A FakeUser already seeded into fakeSupabase, for tests that don't care about signup/login itself. */
  authedUser: FakeUser;
  /**
   * A page that's already signed in (session pre-seeded into localStorage,
   * bypassing the login form) with real Supabase config + mocked network.
   * Use for features gated behind an authenticated session that aren't
   * themselves about auth — e.g. the settings/profile dropdown, which is
   * hidden in local-only mode (see trips-app.html's `.profile-wrap.visible`
   * gating, only added on successful sign-in).
   */
  authedPage: Page;
};

export const test = base.extend<Fixtures>({
  localPage: async ({ page }, use) => {
    await stubSupabaseCdn(page);
    await stubAnthropicApi(page);
    await page.route('**/trips-app.html', async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        /const SUPABASE_URL\s*=\s*'[^']*';/,
        "const SUPABASE_URL      = 'YOUR_SUPABASE_URL';",
      );
      await route.fulfill({ response, body });
    });
    await page.goto('/trips-app.html');
    await expect(page.locator('#auth-overlay')).toBeHidden();
    await use(page);
  },

  fakeSupabase: async ({}, use) => {
    await use(new FakeSupabase());
  },

  mockPage: async ({ page, fakeSupabase }, use) => {
    await stubSupabaseCdn(page);
    await stubAnthropicApi(page);
    await fakeSupabase.install(page);
    await use(page);
  },

  authedUser: async ({ fakeSupabase }, use) => {
    await use(fakeSupabase.seedUser('e2e@example.com', 'password123'));
  },

  authedPage: async ({ page, fakeSupabase, authedUser }, use) => {
    await stubSupabaseCdn(page);
    await stubAnthropicApi(page);
    await fakeSupabase.install(page);
    const session = makeSession(authedUser);
    // Deliberately NOT page.addInitScript: that re-runs on every future
    // navigation, including the reload trips-app.html triggers on sign-out —
    // which would silently re-seed the session and undo the sign-out. Seed
    // it once via a real reload instead, so later reloads behave normally.
    await page.goto('/trips-app.html');
    await page.evaluate(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: `sb-${PROJECT_REF}-auth-token`, value: JSON.stringify(session) },
    );
    await page.reload();
    await expect(page.locator('#auth-overlay')).toBeHidden();
    await expect(page.locator('#profile-wrap')).toHaveClass(/visible/);
    await use(page);
  },
});

export { expect };
