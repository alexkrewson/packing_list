import { test, expect } from './fixtures';
import { createTrip, itemRow, addItemInSection, openItemMenu, section } from './helpers/actions';

test.beforeEach(async ({ localPage }) => {
  await createTrip(localPage, 'Persistence Trip');
  // createTrip() sets the in-memory currentTrip but — see the dedicated bug
  // test below — never persists it as "last trip", so a reload right after
  // creating a trip silently drops you back onto the previous one. Re-select
  // it via the dropdown (a real change event, unlike the programmatic
  // selection createTrip() leaves behind) to fire switchTrip(), which does
  // persist it, so the rest of these tests can isolate what they're actually
  // testing (checked state / item / edit persistence) from that bug.
  const select = localPage.locator('#trip-select');
  await select.selectOption(await select.inputValue());
});

test.describe('persistence across reload', () => {
  test('checked state survives a reload', async ({ localPage }) => {
    await itemRow(localPage, 'Keys').click();
    await expect(itemRow(localPage, 'Keys')).toHaveClass(/checked/);

    await localPage.reload();

    await expect(itemRow(localPage, 'Keys')).toHaveClass(/checked/);
    await expect(localPage.locator('#pack-done')).toHaveText('1');
  });

  test('added and removed active items survive a reload', async ({ localPage }) => {
    await addItemInSection(localPage, 'Me', 'Sunglasses');
    const menu = await openItemMenu(localPage, 'Wallet');
    await menu.locator('#cm-remove').click();

    await localPage.reload();

    await expect(itemRow(localPage, 'Sunglasses')).toBeVisible();
    await expect(itemRow(localPage, 'Wallet')).toHaveCount(0);
    await expect(localPage.locator('#pack-total')).toHaveText('5'); // 5 starters + Sunglasses - Wallet
  });

  test('renamed items and new containers survive a reload', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-edit').click();
    await localPage.locator('#edit-item-name').fill('House Keys');
    await localPage.locator('#edit-item-cat').selectOption('__new__');
    await localPage.locator('#edit-new-cat').fill('Entryway');
    await localPage.getByRole('button', { name: 'Save' }).click();

    await localPage.reload();

    await expect(section(localPage, 'Entryway')).toBeVisible();
    // Scope to the top-level pack-grid item, not the new container that
    // also now contains an item literally named "House Keys" inside it —
    // itemRow() matches by item-text alone, and both spans currently exist.
    await expect(section(localPage, 'Entryway').locator('.item-text', { hasText: 'House Keys' })).toBeVisible();
  });

  test('the active tab does not survive a reload — it resets to Packing List', async ({ localPage }) => {
    await localPage.locator('#tab-btn-todo').click();
    await expect(localPage.locator('#tab-btn-todo')).toHaveClass(/active/);

    await localPage.reload();

    await expect(localPage.locator('#tab-btn-pack')).toHaveClass(/active/);
    await expect(localPage.locator('#tab-btn-todo')).not.toHaveClass(/active/);
  });

  test('checked state is isolated per trip', async ({ localPage }) => {
    await itemRow(localPage, 'Keys').click();
    await expect(localPage.locator('#pack-done')).toHaveText('1');

    await createTrip(localPage, 'Second Isolated Trip');
    await expect(localPage.locator('#pack-done')).toHaveText('0');
    await expect(itemRow(localPage, 'Keys')).not.toHaveClass(/checked/);

    // Switch back to the first trip via the selector and confirm its state held.
    const select = localPage.locator('#trip-select');
    const firstTripValue = await select.locator('option', { hasText: 'Persistence Trip' }).getAttribute('value');
    await select.selectOption(firstTripValue!);
    await expect(localPage.locator('#pack-done')).toHaveText('1');
    await expect(itemRow(localPage, 'Keys')).toHaveClass(/checked/);
  });
});
