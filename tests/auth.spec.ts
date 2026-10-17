import { test, expect } from './fixtures';

test.describe('sign in', () => {
  test('correct credentials reach the app', async ({ mockPage, fakeSupabase }) => {
    fakeSupabase.seedUser('user@example.com', 'password123');
    await mockPage.goto('/trips-app.html');
    await mockPage.locator('#auth-email').fill('user@example.com');
    await mockPage.locator('#auth-password').fill('password123');
    await mockPage.locator('#auth-signin-btn').click();

    await expect(mockPage.locator('#auth-overlay')).toBeHidden();
    await expect(mockPage.locator('#profile-wrap')).toHaveClass(/visible/);
    await expect(mockPage.locator('#pack-grid')).toBeVisible();
  });

  test('wrong password shows an error and stays on the form', async ({ mockPage, fakeSupabase }) => {
    fakeSupabase.seedUser('user@example.com', 'password123');
    await mockPage.goto('/trips-app.html');
    await mockPage.locator('#auth-email').fill('user@example.com');
    await mockPage.locator('#auth-password').fill('wrongpassword');
    await mockPage.locator('#auth-signin-btn').click();

    await expect(mockPage.locator('#auth-error')).toContainText('Invalid login credentials');
    await expect(mockPage.locator('#auth-form')).toBeVisible();
    await expect(mockPage.locator('#auth-overlay')).toBeVisible();
  });

  test('empty fields are rejected client-side without a network call', async ({ mockPage, fakeSupabase }) => {
    let authCalled = false;
    await mockPage.route('**/auth/v1/token*', (route) => {
      authCalled = true;
      return route.continue();
    });
    await mockPage.goto('/trips-app.html');
    await mockPage.locator('#auth-signin-btn').click();

    await expect(mockPage.locator('#auth-error')).toContainText('Enter your email and password');
    expect(authCalled).toBe(false);
  });
});

test.describe('sign up', () => {
  test('a short password is rejected client-side', async ({ mockPage }) => {
    await mockPage.goto('/trips-app.html');
    await mockPage.locator('#auth-mode-toggle').click();
    await mockPage.locator('#auth-email').fill('new@example.com');
    await mockPage.locator('#auth-password').fill('short');
    await mockPage.locator('#auth-signup-btn').click();

    await expect(mockPage.locator('#auth-error')).toContainText('at least 6 characters');
  });

  test('a new account with no email confirmation required signs straight in', async ({ mockPage }) => {
    await mockPage.goto('/trips-app.html');
    await mockPage.locator('#auth-mode-toggle').click();
    await expect(mockPage.locator('#auth-signup-btn')).toBeVisible();
    await expect(mockPage.locator('#auth-signin-btn')).toBeHidden();

    await mockPage.locator('#auth-email').fill('new@example.com');
    await mockPage.locator('#auth-password').fill('password123');
    await mockPage.locator('#auth-signup-btn').click();

    await expect(mockPage.locator('#auth-overlay')).toBeHidden();
    await expect(mockPage.locator('#pack-grid')).toBeVisible();
  });

  test('an account requiring email confirmation stays on the form with a notice', async ({ mockPage, fakeSupabase }) => {
    fakeSupabase.requireEmailConfirmation = true;
    await mockPage.goto('/trips-app.html');
    await mockPage.locator('#auth-mode-toggle').click();
    await mockPage.locator('#auth-email').fill('new@example.com');
    await mockPage.locator('#auth-password').fill('password123');
    await mockPage.locator('#auth-signup-btn').click();

    await expect(mockPage.locator('#auth-error')).toContainText('Check your email to confirm');
    await expect(mockPage.locator('#auth-overlay')).toBeVisible();
  });

  test('signing up for an already-registered email shows an error', async ({ mockPage, fakeSupabase }) => {
    fakeSupabase.seedUser('taken@example.com', 'password123');
    await mockPage.goto('/trips-app.html');
    await mockPage.locator('#auth-mode-toggle').click();
    await mockPage.locator('#auth-email').fill('taken@example.com');
    await mockPage.locator('#auth-password').fill('password123');
    await mockPage.locator('#auth-signup-btn').click();

    await expect(mockPage.locator('#auth-error')).toContainText('already registered');
  });

  test('toggling mode swaps labels and back again', async ({ mockPage }) => {
    await mockPage.goto('/trips-app.html');
    await expect(mockPage.locator('#auth-mode-text')).toHaveText('New here?');
    await mockPage.locator('#auth-mode-toggle').click();
    await expect(mockPage.locator('#auth-mode-text')).toHaveText('Already have an account?');
    await mockPage.locator('#auth-mode-toggle').click();
    await expect(mockPage.locator('#auth-mode-text')).toHaveText('New here?');
  });
});

