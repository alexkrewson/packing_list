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
    // different path: init() runs right after with no local
    // "masterLibraryVersion", so its isReset branch calls saveMasterItems(),
    // which fire-and-forget syncs the hardcoded defaults up — hence the poll.
    await expect.poll(() => fakeSupabase.tables.master_items.length).toBeGreaterThan(0);
  });

  /**
   * KNOWN BUG (found while writing this test, not something this suite
   * fixes): on a device that has never run the app before, `init()`'s
   * `masterLibraryVersion` localStorage key is absent, so `isReset` is
   * unconditionally true — even though this is an *existing* Supabase
   * account with its own customized item library that loadUserData() just
   * pulled down. Because `isReset` is true, init() skips loading the
   * just-fetched master items/containers and instead re-persists the
   * hardcoded default library over them via saveMasterItems() /
   * saveMasterContainers() — which immediately re-syncs those hardcoded
   * defaults back up to Supabase too (delete-then-reinsert), clobbering the
   * account's real data. Reproduced below: a cloud-only "Custom Cloud Item"
   * is lost after signing in on a "fresh device" (empty localStorage).
   */
  test('BUG: signing in on a fresh device clobbers an existing account\'s custom cloud item library', async ({ mockPage, fakeSupabase }) => {
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

    // If/when this is fixed, this item should be visible and the assertion
    // below should flip to "toBeGreaterThan(0)" / include the item id.
    await expect(mockPage.locator('.item-text', { hasText: 'Custom Cloud Item' })).toHaveCount(0);
    expect(fakeSupabase.tables.master_items.some((i: any) => i.id === 'i_custom')).toBe(false);
  });
});
