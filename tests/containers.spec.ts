import { test, expect } from './fixtures';
import { createTrip, itemRow, openContainerMenu, section } from './helpers/actions';

// A fresh trip starts with "Me" (Keys, Wallet, Phone — 3 active items) and
// "Hygiene Bag" (Toothbrush, Toothpaste) containers, plus the ever-present
// "Loose" container, independent of the demo trips' current contents.
test.beforeEach(async ({ localPage }) => {
  await createTrip(localPage, 'Container Test Trip');
});

test.describe('containers', () => {
  test('adding a top-level container via the footer button shows it, even empty', async ({ localPage }) => {
    await localPage.getByRole('button', { name: '+ Container' }).click();
    await expect(localPage.locator('#container-edit-modal')).toHaveClass(/visible/);
    await expect(localPage.locator('#container-edit-title')).toHaveText('Add Container');
    await expect(localPage.locator('#container-edit-parent-row')).toBeVisible();

    await localPage.locator('#container-edit-name').fill('Cooler');
    await localPage.locator('#container-edit-icon').fill('🧊');
    await localPage.getByRole('button', { name: 'Save' }).click();

    await expect(localPage.locator('#container-edit-modal')).not.toHaveClass(/visible/);
    await expect(section(localPage, 'Cooler')).toBeVisible();
    await expect(section(localPage, 'Cooler').locator(':scope > .category-header .cat-icon')).toHaveText('🧊');
  });

  test('renaming a container updates its title and keeps its items', async ({ localPage }) => {
    const menu = await openContainerMenu(localPage, 'Me');
    await menu.locator('#ccm-rename').click();
    await expect(localPage.locator('#container-edit-title')).toHaveText('Rename Container');
    await expect(localPage.locator('#container-edit-name')).toHaveValue('Me');
    await expect(localPage.locator('#container-edit-parent-row')).toBeHidden();

    await localPage.locator('#container-edit-name').fill('Myself');
    await localPage.getByRole('button', { name: 'Save' }).click();

    await expect(section(localPage, 'Myself')).toBeVisible();
    await expect(section(localPage, 'Myself').locator('.item-text', { hasText: 'Keys' })).toBeVisible();
    await expect(section(localPage, 'Me')).toHaveCount(0);
  });

  test('adding a sub-container nests it under its parent', async ({ localPage }) => {
    const menu = await openContainerMenu(localPage, 'Me');
    await menu.locator('#ccm-addsub').click();
    // Parent picker is shown (it's the "add" flow) and pre-selected to "Me".
    await expect(localPage.locator('#container-edit-parent-row')).toBeVisible();
    await expect(localPage.locator('#container-edit-parent option:checked')).toContainText('Me');

    await localPage.locator('#container-edit-name').fill('Pockets');
    await localPage.getByRole('button', { name: 'Save' }).click();

    const parent = section(localPage, 'Me');
    await expect(parent.locator('.category.container-node').filter({ hasText: 'Pockets' })).toBeVisible();
  });

  test("the Loose container can't be deleted", async ({ localPage }) => {
    const menu = await openContainerMenu(localPage, 'Loose');
    await expect(menu.locator('#ccm-delete')).toBeVisible();
    await menu.locator('#ccm-delete').click();

    await expect(localPage.locator('#confirm-delete-container-modal')).not.toHaveClass(/visible/);
    await expect(localPage.locator('.inline-tooltip.error')).toContainText("can't be deleted");
    await expect(section(localPage, 'Loose')).toBeVisible();
  });

  test('deleting a container reparents its items and sub-containers to its parent', async ({ localPage }) => {
    // Give "Me" a sub-container so we can confirm both items AND a
    // sub-container get moved up to the top level once "Me" is deleted.
    const addSubMenu = await openContainerMenu(localPage, 'Me');
    await addSubMenu.locator('#ccm-addsub').click();
    await localPage.locator('#container-edit-name').fill('Pockets');
    await localPage.getByRole('button', { name: 'Save' }).click();

    const menu = await openContainerMenu(localPage, 'Me');
    await menu.locator('#ccm-delete').click();
    await expect(localPage.locator('#confirm-delete-container-modal')).toHaveClass(/visible/);
    // The count is over the whole master library ("Me" has 6 items total —
    // Keys/Wallet/Phone/Sunglasses/Fieldy/Gloves — even though only 3 are
    // active on this fresh trip), not just what's active on this trip.
    await expect(localPage.locator('#confirm-delete-container-msg')).toContainText('6 items');
    await expect(localPage.locator('#confirm-delete-container-msg')).toContainText('1 sub-container');
    await expect(localPage.locator('#confirm-delete-container-msg')).toContainText('top level');

    await localPage.getByRole('button', { name: 'Delete' }).click();

    await expect(section(localPage, 'Me')).toHaveCount(0);
    await expect(itemRow(localPage, 'Keys')).toBeVisible();
    await expect(section(localPage, 'Pockets')).toBeVisible();
  });

  test('a container checkbox is indeterminate when some children are checked and checked when all are', async ({ localPage }) => {
    const cb = section(localPage, 'Me').locator(':scope > .category-header .container-cb');
    await expect(cb).not.toHaveClass(/checked|indeterminate/);

    await itemRow(localPage, 'Keys').click();
    await expect(cb).toHaveClass(/indeterminate/);

    await itemRow(localPage, 'Wallet').click();
    await itemRow(localPage, 'Phone').click();
    await expect(cb).toHaveClass(/checked/);
    await expect(cb).not.toHaveClass(/indeterminate/);
  });

  test('clicking a container checkbox toggles every active item inside it at once', async ({ localPage }) => {
    const cb = section(localPage, 'Me').locator(':scope > .category-header .container-cb');
    await cb.click();
    for (const name of ['Keys', 'Wallet', 'Phone']) {
      await expect(itemRow(localPage, name)).toHaveClass(/checked/);
    }
    await expect(localPage.locator('#pack-done')).toHaveText('3');

    await cb.click();
    for (const name of ['Keys', 'Wallet', 'Phone']) {
      await expect(itemRow(localPage, name)).not.toHaveClass(/checked/);
    }
    await expect(localPage.locator('#pack-done')).toHaveText('0');
  });
});
