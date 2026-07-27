import { test, expect } from './fixtures';
import { createTrip, itemRow, openItemMenu } from './helpers/actions';

test.beforeEach(async ({ localPage }) => {
  await createTrip(localPage, 'Pending Trip');
});

test.describe('pending / "waiting on"', () => {
  test('linking a new task marks the item pending with a badge', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-pending').click();
    await expect(localPage.locator('#pending-modal')).toHaveClass(/visible/);

    await localPage.locator('#pending-new-task').fill('Find house keys');
    await localPage.getByRole('button', { name: 'Link →' }).click();

    await expect(localPage.locator('#pending-modal')).not.toHaveClass(/visible/);
    const row = itemRow(localPage, 'Keys');
    await expect(row).toHaveClass(/pending/);
    await expect(row.locator('.pending-badge')).toHaveText('⏳ Find house keys');

    // The new task itself was created and activated on the todo tab.
    await localPage.locator('#tab-btn-todo').click();
    await expect(itemRow(localPage, 'Find house keys')).toBeVisible();
  });

  test('linking to an existing task offers it as a radio option', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-pending').click();
    const showerLabel = localPage.locator('.pending-radio-item', { hasText: 'Shower' });
    await expect(showerLabel).toBeVisible();
    await showerLabel.locator('input[type="radio"]').check();
    await localPage.getByRole('button', { name: 'Link →' }).click();

    const row = itemRow(localPage, 'Keys');
    await expect(row).toHaveClass(/pending/);
    await expect(row.locator('.pending-badge')).toHaveText('⏳ Shower');
  });

  test('removing pending clears the badge', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-pending').click();
    await localPage.locator('#pending-new-task').fill('Some task');
    await localPage.getByRole('button', { name: 'Link →' }).click();
    await expect(itemRow(localPage, 'Keys')).toHaveClass(/pending/);

    const menu2 = await openItemMenu(localPage, 'Keys');
    await expect(menu2.locator('#cm-pending')).toContainText('Remove pending');
    await menu2.locator('#cm-pending').click();

    await expect(itemRow(localPage, 'Keys')).not.toHaveClass(/pending/);
  });

  test('setting a default pending task auto-links future adds of that item', async ({ localPage }) => {
    // Set a default on Keys via the edit modal.
    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-edit').click();
    await expect(localPage.locator('#edit-item-defaultpending-label')).toHaveText('None');
    await localPage.getByRole('button', { name: 'Set…' }).click();
    await expect(localPage.locator('#pending-modal-title')).toHaveText('Default "waiting on" task');

    await localPage.locator('#pending-new-task').fill('Charge keys fob');
    await localPage.getByRole('button', { name: 'Set →' }).click();

    // Back on the edit modal, the default now shows, and since Keys is
    // already active on this trip it gets linked immediately too.
    await expect(localPage.locator('#edit-item-modal')).toHaveClass(/visible/);
    await expect(localPage.locator('#edit-item-defaultpending-label')).toHaveText('Charge keys fob');
    await localPage.locator('#edit-item-modal').getByRole('button', { name: 'Cancel' }).click();
    await expect(itemRow(localPage, 'Keys')).toHaveClass(/pending/);

    // A new trip's starter items are activated directly (not through
    // addItemToTrip), so they don't pick up the default automatically — but
    // explicitly adding the item back via the pool (addItemToTrip's actual
    // path) does apply it, on any trip.
    await createTrip(localPage, 'Second Trip');
    const menu2 = await openItemMenu(localPage, 'Keys');
    await menu2.locator('#cm-remove').click();
    await localPage.locator('.pool-li', { hasText: 'Keys' }).click({ button: 'right' });
    await localPage.locator('.ctx-menu #cpm-add').click();
    await expect(itemRow(localPage, 'Keys')).toHaveClass(/pending/);
    await expect(itemRow(localPage, 'Keys').locator('.pending-badge')).toHaveText('⏳ Charge keys fob');
  });

  test('clearing a default pending task removes it from the edit modal', async ({ localPage }) => {
    const menu = await openItemMenu(localPage, 'Keys');
    await menu.locator('#cm-edit').click();
    await localPage.getByRole('button', { name: 'Set…' }).click();
    await localPage.locator('#pending-new-task').fill('Some default task');
    await localPage.getByRole('button', { name: 'Set →' }).click();
    await expect(localPage.locator('#edit-item-defaultpending-label')).toHaveText('Some default task');

    await localPage.getByRole('button', { name: 'Set…' }).click();
    await expect(localPage.locator('#pending-clear-btn')).toBeVisible();
    await localPage.locator('#pending-clear-btn').click();

    await expect(localPage.locator('#edit-item-defaultpending-label')).toHaveText('None');
  });
});
