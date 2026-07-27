import { test, expect } from './fixtures';
import { createTrip, itemRow, addItemInSection } from './helpers/actions';

// The settings/profile dropdown is only reachable when SUPABASE_CONFIGURED is
// true and the user is signed in (`.profile-wrap.visible` is only added on
// successful auth) — local-only mode never shows it. authedPage bypasses the
// login form (session pre-seeded into localStorage) but still gets a fresh,
// empty local app underneath, so the usual trip/item helpers all work.
test.beforeEach(async ({ authedPage }) => {
  await createTrip(authedPage, 'Profile Menu Trip');
});

// Both dropdown sections ("Account", "Advanced") are collapsed by default
// (`.settings-section-body{display:none}` until the section gets `.open`),
// so every item lives behind an expand click first.
async function openProfileMenu(page: import('@playwright/test').Page, section: 'Account' | 'Advanced') {
  await page.locator('#profile-btn').click();
  await expect(page.locator('#profile-dropdown')).toBeVisible();
  await page.locator('.settings-section-toggle', { hasText: section }).click();
}

test.describe('settings / profile dropdown', () => {
  test('View edits shows a diff against defaults and its JSON', async ({ authedPage }) => {
    await openProfileMenu(authedPage, 'Advanced');
    await authedPage.locator('.profile-dd-item', { hasText: 'View edits' }).click();
    await expect(authedPage.locator('#edits-modal')).toHaveClass(/visible/);

    // A freshly created trip has no recorded defaults, so every starter item
    // shows up as "added".
    await expect(authedPage.locator('#edits-body')).toContainText('✚ Added');
    await expect(authedPage.locator('#edits-body')).toContainText('Keys');
    await expect(authedPage.locator('#edits-json')).toContainText('"item": "Keys"');

    await authedPage.locator('#edits-modal .edits-modal-close').click();
    await expect(authedPage.locator('#edits-modal')).not.toHaveClass(/visible/);
  });

  test('Find duplicates groups similarly-named items and merges them', async ({ authedPage }) => {
    await addItemInSection(authedPage, 'Me', 'Sock');
    await addItemInSection(authedPage, 'Me', 'Socks');
    await expect(itemRow(authedPage, 'Sock')).toBeVisible();
    await expect(itemRow(authedPage, 'Socks')).toBeVisible();
    const totalBefore = Number(await authedPage.locator('#pack-total').textContent());

    await openProfileMenu(authedPage, 'Advanced');
    await authedPage.locator('.profile-dd-item', { hasText: 'Find duplicates' }).click();
    await expect(authedPage.locator('#duplicates-modal')).toHaveClass(/visible/);
    const group = authedPage.locator('.dup-group').filter({ hasText: 'Sock' });
    await expect(group).toBeVisible();
    await expect(group.locator('.pending-radio-item')).toHaveCount(2);

    await group.getByRole('button', { name: 'Merge into selected →' }).click();

    await expect(authedPage.locator('.dup-group').filter({ hasText: 'Sock' })).toHaveCount(0);
    await authedPage.locator('#duplicates-modal .edits-modal-close').click();
    await expect(authedPage.locator('#pack-total')).toHaveText(String(totalBefore - 1));
  });

  test('reports no duplicates when the library is clean', async ({ authedPage }) => {
    await openProfileMenu(authedPage, 'Advanced');
    await authedPage.locator('.profile-dd-item', { hasText: 'Find duplicates' }).click();
    await expect(authedPage.locator('#duplicates-body')).toContainText('No duplicate items found');
  });

  test.describe('clipboard-dependent features (chromium only)', () => {
    test.skip(({ browserName }) => browserName !== 'chromium', 'clipboard permissions are unreliable outside Chromium');

    test('Copy JSON puts the full app context on the clipboard', async ({ authedPage, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await openProfileMenu(authedPage, 'Advanced');
      await authedPage.locator('.profile-dd-item', { hasText: 'Copy JSON' }).click();
      await expect(authedPage.locator('.inline-tooltip')).toContainText('JSON copied to clipboard');
      const clip = await authedPage.evaluate(() => navigator.clipboard.readText());
      const parsed = JSON.parse(clip);
      expect(parsed).toBeTruthy();
    });

    test('Paste JSON applies a patch from the clipboard', async ({ authedPage, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      const patch = {
        spec: 'trip-planner-patch',
        ops: [{ op: 'add_item', name: 'Patched Item', tab: 'pack', containerId: 'c_loose', trips: 'all' }],
      };
      await authedPage.evaluate((json) => navigator.clipboard.writeText(json), JSON.stringify(patch));

      await openProfileMenu(authedPage, 'Advanced');
      await authedPage.locator('.profile-dd-item', { hasText: 'Paste JSON' }).click();

      await expect(itemRow(authedPage, 'Patched Item')).toBeVisible();
    });

    test('Paste JSON reports invalid clipboard content', async ({ authedPage, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await authedPage.evaluate(() => navigator.clipboard.writeText('not json'));
      await openProfileMenu(authedPage, 'Advanced');
      await authedPage.locator('.profile-dd-item', { hasText: 'Paste JSON' }).click();
      await expect(authedPage.locator('.inline-tooltip.error')).toContainText('not valid JSON');
    });
  });

  test('Sign out returns to the login form', async ({ authedPage }) => {
    await openProfileMenu(authedPage, 'Account');
    await authedPage.locator('.profile-dd-item', { hasText: 'Sign out' }).click();
    await expect(authedPage.locator('#auth-overlay')).toBeVisible();
    await expect(authedPage.locator('#auth-form')).toBeVisible();
  });

  test('Change password validates length and mismatch before submitting', async ({ authedPage }) => {
    await openProfileMenu(authedPage, 'Account');
    await authedPage.locator('.profile-dd-item', { hasText: 'Change password' }).click();
    await expect(authedPage.locator('#pwreset-overlay')).toHaveClass(/visible/);

    await authedPage.locator('#pwreset-password').fill('short');
    await authedPage.locator('#pwreset-confirm').fill('short');
    await authedPage.getByRole('button', { name: 'Set Password →' }).click();
    await expect(authedPage.locator('#pwreset-error')).toContainText('6 characters');

    await authedPage.locator('#pwreset-password').fill('longenough1');
    await authedPage.locator('#pwreset-confirm').fill('longenough2');
    await authedPage.getByRole('button', { name: 'Set Password →' }).click();
    await expect(authedPage.locator('#pwreset-error')).toContainText('match');

    await authedPage.locator('#pwreset-password').fill('longenough1');
    await authedPage.locator('#pwreset-confirm').fill('longenough1');
    await authedPage.getByRole('button', { name: 'Set Password →' }).click();
    await expect(authedPage.locator('#pwreset-overlay')).not.toHaveClass(/visible/);
  });
});