test.describe('first-login cloud sync', () => {
  test('a brand-new account with nothing in Supabase pushes the local starter data up', async ({ mockPage, fakeSupabase }) => {
    fakeSupabase.seedUser('user@example.com', 'password123');
    await mockPage.goto('/trips-app.html');
    await mockPage.locator('#auth-email').fill('user@example.com');
    await mockPage.locator('#auth-password').fill('password123');
    await mockPage.locator('#auth-signin-btn').click();
    await expect(mockPage.locator('#auth-overlay')).toBeHidden();

    // loadUserData() sees no existing trips for this user and migrates the
    // local defaults ("salem"/"birthday") up via pushAllToSupabase().
    expect(fakeSupabase.tables.trips.map((t: any) => t.id).sort()).toEqual(['birthday', 'salem']);
    // Note: on a truly fresh browser, pushAllToSupabase() itself pushes zero
    // master_items (localStorage's "masterItems" key doesn't exist yet at
    // that point — it only reads what's already local, it doesn't know
    // about the hardcoded defaults). They arrive moments later via a
    // different path: init() finds no library locally or in the cloud, so it
    // calls saveMasterItems(), which fire-and-forget syncs the hardcoded
    // defaults up — hence the poll.
    await expect.poll(() => fakeSupabase.tables.master_items.length).toBeGreaterThan(0);
  });

  /**
   * Regression: on a device that had never run the app (no
   * `masterLibraryVersion` key), init() used to treat the missing key as a
   * stale library, overwrite the item library loadUserData() had just pulled
   * down with the hardcoded defaults, and sync those back up over the
   * account's real data. Moving the app to a new domain makes every browser
   * a "fresh device", so this must hold.
   */
  test("signing in on a fresh device keeps an existing account's cloud library and trip lists", async ({ mockPage, fakeSupabase }) => {
    const user = fakeSupabase.seedUser('cloud@example.com', 'password123');
    fakeSupabase.tables.trips.push({ id: 'salem', user_id: user.id, name: 'Salem' });
    fakeSupabase.tables.master_containers.push({ id: 'c_loose', name: 'Loose', icon: '🧳', parent_id: null, order_index: 0, user_id: user.id });
    fakeSupabase.tables.master_items.push({ id: 'i_custom', name: 'Custom Cloud Item', tab: 'pack', container_id: 'c_loose', order_index: 1, user_id: user.id });
    fakeSupabase.tables.trip_state.push({
      trip_id: 'salem', user_id: user.id,
      pack_active: ['i_custom'], todo_active: [], pack_checked: {}, todo_checked: {}, pack_pending: {},
    });

    await mockPage.goto('/trips-app.html');
    await mockPage.locator('#auth-email').fill('cloud@example.com');
    await mockPage.locator('#auth-password').fill('password123');
    await mockPage.locator('#auth-signin-btn').click();
    await expect(mockPage.locator('#auth-overlay')).toBeHidden();

    await expect(mockPage.locator('.item-text', { hasText: 'Custom Cloud Item' })).toHaveCount(1);
    // Salem's pack list is the account's, not TRIP_DEFAULTS.salem.pack.
    await expect(mockPage.locator('#pack-total')).toHaveText('1');
    // Give any (wrongly) fire-and-forget sync a moment to land before checking the backend.
    await mockPage.waitForTimeout(500);
    expect(fakeSupabase.tables.master_items.map((i: any) => i.id)).toEqual(['i_custom']);
    expect(fakeSupabase.tables.trip_state.find((s: any) => s.trip_id === 'salem')?.pack_active).toEqual(['i_custom']);
  });
});
