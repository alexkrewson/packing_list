import { test, expect } from './fixtures';

test('local-only mode loads without auth', async ({ localPage }) => {
  await expect(localPage.locator('#pack-grid')).toBeVisible();
  await expect(localPage.locator('#tab-btn-pack')).toHaveClass(/active/);
});

test('authedPage fixture bypasses login and shows settings menu', async ({ authedPage }) => {
  await authedPage.locator('#profile-btn').click();
  await expect(authedPage.locator('#profile-dropdown')).toBeVisible();
});

test('mocked supabase: sign in reaches the app', async ({ mockPage, fakeSupabase }) => {
  fakeSupabase.seedUser('test@example.com', 'password123');
  await mockPage.goto('/trips-app.html');
  await expect(mockPage.locator('#auth-form')).toBeVisible();
  await mockPage.locator('#auth-email').fill('test@example.com');
  await mockPage.locator('#auth-password').fill('password123');
  await mockPage.locator('#auth-signin-btn').click();
  await expect(mockPage.locator('#auth-overlay')).toBeHidden();
  await expect(mockPage.locator('#pack-grid')).toBeVisible();
});
