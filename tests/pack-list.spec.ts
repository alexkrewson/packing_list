import { test, expect } from './fixtures';
import { createTrip, itemRow, openItemMenu, openPoolMenu, poolRow, section, addItemInSection } from './helpers/actions';

// A fresh trip always starts with the same five pack starter items (Keys,
// Wallet, Phone in "Me"; Toothbrush, Toothpaste in "Hygiene Bag") regardless
// of what the "salem"/"birthday" demo trips currently contain, so these tests
// don't churn every time the demo trip content changes.
test.beforeEach(async ({ localPage }) => {
  await createTrip(localPage, 'Pack Test Trip');
});

test.describe('pack list', () => {
  test('starter items are active and progress reflects them', async ({ localPage }) => {
    for (const name of ['Keys', 'Wallet', 'Phone', 'Toothbrush', 'Toothpaste']) {
      await expect(itemRow(localPage, name)).toBeVisible();
    }
    await expect(localPage.locator('#pack-total')).toHaveText('5');
    await expect(localPage.locator('#pack-done')).toHaveText('0');
  });

  test('adding a new item via a section add-row makes it active', async ({ localPage }) => {
    await addItemInSection(localPage, 'Me', 'Sunglasses');
    await expect(itemRow(localPage, 'Sunglasses')).toBeVisible();
    await expect(localPage.locator('#pack-total')).toHaveText('6');
  });

  test('checking and unchecking an item updates progress and styling', async ({ localPage }) => {
    const row = itemRow(localPage, 'Keys');
    await row.click();
    await expect(row).toHaveClass(/checked/);
    await expect(localPage.locator('#pack-done')).toHaveText('1');

    await row.click();
    await expect(row).not.toHaveClass(/checked/);
    await expect(localPage.locator('#pack-done')).toHaveText('0');
  });

  test('checking every item shows the all-done banner', async ({ localPage }) => {
    await expect(localPage.locator('#pack-all-done')).toBeHidden();
    for (const name of ['Keys', 'Wallet', 'Phone', 'Toothbrush', 'Toothpaste']) {
      await itemRow(localPage, name).click();
    }
    await expect(localPage.locator('#pack-done')).toHaveText('5');
    await expect(localPage.locator('#pack-all-done')).toBeVisible();
  });

  test('the Reset footer button clears all checked state', async ({ localPage }) => {
    await itemRow(localPage, 'Keys').click();
    await itemRow(localPage, 'Wallet').click();
    await expect(localPage.locator('#pack-done')).toHaveText('2');

    await localPage.getByRole('button', { name: 'Reset' }).click();
    await expect(localPage.locator('#pack-done')).toHaveText('0');
    await expect(itemRow(localPage, 'Keys')).not.toHaveClass(/checked/);
  });

  test('editing an item renames it in place', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-edit').click();
    await expect(localPage.locator('#edit-item-modal')).toHaveClass(/visible/);
    await expect(localPage.locator('#edit-item-name')).toHaveValue('Keys');

    await localPage.locator('#edit-item-name').fill('House Keys');
    await localPage.getByRole('button', { name: 'Save' }).click();

    await expect(localPage.locator('#edit-item-modal')).not.toHaveClass(/visible/);
    await expect(itemRow(localPage, 'House Keys')).toBeVisible();
    await expect(itemRow(localPage, 'Keys')).toHaveCount(0);
  });

  test('editing an item can move it into a brand-new container', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-edit').click();
    await localPage.locator('#edit-item-cat').selectOption('__new__');
    await expect(localPage.locator('#new-cat-field')).toBeVisible();
    await localPage.locator('#edit-new-cat').fill('Glovebox');
    await localPage.getByRole('button', { name: 'Save' }).click();

    await expect(section(localPage, 'Glovebox')).toBeVisible();
    await expect(section(localPage, 'Glovebox').locator('.item-text', { hasText: 'Keys' })).toBeVisible();
  });

  test('deleting an item permanently removes it from the trip and the pool', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-edit').click();
    await localPage.getByRole('button', { name: '🗑 Delete Permanently' }).click();
    await expect(localPage.locator('#confirm-delete-modal')).toHaveClass(/visible/);
    await expect(localPage.locator('#confirm-msg')).toContainText('Keys');

    await localPage.getByRole('button', { name: 'Delete from all trips' }).click();

    await expect(localPage.locator('#confirm-delete-modal')).not.toHaveClass(/visible/);
    await expect(itemRow(localPage, 'Keys')).toHaveCount(0);
    await expect(poolRow(localPage, 'Keys')).toHaveCount(0);
    await expect(localPage.locator('#pack-total')).toHaveText('4');
  });

  test('cancelling the delete-confirm modal returns to the edit modal without deleting', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-edit').click();
    await localPage.getByRole('button', { name: '🗑 Delete Permanently' }).click();
    await localPage.locator('#confirm-delete-modal').getByRole('button', { name: 'Cancel' }).click();

    await expect(localPage.locator('#confirm-delete-modal')).not.toHaveClass(/visible/);
    await expect(localPage.locator('#edit-item-modal')).toHaveClass(/visible/);
    await localPage.locator('#edit-item-modal').getByRole('button', { name: 'Cancel' }).click();
    await expect(itemRow(localPage, 'Keys')).toBeVisible();
  });

  test('removing an item from the list sends it to the pool, and it can be re-added', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-remove').click();

    await expect(itemRow(localPage, 'Keys')).toHaveCount(0);
    await expect(localPage.locator('#pack-total')).toHaveText('4');
    await expect(poolRow(localPage, 'Keys')).toBeVisible();

    const poolMenu = await openPoolMenu(localPage, 'Keys');
    await poolMenu.locator('#cpm-add').click();

    await expect(itemRow(localPage, 'Keys')).toBeVisible();
    await expect(localPage.locator('#pack-total')).toHaveText('5');
    await expect(poolRow(localPage, 'Keys')).toHaveCount(0);
  });

  test('turning an item into a container converts it in place', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-containerize').click();

    await expect(itemRow(localPage, 'Keys')).toHaveCount(0);
    await expect(section(localPage, 'Keys')).toBeVisible();
  });

  test('footer shows item and container counts', async ({ localPage }) => {
    await expect(localPage.locator('#pack-footer')).toContainText('items');
    await expect(localPage.locator('#pack-footer')).toContainText('containers');
  });
});
